"""Service for aggregating available fields for videos."""
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.list import BookmarkList
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField

if TYPE_CHECKING:
    from app.models.video import Video


async def get_available_fields(
    video: "Video",
    db: AsyncSession
) -> list[CustomField]:
    """
    Get all fields available for this video.

    Aggregates fields from:
    1. Workspace (list's default_schema) - applies to ALL videos
    2. Category (video's category tag schema) - applies to videos with this category

    Fields are deduplicated by field_id (same field in both schemas appears once).

    Args:
        video: The Video object (should have tags loaded)
        db: Async database session

    Returns:
        List of CustomField objects available for this video
    """
    field_ids: set = set()
    fields: list[CustomField] = []

    # Step 2.10: Get workspace (default schema) fields
    # Load BookmarkList with nested eager loading to avoid redundant queries
    bookmark_list = await db.get(
        BookmarkList,
        video.list_id,
        options=[
            selectinload(BookmarkList.default_schema)
            .selectinload(FieldSchema.schema_fields)
            .selectinload(SchemaField.field)
        ]
    )

    if bookmark_list and bookmark_list.default_schema:
        for sf in bookmark_list.default_schema.schema_fields:
            if sf.field_id not in field_ids and sf.field is not None:
                field_ids.add(sf.field_id)
                fields.append(sf.field)

    # Step 2.11: Get category fields
    # Find the video's category (tag with is_video_type=True)
    category = next((t for t in video.tags if t.is_video_type), None)

    if category and category.schema:
        for sf in category.schema.schema_fields:
            if sf.field_id not in field_ids and sf.field is not None:  # Deduplicate + null check
                field_ids.add(sf.field_id)
                fields.append(sf.field)

    return fields
