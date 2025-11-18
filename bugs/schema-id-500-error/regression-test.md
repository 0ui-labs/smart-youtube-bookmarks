# Regression Test Design: 500 Error When Updating Tag with schema_id

## Bug ID
`schema-id-500-error`

## Date
2025-11-18

## Test Philosophy

**Test-Driven Development (TDD):**
1. Write test that FAILS (reproduces bug)
2. Implement fix
3. Test PASSES (proves fix works)
4. Test remains in suite (prevents regression)

## Test Suite Location

`/backend/tests/test_tag_schema_integration.py` (NEW FILE)

**Why new file:**
- Focuses specifically on tag-schema integration
- Isolates regression tests from unit tests
- Makes bug reproduction explicit

## Test Cases

### Test 1: Create Tag with Schema ID
**Test Name:** `test_create_tag_with_schema_id`

**Purpose:** Verify TagCreate accepts and sets schema_id

**Setup:**
1. Create test user
2. Create test list (owned by user)
3. Create test schema (belongs to list)

**Test:**
```python
async def test_create_tag_with_schema_id(async_client, test_user, test_list, test_schema):
    """
    Regression test for Bug #schema-id-500-error (Part 1).

    BEFORE FIX: schema_id silently ignored, tag created with schema_id=null
    AFTER FIX: schema_id accepted and set correctly
    """
    # Create tag with schema_id
    response = await async_client.post(
        "/api/tags",
        json={
            "name": "Test Tag",
            "color": "#FF5733",
            "schema_id": str(test_schema.id)
        }
    )

    # Should succeed
    assert response.status_code == 201

    data = response.json()

    # CRITICAL: schema_id should be SET (not null)
    assert data["schema_id"] == str(test_schema.id)
    assert data["name"] == "Test Tag"
    # Note: TagResponse no longer includes nested 'schema' object (Bug #002 fix)
    assert "schema" not in data or data.get("schema") is None
```

**Expected Behavior:**
- BEFORE FIX: `data["schema_id"]` is `null` (FAIL)
- AFTER FIX: `data["schema_id"]` matches provided ID (PASS)

### Test 2: Update Tag with Schema ID
**Test Name:** `test_update_tag_with_schema_id`

**Purpose:** Verify tag update accepts schema_id without 500 error

**Setup:**
1. Create test tag (without schema)
2. Create test schema

**Test:**
```python
async def test_update_tag_with_schema_id(async_client, test_tag, test_schema):
    """
    Regression test for Bug #schema-id-500-error (Part 2).

    BEFORE FIX: 500 Internal Server Error during response serialization
    AFTER FIX: Tag updated successfully with schema_id set
    """
    # Update tag to add schema
    response = await async_client.put(
        f"/api/tags/{test_tag.id}",
        json={"schema_id": str(test_schema.id)}
    )

    # Should succeed (not 500!)
    assert response.status_code == 200

    data = response.json()

    # schema_id should be set
    assert data["schema_id"] == str(test_schema.id)

    # Note: TagResponse no longer includes nested 'schema' object (Bug #002 fix)
    # Frontend should use schema_id and fetch schema separately if needed
    assert "schema" not in data or data.get("schema") is None
```

**Expected Behavior:**
- BEFORE FIX: 500 error (FAIL)
- AFTER FIX: 200 with schema_id set (PASS)

### Test 3: List Tags with Schemas
**Test Name:** `test_list_tags_with_schemas`

**Purpose:** Verify GET /api/tags works when tags have schemas

**Setup:**
1. Create multiple tags, some with schemas, some without

**Test:**
```python
async def test_list_tags_with_schemas(async_client, test_user, test_list, test_schema):
    """
    Regression test for Bug #schema-id-500-error (Pattern Recognition).

    BEFORE FIX: 500 error when loading tags with schemas
    AFTER FIX: All tags load successfully with schema_id set
    """
    # Create tags with and without schemas
    tag1 = await create_tag(name="Tag Without Schema", schema_id=None)
    tag2 = await create_tag(name="Tag With Schema", schema_id=test_schema.id)

    # List all tags
    response = await async_client.get("/api/tags")

    # Should succeed
    assert response.status_code == 200

    data = response.json()
    assert len(data) >= 2

    # Find tag with schema
    tag_with_schema = next(t for t in data if t["id"] == str(tag2.id))

    # Verify schema_id is set
    assert tag_with_schema["schema_id"] == str(test_schema.id)
    # Note: TagResponse no longer includes nested 'schema' object (Bug #002 fix)
    assert "schema" not in tag_with_schema or tag_with_schema.get("schema") is None
```

**Expected Behavior:**
- BEFORE FIX: 500 error (FAIL)
- AFTER FIX: 200 with all tags (PASS)

### Test 4: Get Single Tag with Schema
**Test Name:** `test_get_tag_with_schema`

**Purpose:** Verify GET /api/tags/{id} works for tags with schemas

