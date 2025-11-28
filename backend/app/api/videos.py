"""
Video Management API endpoints.

Implements:
- POST /api/lists/{list_id}/videos - Add video to list
- GET /api/lists/{list_id}/videos - Get all videos in list
- DELETE /videos/{id} - Delete video

Includes:
- YouTube URL parsing and ID extraction
- Duplicate detection (409 Conflict)
- List validation (404 if not found)
- Race condition handling with IntegrityError
- Proper database commit after operations
"""

from uuid import UUID
import re
from typing import List, Sequence, Optional, Annotated, Dict, Tuple, Set, Literal
import csv
import io
from datetime import datetime, timezone
from app.api.field_validation import validate_field_value, FieldValidationError
from app.api.helpers.field_union import compute_field_union_with_conflicts, get_available_fields_for_videos, get_available_fields_for_video
import logging

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import selectinload, joinedload, aliased
from sqlalchemy.dialects.postgresql import insert as pg_insert
from isodate import parse_duration
from httpx import HTTPError, TimeoutException
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError

from app.core.database import get_db
from app.core.redis import get_arq_pool, get_redis_client
from app.core.config import settings
from app.clients.youtube import YouTubeClient
from app.models.list import BookmarkList
from app.models.video import Video
from app.models.job import ProcessingJob
from app.models.tag import Tag, video_tags
from app.models.schema_field import SchemaField
from app.models.field_schema import FieldSchema
from app.models.custom_field import CustomField
from app.models.video_field_value import VideoFieldValue
from app.schemas.video import VideoAdd, VideoResponse, BulkUploadResponse, BulkUploadFailure, VideoFieldValueResponse, AvailableFieldResponse, VideoFilterRequest, FieldFilterOperator, UpdateWatchProgressRequest, UpdateWatchProgressResponse
from app.schemas.video_field_value import (
    BatchUpdateFieldValuesRequest,
    BatchUpdateFieldValuesResponse,
)
from app.schemas.tag import TagResponse
from app.schemas.custom_field import CustomFieldResponse
from app.services.channel_service import get_or_create_channel
from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus
from app.models.channel import Channel
from pydantic import BaseModel

logger = logging.getLogger(__name__)


async def _load_channel_thumbnails(videos: Sequence[Video], db: AsyncSession) -> None:
    """
    Load channel thumbnails for all videos and assign to channel_thumbnail_url.

    This fetches all channels for the videos in a single query and assigns
    the thumbnail_url to each video's __dict__ for serialization.

    Falls back to matching by channel name if channel_id is not set.
    """
    if not videos:
        return

    # Get all unique channel_ids from videos
    channel_ids = list(set(v.channel_id for v in videos if v.channel_id))

    # Get all unique channel names for videos without channel_id
    channel_names = list(set(v.channel for v in videos if not v.channel_id and v.channel))

    channels_by_id: dict = {}
    channels_by_name: dict = {}

    # Fetch channels by ID
    if channel_ids:
        channels_stmt = select(Channel).where(Channel.id.in_(channel_ids))
        channels_result = await db.execute(channels_stmt)
        channels_by_id = {c.id: c for c in channels_result.scalars().all()}

    # Fetch channels by name (fallback for videos without channel_id)
    if channel_names:
        channels_name_stmt = select(Channel).where(Channel.name.in_(channel_names))
        channels_name_result = await db.execute(channels_name_stmt)
        channels_by_name = {c.name: c for c in channels_name_result.scalars().all()}

    # Assign thumbnail_url to each video
    for video in videos:
        if video.channel_id and video.channel_id in channels_by_id:
            video.__dict__['channel_thumbnail_url'] = channels_by_id[video.channel_id].thumbnail_url
        elif video.channel and video.channel in channels_by_name:
            video.__dict__['channel_thumbnail_url'] = channels_by_name[video.channel].thumbnail_url
        else:
            video.__dict__['channel_thumbnail_url'] = None


async def _enqueue_enrichment(video_id: UUID, db: AsyncSession) -> None:
    """
    Enqueue enrichment job for a video if auto-trigger is enabled.

    Creates pending VideoEnrichment record and enqueues ARQ job.
    Silently skips if enrichment is disabled or Redis unavailable.
    """
    if not settings.enrichment_enabled or not settings.enrichment_auto_trigger:
        return

    # Create pending enrichment record (not yet flushed)
    enrichment = VideoEnrichment(
        video_id=video_id,
        status=EnrichmentStatus.pending.value
    )
    db.add(enrichment)

    try:
        # Enqueue ARQ job first - if this fails, we don't want the DB record
        arq_pool = await get_arq_pool()
        await arq_pool.enqueue_job("enrich_video", str(video_id))

        # Only flush after job is successfully enqueued
        await db.flush()
        logger.info(f"Enqueued enrichment job for video {video_id}")
    except (RedisError, RedisConnectionError, OSError) as e:
        # Redis/connection errors - expunge the unpersisted enrichment record
        db.expunge(enrichment)
        logger.warning(f"Failed to enqueue enrichment job for video {video_id}: {e}")


def parse_youtube_duration(iso_duration: str | None) -> int | None:
    """Parse ISO 8601 duration to seconds."""
    if not iso_duration:
        return None
    try:
        duration_obj = parse_duration(iso_duration)
        return int(duration_obj.total_seconds())
    except (ValueError, AttributeError, TypeError) as e:
        # ValueError: Invalid ISO 8601 format
        # AttributeError: duration_obj is None or missing total_seconds()
        # TypeError: Unexpected type passed to parse_duration
        logger.debug(f"Invalid duration format '{iso_duration}': {e}")
        return None


def parse_youtube_timestamp(timestamp: str | None) -> datetime | None:
    """Parse YouTube API timestamp to timezone-aware datetime."""
    if not timestamp:
        return None
    try:
        return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except (ValueError, AttributeError) as e:
        logger.debug(f"Invalid timestamp format '{timestamp}': {e}")
        return None


router = APIRouter(prefix="/api", tags=["videos"])


async def _enqueue_video_processing(
    db: AsyncSession,
    list_id: int,
    total_videos: int
) -> Optional[ProcessingJob]:
    """
    Helper to create ProcessingJob and enqueue ARQ task.

    CRITICAL: Fetches schema from list and passes it to worker for Gemini extraction.
    """
    if total_videos == 0:
        return None

    # Fetch list with schema (eager load)
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise ValueError(f"List {list_id} not found")

    # Fetch schema fields if list has schema
    schema_fields = None
    if bookmark_list.schema_id:
        from app.models.schema import Schema
        result = await db.execute(
            select(Schema).where(Schema.id == bookmark_list.schema_id)
        )
        schema = result.scalar_one_or_none()
        if schema:
            schema_fields = schema.fields  # JSONB dict

    # Create processing job
    job = ProcessingJob(
        list_id=list_id,
        total_videos=total_videos,
        status="running"
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Query pending video IDs
    result = await db.execute(
        select(Video.id).where(
            Video.list_id == list_id,
            Video.processing_status == "pending"
        )
    )
    video_ids = [str(vid) for vid in result.scalars().all()]

    # Enqueue ARQ job with schema
    arq_pool = await get_arq_pool()
    await arq_pool.enqueue_job(
        "process_video_list",
        str(job.id),
        str(list_id),
        video_ids,
        schema_fields  # CRITICAL: Pass schema to worker
    )

    return job


def extract_youtube_id(url: str) -> str:
    """
    Extract YouTube video ID from URL.

    Supports formats:
    - youtube.com/watch?v=VIDEO_ID
    - youtu.be/VIDEO_ID
    - youtube.com/embed/VIDEO_ID
    - m.youtube.com/watch?v=VIDEO_ID

    Args:
        url: YouTube video URL

    Returns:
        str: 11-character YouTube video ID

    Raises:
        ValueError: If video ID cannot be extracted
    """
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'm\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    raise ValueError("Could not extract YouTube video ID from URL")


async def _apply_sorting(
    stmt,
    sort_by: Optional[str],
    sort_order: str,
    db: AsyncSession
):
    """
    Apply sorting to a video query statement.

    Handles both standard column sorting and custom field sorting.
    Uses NULLS LAST for both ASC and DESC to ensure sorted values appear first.

    Args:
        stmt: SQLAlchemy Select statement
        sort_by: Column or field to sort by (format: "field:<uuid>" for custom fields)
        sort_order: "asc" or "desc"
        db: Database session for field lookup

    Returns:
        Modified Select statement with sorting applied

    Raises:
        HTTPException: If sort_by is invalid or field not found
    """
    if not sort_by:
        # Default sorting: created_at descending (newest first)
        return stmt.order_by(desc(Video.created_at))

    if sort_by.startswith("field:"):
        # Field-based sorting
        field_id_str = sort_by.split(":", 1)[1]
        try:
            field_id = UUID(field_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid field_id in sort_by parameter"
            )

        # Validate field exists
        field_result = await db.execute(
            select(CustomField).where(CustomField.id == field_id)
        )
        field = field_result.scalar_one_or_none()
        if not field:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Custom field not found"
            )

        # LEFT JOIN to video_field_values and sort by typed column
        stmt = stmt.outerjoin(
            VideoFieldValue,
            and_(
                VideoFieldValue.video_id == Video.id,
                VideoFieldValue.field_id == field_id
            )
        )

        # Determine sort column based on field type
        if field.field_type == "rating":
            sort_column = VideoFieldValue.value_numeric
        elif field.field_type in ("select", "text"):
            sort_column = VideoFieldValue.value_text
        elif field.field_type == "boolean":
            sort_column = VideoFieldValue.value_boolean
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported field type: {field.field_type}"
            )

        # Apply ORDER BY with explicit NULL handling
        # CRITICAL: Use .nulls_last() for BOTH asc AND desc
        # Rationale: Users always want sorted values first, empty values last
        if sort_order == "desc":
            stmt = stmt.order_by(desc(sort_column).nulls_last())
        else:
            stmt = stmt.order_by(asc(sort_column).nulls_last())

    else:
        # Standard column sorting (title, duration, created_at, channel)
        valid_columns = {
            "title": Video.title,
            "duration": Video.duration,
            "created_at": Video.created_at,
            "channel": Video.channel
        }

        if sort_by not in valid_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sort_by column: {sort_by}. Valid options: {', '.join(valid_columns.keys())}"
            )

        sort_column = valid_columns[sort_by]
        # Apply nulls_last for both directions on standard columns too
        if sort_order == "desc":
            stmt = stmt.order_by(desc(sort_column).nulls_last())
        else:
            stmt = stmt.order_by(asc(sort_column).nulls_last())

    return stmt


