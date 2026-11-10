"""CSV serialization uses the same selection as paginated collection reads."""

import csv
import io
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.custom_field import CustomField
from app.models.list import BookmarkList
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.schemas.video import (
    VideoFilterRequest,
)
from app.services.video_query_service import build_video_selection


async def build_csv_export(
    db: AsyncSession, list_id: UUID, filters: VideoFilterRequest | None = None
) -> str:
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
        await build_video_selection(db, list_id, filters or VideoFilterRequest())
    ).options(selectinload(Video.field_values))
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

    return csv_content
