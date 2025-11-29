import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video


@pytest.mark.asyncio
async def test_filter_videos_by_tags_or(
    client: AsyncClient, test_db: AsyncSession, test_list
):
    """Test filtering videos by tags with OR logic (any matching tag)."""
    # Arrange: Create tags
    tag1_resp = await client.post("/api/tags", json={"name": "Python"})
    tag1_id = tag1_resp.json()["id"]

    tag2_resp = await client.post("/api/tags", json={"name": "Tutorial"})
    tag2_id = tag2_resp.json()["id"]

    # Create videos directly in database
    video1 = Video(list_id=test_list.id, youtube_id="VIDEO_ID_1", title="Python Video")
    video2 = Video(
        list_id=test_list.id, youtube_id="VIDEO_ID_2", title="Tutorial Video"
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
    response = await client.get("/api/videos", params={"tags": ["Python", "Tutorial"]})

    # Assert: Both videos should match
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    video_ids = {v["id"] for v in data}
    assert str(video1.id) in video_ids
    assert str(video2.id) in video_ids


@pytest.mark.asyncio
async def test_filter_videos_by_tags_and(
    client: AsyncClient, test_db: AsyncSession, test_list
):
    """Test filtering videos by tags with AND logic (all tags required)."""
    # Arrange: Create tags (use different names than OR test to avoid conflicts)
    tag1_resp = await client.post("/api/tags", json={"name": "JavaScript"})
    tag1_id = tag1_resp.json()["id"]

    tag2_resp = await client.post("/api/tags", json={"name": "Expert"})
    tag2_id = tag2_resp.json()["id"]

    # Create videos
    # Video 1 has BOTH JavaScript and Expert tags
    video1 = Video(
        list_id=test_list.id, youtube_id="VIDEO_ID_1", title="Advanced JavaScript Video"
    )
    # Video 2 has ONLY JavaScript tag
    video2 = Video(
        list_id=test_list.id, youtube_id="VIDEO_ID_2", title="Basic JavaScript Video"
    )
    test_db.add(video1)
    test_db.add(video2)
    await test_db.commit()
    await test_db.refresh(video1)
    await test_db.refresh(video2)

    # Assign tags
    await client.post(
        f"/api/videos/{video1.id}/tags", json={"tag_ids": [tag1_id, tag2_id]}
    )
    await client.post(f"/api/videos/{video2.id}/tags", json={"tag_ids": [tag1_id]})

    # Act: Filter by JavaScript AND Expert (using tags_all param)
    response = await client.get(
        "/api/videos", params={"tags_all": ["JavaScript", "Expert"]}
    )

    # Assert: Only video1 should match (has both tags)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(video1.id)


@pytest.mark.asyncio
async def test_filter_videos_by_tags_or_case_insensitive(
    client: AsyncClient, test_db: AsyncSession, test_list
):
    """Test filtering videos by tags with OR logic is case-insensitive."""
    # Arrange: Create tags with UPPERCASE names
    tag1_resp = await client.post("/api/tags", json={"name": "GOLANG"})
    tag1_id = tag1_resp.json()["id"]

    tag2_resp = await client.post("/api/tags", json={"name": "BEGINNERS"})
    tag2_id = tag2_resp.json()["id"]

    # Create videos
    video1 = Video(
        list_id=test_list.id, youtube_id="VIDEO_ID_GOLANG", title="Golang Video"
    )
    video2 = Video(
        list_id=test_list.id, youtube_id="VIDEO_ID_BEGINNERS", title="Beginners Video"
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
    response = await client.get("/api/videos", params={"tags": ["golang", "beginners"]})

    # Assert: Should find both videos (case-insensitive match)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    video_ids = {v["id"] for v in data}
    assert str(video1.id) in video_ids
    assert str(video2.id) in video_ids


@pytest.mark.asyncio
async def test_filter_videos_by_tags_and_case_insensitive(
    client: AsyncClient, test_db: AsyncSession, test_list
):
    """Test filtering videos by tags with AND logic is case-insensitive."""
    # Arrange: Create tags with MixedCase names
    tag1_resp = await client.post("/api/tags", json={"name": "MachineLearning"})
    tag1_id = tag1_resp.json()["id"]

    tag2_resp = await client.post("/api/tags", json={"name": "DeepDive"})
    tag2_id = tag2_resp.json()["id"]

    # Create video with both tags
    video = Video(list_id=test_list.id, youtube_id="VIDEO_ID_ML", title="ML Deep Dive")
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Assign both tags
    await client.post(
        f"/api/videos/{video.id}/tags", json={"tag_ids": [tag1_id, tag2_id]}
    )

    # Act: Search with LOWERCASE tags (tags in DB are MixedCase)
    response = await client.get(
        "/api/videos", params={"tags_all": ["machinelearning", "deepdive"]}
    )

    # Assert: Should find the video (case-insensitive match)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(video.id)


@pytest.mark.asyncio
async def test_filter_videos_or_too_many_tags(
    client: AsyncClient, test_db: AsyncSession, test_list
):
    """Test OR filter with more than 10 tags returns 422 validation error."""
    # Act: Try to filter with 11 tags (exceeds max of 10)
    tags_list = [f"Tag{i}" for i in range(11)]
    response = await client.get("/api/videos", params={"tags": tags_list})

    # Assert: Should return 422 validation error
    assert response.status_code == 422
    error_detail = response.json()["detail"]
    # FastAPI/Pydantic validation error format
    assert isinstance(error_detail, list)
    assert any("tags" in str(err).lower() for err in error_detail)


@pytest.mark.asyncio
async def test_filter_videos_and_too_many_tags(
    client: AsyncClient, test_db: AsyncSession, test_list
):
    """Test AND filter with more than 10 tags returns 422 validation error."""
    # Act: Try to filter with 11 tags (exceeds max of 10)
    tags_list = [f"Tag{i}" for i in range(11)]
    response = await client.get("/api/videos", params={"tags_all": tags_list})

    # Assert: Should return 422 validation error
    assert response.status_code == 422
    error_detail = response.json()["detail"]
    assert isinstance(error_detail, list)
    assert any("tags_all" in str(err).lower() for err in error_detail)


@pytest.mark.asyncio
async def test_filter_videos_exactly_10_tags(
    client: AsyncClient, test_db: AsyncSession, test_list
):
    """Test filtering with exactly 10 tags works (boundary test)."""
    # Arrange: Create 10 tags
    tag_ids = []
    for i in range(10):
        tag_resp = await client.post("/api/tags", json={"name": f"BoundaryTag{i}"})
        tag_ids.append(tag_resp.json()["id"])

    # Create video with all 10 tags
    video = Video(
        list_id=test_list.id,
        youtube_id="VIDEO_ID_BOUNDARY",
        title="Boundary Test Video",
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Assign all 10 tags
    await client.post(f"/api/videos/{video.id}/tags", json={"tag_ids": tag_ids})

    # Act: Filter with exactly 10 tags (boundary - should work)
    tags_list = [f"BoundaryTag{i}" for i in range(10)]
    response = await client.get("/api/videos", params={"tags": tags_list})

    # Assert: Should return 200 and find the video
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(video.id)


# ============================================================================
# Field Filtering Tests - POST /api/lists/{list_id}/videos/filter
# ============================================================================


# Helper fixtures for field filtering tests
@pytest.fixture
async def test_field_rating(test_db: AsyncSession, test_list):
    """Create a test rating field."""
    from app.models.custom_field import CustomField

    field = CustomField(
        list_id=test_list.id,
        name="Overall Rating",
        field_type="rating",
        config={"max_rating": 5},
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


@pytest.fixture
async def test_field_select(test_db: AsyncSession, test_list):
    """Create a test select field."""
    from app.models.custom_field import CustomField

    field = CustomField(
        list_id=test_list.id,
        name="Quality",
        field_type="select",
        config={"options": ["bad", "good", "great"]},
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


@pytest.fixture
async def test_field_text(test_db: AsyncSession, test_list):
    """Create a test text field."""
    from app.models.custom_field import CustomField

    field = CustomField(
        list_id=test_list.id, name="Notes", field_type="text", config={}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


@pytest.fixture
async def test_field_boolean(test_db: AsyncSession, test_list):
    """Create a test boolean field."""
    from app.models.custom_field import CustomField

    field = CustomField(
        list_id=test_list.id, name="Recommended", field_type="boolean", config={}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


async def create_test_video(
    test_db: AsyncSession, list_id, youtube_id: str, title: str
) -> Video:
    """Helper to create a test video."""
    video = Video(
        list_id=list_id,
        youtube_id=youtube_id,
        title=title,
        processing_status="completed",
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)
    return video


async def set_field_value(test_db: AsyncSession, video_id, field_id, **kwargs):
    """Helper to set a custom field value for a video."""
    from app.models.video_field_value import VideoFieldValue

    field_value = VideoFieldValue(video_id=video_id, field_id=field_id, **kwargs)
    test_db.add(field_value)
    await test_db.commit()


# ============================================================================
# Numeric Operator Tests
# ============================================================================


@pytest.mark.asyncio
async def test_filter_videos_by_rating_gte(
    client: AsyncClient, test_list, test_field_rating, test_db: AsyncSession
):
    """Filter videos with rating >= 4."""
    # Arrange: Create videos with different ratings
    video1 = await create_test_video(test_db, test_list.id, "VIDEO_5STAR", "5 stars")
    video2 = await create_test_video(test_db, test_list.id, "VIDEO_3STAR", "3 stars")
    video3 = await create_test_video(test_db, test_list.id, "VIDEO_4STAR", "4 stars")

    await set_field_value(test_db, video1.id, test_field_rating.id, value_numeric=5)
    await set_field_value(test_db, video2.id, test_field_rating.id, value_numeric=3)
    await set_field_value(test_db, video3.id, test_field_rating.id, value_numeric=4)

    # Act: Filter for rating >= 4
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {"field_id": str(test_field_rating.id), "operator": "gte", "value": 4}
            ]
        },
    )

    # Assert
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 2
    video_titles = {v["title"] for v in videos}
    assert "5 stars" in video_titles
    assert "4 stars" in video_titles
    assert "3 stars" not in video_titles


@pytest.mark.asyncio
async def test_filter_videos_by_rating_lte(
    client: AsyncClient, test_list, test_field_rating, test_db: AsyncSession
):
    """Filter videos with rating <= 3."""
    # Arrange
    video1 = await create_test_video(test_db, test_list.id, "VIDEO_1STAR", "1 star")
    video2 = await create_test_video(test_db, test_list.id, "VIDEO_3STAR", "3 stars")
    video3 = await create_test_video(test_db, test_list.id, "VIDEO_5STAR", "5 stars")

    await set_field_value(test_db, video1.id, test_field_rating.id, value_numeric=1)
    await set_field_value(test_db, video2.id, test_field_rating.id, value_numeric=3)
    await set_field_value(test_db, video3.id, test_field_rating.id, value_numeric=5)

    # Act: Filter for rating <= 3
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {"field_id": str(test_field_rating.id), "operator": "lte", "value": 3}
            ]
        },
    )

    # Assert
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 2
    video_titles = {v["title"] for v in videos}
    assert "1 star" in video_titles
    assert "3 stars" in video_titles
    assert "5 stars" not in video_titles


@pytest.mark.asyncio
async def test_filter_videos_by_rating_eq(
    client: AsyncClient, test_list, test_field_rating, test_db: AsyncSession
):
    """Filter videos with rating == 5."""
    # Arrange
    video1 = await create_test_video(test_db, test_list.id, "VIDEO_5STAR1", "Perfect 1")
    video2 = await create_test_video(test_db, test_list.id, "VIDEO_4STAR", "Good")
    video3 = await create_test_video(test_db, test_list.id, "VIDEO_5STAR2", "Perfect 2")

    await set_field_value(test_db, video1.id, test_field_rating.id, value_numeric=5)
    await set_field_value(test_db, video2.id, test_field_rating.id, value_numeric=4)
    await set_field_value(test_db, video3.id, test_field_rating.id, value_numeric=5)

    # Act: Filter for rating == 5
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {"field_id": str(test_field_rating.id), "operator": "eq", "value": 5}
            ]
        },
    )

    # Assert
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 2
    video_titles = {v["title"] for v in videos}
    assert "Perfect 1" in video_titles
    assert "Perfect 2" in video_titles
    assert "Good" not in video_titles


