"""
API endpoints for Field Schema management.

Field schemas are collections of custom fields that can be bound to tags,
enabling reusable evaluation templates. This module handles CRUD operations
for schemas (not schema-fields management, which is Task #69).

Endpoints:
- GET    /api/lists/{list_id}/schemas                  - List all schemas
- POST   /api/lists/{list_id}/schemas                  - Create new schema
- GET    /api/lists/{list_id}/schemas/{schema_id}      - Get single schema
- PUT    /api/lists/{list_id}/schemas/{schema_id}      - Update schema metadata
- DELETE /api/lists/{list_id}/schemas/{schema_id}      - Delete schema (checks tag usage)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.core.database import get_db
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.custom_field import CustomField
from app.models.tag import Tag
from app.models.list import BookmarkList
from app.schemas.field_schema import (
    FieldSchemaCreate,
    FieldSchemaUpdate,
    FieldSchemaResponse,
)

router = APIRouter()


@router.get(
    "/api/lists/{list_id}/schemas",
    response_model=list[FieldSchemaResponse],
    tags=["schemas"]
)
async def list_schemas(
    list_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    List all field schemas for a list.

    Returns all schemas with their associated fields (eager loaded).
    Results ordered by schema name.

    Args:
        list_id: UUID of the parent list
        db: Database session (injected)

    Returns:
        List of FieldSchemaResponse objects with nested schema_fields

    Example Response:
        [
            {
                "id": "schema-uuid",
                "list_id": "list-uuid",
                "name": "Video Quality",
                "description": "Standard quality metrics",
                "schema_fields": [
                    {
                        "field_id": "field-uuid",
                        "schema_id": "schema-uuid",
                        "display_order": 0,
                        "show_on_card": true,
                        "field": {
                            "id": "field-uuid",
                            "name": "Presentation",
                            "field_type": "select",
                            ...
                        }
                    }
                ],
                "created_at": "...",
                "updated_at": "..."
            }
        ]
    """
    # Verify list exists
    list_result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Query schemas with eager loading of schema_fields and their related fields
    # REF MCP: selectinload() emits separate SELECT with IN clause for efficiency
    # (avoids N+1 queries and more efficient than joinedload for one-to-many)
    stmt = (
        select(FieldSchema)
        .where(FieldSchema.list_id == list_id)
        .options(
            selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
        )
        .order_by(FieldSchema.name)
    )

    result = await db.execute(stmt)
    schemas = result.scalars().all()

    return list(schemas)


@router.get(
    "/api/lists/{list_id}/schemas/{schema_id}",
    response_model=FieldSchemaResponse,
    tags=["schemas"]
)
async def get_schema(
    list_id: UUID,
    schema_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single field schema by ID.

    Returns schema with associated fields (eager loaded).

    Args:
        list_id: UUID of the parent list
        schema_id: UUID of the schema to retrieve
        db: Database session (injected)

    Returns:
        FieldSchemaResponse with nested schema_fields

    Raises:
        HTTPException 404: Schema not found or belongs to different list
    """
    # Query schema with list verification and eager load relationships
    stmt = (
        select(FieldSchema)
        .where(
            FieldSchema.id == schema_id,
            FieldSchema.list_id == list_id
        )
        .options(
            selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
        )
    )
    result = await db.execute(stmt)
    schema = result.scalar_one_or_none()

    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schema with id {schema_id} not found in list {list_id}"
        )

    return schema


@router.post(
    "/api/lists/{list_id}/schemas",
    response_model=FieldSchemaResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["schemas"]
)
async def create_schema(
    list_id: UUID,
    schema_data: FieldSchemaCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new field schema.

    Optionally creates SchemaField associations if fields array provided.
    All field_ids must exist in the same list as the schema.

    Args:
        list_id: UUID of the parent list
        schema_data: Schema creation data (name, description, optional fields)
        db: Database session (injected)

    Returns:
        Created FieldSchemaResponse with nested schema_fields

    Raises:
        HTTPException 404: List not found
        HTTPException 400: One or more field_ids invalid or belong to different list

    Example Request:
        {
            "name": "Video Quality",
            "description": "Standard metrics",
            "fields": [
                {
                    "field_id": "uuid-1",
                    "display_order": 0,
                    "show_on_card": true
                }
            ]
        }
    """
    # Verify list exists
    list_result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # If fields provided, validate all field_ids exist in same list
    if schema_data.fields:
        field_ids = [f.field_id for f in schema_data.fields]

        # Check for duplicate field_ids in request
        if len(field_ids) != len(set(field_ids)):
            duplicates = [fid for fid in field_ids if field_ids.count(fid) > 1]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate field_ids in request: {set(duplicates)}"
            )

        # Query only field IDs (not full objects) for efficiency
        stmt = select(CustomField.id).where(
            CustomField.id.in_(field_ids),
            CustomField.list_id == list_id
        )
        result = await db.execute(stmt)
        existing_field_ids = set(result.scalars().all())

        # Check if all fields found
        if len(existing_field_ids) != len(field_ids):
            missing_ids = set(field_ids) - existing_field_ids
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid field_ids: {missing_ids}. Fields must exist in the same list."
            )

    # Create schema
    new_schema = FieldSchema(
        list_id=list_id,
        name=schema_data.name,
        description=schema_data.description
    )
    db.add(new_schema)
    await db.flush()  # Get schema.id for SchemaField creation

    # Create SchemaField associations if fields provided
    if schema_data.fields:
        for field_input in schema_data.fields:
            schema_field = SchemaField(
                schema_id=new_schema.id,
                field_id=field_input.field_id,
                display_order=field_input.display_order,
                show_on_card=field_input.show_on_card
            )
            db.add(schema_field)

    await db.commit()

    # Reload with relationships for response
    stmt = (
        select(FieldSchema)
        .where(FieldSchema.id == new_schema.id)
        .options(
            selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
        )
    )
    result = await db.execute(stmt)
    created_schema = result.scalar_one()

    return created_schema


