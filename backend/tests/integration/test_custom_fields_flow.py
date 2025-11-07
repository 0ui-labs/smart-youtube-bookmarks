"""
Integration tests for Custom Fields CRUD flow.

Tests complete workflows:
- Create list → create field → list fields → update field → delete field
- Create field → use in schema → attempt delete (should fail)
- Duplicate name detection across multiple fields
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField


@pytest.mark.asyncio
async def test_complete_crud_flow(client: AsyncClient, test_list: BookmarkList):
    """Test complete CRUD flow: create → list → update → delete."""

    # 1. Create rating field
    create_data = {
        "name": "Overall Rating",
        "field_type": "rating",
        "config": {"max_rating": 5}
    }
    create_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=create_data
    )
    assert create_response.status_code == 201
    field_id = create_response.json()["id"]

    # 2. List fields (should have 1 field)
    list_response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    # 3. Update field name
    update_data = {"name": "Updated Rating"}
    update_response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{field_id}",
        json=update_data
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Rating"

    # 4. Delete field
    delete_response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{field_id}"
    )
    assert delete_response.status_code == 204

    # 5. Verify field is gone
    final_list_response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert final_list_response.status_code == 200
    assert len(final_list_response.json()) == 0


@pytest.mark.asyncio
async def test_create_multiple_fields_different_types(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test creating multiple fields with different types."""

    fields_to_create = [
        {
            "name": "Overall Rating",
            "field_type": "rating",
            "config": {"max_rating": 5}
        },
        {
            "name": "Presentation Quality",
            "field_type": "select",
            "config": {"options": ["bad", "good", "great"]}
        },
        {
            "name": "Notes",
            "field_type": "text",
            "config": {"max_length": 500}
        },
        {
            "name": "Recommended",
            "field_type": "boolean",
            "config": {}
        }
    ]

    # Create all fields
    for field_data in fields_to_create:
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json=field_data
        )
        assert response.status_code == 201

    # Verify all created
    list_response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 4


@pytest.mark.asyncio
async def test_field_used_in_schema_cannot_be_deleted(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList
):
    """Test that field used in schema cannot be deleted."""

    # 1. Create field
    field_data = {
        "name": "Overall Rating",
        "field_type": "rating",
        "config": {"max_rating": 5}
    }
    create_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )
    assert create_response.status_code == 201
    field_id = create_response.json()["id"]

    # 2. Create schema and add field to it
    schema = FieldSchema(
        list_id=test_list.id,
        name="Test Schema",
        description="A test schema"
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)

    schema_field = SchemaField(
        schema_id=schema.id,
        field_id=field_id,
        display_order=0,
        show_on_card=True
    )
    test_db.add(schema_field)
    await test_db.commit()

    # 3. Try to delete field (should fail with 409)
    delete_response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{field_id}"
    )
    assert delete_response.status_code == 409
    assert "used in" in delete_response.json()["detail"].lower()

    # 4. Remove field from schema
    await test_db.delete(schema_field)
    await test_db.commit()

    # 5. Now deletion should succeed
    delete_response_2 = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{field_id}"
    )
    assert delete_response_2.status_code == 204


@pytest.mark.asyncio
async def test_case_insensitive_duplicate_detection(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test that duplicate detection is case-insensitive."""

    # Create field with mixed case
    field_data = {
        "name": "Presentation Quality",
        "field_type": "select",
        "config": {"options": ["bad", "good", "great"]}
    }
    response1 = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )
    assert response1.status_code == 201

    # Try to create with different case variations
    duplicate_variations = [
        "presentation quality",  # all lowercase
        "PRESENTATION QUALITY",  # all uppercase
        "PrEsEnTaTiOn QuAlItY",  # mixed case
    ]

    for duplicate_name in duplicate_variations:
        duplicate_data = {
            "name": duplicate_name,
            "field_type": "rating",
            "config": {"max_rating": 5}
        }
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json=duplicate_data
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()