@pytest.mark.asyncio
async def test_filter_videos_by_rating_between(
    client: AsyncClient, test_list, test_field_rating, test_db: AsyncSession
):
    """Filter videos with rating between 3-5."""
    # Arrange
    video1 = await create_test_video(test_db, test_list.id, "VIDEO_2STAR", "2 stars")
    video2 = await create_test_video(test_db, test_list.id, "VIDEO_3STAR", "3 stars")
    video3 = await create_test_video(test_db, test_list.id, "VIDEO_4STAR", "4 stars")
    video4 = await create_test_video(test_db, test_list.id, "VIDEO_5STAR", "5 stars")

    await set_field_value(test_db, video1.id, test_field_rating.id, value_numeric=2)
    await set_field_value(test_db, video2.id, test_field_rating.id, value_numeric=3)
    await set_field_value(test_db, video3.id, test_field_rating.id, value_numeric=4)
    await set_field_value(test_db, video4.id, test_field_rating.id, value_numeric=5)

    # Act: Filter for rating between 3 and 5
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {
                    "field_id": str(test_field_rating.id),
                    "operator": "between",
                    "value_min": 3,
                    "value_max": 5,
                }
            ]
        },
    )

    # Assert
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 3
    video_titles = {v["title"] for v in videos}
    assert "3 stars" in video_titles
    assert "4 stars" in video_titles
    assert "5 stars" in video_titles
    assert "2 stars" not in video_titles


