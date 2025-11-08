"""
Integration tests for Schema Fields workflows.

Tests complete user flows:
- Create schema → Add fields → Reorder → Toggle show_on_card → Remove field
"""

import pytest
from httpx import AsyncClient

from app.models.list import BookmarkList


@pytest.mark.asyncio
async def test_schema_fields_full_workflow(
    client: AsyncClient,
    test_db,
    test_list: BookmarkList
):
    """Test complete schema-fields management workflow."""
    # 1. Create schema
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas",
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
            f"/api/lists/{test_list.id}/custom-fields",
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
            f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
            json={
                "field_id": field_id,
                "show_on_card": True
            }
        )
        assert add_response.status_code == 201

    # 4. Try adding 4th with show_on_card=true (should fail)
    fail_response = await client.post(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
        json={
            "field_id": field_ids[3],
            "show_on_card": True
        }
    )
    assert fail_response.status_code == 409

    # 5. Add 4th with show_on_card=false (should succeed)
    success_response = await client.post(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
        json={
            "field_id": field_ids[3],
            "show_on_card": False
        }
    )
    assert success_response.status_code == 201

    # 6. Get all fields (verify order and show_on_card)
    get_response = await client.get(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields"
    )
    assert get_response.status_code == 200
    fields = get_response.json()
    assert len(fields) == 4
    assert sum(f["show_on_card"] for f in fields) == 3

    # 7. Reorder fields (swap first and last)
    update_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/{field_ids[0]}",
        json={"display_order": 999}
    )
    assert update_response.status_code == 200

    # 8. Toggle show_on_card (turn off first, turn on fourth)
    toggle_off = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/{field_ids[0]}",
        json={"show_on_card": False}
    )
    assert toggle_off.status_code == 200

    toggle_on = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/{field_ids[3]}",
        json={"show_on_card": True}
    )
    assert toggle_on.status_code == 200

    # 9. Remove field from schema
    delete_response = await client.delete(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/{field_ids[0]}"
    )
    assert delete_response.status_code == 204

    # 10. Verify field still exists as CustomField
    all_fields_response = await client.get(
        f"/api/lists/{test_list.id}/custom-fields"
    )
    assert all_fields_response.status_code == 200
    all_fields = all_fields_response.json()
    # Field should still exist (4 fields created total)
    assert len(all_fields) == 4
    # Verify the first field is among them
    assert field_ids[0] in [f["id"] for f in all_fields]

    # 11. Verify field removed from schema
    final_get = await client.get(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields"
    )
    assert final_get.status_code == 200
    assert len(final_get.json()) == 3