@router.post(
    "/lists/{list_id}/videos",
    response_model=VideoResponse,
    status_code=status.HTTP_201_CREATED
)
async def add_video_to_list(
    list_id: UUID,
    video_data: VideoAdd,
    db: AsyncSession = Depends(get_db)
) -> Video:
    """
    Add a video to a bookmark list with ARQ background processing (Option B).

    - Validates list exists (404 if not found)
    - Extracts YouTube video ID from URL
    - Creates video with pending status
    - Queues ARQ background task for metadata fetching
    - Checks for duplicates (409 if already in list)

    This approach is production-ready for large batches and prevents request timeouts.

    Args:
        list_id: UUID of the bookmark list
        video_data: Video data with YouTube URL
        db: Database session

    Returns:
        VideoResponse: Created video with pending status

    Raises:
        HTTPException 404: List not found
        HTTPException 409: Video already in list
        HTTPException 422: Invalid YouTube URL
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Extract YouTube ID
    try:
        youtube_id = extract_youtube_id(video_data.url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

    # HYBRID APPROACH: Fetch metadata SYNCHRONOUSLY for single videos (fast!)
    # For bulk uploads, we'll use ARQ workers instead
    redis = await get_redis_client()
    youtube_client = YouTubeClient(
        api_key=settings.youtube_api_key,
        redis_client=redis
    )

    try:
        # Fetch YouTube metadata immediately (200-500ms)
        metadata = await youtube_client.get_video_metadata(youtube_id)

        # Parse duration and timestamp using helper functions
        duration_seconds = parse_youtube_duration(metadata.get("duration"))
        published_at = parse_youtube_timestamp(metadata.get("published_at"))

        # YouTube Channels Feature: Create or get channel for this video
        channel_db_id = None
        youtube_channel_id = metadata.get("channel_id")
        channel_name = metadata.get("channel")
        if youtube_channel_id and channel_name:
            # Fetch channel info (thumbnail + description, cached for 30 days)
            channel_info = await youtube_client.get_channel_info(youtube_channel_id)

            channel = await get_or_create_channel(
                db=db,
                user_id=bookmark_list.user_id,
                youtube_channel_id=youtube_channel_id,
                channel_name=channel_name,
                channel_thumbnail=channel_info.get("thumbnail_url"),
                channel_description=channel_info.get("description")
            )
            channel_db_id = channel.id

        # Create video with COMPLETE metadata (instant!)
        new_video = Video(
            list_id=list_id,
            youtube_id=youtube_id,
            title=metadata.get("title"),
            channel=metadata.get("channel"),
            channel_id=channel_db_id,  # Link to Channel record
            thumbnail_url=metadata.get("thumbnail_url"),
            duration=duration_seconds,
            published_at=published_at,
            processing_status="completed",  # Already have all data!
            # Two-phase import: metadata stage complete, ready for enrichment
            import_stage="metadata",
            import_progress=25
        )

    except (HTTPError, TimeoutException, ValueError, KeyError, OSError) as e:
        # HTTPError: YouTube API returned error (404, 403, etc.)
        # TimeoutException: Request timeout
        # ValueError: Invalid video ID or response format
        # KeyError: Missing expected fields in API response
        # OSError: Network connectivity issues
        # Fallback: Create with pending status if YouTube API fails (allows retry via background worker)
        logger.warning(f"Failed to fetch YouTube metadata for {youtube_id}: {e}")
        new_video = Video(
            list_id=list_id,
            youtube_id=youtube_id,
            # Two-phase import: Set thumbnail immediately from YouTube ID pattern
            thumbnail_url=f"https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg",
            processing_status="pending",
            error_message=f"Could not fetch video metadata: {str(e)}",
            # Initial import state
            import_stage="created",
            import_progress=0
        )

    # Save to database
    try:
        db.add(new_video)
        await db.flush()
        await db.refresh(new_video)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Video already exists in this list"
        )

    # Trigger enrichment if video was successfully created with metadata
    if new_video.processing_status == "completed":
        await _enqueue_enrichment(new_video.id, db)
        await db.commit()  # Commit enrichment record

    # Set tags to empty list to avoid async relationship loading issues
    # (newly created video has no tags assigned yet)
    new_video.__dict__['tags'] = []

    # Set field_values to empty list (no tags → no applicable fields)
    new_video.__dict__['field_values'] = []

    return new_video


@router.get("/lists/{list_id}/videos", response_model=List[VideoResponse])
async def get_videos_in_list(
    list_id: UUID,
    tags: Annotated[Optional[List[str]], Query(max_length=10)] = None,
    sort_by: Optional[str] = Query(None, description="Sort column: 'title', 'duration', 'created_at', 'channel', or 'field:<field_id>'"),
    sort_order: Optional[Literal["asc", "desc"]] = Query("asc", description="Sort direction"),
    db: AsyncSession = Depends(get_db)
) -> List[Video]:
    """
    Get all videos in a bookmark list with optional tag filtering and sorting.

    Args:
        list_id: UUID of the bookmark list
        tags: Optional list of tag names for OR filtering (case-insensitive)
        sort_by: Sort column (standard column or 'field:<field_id>')
        sort_order: Sort direction ('asc' or 'desc')
        db: Database session

    Returns:
        List[VideoResponse]: List of videos in the bookmark list

    Raises:
        HTTPException 404: List not found or custom field not found
        HTTPException 400: Invalid sort_by parameter

    Examples:
        - /api/lists/{id}/videos - All videos in list (default: created_at DESC)
        - /api/lists/{id}/videos?tags=Python&tags=Tutorial - Videos with Python OR Tutorial tags
        - /api/lists/{id}/videos?sort_by=title&sort_order=asc - Videos sorted by title A-Z
        - /api/lists/{id}/videos?sort_by=field:uuid-rating-field&sort_order=desc - Videos sorted by rating field
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Build query for videos in list
    stmt = select(Video).where(Video.list_id == list_id)

    # Apply tag filtering (OR logic) - case-insensitive exact match
    if tags and len(tags) > 0:
        # Normalize tag names: strip whitespace and lowercase
        normalized_tags = [tag.strip().lower() for tag in tags if tag and tag.strip()]

        if normalized_tags:
            # Join to tags and filter by exact case-insensitive match using func.lower
            # This is more robust than ILIKE (no wildcard interpretation) and index-friendly
            stmt = (
                stmt.join(Video.tags)
                .where(func.lower(Tag.name).in_(normalized_tags))
                .distinct()  # DISTINCT must come before ORDER BY for PostgreSQL
            )

    # Apply sorting
    stmt = await _apply_sorting(stmt, sort_by, sort_order, db)

    # Execute query
    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

    if not videos:
        return []

    # Load all tags for all videos in two queries (prevents N+1)
    # First, get video-tag associations
    video_ids = [video.id for video in videos]
    associations_stmt = select(video_tags).where(video_tags.c.video_id.in_(video_ids))
    associations_result = await db.execute(associations_stmt)
    associations = associations_result.all()

    # Get all unique tag IDs
    tag_ids = list(set(assoc.tag_id for assoc in associations))

    # Load all tags with schema relationship eagerly loaded
    if tag_ids:
        tags_stmt = (
            select(Tag)
            .options(selectinload(Tag.schema))  # Eager load schema for FieldSchema relationship
            .where(Tag.id.in_(tag_ids))
        )
        tags_result = await db.execute(tags_stmt)
        tags_by_id = {tag.id: tag for tag in tags_result.scalars().all()}
    else:
        tags_by_id = {}

    # Group tags by video_id
    tags_by_video: dict = {}
    for assoc in associations:
        video_id = assoc.video_id
        tag_id = assoc.tag_id
        if video_id not in tags_by_video:
            tags_by_video[video_id] = []
        if tag_id in tags_by_id:
            tags_by_video[video_id].append(tags_by_id[tag_id])

    # Assign tags to videos
    for video in videos:
        video.__dict__['tags'] = tags_by_video.get(video.id, [])

    # Load parent list once (for Two-Layer Field System: workspace fields from list.default_schema_id)
    # All videos in this endpoint share the same list_id
    parent_list_stmt = select(BookmarkList).where(BookmarkList.id == list_id)
    parent_list_result = await db.execute(parent_list_stmt)
    parent_list = parent_list_result.scalar_one_or_none()

    # Assign list to all videos
    for video in videos:
        video.__dict__['list'] = parent_list

    # === NEW: Batch-load applicable fields for ALL videos ===
    # ✅ REF #1: Single query for all videos
    applicable_fields_by_video = await get_available_fields_for_videos(videos, db)

    # === NEW: Batch load field values ===
    if video_ids:
        # Fetch all field values for all videos in one query
        field_values_stmt = (
            select(VideoFieldValue)
            .options(
                selectinload(VideoFieldValue.field)  # Eager load CustomField
            )
            .where(VideoFieldValue.video_id.in_(video_ids))
        )
        field_values_result = await db.execute(field_values_stmt)
        all_field_values = field_values_result.scalars().all()

        # Group field values by video_id
        field_values_by_video: Dict[UUID, List[VideoFieldValue]] = {}
        for fv in all_field_values:
            if fv.video_id not in field_values_by_video:
                field_values_by_video[fv.video_id] = []
            field_values_by_video[fv.video_id].append(fv)

        # Build field_values response for each video
        for video in videos:
            # Get applicable fields (from batch-loaded data)
            applicable_fields = applicable_fields_by_video.get(video.id, [])

            # Get actual field values for this video
            video_field_values = field_values_by_video.get(video.id, [])
            values_by_field_id = {fv.field_id: fv for fv in video_field_values}

            # Build response list: applicable fields + their values (if set)
            # FIX BUG #003: Only include fields that have actual values (same as detail endpoint)
            # - available_fields shows ALL fields that CAN be filled
            # - field_values shows ONLY fields that HAVE been filled
            field_values_response = []
            for field, schema_name, display_order, show_on_card in applicable_fields:
                field_value = values_by_field_id.get(field.id)

                # Only include fields that have values (not None)
                if field_value:
                    # ✅ REF #3: Extract value based on field type (float not int)
                    value = None
                    if field.field_type == 'rating':
                        value = field_value.value_numeric  # Can be float
                    elif field.field_type in ('select', 'text'):
                        value = field_value.value_text
                    elif field.field_type == 'boolean':
                        value = field_value.value_boolean

                    # Create response dict (Pydantic will serialize)
                    field_values_response.append({
                        'id': field_value.id,  # No longer needs conditional - field_value is guaranteed to exist
                        'video_id': video.id,
                        'field_id': field.id,
                        'field_name': field.name,
                        'field': field,  # CustomField ORM object
                        'value': value,
                        'schema_name': schema_name,
                        'show_on_card': show_on_card,
                        'display_order': display_order,
                        'updated_at': field_value.updated_at  # No longer needs conditional
                    })

            # Assign to video (FastAPI will serialize via VideoResponse schema)
            video.__dict__['field_values'] = field_values_response
    else:
        # No videos → no field values needed
        for video in videos:
            video.__dict__['field_values'] = []

    # Load channel thumbnails for all videos
    await _load_channel_thumbnails(videos, db)

    return list(videos)


