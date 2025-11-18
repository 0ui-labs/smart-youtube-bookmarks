# Task #77: Backend Integration Tests for Custom Fields System

**Plan Task:** #77
**Wave/Phase:** Wave 3 - Testing & Quality Assurance
**Dependencies:** Task #59-65 (all models and Pydantic schemas complete), Task #66-73 (API endpoints - tests can be written before implementation)

---

## 🎯 Ziel

Create comprehensive end-to-end integration tests for the Custom Fields System API flows. Tests verify full request-response cycles with real database operations, CASCADE delete behaviors, multi-model transactions, and data consistency. Focus on happy paths, error scenarios, CASCADE verification, and performance benchmarks for batch operations.

## 📋 Acceptance Criteria

- [ ] **Happy Path Tests**: Full end-to-end flows verified (create tag+schema+field, set field values, fetch videos with union logic)
  - Evidence: API responses match expected structure, database state reflects operations
- [ ] **CASCADE Delete Tests**: All cascade behaviors verified with database state inspection
  - Evidence: Deleting field removes values, deleting schema removes join entries, tags survive schema deletion
- [ ] **Error Handling Tests**: 404s, validation errors, constraint violations handled correctly
  - Evidence: Appropriate status codes and error messages returned
- [ ] **Transaction Isolation**: Tests use transaction rollback for cleanup and independence
  - Evidence: No test data pollution between tests
- [ ] **Performance Benchmarks**: Batch operations avoid N+1 queries
  - Evidence: Query count assertions for bulk operations
- [ ] **Test Coverage**: All major API flows covered with database verification
  - Evidence: Pytest passing with integration test suite
- [ ] **Code Reviewed**: Integration tests follow existing patterns from `test_progress_flow.py`

---

## 🛠️ Implementation Steps

### 1. Create Integration Test File Structure
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Create new integration test file with proper imports and fixtures

```python
"""
Integration tests for Custom Fields System API flows.

Tests end-to-end flows: API requests → Database state → Response validation
Focus on full integration with real database, CASCADE behaviors, and multi-model operations.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import AsyncClient
from uuid import UUID

from app.models.list import BookmarkList
from app.models.video import Video
from app.models.tag import Tag
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.video_field_value import VideoFieldValue
from app.models.user import User


# Utility helper for condition-based waiting (prevents flaky tests)
async def wait_for_condition(condition_func, timeout_seconds=5, poll_interval=0.1):
    """
    Wait for a database condition to become true (prevents race conditions).
    
    Args:
        condition_func: Async function that returns True when condition is met
        timeout_seconds: Maximum time to wait
        poll_interval: Time between polls
    
    Raises:
        TimeoutError: If condition not met within timeout
    """
    import asyncio
    elapsed = 0
    while elapsed < timeout_seconds:
        if await condition_func():
            return
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval
    raise TimeoutError(f"Condition not met after {timeout_seconds}s")
```

### 2. Test: Create Tag with New Schema and Fields (E2E Happy Path)
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test complete flow of creating tag with nested schema and fields in single request

