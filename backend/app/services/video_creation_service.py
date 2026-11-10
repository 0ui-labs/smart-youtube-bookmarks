"""Video creation and CSV import; the caller owns commit and rollback."""

import csv
import io
import logging
from typing import Any
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from httpx import HTTPError, TimeoutException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.youtube import YouTubeClient
from app.core.config import settings
from app.core.redis import get_redis_client
from app.models.custom_field import CustomField
from app.models.list import BookmarkList
from app.models.video import Video
from app.schemas.video import (
    BulkUploadFailure,
    BulkUploadResponse,
    VideoAdd,
)
from app.services.channel_service import get_or_create_channel
from app.services.job_dispatch_service import DurableJobQueue
from app.services.video_import_service import (
    persist_csv_videos,
    process_field_values as _process_field_values,
)
from app.services.video_job_service import (
    _enqueue_enrichment,
    _enqueue_video_processing,
)
from app.services.video_metadata_service import (
    extract_youtube_id,
    parse_youtube_duration,
    parse_youtube_timestamp,
)

logger = logging.getLogger(__name__)


async def import_csv_videos(
    db: AsyncSession, list_id: UUID, file: UploadFile
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
    result = await db.execute(select(BookmarkList).where(BookmarkList.id == list_id))
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found",
        )

    # Read and parse CSV
    try:
        content = await file.read()
        csv_string = content.decode("utf-8")

        # Skip comment lines (starting with #) for import compatibility with exported CSVs
        csv_lines = [
            line for line in csv_string.split("\n") if not line.startswith("#")
        ]
        clean_csv_string = "\n".join(csv_lines)

        csv_file = io.StringIO(clean_csv_string)
        reader = csv.DictReader(csv_file)

        # Validate header
        if reader.fieldnames is None or "url" not in reader.fieldnames:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CSV must have 'url' header column",
            )

        # === NEW: Detect field columns in CSV header ===
        # Step 1: Get all custom fields for this list
        fields_stmt = select(CustomField).where(CustomField.list_id == list_id)
        fields_result = await db.execute(fields_stmt)
        all_fields = {
            field.name.lower(): field for field in fields_result.scalars().all()
        }

        # Step 2: Detect field columns in CSV header
        field_columns = {}  # column_name -> dict with field data
        for column_name in reader.fieldnames:
            if column_name.lower().startswith("field_"):
                # Extract field name (remove "field_" prefix)
                field_name = (
                    column_name[6:].strip().lower()
                )  # "field_Overall_Rating" -> "overall_rating"

                # Try to match to existing field (case-insensitive)
                if field_name in all_fields:
                    field_obj = all_fields[field_name]
                    # Cache field attributes to avoid detached object issues after commit
                    field_columns[column_name] = {
                        "id": field_obj.id,
                        "name": field_obj.name,
                        "field_type": field_obj.field_type,
                        "config": field_obj.config,
                    }
                    logger.info(
                        f"Detected field column: {column_name} -> {field_obj.name}"
                    )
                else:
                    logger.warning(
                        f"Unknown field column '{column_name}' (no matching custom field), will be ignored"
                    )

        videos_to_create: list[dict[str, Any]] = []
        csv_rows_map: dict[
            str, list[dict[str, str]]
        ] = {}  # Store raw CSV rows by youtube_id for field value processing
        failures = []
        row_num = 1  # Start at 1 (header is row 0)

        for row in reader:
            row_num += 1
            url = row.get("url", "").strip()

            if not url:
                failures.append(
                    BulkUploadFailure(row=row_num, url=url, error="Empty URL")
                )
                continue

            # Extract YouTube ID
            try:
                youtube_id = extract_youtube_id(url)

                csv_rows_map.setdefault(youtube_id, []).append(row)

                # Check for duplicates in this batch
                if any(v["youtube_id"] == youtube_id for v in videos_to_create):
                    failures.append(
                        BulkUploadFailure(
                            row=row_num, url=url, error="Duplicate video in CSV"
                        )
                    )
                    continue

                # Store YouTube ID and row for later metadata fetch
                videos_to_create.append(
                    {
                        "youtube_id": youtube_id,
                        "row": row_num,
                    }
                )
                # Store raw CSV row by youtube_id for field value processing
                # Repeated rows are applied in order: last valid field value wins.

            except ValueError as e:
                failures.append(BulkUploadFailure(row=row_num, url=url, error=str(e)))

        # Create videos - HYBRID APPROACH:
        # - Small batches (≤5): Fetch metadata synchronously for instant UI feedback
        # - Large batches (>5): Use ARQ workers to avoid timeout
        SYNC_BATCH_THRESHOLD = 5
        use_sync_fetch = len(videos_to_create) <= SYNC_BATCH_THRESHOLD

        video_objects: list[Video] = []
        if videos_to_create:
            if use_sync_fetch:
                # SYNC PATH: Fetch metadata immediately for small batches
                logger.info(
                    f"Small batch ({len(videos_to_create)} videos) - fetching metadata synchronously"
                )
                redis = await get_redis_client()
                youtube_client = YouTubeClient(
                    api_key=settings.youtube_api_key, redis_client=redis
                )

                for video_data in videos_to_create:
                    youtube_id = video_data["youtube_id"]
                    try:
                        # Fetch YouTube metadata immediately (200-500ms per video)
                        metadata = await youtube_client.get_video_metadata(youtube_id)

                        # Parse duration and timestamp
                        duration_seconds = parse_youtube_duration(
                            metadata.get("duration")
                        )
                        published_at = parse_youtube_timestamp(
                            metadata.get("published_at")
                        )

                        # YouTube Channels: Create or get channel
                        channel_db_id = None
                        youtube_channel_id = metadata.get("channel_id")
                        channel_name = metadata.get("channel")
                        if youtube_channel_id and channel_name:
                            channel_info = await youtube_client.get_channel_info(
                                youtube_channel_id
                            )
                            channel = await get_or_create_channel(
                                db=db,
                                user_id=bookmark_list.user_id,
                                youtube_channel_id=youtube_channel_id,
                                channel_name=channel_name,
                                channel_thumbnail=channel_info.get("thumbnail_url"),
                                channel_description=channel_info.get("description"),
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
                            processing_status="completed",
                        )
                    except (
                        HTTPError,
                        TimeoutException,
                        ValueError,
                        KeyError,
                        OSError,
                    ) as e:
                        logger.warning(
                            f"Failed to fetch metadata for {youtube_id}: {e}, falling back to pending"
                        )
                        video = Video(
                            list_id=list_id,
                            youtube_id=youtube_id,
                            processing_status="pending",
                            error_message=f"Could not fetch video metadata: {e!s}",
                        )
                    video_objects.append(video)
            else:
                # ASYNC PATH: Create with pending status, ARQ worker fetches metadata
                # Two-phase import: Set thumbnail immediately from YouTube ID pattern
                # This ensures instant visual feedback while enrichment runs in background
                logger.info(
                    f"Large batch ({len(videos_to_create)} videos) - queueing for background processing"
                )
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
                        processing_status="pending",
                    )
                    video_objects.append(video)

            # Update videos_to_create to actual Video objects

        # Bulk insert valid videos (all with pending status)
        created_videos: list[Video] = []  # Track successfully created videos
        if videos_to_create:
            created_videos, existing_videos = await persist_csv_videos(
                db, video_objects
            )

            # Separate videos by status for different handling
            pending_videos = [
                v for v in created_videos if v.processing_status == "pending"
            ]
            completed_videos = [
                v for v in created_videos if v.processing_status == "completed"
            ]

            # === Apply field values to ALL videos (new + existing) (SINGLE LOCATION) ===
            all_videos = created_videos + (
                existing_videos if "existing_videos" in locals() else []
            )
            if field_columns and all_videos:
                await _process_field_values(
                    db=db,
                    created_videos=all_videos,
                    csv_rows_map=csv_rows_map,
                    field_columns=field_columns,
                    failures=failures,
                )

            # Create processing job only for pending videos
            if pending_videos:
                await _enqueue_video_processing(
                    db,
                    list_id,
                    len(pending_videos),
                    [str(video.id) for video in pending_videos],
                )

            # Trigger enrichment for videos that were processed synchronously
            if completed_videos:
                for video in completed_videos:
                    await _enqueue_enrichment(video.id, db)
            await db.flush()

        return BulkUploadResponse(
            created_count=len(created_videos),
            failed_count=len(failures),
            failures=failures,
            created_video_ids=[str(v.id) for v in created_videos],
        )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File must be UTF-8 encoded",
        )
    except csv.Error as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid CSV format: {e!s}",
        )