@router.post("/lists/{list_id}/videos/filter", response_model=list[VideoResponse])
async def filter_videos_in_list(
    list_id: UUID,
    filter_request: VideoFilterRequest,
    db: AsyncSession = Depends(get_db)
) -> list[Video]:
    """
    Filter videos in a bookmark list by tags and/or custom field values.

    Filtering Logic:
    - Tags: OR logic (video matches ANY selected tag)
    - Field filters: AND logic (video matches ALL field filters)
    - Tags + Field filters: Combined with AND

    Examples:
        POST /api/lists/{id}/videos/filter
        Body: {"tags": ["Python"], "field_filters": [{"field_id": "...", "operator": "gte", "value": 4}]}
        -> Videos with tag "Python" AND rating >= 4

        Body: {"field_filters": [{"field_id": "...", "operator": "contains", "value": "tutorial"}]}
        -> Videos where field contains "tutorial"

        Body: {"tags": ["Python", "JavaScript"]}
        -> Videos with Python OR JavaScript tags

    Args:
        list_id: UUID of the bookmark list
        filter_request: Filter criteria (tags and/or field filters)
        db: Database session

    Returns:
        List[VideoResponse]: Filtered videos

    Raises:
        HTTPException 404: List not found
    """
    # Step 1: Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Step 2: Build base query
    stmt = select(Video).where(Video.list_id == list_id).order_by(Video.created_at)

    # Step 3: Apply tag filtering (OR logic) - case-insensitive exact match
    if filter_request.tags and len(filter_request.tags) > 0:
        # Normalize tag names: strip whitespace and lowercase
        normalized_tags = [tag.strip().lower() for tag in filter_request.tags if tag and tag.strip()]

        if normalized_tags:
            # Join to tags and filter by exact case-insensitive match using func.lower
            stmt = (
                stmt.join(Video.tags)
                .where(func.lower(Tag.name).in_(normalized_tags))
                .distinct()
            )

    # Step 3.5: Apply channel filtering (YouTube Channels feature)
    if filter_request.channel_id:
        try:
            channel_uuid = UUID(filter_request.channel_id)
            stmt = stmt.where(Video.channel_id == channel_uuid)
        except ValueError as err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid channel_id format: {filter_request.channel_id}"
            ) from err

    # Step 4: Apply field filtering (AND logic)
    if filter_request.field_filters and len(filter_request.field_filters) > 0:
        # IMPORTANT: Use aliased() for multiple field filters to avoid JOIN conflicts
        for field_filter in filter_request.field_filters:
            # Create unique alias for this field filter
            vfv_alias = aliased(VideoFieldValue)

            # Join to video_field_values with field_id constraint
            stmt = stmt.join(
                vfv_alias,
                and_(
                    vfv_alias.video_id == Video.id,
                    vfv_alias.field_id == field_filter.field_id
                )
            )

            # Apply operator-specific filtering
            operator = field_filter.operator

            if operator == FieldFilterOperator.EQ:
                # Equal to (numeric)
                stmt = stmt.where(vfv_alias.value_numeric == field_filter.value)

            elif operator == FieldFilterOperator.GT:
                # Greater than (numeric)
                stmt = stmt.where(vfv_alias.value_numeric > field_filter.value)

            elif operator == FieldFilterOperator.GTE:
                # Greater than or equal (numeric)
                stmt = stmt.where(vfv_alias.value_numeric >= field_filter.value)

            elif operator == FieldFilterOperator.LT:
                # Less than (numeric)
                stmt = stmt.where(vfv_alias.value_numeric < field_filter.value)

            elif operator == FieldFilterOperator.LTE:
                # Less than or equal (numeric)
                stmt = stmt.where(vfv_alias.value_numeric <= field_filter.value)

            elif operator == FieldFilterOperator.BETWEEN:
                # Between min and max (numeric)
                stmt = stmt.where(
                    and_(
                        vfv_alias.value_numeric >= field_filter.value_min,
                        vfv_alias.value_numeric <= field_filter.value_max
                    )
                )

            elif operator == FieldFilterOperator.CONTAINS:
                # Text contains (case-insensitive) - Uses GIN index!
                # Escape special ILIKE characters (%, _, \) to prevent SQL injection
                escaped_value = (
                    str(field_filter.value)
                    .replace('\\', '\\\\')
                    .replace('%', '\\%')
                    .replace('_', '\\_')
                )
                stmt = stmt.where(vfv_alias.value_text.ilike(f"%{escaped_value}%"))

            elif operator == FieldFilterOperator.EXACT:
                # Exact match (case-sensitive)
                stmt = stmt.where(vfv_alias.value_text == field_filter.value)

            elif operator == FieldFilterOperator.IN:
                # One of (comma-separated values)
                # Validate value is string before calling split()
                if not isinstance(field_filter.value, str):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="IN operator requires comma-separated string value"
                    )
                # Parse comma-separated string into list
                values = [v.strip() for v in field_filter.value.split(',') if v.strip()]
                stmt = stmt.where(vfv_alias.value_text.in_(values))

            elif operator == FieldFilterOperator.IS:
                # Boolean is True/False
                stmt = stmt.where(vfv_alias.value_boolean == field_filter.value)

        # Use distinct() to prevent duplicates from multiple JOINs
        stmt = stmt.distinct()

    # Step 5: Apply sorting
    stmt = await _apply_sorting(
        stmt,
        filter_request.sort_by,
        filter_request.sort_order or "asc",
        db
    )

    # Step 6: Execute query
    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

    if not videos:
        return []

    # Step 7: Load tags for all videos (prevent N+1)
    video_ids = [video.id for video in videos]

    # First, get video-tag associations
    associations_stmt = select(video_tags).where(video_tags.c.video_id.in_(video_ids))
    associations_result = await db.execute(associations_stmt)
    associations = associations_result.all()

    # Get all unique tag IDs
    tag_ids = list(set(assoc.tag_id for assoc in associations))

    # Load all tags with schema relationship eagerly loaded
    if tag_ids:
        tags_stmt = (
            select(Tag)
            .options(selectinload(Tag.schema))
            .where(Tag.id.in_(tag_ids))
        )
        tags_result = await db.execute(tags_stmt)
        tags_by_id = {tag.id: tag for tag in tags_result.scalars().all()}
    else:
        tags_by_id = {}

    # Group tags by video_id
    tags_by_video: dict = {}
    for assoc in associations:
        video_id = assoc.video_id
        tag_id = assoc.tag_id
        if video_id not in tags_by_video:
            tags_by_video[video_id] = []
        if tag_id in tags_by_id:
            tags_by_video[video_id].append(tags_by_id[tag_id])

    # Assign tags to videos
    for video in videos:
        video.__dict__['tags'] = tags_by_video.get(video.id, [])

    # Step 8: Batch-load applicable fields for ALL videos
    applicable_fields_by_video = await get_available_fields_for_videos(videos, db)

    # Step 9: Batch load field values
    if video_ids:
        # Fetch all field values for all videos in one query
        field_values_stmt = (
            select(VideoFieldValue)
            .options(
                selectinload(VideoFieldValue.field)  # Eager load CustomField
            )
            .where(VideoFieldValue.video_id.in_(video_ids))
        )
        field_values_result = await db.execute(field_values_stmt)
        all_field_values = field_values_result.scalars().all()

        # Group field values by video_id
        field_values_by_video: Dict[UUID, List[VideoFieldValue]] = {}
        for fv in all_field_values:
            if fv.video_id not in field_values_by_video:
                field_values_by_video[fv.video_id] = []
            field_values_by_video[fv.video_id].append(fv)

        # Build field_values response for each video
        for video in videos:
            # Get applicable fields (from batch-loaded data)
            applicable_fields = applicable_fields_by_video.get(video.id, [])

            # Get actual field values for this video
            video_field_values = field_values_by_video.get(video.id, [])
            values_by_field_id = {fv.field_id: fv for fv in video_field_values}

            # Build response list: ONLY fields that have values set
            # FIX BUG #003: Only include fields that have actual values (not None)
            # available_fields shows what CAN be filled, field_values shows what HAS been filled
            field_values_response = []
            for field, schema_name, display_order, show_on_card in applicable_fields:
                field_value = values_by_field_id.get(field.id)

                # FIX BUG #003: Only append if field_value exists
                if field_value:
                    # Extract value based on field type
                    value = None
                    if field.field_type == 'rating':
                        value = field_value.value_numeric  # Can be float
                    elif field.field_type in ('select', 'text'):
                        value = field_value.value_text
                    elif field.field_type == 'boolean':
                        value = field_value.value_boolean

                    # Create response dict (Pydantic will serialize)
                    field_values_response.append({
                        'id': field_value.id,  # Always valid UUID
                        'video_id': video.id,
                        'field_id': field.id,
                        'field_name': field.name,
                        'field': field,  # CustomField ORM object
                        'value': value,
                        'schema_name': schema_name,
                        'show_on_card': show_on_card,
                        'display_order': display_order,
                        'updated_at': field_value.updated_at  # Always valid datetime
                    })

            # Assign to video (FastAPI will serialize via VideoResponse schema)
            video.__dict__['field_values'] = field_values_response
    else:
        # No videos -> no field values needed
        for video in videos:
            video.__dict__['field_values'] = []

    # Load channel thumbnails for all videos
    await _load_channel_thumbnails(videos, db)

    return list(videos)