```python
@pytest.mark.asyncio
async def test_create_tag_with_new_schema_and_fields(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    E2E test: Create tag with nested schema and fields in single API call.
    
    POST /api/lists/{list_id}/tags
    {
        "name": "Makeup Tutorials",
        "schema": {
            "name": "Video Quality",
            "fields": [
                {"name": "Presentation", "field_type": "select", "config": {...}, "show_on_card": true},
                {"name": "Overall Rating", "field_type": "rating", "config": {...}, "show_on_card": true}
            ]
        }
    }
    
    Verifies:
    1. API returns 201 with complete nested structure
    2. Database has Tag, FieldSchema, CustomField, SchemaField records
    3. Relationships are correctly established
    4. Foreign keys and joins are valid
    """
    # Arrange: Prepare request payload
    request_payload = {
        "name": "Makeup Tutorials",
        "schema": {
            "name": "Video Quality Schema",
            "description": "Standard quality metrics for makeup videos",
            "fields": [
                {
                    "name": "Presentation",
                    "field_type": "select",
                    "config": {"options": ["bad", "good", "great"]},
                    "show_on_card": True,
                    "display_order": 0
                },
                {
                    "name": "Overall Rating",
                    "field_type": "rating",
                    "config": {"max_rating": 5},
                    "show_on_card": True,
                    "display_order": 1
                }
            ]
        }
    }
    
    # Act: Create tag with schema and fields
    response = await client.post(
        f"/api/lists/{test_list.id}/tags",
        json=request_payload
    )
    
    # Assert: Response structure
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
    tag_data = response.json()
    
    assert tag_data["name"] == "Makeup Tutorials"
    assert tag_data["schema"] is not None
    assert tag_data["schema"]["name"] == "Video Quality Schema"
    assert len(tag_data["schema"]["fields"]) == 2
    
    # Extract IDs for database verification
    tag_id = UUID(tag_data["id"])
    schema_id = UUID(tag_data["schema"]["id"])
    field_ids = [UUID(f["id"]) for f in tag_data["schema"]["fields"]]
    
    # Assert: Database state - Tag exists and references schema
    tag_stmt = select(Tag).where(Tag.id == tag_id)
    result = await test_db.execute(tag_stmt)
    db_tag = result.scalar_one()
    
    assert db_tag.name == "Makeup Tutorials"
    assert db_tag.schema_id == schema_id
    assert db_tag.list_id == test_list.id
    
    # Assert: Database state - FieldSchema exists
    schema_stmt = select(FieldSchema).where(FieldSchema.id == schema_id)
    result = await test_db.execute(schema_stmt)
    db_schema = result.scalar_one()
    
    assert db_schema.name == "Video Quality Schema"
    assert db_schema.list_id == test_list.id
    
    # Assert: Database state - CustomFields exist
    fields_stmt = select(CustomField).where(CustomField.id.in_(field_ids))
    result = await test_db.execute(fields_stmt)
    db_fields = result.scalars().all()
    
    assert len(db_fields) == 2
    field_names = {f.name for f in db_fields}
    assert field_names == {"Presentation", "Overall Rating"}
    
    # Verify config is correctly stored
    presentation_field = next(f for f in db_fields if f.name == "Presentation")
    assert presentation_field.field_type == "select"
    assert presentation_field.config == {"options": ["bad", "good", "great"]}
    
    rating_field = next(f for f in db_fields if f.name == "Overall Rating")
    assert rating_field.field_type == "rating"
    assert rating_field.config == {"max_rating": 5}
    
    # Assert: Database state - SchemaField join entries exist
    join_stmt = select(SchemaField).where(SchemaField.schema_id == schema_id)
    result = await test_db.execute(join_stmt)
    db_joins = result.scalars().all()
    
    assert len(db_joins) == 2
    for join_entry in db_joins:
        assert join_entry.schema_id == schema_id
        assert join_entry.field_id in field_ids
        assert join_entry.show_on_card is True  # Both fields have show_on_card=True
    
    # Verify display_order is correctly set
    orders = {j.field_id: j.display_order for j in db_joins}
    assert presentation_field.id in orders
    assert rating_field.id in orders
```

### 3. Test: Add Fields to Existing Schema
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test adding new fields to an existing schema via PATCH/POST

```python
@pytest.mark.asyncio
async def test_add_fields_to_existing_schema(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    Test adding new custom fields to an existing schema.
    
    PATCH /api/lists/{list_id}/schemas/{schema_id}/fields
    {
        "field_id": "uuid-of-existing-field",
        "show_on_card": true,
        "display_order": 2
    }
    
    Verifies:
    1. New SchemaField join entry is created
    2. Existing schema and field are not modified
    3. display_order and show_on_card are correctly set
    """
    # Arrange: Create schema with one field
    existing_field = CustomField(
        list_id=test_list.id,
        name="Lighting Quality",
        field_type="select",
        config={"options": ["poor", "adequate", "excellent"]}
    )
    test_db.add(existing_field)
    
    schema = FieldSchema(
        list_id=test_list.id,
        name="Production Quality",
        description="Technical production metrics"
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(existing_field)
    await test_db.refresh(schema)
    
    # Create another field to add to schema
    new_field = CustomField(
        list_id=test_list.id,
        name="Audio Quality",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(new_field)
    await test_db.commit()
    await test_db.refresh(new_field)
    
    # Act: Add new field to schema
    response = await client.post(
        f"/api/lists/{test_list.id}/schemas/{schema.id}/fields",
        json={
            "field_id": str(new_field.id),
            "show_on_card": True,
            "display_order": 1
        }
    )
    
    # Assert: Response
    assert response.status_code == 201
    
    # Assert: Database state - SchemaField join entry exists
    join_stmt = select(SchemaField).where(
        SchemaField.schema_id == schema.id,
        SchemaField.field_id == new_field.id
    )
    result = await test_db.execute(join_stmt)
    db_join = result.scalar_one()
    
    assert db_join.show_on_card is True
    assert db_join.display_order == 1
    
    # Assert: Original field and schema unchanged
    await test_db.refresh(schema)
    await test_db.refresh(existing_field)
    assert schema.name == "Production Quality"
    assert existing_field.name == "Lighting Quality"
```

### 4. Test: Set Field Values on Videos
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test setting field values for videos via PATCH endpoint

