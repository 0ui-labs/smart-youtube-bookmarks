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
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload, aliased
from sqlalchemy.dialects.postgresql import insert as pg_insert
from isodate import parse_duration
from httpx import HTTPError, TimeoutException

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
from app.schemas.video import VideoAdd, VideoResponse, BulkUploadResponse, BulkUploadFailure, VideoFieldValueResponse, AvailableFieldResponse, VideoFilterRequest, FieldFilterOperator
from app.schemas.video_field_value import (
    BatchUpdateFieldValuesRequest,
    BatchUpdateFieldValuesResponse,
)
from app.schemas.tag import TagResponse
from app.schemas.custom_field import CustomFieldResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)


def parse_youtube_duration(iso_duration: str | None) -> int | None:
    """Parse ISO 8601 duration to seconds."""
    if not iso_duration:
        return None
    try:
        duration_obj = parse_duration(iso_duration)
        return int(duration_obj.total_seconds())
    except Exception as e:
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

        # Create video with COMPLETE metadata (instant!)
        new_video = Video(
            list_id=list_id,
            youtube_id=youtube_id,
            title=metadata.get("title"),
            channel=metadata.get("channel"),
            thumbnail_url=metadata.get("thumbnail_url"),
            duration=duration_seconds,
            published_at=published_at,
            processing_status="completed"  # Already have all data!
        )

    except Exception as e:
        # Fallback: Create with pending status if YouTube API fails
        logger.warning(f"Failed to fetch YouTube metadata for {youtube_id}: {e}")
        new_video = Video(
            list_id=list_id,
            youtube_id=youtube_id,
            processing_status="failed",
            error_message=f"Could not fetch video metadata: {str(e)}"
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
    if sort_by:
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
    else:
        # Default sorting: created_at descending (newest first)
        stmt = stmt.order_by(desc(Video.created_at))

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
            field_values_response = []
            for field, schema_name, display_order, show_on_card in applicable_fields:
                field_value = values_by_field_id.get(field.id)

                # ✅ REF #3: Extract value based on field type (float not int)
                value = None
                if field_value:
                    if field.field_type == 'rating':
                        value = field_value.value_numeric  # Can be float
                    elif field.field_type in ('select', 'text'):
                        value = field_value.value_text
                    elif field.field_type == 'boolean':
                        value = field_value.value_boolean

                # Create response dict (Pydantic will serialize)
                field_values_response.append({
                    'field_id': field.id,
                    'field': field,  # CustomField ORM object
                    'value': value,
                    'schema_name': schema_name,
                    'show_on_card': show_on_card,
                    'display_order': display_order
                })

            # Assign to video (FastAPI will serialize via VideoResponse schema)
            video.__dict__['field_values'] = field_values_response
    else:
        # No videos → no field values needed
        for video in videos:
            video.__dict__['field_values'] = []

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

    # Step 5: Execute query
    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

    if not videos:
        return []

    # Step 6: Load tags for all videos (prevent N+1)
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

    # Step 7: Batch-load applicable fields for ALL videos
    applicable_fields_by_video = await get_available_fields_for_videos(videos, db)

    # Step 8: Batch load field values
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
            field_values_response = []
            for field, schema_name, display_order, show_on_card in applicable_fields:
                field_value = values_by_field_id.get(field.id)

                # Extract value based on field type
                value = None
                if field_value:
                    if field.field_type == 'rating':
                        value = field_value.value_numeric  # Can be float
                    elif field.field_type in ('select', 'text'):
                        value = field_value.value_text
                    elif field.field_type == 'boolean':
                        value = field_value.value_boolean

                # Create response dict (Pydantic will serialize)
                field_values_response.append({
                    'field_id': field.id,
                    'field': field,  # CustomField ORM object
                    'value': value,
                    'schema_name': schema_name,
                    'show_on_card': show_on_card,
                    'display_order': display_order
                })

            # Assign to video (FastAPI will serialize via VideoResponse schema)
            video.__dict__['field_values'] = field_values_response
    else:
        # No videos -> no field values needed
        for video in videos:
            video.__dict__['field_values'] = []

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
    # Step 1: Load video with eager loading for tags and field_values
    stmt = (
        select(Video)
        .where(Video.id == video_id)
        .options(
            selectinload(Video.tags).selectinload(Tag.schema),  # For available_fields
            selectinload(Video.field_values).selectinload(VideoFieldValue.field)  # For field_values
        )
    )
    result = await db.execute(stmt)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    # Step 2: Get available fields using helper module
    available_fields_tuples = await get_available_fields_for_video(video, db)

    # Step 3: Convert tuples to AvailableFieldResponse objects
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

    # Step 4: Build field_values response (similar to list endpoint logic)
    field_values_list = video.field_values if video.field_values is not None else []
    values_by_field_id = {fv.field_id: fv for fv in field_values_list}

    field_values_response = []
    for field, schema_name, display_order, show_on_card in available_fields_tuples:
        field_value = values_by_field_id.get(field.id)

        # Extract value based on field type
        value = None
        if field_value:
            if field.field_type == 'rating':
                value = field_value.value_numeric  # Can be float
            elif field.field_type in ('select', 'text'):
                value = field_value.value_text
            elif field.field_type == 'boolean':
                value = field_value.value_boolean

        # Create response dict (Pydantic will serialize)
        field_values_response.append({
            'field_id': field.id,
            'field': field,  # CustomField ORM object
            'value': value,
            'schema_name': schema_name,
            'show_on_card': show_on_card,
            'display_order': display_order
        })

    # Step 5: Attach available_fields and field_values to video object for Pydantic
    video.__dict__['available_fields'] = available_fields
    video.__dict__['field_values'] = field_values_response

    # Ensure tags is a list (not None) for Pydantic validation
    if video.tags is None:
        video.__dict__['tags'] = []

    return video


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

    return list(videos)


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    Delete a video from a bookmark list.

    Args:
        video_id: UUID of the video to delete
        db: Database session

    Raises:
        HTTPException 404: Video not found
    """
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

    # Delete video
    await db.delete(video)
    await db.commit()  # CRITICAL FIX: Commit to persist deletion

    return None


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
    Bulk upload videos from CSV file.

    CSV format:
    ```
    url
    https://www.youtube.com/watch?v=VIDEO_ID_1
    https://youtu.be/VIDEO_ID_2
    ```

    - Validates list exists (404 if not found)
    - Validates CSV header must be "url"
    - Processes each row, collecting failures
    - Returns created_count, failed_count, and failure details
    - Commits all valid videos in single transaction

    Args:
        list_id: UUID of the bookmark list
        file: CSV file with YouTube URLs
        db: Database session

    Returns:
        BulkUploadResponse: Statistics and failure details

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
        csv_file = io.StringIO(csv_string)
        reader = csv.DictReader(csv_file)

        # Validate header
        if reader.fieldnames is None or 'url' not in reader.fieldnames:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CSV must have 'url' header column"
            )

        videos_to_create = []
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

            except ValueError as e:
                failures.append(BulkUploadFailure(
                    row=row_num,
                    url=url,
                    error=str(e)
                ))

        # Create videos with pending status and queue ARQ background tasks (Option B)
        if videos_to_create:
            # Create video objects with PENDING status
            # Metadata will be fetched by ARQ worker in background
            video_objects = []
            for video_data in videos_to_create:
                youtube_id = video_data["youtube_id"]

                # Create video with pending status
                video = Video(
                    list_id=list_id,
                    youtube_id=youtube_id,
                    processing_status="pending"  # Option B: Queue background task
                )
                video_objects.append(video)

            # Update videos_to_create to actual Video objects
            videos_to_create = video_objects

        # Bulk insert valid videos (all with pending status)
        if videos_to_create:
            db.add_all(videos_to_create)
            try:
                await db.commit()
            except IntegrityError:
                # Handle duplicates with existing videos in DB
                await db.rollback()
                # Retry one by one to identify which failed
                created = 0
                for video in videos_to_create:
                    try:
                        db.add(video)
                        await db.flush()
                        created += 1
                    except IntegrityError:
                        await db.rollback()
                        failures.append(BulkUploadFailure(
                            row=0,  # Row unknown in retry
                            url=f"https://www.youtube.com/watch?v={video.youtube_id}",
                            error="Video already exists in this list"
                        ))
                await db.commit()

                # Create processing job if videos were created
                await _enqueue_video_processing(db, list_id, created)

                return BulkUploadResponse(
                    created_count=created,
                    failed_count=len(failures),
                    failures=failures
                )

        # Create processing job if videos were created
        await _enqueue_video_processing(db, list_id, len(videos_to_create))

        return BulkUploadResponse(
            created_count=len(videos_to_create),
            failed_count=len(failures),
            failures=failures
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
    Export all videos in a list to CSV format.

    CSV format:
    ```
    youtube_id,status,created_at
    VIDEO_ID_1,pending,2025-10-28T10:00:00
    VIDEO_ID_2,completed,2025-10-27T15:30:00
    ```

    - Validates list exists (404 if not found)
    - Returns CSV file as downloadable attachment
    - Empty lists return CSV with header only

    Args:
        list_id: UUID of the bookmark list
        db: Database session

    Returns:
        StreamingResponse: CSV file download

    Raises:
        HTTPException 404: List not found
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

    # Get all videos
    result = await db.execute(
        select(Video)
        .where(Video.list_id == list_id)
        .order_by(Video.created_at)
    )
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow(['youtube_id', 'status', 'created_at'])

    # Write video rows
    for video in videos:
        writer.writerow([
            video.youtube_id,
            video.processing_status,
            video.created_at.isoformat()
        ])

    # Create streaming response
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
        .join(video_tags)
        .where(video_tags.c.video_id == video_id)
    )
    tags_result = await db.execute(tags_stmt)
    return list(tags_result.scalars().all())


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
                field_id=fv.field_id,
                field=CustomFieldResponse.model_validate(fv.field),
                value=value,
                schema_name=None,  # Not applicable for direct update
                show_on_card=False,  # Not applicable for direct update
                display_order=0  # Not applicable for direct update
            )
        )

    # Build response
    return BatchUpdateFieldValuesResponse(
        updated_count=len(field_values_response),
        field_values=field_values_response
    )
