"""Video fields endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.field_validation import FieldValidationError, validate_field_value
from app.core.database import get_db
from app.models.custom_field import CustomField
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.schemas.custom_field import CustomFieldResponse
from app.schemas.video import (
    VideoFieldValueResponse,
)
from app.schemas.video_field_value import (
    BatchUpdateFieldValuesRequest,
    BatchUpdateFieldValuesResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.put("/videos/{video_id}/fields", response_model=BatchUpdateFieldValuesResponse)
async def batch_update_video_field_values(
    video_id: UUID,
    request: BatchUpdateFieldValuesRequest,
    db: AsyncSession = Depends(get_db),
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
            detail=f"Video with id {video_id} not found",
        )

    # === STEP 2: Fetch all CustomFields for validation ===
    # Extract field_ids from request
    field_ids = [update.field_id for update in request.field_values]

    # Query all fields in single query (performance optimization)
    fields_stmt = select(CustomField).where(CustomField.id.in_(field_ids))
    fields_result = await db.execute(fields_stmt)
    fields = {field.id: field for field in fields_result.scalars().all()}

    # Validate all field_ids exist
    invalid_field_ids = [fid for fid in field_ids if fid not in fields]
    if invalid_field_ids:
        invalid_str = ", ".join(str(fid) for fid in invalid_field_ids)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field_id(s): {invalid_str}. These fields do not exist.",
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
                field_name=field.name,
            )
        except FieldValidationError as e:
            validation_errors.append(
                {
                    "field_id": str(update.field_id),
                    "field_name": field.name,
                    "error": str(e),
                }
            )
        except ValueError as e:
            # Unknown field_type
            validation_errors.append(
                {
                    "field_id": str(update.field_id),
                    "field_name": field.name,
                    "error": str(e),
                }
            )

    # If any validation failed, abort before database changes
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Field value validation failed",
                "errors": validation_errors,
            },
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

    # === STEP 5: Execute PostgreSQL UPSERT ===
    # Use ON CONFLICT DO UPDATE for idempotent upsert
    # Constraint name from migration: uq_video_field_values_video_field
    stmt = pg_insert(VideoFieldValue).values(upsert_data)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_video_field_values_video_field",  # From Task #62 migration
        set_={
            "value_text": stmt.excluded.value_text,
            "value_numeric": stmt.excluded.value_numeric,
            "value_boolean": stmt.excluded.value_boolean,
            "updated_at": func.now(),
        },
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
            VideoFieldValue.field_id.in_(field_ids),
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
        if fv.field.field_type == "rating":
            value: float | str | bool | None = fv.value_numeric
        elif fv.field.field_type in ("select", "text"):
            value = fv.value_text
        elif fv.field.field_type == "boolean":
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
                updated_at=fv.updated_at,
            )
        )

    # Build response
    return BatchUpdateFieldValuesResponse(
        updated_count=len(field_values_response), field_values=field_values_response
    )