async def create_video(db: AsyncSession, list_id: UUID, video_data: VideoAdd) -> Video:
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
    result = await db.execute(select(BookmarkList).where(BookmarkList.id == list_id))
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found",
        )

    # Extract YouTube ID
    try:
        youtube_id = extract_youtube_id(video_data.url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)
        )

    if (
        await db.execute(
            select(Video.id).where(
                Video.list_id == list_id, Video.youtube_id == youtube_id
            )
        )
    ).scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Video already exists in this list")

    # HYBRID APPROACH: Fetch metadata SYNCHRONOUSLY for single videos (fast!)
    # For bulk uploads, we'll use ARQ workers instead
    redis = await get_redis_client()
    youtube_client = YouTubeClient(api_key=settings.youtube_api_key, redis_client=redis)

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
                channel_description=channel_info.get("description"),
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
            import_progress=25,
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
            error_message=f"Could not fetch video metadata: {e!s}",
            # Initial import state
            import_stage="created",
            import_progress=0,
        )

    created, existing = await persist_csv_videos(db, [new_video])
    if existing:
        raise HTTPException(status_code=409, detail="Video already exists in this list")
    new_video = created[0]

    # Trigger enrichment if video was successfully created with metadata
    if new_video.processing_status == "completed":
        await _enqueue_enrichment(new_video.id, db)
    else:
        await DurableJobQueue(db).enqueue_job(
            "process_video", str(new_video.id), str(list_id), None, None
        )
    await db.flush()

    # Set tags to empty list to avoid async relationship loading issues
    # (newly created video has no tags assigned yet)
    new_video.__dict__["tags"] = []

    # Set field_values to empty list (no tags → no applicable fields)
    new_video.__dict__["field_values"] = []

    return new_video