# ============================================================================
# Text Operator Tests
# ============================================================================


@pytest.mark.asyncio
async def test_filter_videos_by_text_contains(
    client: AsyncClient, test_list, test_field_text, test_db: AsyncSession
):
    """Filter videos where text contains 'tutorial' (tests ILIKE + GIN index)."""
    # Arrange
    video1 = await create_test_video(
        test_db, test_list.id, "VIDEO_TUT", "Tutorial video"
    )
    video2 = await create_test_video(
        test_db, test_list.id, "VIDEO_INTRO", "Intro video"
    )
    video3 = await create_test_video(
        test_db, test_list.id, "VIDEO_ADVANCED", "Advanced tutorial"
    )

    await set_field_value(
        test_db,
        video1.id,
        test_field_text.id,
        value_text="Great tutorial for beginners",
    )
    await set_field_value(
        test_db, video2.id, test_field_text.id, value_text="Introduction to Python"
    )
    await set_field_value(
        test_db, video3.id, test_field_text.id, value_text="Advanced TUTORIAL content"
    )

    # Act: Filter for text containing "tutorial"
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {
                    "field_id": str(test_field_text.id),
                    "operator": "contains",
                    "value": "tutorial",
                }
            ]
        },
    )

    # Assert
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 2
    video_titles = {v["title"] for v in videos}
    assert "Tutorial video" in video_titles
    assert "Advanced tutorial" in video_titles
    assert "Intro video" not in video_titles