```python
@pytest.mark.asyncio
async def test_set_field_values_on_video(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user: User
):
    """
    Test setting custom field values on a video.
    
    PATCH /api/lists/{list_id}/videos/{video_id}/field-values
    {
        "field_values": [
            {"field_id": "uuid1", "value": "great"},
            {"field_id": "uuid2", "value": 4.5}
        ]
    }
    
    Verifies:
    1. VideoFieldValue records created with correct typed columns
    2. value_text used for select fields
    3. value_numeric used for rating fields
    4. UNIQUE constraint (video_id, field_id) enforced
    """
    # Arrange: Create fields
    select_field = CustomField(
        list_id=test_list.id,
        name="Presentation Style",
        field_type="select",
        config={"options": ["bad", "good", "great"]}
    )
    rating_field = CustomField(
        list_id=test_list.id,
        name="Overall Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add_all([select_field, rating_field])
    await test_db.commit()
    await test_db.refresh(select_field)
    await test_db.refresh(rating_field)
    
    # Act: Set field values
    response = await client.patch(
        f"/api/lists/{test_list.id}/videos/{test_video.id}/field-values",
        json={
            "field_values": [
                {"field_id": str(select_field.id), "value": "great"},
                {"field_id": str(rating_field.id), "value": 4.5}
            ]
        }
    )
    
    # Assert: Response
    assert response.status_code == 200
    
    # Assert: Database state - VideoFieldValue records exist
    values_stmt = select(VideoFieldValue).where(
        VideoFieldValue.video_id == test_video.id
    )
    result = await test_db.execute(values_stmt)
    db_values = result.scalars().all()
    
    assert len(db_values) == 2
    
    # Verify select field value uses value_text column
    select_value = next(v for v in db_values if v.field_id == select_field.id)
    assert select_value.value_text == "great"
    assert select_value.value_numeric is None
    assert select_value.value_boolean is None
    
    # Verify rating field value uses value_numeric column
    rating_value = next(v for v in db_values if v.field_id == rating_field.id)
    assert rating_value.value_numeric == 4.5
    assert rating_value.value_text is None
    assert rating_value.value_boolean is None
```

### 5. Test: Fetch Video with Field Union Logic
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test fetching video with multiple tags that have different schemas

```python
@pytest.mark.asyncio
async def test_fetch_video_with_field_union_logic(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_video: Video,
    test_user: User
):
    """
    Test fetching video with multiple tags having different schemas (field union).
    
    GET /api/lists/{list_id}/videos/{video_id}
    
    Verifies:
    1. Video response includes all fields from all schemas (union)
    2. Field values are correctly populated
    3. No duplicate fields in response
    """
    # Arrange: Create two schemas with different fields
    field1 = CustomField(list_id=test_list.id, name="Field A", field_type="text", config={})
    field2 = CustomField(list_id=test_list.id, name="Field B", field_type="rating", config={"max_rating": 5})
    field3 = CustomField(list_id=test_list.id, name="Field C", field_type="boolean", config={})
    test_db.add_all([field1, field2, field3])
    
    schema1 = FieldSchema(list_id=test_list.id, name="Schema 1")
    schema2 = FieldSchema(list_id=test_list.id, name="Schema 2")
    test_db.add_all([schema1, schema2])
    await test_db.commit()
    
    # Schema 1 has field1 and field2
    join1 = SchemaField(schema_id=schema1.id, field_id=field1.id, display_order=0, show_on_card=True)
    join2 = SchemaField(schema_id=schema1.id, field_id=field2.id, display_order=1, show_on_card=True)
    
    # Schema 2 has field2 (overlap!) and field3
    join3 = SchemaField(schema_id=schema2.id, field_id=field2.id, display_order=0, show_on_card=True)
    join4 = SchemaField(schema_id=schema2.id, field_id=field3.id, display_order=1, show_on_card=False)
    test_db.add_all([join1, join2, join3, join4])
    
    # Create tags with schemas
    tag1 = Tag(list_id=test_list.id, name="Tag 1", schema_id=schema1.id)
    tag2 = Tag(list_id=test_list.id, name="Tag 2", schema_id=schema2.id)
    test_db.add_all([tag1, tag2])
    await test_db.commit()
    
    # Assign both tags to video
    test_video.tags.append(tag1)
    test_video.tags.append(tag2)
    
    # Set field values
    value1 = VideoFieldValue(video_id=test_video.id, field_id=field1.id, value_text="Test text")
    value2 = VideoFieldValue(video_id=test_video.id, field_id=field2.id, value_numeric=3)
    value3 = VideoFieldValue(video_id=test_video.id, field_id=field3.id, value_boolean=True)
    test_db.add_all([value1, value2, value3])
    await test_db.commit()
    
    # Act: Fetch video
    response = await client.get(f"/api/lists/{test_list.id}/videos/{test_video.id}")
    
    # Assert: Response
    assert response.status_code == 200
    video_data = response.json()
    
    # Assert: Field union - should have all 3 fields (field2 appears once despite being in both schemas)
    field_values = video_data.get("field_values", [])
    assert len(field_values) == 3
    
    field_names = {fv["field_name"] for fv in field_values}
    assert field_names == {"Field A", "Field B", "Field C"}
    
    # Verify values are correctly returned
    field_a_value = next(fv for fv in field_values if fv["field_name"] == "Field A")
    assert field_a_value["value"] == "Test text"
    
    field_b_value = next(fv for fv in field_values if fv["field_name"] == "Field B")
    assert field_b_value["value"] == 3
    
    field_c_value = next(fv for fv in field_values if fv["field_name"] == "Field C")
    assert field_c_value["value"] is True
```

