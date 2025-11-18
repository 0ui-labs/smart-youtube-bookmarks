"""Tests for bulk tag assignment endpoint."""
import pytest
import random
import string
from httpx import AsyncClient


def generate_youtube_id() -> str:
    """Generate a realistic YouTube video ID (11 chars from [A-Za-z0-9_-])."""
    chars = string.ascii_letters + string.digits + '_-'
    return ''.join(random.choices(chars, k=11))


@pytest.mark.asyncio
async def test_bulk_assign_tags_to_videos(client: AsyncClient, test_user, test_list, test_video):
    """Test bulk assigning tags to multiple videos."""
    # Use existing test_video and create one more video
    video1_id = str(test_video.id)

    # Create second video with unique YouTube ID
    video2_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": f"https://www.youtube.com/watch?v={generate_youtube_id()}"}
    )
    assert video2_response.status_code == 201
    video2_id = video2_response.json()["id"]

    # Create 2 tags
    tag1_response = await client.post("/api/tags", json={"name": "BulkTest1"})
    tag2_response = await client.post("/api/tags", json={"name": "BulkTest2"})
    tag1_id = tag1_response.json()["id"]
    tag2_id = tag2_response.json()["id"]

    # Bulk assign: 2 videos × 2 tags = 4 assignments
    response = await client.post(
        "/api/videos/bulk/tags",
        json={
            "video_ids": [video1_id, video2_id],
            "tag_ids": [tag1_id, tag2_id]
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["assigned"] == 4
    assert data["total_requested"] == 4


@pytest.mark.asyncio
async def test_bulk_assign_idempotency(client: AsyncClient, test_user, test_list, test_video):
    """Test that bulk assign is idempotent (duplicates ignored)."""
    import uuid
    video_id = str(test_video.id)

    # Create tag
    tag_response = await client.post("/api/tags", json={"name": "IdempotentTag"})
    tag_id = tag_response.json()["id"]

    # First bulk assign
    response1 = await client.post(
        "/api/videos/bulk/tags",
        json={
            "video_ids": [video_id],
            "tag_ids": [tag_id]
        }
    )
    assert response1.status_code == 200
    data1 = response1.json()
    assert data1["assigned"] == 1
    assert data1["total_requested"] == 1

    # Second bulk assign (same IDs) - should be idempotent
    response2 = await client.post(
        "/api/videos/bulk/tags",
        json={
            "video_ids": [video_id],
            "tag_ids": [tag_id]
        }
    )
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["assigned"] == 0  # No new assignments
    assert data2["total_requested"] == 1  # Still requested 1


@pytest.mark.asyncio
async def test_bulk_assign_nonexistent_video(client: AsyncClient, test_user, test_list, test_video):
    """Test bulk assign with non-existent video_id returns 404."""
    import uuid

    # Create tag
    tag_response = await client.post("/api/tags", json={"name": "TestTag"})
    tag_id = tag_response.json()["id"]

    # Use fake video UUID
    fake_video_id = str(uuid.uuid4())

    response = await client.post(
        "/api/videos/bulk/tags",
        json={
            "video_ids": [fake_video_id],
            "tag_ids": [tag_id]
        }
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Some videos not found"


@pytest.mark.asyncio
async def test_bulk_assign_nonexistent_tag(client: AsyncClient, test_user, test_list, test_video):
    """Test bulk assign with non-existent tag_id returns 404."""
    import uuid

    video_id = str(test_video.id)
    fake_tag_id = str(uuid.uuid4())

    response = await client.post(
        "/api/videos/bulk/tags",
        json={
            "video_ids": [video_id],
            "tag_ids": [fake_tag_id]
        }
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Some tags not found"


@pytest.mark.asyncio
async def test_bulk_assign_empty_arrays(client: AsyncClient, test_user, test_list, test_video):
    """Test bulk assign with empty arrays gracefully handled."""
    response = await client.post(
        "/api/videos/bulk/tags",
        json={
            "video_ids": [],
            "tag_ids": []
        }
    )

    # Should succeed with 0 assignments
    assert response.status_code == 200
    data = response.json()
    assert data["assigned"] == 0
    assert data["total_requested"] == 0


@pytest.mark.asyncio
async def test_bulk_assign_batch_too_large(client: AsyncClient, test_user, test_list, test_video):
    """Test bulk assign rejects batches larger than 10,000 assignments."""
    import uuid

    # Create 101 fake video IDs and 101 fake tag IDs
    # 101 × 101 = 10,201 assignments (exceeds limit)
    fake_video_ids = [str(uuid.uuid4()) for _ in range(101)]
    fake_tag_ids = [str(uuid.uuid4()) for _ in range(101)]

    response = await client.post(
        "/api/videos/bulk/tags",
        json={
            "video_ids": fake_video_ids,
            "tag_ids": fake_tag_ids
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Batch exceeds 10,000 assignments"


@pytest.mark.asyncio
async def test_bulk_assign_partial_overlap(client: AsyncClient, test_user, test_list, test_video):
    """Test bulk assign with partial overlap (some tags already assigned)."""
    video_id = str(test_video.id)

    # Create 3 tags
    tag1_response = await client.post("/api/tags", json={"name": "OverlapTag1"})
    tag2_response = await client.post("/api/tags", json={"name": "OverlapTag2"})
    tag3_response = await client.post("/api/tags", json={"name": "OverlapTag3"})
    tag1_id = tag1_response.json()["id"]
    tag2_id = tag2_response.json()["id"]
    tag3_id = tag3_response.json()["id"]

    # Assign 2 tags first
    await client.post(
        f"/api/videos/{video_id}/tags",
        json={"tag_ids": [tag1_id, tag2_id]}
    )

    # Now bulk assign all 3 tags (2 existing, 1 new)
    response = await client.post(
        "/api/videos/bulk/tags",
        json={
            "video_ids": [video_id],
            "tag_ids": [tag1_id, tag2_id, tag3_id]
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["assigned"] == 1  # Only 1 new assignment (tag3)
    assert data["total_requested"] == 3  # Requested 3 total
