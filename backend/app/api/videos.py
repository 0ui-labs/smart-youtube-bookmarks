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
from typing import List, Sequence, Optional, Annotated
import csv
import io
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
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
from app.schemas.video import VideoAdd, VideoResponse, BulkUploadResponse, BulkUploadFailure
from app.schemas.tag import TagResponse
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

        # Parse duration from ISO 8601 to seconds
        duration_seconds = None
        if metadata.get("duration"):
            try:
                from isodate import parse_duration as parse_iso_duration
                duration_obj = parse_iso_duration(metadata["duration"])
                duration_seconds = int(duration_obj.total_seconds())
            except Exception:
                pass

        # Parse published_at
        published_at = None
        if metadata.get("published_at"):
            try:
                from datetime import datetime
                published_at = datetime.fromisoformat(
                    metadata["published_at"].replace('Z', '+00:00')
                )
            except (ValueError, AttributeError):
                pass

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

    return new_video


@router.get("/lists/{list_id}/videos", response_model=List[VideoResponse])
async def get_videos_in_list(
    list_id: UUID,
    tags: Annotated[Optional[List[str]], Query(max_items=10)] = None,
    db: AsyncSession = Depends(get_db)
) -> List[Video]:
    """
    Get all videos in a bookmark list with optional tag filtering.

    Args:
        list_id: UUID of the bookmark list
        tags: Optional list of tag names for OR filtering (case-insensitive)
        db: Database session

    Returns:
        List[VideoResponse]: List of videos in the bookmark list

    Raises:
        HTTPException 404: List not found

    Examples:
        - /api/lists/{id}/videos - All videos in list
        - /api/lists/{id}/videos?tags=Python&tags=Tutorial - Videos with Python OR Tutorial tags
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
    stmt = select(Video).where(Video.list_id == list_id).order_by(Video.created_at)

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
                .distinct()
            )

    # Execute query
    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

    if not videos:
        return []

    # Load all tags for all videos in a single query (prevents N+1)
    # This is more explicit than selectinload and works better with FastAPI response models
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

    return list(videos)


@router.get("/videos", response_model=List[VideoResponse])
async def list_all_videos(
    tags: Annotated[Optional[List[str]], Query(max_items=10)] = None,
    tags_all: Annotated[Optional[List[str]], Query(max_items=10)] = None,
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