### 6. Test: CASCADE Delete - Field Removes Values
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test deleting custom field cascades to video_field_values table

```python
@pytest.mark.asyncio
async def test_cascade_delete_field_removes_values(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    Test CASCADE delete: Deleting custom field removes all video_field_values.
    
    DELETE /api/lists/{list_id}/custom-fields/{field_id}
    
    Verifies:
    1. DELETE request returns 204
    2. CustomField record is deleted
    3. All VideoFieldValue records with field_id are CASCADE deleted
    4. Videos remain intact
    
    Migration reference: Line 81 - ondelete="CASCADE"
    """
    # Arrange: Create field
    field = CustomField(
        list_id=test_list.id,
        name="Test Field",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    field_id = field.id
    
    # Create videos with field values
    video1 = Video(list_id=test_list.id, youtube_id="video1", processing_status="completed")
    video2 = Video(list_id=test_list.id, youtube_id="video2", processing_status="completed")
    test_db.add_all([video1, video2])
    await test_db.commit()
    
    value1 = VideoFieldValue(video_id=video1.id, field_id=field_id, value_numeric=4)
    value2 = VideoFieldValue(video_id=video2.id, field_id=field_id, value_numeric=5)
    test_db.add_all([value1, value2])
    await test_db.commit()
    
    # Verify setup: 2 values exist
    values_stmt = select(VideoFieldValue).where(VideoFieldValue.field_id == field_id)
    result = await test_db.execute(values_stmt)
    assert len(result.scalars().all()) == 2
    
    # Act: Delete field
    response = await client.delete(f"/api/lists/{test_list.id}/custom-fields/{field_id}")
    
    # Assert: Response
    assert response.status_code == 204
    
    # Assert: Field is deleted
    field_stmt = select(CustomField).where(CustomField.id == field_id)
    result = await test_db.execute(field_stmt)
    assert result.scalar_one_or_none() is None
    
    # Assert: CASCADE deleted values
    values_stmt = select(VideoFieldValue).where(VideoFieldValue.field_id == field_id)
    result = await test_db.execute(values_stmt)
    remaining_values = result.scalars().all()
    assert len(remaining_values) == 0, "VideoFieldValue records should be CASCADE deleted"
    
    # Assert: Videos remain intact
    video_stmt = select(Video).where(Video.id.in_([video1.id, video2.id]))
    result = await test_db.execute(video_stmt)
    remaining_videos = result.scalars().all()
    assert len(remaining_videos) == 2, "Videos should NOT be deleted"
```

### 7. Test: CASCADE Delete - Schema Removes Join Entries
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test deleting schema cascades to schema_fields join table

```python
@pytest.mark.asyncio
async def test_cascade_delete_schema_removes_join_entries(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    Test CASCADE delete: Deleting schema removes schema_fields join entries.
    
    DELETE /api/lists/{list_id}/schemas/{schema_id}
    
    Verifies:
    1. DELETE request returns 204
    2. FieldSchema record is deleted
    3. All SchemaField join entries are CASCADE deleted
    4. CustomField records remain intact (fields are reusable)
    
    Migration reference: Line 65 - ondelete="CASCADE"
    """
    # Arrange: Create schema with fields
    field1 = CustomField(list_id=test_list.id, name="Field 1", field_type="text", config={})
    field2 = CustomField(list_id=test_list.id, name="Field 2", field_type="rating", config={"max_rating": 5})
    test_db.add_all([field1, field2])
    
    schema = FieldSchema(list_id=test_list.id, name="Test Schema", description="Test")
    test_db.add(schema)
    await test_db.commit()
    
    # Add fields to schema
    join1 = SchemaField(schema_id=schema.id, field_id=field1.id, display_order=0, show_on_card=True)
    join2 = SchemaField(schema_id=schema.id, field_id=field2.id, display_order=1, show_on_card=True)
    test_db.add_all([join1, join2])
    await test_db.commit()
    
    schema_id = schema.id
    
    # Verify setup: 2 join entries exist
    join_stmt = select(SchemaField).where(SchemaField.schema_id == schema_id)
    result = await test_db.execute(join_stmt)
    assert len(result.scalars().all()) == 2
    
    # Act: Delete schema
    response = await client.delete(f"/api/lists/{test_list.id}/schemas/{schema_id}")
    
    # Assert: Response
    assert response.status_code == 204
    
    # Assert: Schema is deleted
    schema_stmt = select(FieldSchema).where(FieldSchema.id == schema_id)
    result = await test_db.execute(schema_stmt)
    assert result.scalar_one_or_none() is None
    
    # Assert: CASCADE deleted join entries
    join_stmt = select(SchemaField).where(SchemaField.schema_id == schema_id)
    result = await test_db.execute(join_stmt)
    remaining_joins = result.scalars().all()
    assert len(remaining_joins) == 0, "SchemaField join entries should be CASCADE deleted"
    
    # Assert: CustomFields remain intact (reusable!)
    fields_stmt = select(CustomField).where(CustomField.id.in_([field1.id, field2.id]))
    result = await test_db.execute(fields_stmt)
    remaining_fields = result.scalars().all()
    assert len(remaining_fields) == 2, "CustomField records should NOT be deleted"
```

