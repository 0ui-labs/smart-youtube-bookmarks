# Task #69: Implement Schema-Fields Endpoints

**Plan Task:** #69
**Wave/Phase:** Phase 1 Backend - Custom Fields System
**Dependencies:** Task #60 (FieldSchema model), Task #61 (SchemaField model), Task #59 (CustomField model)

---

## 🎯 Ziel

Implement REST API endpoints for managing the many-to-many relationship between field schemas and custom fields through the `schema_fields` join table. Enable adding/removing fields to schemas, reordering fields (display_order), and toggling the show_on_card flag (max 3 per schema).

## 📋 Acceptance Criteria

- [ ] GET `/api/lists/{list_id}/schemas/{schema_id}/fields` returns ordered fields with full CustomField details
- [ ] POST `/api/lists/{list_id}/schemas/{schema_id}/fields` adds field to schema with validation
- [ ] POST prevents duplicate field in same schema (409 Conflict)
- [ ] POST validates max 3 show_on_card=true per schema (409 Conflict)
- [ ] PUT `/api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}` updates display_order and/or show_on_card
- [ ] PUT validates max 3 show_on_card constraint when toggling flag
- [ ] DELETE `/api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}` removes association only (not CustomField itself)
- [ ] DELETE returns 404 if association doesn't exist
- [ ] All endpoints validate list_id ownership (security)
- [ ] Tests passing (unit + integration)

---

## 🛠️ Implementation Steps

### 1. Create schema_fields.py router with nested routes

**Files:** `backend/app/api/schema_fields.py`

**Action:** Create new router file for schema-fields relationship endpoints. Use nested route structure under `/api/lists/{list_id}/schemas/{schema_id}/fields` to match RESTful hierarchy.

**Rationale:** Separate file keeps routers focused. Nested routes clearly express parent-child resource relationship (schemas contain fields).

```python
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

router = APIRouter(
    prefix="/api/lists/{list_id}/schemas/{schema_id}/fields",
    tags=["schema-fields"]
)
```

**REF MCP Validation:** FastAPI nested routes documentation confirms parent-child path parameters are idiomatic pattern for sub-resources.

### 2. Implement GET /schemas/{schema_id}/fields endpoint

**Files:** `backend/app/api/schema_fields.py`

**Action:** Query SchemaField join table with eager loading of CustomField details, ordered by display_order.

```python
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
```

**REF MCP Validation:** SQLAlchemy 2.0 selectinload() documentation confirms this is the recommended approach for async eager loading of relationships. Returns N+1 query-free results.

### 3. Implement validation helper for max 3 show_on_card constraint

**Files:** `backend/app/api/schema_fields.py`

**Action:** Create reusable function to validate show_on_card constraint before POST/PUT operations.

```python
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
```

**Design Decision:** Helper function ensures consistent validation logic across POST and PUT endpoints. Exclude parameter allows UPDATE to check "would I exceed limit if I toggle this field on?"

### 4. Implement POST /schemas/{schema_id}/fields endpoint

**Files:** `backend/app/api/schema_fields.py`

**Action:** Add field to schema with validation for duplicates, list ownership, and show_on_card constraint.

```python
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
```

**Design Decision:** Auto-calculate display_order as max+1 when not provided. This appends new fields to end of list, allowing user to reorder later with PUT. Security validation ensures field and schema belong to same list.

### 5. Implement PUT /schemas/{schema_id}/fields/{field_id} endpoint

**Files:** `backend/app/api/schema_fields.py`

**Action:** Update display_order and/or show_on_card with validation. Uses composite PK (schema_id, field_id) for query.

```python
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
```

**REF MCP Validation (2025-11-08):** FastAPI body updates documentation confirms using Pydantic's `exclude_unset` pattern for partial updates. All fields optional in SchemaFieldUpdate schema. Using `model_dump(exclude_unset=True)` with setattr() is the Pydantic v2 best practice for partial updates - more maintainable than manual if-checks per field.

### 6. Implement DELETE /schemas/{schema_id}/fields/{field_id} endpoint

**Files:** `backend/app/api/schema_fields.py`

**Action:** Remove field from schema (SchemaField entry only, NOT CustomField itself). Uses composite PK for query.

```python
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
```

**Design Decision:** DELETE removes association only, not the CustomField. This preserves reusability - fields can be removed from one schema and added to another. Clear documentation in docstring.

### 7. Create Pydantic schemas for schema_fields

**Files:** `backend/app/schemas/schema_field.py`

**Action:** Create request/response models for schema_fields endpoints.

