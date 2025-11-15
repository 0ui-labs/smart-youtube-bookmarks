"""
Unit tests for Custom Fields CRUD API endpoints.

Tests cover:
- GET /api/lists/{list_id}/custom-fields
- POST /api/lists/{list_id}/custom-fields
- PUT /api/lists/{list_id}/custom-fields/{field_id}
- DELETE /api/lists/{list_id}/custom-fields/{field_id}

Validation scenarios:
- Case-insensitive duplicate detection
- Config validation (delegated to Pydantic)
- Schema usage check on deletion
- 404 errors for missing resources
- 409 errors for conflicts
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.user import User


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
async def rating_field(test_db: AsyncSession, test_list: BookmarkList) -> CustomField:
    """Create a test rating field."""
    field = CustomField(
        list_id=test_list.id,
        name="Overall Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


@pytest.fixture
async def select_field(test_db: AsyncSession, test_list: BookmarkList) -> CustomField:
    """Create a test select field."""
    field = CustomField(
        list_id=test_list.id,
        name="Presentation Quality",
        field_type="select",
        config={"options": ["bad", "good", "great"]}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


@pytest.fixture
async def field_schema(test_db: AsyncSession, test_list: BookmarkList) -> FieldSchema:
    """Create a test field schema."""
    schema = FieldSchema(
        list_id=test_list.id,
        name="Test Schema",
        description="A test schema"
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)
    return schema


# ============================================================================
# GET /api/lists/{list_id}/custom-fields
# ============================================================================

@pytest.mark.asyncio
async def test_list_custom_fields_empty(client: AsyncClient, test_list: BookmarkList):
    """Test listing fields for list with no fields."""
    response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
@pytest.mark.usefixtures("rating_field", "select_field")
async def test_list_custom_fields_with_fields(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test listing fields returns all fields ordered by created_at DESC."""
    response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert response.status_code == 200

    fields = response.json()
    assert len(fields) == 2

    # Verify fields present (order not critical for test)
    field_names = {f["name"] for f in fields}
    assert "Overall Rating" in field_names
    assert "Presentation Quality" in field_names

    # Verify response structure
    assert all("id" in f for f in fields)
    assert all("name" in f for f in fields)
    assert all("field_type" in f for f in fields)
    assert all("config" in f for f in fields)
    assert all("created_at" in f for f in fields)
    assert all("updated_at" in f for f in fields)


@pytest.mark.asyncio
async def test_list_custom_fields_list_not_found(client: AsyncClient):
    """Test listing fields for non-existent list returns 404."""
    import uuid
    fake_list_id = uuid.uuid4()
    response = await client.get(f"/api/lists/{fake_list_id}/custom-fields")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ============================================================================
# POST /api/lists/{list_id}/custom-fields
# ============================================================================

@pytest.mark.asyncio
async def test_create_custom_field_rating(client: AsyncClient, test_list: BookmarkList):
    """Test creating a rating field."""
    field_data = {
        "name": "Overall Rating",
        "field_type": "rating",
        "config": {"max_rating": 5}
    }

    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Overall Rating"
    assert data["field_type"] == "rating"
    assert data["config"]["max_rating"] == 5
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_custom_field_select(client: AsyncClient, test_list: BookmarkList):
    """Test creating a select field with options."""
    field_data = {
        "name": "Presentation Quality",
        "field_type": "select",
        "config": {"options": ["bad", "all over the place", "confusing", "great"]}
    }

    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Presentation Quality"
    assert data["field_type"] == "select"
    assert len(data["config"]["options"]) == 4