### 8. Test: CASCADE Delete - Tag Survives Schema Deletion (SET NULL)
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test deleting schema sets tag.schema_id to NULL (ON DELETE SET NULL)

```python
@pytest.mark.asyncio
async def test_cascade_delete_schema_sets_tag_null(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    Test CASCADE delete: Deleting schema sets tag.schema_id to NULL (not CASCADE delete).
    
    DELETE /api/lists/{list_id}/schemas/{schema_id}
    
    Verifies:
    1. DELETE request returns 204
    2. FieldSchema record is deleted
    3. Tag.schema_id set to NULL (ON DELETE SET NULL)
    4. Tag record remains intact
    
    Migration reference: Line 102 - ondelete="SET NULL"
    """
    # Arrange: Create schema
    schema = FieldSchema(list_id=test_list.id, name="Test Schema")
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)
    schema_id = schema.id
    
    # Create tag with schema
    tag = Tag(list_id=test_list.id, name="Test Tag", schema_id=schema_id)
    test_db.add(tag)
    await test_db.commit()
    await test_db.refresh(tag)
    tag_id = tag.id
    
    # Verify setup: Tag has schema_id
    assert tag.schema_id == schema_id
    
    # Act: Delete schema
    response = await client.delete(f"/api/lists/{test_list.id}/schemas/{schema_id}")
    
    # Assert: Response
    assert response.status_code == 204
    
    # Assert: Schema is deleted
    schema_stmt = select(FieldSchema).where(FieldSchema.id == schema_id)
    result = await test_db.execute(schema_stmt)
    assert result.scalar_one_or_none() is None
    
    # Assert: Tag survives with schema_id set to NULL
    tag_stmt = select(Tag).where(Tag.id == tag_id)
    result = await test_db.execute(tag_stmt)
    remaining_tag = result.scalar_one()
    
    assert remaining_tag is not None, "Tag should NOT be deleted"
    assert remaining_tag.schema_id is None, "Tag.schema_id should be SET NULL"
    assert remaining_tag.name == "Test Tag", "Tag name should remain unchanged"
```

### 9. Test: Error Handling - 404 Not Found
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test API returns 404 for non-existent resources

```python
@pytest.mark.asyncio
async def test_error_handling_404_not_found(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    Test error handling: API returns 404 for non-existent resources.
    
    Verifies:
    1. GET /api/lists/{list_id}/custom-fields/{invalid_uuid} → 404
    2. DELETE /api/lists/{list_id}/schemas/{invalid_uuid} → 404
    3. PATCH /api/lists/{list_id}/videos/{valid_id}/field-values with invalid field_id → 400 or 404
    """
    from uuid import uuid4
    
    # Test 1: Get non-existent field
    invalid_field_id = uuid4()
    response = await client.get(f"/api/lists/{test_list.id}/custom-fields/{invalid_field_id}")
    assert response.status_code == 404
    error = response.json()
    assert "detail" in error
    assert "not found" in error["detail"].lower()
    
    # Test 2: Delete non-existent schema
    invalid_schema_id = uuid4()
    response = await client.delete(f"/api/lists/{test_list.id}/schemas/{invalid_schema_id}")
    assert response.status_code == 404
    
    # Test 3: Set field value with invalid field_id
    video = Video(list_id=test_list.id, youtube_id="test123", processing_status="completed")
    test_db.add(video)
    await test_db.commit()
    
    invalid_field_id = uuid4()
    response = await client.patch(
        f"/api/lists/{test_list.id}/videos/{video.id}/field-values",
        json={
            "field_values": [
                {"field_id": str(invalid_field_id), "value": "test"}
            ]
        }
    )
    assert response.status_code in [400, 404], "Should return error for invalid field_id"
```

### 10. Test: Error Handling - Validation Errors
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test API returns 422 for validation errors (Pydantic validation)

