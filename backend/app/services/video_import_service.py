"""CSV persistence and field updates. The caller owns the transaction."""

import logging
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.field_validation import FieldValidationError, validate_field_value
from app.models.custom_field import CustomField
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.schemas.video import BulkUploadFailure
from app.schemas.video_field_value import BatchUpdateFieldValuesRequest

logger = logging.getLogger(__name__)


async def process_field_values(
    db: AsyncSession,
    created_videos: list[Video],
    csv_rows_map: dict[str, list[dict[str, str]]],
    field_columns: dict[str, dict[str, Any]],
    failures: list[BulkUploadFailure],
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
        rows = csv_rows_map.get(video.youtube_id, [])
        for row_data in rows:
            field_updates = []

            for column_name, field_data in field_columns.items():
                raw_value = row_data.get(column_name, "").strip()

                # Skip empty values (not an error, just unset)
                if not raw_value:
                    continue

                # Parse value based on field type
                try:
                    field_type = field_data["field_type"]
                    field_config = field_data["config"]
                    field_id = field_data["id"]
                    field_name = field_data["name"]

                    if field_type == "rating":
                        # Parse as float to support decimal ratings
                        parsed_value = float(raw_value)
                        validate_field_value(parsed_value, field_type, field_config)
                        field_updates.append(
                            FieldValueUpdate(field_id=field_id, value=parsed_value)
                        )

                    elif field_type == "select":
                        # Validate against options list (case-sensitive in validation)
                        validate_field_value(raw_value, field_type, field_config)
                        field_updates.append(
                            FieldValueUpdate(field_id=field_id, value=raw_value)
                        )

                    elif field_type == "text":
                        # Validate max_length if configured
                        validate_field_value(raw_value, field_type, field_config)
                        field_updates.append(
                            FieldValueUpdate(field_id=field_id, value=raw_value)
                        )

                    elif field_type == "boolean":
                        # Parse "true"/"false"/"1"/"0" (case-insensitive)
                        lower_value = raw_value.lower()
                        if lower_value in ("true", "1", "yes"):
                            parsed_value = True
                        elif lower_value in ("false", "0", "no", ""):
                            parsed_value = False
                        else:
                            raise ValueError(
                                f"Invalid boolean value: '{raw_value}'. Use 'true'/'false' or '1'/'0'."
                            )
                        field_updates.append(
                            FieldValueUpdate(field_id=field_id, value=parsed_value)
                        )

                except (ValueError, FieldValidationError) as e:
                    # Log validation error but continue processing
                    logger.warning(
                        f"Field validation error for video {video.youtube_id}, field '{field_name}': {e}"
                    )

            # Apply field updates via batch update helper
            if field_updates:
                try:
                    # Create batch update request
                    update_request = BatchUpdateFieldValuesRequest(
                        field_values=field_updates
                    )

                    # Call batch update logic directly (avoid HTTP overhead)
                    await _apply_field_values_batch(db, video.id, update_request)

                    logger.info(
                        f"Applied {len(field_updates)} field values for video {video.youtube_id}"
                    )

                except (
                    ValueError,
                    KeyError,
                    FieldValidationError,
                    SQLAlchemyError,
                ) as e:
                    # ValueError: Invalid data/parsing errors
                    # KeyError: Missing keys in data structures
                    # FieldValidationError: Field validation errors
                    # SQLAlchemyError: Database errors (includes IntegrityError)

                    # Log error with stack trace but don't fail video creation
                    logger.exception(
                        f"Failed to apply field values for video {video.youtube_id}"
                    )
                    failures.append(
                        BulkUploadFailure(
                            row=0,  # Row number not easily tracked here
                            url=f"https://youtube.com/watch?v={video.youtube_id}",
                            error=f"Video created, but field values failed: {e!s}",
                        )
                    )


async def _apply_field_values_batch(
    db: AsyncSession, video_id: UUID, request: BatchUpdateFieldValuesRequest
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
            detail=f"Invalid field_id(s): {invalid_field_ids}",
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

        if field.field_type == "rating":
            value_numeric = update.value
        elif field.field_type in ("select", "text"):
            value_text = update.value
        elif field.field_type == "boolean":
            value_boolean = update.value

        upsert_data.append(
            {
                "video_id": video_id,
                "field_id": update.field_id,
                "value_text": value_text,
                "value_numeric": value_numeric,
                "value_boolean": value_boolean,
            }
        )

    # Step 4: Execute PostgreSQL UPSERT
    stmt = pg_insert(VideoFieldValue).values(upsert_data)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_video_field_values_video_field",
        set_={
            "value_text": stmt.excluded.value_text,
            "value_numeric": stmt.excluded.value_numeric,
            "value_boolean": stmt.excluded.value_boolean,
            "updated_at": func.now(),
        },
    )

    await db.execute(stmt)
    # Note: No commit here - caller handles transaction


async def persist_csv_videos(
    db: AsyncSession, candidates: list[Video]
) -> tuple[list[Video], list[Video]]:
    created_videos: list[Video] = []
    existing_videos = []
    for candidate in candidates:
        values = {
            column.name: getattr(candidate, column.name)
            for column in Video.__table__.columns
            if getattr(candidate, column.name) is not None
        }
        statement = (
            pg_insert(Video)
            .values(**values)
            .on_conflict_do_nothing(index_elements=["list_id", "youtube_id"])
            .returning(Video)
        )
        inserted = (await db.execute(statement)).scalar_one_or_none()
        if inserted is not None:
            created_videos.append(inserted)
        else:
            existing_video = (
                await db.execute(
                    select(Video).where(
                        Video.list_id == candidate.list_id,
                        Video.youtube_id == candidate.youtube_id,
                    )
                )
            ).scalar_one()
            existing_videos.append(existing_video)
    # The only tolerated conflict is the list/YouTube unique key.
    # All other database failures propagate and roll back the request.

    return created_videos, existing_videos