@router.get("/videos/{video_id}", response_model=VideoResponse)
async def get_video_by_id(
    video_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> Video:
    """
    Get single video with complete field information (detail view).

    Returns:
    - field_values: ALL available fields with their current values (null if unfilled)
    - available_fields: Field metadata for all editable fields (name, type, config)

    Note: field_values includes ALL applicable fields (from video's tags),
    with value=None for fields that haven't been filled yet. This allows
    the frontend to render all editable fields in the detail modal.

    Use Case: Modal/Detail view where user can see and edit all fields.
    """
    # Step 1: Load video (field_values and tags loaded separately below)
    stmt = select(Video).where(Video.id == video_id)
    result = await db.execute(stmt)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    # Step 2A: Load field_values manually (workaround for SQLAlchemy relationship loading issue)
    # BUG #004 FIX: SQLAlchemy sometimes returns a single VideoFieldValue object instead of a list
    # Loading field_values explicitly with eager loading ensures we always get a proper list
    from app.models.video_field_value import VideoFieldValue
    from app.models.custom_field import CustomField
    field_values_stmt = (
        select(VideoFieldValue)
        .where(VideoFieldValue.video_id == video_id)
        .options(selectinload(VideoFieldValue.field))
    )
    field_values_result = await db.execute(field_values_stmt)
    field_values_list = list(field_values_result.scalars().all())
    video.__dict__['field_values'] = field_values_list

    # Step 2B: Load tags manually (workaround for SQLAlchemy many-to-many loading issue)
    # SQLAlchemy sometimes returns a single Tag object instead of a list for many-to-many relationships
    # Loading tags explicitly ensures we always get a proper list
    from app.models.tag import Tag, video_tags as video_tags_table
    tags_stmt = (
        select(Tag)
        .join(video_tags_table, Tag.id == video_tags_table.c.tag_id)
        .where(video_tags_table.c.video_id == video_id)
    )
    tags_result = await db.execute(tags_stmt)
    tags_list = list(tags_result.scalars().all())
    video.__dict__['tags'] = tags_list

    # Step 2C: Load parent list (for Two-Layer Field System: workspace fields from list.default_schema_id)
    list_stmt = select(BookmarkList).where(BookmarkList.id == video.list_id)
    list_result = await db.execute(list_stmt)
    parent_list = list_result.scalar_one_or_none()
    video.__dict__['list'] = parent_list

    # Step 3: Get available fields using helper module
    available_fields_tuples = await get_available_fields_for_video(video, db)

    # Step 4: Convert tuples to AvailableFieldResponse objects
    available_fields = [
        AvailableFieldResponse(
            field_id=field.id,
            field_name=schema_name + ": " + field.name if schema_name else field.name,
            field_type=field.field_type,
            schema_name=schema_name,
            display_order=display_order,
            show_on_card=show_on_card,
            config=field.config or {}
        )
        for field, schema_name, display_order, show_on_card in available_fields_tuples
    ]

    # Step 5: Build field_values response (similar to list endpoint logic)
    # FIX BUG #003: Only include fields that have actual values
    # - available_fields shows ALL fields that CAN be filled
    # - field_values shows ONLY fields that HAVE been filled
    # Note: field_values_list already loaded in Step 2A above
    values_by_field_id = {fv.field_id: fv for fv in field_values_list}

    field_values_response = []
    for field, schema_name, display_order, show_on_card in available_fields_tuples:
        field_value = values_by_field_id.get(field.id)

        # Only include fields that have values (not None)
        if field_value:
            # Extract value based on field type
            value = None
            if field.field_type == 'rating':
                value = field_value.value_numeric
            elif field.field_type in ('select', 'text'):
                value = field_value.value_text
            elif field.field_type == 'boolean':
                value = field_value.value_boolean

            field_values_response.append({
                'id': field_value.id,  # No longer needs conditional - field_value is guaranteed to exist
                'video_id': video.id,
                'field_id': field.id,
                'field_name': field.name,
                'field': field,
                'value': value,
                'schema_name': schema_name,
                'show_on_card': show_on_card,
                'display_order': display_order,
                'updated_at': field_value.updated_at  # No longer needs conditional
            })

    # Step 6: Manually construct response dict (workaround for Pydantic ORM serialization)
    # Returning the Video ORM object directly causes ResponseValidationError during serialization
    # Constructing a dict manually with properly serialized tags avoids this issue
    tags_dicts = [
        {
            'id': tag.id,
            'name': tag.name,
            'color': tag.color,
            'user_id': tag.user_id,
            'schema_id': tag.schema_id,
            'created_at': tag.created_at,
            'updated_at': tag.updated_at
        }
        for tag in tags_list
    ]

    # Load channel thumbnail for this video
    channel_thumbnail_url = None
    if video.channel_id:
        channel_stmt = select(Channel).where(Channel.id == video.channel_id)
        channel_result = await db.execute(channel_stmt)
        channel = channel_result.scalar_one_or_none()
        if channel:
            channel_thumbnail_url = channel.thumbnail_url
    elif video.channel:
        # Fallback: try to find channel by name
        channel_stmt = select(Channel).where(Channel.name == video.channel)
        channel_result = await db.execute(channel_stmt)
        channel = channel_result.scalar_one_or_none()
        if channel:
            channel_thumbnail_url = channel.thumbnail_url

    return {
        'id': video.id,
        'list_id': video.list_id,
        'youtube_id': video.youtube_id,
        'title': video.title,
        'channel': video.channel,
        'channel_thumbnail_url': channel_thumbnail_url,
        'duration': video.duration,
        'published_at': video.published_at,
        'thumbnail_url': video.thumbnail_url,
        'extracted_data': video.extracted_data,
        'processing_status': video.processing_status,
        'error_message': video.error_message,
        'created_at': video.created_at,
        'updated_at': video.updated_at,
        'watch_position': video.watch_position,
        'watch_position_updated_at': video.watch_position_updated_at,
        'tags': tags_dicts,
        'available_fields': available_fields,
        'field_values': field_values_response
    }


@router.patch("/videos/{video_id}/progress", response_model=UpdateWatchProgressResponse)
async def update_watch_progress(
    video_id: UUID,
    request: UpdateWatchProgressRequest,
    db: AsyncSession = Depends(get_db)
) -> UpdateWatchProgressResponse:
    """
    Update watch progress for a video (video player integration).

    Saves the current playback position so users can resume watching later.
    Called periodically (debounced) by the video player and on pause.

    Args:
        video_id: UUID of the video
        request: UpdateWatchProgressRequest with position in seconds
        db: Database session

    Returns:
        UpdateWatchProgressResponse with video_id, watch_position, updated_at

    Raises:
        HTTPException 404: Video not found
    """
    # Fetch video
    result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id {video_id} not found"
        )

    # Update watch position
    video.watch_position = request.position
    video.watch_position_updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(video)

    return UpdateWatchProgressResponse(
        video_id=video.id,
        watch_position=video.watch_position,
        updated_at=video.watch_position_updated_at
    )