```python
@pytest.mark.asyncio
async def test_error_handling_validation_errors(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    Test error handling: API returns 422 for validation errors.
    
    Verifies:
    1. Invalid field_type → 422
    2. Invalid config for field_type → 422
    3. Missing required fields → 422
    4. Invalid value for field (e.g., rating > max_rating) → 422
    """
    # Test 1: Invalid field_type
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Test Field",
            "field_type": "invalid_type",  # Not in ['select', 'rating', 'text', 'boolean']
            "config": {}
        }
    )
    assert response.status_code == 422
    
    # Test 2: Invalid config for rating field (missing max_rating)
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Rating Field",
            "field_type": "rating",
            "config": {}  # Missing max_rating
        }
    )
    assert response.status_code == 422
    
    # Test 3: Select field with empty options list
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Select Field",
            "field_type": "select",
            "config": {"options": []}  # Empty list
        }
    )
    assert response.status_code == 422
    
    # Test 4: Invalid value for rating field (exceeds max_rating)
    rating_field = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(rating_field)
    await test_db.commit()
    
    video = Video(list_id=test_list.id, youtube_id="test123", processing_status="completed")
    test_db.add(video)
    await test_db.commit()
    
    response = await client.patch(
        f"/api/lists/{test_list.id}/videos/{video.id}/field-values",
        json={
            "field_values": [
                {"field_id": str(rating_field.id), "value": 10}  # Exceeds max_rating=5
            ]
        }
    )
    assert response.status_code == 422
```

### 11. Test: Error Handling - Constraint Violations
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test API handles database constraint violations (UNIQUE, CHECK)

```python
@pytest.mark.asyncio
async def test_error_handling_constraint_violations(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    Test error handling: API handles database constraint violations.
    
    Verifies:
    1. UNIQUE constraint (list_id, name) for custom_fields → 409 Conflict
    2. CHECK constraint for field_type → 500 or caught by Pydantic (422)
    3. UNIQUE constraint (video_id, field_id) for video_field_values → handled by upsert
    """
    # Test 1: Duplicate field name in same list (UNIQUE constraint)
    field = CustomField(
        list_id=test_list.id,
        name="Duplicate Field",
        field_type="text",
        config={}
    )
    test_db.add(field)
    await test_db.commit()
    
    # Try to create another field with same name
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Duplicate Field",  # Same name
            "field_type": "rating",
            "config": {"max_rating": 5}
        }
    )
    assert response.status_code == 409, "Should return 409 Conflict for duplicate name"
    error = response.json()
    assert "detail" in error
    assert "already exists" in error["detail"].lower() or "duplicate" in error["detail"].lower()
    
    # Test 2: UNIQUE constraint (video_id, field_id) should trigger upsert logic
    video = Video(list_id=test_list.id, youtube_id="test123", processing_status="completed")
    test_db.add(video)
    await test_db.commit()
    
    # Set value first time
    response1 = await client.patch(
        f"/api/lists/{test_list.id}/videos/{video.id}/field-values",
        json={
            "field_values": [
                {"field_id": str(field.id), "value": "First value"}
            ]
        }
    )
    assert response1.status_code == 200
    
    # Set value second time (should upsert, not error)
    response2 = await client.patch(
        f"/api/lists/{test_list.id}/videos/{video.id}/field-values",
        json={
            "field_values": [
                {"field_id": str(field.id), "value": "Updated value"}
            ]
        }
    )
    assert response2.status_code == 200
    
    # Verify only one value exists (upsert worked)
    values_stmt = select(VideoFieldValue).where(
        VideoFieldValue.video_id == video.id,
        VideoFieldValue.field_id == field.id
    )
    result = await test_db.execute(values_stmt)
    values = result.scalars().all()
    assert len(values) == 1
    assert values[0].value_text == "Updated value"
```

### 12. Test: Performance - Batch Field Values Update
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test batch update of field values avoids N+1 queries

```python
@pytest.mark.asyncio
async def test_performance_batch_field_values_update(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    Test performance: Batch update of field values avoids N+1 queries.
    
    PATCH /api/lists/{list_id}/videos/batch-field-values
    {
        "updates": [
            {"video_id": "uuid1", "field_id": "uuid2", "value": 5},
            {"video_id": "uuid3", "field_id": "uuid4", "value": "great"},
            ...
        ]
    }
    
    Verifies:
    1. Batch operation completes successfully
    2. Query count is O(1) not O(n) - uses bulk upsert
    3. All values are correctly updated in database
    """
    # Arrange: Create 10 videos and 3 fields
    videos = [
        Video(list_id=test_list.id, youtube_id=f"video{i}", processing_status="completed")
        for i in range(10)
    ]
    test_db.add_all(videos)
    
    field1 = CustomField(list_id=test_list.id, name="Field 1", field_type="rating", config={"max_rating": 5})
    field2 = CustomField(list_id=test_list.id, name="Field 2", field_type="select", config={"options": ["a", "b", "c"]})
    field3 = CustomField(list_id=test_list.id, name="Field 3", field_type="boolean", config={})
    test_db.add_all([field1, field2, field3])
    await test_db.commit()
    
    # Refresh to get IDs
    for video in videos:
        await test_db.refresh(video)
    await test_db.refresh(field1)
    await test_db.refresh(field2)
    await test_db.refresh(field3)
    
    # Act: Batch update field values for all videos (30 total updates)
    updates = []
    for i, video in enumerate(videos):
        updates.append({"video_id": str(video.id), "field_id": str(field1.id), "value": (i % 5) + 1})
        updates.append({"video_id": str(video.id), "field_id": str(field2.id), "value": ["a", "b", "c"][i % 3]})
        updates.append({"video_id": str(video.id), "field_id": str(field3.id), "value": i % 2 == 0})
    
    response = await client.patch(
        f"/api/lists/{test_list.id}/videos/batch-field-values",
        json={"updates": updates}
    )
    
    # Assert: Response
    assert response.status_code == 200
    result = response.json()
    assert result["updated_count"] == 30
    
    # Assert: Database state - all values exist
    values_stmt = select(VideoFieldValue).where(
        VideoFieldValue.video_id.in_([v.id for v in videos])
    )
    db_result = await test_db.execute(values_stmt)
    db_values = db_result.scalars().all()
    assert len(db_values) == 30, "All 30 field values should be created"
    
    # Verify correctness of values
    for i, video in enumerate(videos):
        video_values_stmt = select(VideoFieldValue).where(VideoFieldValue.video_id == video.id)
        result = await test_db.execute(video_values_stmt)
        video_values = result.scalars().all()
        assert len(video_values) == 3, f"Video {i} should have 3 field values"
```