```python
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional

from app.schemas.custom_field import CustomFieldResponse


class SchemaFieldCreate(BaseModel):
    """Request body for adding field to schema."""
    field_id: UUID
    display_order: Optional[int] = None  # Auto-calculated if not provided
    show_on_card: bool = False


class SchemaFieldUpdate(BaseModel):
    """Request body for updating schema field association."""
    display_order: Optional[int] = None
    show_on_card: Optional[bool] = None


class SchemaFieldResponse(BaseModel):
    """
    Response model for schema field association.
    
    Includes full CustomField details via nested relationship.
    """
    schema_id: UUID
    field_id: UUID
    display_order: int
    show_on_card: bool
    field: CustomFieldResponse  # Nested CustomField details
    
    class Config:
        from_attributes = True  # SQLAlchemy 2.0 compatibility
```

**Design Decision:** SchemaFieldResponse includes nested `field` with full CustomField details. This avoids N+1 queries on frontend (single GET returns all field metadata).

### 8. Register router in main application

**Files:** `backend/app/main.py`

**Action:** Import and include schema_fields router.

```python
from app.api import lists, videos, tags, processing, websocket, schema_fields

# ...existing code...

app.include_router(schema_fields.router)
```

### 9. Create unit tests

**Files:** `backend/tests/api/test_schema_fields.py`

**Action:** Test all endpoints with edge cases and error conditions.

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField


@pytest.mark.asyncio
async def test_get_schema_fields_ordered(client: AsyncClient, db: AsyncSession, list_id, schema_id, field_ids):
    """Test GET returns fields ordered by display_order."""
    # Add 3 fields with specific order
    field1, field2, field3 = field_ids
    schema_fields = [
        SchemaField(schema_id=schema_id, field_id=field2, display_order=1),
        SchemaField(schema_id=schema_id, field_id=field1, display_order=0),
        SchemaField(schema_id=schema_id, field_id=field3, display_order=2),
    ]
    for sf in schema_fields:
        db.add(sf)
    await db.commit()
    
    response = await client.get(f"/api/lists/{list_id}/schemas/{schema_id}/fields")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    # Verify order
    assert data[0]["field_id"] == str(field1)
    assert data[1]["field_id"] == str(field2)
    assert data[2]["field_id"] == str(field3)


@pytest.mark.asyncio
async def test_post_add_field_success(client: AsyncClient, db: AsyncSession, list_id, schema_id, field_id):
    """Test POST adds field with auto-calculated display_order."""
    response = await client.post(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields",
        json={"field_id": str(field_id), "show_on_card": False}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["field_id"] == str(field_id)
    assert data["display_order"] == 0  # First field
    assert data["show_on_card"] is False


@pytest.mark.asyncio
async def test_post_duplicate_field_conflict(client: AsyncClient, db: AsyncSession, list_id, schema_id, field_id):
    """Test POST returns 409 when field already in schema."""
    # Add field first time
    schema_field = SchemaField(schema_id=schema_id, field_id=field_id, display_order=0)
    db.add(schema_field)
    await db.commit()
    
    # Try adding again
    response = await client.post(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields",
        json={"field_id": str(field_id)}
    )
    
    assert response.status_code == 409
    assert "already added" in response.json()["detail"]


@pytest.mark.asyncio
async def test_post_max_show_on_card_violation(client: AsyncClient, db: AsyncSession, list_id, schema_id, field_ids):
    """Test POST returns 409 when adding 4th show_on_card=true field."""
    # Add 3 fields with show_on_card=true
    field1, field2, field3, field4 = field_ids
    for idx, fid in enumerate([field1, field2, field3]):
        schema_field = SchemaField(
            schema_id=schema_id,
            field_id=fid,
            display_order=idx,
            show_on_card=True
        )
        db.add(schema_field)
    await db.commit()
    
    # Try adding 4th with show_on_card=true
    response = await client.post(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields",
        json={"field_id": str(field4), "show_on_card": True}
    )
    
    assert response.status_code == 409
    assert "Maximum 3 fields" in response.json()["detail"]


@pytest.mark.asyncio
async def test_put_update_display_order(client: AsyncClient, db: AsyncSession, list_id, schema_id, field_id):
    """Test PUT updates display_order."""
    schema_field = SchemaField(schema_id=schema_id, field_id=field_id, display_order=0)
    db.add(schema_field)
    await db.commit()
    
    response = await client.put(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}",
        json={"display_order": 5}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["display_order"] == 5


@pytest.mark.asyncio
async def test_put_toggle_show_on_card_validates_max(client: AsyncClient, db: AsyncSession, list_id, schema_id, field_ids):
    """Test PUT validates max 3 show_on_card when toggling on."""
    # Add 3 fields with show_on_card=true, 1 with false
    field1, field2, field3, field4 = field_ids
    for idx, (fid, show) in enumerate([(field1, True), (field2, True), (field3, True), (field4, False)]):
        schema_field = SchemaField(
            schema_id=schema_id,
            field_id=fid,
            display_order=idx,
            show_on_card=show
        )
        db.add(schema_field)
    await db.commit()
    
    # Try toggling field4 to true (would exceed limit)
    response = await client.put(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields/{field4}",
        json={"show_on_card": True}
    )
    
    assert response.status_code == 409
    assert "Maximum 3 fields" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_removes_association_only(client: AsyncClient, db: AsyncSession, list_id, schema_id, field_id):
    """Test DELETE removes SchemaField but CustomField survives."""
    schema_field = SchemaField(schema_id=schema_id, field_id=field_id, display_order=0)
    db.add(schema_field)
    await db.commit()
    
    response = await client.delete(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}"
    )
    
    assert response.status_code == 204
    
    # Verify SchemaField deleted
    sf_result = await db.execute(
        select(SchemaField).where(
            SchemaField.schema_id == schema_id,
            SchemaField.field_id == field_id
        )
    )
    assert sf_result.scalar_one_or_none() is None
    
    # Verify CustomField still exists
    field_result = await db.execute(
        select(CustomField).where(CustomField.id == field_id)
    )
    assert field_result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_delete_nonexistent_association(client: AsyncClient, db: AsyncSession, list_id, schema_id):
    """Test DELETE returns 404 for non-existent association."""
    fake_field_id = uuid4()
    
    response = await client.delete(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields/{fake_field_id}"
    )
    
    assert response.status_code == 404
    assert "not found in this schema" in response.json()["detail"]