**Test:**
```python
async def test_get_tag_with_schema(async_client, test_tag_with_schema):
    """
    Regression test for Bug #schema-id-500-error (Pattern Recognition).

    BEFORE FIX: 500 error when loading tag with schema
    AFTER FIX: Tag loads with schema_id set (nested schema object removed per Bug #002 fix)
    """
    response = await async_client.get(f"/api/tags/{test_tag_with_schema.id}")

    assert response.status_code == 200

    data = response.json()
    assert data["schema_id"] == str(test_tag_with_schema.schema_id)
    # Note: TagResponse no longer includes nested 'schema' object (Bug #002 fix)
    assert "schema" not in data or data.get("schema") is None
```

**Expected Behavior:**
- BEFORE FIX: 500 error (FAIL)
- AFTER FIX: 200 with tag (PASS)

### Test 5: Load Videos with Schema-Tagged Tags
**Test Name:** `test_load_videos_with_schema_tagged_tags`

**Purpose:** Verify GET /api/lists/{id}/videos works with schema tags

**Setup:**
1. Create video
2. Create tag with schema
3. Assign tag to video

**Test:**
```python
async def test_load_videos_with_schema_tagged_tags(async_client, test_list, test_video, test_tag_with_schema):
    """
    Regression test for Bug #schema-id-500-error (Critical Impact).

    BEFORE FIX: 500 error when loading videos if ANY tag has schema
    AFTER FIX: Videos load successfully with schema-tagged tags
    """
    # Assign schema tag to video
    await async_client.post(
        f"/api/videos/{test_video.id}/tags",
        json={"tag_ids": [str(test_tag_with_schema.id)]}
    )

    # Load videos
    response = await async_client.get(f"/api/lists/{test_list.id}/videos")

    # Should succeed (not 500!)
    assert response.status_code == 200

    data = response.json()
    assert len(data) > 0

    # Find video
    video = data[0]
    assert len(video["tags"]) > 0

    # Verify tag has schema_id set
    tag = video["tags"][0]
    assert tag["schema_id"] is not None
    # Note: TagResponse no longer includes nested schema (Bug #002 fix)
    # Only schema_id is present in response
```

**Expected Behavior:**
- BEFORE FIX: 500 error (FAIL)
- AFTER FIX: 200 with videos (PASS)

## Test Fixtures

### Fixture: test_schema
```python
@pytest.fixture
async def test_schema(test_list):
    """Create test schema with fields."""
    from app.models.field_schema import FieldSchema
    from app.models.custom_field import CustomField
    from app.models.schema_field import SchemaField

    # Create schema
    schema = FieldSchema(
        list_id=test_list.id,
        name="Test Schema",
        description="Schema for testing"
    )

    # Add field
    field = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5}
    )

    # Link via SchemaField
    schema_field = SchemaField(
        schema_id=schema.id,
        field_id=field.id,
        display_order=0,
        show_on_card=True
    )

    # Save all
    await db.add_all([schema, field, schema_field])
    await db.commit()

    return schema
```

### Fixture: test_tag_with_schema
```python
@pytest.fixture
async def test_tag_with_schema(test_user, test_schema):
    """Create tag with schema assigned."""
    tag = Tag(
        name="Test Tag with Schema",
        color="#3B82F6",
        user_id=test_user.id,
        schema_id=test_schema.id  # ← Link to schema
    )
    await db.add(tag)
    await db.commit()
    return tag
```

## Test Execution Plan

### Phase 1: Write Tests (CURRENT)
1. Create `test_tag_schema_integration.py`
2. Write all 5 test cases
3. Write fixtures

**Time:** 30 minutes

### Phase 2: Run Tests (BEFORE FIX)
```bash
pytest backend/tests/test_tag_schema_integration.py -v
```

**Expected Result:** ALL TESTS FAIL

**Why:** Bug not yet fixed

### Phase 3: Implement Fix
(See fix-plan.md)

### Phase 4: Run Tests (AFTER FIX)
```bash
pytest backend/tests/test_tag_schema_integration.py -v
```

**Expected Result:** ALL TESTS PASS

**Why:** Bug fixed

### Phase 5: Add to CI
Add to test suite run by CI/CD pipeline

## Success Criteria

**Test Suite Passes When:**
1. Tag creation with schema_id works
2. Tag update with schema_id doesn't 500
3. Listing tags with schemas doesn't 500
4. Getting single tag with schema doesn't 500
5. Loading videos with schema-tagged tags doesn't 500

**Test Suite Fails If:**
- Any endpoint returns 500 error
- schema_id not set correctly
- Nested 'schema' object is present (should be removed per Bug #002 fix)

## Coverage

These tests cover:
- ✅ TagCreate with schema_id
- ✅ TagUpdate with schema_id
- ✅ GET /api/tags with schemas
- ✅ GET /api/tags/{id} with schema
- ✅ GET /api/lists/{id}/videos with schema tags
- ❌ Filter videos by schema tags (out of scope)
- ❌ Schema CRUD operations (separate tests)

## Next Steps

1. Implement tests (this phase)
2. Verify tests FAIL (proves they catch bug)
3. Implement fix (Phase 7)
4. Verify tests PASS (proves fix works)
5. Keep tests in suite (prevents regression)