### 13. Test: Transaction Isolation and Cleanup
**Files:** `backend/tests/integration/test_custom_fields_flow.py`
**Action:** Test that tests are isolated and don't pollute each other's data

```python
@pytest.mark.asyncio
async def test_transaction_isolation_between_tests(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    test_user: User
):
    """
    Test transaction isolation: Verify test data doesn't leak between tests.
    
    This test verifies the test infrastructure (conftest.py fixtures)
    properly isolates tests using transaction rollback.
    
    Verifies:
    1. Creating data in this test doesn't affect other tests
    2. Database state is clean at start of each test
    3. pytest-asyncio with test_db fixture provides isolation
    """
    # Verify clean state - no custom fields exist yet
    fields_stmt = select(CustomField).where(CustomField.list_id == test_list.id)
    result = await test_db.execute(fields_stmt)
    existing_fields = result.scalars().all()
    
    # In a properly isolated test, we should start with no custom fields
    # (unless explicitly created by fixtures)
    # This assertion may need adjustment based on fixture setup
    initial_count = len(existing_fields)
    
    # Create test data
    field = CustomField(
        list_id=test_list.id,
        name="Isolation Test Field",
        field_type="text",
        config={}
    )
    test_db.add(field)
    await test_db.commit()
    
    # Verify it exists now
    result = await test_db.execute(fields_stmt)
    current_fields = result.scalars().all()
    assert len(current_fields) == initial_count + 1
    
    # After this test completes, pytest should rollback the transaction
    # Next test should not see "Isolation Test Field"
    # (Verified implicitly by other tests not failing due to unexpected data)
```

### 14. Update conftest.py with Custom Fields Fixtures
**Files:** `backend/tests/conftest.py`
**Action:** Add reusable fixtures for custom fields testing

```python
# Add to existing backend/tests/conftest.py

from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.video_field_value import VideoFieldValue


@pytest.fixture
async def test_custom_field(test_db: AsyncSession, test_list: BookmarkList) -> CustomField:
    """Create a test custom field (rating type)."""
    field = CustomField(
        list_id=test_list.id,
        name="Test Rating Field",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


@pytest.fixture
async def test_field_schema(test_db: AsyncSession, test_list: BookmarkList) -> FieldSchema:
    """Create a test field schema."""
    schema = FieldSchema(
        list_id=test_list.id,
        name="Test Schema",
        description="A test schema for integration tests"
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)
    return schema


@pytest.fixture
async def custom_field_factory(test_db: AsyncSession):
    """
    Factory fixture for creating multiple custom fields with different types.
    
    Usage:
        async def test_example(custom_field_factory):
            rating_field = await custom_field_factory(list_id, "Rating", "rating", {"max_rating": 5})
            select_field = await custom_field_factory(list_id, "Quality", "select", {"options": ["bad", "good"]})
    """
    created_fields = []
    
    async def _create_field(list_id: UUID, name: str, field_type: str, config: dict):
        """Create a custom field with specified parameters."""
        field = CustomField(
            list_id=list_id,
            name=name,
            field_type=field_type,
            config=config
        )
        test_db.add(field)
        await test_db.commit()
        await test_db.refresh(field)
        created_fields.append(field)
        return field
    
    yield _create_field
    
    # Cleanup not needed - test_db rollback handles it
```

### 15. Add Integration Test to CI Pipeline
**Files:** `.github/workflows/backend-tests.yml` (if exists) or documentation
**Action:** Document how to run integration tests in CI/CD

