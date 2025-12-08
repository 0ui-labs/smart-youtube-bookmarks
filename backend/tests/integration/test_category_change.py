"""
Integration tests for Category Change Endpoint.

Tests the PUT /api/videos/{video_id}/category endpoint:
- test_change_category_creates_backup
- test_change_category_detects_existing_backup
- test_remove_category_creates_backup
- test_change_category_without_values_no_backup
"""

import shutil

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.list import BookmarkList
from app.models.schema_field import SchemaField
from app.models.tag import Tag
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.services.field_value_backup import BACKUP_DIR, list_backups


@pytest.fixture
def cleanup_backups():
    """Clean up backup files after tests."""
    yield
    # Cleanup: Remove backups directory if it exists
    if BACKUP_DIR.exists():
        shutil.rmtree(BACKUP_DIR)


@pytest.mark.asyncio
async def test_change_category_creates_backup(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user,
    cleanup_backups,
):
    """
    Test: Changing category creates backup of existing field values.

    Endpoint: PUT /api/videos/{video_id}/category

    Scenario:
    1. Video has category "Tutorial" with field values
    2. Change to category "Review"
    3. Expected: backup_created=True

    Verifies: Backup file is created with previous category's field values.
    """
    list_id = test_list.id
    video_id = test_video.id
    user_id = test_user.id

    # Create field and schema for first category
    rating_field = CustomField(
        list_id=list_id, name="Rating", field_type="rating", config={"max_rating": 5}
    )
    test_db.add(rating_field)
    await test_db.commit()
    await test_db.refresh(rating_field)

    tutorial_schema = FieldSchema(list_id=list_id, name="Tutorial Schema")
    test_db.add(tutorial_schema)
    await test_db.commit()
    await test_db.refresh(tutorial_schema)

    schema_field = SchemaField(
        schema_id=tutorial_schema.id,
        field_id=rating_field.id,
        display_order=0,
        show_on_card=True,
    )
    test_db.add(schema_field)
    await test_db.commit()

    # Create two categories
    category1 = Tag(
        user_id=user_id,
        name="Tutorial",
        is_video_type=True,
        schema_id=tutorial_schema.id,
    )
    category2 = Tag(user_id=user_id, name="Review", is_video_type=True)
    test_db.add_all([category1, category2])
    await test_db.commit()
    await test_db.refresh(category1)
    await test_db.refresh(category2)

    category1_id = category1.id
    category2_id = category2.id

    # Assign first category to video via PUT endpoint
    response = await client.put(
        f"/api/videos/{video_id}/category", json={"category_id": str(category1_id)}
    )
    assert response.status_code == 200

    # Add field value for the video
    field_value = VideoFieldValue(
        video_id=video_id, field_id=rating_field.id, value_numeric=4.5
    )
    test_db.add(field_value)
    await test_db.commit()

    # Act: Change category
    response = await client.put(
        f"/api/videos/{video_id}/category", json={"category_id": str(category2_id)}
    )

    # Assert
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    result = response.json()
    assert result["backup_created"] is True, "Should have created backup"

    # Verify backup file exists
    backups = list_backups(video_id)
    assert len(backups) == 1, "Should have one backup"
    assert backups[0].category_id == category1_id


