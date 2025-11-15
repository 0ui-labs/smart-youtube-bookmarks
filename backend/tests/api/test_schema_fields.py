"""
Unit tests for Schema Fields API endpoints.

Tests cover:
- GET /api/lists/{list_id}/schemas/{schema_id}/fields
- POST /api/lists/{list_id}/schemas/{schema_id}/fields
- PUT /api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}
- DELETE /api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}

Validation scenarios:
- Display order management
- show_on_card constraint (max 3)
- Duplicate field prevention
- Security (field belongs to same list)
- Association-only deletion (CustomField survives)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from app.models.list import BookmarkList
from app.models.user import User
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
async def test_schema(test_db: AsyncSession, test_list: BookmarkList) -> FieldSchema:
    """Create a test field schema."""
    schema = FieldSchema(
        list_id=test_list.id,
        name="Test Schema",
        description="Test schema for field associations"
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)
    return schema


@pytest.fixture
async def test_field(test_db: AsyncSession, test_list: BookmarkList) -> CustomField:
    """Create a single test custom field."""
    field = CustomField(
        list_id=test_list.id,
        name="Test Field",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


@pytest.fixture
async def test_fields(test_db: AsyncSession, test_list: BookmarkList) -> list[CustomField]:
    """Create multiple test custom fields for ordering/limit tests."""
    fields = [
        CustomField(
            list_id=test_list.id,
            name=f"Field {i}",
            field_type="rating",
            config={"max_rating": 5}
        )
        for i in range(4)
    ]
    for field in fields:
        test_db.add(field)
    await test_db.commit()
    for field in fields:
        await test_db.refresh(field)
    return fields


# ============================================================================
# GET /api/lists/{list_id}/schemas/{schema_id}/fields
# ============================================================================

@pytest.mark.asyncio
async def test_get_schema_fields_ordered(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_fields: list[CustomField]
):
    """Test GET returns fields ordered by display_order."""
    # Add 3 fields with specific order
    field1, field2, field3 = test_fields[:3]
    schema_fields = [
        SchemaField(schema_id=test_schema.id, field_id=field2.id, display_order=1),
        SchemaField(schema_id=test_schema.id, field_id=field1.id, display_order=0),
        SchemaField(schema_id=test_schema.id, field_id=field3.id, display_order=2),
    ]
    for sf in schema_fields:
        test_db.add(sf)
    await test_db.commit()

    response = await client.get(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields"
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    # Verify order
    assert data[0]["field_id"] == str(field1.id)
    assert data[1]["field_id"] == str(field2.id)
    assert data[2]["field_id"] == str(field3.id)


@pytest.mark.asyncio
async def test_get_schema_fields_empty(
    client: AsyncClient,
    test_list: BookmarkList,
    test_schema: FieldSchema
):
    """Test GET returns empty list when schema has no fields."""
    response = await client.get(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields"
    )

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_schema_fields_schema_not_found(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test GET returns 404 when schema doesn't exist."""
    fake_schema_id = uuid4()

    response = await client.get(
        f"/api/lists/{test_list.id}/schemas/{fake_schema_id}/fields"
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ============================================================================
# POST /api/lists/{list_id}/schemas/{schema_id}/fields
# ============================================================================

@pytest.mark.asyncio
async def test_post_add_field_success(
    client: AsyncClient,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_field: CustomField
):
    """Test POST adds field with auto-calculated display_order."""
    response = await client.post(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields",
        json={"field_id": str(test_field.id), "show_on_card": False}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["field_id"] == str(test_field.id)
    assert data["display_order"] == 0  # First field
    assert data["show_on_card"] is False


@pytest.mark.asyncio
async def test_post_duplicate_field_conflict(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_field: CustomField
):
    """Test POST returns 409 when field already in schema."""
    # Add field first time
    schema_field = SchemaField(
        schema_id=test_schema.id,
        field_id=test_field.id,
        display_order=0
    )
    test_db.add(schema_field)
    await test_db.commit()

    # Try adding again
    response = await client.post(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields",
        json={"field_id": str(test_field.id)}
    )

    assert response.status_code == 409
    assert "already added" in response.json()["detail"]


@pytest.mark.asyncio
async def test_post_max_show_on_card_violation(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_fields: list[CustomField]
):
    """Test POST returns 409 when adding 4th show_on_card=true field."""
    # Add 3 fields with show_on_card=true
    field1, field2, field3, field4 = test_fields
    for idx, fid in enumerate([field1.id, field2.id, field3.id]):
        schema_field = SchemaField(
            schema_id=test_schema.id,
            field_id=fid,
            display_order=idx,
            show_on_card=True
        )
        test_db.add(schema_field)
    await test_db.commit()

    # Try adding 4th with show_on_card=true
    response = await client.post(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields",
        json={"field_id": str(field4.id), "show_on_card": True}
    )

    assert response.status_code == 409
    assert "Maximum 3 fields" in response.json()["detail"]


@pytest.mark.asyncio
async def test_post_field_not_found(
    client: AsyncClient,
    test_list: BookmarkList,
    test_schema: FieldSchema
):
    """Test POST returns 404 when field doesn't exist."""
    fake_field_id = uuid4()

    response = await client.post(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields",
        json={"field_id": str(fake_field_id)}
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_field_from_different_list_rejected(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_user: User
):
    """Test POST rejects field from different list (security)."""
    # Create another list
    other_list = BookmarkList(
        user_id=test_user.id,
        name="Other List",
        description="Another list"
    )
    test_db.add(other_list)
    await test_db.flush()

    # Create field in different list
    other_field = CustomField(
        list_id=other_list.id,
        name="Other Field",
        field_type="text",
        config={}
    )
    test_db.add(other_field)
    await test_db.commit()

    response = await client.post(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields",
        json={"field_id": str(other_field.id)}
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ============================================================================
# PUT /api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}
# ============================================================================

@pytest.mark.asyncio
async def test_put_update_display_order(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_field: CustomField
):
    """Test PUT updates display_order."""
    schema_field = SchemaField(
        schema_id=test_schema.id,
        field_id=test_field.id,
        display_order=0
    )
    test_db.add(schema_field)
    await test_db.commit()

    response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields/{test_field.id}",
        json={"display_order": 5}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["display_order"] == 5


@pytest.mark.asyncio
async def test_put_toggle_show_on_card_validates_max(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_fields: list[CustomField]
):
    """Test PUT validates max 3 show_on_card when toggling on."""
    # Add 3 fields with show_on_card=true, 1 with false
    field1, field2, field3, field4 = test_fields
    for idx, (fid, show) in enumerate([
        (field1.id, True),
        (field2.id, True),
        (field3.id, True),
        (field4.id, False)
    ]):
        schema_field = SchemaField(
            schema_id=test_schema.id,
            field_id=fid,
            display_order=idx,
            show_on_card=show
        )
        test_db.add(schema_field)
    await test_db.commit()

    # Try toggling field4 to true (would exceed limit)
    response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields/{field4.id}",
        json={"show_on_card": True}
    )

    assert response.status_code == 409
    assert "Maximum 3 fields" in response.json()["detail"]


@pytest.mark.asyncio
async def test_put_toggle_show_on_card_off_allowed(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_fields: list[CustomField]
):
    """Test PUT allows toggling show_on_card off even when at max."""
    # Add 3 fields with show_on_card=true
    field1, field2, field3 = test_fields[:3]
    for idx, fid in enumerate([field1.id, field2.id, field3.id]):
        schema_field = SchemaField(
            schema_id=test_schema.id,
            field_id=fid,
            display_order=idx,
            show_on_card=True
        )
        test_db.add(schema_field)
    await test_db.commit()

    # Toggle field1 to false (should succeed)
    response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields/{field1.id}",
        json={"show_on_card": False}
    )

    assert response.status_code == 200
    assert response.json()["show_on_card"] is False


@pytest.mark.asyncio
async def test_put_field_not_in_schema(
    client: AsyncClient,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_field: CustomField
):
    """Test PUT returns 404 when field not in schema."""
    # Field exists but not associated with schema
    response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields/{test_field.id}",
        json={"display_order": 5}
    )

    assert response.status_code == 404
    assert "not found in this schema" in response.json()["detail"]


# ============================================================================
# DELETE /api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}
# ============================================================================

@pytest.mark.asyncio
async def test_delete_removes_association_only(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_schema: FieldSchema,
    test_field: CustomField
):
    """Test DELETE removes SchemaField but CustomField survives."""
    schema_field = SchemaField(
        schema_id=test_schema.id,
        field_id=test_field.id,
        display_order=0
    )
    test_db.add(schema_field)
    await test_db.commit()

    response = await client.delete(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields/{test_field.id}"
    )

    assert response.status_code == 204

    # Verify SchemaField deleted
    sf_result = await test_db.execute(
        select(SchemaField).where(
            SchemaField.schema_id == test_schema.id,
            SchemaField.field_id == test_field.id
        )
    )
    assert sf_result.scalar_one_or_none() is None

    # Verify CustomField still exists
    field_result = await test_db.execute(
        select(CustomField).where(CustomField.id == test_field.id)
    )
    assert field_result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_delete_nonexistent_association(
    client: AsyncClient,
    test_list: BookmarkList,
    test_schema: FieldSchema
):
    """Test DELETE returns 404 for non-existent association."""
    fake_field_id = uuid4()

    response = await client.delete(
        f"/api/lists/{test_list.id}/schemas/{test_schema.id}/fields/{fake_field_id}"
    )

    assert response.status_code == 404
    assert "not found in this schema" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_schema_not_found(
    client: AsyncClient,
    test_list: BookmarkList,
    test_field: CustomField
):
    """Test DELETE returns 404 when schema doesn't exist."""
    fake_schema_id = uuid4()

    response = await client.delete(
        f"/api/lists/{test_list.id}/schemas/{fake_schema_id}/fields/{test_field.id}"
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
