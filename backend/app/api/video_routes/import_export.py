"""Video import export endpoints."""

import csv
import io
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from httpx import HTTPError, TimeoutException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.clients.youtube import YouTubeClient
from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_redis_client
from app.models.custom_field import CustomField
from app.models.list import BookmarkList
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.schemas.video import (
    BulkUploadFailure,
    BulkUploadResponse,
    VideoAdd,
    VideoResponse,
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
router = APIRouter()


@router.post(
    "/lists/{list_id}/videos",
    response_model=VideoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_video_to_list(
    list_id: UUID, video_data: VideoAdd, db: AsyncSession = Depends(get_db)
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

    # Save to database
    try:
        db.add(new_video)
        await db.flush()
        await db.refresh(new_video)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Video already exists in this list",
        )

    # Trigger enrichment if video was successfully created with metadata
    if new_video.processing_status == "completed":
        await _enqueue_enrichment(new_video.id, db)
    else:
        await DurableJobQueue(db).enqueue_job(
            "process_video", str(new_video.id), str(list_id), None, None
        )
    await db.commit()

    # Set tags to empty list to avoid async relationship loading issues
    # (newly created video has no tags assigned yet)
    new_video.__dict__["tags"] = []

    # Set field_values to empty list (no tags → no applicable fields)
    new_video.__dict__["field_values"] = []

    return new_video


@router.post(
    "/lists/{list_id}/videos/bulk",
    response_model=BulkUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def bulk_upload_videos(
    list_id: UUID, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
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

        videos_to_create = []
        csv_rows_map = {}  # Store raw CSV rows by youtube_id for field value processing
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

        if videos_to_create:
            video_objects = []

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
            videos_to_create = video_objects

        # Bulk insert valid videos (all with pending status)
        created_videos = []  # Track successfully created videos
        if videos_to_create:
            created_videos, existing_videos = await persist_csv_videos(
                db, videos_to_create
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
            await db.commit()

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


@router.get("/lists/{list_id}/export/csv")
async def export_videos_csv(
    list_id: UUID, db: AsyncSession = Depends(get_db)
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
    result = await db.execute(select(BookmarkList).where(BookmarkList.id == list_id))
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found",
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
        field_values_stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id.in_(video_ids)
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
        field_metadata = ", ".join(
            f"{field.name} ({field.field_type}"
            + (
                f", {field.config.get('max_rating')}"
                if field.field_type == "rating"
                else ""
            )
            + (
                f": {'|'.join(field.config.get('options', []))}"
                if field.field_type == "select"
                else ""
            )
            + ")"
            for field in custom_fields
        )
        output.write(f"# Custom Fields: {field_metadata}\n")

    # Write header row
    # Use 'url' instead of 'youtube_id' for import compatibility
    header = ["url", "status", "created_at"]
    # Add field columns: field_<field_name>
    field_columns = [f"field_{field.name}" for field in custom_fields]
    header.extend(field_columns)
    writer.writerow(header)

    # === STEP 5: Write video rows with field values ===
    for video in videos:
        # Standard columns
        # Convert youtube_id to full URL for import compatibility
        video_url = f"https://www.youtube.com/watch?v={video.youtube_id}"
        row = [video_url, video.processing_status, video.created_at.isoformat()]

        # Build field values lookup from pre-loaded map
        video_field_values = video_field_values_map.get(video.id, [])
        field_values_map = {fv.field_id: fv for fv in video_field_values}

        # Add field value columns (match order of header)
        for field in custom_fields:
            field_value = field_values_map.get(field.id)

            if field_value is None:
                # No value set → empty string
                row.append("")
            else:
                # Extract value based on field type
                if field.field_type == "rating":
                    value = field_value.value_numeric
                    # Preserve float precision (e.g., 4.5) - do not cast to int
                    row.append(str(value) if value is not None else "")
                elif field.field_type in ("select", "text"):
                    value = field_value.value_text
                    row.append(value if value is not None else "")
                elif field.field_type == "boolean":
                    value = field_value.value_boolean
                    # Export as "true"/"false" for CSV readability
                    row.append(
                        "true" if value is True else "false" if value is False else ""
                    )

        writer.writerow(row)

    # === STEP 6: Create streaming response ===
    csv_content = output.getvalue()

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=videos_{list_id}.csv"},
    )
