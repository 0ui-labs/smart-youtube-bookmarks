"""
Unit tests for batch update schema fields endpoint (Task #126).

Tests the PUT /api/lists/{list_id}/schemas/{schema_id}/fields/batch endpoint
with comprehensive validation scenarios.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.models.list import BookmarkList


@pytest.mark.asyncio
async def test_batch_update_success_all_fields(
    client: AsyncClient, test_list: BookmarkList
):
    """Test successful batch update of all fields in schema."""
    # Create schema
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    # Create 3 fields
    field_ids = []
    for name in ["Field A", "Field B", "Field C"]:
        field_response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json={"name": name, "field_type": "rating", "config": {"max_rating": 5}},
        )
        field_ids.append(field_response.json()["id"])

    # Add fields to schema
    for idx, field_id in enumerate(field_ids):
        await client.post(
            f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
            json={"field_id": field_id, "display_order": idx, "show_on_card": True},
        )

    # Batch update: reverse order and toggle show_on_card
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={
            "fields": [
                {"field_id": field_ids[2], "display_order": 0, "show_on_card": True},
                {"field_id": field_ids[1], "display_order": 1, "show_on_card": False},
                {"field_id": field_ids[0], "display_order": 2, "show_on_card": True},
            ]
        },
    )

    assert batch_response.status_code == 200
    data = batch_response.json()
    assert data["updated_count"] == 3
    assert len(data["fields"]) == 3

    # Verify order
    assert data["fields"][0]["field_id"] == field_ids[2]
    assert data["fields"][1]["field_id"] == field_ids[1]
    assert data["fields"][2]["field_id"] == field_ids[0]

    # Verify show_on_card flags
    assert data["fields"][0]["show_on_card"] is True
    assert data["fields"][1]["show_on_card"] is False
    assert data["fields"][2]["show_on_card"] is True


@pytest.mark.asyncio
async def test_batch_update_partial_fields(
    client: AsyncClient, test_list: BookmarkList
):
    """Test batch update of only some fields in schema."""
    # Create schema with 4 fields
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    field_ids = []
    for name in ["Field A", "Field B", "Field C", "Field D"]:
        field_response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json={"name": name, "field_type": "text", "config": {}},
        )
        field_ids.append(field_response.json()["id"])

    # Add all fields to schema
    for idx, field_id in enumerate(field_ids):
        await client.post(
            f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
            json={"field_id": field_id, "display_order": idx, "show_on_card": idx < 2},
        )

    # Batch update only first 2 fields
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={
            "fields": [
                {"field_id": field_ids[1], "display_order": 0, "show_on_card": False},
                {"field_id": field_ids[0], "display_order": 1, "show_on_card": True},
            ]
        },
    )

    assert batch_response.status_code == 200
    data = batch_response.json()
    assert data["updated_count"] == 2

    # All 4 fields should still exist
    assert len(data["fields"]) == 4


@pytest.mark.asyncio
async def test_batch_update_toggle_show_on_card(
    client: AsyncClient, test_list: BookmarkList
):
    """Test toggling show_on_card flags in batch update."""
    # Create schema with 3 fields
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    field_ids = []
    for name in ["Field A", "Field B", "Field C"]:
        field_response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json={"name": name, "field_type": "boolean", "config": {}},
        )
        field_ids.append(field_response.json()["id"])

    # Add all fields with show_on_card=False
    for idx, field_id in enumerate(field_ids):
        await client.post(
            f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
            json={"field_id": field_id, "display_order": idx, "show_on_card": False},
        )

    # Batch update: turn on first 2
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={
            "fields": [
                {"field_id": field_ids[0], "display_order": 0, "show_on_card": True},
                {"field_id": field_ids[1], "display_order": 1, "show_on_card": True},
                {"field_id": field_ids[2], "display_order": 2, "show_on_card": False},
            ]
        },
    )

    assert batch_response.status_code == 200
    data = batch_response.json()

    # Verify exactly 2 show_on_card
    show_on_card_count = sum(1 for f in data["fields"] if f["show_on_card"])
    assert show_on_card_count == 2


@pytest.mark.asyncio
async def test_batch_update_reorder_display_order(
    client: AsyncClient, test_list: BookmarkList
):
    """Test reordering fields via batch update."""
    # Create schema with 5 fields
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    field_ids = []
    for i in range(5):
        field_response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json={
                "name": f"Field {i}",
                "field_type": "rating",
                "config": {"max_rating": 5},
            },
        )
        field_ids.append(field_response.json()["id"])

    # Add all fields in order 0-4
    for idx, field_id in enumerate(field_ids):
        await client.post(
            f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
            json={"field_id": field_id, "display_order": idx, "show_on_card": idx < 3},
        )

    # Batch update: completely reverse order
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={
            "fields": [
                {"field_id": field_ids[4], "display_order": 0, "show_on_card": True},
                {"field_id": field_ids[3], "display_order": 1, "show_on_card": True},
                {"field_id": field_ids[2], "display_order": 2, "show_on_card": True},
                {"field_id": field_ids[1], "display_order": 3, "show_on_card": False},
                {"field_id": field_ids[0], "display_order": 4, "show_on_card": False},
            ]
        },
    )

    assert batch_response.status_code == 200
    data = batch_response.json()

    # Verify reversed order
    for idx, field in enumerate(data["fields"]):
        assert field["field_id"] == field_ids[4 - idx]
        assert field["display_order"] == idx


@pytest.mark.asyncio
async def test_batch_update_max_3_show_on_card_enforcement(
    client: AsyncClient, test_list: BookmarkList
):
    """Test that max 3 show_on_card constraint is enforced."""
    # Create schema with 4 fields
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    field_ids = []
    for i in range(4):
        field_response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json={"name": f"Field {i}", "field_type": "text", "config": {}},
        )
        field_ids.append(field_response.json()["id"])

    # Add all fields
    for idx, field_id in enumerate(field_ids):
        await client.post(
            f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
            json={"field_id": field_id, "display_order": idx, "show_on_card": False},
        )

    # Try batch update with 4 show_on_card=true (should fail)
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={
            "fields": [
                {"field_id": field_ids[0], "display_order": 0, "show_on_card": True},
                {"field_id": field_ids[1], "display_order": 1, "show_on_card": True},
                {"field_id": field_ids[2], "display_order": 2, "show_on_card": True},
                {"field_id": field_ids[3], "display_order": 3, "show_on_card": True},
            ]
        },
    )

    assert batch_response.status_code == 422
    assert "show_on_card" in batch_response.json()["detail"][0]["msg"].lower()


@pytest.mark.asyncio
async def test_batch_update_duplicate_display_order_error(
    client: AsyncClient, test_list: BookmarkList
):
    """Test that duplicate display_order values are rejected."""
    # Create schema with 3 fields
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    field_ids = []
    for i in range(3):
        field_response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json={
                "name": f"Field {i}",
                "field_type": "rating",
                "config": {"max_rating": 5},
            },
        )
        field_ids.append(field_response.json()["id"])

    # Add all fields
    for idx, field_id in enumerate(field_ids):
        await client.post(
            f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
            json={"field_id": field_id, "display_order": idx, "show_on_card": True},
        )

    # Try batch update with duplicate display_order (should fail)
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={
            "fields": [
                {"field_id": field_ids[0], "display_order": 0, "show_on_card": True},
                {
                    "field_id": field_ids[1],
                    "display_order": 0,
                    "show_on_card": True,
                },  # Duplicate!
                {"field_id": field_ids[2], "display_order": 2, "show_on_card": True},
            ]
        },
    )

    assert batch_response.status_code == 422
    assert "display_order" in batch_response.json()["detail"][0]["msg"].lower()


@pytest.mark.asyncio
async def test_batch_update_invalid_field_id_error(
    client: AsyncClient, test_list: BookmarkList
):
    """Test that invalid field_id is rejected."""
    # Create schema
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    # Try batch update with non-existent field_id
    fake_field_id = str(uuid4())
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={
            "fields": [
                {"field_id": fake_field_id, "display_order": 0, "show_on_card": True}
            ]
        },
    )

    assert batch_response.status_code == 404
    assert "field_ids not found" in batch_response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_batch_update_field_from_different_list_error(
    client: AsyncClient, test_list: BookmarkList
):
    """Test that field from different list is rejected (security check)."""
    # Create 2 lists
    list2_response = await client.post("/api/lists", json={"name": "List 2"})
    list2_id = list2_response.json()["id"]

    # Create schema in list1
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    # Create field in list2
    field_response = await client.post(
        f"/api/lists/{list2_id}/custom-fields",
        json={"name": "Field from List 2", "field_type": "text", "config": {}},
    )
    field_id = field_response.json()["id"]

    # Try batch update with field from different list (should fail)
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={
            "fields": [{"field_id": field_id, "display_order": 0, "show_on_card": True}]
        },
    )

    assert batch_response.status_code == 404
    assert "different list" in batch_response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_batch_update_schema_not_found_error(
    client: AsyncClient, test_list: BookmarkList
):
    """Test that non-existent schema returns 404."""
    fake_schema_id = str(uuid4())
    fake_field_id = str(uuid4())

    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{fake_schema_id}/fields/batch",
        json={
            "fields": [
                {"field_id": fake_field_id, "display_order": 0, "show_on_card": True}
            ]
        },
    )

    assert batch_response.status_code == 404
    assert "schema not found" in batch_response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_batch_update_empty_list_error(
    client: AsyncClient, test_list: BookmarkList
):
    """Test that empty fields list is rejected (min_length=1)."""
    # Create schema
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    # Try batch update with empty list (should fail)
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={"fields": []},
    )

    assert batch_response.status_code == 422


@pytest.mark.asyncio
async def test_batch_update_batch_size_limit_50(
    client: AsyncClient, test_list: BookmarkList
):
    """Test that batch size limit of 50 is enforced."""
    # Create schema
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    # Try batch update with 51 items (should fail)
    fake_fields = [
        {"field_id": str(uuid4()), "display_order": i, "show_on_card": False}
        for i in range(51)
    ]

    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={"fields": fake_fields},
    )

    assert batch_response.status_code == 422


@pytest.mark.asyncio
async def test_batch_update_upsert_creates_missing_associations(
    client: AsyncClient, test_list: BookmarkList
):
    """Test that UPSERT creates missing schema_field associations."""
    # Create schema
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas", json={"name": "Test Schema"}
    )
    schema_id = schema_response.json()["id"]

    # Create 2 fields but only add 1 to schema
    field_ids = []
    for name in ["Field A", "Field B"]:
        field_response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json={
                "name": name,
                "field_type": "select",
                "config": {"options": ["good", "bad"]},
            },
        )
        field_ids.append(field_response.json()["id"])

    # Add only first field to schema
    await client.post(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields",
        json={"field_id": field_ids[0], "display_order": 0, "show_on_card": True},
    )

    # Batch update with both fields (should UPSERT second field)
    batch_response = await client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}/fields/batch",
        json={
            "fields": [
                {"field_id": field_ids[0], "display_order": 0, "show_on_card": True},
                {
                    "field_id": field_ids[1],
                    "display_order": 1,
                    "show_on_card": True,
                },  # NEW!
            ]
        },
    )

    assert batch_response.status_code == 200
    data = batch_response.json()

    # Both fields should now be in schema
    assert len(data["fields"]) == 2
    assert data["fields"][0]["field_id"] == field_ids[0]
    assert data["fields"][1]["field_id"] == field_ids[1]
