import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.video import Video


@pytest.mark.asyncio
async def test_filter_videos_by_tags_or(client: AsyncClient, test_db: AsyncSession, test_list, test_user):
    """Test filtering videos by tags with OR logic (any matching tag)."""
    # Arrange: Create tags
    tag1_resp = await client.post("/api/tags", json={"name": "Python"})
    tag1_id = tag1_resp.json()["id"]

    tag2_resp = await client.post("/api/tags", json={"name": "Tutorial"})
    tag2_id = tag2_resp.json()["id"]

    # Create videos directly in database
    video1 = Video(
        list_id=test_list.id,
        youtube_id="VIDEO_ID_1",
        title="Python Video"
    )
    video2 = Video(
        list_id=test_list.id,
        youtube_id="VIDEO_ID_2",
        title="Tutorial Video"
    )
    test_db.add(video1)
    test_db.add(video2)
    await test_db.commit()
    await test_db.refresh(video1)
    await test_db.refresh(video2)

    # Assign tags: Video 1 has Python, Video 2 has Tutorial
    await client.post(f"/api/videos/{video1.id}/tags", json={"tag_ids": [tag1_id]})
    await client.post(f"/api/videos/{video2.id}/tags", json={"tag_ids": [tag2_id]})

    # Act: Filter by Python OR Tutorial (using repeated params)
    response = await client.get(
        "/api/videos",
        params={"tags": ["Python", "Tutorial"]}
    )

    # Assert: Both videos should match
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    video_ids = {v["id"] for v in data}
    assert str(video1.id) in video_ids
    assert str(video2.id) in video_ids


@pytest.mark.asyncio
async def test_filter_videos_by_tags_and(client: AsyncClient, test_db: AsyncSession, test_list, test_user):
    """Test filtering videos by tags with AND logic (all tags required)."""
    # Arrange: Create tags (use different names than OR test to avoid conflicts)
    tag1_resp = await client.post("/api/tags", json={"name": "JavaScript"})
    tag1_id = tag1_resp.json()["id"]

    tag2_resp = await client.post("/api/tags", json={"name": "Expert"})
    tag2_id = tag2_resp.json()["id"]

    # Create videos
    # Video 1 has BOTH Python and Advanced tags
    video1 = Video(
        list_id=test_list.id,
        youtube_id="VIDEO_ID_1",
        title="Advanced Python Video"
    )
    # Video 2 has ONLY Python tag
    video2 = Video(
        list_id=test_list.id,
        youtube_id="VIDEO_ID_2",
        title="Basic Python Video"
    )
    test_db.add(video1)
    test_db.add(video2)
    await test_db.commit()
    await test_db.refresh(video1)
    await test_db.refresh(video2)

    # Assign tags
    await client.post(f"/api/videos/{video1.id}/tags", json={"tag_ids": [tag1_id, tag2_id]})
    await client.post(f"/api/videos/{video2.id}/tags", json={"tag_ids": [tag1_id]})

    # Act: Filter by JavaScript AND Expert (using tags_all param)
    response = await client.get(
        "/api/videos",
        params={"tags_all": ["JavaScript", "Expert"]}
    )

    # Assert: Only video1 should match (has both tags)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(video1.id)


@pytest.mark.asyncio
async def test_filter_videos_by_tags_or_case_insensitive(client: AsyncClient, test_db: AsyncSession, test_list, test_user):
    """Test filtering videos by tags with OR logic is case-insensitive."""
    # Arrange: Create tags with UPPERCASE names
    tag1_resp = await client.post("/api/tags", json={"name": "GOLANG"})
    tag1_id = tag1_resp.json()["id"]

    tag2_resp = await client.post("/api/tags", json={"name": "BEGINNERS"})
    tag2_id = tag2_resp.json()["id"]

    # Create videos
    video1 = Video(
        list_id=test_list.id,
        youtube_id="VIDEO_ID_GOLANG",
        title="Golang Video"
    )
    video2 = Video(
        list_id=test_list.id,
        youtube_id="VIDEO_ID_BEGINNERS",
        title="Beginners Video"
    )
    test_db.add(video1)
    test_db.add(video2)
    await test_db.commit()
    await test_db.refresh(video1)
    await test_db.refresh(video2)

    # Assign tags
    await client.post(f"/api/videos/{video1.id}/tags", json={"tag_ids": [tag1_id]})
    await client.post(f"/api/videos/{video2.id}/tags", json={"tag_ids": [tag2_id]})

    # Act: Search with lowercase tags (tags in DB are uppercase)
    response = await client.get(
        "/api/videos",
        params={"tags": ["golang", "beginners"]}
    )

    # Assert: Should find both videos (case-insensitive match)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    video_ids = {v["id"] for v in data}
    assert str(video1.id) in video_ids
    assert str(video2.id) in video_ids


@pytest.mark.asyncio
async def test_filter_videos_by_tags_and_case_insensitive(client: AsyncClient, test_db: AsyncSession, test_list, test_user):
    """Test filtering videos by tags with AND logic is case-insensitive."""
    # Arrange: Create tags with MixedCase names
    tag1_resp = await client.post("/api/tags", json={"name": "MachineLearning"})
    tag1_id = tag1_resp.json()["id"]

    tag2_resp = await client.post("/api/tags", json={"name": "DeepDive"})
    tag2_id = tag2_resp.json()["id"]

    # Create video with both tags
    video = Video(
        list_id=test_list.id,
        youtube_id="VIDEO_ID_ML",
        title="ML Deep Dive"
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Assign both tags
    await client.post(f"/api/videos/{video.id}/tags", json={"tag_ids": [tag1_id, tag2_id]})

    # Act: Search with LOWERCASE tags (tags in DB are MixedCase)
    response = await client.get(
        "/api/videos",
        params={"tags_all": ["machinelearning", "deepdive"]}
    )

    # Assert: Should find the video (case-insensitive match)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(video.id)
