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
from typing import List, Sequence, Optional
import csv
import io
from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from isodate import parse_duration

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
    Add a video to a bookmark list.

    - Validates list exists (404 if not found)
    - Extracts YouTube video ID from URL
    - Fetches YouTube metadata immediately (title, channel, thumbnail, duration)
    - Checks for duplicates (409 if already in list)
    - Commits to database with full metadata

    Args:
        list_id: UUID of the bookmark list
        video_data: Video data with YouTube URL
        db: Database session

    Returns:
        VideoResponse: Created video with metadata

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

    # Fetch YouTube metadata immediately
    redis = await get_redis_client()
    youtube_client = YouTubeClient(
        api_key=settings.youtube_api_key,
        redis_client=redis
    )

    # Fetch metadata for single video
    try:
        metadata_list = await youtube_client.get_batch_metadata([youtube_id])
        metadata = metadata_list[0] if metadata_list else None
    except Exception as e:
        logger.error(f"YouTube metadata fetch failed for {youtube_id}: {e}")
        metadata = None

    # Create video with metadata (or basic if fetch failed)
    if metadata:
        # Parse duration from ISO 8601 to seconds
        duration_seconds = None
        if metadata.get("duration"):
            try:
                duration_obj = parse_duration(metadata["duration"])
                duration_seconds = int(duration_obj.total_seconds())
            except Exception:
                pass

        # Parse published_at
        published_at = None
        if metadata.get("published_at"):
            try:
                published_at = datetime.fromisoformat(
                    metadata["published_at"].replace('Z', '+00:00')
                )
            except (ValueError, AttributeError):
                pass

        new_video = Video(
            list_id=list_id,
            youtube_id=youtube_id,
            title=metadata.get("title"),
            channel=metadata.get("channel"),
            duration=duration_seconds,
            thumbnail_url=metadata.get("thumbnail_url"),
            published_at=published_at,
            processing_status="completed"  # Metadata fetched successfully
        )
    else:
        # Fallback: Create basic video if metadata fetch failed
        new_video = Video(
            list_id=list_id,
            youtube_id=youtube_id,
            processing_status="failed",
            error_message="Could not fetch video metadata from YouTube"
        )

    try:
        db.add(new_video)
        await db.flush()
        await db.refresh(new_video)
        await db.commit()  # CRITICAL FIX: Commit to persist data
    except IntegrityError:
        # CRITICAL FIX: Handle race conditions and duplicate constraint violations
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
    db: AsyncSession = Depends(get_db)
) -> List[Video]:
    """
    Get all videos in a bookmark list.

    Args:
        list_id: UUID of the bookmark list
        db: Database session

    Returns:
        List[VideoResponse]: List of videos in the bookmark list

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

    # Load tags for each video via junction table
    # (async lazy loading doesn't work reliably, so we query explicitly)
    for video in videos:
        tags_stmt = (
            select(Tag)
            .join(video_tags)
            .where(video_tags.c.video_id == video.id)
        )
        tags_result = await db.execute(tags_stmt)
        # Set tags via __dict__ to avoid SQLAlchemy relationship issues
        video.__dict__['tags'] = list(tags_result.scalars().all())

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

        # Fetch YouTube metadata in batch before inserting
        if videos_to_create:
            # Extract YouTube IDs for batch fetch
            youtube_ids = [v["youtube_id"] for v in videos_to_create]

            # Fetch YouTube metadata in batch
            redis = await get_redis_client()
            youtube_client = YouTubeClient(
                api_key=settings.youtube_api_key,
                redis_client=redis
            )

            try:
                metadata_list = await youtube_client.get_batch_metadata(youtube_ids)

                # Create lookup dict for fast access
                metadata_by_id = {m["youtube_id"]: m for m in metadata_list}

                # Create video objects with metadata
                video_objects = []
                for video_data in videos_to_create:
                    youtube_id = video_data["youtube_id"]
                    metadata = metadata_by_id.get(youtube_id)

                    if metadata:
                        # Parse duration from ISO 8601 to seconds
                        duration_seconds = 0
                        if metadata.get("duration"):
                            try:
                                duration_obj = parse_duration(metadata["duration"])
                                duration_seconds = int(duration_obj.total_seconds())
                            except Exception:
                                pass

                        # Parse published_at
                        published_at = None
                        if metadata.get("published_at"):
                            try:
                                published_at = datetime.fromisoformat(
                                    metadata["published_at"].replace('Z', '+00:00')
                                )
                            except (ValueError, AttributeError):
                                pass

                        # Create video with full metadata
                        video = Video(
                            list_id=list_id,
                            youtube_id=youtube_id,
                            title=metadata.get("title"),
                            channel=metadata.get("channel"),
                            duration=duration_seconds,
                            thumbnail_url=metadata.get("thumbnail_url"),
                            published_at=published_at,
                            processing_status="completed"  # Metadata fetched successfully
                        )
                        video_objects.append(video)
                    else:
                        # Video not found on YouTube
                        failures.append(BulkUploadFailure(
                            row=video_data["row"],
                            url=f"https://www.youtube.com/watch?v={youtube_id}",
                            error="Video not found on YouTube or unavailable"
                        ))

                # Update videos_to_create to actual Video objects
                videos_to_create = video_objects

            except Exception as e:
                # If batch fetch fails entirely, fall back to basic videos
                logger.error(f"YouTube batch fetch failed: {e}")
                video_objects = []
                for video_data in videos_to_create:
                    video = Video(
                        list_id=list_id,
                        youtube_id=video_data["youtube_id"],
                        processing_status="failed",
                        error_message="Failed to fetch video metadata from YouTube"
                    )
                    video_objects.append(video)
                videos_to_create = video_objects

        # Bulk insert valid videos
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