@pytest.mark.asyncio
async def test_filter_videos_by_text_exact(
    client: AsyncClient, test_list, test_field_text, test_db: AsyncSession
):
    """Filter videos with exact text match (case-sensitive)."""
    # Arrange
    video1 = await create_test_video(
        test_db, test_list.id, "VIDEO_EXACT", "Exact match"
    )
    video2 = await create_test_video(test_db, test_list.id, "VIDEO_UPPER", "Uppercase")
    video3 = await create_test_video(test_db, test_list.id, "VIDEO_PARTIAL", "Partial")

    await set_field_value(test_db, video1.id, test_field_text.id, value_text="Python")
    await set_field_value(test_db, video2.id, test_field_text.id, value_text="PYTHON")
    await set_field_value(
        test_db, video3.id, test_field_text.id, value_text="Python programming"
    )

    # Act: Filter for exact match "Python" (case-sensitive)
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {
                    "field_id": str(test_field_text.id),
                    "operator": "exact",
                    "value": "Python",
                }
            ]
        },
    )

    # Assert
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Exact match"


@pytest.mark.asyncio
async def test_filter_videos_text_contains_escaping(
    client: AsyncClient, test_list, test_field_text, test_db: AsyncSession
):
    """Test special characters (%, _, \\) are properly escaped in ILIKE."""
    # Arrange
    video1 = await create_test_video(
        test_db, test_list.id, "VIDEO_PERCENT", "Percent test"
    )
    video2 = await create_test_video(
        test_db, test_list.id, "VIDEO_UNDERSCORE", "Underscore test"
    )
    video3 = await create_test_video(
        test_db, test_list.id, "VIDEO_NORMAL", "Normal text"
    )

    await set_field_value(
        test_db, video1.id, test_field_text.id, value_text="100% complete"
    )
    await set_field_value(
        test_db, video2.id, test_field_text.id, value_text="my_function"
    )
    await set_field_value(
        test_db, video3.id, test_field_text.id, value_text="no special chars"
    )

    # Act: Search for "%" literal (should be escaped)
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {
                    "field_id": str(test_field_text.id),
                    "operator": "contains",
                    "value": "%",
                }
            ]
        },
    )

    # Assert: Should only find "100% complete"
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Percent test"

    # Act: Search for "_" literal (should be escaped)
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {
                    "field_id": str(test_field_text.id),
                    "operator": "contains",
                    "value": "_",
                }
            ]
        },
    )

    # Assert: Should only find "my_function"
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Underscore test"


