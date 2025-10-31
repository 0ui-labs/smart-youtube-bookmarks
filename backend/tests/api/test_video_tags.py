"""Tests for video-tag assignment endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_assign_tags_to_video(client: AsyncClient, test_user, test_list, test_video):
    """Test assigning tags to a video."""
    # Create two tags
    tag1_response = await client.post("/api/tags", json={"name": "Tutorial"})
    tag2_response = await client.post("/api/tags", json={"name": "Python"})
    tag1_id = tag1_response.json()["id"]
    tag2_id = tag2_response.json()["id"]

    # Assign tags to video
    response = await client.post(
        f"/api/videos/{test_video.id}/tags",
        json={"tag_ids": [tag1_id, tag2_id]}
    )

    assert response.status_code == 200
    tags = response.json()
    assert len(tags) == 2
    assert any(t["name"] == "Tutorial" for t in tags)
    assert any(t["name"] == "Python" for t in tags)


@pytest.mark.asyncio
async def test_assign_duplicate_tag(client: AsyncClient, test_user, test_list, test_video):
    """Test assigning the same tag twice is idempotent."""
    # Create tag
    tag_response = await client.post("/api/tags", json={"name": "DuplicateTest"})
    tag_id = tag_response.json()["id"]

    # Assign tag twice
    await client.post(f"/api/videos/{test_video.id}/tags", json={"tag_ids": [tag_id]})
    response = await client.post(f"/api/videos/{test_video.id}/tags", json={"tag_ids": [tag_id]})

    assert response.status_code == 200
    tags = response.json()
    # Should still have only one tag
    assert len([t for t in tags if t["name"] == "DuplicateTest"]) == 1


@pytest.mark.asyncio
async def test_remove_tag_from_video(client: AsyncClient, test_user, test_list, test_video):
    """Test removing a tag from a video."""
    # Create and assign tag
    tag_response = await client.post("/api/tags", json={"name": "RemoveTest"})
    tag_id = tag_response.json()["id"]
    await client.post(f"/api/videos/{test_video.id}/tags", json={"tag_ids": [tag_id]})

    # Remove tag
    response = await client.delete(f"/api/videos/{test_video.id}/tags/{tag_id}")

    assert response.status_code == 204

    # Verify tag is removed
    tags_response = await client.get(f"/api/videos/{test_video.id}/tags")
    assert not any(t["id"] == tag_id for t in tags_response.json())


@pytest.mark.asyncio
async def test_remove_nonexistent_tag(client: AsyncClient, test_user, test_list, test_video):
    """Test removing a tag that's not assigned returns 404."""
    import uuid
    fake_tag_id = str(uuid.uuid4())

    response = await client.delete(f"/api/videos/{test_video.id}/tags/{fake_tag_id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_video_tags(client: AsyncClient, test_user, test_list, test_video):
    """Test getting all tags for a video."""
    # Create and assign tags
    tag1_response = await client.post("/api/tags", json={"name": "GetTest1"})
    tag2_response = await client.post("/api/tags", json={"name": "GetTest2"})
    tag1_id = tag1_response.json()["id"]
    tag2_id = tag2_response.json()["id"]
    await client.post(f"/api/videos/{test_video.id}/tags", json={"tag_ids": [tag1_id, tag2_id]})

    # Get video tags
    response = await client.get(f"/api/videos/{test_video.id}/tags")

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert any(t["name"] == "GetTest1" for t in data)
    assert any(t["name"] == "GetTest2" for t in data)
