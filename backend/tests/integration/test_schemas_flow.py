"""
Integration tests for Field Schema workflows.

Tests complete user flows:
- Create schema → Update → Delete
- Create schema with fields → Verify field loading
- Create schema → Bind to tag → Try delete → Should fail
"""

import pytest
from httpx import AsyncClient

from app.models.list import BookmarkList
from app.models.user import User
from app.models.custom_field import CustomField


@pytest.mark.asyncio
async def test_schema_full_lifecycle(
    client: AsyncClient,
    test_db,
    test_list: BookmarkList
):
    """Test complete schema lifecycle: create → update → delete."""
    # Create schema
    create_data = {
        "name": "Video Quality",
        "description": "Quality metrics"
    }
    create_response = await client.post(
        f"/api/lists/{test_list.id}/schemas",
        json=create_data
    )
    assert create_response.status_code == 201
    schema_id = create_response.json()["id"]

    # Update schema
    update_data = {"name": "Updated Quality Metrics"}
    update_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}",
        json=update_data
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Quality Metrics"

    # Delete schema
    delete_response = await client.delete(
        f"/api/lists/{test_list.id}/schemas/{schema_id}"
    )
    assert delete_response.status_code == 204

    # Verify deletion
    get_response = await client.get(f"/api/lists/{test_list.id}/schemas")
    assert len(get_response.json()) == 0


@pytest.mark.asyncio
async def test_schema_with_fields_eager_loading(
    client: AsyncClient,
    test_db,
    test_list: BookmarkList
):
    """Test schema creation with fields and verify eager loading works."""
    # Create custom fields
    field1 = CustomField(
        list_id=test_list.id,
        name="Presentation",
        field_type="select",
        config={"options": ["bad", "good", "great"]}
    )
    field2 = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add_all([field1, field2])
    await test_db.commit()

    # Create schema with fields
    create_data = {
        "name": "Video Quality",
        "description": "Quality assessment",
        "fields": [
            {
                "field_id": str(field1.id),
                "display_order": 0,
                "show_on_card": True
            },
            {
                "field_id": str(field2.id),
                "display_order": 1,
                "show_on_card": True
            }
        ]
    }
    create_response = await client.post(
        f"/api/lists/{test_list.id}/schemas",
        json=create_data
    )
    assert create_response.status_code == 201

    # Verify GET returns same structure (tests eager loading)
    list_response = await client.get(f"/api/lists/{test_list.id}/schemas")
    assert list_response.status_code == 200
    schemas = list_response.json()
    assert len(schemas) == 1
    assert len(schemas[0]["schema_fields"]) == 2
    assert schemas[0]["schema_fields"][0]["field"]["name"] == "Presentation"
    assert schemas[0]["schema_fields"][1]["field"]["name"] == "Rating"


@pytest.mark.asyncio
async def test_cannot_delete_schema_bound_to_tag(
    client: AsyncClient,
    test_db,
    test_list: BookmarkList,
    test_user: User
):
    """Test that schemas bound to tags cannot be deleted."""
    # Create schema
    create_data = {"name": "Video Quality"}
    create_response = await client.post(
        f"/api/lists/{test_list.id}/schemas",
        json=create_data
    )
    schema_id = create_response.json()["id"]

    # Create tag (tags.py endpoint) - pass user_id to ensure correct user association
    tag_data = {"name": "Tutorial"}
    tag_response = await client.post(f"/api/tags?user_id={test_user.id}", json=tag_data)
    tag_id = tag_response.json()["id"]

    # Bind schema to tag (Task #70 endpoint - future)
    # For now, manually update tag in database
    from app.models.tag import Tag
    from sqlalchemy import select
    stmt = select(Tag).where(Tag.id == tag_id)
    result = await test_db.execute(stmt)
    tag = result.scalar_one()
    tag.schema_id = schema_id
    await test_db.commit()

    # Try to delete schema
    delete_response = await client.delete(
        f"/api/lists/{test_list.id}/schemas/{schema_id}"
    )
    assert delete_response.status_code == 409
    assert "used by 1 tag" in delete_response.json()["detail"]