# ============================================================================
# Select Operator Tests
# ============================================================================


@pytest.mark.asyncio
async def test_filter_videos_by_select_in(
    client: AsyncClient, test_list, test_field_select, test_db: AsyncSession
):
    """Filter videos where Quality is in ['great', 'good']."""
    # Arrange
    video1 = await create_test_video(
        test_db, test_list.id, "VIDEO_GREAT", "Great quality"
    )
    video2 = await create_test_video(
        test_db, test_list.id, "VIDEO_GOOD", "Good quality"
    )
    video3 = await create_test_video(test_db, test_list.id, "VIDEO_BAD", "Bad quality")

    await set_field_value(test_db, video1.id, test_field_select.id, value_text="great")
    await set_field_value(test_db, video2.id, test_field_select.id, value_text="good")
    await set_field_value(test_db, video3.id, test_field_select.id, value_text="bad")

    # Act: Filter for quality in ["great", "good"]
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {
                    "field_id": str(test_field_select.id),
                    "operator": "in",
                    "value": "great,good",  # Comma-separated
                }
            ]
        },
    )

    # Assert
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 2
    video_titles = {v["title"] for v in videos}
    assert "Great quality" in video_titles
    assert "Good quality" in video_titles
    assert "Bad quality" not in video_titles


# ============================================================================
# Boolean Operator Tests
# ============================================================================