@pytest.mark.asyncio
async def test_change_category_detects_existing_backup(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user,
    cleanup_backups,
):
    """
    Test: Changing back to a previous category detects existing backup.

    Endpoint: PUT /api/videos/{video_id}/category

    Scenario:
    1. Video has category "Tutorial" with field values
    2. Change to category "Review" (creates backup)
    3. Change back to "Tutorial"
    4. Expected: backup_available=True

    Verifies: API returns backup_available when switching to category with backup.
    """
    list_id = test_list.id
    video_id = test_video.id
    user_id = test_user.id

    # Create field and schema for first category
    rating_field = CustomField(
        list_id=list_id, name="Rating", field_type="rating", config={"max_rating": 5}
    )
    test_db.add(rating_field)
    await test_db.commit()
    await test_db.refresh(rating_field)

    tutorial_schema = FieldSchema(list_id=list_id, name="Tutorial Schema")
    test_db.add(tutorial_schema)
    await test_db.commit()
    await test_db.refresh(tutorial_schema)

    schema_field = SchemaField(
        schema_id=tutorial_schema.id,
        field_id=rating_field.id,
        display_order=0,
        show_on_card=True,
    )
    test_db.add(schema_field)
    await test_db.commit()

    # Create two categories
    category1 = Tag(
        user_id=user_id,
        name="Tutorial",
        is_video_type=True,
        schema_id=tutorial_schema.id,
    )
    category2 = Tag(user_id=user_id, name="Review", is_video_type=True)
    test_db.add_all([category1, category2])
    await test_db.commit()
    await test_db.refresh(category1)
    await test_db.refresh(category2)

    category1_id = category1.id
    category2_id = category2.id

    # Setup: Assign category1, add field value
    await client.put(
        f"/api/videos/{video_id}/category", json={"category_id": str(category1_id)}
    )

    field_value = VideoFieldValue(
        video_id=video_id, field_id=rating_field.id, value_numeric=4.5
    )
    test_db.add(field_value)
    await test_db.commit()

    # Change to category2 (creates backup)
    await client.put(
        f"/api/videos/{video_id}/category", json={"category_id": str(category2_id)}
    )

    # Act: Change back to category1
    response = await client.put(
        f"/api/videos/{video_id}/category", json={"category_id": str(category1_id)}
    )

    # Assert
    assert response.status_code == 200
    result = response.json()
    assert result["backup_available"] is True, (
        "Should detect existing backup for category1"
    )


@pytest.mark.asyncio
async def test_remove_category_creates_backup(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user,
    cleanup_backups,
):
    """
    Test: Removing category (setting to null) creates backup.

    Endpoint: PUT /api/videos/{video_id}/category

    Expected: backup_created=True when removing category with field values
    """
    list_id = test_list.id
    video_id = test_video.id
    user_id = test_user.id

    # Create field and schema
    rating_field = CustomField(
        list_id=list_id, name="Rating", field_type="rating", config={"max_rating": 5}
    )
    test_db.add(rating_field)
    await test_db.commit()
    await test_db.refresh(rating_field)

    schema = FieldSchema(list_id=list_id, name="Test Schema")
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)

    schema_field = SchemaField(
        schema_id=schema.id,
        field_id=rating_field.id,
        display_order=0,
        show_on_card=True,
    )
    test_db.add(schema_field)
    await test_db.commit()

    # Create category
    category = Tag(
        user_id=user_id, name="Tutorial", is_video_type=True, schema_id=schema.id
    )
    test_db.add(category)
    await test_db.commit()
    await test_db.refresh(category)

    category_id = category.id

    # Setup: Assign category and add field value
    await client.put(
        f"/api/videos/{video_id}/category", json={"category_id": str(category_id)}
    )

    field_value = VideoFieldValue(
        video_id=video_id, field_id=rating_field.id, value_numeric=4.5
    )
    test_db.add(field_value)
    await test_db.commit()

    # Act: Remove category
    response = await client.put(
        f"/api/videos/{video_id}/category", json={"category_id": None}
    )

    # Assert
    assert response.status_code == 200
    result = response.json()
    assert result["backup_created"] is True, (
        "Should create backup when removing category"
    )


@pytest.mark.asyncio
async def test_change_category_without_values_no_backup(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user,
    cleanup_backups,
):
    """
    Test: Changing category when no field values exist does not create backup.

    Endpoint: PUT /api/videos/{video_id}/category

    Expected: backup_created=False when no values to backup
    """
    video_id = test_video.id
    user_id = test_user.id

    # Create two categories (without schemas/fields)
    category1 = Tag(user_id=user_id, name="Tutorial", is_video_type=True)
    category2 = Tag(user_id=user_id, name="Review", is_video_type=True)
    test_db.add_all([category1, category2])
    await test_db.commit()
    await test_db.refresh(category1)
    await test_db.refresh(category2)

    # Setup: Assign category1 (no field values)
    await client.put(
        f"/api/videos/{video_id}/category", json={"category_id": str(category1.id)}
    )

    # Act: Change to category2
    response = await client.put(
        f"/api/videos/{video_id}/category", json={"category_id": str(category2.id)}
    )

    # Assert
    assert response.status_code == 200
    result = response.json()
    assert result["backup_created"] is False, (
        "Should not create backup when no values exist"
    )