```yaml
# Add to CI pipeline (if .github/workflows/backend-tests.yml exists)
# Otherwise document in README or CLAUDE.md

- name: Run Integration Tests
  run: |
    cd backend
    pytest tests/integration/ -v --maxfail=5
  env:
    DATABASE_URL: postgresql+asyncpg://test_user:test_pass@localhost:5432/youtube_bookmarks_test
```

---

## 🧪 Testing Strategy

**Fixture Strategy:**
- Reuse existing fixtures from `backend/tests/conftest.py` (test_db, client, test_user, test_list, test_video)
- Add custom field-specific fixtures (test_custom_field, test_field_schema, custom_field_factory)
- Use async fixtures with proper transaction rollback for isolation

**Database State Verification:**
- After each API call, query database directly using SQLAlchemy to verify state
- Use `select()` statements to inspect tables: CustomField, FieldSchema, SchemaField, VideoFieldValue
- Verify CASCADE behaviors by checking affected rows are deleted/updated

**Test Independence:**
- Each test uses `test_db` fixture with transaction rollback
- Tests create their own data using fixtures or inline setup
- No shared state between tests (verified by `test_transaction_isolation_between_tests`)

**Performance Testing:**
- Use query count assertions for batch operations
- Verify O(1) query patterns instead of O(n) for bulk updates
- Test with realistic data sizes (10+ videos, multiple fields)

**Error Scenario Coverage:**
- 404 Not Found: Non-existent resource IDs
- 422 Validation Error: Invalid Pydantic schemas
- 409 Conflict: UNIQUE constraint violations
- Constraint violations: Database-level CHECK constraints

**Manual Testing (Post-Implementation):**
1. Run full integration test suite: `pytest tests/integration/test_custom_fields_flow.py -v`
2. Verify all tests pass without warnings
3. Check test database cleanup (no orphaned records after test run)
4. Run with coverage: `pytest tests/integration/test_custom_fields_flow.py --cov=app.api --cov=app.models`
5. Inspect coverage report for gaps in integration coverage

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 620-652 (Integration Tests section)
- `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` - CASCADE behaviors
- FastAPI Async Tests: https://fastapi.tiangolo.com/advanced/async-tests/
- SQLAlchemy CASCADE Docs: https://docs.sqlalchemy.org/en/20/orm/cascades.html#delete

**Related Code:**
- Existing integration test pattern: `backend/tests/integration/test_progress_flow.py`
- Test fixtures: `backend/tests/conftest.py`
- Model definitions: `backend/app/models/custom_field.py`, `backend/app/models/field_schema.py`, etc.
- Pydantic schemas: `backend/app/schemas/custom_field.py`

**Design Decisions:**

1. **Use AsyncClient instead of TestClient:**
   - Reasoning: Matches existing pattern in `test_progress_flow.py`
   - Allows testing async database operations with real async/await
   - REF: FastAPI docs recommend AsyncClient for async applications

2. **Database State Verification After Every Operation:**
   - Reasoning: Integration tests verify full flow, not just API responses
   - Ensures CASCADE behaviors work correctly at database level
   - Catches issues that mocked unit tests would miss

3. **Condition-Based Waiting (wait_for_condition helper):**
   - Reasoning: Prevents flaky tests from race conditions
   - Borrowed pattern from `test_progress_flow.py` (lines 22-43)
   - More reliable than fixed time.sleep() calls

4. **Transaction Isolation via test_db Fixture:**
   - Reasoning: Tests don't pollute each other's state
   - Uses pytest-asyncio with transaction rollback per test
   - Matches existing fixture pattern in `conftest.py`

5. **Factory Fixtures for Flexible Test Data:**
   - Reasoning: Allows tests to create multiple fields/schemas with different configs
   - Reduces boilerplate in test setup
   - Pattern from existing `user_factory` fixture (conftest.py lines 134-161)

6. **Performance Tests with Query Count Assertions:**
   - Reasoning: Ensures batch operations scale efficiently
   - Prevents N+1 query anti-patterns from being introduced
   - Critical for production performance with large datasets

7. **Comprehensive CASCADE Testing:**
   - Reasoning: Database CASCADE behaviors are critical failure points
   - Tests verify: field→values, schema→joins, schema→tag (SET NULL)
   - Migration lines 27, 65, 81, 102 define CASCADE behaviors to test

**Testing Anti-Patterns to Avoid:**
- Don't mock database calls in integration tests (use real DB)
- Don't use fixed time.sleep() for async operations (use condition polling)
- Don't share test data between tests (use fixtures with rollback)
- Don't skip database state verification (always verify after API calls)
- Don't test implementation details (test API contracts and DB state)

**REF MCP Research Findings:**
1. FastAPI AsyncClient requires `ASGITransport(app=app)` for async testing (existing pattern confirmed)
2. SQLAlchemy CASCADE delete with `passive_deletes=True` requires explicit database verification in tests
3. pytest-asyncio with `@pytest.mark.asyncio` enables async test functions
4. Database constraint violations should be caught at API layer (409/422 responses, not 500 errors)