@pytest.mark.asyncio
async def test_filter_videos_by_boolean_is_true(
    client: AsyncClient, test_list, test_field_boolean, test_db: AsyncSession
):
    """Filter videos where Recommended is True."""
    # Arrange
    video1 = await create_test_video(test_db, test_list.id, "VIDEO_REC", "Recommended")
    video2 = await create_test_video(
        test_db, test_list.id, "VIDEO_NOT_REC", "Not recommended"
    )

    await set_field_value(test_db, video1.id, test_field_boolean.id, value_boolean=True)
    await set_field_value(
        test_db, video2.id, test_field_boolean.id, value_boolean=False
    )

    # Act: Filter for Recommended == True
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {
                    "field_id": str(test_field_boolean.id),
                    "operator": "is",
                    "value": True,
                }
            ]
        },
    )

    # Assert
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Recommended"


@pytest.mark.asyncio
async def test_filter_videos_by_boolean_is_false(
    client: AsyncClient, test_list, test_field_boolean, test_db: AsyncSession
):
    """Filter videos where Recommended is False."""
    # Arrange
    video1 = await create_test_video(test_db, test_list.id, "VIDEO_REC", "Recommended")
    video2 = await create_test_video(
        test_db, test_list.id, "VIDEO_NOT_REC", "Not recommended"
    )

    await set_field_value(test_db, video1.id, test_field_boolean.id, value_boolean=True)
    await set_field_value(
        test_db, video2.id, test_field_boolean.id, value_boolean=False
    )

    # Act: Filter for Recommended == False
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {
                    "field_id": str(test_field_boolean.id),
                    "operator": "is",
                    "value": False,
                }
            ]
        },
    )

    # Assert
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Not recommended"


# ============================================================================
# Multiple Filters Tests
# ============================================================================


@pytest.mark.asyncio
async def test_filter_videos_multiple_fields_and_logic(
    client: AsyncClient,
    test_list,
    test_field_rating,
    test_field_select,
    test_db: AsyncSession,
):
    """Filter videos with Rating >= 4 AND Quality = 'great' (AND logic)."""
    # Arrange
    video1 = await create_test_video(
        test_db, test_list.id, "VIDEO_PERFECT", "Perfect video"
    )
    video2 = await create_test_video(
        test_db, test_list.id, "VIDEO_HIGHRATING", "High rating but not great"
    )
    video3 = await create_test_video(
        test_db, test_list.id, "VIDEO_GREAT", "Great but low rating"
    )

    # Video 1: Rating=5, Quality=great (matches both)
    await set_field_value(test_db, video1.id, test_field_rating.id, value_numeric=5)
    await set_field_value(test_db, video1.id, test_field_select.id, value_text="great")

    # Video 2: Rating=5, Quality=good (high rating but not great)
    await set_field_value(test_db, video2.id, test_field_rating.id, value_numeric=5)
    await set_field_value(test_db, video2.id, test_field_select.id, value_text="good")

    # Video 3: Rating=3, Quality=great (great but low rating)
    await set_field_value(test_db, video3.id, test_field_rating.id, value_numeric=3)
    await set_field_value(test_db, video3.id, test_field_select.id, value_text="great")

    # Act: Filter for Rating >= 4 AND Quality = "great"
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {"field_id": str(test_field_rating.id), "operator": "gte", "value": 4},
                {
                    "field_id": str(test_field_select.id),
                    "operator": "exact",
                    "value": "great",
                },
            ]
        },
    )

    # Assert: Only video1 matches both filters
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Perfect video"