@pytest.mark.asyncio
async def test_field_from_different_list_rejected(client: AsyncClient, db: AsyncSession, list_id, schema_id):
    """Test POST rejects field from different list (security)."""
    # Create field in different list
    other_list_id = uuid4()
    other_field = CustomField(
        id=uuid4(),
        list_id=other_list_id,
        name="Other Field",
        field_type="text",
        config={}
    )
    db.add(other_field)
    await db.commit()
    
    response = await client.post(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields",
        json={"field_id": str(other_field.id)}
    )
    
    assert response.status_code == 404
    assert "does not belong to this list" in response.json()["detail"]
```

**Design Decision:** Test coverage includes security validation (cross-list access), constraint validation (max 3 show_on_card), and cascading behavior (DELETE removes association only).

### 10. Create integration tests

**Files:** `backend/tests/integration/test_schema_fields_flow.py`

**Action:** Test full workflow: create schema → add fields → reorder → toggle show_on_card → remove field.

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_schema_fields_full_workflow(client: AsyncClient, db: AsyncSession, list_id):
    """Test complete schema-fields management workflow."""
    # 1. Create schema
    schema_response = await client.post(
        f"/api/lists/{list_id}/schemas",
        json={
            "name": "Video Quality",
            "description": "Quality metrics"
        }
    )
    assert schema_response.status_code == 201
    schema_id = schema_response.json()["id"]
    
    # 2. Create 4 custom fields
    field_ids = []
    for name in ["Presentation", "Content", "Audio", "Editing"]:
        field_response = await client.post(
            f"/api/lists/{list_id}/custom-fields",
            json={
                "name": name,
                "field_type": "rating",
                "config": {"max_rating": 5}
            }
        )
        assert field_response.status_code == 201
        field_ids.append(field_response.json()["id"])
    
    # 3. Add 3 fields to schema with show_on_card=true
    for idx, field_id in enumerate(field_ids[:3]):
        add_response = await client.post(
            f"/api/lists/{list_id}/schemas/{schema_id}/fields",
            json={
                "field_id": field_id,
                "show_on_card": True
            }
        )
        assert add_response.status_code == 201
    
    # 4. Try adding 4th with show_on_card=true (should fail)
    fail_response = await client.post(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields",
        json={
            "field_id": field_ids[3],
            "show_on_card": True
        }
    )
    assert fail_response.status_code == 409
    
    # 5. Add 4th with show_on_card=false (should succeed)
    success_response = await client.post(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields",
        json={
            "field_id": field_ids[3],
            "show_on_card": False
        }
    )
    assert success_response.status_code == 201
    
    # 6. Get all fields (verify order and show_on_card)
    get_response = await client.get(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields"
    )
    assert get_response.status_code == 200
    fields = get_response.json()
    assert len(fields) == 4
    assert sum(f["show_on_card"] for f in fields) == 3
    
    # 7. Reorder fields (swap first and last)
    update_response = await client.put(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields/{field_ids[0]}",
        json={"display_order": 999}
    )
    assert update_response.status_code == 200
    
    # 8. Toggle show_on_card (turn off first, turn on fourth)
    toggle_off = await client.put(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields/{field_ids[0]}",
        json={"show_on_card": False}
    )
    assert toggle_off.status_code == 200
    
    toggle_on = await client.put(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields/{field_ids[3]}",
        json={"show_on_card": True}
    )
    assert toggle_on.status_code == 200
    
    # 9. Remove field from schema
    delete_response = await client.delete(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields/{field_ids[0]}"
    )
    assert delete_response.status_code == 204
    
    # 10. Verify field still exists as CustomField
    field_response = await client.get(
        f"/api/lists/{list_id}/custom-fields/{field_ids[0]}"
    )
    assert field_response.status_code == 200
    
    # 11. Verify field removed from schema
    final_get = await client.get(
        f"/api/lists/{list_id}/schemas/{schema_id}/fields"
    )
    assert final_get.status_code == 200
    assert len(final_get.json()) == 3
```

