"""
Integration tests for Category Validation.

Tests from testing.md:
- test_can_assign_single_category
- test_cannot_assign_multiple_categories
- test_cannot_assign_second_category_if_video_has_one
- test_can_assign_labels_with_category
- test_can_reassign_same_category
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.tag import Tag
from app.models.video import Video


@pytest.mark.asyncio
async def test_can_assign_single_category(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user,
):
    """
    Test: A video can have one category assigned.

    Endpoint: POST /api/videos/{video_id}/tags

    Expected: 200 OK, category assigned
    """
    # Arrange: Create a category (is_video_type=True)
    category = Tag(user_id=test_user.id, name="Tutorial", is_video_type=True)
    test_db.add(category)
    await test_db.commit()
    await test_db.refresh(category)

    category_id = category.id
    video_id = test_video.id

    # Act: Assign category to video
    response = await client.post(
        f"/api/videos/{video_id}/tags", json={"tag_ids": [str(category_id)]}
    )

    # Assert
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    tags = response.json()
    assert len(tags) == 1
    assert tags[0]["id"] == str(category_id)
    assert tags[0]["name"] == "Tutorial"


@pytest.mark.asyncio
async def test_cannot_assign_multiple_categories(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user,
):
    """
    Test: Cannot assign multiple categories in a single request.

    Endpoint: POST /api/videos/{video_id}/tags

    Expected: 409 Conflict with error message
    """
    # Arrange: Create 2 categories
    category1 = Tag(user_id=test_user.id, name="Tutorial", is_video_type=True)
    category2 = Tag(user_id=test_user.id, name="Review", is_video_type=True)
    test_db.add_all([category1, category2])
    await test_db.commit()
    await test_db.refresh(category1)
    await test_db.refresh(category2)

    video_id = test_video.id

    # Act: Try to assign both categories at once
    response = await client.post(
        f"/api/videos/{video_id}/tags",
        json={"tag_ids": [str(category1.id), str(category2.id)]},
    )

    # Assert
    assert response.status_code == 409, (
        f"Expected 409, got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert "multiple categories" in detail["message"].lower()


@pytest.mark.asyncio
async def test_cannot_assign_second_category_if_video_has_one(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user,
):
    """
    Test: Cannot assign a different category if video already has one.

    Endpoint: POST /api/videos/{video_id}/tags

    Expected: 409 Conflict with info about existing category
    """
    # Arrange: Create 2 categories
    category1 = Tag(user_id=test_user.id, name="Tutorial", is_video_type=True)
    category2 = Tag(user_id=test_user.id, name="Review", is_video_type=True)
    test_db.add_all([category1, category2])
    await test_db.commit()
    await test_db.refresh(category1)
    await test_db.refresh(category2)

    video_id = test_video.id

    # First: Assign category1 to video
    response1 = await client.post(
        f"/api/videos/{video_id}/tags", json={"tag_ids": [str(category1.id)]}
    )
    assert response1.status_code == 200

    # Act: Try to assign category2 (should fail)
    response = await client.post(
        f"/api/videos/{video_id}/tags", json={"tag_ids": [str(category2.id)]}
    )

    # Assert
    assert response.status_code == 409, (
        f"Expected 409, got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["existing_category_name"] == "Tutorial"
    assert detail["new_category_name"] == "Review"


@pytest.mark.asyncio
async def test_can_assign_labels_with_category(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user,
):
    """
    Test: Labels (is_video_type=False) can be assigned alongside a category.

    Endpoint: POST /api/videos/{video_id}/tags

    Expected: 200 OK, both category and labels assigned
    """
    # Arrange: Create 1 category and 2 labels
    category = Tag(user_id=test_user.id, name="Tutorial", is_video_type=True)
    label1 = Tag(user_id=test_user.id, name="Python", is_video_type=False)
    label2 = Tag(user_id=test_user.id, name="Beginner", is_video_type=False)
    test_db.add_all([category, label1, label2])
    await test_db.commit()
    await test_db.refresh(category)
    await test_db.refresh(label1)
    await test_db.refresh(label2)

    video_id = test_video.id

    # Act: Assign category first
    response1 = await client.post(
        f"/api/videos/{video_id}/tags", json={"tag_ids": [str(category.id)]}
    )
    assert response1.status_code == 200

    # Act: Assign labels (should succeed)
    response = await client.post(
        f"/api/videos/{video_id}/tags",
        json={"tag_ids": [str(label1.id), str(label2.id)]},
    )

    # Assert
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    tags = response.json()
    assert len(tags) == 3
    tag_names = {t["name"] for t in tags}
    assert tag_names == {"Tutorial", "Python", "Beginner"}


@pytest.mark.asyncio
async def test_can_reassign_same_category(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user,
):
    """
    Test: Re-assigning the same category is idempotent (allowed).

    Endpoint: POST /api/videos/{video_id}/tags

    Expected: 200 OK (no error, still one category)
    """
    # Arrange: Create a category
    category = Tag(user_id=test_user.id, name="Tutorial", is_video_type=True)
    test_db.add(category)
    await test_db.commit()
    await test_db.refresh(category)

    video_id = test_video.id
    category_id = category.id

    # First: Assign category to video
    response1 = await client.post(
        f"/api/videos/{video_id}/tags", json={"tag_ids": [str(category_id)]}
    )
    assert response1.status_code == 200

    # Act: Re-assign same category (should succeed, idempotent)
    response = await client.post(
        f"/api/videos/{video_id}/tags", json={"tag_ids": [str(category_id)]}
    )

    # Assert
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    tags = response.json()
    assert len(tags) == 1
    assert tags[0]["id"] == str(category_id)