@router.get("/videos", response_model=List[VideoResponse])
async def list_all_videos(
    tags: Annotated[Optional[List[str]], Query(max_length=10)] = None,
    tags_all: Annotated[Optional[List[str]], Query(max_length=10)] = None,
    db: AsyncSession = Depends(get_db)
) -> List[Video]:
    """
    List all videos with optional tag filtering.

    Query params:
    - tags: OR filter (any matching tag) - can be specified multiple times
    - tags_all: AND filter (all tags required) - can be specified multiple times

    Examples:
    - /api/videos - All videos
    - /api/videos?tags=Python&tags=Tutorial - Videos with Python OR Tutorial tags
    - /api/videos?tags_all=Python&tags_all=Advanced - Videos with BOTH Python AND Advanced tags
    """
    stmt = select(Video).order_by(Video.created_at)

    # Filter by tags (OR logic) - case-insensitive
    if tags and len(tags) > 0:
        # Join to tags and filter by tag names using case-insensitive ILIKE
        # or_() creates OR conditions for each tag
        stmt = (
            stmt.join(Video.tags)
            .where(or_(*[Tag.name.ilike(tag) for tag in tags]))
            .distinct()
        )

    # Filter by tags (AND logic) - case-insensitive
    if tags_all and len(tags_all) > 0:
        # Subquery: videos that have ALL specified tags (case-insensitive)
        # Count distinct tag matches - only include videos with count == number of requested tags
        subquery = (
            select(video_tags.c.video_id)
            .select_from(video_tags)
            .join(Tag, video_tags.c.tag_id == Tag.id)
            .where(or_(*[Tag.name.ilike(tag) for tag in tags_all]))
            .group_by(video_tags.c.video_id)
            .having(func.count(func.distinct(video_tags.c.tag_id)) == len(tags_all))
        )

        stmt = stmt.where(Video.id.in_(subquery))

    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

    if not videos:
        return []

    # Load all tags for all videos in a single batch query (prevents N+1)
    # Use a join query to fetch all tags at once
    video_ids = [video.id for video in videos]
    tags_stmt = (
        select(video_tags.c.video_id, Tag)
        .join(Tag, video_tags.c.tag_id == Tag.id)
        .options(selectinload(Tag.schema))  # Eager load schema to prevent lazy='raise' error
        .where(video_tags.c.video_id.in_(video_ids))
    )
    tags_result = await db.execute(tags_stmt)

    # Group tags by video_id
    tags_by_video: dict = {}
    for video_id, tag in tags_result:
        if video_id not in tags_by_video:
            tags_by_video[video_id] = []
        tags_by_video[video_id].append(tag)

    # Assign tags to videos
    for video in videos:
        video.__dict__['tags'] = tags_by_video.get(video.id, [])

    # Assign empty field_values to all videos (this endpoint doesn't support field filtering)
    # This prevents MissingGreenlet error when VideoResponse tries to access field_values
    for video in videos:
        video.__dict__['field_values'] = []

    # Load channel thumbnails for all videos
    await _load_channel_thumbnails(videos, db)

    return list(videos)


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    Delete a video from a bookmark list.

    Also auto-deletes the channel if this was the last video in that channel
    (YouTube Channels feature - Step 6.7).

    Args:
        video_id: UUID of the video to delete
        db: Database session

    Raises:
        HTTPException 404: Video not found
    """
    from app.models.channel import Channel

    # Get video
    result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id {video_id} not found"
        )

    # Store channel_id before deletion for cleanup check
    channel_id = video.channel_id

    # Delete video
    await db.delete(video)
    await db.commit()  # CRITICAL FIX: Commit to persist deletion

    # YouTube Channels feature - Step 6.7: Auto-delete empty channels
    # If video had a channel, check if it was the last video
    if channel_id:
        # Count remaining videos for this channel
        count_result = await db.execute(
            select(func.count(Video.id)).where(Video.channel_id == channel_id)
        )
        remaining_count = count_result.scalar() or 0

        if remaining_count == 0:
            # Delete the empty channel
            channel_result = await db.execute(
                select(Channel).where(Channel.id == channel_id)
            )
            channel = channel_result.scalar_one_or_none()
            if channel:
                await db.delete(channel)
                await db.commit()
                logger.info(f"Auto-deleted empty channel {channel_id}")

    return None


async def _process_field_values(
    db: AsyncSession,
    created_videos: list[Video],
    csv_rows_map: dict[str, dict],
    field_columns: dict,
    failures: list[BulkUploadFailure]
) -> None:
    """
    Process and apply field values from CSV rows to created videos.

    This helper function parses field values from CSV rows, validates them,
    and applies them using the batch update helper function.

    Args:
        db: Database session
        created_videos: List of successfully created Video objects
        csv_rows_map: Dict mapping youtube_id -> raw CSV row dictionary
        field_columns: Dict mapping column_name -> CustomField
        failures: List to append failures to (modified in-place)
    """
    from app.schemas.video_field_value import FieldValueUpdate

    # Process field values for each video
    for video in created_videos:
        # Get CSV row for this video by youtube_id
        row_data = csv_rows_map.get(video.youtube_id)
        if not row_data:
            continue
        field_updates = []

        for column_name, field_data in field_columns.items():
            raw_value = row_data.get(column_name, '').strip()

            # Skip empty values (not an error, just unset)
            if not raw_value:
                continue

            # Parse value based on field type
            try:
                field_type = field_data['field_type']
                field_config = field_data['config']
                field_id = field_data['id']
                field_name = field_data['name']

                if field_type == 'rating':
                    # Parse as float to support decimal ratings
                    parsed_value = float(raw_value)
                    validate_field_value(parsed_value, field_type, field_config)
                    field_updates.append(FieldValueUpdate(field_id=field_id, value=parsed_value))

                elif field_type == 'select':
                    # Validate against options list (case-sensitive in validation)
                    validate_field_value(raw_value, field_type, field_config)
                    field_updates.append(FieldValueUpdate(field_id=field_id, value=raw_value))

                elif field_type == 'text':
                    # Validate max_length if configured
                    validate_field_value(raw_value, field_type, field_config)
                    field_updates.append(FieldValueUpdate(field_id=field_id, value=raw_value))

                elif field_type == 'boolean':
                    # Parse "true"/"false"/"1"/"0" (case-insensitive)
                    lower_value = raw_value.lower()
                    if lower_value in ('true', '1', 'yes'):
                        parsed_value = True
                    elif lower_value in ('false', '0', 'no', ''):
                        parsed_value = False
                    else:
                        raise ValueError(f"Invalid boolean value: '{raw_value}'. Use 'true'/'false' or '1'/'0'.")
                    field_updates.append(FieldValueUpdate(field_id=field_id, value=parsed_value))

            except (ValueError, FieldValidationError) as e:
                # Log validation error but continue processing
                logger.warning(f"Field validation error for video {video.youtube_id}, field '{field_name}': {e}")

        # Apply field updates via batch update helper
        if field_updates:
            try:
                # Create batch update request
                update_request = BatchUpdateFieldValuesRequest(field_values=field_updates)

                # Call batch update logic directly (avoid HTTP overhead)
                await _apply_field_values_batch(db, video.id, update_request)

                logger.info(f"Applied {len(field_updates)} field values for video {video.youtube_id}")

            except (ValueError, KeyError, FieldValidationError, SQLAlchemyError) as e:
                # ValueError: Invalid data/parsing errors
                # KeyError: Missing keys in data structures
                # FieldValidationError: Field validation errors
                # SQLAlchemyError: Database errors (includes IntegrityError)

                # Log error with stack trace but don't fail video creation
                logger.exception(f"Failed to apply field values for video {video.youtube_id}")
                failures.append(BulkUploadFailure(
                    row=0,  # Row number not easily tracked here
                    url=f"https://youtube.com/watch?v={video.youtube_id}",
                    error=f"Video created, but field values failed: {str(e)}"
                ))


async def _apply_field_values_batch(
    db: AsyncSession,
    video_id: UUID,
    request: BatchUpdateFieldValuesRequest
) -> None:
    """
    Apply batch field value updates to a video (helper for CSV import).

    This is the core logic from Task #72's PUT /api/videos/{id}/fields endpoint,
    extracted for reuse in CSV import flow.

    Args:
        db: Database session
        video_id: UUID of video to update
        request: Batch update request with field_id/value pairs

    Raises:
        HTTPException: If validation fails (404, 400, 422)
    """
    # Step 1: Fetch all CustomFields for validation
    field_ids = [update.field_id for update in request.field_values]

    fields_stmt = select(CustomField).where(CustomField.id.in_(field_ids))
    fields_result = await db.execute(fields_stmt)
    fields = {field.id: field for field in fields_result.scalars().all()}

    # Validate all field_ids exist
    invalid_field_ids = [fid for fid in field_ids if fid not in fields]
    if invalid_field_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field_id(s): {invalid_field_ids}"
        )

    # Step 2: Validate values against field types
    for update in request.field_values:
        field = fields[update.field_id]
        validate_field_value(update.value, field.field_type, field.config)

    # Step 3: Prepare upsert data
    upsert_data = []
    for update in request.field_values:
        field = fields[update.field_id]

        value_text = None
        value_numeric = None
        value_boolean = None

        if field.field_type == 'rating':
            value_numeric = update.value
        elif field.field_type in ('select', 'text'):
            value_text = update.value
        elif field.field_type == 'boolean':
            value_boolean = update.value

        upsert_data.append({
            'video_id': video_id,
            'field_id': update.field_id,
            'value_text': value_text,
            'value_numeric': value_numeric,
            'value_boolean': value_boolean
        })

    # Step 4: Execute PostgreSQL UPSERT
    stmt = pg_insert(VideoFieldValue).values(upsert_data)
    stmt = stmt.on_conflict_do_update(
        constraint='uq_video_field_values_video_field',
        set_={
            'value_text': stmt.excluded.value_text,
            'value_numeric': stmt.excluded.value_numeric,
            'value_boolean': stmt.excluded.value_boolean,
            'updated_at': func.now()
        }
    )

    await db.execute(stmt)
    # Note: No commit here - caller handles transaction


@router.post(
    "/lists/{list_id}/videos/bulk",
    response_model=BulkUploadResponse,
    status_code=status.HTTP_201_CREATED
)
async def bulk_upload_videos(
    list_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
) -> BulkUploadResponse:
    """
    Bulk upload videos from CSV file with optional custom field values.

    **CSV Format (Extended):**
    ```
    url,field_Overall_Rating,field_Presentation
    https://youtube.com/watch?v=dQw4w9WgXcQ,5,great
    https://youtu.be/jNQXAC9IVRw,3,good
    ```

    **Field Columns:**
    - Format: `field_<field_name>` (case-insensitive matching)
    - Values validated per field type (rating: int, select: option, text: max_length, boolean: true/false)
    - Invalid field values logged as warnings, video still created
    - Field updates applied via batch update endpoint (Task #72)

    **Validation:**
    - URL column required (422 if missing)
    - Field columns optional (videos created even if field validation fails)
    - Row-level error handling: Continue processing on field errors

    Args:
        list_id: UUID of the bookmark list
        file: CSV file with YouTube URLs and optional field columns
        db: Database session

    Returns:
        BulkUploadResponse: Statistics with created_count, failed_count, failures list

    Raises:
        HTTPException 404: List not found
        HTTPException 422: Invalid CSV header or file format
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Read and parse CSV
    try:
        content = await file.read()
        csv_string = content.decode('utf-8')

        # Skip comment lines (starting with #) for import compatibility with exported CSVs
        csv_lines = [line for line in csv_string.split('\n') if not line.startswith('#')]
        clean_csv_string = '\n'.join(csv_lines)

        csv_file = io.StringIO(clean_csv_string)
        reader = csv.DictReader(csv_file)

        # Validate header
        if reader.fieldnames is None or 'url' not in reader.fieldnames:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CSV must have 'url' header column"
            )

        # === NEW: Detect field columns in CSV header ===
        # Step 1: Get all custom fields for this list
        fields_stmt = select(CustomField).where(CustomField.list_id == list_id)
        fields_result = await db.execute(fields_stmt)
        all_fields = {field.name.lower(): field for field in fields_result.scalars().all()}

        # Step 2: Detect field columns in CSV header
        field_columns = {}  # column_name -> dict with field data
        for column_name in reader.fieldnames:
            if column_name.lower().startswith('field_'):
                # Extract field name (remove "field_" prefix)
                field_name = column_name[6:].strip().lower()  # "field_Overall_Rating" -> "overall_rating"

                # Try to match to existing field (case-insensitive)
                if field_name in all_fields:
                    field_obj = all_fields[field_name]
                    # Cache field attributes to avoid detached object issues after commit
                    field_columns[column_name] = {
                        'id': field_obj.id,
                        'name': field_obj.name,
                        'field_type': field_obj.field_type,
                        'config': field_obj.config
                    }
                    logger.info(f"Detected field column: {column_name} -> {field_obj.name}")
                else:
                    logger.warning(f"Unknown field column '{column_name}' (no matching custom field), will be ignored")

        videos_to_create = []
        csv_rows_map = {}  # Store raw CSV rows by youtube_id for field value processing
        failures = []
        row_num = 1  # Start at 1 (header is row 0)

        for row in reader:
            row_num += 1
            url = row.get('url', '').strip()

            if not url:
                failures.append(BulkUploadFailure(
                    row=row_num,
                    url=url,
                    error="Empty URL"
                ))
                continue

            # Extract YouTube ID
            try:
                youtube_id = extract_youtube_id(url)

                # Check for duplicates in this batch
                if any(v["youtube_id"] == youtube_id for v in videos_to_create):
                    failures.append(BulkUploadFailure(
                        row=row_num,
                        url=url,
                        error="Duplicate video in CSV"
                    ))
                    continue

                # Store YouTube ID and row for later metadata fetch
                videos_to_create.append({
                    "youtube_id": youtube_id,
                    "row": row_num,
                })
                # Store raw CSV row by youtube_id for field value processing
                csv_rows_map[youtube_id] = row

            except ValueError as e:
                failures.append(BulkUploadFailure(
                    row=row_num,
                    url=url,
                    error=str(e)
                ))

        # Create videos - HYBRID APPROACH:
        # - Small batches (≤5): Fetch metadata synchronously for instant UI feedback
        # - Large batches (>5): Use ARQ workers to avoid timeout
        SYNC_BATCH_THRESHOLD = 5
        use_sync_fetch = len(videos_to_create) <= SYNC_BATCH_THRESHOLD

        if videos_to_create:
            video_objects = []

            if use_sync_fetch:
                # SYNC PATH: Fetch metadata immediately for small batches
                logger.info(f"Small batch ({len(videos_to_create)} videos) - fetching metadata synchronously")
                redis = await get_redis_client()
                youtube_client = YouTubeClient(
                    api_key=settings.youtube_api_key,
                    redis_client=redis
                )

                for video_data in videos_to_create:
                    youtube_id = video_data["youtube_id"]
                    try:
                        # Fetch YouTube metadata immediately (200-500ms per video)
                        metadata = await youtube_client.get_video_metadata(youtube_id)

                        # Parse duration and timestamp
                        duration_seconds = parse_youtube_duration(metadata.get("duration"))
                        published_at = parse_youtube_timestamp(metadata.get("published_at"))

                        # YouTube Channels: Create or get channel
                        channel_db_id = None
                        youtube_channel_id = metadata.get("channel_id")
                        channel_name = metadata.get("channel")
                        if youtube_channel_id and channel_name:
                            channel_info = await youtube_client.get_channel_info(youtube_channel_id)
                            channel = await get_or_create_channel(
                                db=db,
                                user_id=bookmark_list.user_id,
                                youtube_channel_id=youtube_channel_id,
                                channel_name=channel_name,
                                channel_thumbnail=channel_info.get("thumbnail_url"),
                                channel_description=channel_info.get("description")
                            )
                            channel_db_id = channel.id

                        # Create video with COMPLETE metadata
                        video = Video(
                            list_id=list_id,
                            youtube_id=youtube_id,
                            title=metadata.get("title"),
                            channel=metadata.get("channel"),
                            channel_id=channel_db_id,
                            thumbnail_url=metadata.get("thumbnail_url"),
                            duration=duration_seconds,
                            published_at=published_at,
                            processing_status="completed"
                        )
                    except (HTTPError, TimeoutException, ValueError, KeyError, OSError) as e:
                        logger.warning(f"Failed to fetch metadata for {youtube_id}: {e}, falling back to pending")
                        video = Video(
                            list_id=list_id,
                            youtube_id=youtube_id,
                            processing_status="pending",
                            error_message=f"Could not fetch video metadata: {str(e)}"
                        )
                    video_objects.append(video)
            else:
                # ASYNC PATH: Create with pending status, ARQ worker fetches metadata
                # Two-phase import: Set thumbnail immediately from YouTube ID pattern
                # This ensures instant visual feedback while enrichment runs in background
                logger.info(f"Large batch ({len(videos_to_create)} videos) - queueing for background processing")
                for video_data in videos_to_create:
                    youtube_id = video_data["youtube_id"]
                    video = Video(
                        list_id=list_id,
                        youtube_id=youtube_id,
                        # Two-phase import: Thumbnail URL derived from YouTube ID (instant)
                        thumbnail_url=f"https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg",
                        # Initial import state for progress tracking
                        import_stage="created",
                        import_progress=0,
                        processing_status="pending"
                    )
                    video_objects.append(video)

            # Update videos_to_create to actual Video objects
            videos_to_create = video_objects

        # Bulk insert valid videos (all with pending status)
        created_videos = []  # Track successfully created videos
        if videos_to_create:
            db.add_all(videos_to_create)
            try:
                await db.commit()
                created_videos = videos_to_create  # All created successfully
                # Refresh all video objects to prevent detached object issues
                for video in created_videos:
                    await db.refresh(video)
            except IntegrityError:
                # Handle duplicates with existing videos in DB
                await db.rollback()
                # Retry one by one to identify which failed
                created_videos = []
                existing_videos = []  # Track existing videos for field value updates
                for video in videos_to_create:
                    try:
                        db.add(video)
                        await db.flush()
                        created_videos.append(video)
                    except IntegrityError:
                        await db.rollback()
                        # Load existing video for field value update
                        existing_stmt = select(Video).where(
                            Video.list_id == list_id,
                            Video.youtube_id == video.youtube_id
                        )
                        existing_result = await db.execute(existing_stmt)
                        existing_video = existing_result.scalar_one_or_none()
                        if existing_video:
                            existing_videos.append(existing_video)
                            logger.info(f"Video {video.youtube_id} already exists, will update field values")
                await db.commit()

                # Refresh all video objects to prevent detached object issues
                for video in created_videos:
                    await db.refresh(video)
                if 'existing_videos' in locals():
                    for video in existing_videos:
                        await db.refresh(video)

            # Separate videos by status for different handling
            pending_videos = [v for v in created_videos if v.processing_status == "pending"]
            completed_videos = [v for v in created_videos if v.processing_status == "completed"]

            # === Apply field values to ALL videos (new + existing) (SINGLE LOCATION) ===
            all_videos = created_videos + (existing_videos if 'existing_videos' in locals() else [])
            if field_columns and all_videos:
                await _process_field_values(
                    db=db,
                    created_videos=all_videos,
                    csv_rows_map=csv_rows_map,
                    field_columns=field_columns,
                    failures=failures
                )
                await db.commit()

            # Create processing job only for pending videos
            if pending_videos:
                await _enqueue_video_processing(db, list_id, len(pending_videos))

            # Trigger enrichment for videos that were processed synchronously
            if completed_videos:
                for video in completed_videos:
                    await _enqueue_enrichment(video.id, db)
                await db.commit()

        return BulkUploadResponse(
            created_count=len(created_videos),
            failed_count=len(failures),
            failures=failures,
            created_video_ids=[str(v.id) for v in created_videos]
        )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File must be UTF-8 encoded"
        )
    except csv.Error as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid CSV format: {str(e)}"
        )


