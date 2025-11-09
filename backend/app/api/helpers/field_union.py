"""
Field Union Helper Module for Multi-Tag Field Resolution.

This module provides utilities for computing the union of custom fields
across multiple schemas, with intelligent conflict resolution when field
names collide with different types.

Algorithm Overview:
- Two-Pass Conflict Detection: First pass detects name conflicts (same name,
  different types), second pass applies schema prefixes only where needed
- Batch Loading: Single query to load fields for multiple videos
- Lazy Evaluation: No database queries until explicitly requested

Usage:
    # For detail endpoint (single video with all fields)
    available_fields = await get_available_fields_for_video(video, db)

    # For list endpoint (batch loading for multiple videos)
    fields_by_video = await get_available_fields_for_videos(videos, db)

Related:
- Task #71: Video Field Values CRUD implementation
- Task #74: Multi-Tag Field Union Query optimization
"""

from uuid import UUID
from typing import List, Dict, Tuple, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.video import Video
from app.models.schema_field import SchemaField
from app.models.field_schema import FieldSchema
from app.models.custom_field import CustomField


def compute_field_union_with_conflicts(
    schema_ids: List[UUID],
    fields_by_schema: Dict[UUID, List[Tuple[SchemaField, str]]]
) -> List[Tuple[CustomField, str | None, int, bool]]:
    """
    Compute union of fields from multiple schemas with conflict resolution.

    REF MCP Improvement #4: Two-pass algorithm correctly handles all edge cases.

    Algorithm:
    Pass 1: Detect conflicts (same name, different types)
    Pass 2: Build registry with appropriate schema prefixes

    Args:
        schema_ids: List of schema UUIDs to compute union for
        fields_by_schema: Pre-loaded mapping of schema_id -> [(SchemaField, schema_name)]

    Returns:
        List of (field, schema_name_or_none, display_order, show_on_card) tuples,
        sorted by display_order. schema_name is only populated for conflicting fields.

    Example:
        Schema A has "Rating" (rating type)
        Schema B has "Rating" (text type)
        Result: [
            (field_a, "Schema A", 1, True),  # Conflict detected → prefixed
            (field_b, "Schema B", 2, False)  # Conflict detected → prefixed
        ]

        Schema A has "Rating" (rating type)
        Schema B has "Notes" (text type)
        Result: [
            (field_a, None, 1, True),   # No conflict → no prefix
            (field_b, None, 2, False)   # No conflict → no prefix
        ]
    """

    # PASS 1: Detect conflicts
    # Build mapping: field_name_lower → set of field_types
    field_types_by_name: Dict[str, Set[str]] = {}

    for schema_id in schema_ids:
        if schema_id not in fields_by_schema:
            continue

        for schema_field, schema_name in fields_by_schema[schema_id]:
            field = schema_field.field
            field_key = field.name.lower()

            if field_key not in field_types_by_name:
                field_types_by_name[field_key] = set()
            field_types_by_name[field_key].add(field.field_type)

    # Identify conflicting field names (multiple types)
    conflicting_names = {
        name for name, types in field_types_by_name.items()
        if len(types) > 1
    }

    # PASS 2: Build registry with conflict resolution
    field_registry: Dict[str, Dict] = {}

    for schema_id in schema_ids:
        if schema_id not in fields_by_schema:
            continue

        for schema_field, schema_name in fields_by_schema[schema_id]:
            field = schema_field.field
            field_key = field.name.lower()
            is_conflicting = field_key in conflicting_names

            if is_conflicting:
                # This field name has type conflicts → use schema prefix
                registry_key = f"{schema_name}:{field.name}".lower()
            else:
                # No conflict → use original name
                registry_key = field_key

            if registry_key in field_registry:
                # Already have this exact field (same name, same type, same schema)
                # This can happen if a field appears multiple times
                # Skip duplicates (first wins)
                continue

            # Add to registry
            field_registry[registry_key] = {
                'field': field,
                'schema_name': schema_name if is_conflicting else None,
                'display_order': schema_field.display_order,
                'show_on_card': schema_field.show_on_card
            }

    # Build result list
    result = []
    for entry in field_registry.values():
        result.append((
            entry['field'],
            entry['schema_name'],
            entry['display_order'],
            entry['show_on_card']
        ))

    # Sort by display_order (preserve schema ordering)
    result.sort(key=lambda x: x[2])

    return result


