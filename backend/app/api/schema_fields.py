from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.core.database import get_db
from app.models.schema_field import SchemaField
from app.models.field_schema import FieldSchema
from app.models.custom_field import CustomField
from app.schemas.schema_field import (
    SchemaFieldCreate,
    SchemaFieldUpdate,
    SchemaFieldResponse
)
from app.schemas.field_schema import (
    SchemaFieldUpdateItem,
    SchemaFieldBatchUpdateRequest,
    SchemaFieldBatchUpdateResponse
)

router = APIRouter(
    prefix="/api/lists/{list_id}/schemas/{schema_id}/fields",
    tags=["schema-fields"]
)


async def validate_max_show_on_card(
    db: AsyncSession,
    schema_id: UUID,
    exclude_field_id: UUID | None = None
) -> None:
    """
    Validate that schema has at most 3 fields with show_on_card=true.

    Args:
        db: Database session
        schema_id: Schema to check
        exclude_field_id: Field ID to exclude from count (for UPDATE operations)

    Raises:
        HTTPException(409): If adding/updating would exceed limit
    """
    stmt = select(func.count()).select_from(SchemaField).where(
        SchemaField.schema_id == schema_id,
        SchemaField.show_on_card == True
    )

    # Exclude current field from count when updating
    if exclude_field_id is not None:
        stmt = stmt.where(SchemaField.field_id != exclude_field_id)

    result = await db.execute(stmt)
    count = result.scalar()

    if count >= 3:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Maximum 3 fields can be shown on card per schema"
        )


