import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_tag(client: AsyncClient, test_user):
    """Test creating a new tag."""
    response = await client.post(
        "/api/tags",
        json={"name": "Python", "color": "#3B82F6"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Python"
    assert data["color"] == "#3B82F6"
    assert "id" in data
    assert "user_id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_duplicate_tag(client: AsyncClient, test_user):
    """Test creating a duplicate tag fails."""
    # Create first tag
    await client.post("/api/tags", json={"name": "Python"})

    # Try to create duplicate
    response = await client.post("/api/tags", json={"name": "Python"})

    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_tags(client: AsyncClient, test_user):
    """Test listing all tags."""
    # Create two tags
    await client.post("/api/tags", json={"name": "Python"})
    await client.post("/api/tags", json={"name": "Tutorial"})

    # List tags
    response = await client.get("/api/tags")

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert any(t["name"] == "Python" for t in data)
    assert any(t["name"] == "Tutorial" for t in data)


@pytest.mark.asyncio
async def test_get_tag(client: AsyncClient, test_user):
    """Test getting a specific tag by ID."""
    # Create tag with unique name
    create_response = await client.post("/api/tags", json={"name": "GetTagTest"})
    tag_id = create_response.json()["id"]

    # Get tag
    response = await client.get(f"/api/tags/{tag_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == tag_id
    assert data["name"] == "GetTagTest"


@pytest.mark.asyncio
async def test_get_tag_not_found(client: AsyncClient, test_user):
    """Test getting a non-existent tag returns 404."""
    import uuid
    fake_id = str(uuid.uuid4())

    response = await client.get(f"/api/tags/{fake_id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_tag(client: AsyncClient, test_user):
    """Test updating a tag."""
    # Create tag
    create_response = await client.post("/api/tags", json={"name": "OldName"})
    tag_id = create_response.json()["id"]

    # Update tag
    response = await client.put(
        f"/api/tags/{tag_id}",
        json={"name": "NewName", "color": "#FF5733"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "NewName"
    assert data["color"] == "#FF5733"


@pytest.mark.asyncio
async def test_update_tag_duplicate_name(client: AsyncClient, test_user):
    """Test updating tag to duplicate name fails."""
    # Create two tags
    await client.post("/api/tags", json={"name": "ExistingTag"})
    create_response = await client.post("/api/tags", json={"name": "TagToRename"})
    tag_id = create_response.json()["id"]

    # Try to rename second tag to match first tag
    response = await client.put(
        f"/api/tags/{tag_id}",
        json={"name": "ExistingTag"}
    )

    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_tag_updates_timestamp(client: AsyncClient, test_user):
    """Test that updating a tag automatically updates the updated_at timestamp."""
    import asyncio
    from datetime import datetime

    # Create tag
    create_response = await client.post("/api/tags", json={"name": "TimestampTest"})
    tag_id = create_response.json()["id"]
    original_updated_at = create_response.json()["updated_at"]

    # Wait a moment to ensure timestamps differ
    await asyncio.sleep(0.1)

    # Update tag
    update_response = await client.put(
        f"/api/tags/{tag_id}",
        json={"name": "TimestampTestUpdated"}
    )

    assert update_response.status_code == 200
    new_updated_at = update_response.json()["updated_at"]

    # Verify updated_at changed
    assert new_updated_at != original_updated_at
    assert new_updated_at > original_updated_at


@pytest.mark.asyncio
async def test_delete_tag(client: AsyncClient, test_user):
    """Test deleting a tag."""
    # Create tag
    create_response = await client.post("/api/tags", json={"name": "ToDelete"})
    tag_id = create_response.json()["id"]

    # Delete tag
    response = await client.delete(f"/api/tags/{tag_id}")

    assert response.status_code == 204

    # Verify deleted
    get_response = await client.get(f"/api/tags/{tag_id}")
    assert get_response.status_code == 404