async def get_available_fields_for_videos(
    videos: List[Video],
    db: AsyncSession
) -> Dict[UUID, List[Tuple[CustomField, str | None, int, bool]]]:
    """
    Batch-load applicable fields for ALL videos in a single query.

    REF MCP Improvement #1: Single query for all videos (not N queries).
    REF MCP Improvement #2: Nested selectinload prevents MissingGreenlet.
    REF MCP Improvement #4: Conflict resolution handles 3+ tag edge cases.

    This function efficiently loads all custom fields that are applicable to
    a list of videos based on their tags' schemas. It:
    1. Collects all unique schema IDs from all videos
    2. Loads all SchemaFields for those schemas in one query
    3. Computes the field union for each video with conflict resolution

    Args:
        videos: List of Video objects with pre-loaded tags relationship
        db: Async database session

    Returns:
        Dict mapping video_id → list of (field, schema_name_or_none, display_order, show_on_card)

    Example:
        videos = [video1, video2, video3]
        fields_by_video = await get_available_fields_for_videos(videos, db)

        # fields_by_video = {
        #     video1.id: [(field_a, None, 1, True), (field_b, "Schema B", 2, False)],
        #     video2.id: [(field_c, None, 1, True)],
        #     video3.id: []
        # }

    Performance:
        - Single query for all schemas (O(1) queries vs O(N) per video)
        - Conflict resolution is pure logic (no additional queries)
        - Scales efficiently with number of videos and schemas
    """
    # Step 1: Collect ALL unique schema_ids from ALL videos
    all_schema_ids: Set[UUID] = set()
    video_schemas: Dict[UUID, List[UUID]] = {}  # video_id → [schema_ids]

    for video in videos:
        # Handle case where tags relationship might not be loaded or is None
        tags = video.tags if video.tags is not None else []
        schema_ids = [tag.schema_id for tag in tags if tag.schema_id is not None]
        if schema_ids:
            video_schemas[video.id] = schema_ids
            all_schema_ids.update(schema_ids)

    if not all_schema_ids:
        # No schemas → no fields for any video
        return {video.id: [] for video in videos}

    # Step 2: Batch-load ALL SchemaFields for ALL schemas in ONE query
    # ✅ REF #1: Single query instead of N queries
    # ✅ REF #2: Nested selectinload prevents MissingGreenlet
    stmt = (
        select(SchemaField, FieldSchema.name)
        .join(SchemaField.schema)  # Join to get schema name
        .options(
            selectinload(SchemaField.field)  # Eager load CustomField
            # Note: If CustomField has relationships (e.g., to list), add:
            # .selectinload(CustomField.list)  # Prevent nested MissingGreenlet
        )
        .where(SchemaField.schema_id.in_(all_schema_ids))
        .order_by(SchemaField.display_order)  # Preserve display order
    )

    result = await db.execute(stmt)
    all_schema_fields = result.all()  # List of (SchemaField, schema_name) tuples

    # Step 3: Group SchemaFields by schema_id
    fields_by_schema: Dict[UUID, List[Tuple[SchemaField, str]]] = {}
    for schema_field, schema_name in all_schema_fields:
        if schema_field.schema_id not in fields_by_schema:
            fields_by_schema[schema_field.schema_id] = []
        fields_by_schema[schema_field.schema_id].append((schema_field, schema_name))

    # Step 4: Compute applicable fields for each video (pure logic, no DB access)
    result_by_video: Dict[UUID, List[Tuple[CustomField, str | None, int, bool]]] = {}

    for video in videos:
        if video.id not in video_schemas:
            # Video has no schemas → empty list
            result_by_video[video.id] = []
            continue

        schema_ids = video_schemas[video.id]
        applicable_fields = compute_field_union_with_conflicts(
            schema_ids, fields_by_schema
        )
        result_by_video[video.id] = applicable_fields

    return result_by_video


async def get_available_fields_for_video(
    video: Video,
    db: AsyncSession
) -> List[Tuple[CustomField, str | None, int, bool]]:
    """
    Single-video wrapper for get_available_fields_for_videos().

    This is a convenience function that wraps the batch loading function
    for the common case of loading fields for a single video. Internally,
    it calls the batch function to maintain consistency.

    Args:
        video: Video object with pre-loaded tags relationship
        db: Async database session

    Returns:
        List of (field, schema_name_or_none, display_order, show_on_card) tuples

    Example:
        video = await db.get(Video, video_id, options=[selectinload(Video.tags)])
        available_fields = await get_available_fields_for_video(video, db)

        # available_fields = [
        #     (field_a, None, 1, True),        # No conflict
        #     (field_b, "Schema B", 2, False)  # Conflict → prefixed
        # ]
    """
    result = await get_available_fields_for_videos([video], db)
    return result.get(video.id, [])