@router.get("", response_model=list[SchemaFieldResponse])
async def get_schema_fields(
    list_id: UUID,
    schema_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all fields in a schema, ordered by display_order.

    Returns full CustomField details along with SchemaField metadata
    (display_order, show_on_card).
    """
    # Verify schema exists and belongs to list
    schema_stmt = select(FieldSchema).where(
        FieldSchema.id == schema_id,
        FieldSchema.list_id == list_id
    )
    schema_result = await db.execute(schema_stmt)
    schema = schema_result.scalar_one_or_none()

    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found or does not belong to this list"
        )

    # Query SchemaField with eager loading of CustomField
    stmt = (
        select(SchemaField)
        .where(SchemaField.schema_id == schema_id)
        .options(selectinload(SchemaField.field))  # Eager load CustomField
        .order_by(SchemaField.display_order)
    )
    result = await db.execute(stmt)
    schema_fields = result.scalars().all()

    return schema_fields


@router.post("", response_model=SchemaFieldResponse, status_code=status.HTTP_201_CREATED)
async def add_field_to_schema(
    list_id: UUID,
    schema_id: UUID,
    schema_field: SchemaFieldCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Add a field to a schema.

    Validates:
    - Schema exists and belongs to list
    - Field exists and belongs to same list
    - Field not already in schema (409 Conflict)
    - Max 3 show_on_card constraint (409 Conflict)
    """
    # Verify schema exists and belongs to list
    schema_stmt = select(FieldSchema).where(
        FieldSchema.id == schema_id,
        FieldSchema.list_id == list_id
    )
    schema_result = await db.execute(schema_stmt)
    schema = schema_result.scalar_one_or_none()

    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found or does not belong to this list"
        )

    # Verify field exists and belongs to same list (security!)
    field_stmt = select(CustomField).where(
        CustomField.id == schema_field.field_id,
        CustomField.list_id == list_id
    )
    field_result = await db.execute(field_stmt)
    field = field_result.scalar_one_or_none()

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found or does not belong to this list"
        )

    # Check for duplicate (composite PK prevents it, but return friendly error)
    duplicate_stmt = select(SchemaField).where(
        SchemaField.schema_id == schema_id,
        SchemaField.field_id == schema_field.field_id
    )
    duplicate_result = await db.execute(duplicate_stmt)
    existing = duplicate_result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Field already added to this schema"
        )

    # Validate max 3 show_on_card constraint
    if schema_field.show_on_card:
        await validate_max_show_on_card(db, schema_id)

    # Auto-calculate display_order if not provided (append to end)
    display_order = schema_field.display_order
    if display_order is None:
        max_order_stmt = select(func.max(SchemaField.display_order)).where(
            SchemaField.schema_id == schema_id
        )
        max_result = await db.execute(max_order_stmt)
        max_order = max_result.scalar()
        display_order = (max_order + 1) if max_order is not None else 0

    # Create SchemaField entry
    new_schema_field = SchemaField(
        schema_id=schema_id,
        field_id=schema_field.field_id,
        display_order=display_order,
        show_on_card=schema_field.show_on_card
    )
    db.add(new_schema_field)
    await db.commit()

    # Re-query with eager loading (refresh() doesn't work reliably for relationships)
    stmt = (
        select(SchemaField)
        .where(
            SchemaField.schema_id == schema_id,
            SchemaField.field_id == schema_field.field_id
        )
        .options(selectinload(SchemaField.field))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.put("/batch", response_model=SchemaFieldBatchUpdateResponse)
async def batch_update_schema_fields(
    list_id: UUID,
    schema_id: UUID,
    request: SchemaFieldBatchUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Batch update schema_fields (display_order + show_on_card).

    Updates multiple schema field associations in a single atomic operation.
    Useful for drag-and-drop reordering in the frontend.

    Validates:
    - Schema exists and belongs to list
    - All field_ids exist and belong to same list as schema
    - Max 3 fields with show_on_card=true (validated in Pydantic schema)
    - display_order values are unique (validated in Pydantic schema)
    - Batch size: 1-50 items (validated in Pydantic schema)

    Uses PostgreSQL UPSERT pattern (ON CONFLICT DO UPDATE) to create
    missing associations or update existing ones.

    Returns:
        SchemaFieldBatchUpdateResponse with updated_count and complete
        updated schema_fields list with nested field data.
    """
    # Verify schema exists and belongs to list
    schema_stmt = select(FieldSchema).where(
        FieldSchema.id == schema_id,
        FieldSchema.list_id == list_id
    )
    schema_result = await db.execute(schema_stmt)
    schema = schema_result.scalar_one_or_none()

    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found or does not belong to this list"
        )

    # Extract field_ids from request
    field_ids = [item.field_id for item in request.fields]

    # Verify all fields exist and belong to same list (security check)
    fields_stmt = select(CustomField).where(
        CustomField.id.in_(field_ids),
        CustomField.list_id == list_id
    )
    fields_result = await db.execute(fields_stmt)
    existing_fields = fields_result.scalars().all()

    if len(existing_fields) != len(field_ids):
        # Find which field_ids are missing/invalid
        existing_field_ids = {field.id for field in existing_fields}
        missing_field_ids = set(field_ids) - existing_field_ids
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"One or more field_ids not found or belong to different list: {[str(fid)[:8] + '...' for fid in missing_field_ids]}"
        )

    # Validate show_on_card limit INCLUDING existing untouched rows
    # Query existing schema_fields for this schema
    existing_schema_fields_stmt = select(SchemaField).where(
        SchemaField.schema_id == schema_id
    )
    existing_schema_fields_result = await db.execute(existing_schema_fields_stmt)
    existing_schema_fields = existing_schema_fields_result.scalars().all()

    # Build map of existing show_on_card values
    existing_show_on_card = {sf.field_id: sf.show_on_card for sf in existing_schema_fields}

    # Calculate final show_on_card count after batch update
    final_show_on_card = set()
    request_field_ids = {item.field_id for item in request.fields}

    # Include untouched fields that have show_on_card=True
    for field_id, show_on_card in existing_show_on_card.items():
        if field_id not in request_field_ids and show_on_card:
            final_show_on_card.add(field_id)

    # Include fields from request that have show_on_card=True
    for item in request.fields:
        if item.show_on_card:
            final_show_on_card.add(item.field_id)

    if len(final_show_on_card) > 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch update would result in {len(final_show_on_card)} fields with show_on_card=true. "
                   f"Maximum is 3. Please set show_on_card=false for {len(final_show_on_card) - 3} fields."
        )

    # Perform UPSERT for each field (ON CONFLICT DO UPDATE)
    # Using raw SQL to bypass SQLAlchemy ORM issues
    from sqlalchemy import text

    for item in request.fields:
        sql = text("""
            INSERT INTO schema_fields (schema_id, field_id, display_order, show_on_card)
            VALUES (:schema_id, :field_id, :display_order, :show_on_card)
            ON CONFLICT (schema_id, field_id)
            DO UPDATE SET
                display_order = EXCLUDED.display_order,
                show_on_card = EXCLUDED.show_on_card
        """)
        await db.execute(sql, {
            'schema_id': schema_id,
            'field_id': item.field_id,
            'display_order': item.display_order,
            'show_on_card': item.show_on_card
        })

    await db.commit()

    # Expire session cache to force fresh reload from database
    # (raw SQL bypasses ORM, so cached objects are stale)
    db.expire_all()

    # Query updated schema_fields with eager loading
    updated_stmt = (
        select(SchemaField)
        .where(SchemaField.schema_id == schema_id)
        .options(selectinload(SchemaField.field))
        .order_by(SchemaField.display_order)
    )
    updated_result = await db.execute(updated_stmt)
    updated_fields = updated_result.scalars().all()

    return SchemaFieldBatchUpdateResponse(
        updated_count=len(request.fields),
        fields=updated_fields
    )


@router.put("/{field_id}", response_model=SchemaFieldResponse)
async def update_schema_field(
    list_id: UUID,
    schema_id: UUID,
    field_id: UUID,
    schema_field_update: SchemaFieldUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update display_order or show_on_card for a field in a schema.

    Validates max 3 show_on_card constraint when toggling flag on.
    """
    # Verify schema exists and belongs to list
    schema_stmt = select(FieldSchema).where(
        FieldSchema.id == schema_id,
        FieldSchema.list_id == list_id
    )
    schema_result = await db.execute(schema_stmt)
    schema = schema_result.scalar_one_or_none()

    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found or does not belong to this list"
        )

    # Query SchemaField using composite PK
    stmt = select(SchemaField).where(
        SchemaField.schema_id == schema_id,
        SchemaField.field_id == field_id
    )
    result = await db.execute(stmt)
    schema_field = result.scalar_one_or_none()

    if not schema_field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found in this schema"
        )

    # Validate max 3 show_on_card constraint if toggling on
    if schema_field_update.show_on_card is not None:
        if schema_field_update.show_on_card and not schema_field.show_on_card:
            # Toggling from False -> True, check constraint
            await validate_max_show_on_card(db, schema_id, exclude_field_id=field_id)

    # Update fields using exclude_unset pattern (Pydantic v2 best practice)
    update_data = schema_field_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schema_field, field, value)

    await db.commit()

    # Re-query with eager loading (refresh() doesn't work reliably for relationships)
    stmt = (
        select(SchemaField)
        .where(
            SchemaField.schema_id == schema_id,
            SchemaField.field_id == field_id
        )
        .options(selectinload(SchemaField.field))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_field_from_schema(
    list_id: UUID,
    schema_id: UUID,
    field_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a field from a schema.

    IMPORTANT: This only removes the association (SchemaField entry).
    The CustomField itself is NOT deleted and remains reusable.
    """
    # Verify schema exists and belongs to list
    schema_stmt = select(FieldSchema).where(
        FieldSchema.id == schema_id,
        FieldSchema.list_id == list_id
    )
    schema_result = await db.execute(schema_stmt)
    schema = schema_result.scalar_one_or_none()

    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found or does not belong to this list"
        )

    # Query SchemaField using composite PK
    stmt = select(SchemaField).where(
        SchemaField.schema_id == schema_id,
        SchemaField.field_id == field_id
    )
    result = await db.execute(stmt)
    schema_field = result.scalar_one_or_none()

    if not schema_field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found in this schema"
        )

    # Delete SchemaField entry only (CustomField survives)
    await db.delete(schema_field)
    await db.commit()

    return None