@router.get("/lists/{list_id}/export/csv")
async def export_videos_csv(
    list_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> StreamingResponse:
    """
    Export all videos in a list to CSV format with custom field values.

    **CSV Format (Extended):**
    ```
    # Custom Fields: Overall Rating (rating, 1-5), Presentation (select: bad|good|great)
    youtube_id,status,created_at,field_Overall_Rating,field_Presentation
    dQw4w9WgXcQ,completed,2025-11-08T10:00:00,5,great
    jNQXAC9IVRw,pending,2025-11-08T11:00:00,,
    ```

    **Field Columns:**
    - Named `field_<field_name>` (e.g., "field_Overall_Rating")
    - Sorted alphabetically after standard columns
    - Empty values exported as empty string (not "NULL")
    - Metadata comment line includes field types for reference

    **Performance:**
    - Optimized for lists up to 1000 videos × 20 fields
    - Single query with eager loading (prevents N+1)
    - Target: < 2s for 100 videos × 10 fields

    Args:
        list_id: UUID of the bookmark list
        db: Database session

    Returns:
        StreamingResponse: CSV file download

    Raises:
        HTTPException 404: List not found
    """
    # === STEP 1: Validate list exists ===
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # === STEP 2: Get all custom fields for this list (for header generation) ===
    fields_stmt = (
        select(CustomField)
        .where(CustomField.list_id == list_id)
        .order_by(CustomField.name)  # Alphabetical order for consistent columns
    )
    fields_result = await db.execute(fields_stmt)
    custom_fields = list(fields_result.scalars().all())

    # === STEP 3: Get all videos with field values (eager loading) ===
    videos_stmt = (
        select(Video)
        .where(Video.list_id == list_id)
        .options(selectinload(Video.field_values))
        .order_by(Video.created_at)
    )
    videos_result = await db.execute(videos_stmt)
    videos = list(videos_result.scalars().all())

    # === STEP 3.5: Load all field values for all videos in one query (performance optimization) ===
    if videos:
        video_ids = [v.id for v in videos]
        field_values_stmt = (
            select(VideoFieldValue)
            .where(VideoFieldValue.video_id.in_(video_ids))
        )
        field_values_result = await db.execute(field_values_stmt)
        all_field_values = field_values_result.scalars().all()

        # Build a map of video_id -> list of field values
        video_field_values_map = {}
        for fv in all_field_values:
            if fv.video_id not in video_field_values_map:
                video_field_values_map[fv.video_id] = []
            video_field_values_map[fv.video_id].append(fv)
    else:
        video_field_values_map = {}

    # === STEP 4: Generate CSV with dynamic field columns ===
    output = io.StringIO()
    writer = csv.writer(output)

    # Generate metadata comment line (optional, for human reference)
    if custom_fields:
        field_metadata = ', '.join(
            f"{field.name} ({field.field_type}" +
            (f", {field.config.get('max_rating')}" if field.field_type == 'rating' else "") +
            (f": {'|'.join(field.config.get('options', []))}" if field.field_type == 'select' else "") +
            ")"
            for field in custom_fields
        )
        output.write(f"# Custom Fields: {field_metadata}\n")

    # Write header row
    # Use 'url' instead of 'youtube_id' for import compatibility
    header = ['url', 'status', 'created_at']
    # Add field columns: field_<field_name>
    field_columns = [f"field_{field.name}" for field in custom_fields]
    header.extend(field_columns)
    writer.writerow(header)

    # === STEP 5: Write video rows with field values ===
    for video in videos:
        # Standard columns
        # Convert youtube_id to full URL for import compatibility
        video_url = f"https://www.youtube.com/watch?v={video.youtube_id}"
        row = [
            video_url,
            video.processing_status,
            video.created_at.isoformat()
        ]

        # Build field values lookup from pre-loaded map
        video_field_values = video_field_values_map.get(video.id, [])
        field_values_map = {
            fv.field_id: fv for fv in video_field_values
        }

        # Add field value columns (match order of header)
        for field in custom_fields:
            field_value = field_values_map.get(field.id)

            if field_value is None:
                # No value set → empty string
                row.append('')
            else:
                # Extract value based on field type
                if field.field_type == 'rating':
                    value = field_value.value_numeric
                    # Preserve float precision (e.g., 4.5) - do not cast to int
                    row.append(str(value) if value is not None else '')
                elif field.field_type in ('select', 'text'):
                    value = field_value.value_text
                    row.append(value if value is not None else '')
                elif field.field_type == 'boolean':
                    value = field_value.value_boolean
                    # Export as "true"/"false" for CSV readability
                    row.append('true' if value is True else 'false' if value is False else '')

        writer.writerow(row)

    # === STEP 6: Create streaming response ===
    csv_content = output.getvalue()

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=videos_{list_id}.csv"
        }
    )


