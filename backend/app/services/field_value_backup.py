"""Service for backing up and restoring video field values."""

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.field_validation import validate_field_value
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.tag import Tag
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue

logger = logging.getLogger(__name__)

# Use absolute path relative to backend directory to ensure consistent location
# regardless of working directory when server starts
_BACKEND_DIR = Path(__file__).parent.parent.parent
BACKUP_DIR = _BACKEND_DIR / "backups" / "field_values"


@dataclass
class BackupInfo:
    """Information about a backup file."""

    category_id: UUID
    category_name: str
    timestamp: datetime
    value_count: int


def _serialize_field_value(value: VideoFieldValue) -> dict[str, Any]:
    """Serialize a VideoFieldValue to a dict for JSON backup."""
    return {
        "field_id": str(value.field_id),
        "field_name": value.field.name if value.field else None,
        "field_type": value.field.field_type if value.field else None,
        "value_numeric": float(value.value_numeric)
        if value.value_numeric is not None
        else None,
        "value_text": value.value_text,
        "value_boolean": value.value_boolean,
    }


async def backup_field_values(
    video_id: UUID, category_id: UUID, db: AsyncSession
) -> Path | None:
    """
    Backup field values for video's category.

    Args:
        video_id: The video's UUID
        category_id: The category's (tag with is_video_type=true) UUID
        db: Async database session

    Returns:
        Path to the backup file, or None if no values to backup
    """
    # Step 2.2: Get category with schema
    # Use select() instead of db.get() to ensure eager loading works
    # (db.get() can return cached object without the eager load)
    stmt = select(Tag).where(Tag.id == category_id).options(selectinload(Tag.schema))
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()

    if not category or not category.schema:
        return None

    # Step 2.3: Get field IDs from schema
    # Use select() instead of db.get() to ensure eager loading works
    from app.models.field_schema import FieldSchema

    schema_stmt = (
        select(FieldSchema)
        .where(FieldSchema.id == category.schema.id)
        .options(selectinload(FieldSchema.schema_fields))
    )
    schema_result = await db.execute(schema_stmt)
    schema_with_fields = schema_result.scalar_one_or_none()

    if not schema_with_fields or not schema_with_fields.schema_fields:
        return None

    field_ids = [sf.field_id for sf in schema_with_fields.schema_fields]

    # Query field values for this video and these fields
    values_stmt = (
        select(VideoFieldValue)
        .where(
            VideoFieldValue.video_id == video_id,
            VideoFieldValue.field_id.in_(field_ids),
        )
        .options(selectinload(VideoFieldValue.field))
    )

    values_result = await db.execute(values_stmt)
    values = values_result.scalars().all()

    # Step 2.4: Return None if no values to backup
    if not values:
        return None

    # Build backup data
    backup_data = {
        "video_id": str(video_id),
        "category_id": str(category_id),
        "category_name": category.name,
        "timestamp": datetime.now(UTC).isoformat(),
        "values": [_serialize_field_value(v) for v in values],
    }

    # Write to file
    backup_path = BACKUP_DIR / str(video_id) / f"{category_id}.json"
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    backup_path.write_text(json.dumps(backup_data, indent=2))

    logger.info(
        f"Backed up {len(values)} field values for video {video_id}, category {category.name}"
    )
    return backup_path


async def restore_field_values(
    video_id: UUID, category_id: UUID, db: AsyncSession
) -> int:
    """
    Restore field values from backup.

    Args:
        video_id: The video's UUID
        category_id: The category's UUID
        db: Async database session

    Returns:
        Number of values restored

    Raises:
        Exception: If a database write fails; the caller rolls back the switch.
    """
    backup_path = BACKUP_DIR / str(video_id) / f"{category_id}.json"

    if not backup_path.exists():
        return 0

    try:
        backup_data = json.loads(backup_path.read_text())
    except json.JSONDecodeError as e:
        logger.error(f"Corrupted backup file {backup_path}: {e}")
        return 0

    # Old backups can contain removed fields. Restore only the current category's
    # schema fields in the video's list, subject to the normal ownership scope.
    fields_result = await db.execute(
        select(CustomField)
        .join(SchemaField, SchemaField.field_id == CustomField.id)
        .join(FieldSchema, FieldSchema.id == SchemaField.schema_id)
        .join(Tag, Tag.schema_id == FieldSchema.id)
        .join(Video, Video.list_id == CustomField.list_id)
        .where(
            Video.id == video_id,
            Tag.id == category_id,
            Tag.is_video_type == True,
            FieldSchema.list_id == Video.list_id,
        )
    )
    fields = {field.id: field for field in fields_result.scalars().all()}
    restored_count = 0
    for value_data in backup_data.get("values", []):
        try:
            field = fields.get(UUID(value_data["field_id"]))
            if field is None:
                continue
            column = {
                "rating": "value_numeric",
                "text": "value_text",
                "select": "value_text",
                "boolean": "value_boolean",
            }[field.field_type]
            value = value_data.get(column)
            if value is None:
                continue
            validate_field_value(
                value, field.field_type, field.config or {}, field.name
            )
        except (ValueError, TypeError, KeyError) as error:
            logger.warning("Skipping incompatible backed-up field: %s", error)
            continue
        values = {
            "value_numeric": None,
            "value_text": None,
            "value_boolean": None,
            column: value,
        }
        statement = (
            pg_insert(VideoFieldValue)
            .values(video_id=video_id, field_id=field.id, **values)
            .on_conflict_do_update(
                index_elements=[VideoFieldValue.video_id, VideoFieldValue.field_id],
                set_={**values, "updated_at": func.now()},
            )
        )
        await db.execute(statement)
        restored_count += 1
    # The category endpoint owns the transaction; never commit a partial switch.
    return restored_count


def list_backups(video_id: UUID) -> list[BackupInfo]:
    """
    List all backups for a video.

    Args:
        video_id: The video's UUID

    Returns:
        List of BackupInfo objects
    """
    backup_dir = BACKUP_DIR / str(video_id)
    if not backup_dir.exists():
        return []

    backups = []
    for file in backup_dir.glob("*.json"):
        try:
            data = json.loads(file.read_text())
            backups.append(
                BackupInfo(
                    category_id=UUID(data["category_id"]),
                    category_name=data.get("category_name", "Unknown"),
                    timestamp=datetime.fromisoformat(data["timestamp"]),
                    value_count=len(data.get("values", [])),
                )
            )
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Invalid backup file {file}: {e}")
            continue

    return backups