**Testing Strategy:** Integration test covers happy path and error conditions in realistic user workflow. Validates constraint enforcement and cascading behavior.

---

## 🧪 Testing Strategy

**Unit Tests:**
- Test 1: GET returns fields ordered by display_order (ascending)
- Test 2: POST adds field with auto-calculated display_order (max+1)
- Test 3: POST prevents duplicate field in same schema (409 Conflict)
- Test 4: POST enforces max 3 show_on_card per schema (409 Conflict)
- Test 5: PUT updates display_order successfully
- Test 6: PUT updates show_on_card with constraint validation
- Test 7: PUT allows toggling show_on_card off without validation
- Test 8: DELETE removes SchemaField entry only (CustomField survives)
- Test 9: DELETE returns 404 for non-existent association
- Test 10: POST rejects field from different list (security validation)
- Test 11: All endpoints return 404 for non-existent schema
- Test 12: Composite PK queries work correctly (schema_id + field_id)

**Integration Tests:**
- Full workflow: Create schema → Add 4 fields (3 with show_on_card=true) → Verify constraint → Reorder fields → Toggle show_on_card → Remove field → Verify CustomField still exists
- Multi-schema test: Same field added to 2 different schemas, removing from one doesn't affect other

**Manual Testing:**
1. Start backend: `uvicorn app.main:app --reload`
2. Open Swagger UI: http://localhost:8000/docs
3. Create test list and schema (if not exists)
4. Test GET empty schema → returns `[]`
5. Test POST add field → verify 201 response with field details
6. Test POST duplicate → verify 409 error
7. Test POST 4th show_on_card=true → verify 409 error
8. Test PUT update display_order → verify fields reordered
9. Test DELETE → verify 204 response, field removed from schema
10. Test CustomField still exists after DELETE → GET `/custom-fields/{id}` returns field

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 225-228 (schema-fields API spec)
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 106-108 (show_on_card constraint)
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Line 314 (max 3 show_on_card validation)

**Related Code:**
- `backend/app/models/schema_field.py` - SchemaField join table model (composite PK)
- `backend/app/models/field_schema.py` - FieldSchema model (parent)
- `backend/app/models/custom_field.py` - CustomField model (reusable fields)
- `backend/app/api/tags.py` - Reference pattern for CRUD with validation

**Design Decisions:**

1. **Decision: Nested routes `/lists/{list_id}/schemas/{schema_id}/fields`**
   - **Alternatives:** Flat routes `/schema-fields?schema_id=...`
   - **Chosen:** Nested routes for RESTful resource hierarchy
   - **Rationale:** Clearly expresses parent-child relationship (schema contains fields). Standard REST API pattern.
   - **Validation:** REF MCP - FastAPI nested routes documentation confirms this is idiomatic for sub-resources.

2. **Decision: DELETE removes association only, not CustomField**
   - **Alternative:** DELETE field itself when removing from schema
   - **Chosen:** Only delete SchemaField join table entry
   - **Rationale:** CustomField is globally reusable within list. Removing from one schema shouldn't delete it. User may want to add to different schema later.
   - **Documentation:** Clear docstring: "IMPORTANT: This only removes the association (SchemaField entry). The CustomField itself is NOT deleted and remains reusable."

3. **Decision: Validate max 3 show_on_card on POST and PUT**
   - **Implementation:** Helper function `validate_max_show_on_card()`
   - **Behavior:** Count existing show_on_card=true entries, raise 409 if adding/toggling would exceed 3
   - **Rationale:** Design doc requirement (line 107: "Max 3 per schema should be true")
   - **Validation:** Design doc line 314 explicitly states this constraint