# Video-Tag Assignment Endpoints

class AssignTagsRequest(BaseModel):
    tag_ids: list[UUID]


class BulkAssignTagsRequest(BaseModel):
    video_ids: list[UUID]
    tag_ids: list[UUID]


# IMPORTANT: Bulk endpoint must be registered BEFORE parameterized endpoints
# to avoid path matching conflicts (/videos/bulk/tags vs /videos/{video_id}/tags)

@router.post("/videos/bulk/tags", response_model=dict)
async def bulk_assign_tags_to_videos(
    request: BulkAssignTagsRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk assign tags to multiple videos (cartesian product).

    Creates all possible video-tag associations for the given video_ids and tag_ids.
    Duplicates are ignored (idempotent).

    Args:
        request: BulkAssignTagsRequest with video_ids and tag_ids
        db: Database session

    Returns:
        dict: {"assigned": int, "total_requested": int}
        - assigned: number of new associations created
        - total_requested: total number of assignments requested

    Raises:
        HTTPException 400: Batch exceeds 10,000 assignments
        HTTPException 404: Some videos or tags not found
    """
    # Handle empty arrays
    if not request.video_ids or not request.tag_ids:
        return {
            "assigned": 0,
            "total_requested": 0
        }

    # Batch size limit
    total = len(request.video_ids) * len(request.tag_ids)
    if total > 10000:
        raise HTTPException(
            status_code=400,
            detail="Batch exceeds 10,000 assignments"
        )

    # Pre-validate videos exist
    video_count = await db.scalar(
        select(func.count()).select_from(Video)
        .where(Video.id.in_(request.video_ids))
    )
    if video_count != len(request.video_ids):
        raise HTTPException(
            status_code=404,
            detail="Some videos not found"
        )

    # Pre-validate tags exist
    tag_count = await db.scalar(
        select(func.count()).select_from(Tag)
        .where(Tag.id.in_(request.tag_ids))
    )
    if tag_count != len(request.tag_ids):
        raise HTTPException(
            status_code=404,
            detail="Some tags not found"
        )

    # Cartesian product
    assignments = [
        {"video_id": vid, "tag_id": tag}
        for vid in request.video_ids
        for tag in request.tag_ids
    ]

    # Bulk insert with ON CONFLICT DO NOTHING
    # Use constraint_name instead of index_elements for named constraints
    stmt = pg_insert(video_tags).values(assignments)
    stmt = stmt.on_conflict_do_nothing(
        constraint="uq_video_tags_video_tag"
    )

    result = await db.execute(stmt)
    await db.commit()

    return {
        "assigned": result.rowcount,
        "total_requested": len(assignments)
    }


@router.post("/videos/{video_id}/tags", response_model=list[TagResponse])
async def assign_tags_to_video(
    video_id: UUID,
    request: AssignTagsRequest,
    db: AsyncSession = Depends(get_db)
):
    """Assign tags to a video (many-to-many). Returns the updated list of tags."""
    from app.services.category_validation import (
        validate_category_assignment,
        CategoryValidationError,
    )

    # Verify video exists
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Verify all tags exist
    tags_stmt = select(Tag).where(Tag.id.in_(request.tag_ids))
    tags_result = await db.execute(tags_stmt)
    tags = list(tags_result.scalars().all())

    if len(tags) != len(request.tag_ids):
        raise HTTPException(status_code=400, detail="One or more tags not found")

    # Load video's existing tags for category validation
    existing_tags_stmt = (
        select(Tag)
        .join(video_tags)
        .where(video_tags.c.video_id == video_id)
    )
    existing_tags_result = await db.execute(existing_tags_stmt)
    video.__dict__['tags'] = list(existing_tags_result.scalars().all())

    # Validate category assignment (only one category per video)
    try:
        validate_category_assignment(video, tags)
    except CategoryValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": str(e),
                "existing_category_id": str(e.existing_category_id) if e.existing_category_id else None,
                "existing_category_name": e.existing_category_name,
                "new_category_name": e.new_category_name,
            }
        ) from e

    # Get existing tag associations for this video
    existing_stmt = select(video_tags.c.tag_id).where(video_tags.c.video_id == video_id)
    existing_result = await db.execute(existing_stmt)
    existing_tag_ids = {row[0] for row in existing_result.all()}

    # Insert only new associations (idempotent)
    for tag_id in request.tag_ids:
        if tag_id not in existing_tag_ids:
            await db.execute(
                video_tags.insert().values(video_id=video_id, tag_id=tag_id)
            )

    await db.commit()

    # Return all tags for this video
    final_tags_stmt = (
        select(Tag)
        .options(selectinload(Tag.schema))  # Eager load schema to prevent lazy='raise' error
        .join(video_tags)
        .where(video_tags.c.video_id == video_id)
    )
    final_tags_result = await db.execute(final_tags_stmt)
    return list(final_tags_result.scalars().all())


@router.delete("/videos/{video_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tag_from_video(
    video_id: UUID,
    tag_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Remove a tag from a video."""
    # Verify video exists
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Check if tag is assigned to video
    check_stmt = select(video_tags).where(
        video_tags.c.video_id == video_id,
        video_tags.c.tag_id == tag_id
    )
    check_result = await db.execute(check_stmt)
    association = check_result.first()

    if not association:
        raise HTTPException(status_code=404, detail="Tag not assigned to this video")

    # Delete association
    delete_stmt = video_tags.delete().where(
        video_tags.c.video_id == video_id,
        video_tags.c.tag_id == tag_id
    )
    await db.execute(delete_stmt)
    await db.commit()
    return None


@router.get("/videos/{video_id}/tags", response_model=list[TagResponse])
async def get_video_tags(video_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get all tags for a video."""
    # Verify video exists
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Get tags via junction table
    tags_stmt = (
        select(Tag)
        .options(selectinload(Tag.schema))  # Eager load schema to prevent lazy='raise' error
        .join(video_tags)
        .where(video_tags.c.video_id == video_id)
    )
    tags_result = await db.execute(tags_stmt)
    return list(tags_result.scalars().all())


# === Category Management Endpoint ===


class SetCategoryRequest(BaseModel):
    """Request to set/change a video's category."""
    category_id: Optional[UUID] = None


class SetCategoryResponse(BaseModel):
    """Response from setting a video's category."""
    backup_created: bool
    backup_available: bool
    restored_count: int = 0


@router.put("/videos/{video_id}/category", response_model=SetCategoryResponse)
async def set_video_category(
    video_id: UUID,
    request: SetCategoryRequest,
    restore_backup: bool = Query(False, description="Restore backup if available for new category"),
    db: AsyncSession = Depends(get_db)
) -> SetCategoryResponse:
    """
    Set video's category (replaces existing).

    This endpoint handles category changes with backup/restore functionality:
    - If video has existing category with field values, creates backup before removal
    - If new category has existing backup and restore_backup=true, restores values

    Args:
        video_id: UUID of video to update
        request: SetCategoryRequest with new category_id (null to remove)
        restore_backup: If true and backup exists for new category, restore values
        db: Database session

    Returns:
        SetCategoryResponse with backup_created, backup_available, restored_count

    Raises:
        HTTPException 404: Video not found
        HTTPException 400: Tag is not a category (is_video_type=false)
    """
    from app.services.field_value_backup import (
        backup_field_values,
        restore_field_values,
        list_backups,
    )

    # Step 2.18: Get video with tags
    video_stmt = (
        select(Video)
        .where(Video.id == video_id)
    )
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id {video_id} not found"
        )

    # Load video's existing tags to find current category
    existing_tags_stmt = (
        select(Tag)
        .join(video_tags)
        .where(video_tags.c.video_id == video_id)
    )
    existing_tags_result = await db.execute(existing_tags_stmt)
    existing_tags = list(existing_tags_result.scalars().all())

    # Get current category
    current_category = next((t for t in existing_tags if t.is_video_type), None)

    # Get new category (if not None)
    new_category = None
    if request.category_id:
        new_category_stmt = select(Tag).where(Tag.id == request.category_id)
        new_category_result = await db.execute(new_category_stmt)
        new_category = new_category_result.scalar_one_or_none()

        if not new_category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tag with id {request.category_id} not found"
            )

        if not new_category.is_video_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tag '{new_category.name}' is not a category (is_video_type=false). "
                       f"Use POST /videos/{video_id}/tags for labels."
            )

    # Early exit if same category (no-op)
    if current_category and new_category and current_category.id == new_category.id:
        return SetCategoryResponse(
            backup_created=False,
            backup_available=False,
            restored_count=0
        )

    # Step 2.19: Create backup if removing category with values
    backup_created = False
    if current_category:
        backup_path = await backup_field_values(video_id, current_category.id, db)
        backup_created = backup_path is not None

        # Remove old category
        delete_stmt = video_tags.delete().where(
            video_tags.c.video_id == video_id,
            video_tags.c.tag_id == current_category.id
        )
        await db.execute(delete_stmt)

    # Step 2.20: Add new category (if not None)
    restored_count = 0
    backup_available = False

    if new_category:
        # Check for existing backup
        backups = list_backups(video_id)
        backup_available = any(b.category_id == new_category.id for b in backups)

        # Add new category association
        insert_stmt = video_tags.insert().values(
            video_id=video_id,
            tag_id=new_category.id
        )
        await db.execute(insert_stmt)

        # Restore backup if requested and available
        if restore_backup and backup_available:
            restored_count = await restore_field_values(video_id, new_category.id, db)

    await db.commit()

    return SetCategoryResponse(
        backup_created=backup_created,
        backup_available=backup_available,
        restored_count=restored_count
    )


