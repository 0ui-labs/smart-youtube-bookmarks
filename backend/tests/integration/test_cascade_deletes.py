"""
Integration tests for CASCADE DELETE behaviors.

Tests database-level CASCADE behaviors defined in migration 1a6e18578c31:
- DELETE CustomField → VideoFieldValue CASCADE (line 81)
- DELETE FieldSchema → SchemaField CASCADE (line 65)
- DELETE FieldSchema → Tag.schema_id SET NULL (line 102)

These tests verify that the database CASCADE configuration works correctly
with SQLAlchemy models that use passive_deletes=True.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.list import BookmarkList
from app.models.schema_field import SchemaField
from app.models.tag import Tag
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue


@pytest.mark.asyncio
async def test_cascade_delete_field_removes_values(
    client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList
):
    """
    Test CASCADE delete: Deleting custom field removes all video_field_values.

    Migration reference: Line 81 - ondelete="CASCADE" on video_field_values.field_id

    Verifies:
    1. DELETE request returns 204
    2. CustomField record is deleted
    3. All VideoFieldValue records with field_id are CASCADE deleted
    4. Videos remain intact
    """
    # Arrange: Create field
    field = CustomField(
        list_id=test_list.id,
        name="Test Rating",
        field_type="rating",
        config={"max_rating": 5},
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    field_id = field.id

    # Create 2 videos with field values
    video1 = Video(
        list_id=test_list.id, youtube_id="video_001", processing_status="completed"
    )
    video2 = Video(
        list_id=test_list.id, youtube_id="video_002", processing_status="completed"
    )
    test_db.add_all([video1, video2])
    await test_db.commit()
    await test_db.refresh(video1)
    await test_db.refresh(video2)

    value1 = VideoFieldValue(video_id=video1.id, field_id=field_id, value_numeric=4)
    value2 = VideoFieldValue(video_id=video2.id, field_id=field_id, value_numeric=5)
    test_db.add_all([value1, value2])
    await test_db.commit()

    # Verify setup: 2 values exist
    values_stmt = select(VideoFieldValue).where(VideoFieldValue.field_id == field_id)
    result = await test_db.execute(values_stmt)
    assert len(result.scalars().all()) == 2, "Setup failed: should have 2 values"

    # Act: Delete field via API
    response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{field_id}"
    )

    # Assert: Response
    assert response.status_code == 204, f"Expected 204, got {response.status_code}"

    # Assert: Field is deleted
    field_stmt = select(CustomField).where(CustomField.id == field_id)
    result = await test_db.execute(field_stmt)
    assert result.scalar_one_or_none() is None, "CustomField should be deleted"

    # Assert: CASCADE deleted values
    values_stmt = select(VideoFieldValue).where(VideoFieldValue.field_id == field_id)
    result = await test_db.execute(values_stmt)
    remaining_values = result.scalars().all()
    assert len(remaining_values) == 0, (
        "VideoFieldValue records should be CASCADE deleted by database"
    )

    # Assert: Videos remain intact
    videos_stmt = select(Video).where(Video.id.in_([video1.id, video2.id]))
    result = await test_db.execute(videos_stmt)
    remaining_videos = result.scalars().all()
    assert len(remaining_videos) == 2, "Videos should NOT be deleted"


@pytest.mark.asyncio
async def test_cascade_delete_schema_removes_join_entries(
    client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList
):
    """
    Test CASCADE delete: Deleting schema removes schema_fields join entries.

    Migration reference: Line 65 - ondelete="CASCADE" on schema_fields.schema_id

    Verifies:
    1. DELETE request returns 204
    2. FieldSchema record is deleted
    3. All SchemaField join entries are CASCADE deleted
    4. CustomField records remain intact (fields are reusable)
    """
    # Arrange: Create 2 custom fields
    field1 = CustomField(
        list_id=test_list.id,
        name="Presentation",
        field_type="select",
        config={"options": ["bad", "good", "great"]},
    )
    field2 = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5},
    )
    test_db.add_all([field1, field2])
    await test_db.commit()
    await test_db.refresh(field1)
    await test_db.refresh(field2)

    # Create schema
    schema = FieldSchema(
        list_id=test_list.id,
        name="Quality Metrics",
        description="Quality assessment fields",
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)
    schema_id = schema.id

    # Add both fields to schema
    join1 = SchemaField(
        schema_id=schema_id, field_id=field1.id, display_order=0, show_on_card=True
    )
    join2 = SchemaField(
        schema_id=schema_id, field_id=field2.id, display_order=1, show_on_card=True
    )
    test_db.add_all([join1, join2])
    await test_db.commit()

    # Verify setup: 2 join entries exist
    join_stmt = select(SchemaField).where(SchemaField.schema_id == schema_id)
    result = await test_db.execute(join_stmt)
    assert len(result.scalars().all()) == 2, "Setup failed: should have 2 join entries"

    # Act: Delete schema via API
    response = await client.delete(f"/api/lists/{test_list.id}/schemas/{schema_id}")

    # Assert: Response
    assert response.status_code == 204, f"Expected 204, got {response.status_code}"

    # Assert: Schema is deleted
    schema_stmt = select(FieldSchema).where(FieldSchema.id == schema_id)
    result = await test_db.execute(schema_stmt)
    assert result.scalar_one_or_none() is None, "FieldSchema should be deleted"

    # Assert: CASCADE deleted join entries
    join_stmt = select(SchemaField).where(SchemaField.schema_id == schema_id)
    result = await test_db.execute(join_stmt)
    remaining_joins = result.scalars().all()
    assert len(remaining_joins) == 0, (
        "SchemaField join entries should be CASCADE deleted by database"
    )

    # Assert: CustomFields remain intact (reusable!)
    fields_stmt = select(CustomField).where(CustomField.id.in_([field1.id, field2.id]))
    result = await test_db.execute(fields_stmt)
    remaining_fields = result.scalars().all()
    assert len(remaining_fields) == 2, (
        "CustomField records should NOT be deleted (fields are reusable)"
    )


@pytest.mark.asyncio
async def test_cascade_delete_schema_sets_tag_null(
    client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList, test_user
):
    """
    Test CASCADE delete: Deleting schema sets tag.schema_id to NULL (not CASCADE delete).

    Migration reference: Line 102 - ondelete="SET NULL" on tags.schema_id

    Verifies:
    1. DELETE request returns 204
    2. FieldSchema record is deleted
    3. Tag.schema_id set to NULL (ON DELETE SET NULL)
    4. Tag record remains intact

    This is different from CASCADE DELETE - the tag survives, just loses its schema binding.
    """
    # Arrange: Create schema
    schema = FieldSchema(
        list_id=test_list.id,
        name="Tutorial Schema",
        description="Schema for tutorial videos",
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)
    schema_id = schema.id

    # Create tag with schema binding (tags use user_id, not list_id)
    tag = Tag(user_id=test_user.id, name="Python Tutorial", schema_id=schema_id)
    test_db.add(tag)
    await test_db.commit()
    await test_db.refresh(tag)
    tag_id = tag.id

    # Verify setup: Tag has schema_id
    assert tag.schema_id == schema_id, "Setup failed: tag should have schema_id"

    # Act: Delete schema directly in database (bypassing API validation)
    # Note: API endpoint returns 409 if schema is used by tags (correct behavior)
    # This test verifies the DATABASE CASCADE SET NULL works correctly
    await test_db.delete(schema)
    await test_db.commit()

    # Assert: Schema is deleted
    schema_stmt = select(FieldSchema).where(FieldSchema.id == schema_id)
    result = await test_db.execute(schema_stmt)
    assert result.scalar_one_or_none() is None, "FieldSchema should be deleted"

    # Assert: Tag survives with schema_id set to NULL (CASCADE SET NULL)
    tag_stmt = select(Tag).where(Tag.id == tag_id)
    result = await test_db.execute(tag_stmt)
    remaining_tag = result.scalar_one()

    assert remaining_tag is not None, (
        "Tag should NOT be deleted (ON DELETE SET NULL, not CASCADE)"
    )
    assert remaining_tag.schema_id is None, (
        "Tag.schema_id should be SET NULL by database CASCADE"
    )
    assert remaining_tag.name == "Python Tutorial", "Tag name should remain unchanged"