@pytest.mark.asyncio
async def test_filter_videos_tags_and_fields(
    client: AsyncClient, test_list, test_field_rating, test_db: AsyncSession
):
    """Filter videos with Tag 'Rust' AND Rating >= 4."""
    # Arrange: Create tag (use unique name to avoid conflicts with other tests)
    tag_resp = await client.post("/api/tags", json={"name": "Rust"})
    tag_id = tag_resp.json()["id"]

    # Create videos
    video1 = await create_test_video(
        test_db, test_list.id, "VIDEO_RUST_HIGH", "Rust high rating"
    )
    video2 = await create_test_video(
        test_db, test_list.id, "VIDEO_RUST_LOW", "Rust low rating"
    )
    video3 = await create_test_video(
        test_db, test_list.id, "VIDEO_JS_HIGH", "JavaScript high rating"
    )

    # Assign Rust tag to video1 and video2
    await client.post(f"/api/videos/{video1.id}/tags", json={"tag_ids": [tag_id]})
    await client.post(f"/api/videos/{video2.id}/tags", json={"tag_ids": [tag_id]})

    # Set ratings
    await set_field_value(test_db, video1.id, test_field_rating.id, value_numeric=5)
    await set_field_value(test_db, video2.id, test_field_rating.id, value_numeric=2)
    await set_field_value(test_db, video3.id, test_field_rating.id, value_numeric=5)

    # Act: Filter for tag "Rust" AND rating >= 4
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "tags": ["Rust"],
            "field_filters": [
                {"field_id": str(test_field_rating.id), "operator": "gte", "value": 4}
            ],
        },
    )

    # Assert: Only video1 matches (Rust tag AND rating >= 4)
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Rust high rating"


# ============================================================================
# Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_filter_videos_empty_results(
    client: AsyncClient, test_list, test_field_rating, test_db: AsyncSession
):
    """Filter that matches no videos returns empty list."""
    # Arrange: Create videos with ratings 1-3
    video1 = await create_test_video(test_db, test_list.id, "VIDEO_1", "1 star")
    video2 = await create_test_video(test_db, test_list.id, "VIDEO_2", "2 stars")

    await set_field_value(test_db, video1.id, test_field_rating.id, value_numeric=1)
    await set_field_value(test_db, video2.id, test_field_rating.id, value_numeric=2)

    # Act: Filter for rating >= 5 (no videos match)
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {"field_id": str(test_field_rating.id), "operator": "gte", "value": 5}
            ]
        },
    )

    # Assert: Returns 200 with empty array
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 0


@pytest.mark.asyncio
async def test_filter_videos_invalid_list_id(client: AsyncClient, test_field_rating):
    """Filter with invalid list_id returns 404."""
    from uuid import uuid4

    fake_list_id = uuid4()

    # Act: Filter with non-existent list
    response = await client.post(
        f"/api/lists/{fake_list_id}/videos/filter",
        json={
            "field_filters": [
                {"field_id": str(test_field_rating.id), "operator": "gte", "value": 4}
            ]
        },
    )

    # Assert
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_filter_videos_no_filters(
    client: AsyncClient, test_list, test_db: AsyncSession
):
    """Filter with no filters returns all videos in list."""
    # Arrange: Create videos
    video1 = await create_test_video(test_db, test_list.id, "VIDEO_1", "Video 1")
    video2 = await create_test_video(test_db, test_list.id, "VIDEO_2", "Video 2")

    # Act: Filter with empty request
    response = await client.post(f"/api/lists/{test_list.id}/videos/filter", json={})

    # Assert: Returns all videos
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 2


@pytest.mark.asyncio
async def test_filter_in_operator_type_validation(
    client: AsyncClient, test_list, test_field_select
):
    """IN operator should reject non-string values."""
    # Act: Try to use IN operator with integer value (should fail)
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter",
        json={
            "field_filters": [
                {
                    "field_id": str(test_field_select.id),
                    "operator": "in",
                    "value": 123,  # Invalid: should be string
                }
            ]
        },
    )

    # Assert: Should return 422 validation error
    assert response.status_code == 422
    error_detail = response.json()["detail"]
    # FastAPI returns a list of validation errors
    assert isinstance(error_detail, list)
    # Check that the error mentions the operator requires string value
    assert any("string value" in str(err).lower() for err in error_detail)