@router.put(
    "/api/lists/{list_id}/schemas/{schema_id}",
    response_model=FieldSchemaResponse,
    tags=["schemas"]
)
async def update_schema(
    list_id: UUID,
    schema_id: UUID,
    schema_update: FieldSchemaUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update field schema metadata (name and/or description).

    Only updates schema metadata. Field management (adding/removing fields
    from schema) is handled by separate endpoints in Task #69.

    Args:
        list_id: UUID of the parent list
        schema_id: UUID of the schema to update
        schema_update: Update data (name, description - both optional)
        db: Database session (injected)

    Returns:
        Updated FieldSchemaResponse

    Raises:
        HTTPException 404: Schema not found or belongs to different list

    Example Request:
        {"name": "Updated Video Quality"}
    """
    # Query schema with list verification
    stmt = (
        select(FieldSchema)
        .where(
            FieldSchema.id == schema_id,
            FieldSchema.list_id == list_id
        )
        .options(
            selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
        )
    )
    result = await db.execute(stmt)
    schema = result.scalar_one_or_none()

    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schema with id {schema_id} not found in list {list_id}"
        )

    # Update fields (only if provided)
    if schema_update.name is not None:
        schema.name = schema_update.name
    if schema_update.description is not None:
        schema.description = schema_update.description

    await db.commit()

    # Re-query with eager loading to avoid MissingGreenlet error in Pydantic serialization
    # (db.refresh() doesn't preserve eager-loaded relationships after commit)
    stmt = (
        select(FieldSchema)
        .where(FieldSchema.id == schema_id)
        .options(
            selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
        )
    )
    result = await db.execute(stmt)
    schema = result.scalar_one()

    return schema


@router.delete(
    "/api/lists/{list_id}/schemas/{schema_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["schemas"]
)
async def delete_schema(
    list_id: UUID,
    schema_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a field schema.

    Before deletion, checks if the schema is currently used by any tags.
    If used, returns 409 Conflict with tag count. User must unbind schema
    from tags before deletion (or implement force delete in future).

    If schema is deleted, SchemaField associations are CASCADE deleted
    automatically by the database (via ON DELETE CASCADE).

    Args:
        list_id: UUID of the parent list
        schema_id: UUID of the schema to delete
        db: Database session (injected)

    Returns:
        None (204 No Content on success)

    Raises:
        HTTPException 404: Schema not found or belongs to different list
        HTTPException 409: Schema is used by one or more tags

    Edge Case Handling:
        - Design doc line 528-530: ON DELETE SET NULL on tags.schema_id
          would allow deletion, but we prevent it here to avoid data loss
        - User must explicitly unbind schema from tags first
        - Future enhancement: Add ?force=true query param to allow deletion
    """
    # Query schema with list verification
    stmt = select(FieldSchema).where(
        FieldSchema.id == schema_id,
        FieldSchema.list_id == list_id
    )
    result = await db.execute(stmt)
    schema = result.scalar_one_or_none()

    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schema with id {schema_id} not found in list {list_id}"
        )

    # Count tags using this schema
    # REF MCP: Using scalar subquery for efficient count without loading objects
    tag_count_stmt = select(func.count(Tag.id)).where(Tag.schema_id == schema_id)
    tag_count_result = await db.execute(tag_count_stmt)
    tag_count = tag_count_result.scalar()

    if tag_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete schema '{schema.name}': "
                f"it is currently used by {tag_count} tag(s). "
                f"Please unbind the schema from all tags before deletion."
            )
        )

    # Delete schema (CASCADE to schema_fields handled by DB)
    await db.delete(schema)
    await db.commit()

    return None