@pytest.mark.asyncio
@pytest.mark.usefixtures("rating_field")
async def test_create_custom_field_duplicate_name(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test creating field with duplicate name (case-insensitive) returns 409."""
    # Try to create field with same name (different case)
    field_data = {
        "name": "overall rating",  # lowercase version of existing "Overall Rating"
        "field_type": "rating",
        "config": {"max_rating": 10}
    }

    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_custom_field_list_not_found(client: AsyncClient):
    """Test creating field for non-existent list returns 404."""
    import uuid
    fake_list_id = uuid.uuid4()

    field_data = {
        "name": "Test Field",
        "field_type": "boolean",
        "config": {}
    }

    response = await client.post(
        f"/api/lists/{fake_list_id}/custom-fields",
        json=field_data
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_custom_field_invalid_config(client: AsyncClient, test_list: BookmarkList):
    """Test creating field with invalid config returns 422 (Pydantic validation)."""
    # Rating field without max_rating
    field_data = {
        "name": "Invalid Rating",
        "field_type": "rating",
        "config": {}  # Missing max_rating
    }

    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )

    assert response.status_code == 422


# ============================================================================
# PUT /api/lists/{list_id}/custom-fields/{field_id}
# ============================================================================

@pytest.mark.asyncio
async def test_update_custom_field_name(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField
):
    """Test updating field name."""
    update_data = {"name": "Updated Rating"}

    response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}",
        json=update_data
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Rating"
    assert data["field_type"] == "rating"  # Unchanged
    assert data["config"]["max_rating"] == 5  # Unchanged


@pytest.mark.asyncio
async def test_update_custom_field_full(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField
):
    """Test full update (all fields)."""
    update_data = {
        "name": "New Rating",
        "field_type": "rating",
        "config": {"max_rating": 10}
    }

    response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}",
        json=update_data
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Rating"
    assert data["config"]["max_rating"] == 10


@pytest.mark.asyncio
@pytest.mark.usefixtures("select_field")
async def test_update_custom_field_duplicate_name(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField
):
    """Test updating field name to duplicate returns 409."""
    # Try to rename rating_field to match select_field name
    update_data = {"name": "presentation quality"}  # Lowercase version

    response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}",
        json=update_data
    )

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_custom_field_not_found(client: AsyncClient, test_list: BookmarkList):
    """Test updating non-existent field returns 404."""
    import uuid
    fake_field_id = uuid.uuid4()

    update_data = {"name": "Updated Name"}

    response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{fake_field_id}",
        json=update_data
    )

    assert response.status_code == 404


# ============================================================================
# DELETE /api/lists/{list_id}/custom-fields/{field_id}
# ============================================================================

@pytest.mark.asyncio
async def test_delete_custom_field_success(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField
):
    """Test deleting unused field succeeds."""
    response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}"
    )

    assert response.status_code == 204

    # Verify field is deleted
    get_response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    fields = get_response.json()
    assert not any(f["id"] == str(rating_field.id) for f in fields)


@pytest.mark.asyncio
async def test_delete_custom_field_used_in_schema(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    rating_field: CustomField,
    field_schema: FieldSchema
):
    """Test deleting field used in schema returns 409."""
    # Add field to schema (create SchemaField association)
    schema_field = SchemaField(
        schema_id=field_schema.id,
        field_id=rating_field.id,
        display_order=0,
        show_on_card=True
    )
    test_db.add(schema_field)
    await test_db.commit()

    # Try to delete field
    response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}"
    )

    assert response.status_code == 409
    assert "used in" in response.json()["detail"].lower()
    assert "schema" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_custom_field_not_found(client: AsyncClient, test_list: BookmarkList):
    """Test deleting non-existent field returns 404."""
    import uuid
    fake_field_id = uuid.uuid4()

    response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{fake_field_id}"
    )

    assert response.status_code == 404


# ============================================================================
# POST /api/lists/{list_id}/custom-fields/check-duplicate
# ============================================================================

@pytest.mark.asyncio
async def test_duplicate_check_exact_match(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList
):
    """Test that exact name match returns exists=true with full field details."""
    # Create a field
    field = CustomField(
        list_id=test_list.id,
        name="Presentation Quality",
        field_type="select",
        config={"options": ["bad", "good", "great"]}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)

    # Check for exact match
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
        json={"name": "Presentation Quality"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["exists"] is True
    assert data["field"] is not None
    assert data["field"]["id"] == str(field.id)
    assert data["field"]["name"] == "Presentation Quality"
    assert data["field"]["field_type"] == "select"
    assert data["field"]["config"]["options"] == ["bad", "good", "great"]


@pytest.mark.asyncio
async def test_duplicate_check_case_insensitive(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList
):
    """Test that case-insensitive matching works (lowercase, UPPERCASE, MiXeD)."""
    # Create field with mixed case
    field = CustomField(
        list_id=test_list.id,
        name="Overall Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(field)
    await test_db.commit()

    # Check with lowercase
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
        json={"name": "overall rating"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["exists"] is True
    assert data["field"]["name"] == "Overall Rating"  # Original casing preserved

    # Check with uppercase
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
        json={"name": "OVERALL RATING"}
    )

    assert response.status_code == 200
    assert response.json()["exists"] is True

    # Check with random casing
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
        json={"name": "OvErAlL rAtInG"}
    )

    assert response.status_code == 200
    assert response.json()["exists"] is True


@pytest.mark.asyncio
async def test_duplicate_check_not_exists(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test that non-existent field returns exists=false with field=null."""
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
        json={"name": "Non-Existent Field"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["exists"] is False
    assert data["field"] is None


@pytest.mark.asyncio
async def test_duplicate_check_scoped_to_list(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """Test that duplicate check is scoped to specific list."""
    import uuid
    from app.models.list import BookmarkList

    # Create field in test_list
    field = CustomField(
        list_id=test_list.id,
        name="Field A",
        field_type="text",
        config={}
    )
    test_db.add(field)

    # Create another list with same field name
    other_list_id = uuid.uuid4()
    other_list = BookmarkList(
        id=other_list_id,
        name="Other List",
        user_id=test_user.id
    )
    test_db.add(other_list)

    other_field = CustomField(
        list_id=other_list_id,
        name="Field A",
        field_type="text",
        config={}
    )
    test_db.add(other_field)
    await test_db.commit()

    # Check in test_list - should find field
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
        json={"name": "Field A"}
    )
    assert response.status_code == 200
    assert response.json()["exists"] is True
    assert response.json()["field"]["id"] == str(field.id)  # Returns test_list field

    # Check in other_list - should find different field
    response = await client.post(
        f"/api/lists/{other_list_id}/custom-fields/check-duplicate",
        json={"name": "Field A"}
    )
    assert response.status_code == 200
    assert response.json()["exists"] is True
    assert response.json()["field"]["id"] == str(other_field.id)  # Returns other_list field


@pytest.mark.asyncio
async def test_duplicate_check_invalid_list_id(
    client: AsyncClient
):
    """Test that checking in non-existent list returns 404."""
    import uuid
    fake_list_id = uuid.uuid4()
    response = await client.post(
        f"/api/lists/{fake_list_id}/custom-fields/check-duplicate",
        json={"name": "Any Field"}
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_duplicate_check_empty_name(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test that empty name is rejected by Pydantic schema validation."""
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
        json={"name": ""}
    )

    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_duplicate_check_whitespace_name(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test that whitespace-only name is rejected by Pydantic validator."""
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
        json={"name": "   "}
    )

    assert response.status_code == 422  # Validation error
