"""
Tests for subscription API endpoints.
"""

import uuid

import pytest
from httpx import AsyncClient


async def create_test_list(client: AsyncClient) -> dict:
    """Helper to create a test list."""
    response = await client.post(
        "/api/lists",
        json={
            "name": f"Sub Test List {uuid.uuid4().hex[:8]}",
            "description": "For testing",
        },
    )
    return response.json()


@pytest.mark.asyncio
async def test_create_subscription_minimal(client: AsyncClient):
    """Test creating a subscription with minimal data."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    response = await client.post(
        "/api/subscriptions",
        json={
            "list_id": list_id,
            "name": "Test Subscription",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Subscription"
    assert data["list_id"] == list_id
    assert data["is_active"] is True
    assert data["poll_interval"] == "daily"
    assert data["match_count"] == 0
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_subscription_with_channels(client: AsyncClient):
    """Test creating a subscription with channel filters."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    response = await client.post(
        "/api/subscriptions",
        json={
            "list_id": list_id,
            "name": "Channel Subscription",
            "channel_ids": ["UCX6OQ3DkcsbYNE6H8uQQuVA", "UC-lHJZR3Gqxm24_Vd_AJ5Yw"],
            "poll_interval": "twice_daily",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Channel Subscription"
    assert data["channel_ids"] == [
        "UCX6OQ3DkcsbYNE6H8uQQuVA",
        "UC-lHJZR3Gqxm24_Vd_AJ5Yw",
    ]
    assert data["poll_interval"] == "twice_daily"


@pytest.mark.asyncio
async def test_create_subscription_with_keywords(client: AsyncClient):
    """Test creating a subscription with keyword filters."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    response = await client.post(
        "/api/subscriptions",
        json={
            "list_id": list_id,
            "name": "Keyword Subscription",
            "keywords": ["FastAPI", "Python", "Tutorial"],
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["keywords"] == ["FastAPI", "Python", "Tutorial"]


@pytest.mark.asyncio
async def test_create_subscription_with_filters(client: AsyncClient):
    """Test creating a subscription with meta filters."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    response = await client.post(
        "/api/subscriptions",
        json={
            "list_id": list_id,
            "name": "Filtered Subscription",
            "keywords": ["Python"],
            "filters": {
                "duration": {"min_seconds": 600, "max_seconds": 3600},
                "views": {"min_views": 10000},
            },
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["filters"]["duration"]["min_seconds"] == 600
    assert data["filters"]["duration"]["max_seconds"] == 3600
    assert data["filters"]["views"]["min_views"] == 10000


@pytest.mark.asyncio
async def test_create_subscription_invalid_list(client: AsyncClient):
    """Test creating a subscription with non-existent list fails."""
    fake_list_id = str(uuid.uuid4())

    response = await client.post(
        "/api/subscriptions",
        json={
            "list_id": fake_list_id,
            "name": "Invalid Subscription",
        },
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_subscriptions(client: AsyncClient):
    """Test listing subscriptions."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    # Create two subscriptions
    await client.post(
        "/api/subscriptions",
        json={"list_id": list_id, "name": "Sub 1"},
    )
    await client.post(
        "/api/subscriptions",
        json={"list_id": list_id, "name": "Sub 2"},
    )

    response = await client.get("/api/subscriptions")

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    names = [s["name"] for s in data]
    assert "Sub 1" in names
    assert "Sub 2" in names


@pytest.mark.asyncio
async def test_get_subscription(client: AsyncClient):
    """Test getting a single subscription."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    create_resp = await client.post(
        "/api/subscriptions",
        json={"list_id": list_id, "name": "Get Test Sub"},
    )
    sub_id = create_resp.json()["id"]

    response = await client.get(f"/api/subscriptions/{sub_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == sub_id
    assert data["name"] == "Get Test Sub"


@pytest.mark.asyncio
async def test_get_subscription_not_found(client: AsyncClient):
    """Test getting a non-existent subscription returns 404."""
    fake_id = str(uuid.uuid4())

    response = await client.get(f"/api/subscriptions/{fake_id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_subscription(client: AsyncClient):
    """Test updating a subscription."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    create_resp = await client.post(
        "/api/subscriptions",
        json={"list_id": list_id, "name": "Old Name"},
    )
    sub_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/subscriptions/{sub_id}",
        json={
            "name": "New Name",
            "keywords": ["Updated", "Keywords"],
            "poll_interval": "twice_daily",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["keywords"] == ["Updated", "Keywords"]
    assert data["poll_interval"] == "twice_daily"


@pytest.mark.asyncio
async def test_update_subscription_deactivate(client: AsyncClient):
    """Test deactivating a subscription."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    create_resp = await client.post(
        "/api/subscriptions",
        json={"list_id": list_id, "name": "To Deactivate"},
    )
    sub_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/subscriptions/{sub_id}",
        json={"is_active": False},
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is False


@pytest.mark.asyncio
async def test_update_subscription_not_found(client: AsyncClient):
    """Test updating a non-existent subscription returns 404."""
    fake_id = str(uuid.uuid4())

    response = await client.put(
        f"/api/subscriptions/{fake_id}",
        json={"name": "Updated"},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_subscription(client: AsyncClient):
    """Test deleting a subscription."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    create_resp = await client.post(
        "/api/subscriptions",
        json={"list_id": list_id, "name": "To Delete"},
    )
    sub_id = create_resp.json()["id"]

    # Delete
    response = await client.delete(f"/api/subscriptions/{sub_id}")
    assert response.status_code == 204

    # Verify deleted
    get_resp = await client.get(f"/api/subscriptions/{sub_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_subscription_not_found(client: AsyncClient):
    """Test deleting a non-existent subscription returns 404."""
    fake_id = str(uuid.uuid4())

    response = await client.delete(f"/api/subscriptions/{fake_id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_sync_subscription(client: AsyncClient):
    """Test manual sync of a subscription (stub returns 0)."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    create_resp = await client.post(
        "/api/subscriptions",
        json={"list_id": list_id, "name": "To Sync"},
    )
    sub_id = create_resp.json()["id"]

    response = await client.post(f"/api/subscriptions/{sub_id}/sync")

    assert response.status_code == 200
    data = response.json()
    assert data["new_videos"] == 0  # Stub implementation


@pytest.mark.asyncio
async def test_sync_subscription_not_found(client: AsyncClient):
    """Test syncing a non-existent subscription returns 404."""
    fake_id = str(uuid.uuid4())

    response = await client.post(f"/api/subscriptions/{fake_id}/sync")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_subscription_matches_empty(client: AsyncClient):
    """Test getting matches for a subscription with no matches."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    create_resp = await client.post(
        "/api/subscriptions",
        json={"list_id": list_id, "name": "No Matches"},
    )
    sub_id = create_resp.json()["id"]

    response = await client.get(f"/api/subscriptions/{sub_id}/matches")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_subscription_matches_not_found(client: AsyncClient):
    """Test getting matches for non-existent subscription returns 404."""
    fake_id = str(uuid.uuid4())

    response = await client.get(f"/api/subscriptions/{fake_id}/matches")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_subscriptions_pagination(client: AsyncClient):
    """Test pagination of subscription list."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    # Create 5 subscriptions
    for i in range(5):
        await client.post(
            "/api/subscriptions",
            json={"list_id": list_id, "name": f"Pag Sub {i}"},
        )

    # Get first page
    response = await client.get("/api/subscriptions?skip=0&limit=2")
    assert response.status_code == 200
    assert len(response.json()) == 2

    # Get second page
    response = await client.get("/api/subscriptions?skip=2&limit=2")
    assert response.status_code == 200
    assert len(response.json()) == 2


# ============================================================================
# Quota Status API Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_quota_status(client: AsyncClient):
    """Test getting YouTube API quota status."""
    response = await client.get("/api/subscriptions/quota")

    assert response.status_code == 200
    data = response.json()
    assert "used" in data
    assert "remaining" in data
    assert "limit" in data
    assert "percentage" in data
    # Check types
    assert isinstance(data["used"], int)
    assert isinstance(data["remaining"], int)
    assert isinstance(data["limit"], int)
    assert isinstance(data["percentage"], (int, float))


@pytest.mark.asyncio
async def test_get_quota_status_values(client: AsyncClient):
    """Test quota status returns reasonable values."""
    response = await client.get("/api/subscriptions/quota")

    assert response.status_code == 200
    data = response.json()
    # Default YouTube quota limit
    assert data["limit"] == 10000
    # Remaining should never be negative
    assert data["remaining"] >= 0
    # Percentage should be between 0-100+
    assert data["percentage"] >= 0