@router.put("/videos/{video_id}/fields", response_model=BatchUpdateFieldValuesResponse)
async def batch_update_video_field_values(
    video_id: UUID,
    request: BatchUpdateFieldValuesRequest,
    db: AsyncSession = Depends(get_db)
) -> BatchUpdateFieldValuesResponse:
    """
    Batch update custom field values for a video.

    Updates multiple field values atomically in a single transaction.
    Creates new VideoFieldValue records if they don't exist (upsert behavior).

    **Validation:**
    - Video must exist (404 if not found)
    - All field_ids must be valid CustomFields (400 if invalid)
    - Values validated per field type (422 if validation fails)
      - Rating: numeric, 0 to max_rating
      - Select: string, in options list
      - Text: string, max_length if configured
      - Boolean: true/false

    **Transaction Semantics:**
    - All-or-nothing: If any validation fails, no changes are persisted
    - Upsert: Creates if doesn't exist, updates if exists

    **Performance:**
    - Optimized for batches up to 50 fields
    - Single database round-trip for validation queries
    - Uses PostgreSQL UPSERT (ON CONFLICT DO UPDATE) for efficiency

    Args:
        video_id: UUID of video to update field values for
        request: Batch update request with list of field_id/value pairs
        db: Database session

    Returns:
        Response with updated_count and list of updated field values

    Raises:
        HTTPException:
            - 404: Video not found
            - 400: Invalid field_id (field doesn't exist)
            - 422: Validation error (value incompatible with field type)

    Example:
        PUT /api/videos/{video_id}/fields
        {
            "field_values": [
                {"field_id": "uuid1", "value": 5},
                {"field_id": "uuid2", "value": "great"}
            ]
        }

        Response (200):
        {
            "updated_count": 2,
            "field_values": [
                {
                    "field_id": "uuid1",
                    "value": 5,
                    "schema_name": null,
                    "show_on_card": true,
                    "display_order": 0,
                    "field": {
                        "id": "uuid1",
                        "name": "Overall Rating",
                        "field_type": "rating",
                        "config": {"max_rating": 5}
                    }
                },
                ...
            ]
        }
    """
    # === STEP 1: Validate video exists ===
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id {video_id} not found"
        )

    # === STEP 2: Fetch all CustomFields for validation ===
    # Extract field_ids from request
    field_ids = [update.field_id for update in request.field_values]

    # Query all fields in single query (performance optimization)
    fields_stmt = (
        select(CustomField)
        .where(CustomField.id.in_(field_ids))
    )
    fields_result = await db.execute(fields_stmt)
    fields = {field.id: field for field in fields_result.scalars().all()}

    # Validate all field_ids exist
    invalid_field_ids = [fid for fid in field_ids if fid not in fields]
    if invalid_field_ids:
        invalid_str = ', '.join(str(fid) for fid in invalid_field_ids)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field_id(s): {invalid_str}. These fields do not exist."
        )

    # === STEP 3: Validate values against field types (MODULE) ===
    validation_errors = []
    for update in request.field_values:
        field = fields[update.field_id]

        try:
            validate_field_value(
                value=update.value,
                field_type=field.field_type,
                config=field.config,
                field_name=field.name
            )
        except FieldValidationError as e:
            validation_errors.append({
                "field_id": str(update.field_id),
                "field_name": field.name,
                "error": str(e)
            })
        except ValueError as e:
            # Unknown field_type
            validation_errors.append({
                "field_id": str(update.field_id),
                "field_name": field.name,
                "error": str(e)
            })

    # If any validation failed, abort before database changes
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Field value validation failed",
                "errors": validation_errors
            }
        )

    # === STEP 4: Prepare upsert data ===
    # Convert updates to database-compatible format
    upsert_data = []
    for update in request.field_values:
        field = fields[update.field_id]

        # Determine which value column to populate based on field_type
        value_text = None
        value_numeric = None
        value_boolean = None

        if field.field_type == 'rating':
            value_numeric = update.value
        elif field.field_type in ('select', 'text'):
            value_text = update.value
        elif field.field_type == 'boolean':
            value_boolean = update.value

        upsert_data.append({
            'video_id': video_id,
            'field_id': update.field_id,
            'value_text': value_text,
            'value_numeric': value_numeric,
            'value_boolean': value_boolean
        })

    # === STEP 5: Execute PostgreSQL UPSERT ===
    # Use ON CONFLICT DO UPDATE for idempotent upsert
    # Constraint name from migration: uq_video_field_values_video_field
    stmt = pg_insert(VideoFieldValue).values(upsert_data)
    stmt = stmt.on_conflict_do_update(
        constraint='uq_video_field_values_video_field',  # From Task #62 migration
        set_={
            'value_text': stmt.excluded.value_text,
            'value_numeric': stmt.excluded.value_numeric,
            'value_boolean': stmt.excluded.value_boolean,
            'updated_at': func.now()
        }
    )

    await db.execute(stmt)
    await db.commit()
    db.expire_all()  # Clear session cache to force fresh query

    # === STEP 6: Fetch updated values with field definitions ===
    # Query all updated field values with eager loading
    # Note: Response uses VideoFieldValueResponse from Task #71
    # which expects field_id (not nested id), so we need to transform
    updated_stmt = (
        select(VideoFieldValue)
        .where(
            VideoFieldValue.video_id == video_id,
            VideoFieldValue.field_id.in_(field_ids)
        )
        .options(selectinload(VideoFieldValue.field))  # Eager load CustomField
    )
    updated_result = await db.execute(updated_stmt)
    updated_values_raw = updated_result.scalars().all()

    # === STEP 7: Transform VideoFieldValue ORM to VideoFieldValueResponse format ===
    # (match Task #71 response structure)
    field_values_response = []
    for fv in updated_values_raw:
        # Determine value based on field type
        if fv.field.field_type == 'rating':
            value = fv.value_numeric
        elif fv.field.field_type in ('select', 'text'):
            value = fv.value_text
        elif fv.field.field_type == 'boolean':
            value = fv.value_boolean
        else:
            value = None

        field_values_response.append(
            VideoFieldValueResponse(
                id=fv.id,
                video_id=fv.video_id,
                field_id=fv.field_id,
                field_name=fv.field.name,
                field=CustomFieldResponse.model_validate(fv.field),
                value=value,
                schema_name=None,  # Not applicable for direct update
                show_on_card=False,  # Not applicable for direct update
                display_order=0,  # Not applicable for direct update
                updated_at=fv.updated_at
            )
        )

    # Build response
    return BatchUpdateFieldValuesResponse(
        updated_count=len(field_values_response),
        field_values=field_values_response
    )
