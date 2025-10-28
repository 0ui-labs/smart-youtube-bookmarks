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
from typing import List, Sequence
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.list import BookmarkList
from app.models.video import Video
from app.schemas.video import VideoAdd, VideoResponse, BulkUploadResponse, BulkUploadFailure


router = APIRouter(prefix="/api", tags=["videos"])


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
    - Checks for duplicates (409 if already in list)
    - Sets processing status to "pending"
    - Commits to database (critical fix)

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

    # Create video
    new_video = Video(
        list_id=list_id,
        youtube_id=youtube_id,
        processing_status="pending"
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
                if any(v.youtube_id == youtube_id for v in videos_to_create):
                    failures.append(BulkUploadFailure(
                        row=row_num,
                        url=url,
                        error="Duplicate video in CSV"
                    ))
                    continue

                # Create video object
                video = Video(
                    list_id=list_id,
                    youtube_id=youtube_id,
                    processing_status="pending"
                )
                videos_to_create.append(video)

            except ValueError as e:
                failures.append(BulkUploadFailure(
                    row=row_num,
                    url=url,
                    error=str(e)
                ))

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

                return BulkUploadResponse(
                    created_count=created,
                    failed_count=len(failures),
                    failures=failures
                )

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
