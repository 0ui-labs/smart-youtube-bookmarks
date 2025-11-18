"""
Integration tests for Video Field Values workflows.

Tests complete user flows:
- Batch update field values with typed columns (Task #72)
- Multi-tag field union in GET /videos/{id} (Task #74)

These tests verify end-to-end functionality that was implemented in
Tasks #72 and #74 but only unit-tested.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.video import Video
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.tag import Tag
from app.models.video_field_value import VideoFieldValue


@pytest.mark.asyncio
async def test_batch_update_field_values_with_typed_columns(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video
):
    """
    Test batch update of field values with correct typed column storage.

    Endpoint: PUT /api/videos/{video_id}/fields (Task #72)

    Verifies:
    1. Batch update succeeds with 200 response
    2. All 4 field types use correct typed columns:
       - rating → value_numeric
       - select → value_text
       - text → value_text
       - boolean → value_boolean
    3. Unused columns remain NULL
    4. UNIQUE constraint (video_id, field_id) handled by UPSERT
    """
    # Use test_video fixture instead of creating new one

    # Create 4 fields (one of each type)
    rating_field = CustomField(
        list_id=test_list.id,
        name="Overall Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    select_field = CustomField(
        list_id=test_list.id,
        name="Quality",
        field_type="select",
        config={"options": ["bad", "good", "great"]}
    )
    text_field = CustomField(
        list_id=test_list.id,
        name="Notes",
        field_type="text",
        config={"max_length": 500}
    )
    boolean_field = CustomField(
        list_id=test_list.id,
        name="Recommended",
        field_type="boolean",
        config={}
    )
    test_db.add_all([rating_field, select_field, text_field, boolean_field])
    await test_db.commit()
    await test_db.refresh(rating_field)
    await test_db.refresh(select_field)
    await test_db.refresh(text_field)
    await test_db.refresh(boolean_field)

    # Store IDs before making API calls (objects become detached after commit)
    rating_field_id = rating_field.id
    select_field_id = select_field.id
    text_field_id = text_field.id
    boolean_field_id = boolean_field.id
    video_id = test_video.id

    # Act: Batch update all 4 field values (Task #72 endpoint)
    response = await client.put(
        f"/api/videos/{video_id}/fields",
        json={
            "field_values": [
                {"field_id": str(rating_field_id), "value": 4.5},
                {"field_id": str(select_field_id), "value": "great"},
                {"field_id": str(text_field_id), "value": "Excellent tutorial with clear examples"},
                {"field_id": str(boolean_field_id), "value": True}
            ]
        }
    )

    # Assert: Response
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    result = response.json()
    assert result["updated_count"] == 4, "Should update 4 field values"

    # Assert: Database state - all 4 values exist
    # Expire ORM cache to read fresh data (API endpoint uses different session)
    test_db.expire_all()
    # Use previously stored video_id
    values_stmt = select(VideoFieldValue).where(VideoFieldValue.video_id == video_id)
    db_result = await test_db.execute(values_stmt)
    db_values = db_result.scalars().all()
    assert len(db_values) == 4, "Should have 4 field values in database"

    # Assert: Rating field uses value_numeric
    rating_value = next(v for v in db_values if v.field_id == rating_field_id)
    assert rating_value.value_numeric == 4.5, "Rating should use value_numeric column"
    assert rating_value.value_text is None, "Rating should NOT use value_text"
    assert rating_value.value_boolean is None, "Rating should NOT use value_boolean"

    # Assert: Select field uses value_text
    select_value = next(v for v in db_values if v.field_id == select_field_id)
    assert select_value.value_text == "great", "Select should use value_text column"
    assert select_value.value_numeric is None, "Select should NOT use value_numeric"
    assert select_value.value_boolean is None, "Select should NOT use value_boolean"

    # Assert: Text field uses value_text
    text_value = next(v for v in db_values if v.field_id == text_field_id)
    assert text_value.value_text == "Excellent tutorial with clear examples", "Text should use value_text column"
    assert text_value.value_numeric is None, "Text should NOT use value_numeric"
    assert text_value.value_boolean is None, "Text should NOT use value_boolean"

    # Assert: Boolean field uses value_boolean
    boolean_value = next(v for v in db_values if v.field_id == boolean_field_id)
    assert boolean_value.value_boolean is True, "Boolean should use value_boolean column"
    assert boolean_value.value_text is None, "Boolean should NOT use value_text"
    assert boolean_value.value_numeric is None, "Boolean should NOT use value_numeric"

    # Test UPSERT: Update same values again (should not create duplicates)
    update_response = await client.put(
        f"/api/videos/{video_id}/fields",
        json={
            "field_values": [
                {"field_id": str(rating_field_id), "value": 5.0}  # Update rating
            ]
        }
    )
    assert update_response.status_code == 200

    # Verify still only 4 values (UPSERT worked, no duplicate)
    values_stmt = select(VideoFieldValue).where(VideoFieldValue.video_id == video_id)
    db_result = await test_db.execute(values_stmt)
    db_values = db_result.scalars().all()
    assert len(db_values) == 4, "UPSERT should update, not create duplicate"

    # Verify rating was updated
    rating_value = next(v for v in db_values if v.field_id == rating_field_id)
    assert rating_value.value_numeric == 5.0, "Rating should be updated to 5.0"


@pytest.mark.asyncio
async def test_multi_tag_field_union_in_video_detail(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user
):
    """
    Test multi-tag field union in GET /videos/{id} endpoint.

    Endpoint: GET /api/lists/{list_id}/videos/{video_id} (Task #74 - Option D)

    Scenario:
    - Video has 2 tags: "Tutorial" and "Python"
    - "Tutorial" tag → Schema A (fields: Presentation, Rating)
    - "Python" tag → Schema B (fields: Rating, Difficulty)
    - Field "Rating" appears in BOTH schemas with SAME type → show once
    - Field union: {Presentation, Rating, Difficulty}

    Verifies:
    1. GET detail endpoint returns 200
    2. Response includes available_fields (all fields from union)
    3. Response includes field_values (only filled values)
    4. Field deduplication works (Rating appears once, not twice)
    5. No conflict prefix (same name + same type = no conflict)
    """
    # Store IDs at the start to avoid detached object issues
    list_id = test_list.id
    user_id = test_user.id

    # Arrange: Create video
    video = Video(
        list_id=list_id,
        youtube_id="python_tutorial_001",
        processing_status="completed",
        title="Python Tutorial: Basics"
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)
    video_id = video.id

    # Create 3 fields
    presentation_field = CustomField(
        list_id=list_id,
        name="Presentation",
        field_type="select",
        config={"options": ["bad", "good", "great"]}
    )
    rating_field = CustomField(
        list_id=list_id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    difficulty_field = CustomField(
        list_id=list_id,
        name="Difficulty",
        field_type="select",
        config={"options": ["beginner", "intermediate", "advanced"]}
    )
    test_db.add_all([presentation_field, rating_field, difficulty_field])
    await test_db.commit()

    # Create 2 schemas
    tutorial_schema = FieldSchema(
        list_id=list_id,
        name="Tutorial Schema",
        description="General tutorial metrics"
    )
    python_schema = FieldSchema(
        list_id=list_id,
        name="Python Schema",
        description="Python-specific metrics"
    )
    test_db.add_all([tutorial_schema, python_schema])
    await test_db.commit()

    # Schema A: Presentation + Rating
    join1 = SchemaField(
        schema_id=tutorial_schema.id,
        field_id=presentation_field.id,
        display_order=0,
        show_on_card=True
    )
    join2 = SchemaField(
        schema_id=tutorial_schema.id,
        field_id=rating_field.id,
        display_order=1,
        show_on_card=True
    )

    # Schema B: Rating (overlap!) + Difficulty
    join3 = SchemaField(
        schema_id=python_schema.id,
        field_id=rating_field.id,
        display_order=0,
        show_on_card=True
    )
    join4 = SchemaField(
        schema_id=python_schema.id,
        field_id=difficulty_field.id,
        display_order=1,
        show_on_card=False
    )
    test_db.add_all([join1, join2, join3, join4])
    await test_db.commit()

    # Create 2 tags with schemas (tags use user_id, not list_id)
    tutorial_tag = Tag(
        user_id=user_id,
        name="Tutorial",
        schema_id=tutorial_schema.id
    )
    python_tag = Tag(
        user_id=user_id,
        name="Python",
        schema_id=python_schema.id
    )
    test_db.add_all([tutorial_tag, python_tag])
    await test_db.commit()
    await test_db.refresh(tutorial_tag)
    await test_db.refresh(python_tag)

    # Store IDs before commit to avoid detached object issues
    tutorial_tag_id = tutorial_tag.id
    python_tag_id = python_tag.id

    # Assign both tags to video via direct insert into join table
    # (Avoids detached object issues with relationship lazy loading)
    from app.models.tag import video_tags
    from sqlalchemy import insert

    await test_db.execute(
        insert(video_tags).values([
            {"video_id": video_id, "tag_id": tutorial_tag_id},
            {"video_id": video_id, "tag_id": python_tag_id}
        ])
    )
    await test_db.commit()

    # Set field values (only 2 out of 3 fields filled)
    # Store field IDs to avoid detached access
    presentation_field_id = presentation_field.id
    rating_field_id = rating_field.id

    value1 = VideoFieldValue(
        video_id=video_id,
        field_id=presentation_field_id,
        value_text="great"
    )
    value2 = VideoFieldValue(
        video_id=video_id,
        field_id=rating_field_id,
        value_numeric=4
    )
    # Note: difficulty_field has NO value (should still appear in available_fields)
    test_db.add_all([value1, value2])
    await test_db.commit()

    # Act: GET video detail (Task #74 endpoint)
    # Debug: Verify video exists
    from sqlalchemy import select
    verify_stmt = select(Video).where(Video.id == video_id)
    verify_result = await test_db.execute(verify_stmt)
    verify_video = verify_result.scalar_one_or_none()
    assert verify_video is not None, f"Video {video_id} not found in database!"
    assert verify_video.list_id == list_id, f"Video list_id mismatch: {verify_video.list_id} != {list_id}"

    response = await client.get(f"/api/videos/{video_id}")

    # Assert: Response
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    video_data = response.json()

    # Assert: available_fields is present (detail endpoint only)
    assert "available_fields" in video_data, "Detail endpoint should include available_fields"
    available_fields = video_data["available_fields"]

    # Assert: Field union contains all 3 unique fields
    assert len(available_fields) == 3, "Should have 3 fields in union (Presentation, Rating, Difficulty)"
    field_names = {f["field_name"] for f in available_fields}
    assert field_names == {"Presentation", "Rating", "Difficulty"}, "Field union should deduplicate Rating"

    # Assert: No conflict prefix (same name + same type = no conflict)
    rating_fields = [f for f in available_fields if "Rating" in f["field_name"]]
    assert len(rating_fields) == 1, "Rating should appear once (deduplication)"
    assert rating_fields[0]["field_name"] == "Rating", "No conflict prefix needed (same type)"

    # Assert: field_values contains only filled values
    field_values = video_data["field_values"]
    assert len(field_values) == 2, "Should have 2 filled values (Presentation, Rating)"

    filled_field_names = {fv["field_name"] for fv in field_values}
    assert filled_field_names == {"Presentation", "Rating"}, "Only filled values should be returned"

    # Verify values are correct
    presentation_value = next(fv for fv in field_values if fv["field_name"] == "Presentation")
    assert presentation_value["value"] == "great", "Presentation value should be 'great'"

    rating_value = next(fv for fv in field_values if fv["field_name"] == "Rating")
    assert rating_value["value"] == 4, "Rating value should be 4"