4. **Decision: Use composite PK (schema_id, field_id) for queries**
   - **Query pattern:** `filter_by(schema_id=schema_id, field_id=field_id)`
   - **Rationale:** SchemaField has no separate `id` column (composite PK design from migration Task #58)
   - **Validation:** SchemaField model lines 26-37 confirms composite PK structure

5. **Decision: Auto-calculate display_order as max+1 when not provided**
   - **Implementation:** Query `func.max(display_order)`, default to 0 if no fields
   - **Rationale:** User-friendly default (append to end). User can explicitly set order or reorder later with PUT.
   - **Alternative:** Require display_order in request → rejected as less ergonomic

6. **Decision: Use PUT with optional fields (PATCH semantics)**
   - **Chosen:** PUT endpoint with `SchemaFieldUpdate` having all optional fields
   - **Alternative:** PATCH endpoint
   - **Rationale:** Only 2 fields to update (display_order, show_on_card). PUT with optional fields is simpler than PATCH.
   - **Validation:** REF MCP - FastAPI body updates documentation confirms `exclude_unset` pattern for partial updates

7. **Decision: Eager load CustomField with selectinload()**
   - **Implementation:** `options(selectinload(SchemaField.field))`
   - **Rationale:** Avoids N+1 queries when returning list of schema fields. Single query for relationships.
   - **Validation:** REF MCP - SQLAlchemy 2.0 selectinload() docs recommend for async eager loading

8. **Decision: Security validation - field must belong to same list as schema**
   - **Implementation:** Explicit query to verify `field.list_id == schema.list_id`
   - **Rationale:** Prevent cross-list attacks (user adding field from List A to schema in List B)
   - **Critical:** This is a security requirement, not just data consistency

9. **Decision: Separate router file `schema_fields.py`**
   - **Alternative:** Add endpoints to existing `schemas.py` router
   - **Chosen:** New file for schema-fields relationship
   - **Rationale:** Keeps routers focused. schema_fields is a distinct resource managing relationships (not schema metadata).

10. **Decision: SchemaFieldResponse includes nested CustomField**
    - **Implementation:** `field: CustomFieldResponse` nested in response model
    - **Rationale:** Frontend needs full field details (name, type, config) to render UI. Avoids separate GET for each field.
    - **Trade-off:** Slightly larger response size, but eliminates N+1 API calls from frontend

---

## ⏱️ Estimated Duration

**Implementation:** 2-3 hours
- Router setup: 30 min
- GET endpoint: 20 min
- Validation helper: 15 min
- POST endpoint: 45 min (includes security validation)
- PUT endpoint: 30 min
- DELETE endpoint: 20 min
- Pydantic schemas: 20 min

**Testing:** 1.5-2 hours
- Unit tests: 1 hour (12 test cases)
- Integration test: 30 min
- Manual testing: 30 min

**Total:** 3.5-5 hours

---

## 📝 Notes

- **Security:** All endpoints validate `list_id` ownership. Field must belong to same list as schema (prevent cross-list attacks).
- **Composite PK Queries:** Use `filter_by(schema_id=..., field_id=...)` - no separate `id` column in SchemaField.
- **Cascading:** DELETE removes SchemaField only. CustomField survives and remains reusable.
- **Constraint Enforcement:** Max 3 show_on_card per schema enforced at application level (not DB constraint).
- **Display Order:** Auto-calculated as max+1 when not provided. User can reorder later with PUT.
- **Error Messages:** User-friendly error messages for 409 Conflict (duplicate field, max show_on_card exceeded).
- **Eager Loading:** Use `selectinload()` for CustomField relationship to avoid N+1 queries.
- **RESTful Design:** Nested routes follow REST best practices for parent-child resources.
- **Testing Coverage:** Unit tests cover edge cases (duplicates, constraints, security). Integration test validates full workflow.

---

## 🔗 Related Tasks

**Blocked by:**
- Task #60: FieldSchema model (completed)
- Task #61: SchemaField model (in progress)
- Task #59: CustomField model (completed)

**Blocks:**
- Task #70: Extend Tag endpoints with schema_id support (needs schema-fields endpoints for schema selection)
- Task #71: Extend Video GET endpoint with field_values (needs schema-fields for field union logic)
- Task #74: Implement multi-tag field union query (needs schema-fields API)

**Related:**
- Task #68: Implement field schemas CRUD (parent resource for schema-fields)
- Task #66: Implement custom fields CRUD (custom fields are added to schemas via Task #69)
