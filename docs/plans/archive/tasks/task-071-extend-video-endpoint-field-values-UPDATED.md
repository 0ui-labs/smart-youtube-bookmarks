# Task #71: Extend Video GET Endpoint to Include Field Values with Union Logic

**Plan Task:** #71 (UPDATED with 5 REF MCP Improvements - 2025-11-08)
**Wave/Phase:** Phase 1: MVP - Backend (Custom Fields System)
**Dependencies:** Task #60 (FieldSchema Model), Task #61 (SchemaField Model), Task #62 (VideoFieldValue Model), Task #64 (CustomField Schemas)

---

## 🎯 Ziel

Extend the `GET /api/lists/{list_id}/videos` endpoint to include custom field values in the response, implementing the multi-tag field union logic that combines fields from all schemas bound to a video's tags. This enables the frontend to display custom rating fields on video cards without additional API calls.

**Expected Result:**
- Video responses include `field_values` array with all applicable fields from video's tags
- Multi-tag union logic merges fields from multiple schemas correctly
- Conflict resolution adds schema prefix when same field name has different types
- **IMPROVED:** Single batch query for ALL videos' applicable fields (not N queries)
- **IMPROVED:** Type-safe value union (float not int for NUMERIC compatibility)
- Response includes schema context for frontend grouping/display

---

## 📋 REF MCP Improvements Applied (2025-11-08)

### Improvement #1: Batch-Loading Performance (Critical)
**Problem:** Original plan did 1 query per video for applicable fields = N+1 queries
**Solution:** Batch-load ALL SchemaFields for ALL videos in 1 query
**Impact:** 100 videos: 100 queries → 1 query (99% reduction)

### Improvement #2: Nested Selectinload (Prevention)
**Problem:** Plan missing nested selectinload for SchemaField.field → CustomField
**Solution:** Add `.selectinload(SchemaField.field)` to prevent MissingGreenlet
**Impact:** Prevents lazy loading errors (learned from Task #70)

### Improvement #3: Type Safety for NUMERIC (Minor)
**Problem:** Plan used `int` for value, but PostgreSQL NUMERIC is float-compatible
**Solution:** Change to `value: str | float | bool | None`
**Impact:** Supports decimal ratings (e.g., 4.5 stars), better TypeScript types

### Improvement #4: Conflict Resolution Bug (Medium)
**Problem:** Plan had bug with 3+ tags where first conflicting field missing schema prefix
**Solution:** When conflict detected, ALSO update first occurrence with schema prefix
**Impact:** Correct display for complex multi-tag scenarios

### Improvement #5: Import Existing Schema (DRY)
**Problem:** Plan wanted to create CustomFieldResponse, but Task #64 already did
**Solution:** Import from `app.schemas.custom_field` instead of creating
**Impact:** Single Source of Truth, DRY principle, saves 30 minutes

---

## 📋 Acceptance Criteria

- [ ] VideoResponse schema extended with `field_values: list[VideoFieldValueResponse]`
- [ ] **IMPROVED:** Single batch query for applicable fields (not N queries)
- [ ] GET endpoint loads field values using `selectinload()` for optimal performance
- [ ] Multi-tag field union logic correctly merges fields from all tag schemas
- [ ] **IMPROVED:** Conflict resolution handles 3+ tag edge cases correctly
- [ ] Conflict resolution: same name + different type → adds schema prefix to ALL conflicts
- [ ] Conflict resolution: same name + same type → shows once (first schema wins)
- [ ] **IMPROVED:** Type-safe value field (float not int) for NUMERIC compatibility
- [ ] Empty field values handled gracefully (videos without tags or unset fields)
- [ ] Performance verified: < 500ms for 100 videos with 10+ fields each
- [ ] Manual testing passed: multiple tags, conflicting fields, empty states, 3+ tag conflicts
- [ ] Unit tests passing (100% coverage for union logic + conflict edge cases)
- [ ] Integration test passing (end-to-end video fetch with field values)
- [ ] Code reviewed (Subagent Grade A)
- [ ] Documentation updated (CLAUDE.md with field values pattern)

---

## 🛠️ Implementation Steps (UPDATED)

### Step 1: Extend VideoResponse Pydantic Schema

**Files:** `backend/app/schemas/video.py`

**Action:** Add VideoFieldValueResponse model and extend VideoResponse

**Code:**
```python
# Add after TagResponse definition (around line 50)

from app.schemas.custom_field import CustomFieldResponse  # ✅ REF #5: Import existing

class VideoFieldValueResponse(BaseModel):
    """
    Response model for a video's custom field value.

    Includes the field definition, current value, and schema context
    for frontend grouping and conflict resolution display.

    REF MCP Improvement #3: value uses float (not int) for PostgreSQL NUMERIC compatibility.
    REF MCP Improvement #5: Reuses existing CustomFieldResponse from Task #64.
    """
    field_id: UUID
    field: CustomFieldResponse  # Nested field definition (from Task #64)
    value: str | float | bool | None = None  # ✅ REF #3: float not int
    schema_name: str | None = None  # For multi-tag conflict resolution
    show_on_card: bool = False  # From schema_fields.show_on_card
    display_order: int = 0  # From schema_fields.display_order

    model_config = ConfigDict(from_attributes=True)


class VideoResponse(BaseModel):
    # ... existing fields ...

    # Add after tags field (line ~95)
    field_values: list[VideoFieldValueResponse] = Field(default_factory=list)

    # ... rest unchanged ...
```

**Why:**
- **REF #3:** `float` supports PostgreSQL NUMERIC (can store decimals like 4.5)
- **REF #5:** Imports existing `CustomFieldResponse` (Task #64) instead of creating duplicate
- Follows Pydantic v2 `ConfigDict(from_attributes=True)` pattern for ORM serialization

**Verification:**
```bash
# TypeScript check should pass
cd frontend && npx tsc --noEmit

# Python type check
cd backend && python -m mypy app/schemas/video.py
```

---

### Step 2: Batch-Loading Helper for Applicable Fields

**Files:** `backend/app/api/videos.py`

**Action:** Create helper functions for batch-loading and conflict resolution

**Code:**
```python
# Add before get_videos_in_list endpoint (around line 300)

from sqlalchemy.orm import selectinload
from sqlalchemy import select
from app.models.schema_field import SchemaField
from app.models.field_schema import FieldSchema
from app.models.custom_field import CustomField
from app.models.video_field_value import VideoFieldValue
from typing import Dict, List, Tuple, Set
from uuid import UUID as PyUUID


async def _batch_load_applicable_fields(
    videos: List[Video],
    db: AsyncSession
) -> Dict[PyUUID, List[Tuple[CustomField, str | None, int, bool]]]:
    """
    Batch-load applicable fields for ALL videos in a single query.

    REF MCP Improvement #1: Single query for all videos (not N queries).
    REF MCP Improvement #2: Nested selectinload prevents MissingGreenlet.
    REF MCP Improvement #4: Conflict resolution handles 3+ tag edge cases.

    Returns:
        Dict mapping video_id → list of (field, schema_name_or_none, display_order, show_on_card)
    """
    # Step 1: Collect ALL unique schema_ids from ALL videos
    all_schema_ids: Set[PyUUID] = set()
    video_schemas: Dict[PyUUID, List[PyUUID]] = {}  # video_id → [schema_ids]

    for video in videos:
        schema_ids = [tag.schema_id for tag in video.tags if tag.schema_id is not None]
        if schema_ids:
            video_schemas[video.id] = schema_ids
            all_schema_ids.update(schema_ids)

    if not all_schema_ids:
        # No schemas → no fields for any video
        return {video.id: [] for video in videos}

    # Step 2: Batch-load ALL SchemaFields for ALL schemas in ONE query
    # ✅ REF #1: Single query instead of N queries
    # ✅ REF #2: Nested selectinload prevents MissingGreenlet
    stmt = (
        select(SchemaField, FieldSchema.name)
        .join(SchemaField.schema)  # Join to get schema name
        .options(
            selectinload(SchemaField.field)  # Eager load CustomField
            # Note: If CustomField has relationships (e.g., to list), add:
            # .selectinload(CustomField.list)  # Prevent nested MissingGreenlet
        )
        .where(SchemaField.schema_id.in_(all_schema_ids))
        .order_by(SchemaField.display_order)  # Preserve display order
    )

    result = await db.execute(stmt)
    all_schema_fields = result.all()  # List of (SchemaField, schema_name) tuples

    # Step 3: Group SchemaFields by schema_id
    fields_by_schema: Dict[PyUUID, List[Tuple[SchemaField, str]]] = {}
    for schema_field, schema_name in all_schema_fields:
        if schema_field.schema_id not in fields_by_schema:
            fields_by_schema[schema_field.schema_id] = []
        fields_by_schema[schema_field.schema_id].append((schema_field, schema_name))

    # Step 4: Compute applicable fields for each video (pure logic, no DB access)
    result_by_video: Dict[PyUUID, List[Tuple[CustomField, str | None, int, bool]]] = {}

    for video in videos:
        if video.id not in video_schemas:
            # Video has no schemas → empty list
            result_by_video[video.id] = []
            continue

        schema_ids = video_schemas[video.id]
        applicable_fields = _compute_field_union_with_conflicts(
            schema_ids, fields_by_schema
        )
        result_by_video[video.id] = applicable_fields

    return result_by_video


def _compute_field_union_with_conflicts(
    schema_ids: List[PyUUID],
    fields_by_schema: Dict[PyUUID, List[Tuple[SchemaField, str]]]
) -> List[Tuple[CustomField, str | None, int, bool]]:
    """
    Compute union of fields from multiple schemas with conflict resolution.

    REF MCP Improvement #4: Correctly handles 3+ tag edge cases.

    Algorithm:
    1. Collect all fields from all schemas
    2. Detect conflicts (same name, different type)
    3. For conflicts: Add schema prefix to ALL occurrences (not just subsequent ones)
    4. For duplicates (same name, same type): Show once (first wins)

    Returns:
        List of (field, schema_name_or_none, display_order, show_on_card)
    """
    field_registry: Dict[str, Dict] = {}  # field_name_lower → metadata

    for schema_id in schema_ids:
        if schema_id not in fields_by_schema:
            continue

        for schema_field, schema_name in fields_by_schema[schema_id]:
            field = schema_field.field
            field_key = field.name.lower()  # Case-insensitive

            if field_key not in field_registry:
                # First occurrence → register
                field_registry[field_key] = {
                    'field': field,
                    'schema_name': schema_name,
                    'field_type': field.field_type,
                    'display_order': schema_field.display_order,
                    'show_on_card': schema_field.show_on_card,
                    'conflict': False,
                    'original_key': field_key  # Track original key for renaming
                }
            else:
                # Duplicate field name → check type
                existing = field_registry[field_key]

                if existing['field_type'] != field.field_type:
                    # ✅ REF #4: CONFLICT - Both need schema prefix

                    # 1. Rename first occurrence with schema prefix
                    if not existing['conflict']:
                        original_schema = existing['schema_name']
                        conflict_key_first = f"{original_schema}:{field.name}".lower()

                        # Move existing entry to new key with schema prefix
                        field_registry[conflict_key_first] = {
                            **existing,
                            'conflict': True
                        }
                        del field_registry[field_key]  # Remove old key

                    # 2. Add new occurrence with schema prefix
                    conflict_key_new = f"{schema_name}:{field.name}".lower()
                    field_registry[conflict_key_new] = {
                        'field': field,
                        'schema_name': schema_name,
                        'field_type': field.field_type,
                        'display_order': schema_field.display_order,
                        'show_on_card': schema_field.show_on_card,
                        'conflict': True,
                        'original_key': conflict_key_new
                    }
                # else: Same name, same type → ignore (first occurrence wins)

    # Build result list with schema prefixes where conflicts exist
    result = []
    for entry in field_registry.values():
        schema_prefix = entry['schema_name'] if entry['conflict'] else None
        result.append((
            entry['field'],
            schema_prefix,
            entry['display_order'],
            entry['show_on_card']
        ))

    # Sort by display_order (preserve schema ordering)
    result.sort(key=lambda x: x[2])

    return result
```

**Why:**
- **REF #1:** `_batch_load_applicable_fields` loads ALL SchemaFields in 1 query (not N)
- **REF #2:** Uses `selectinload(SchemaField.field)` to prevent MissingGreenlet
- **REF #4:** `_compute_field_union_with_conflicts` correctly renames first occurrence when conflict detected
- Pure logic in Step 4 (no DB access per video) = fast

**Performance:**
- Before: 100 videos = 100+ queries
- After: 100 videos = 1 query
- Reduction: 99%

---

### Step 3: Extend Video GET Endpoint

**Files:** `backend/app/api/videos.py`

**Action:** Integrate batch-loading into existing endpoint

**Code:**
```python
# Modify get_videos_in_list endpoint (around line 380)

@router.get("/lists/{list_id}/videos", response_model=List[VideoResponse])
async def get_videos_in_list(
    list_id: UUID,
    tag_ids: Annotated[Optional[List[str]], Query(alias="tag_ids", max_items=10)] = None,
    db: AsyncSession = Depends(get_db)
) -> List[Video]:
    # ... existing code for list validation and video fetching ...

    # === EXISTING: Batch load tags ===
    video_ids = [video.id for video in videos]

    # ... existing tags loading code ...

    for video in videos:
        video.__dict__['tags'] = tags_by_video.get(video.id, [])

    # === NEW: Batch-load applicable fields for ALL videos ===
    # ✅ REF #1: Single query for all videos
    applicable_fields_by_video = await _batch_load_applicable_fields(videos, db)

    # === NEW: Batch load field values ===
    if video_ids:
        # Fetch all field values for all videos in one query
        field_values_stmt = (
            select(VideoFieldValue)
            .options(
                selectinload(VideoFieldValue.field)  # Eager load CustomField
            )
            .where(VideoFieldValue.video_id.in_(video_ids))
        )
        field_values_result = await db.execute(field_values_stmt)
        all_field_values = field_values_result.scalars().all()

        # Group field values by video_id
        field_values_by_video: Dict[PyUUID, List[VideoFieldValue]] = {}
        for fv in all_field_values:
            if fv.video_id not in field_values_by_video:
                field_values_by_video[fv.video_id] = []
            field_values_by_video[fv.video_id].append(fv)

        # Build field_values response for each video
        for video in videos:
            # Get applicable fields (from batch-loaded data)
            applicable_fields = applicable_fields_by_video.get(video.id, [])

            # Get actual field values for this video
            video_field_values = field_values_by_video.get(video.id, [])
            values_by_field_id = {fv.field_id: fv for fv in video_field_values}

            # Build response list: applicable fields + their values (if set)
            field_values_response = []
            for field, schema_name, display_order, show_on_card in applicable_fields:
                field_value = values_by_field_id.get(field.id)

                # ✅ REF #3: Extract value based on field type (float not int)
                value = None
                if field_value:
                    if field.field_type == 'rating':
                        value = field_value.value_numeric  # Can be float
                    elif field.field_type in ('select', 'text'):
                        value = field_value.value_text
                    elif field.field_type == 'boolean':
                        value = field_value.value_boolean

                # Create response dict (Pydantic will serialize)
                field_values_response.append({
                    'field_id': field.id,
                    'field': field,  # CustomField ORM object
                    'value': value,
                    'schema_name': schema_name,
                    'show_on_card': show_on_card,
                    'display_order': display_order
                })

            # Assign to video (FastAPI will serialize via VideoResponse schema)
            video.__dict__['field_values'] = field_values_response
    else:
        # No videos → no field values needed
        for video in videos:
            video.__dict__['field_values'] = []

    return videos
```

**Why:**
- **REF #1:** Uses batch-loading helper (1 query for all videos)
- **REF #3:** Value extraction preserves float for rating fields
- Follows existing pattern from tags loading
- Empty state handled gracefully

**Performance Analysis:**
- Queries per request: 3 base (videos, tags, field_values) + 1 batch (applicable_fields)
- Total: **4 queries** regardless of number of videos
- Before (original plan): 3 + N queries (where N = number of videos)

---

### Step 4: Unit Tests for Union Logic and Conflict Resolution

**Files:** `backend/tests/api/test_videos.py`

**Action:** Add comprehensive tests including REF #4 edge cases

**Test Cases:**
1. Video with no tags → empty field_values
2. Video with single tag → all schema fields returned
3. Video with multiple tags → field union (no duplicates for same type)
4. **NEW (REF #4):** 3+ tags with mixed conflicts → both conflicting fields have schema prefix
5. Conflict: same name + different type → both have schema prefix
6. No conflict: same name + same type → shown once
7. Field values included if set → correct value type
8. Field values null if not set → graceful handling

**Example Test for REF #4 Edge Case:**
```python
@pytest.mark.asyncio
async def test_conflict_resolution_with_three_tags_mixed_types(
    client, db_session, test_list
):
    """
    REF MCP Improvement #4: Edge case with 3 tags where 2 have same type, 1 has different.

    Scenario:
    - Tag A (Schema 1): "Rating" → type rating
    - Tag B (Schema 2): "Rating" → type rating (same type, should merge)
    - Tag C (Schema 3): "Rating" → type text (conflict!)

    Expected:
    - "Rating" from Schema 1/2 (merged) → schema_name="Schema 1" (first wins)
    - "Rating" from Schema 3 → schema_name="Schema 3"
    - Both have schema_name set (conflict marker)
    """
    # Create schemas with same field name but different types
    schema_a = await create_field_schema(db_session, test_list.id, "Video Quality")
    schema_b = await create_field_schema(db_session, test_list.id, "Presentation")
    schema_c = await create_field_schema(db_session, test_list.id, "Content")

    field_rating_numeric_a = await create_custom_field(
        db_session, test_list.id, "Rating", "rating", {"max_rating": 5}
    )
    field_rating_numeric_b = await create_custom_field(
        db_session, test_list.id, "Rating", "rating", {"max_rating": 10}
    )
    field_rating_text = await create_custom_field(
        db_session, test_list.id, "Rating", "text", {}
    )

    await add_field_to_schema(db_session, schema_a.id, field_rating_numeric_a.id, 0, True)
    await add_field_to_schema(db_session, schema_b.id, field_rating_numeric_b.id, 0, True)
    await add_field_to_schema(db_session, schema_c.id, field_rating_text.id, 0, True)

    # Create tags and video
    tag_a = await create_tag(db_session, test_list.id, "Tag A", schema_a.id)
    tag_b = await create_tag(db_session, test_list.id, "Tag B", schema_b.id)
    tag_c = await create_tag(db_session, test_list.id, "Tag C", schema_c.id)
    video = await create_video(db_session, test_list.id, tags=[tag_a, tag_b, tag_c])

    response = client.get(f"/api/lists/{test_list.id}/videos")
    assert response.status_code == 200

    field_values = response.json()[0]['field_values']

    # Should have 2 "Rating" fields (merged A/B, separate C)
    assert len(field_values) == 2

    # Both should have schema_name (conflict detected)
    schema_names = [fv['schema_name'] for fv in field_values]
    assert "Video Quality" in schema_names  # or "Presentation" (first wins)
    assert "Content" in schema_names

    # Verify field types
    rating_fields = {fv['schema_name']: fv['field']['field_type'] for fv in field_values}
    assert rating_fields["Content"] == "text"
    # First rating field should be from schema A or B
    other_schema = [s for s in schema_names if s != "Content"][0]
    assert rating_fields[other_schema] == "rating"
```

---

### Step 5: Integration Test

**Files:** `backend/tests/integration/test_custom_fields_video_flow.py` (new file)

**Action:** End-to-end test with real database

**Test:**
```python
"""
Integration test for Task #71: Video GET with field values.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_video_get_with_field_values_full_flow(
    client: AsyncClient,
    db_session: AsyncSession,
    test_list
):
    """
    End-to-end test: Create schema → tag → video → set field values → fetch video.

    Verifies:
    - VideoResponse includes field_values
    - Field union logic works
    - Performance (query count)
    - REF #1: Batch loading (not N+1 queries)
    """
    # ... (similar to original plan integration test, but verify batch loading)
```

---

### Step 6: Update CLAUDE.md

**Files:** `CLAUDE.md`

**Action:** Document field values pattern with REF improvements

**Content:**
```markdown
### Video Response with Custom Fields

**GET /api/lists/{id}/videos Response (Extended in Task #71):**

Videos now include custom field values based on their tags' schemas:

```json
{
  "id": "video-uuid",
  "title": "How to Apply Eyeliner",
  "tags": [...],
  "field_values": [
    {
      "field_id": "uuid",
      "field": {
        "name": "Overall Rating",
        "field_type": "rating",
        "config": {"max_rating": 5}
      },
      "value": 4.5,  // Note: float for NUMERIC support
      "schema_name": null,
      "show_on_card": true,
      "display_order": 0
    }
  ]
}
```

**REF MCP Improvements Applied:**
1. **Batch Loading:** Single query for all videos' applicable fields (not N queries)
2. **Nested Selectinload:** Prevents MissingGreenlet errors
3. **Type Safety:** value field uses float (not int) for PostgreSQL NUMERIC
4. **Conflict Resolution:** Handles 3+ tag edge cases correctly
5. **DRY Principle:** Reuses CustomFieldResponse from Task #64

**Performance Pattern:**
- 4 queries total: videos, tags, field_values, applicable_fields
- Independent of video count (no N+1)
- Follows SQLAlchemy 2.0 selectinload() best practice
```

---

### Step 7: Verification and Commit

**Commands:**
```bash
# Backend: Run unit tests
cd backend
pytest tests/api/test_videos.py::TestVideoFieldValuesUnion -v

# Backend: Run integration test
pytest tests/integration/test_custom_fields_video_flow.py -v

# Frontend: TypeScript check
cd frontend
npx tsc --noEmit

# Commit
git add -A
git commit -m "feat(api): extend video endpoint with field values + 5 REF improvements

- Add VideoFieldValueResponse and extend VideoResponse schema
- Implement batch-loading for applicable fields (99% query reduction)
- Add multi-tag field union logic with correct conflict resolution
- Use float (not int) for NUMERIC value type compatibility
- Import existing CustomFieldResponse (DRY principle)

REF MCP Improvements (2025-11-08):
#1 Batch-Loading: 1 query for all videos (not N queries)
#2 Nested selectinload: Prevents MissingGreenlet errors
#3 Type Safety: float for PostgreSQL NUMERIC support
#4 Conflict Resolution: Handles 3+ tag edge cases
#5 DRY Principle: Reuses CustomFieldResponse from Task #64

Performance:
- 100 videos: 100+ queries → 4 queries (96% reduction)
- Query count independent of video count
- Follows SQLAlchemy 2.0 selectinload() best practice

Tests:
- 8 unit tests for union logic + conflicts (100% coverage)
- 1 integration test for end-to-end flow
- All tests passing

Task #71 (Custom Fields System Phase 1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## ⏱️ Estimated Time

**Total: 4-5 hours** (same as original, improvements offset complexity)

- Step 1: Extend schemas (30 min) - FASTER (reuse existing)
- Step 2: Batch-loading helper (90 min) - LONGER (more complex)
- Step 3: Endpoint modification (45 min) - SAME
- Step 4: Unit tests (90 min) - LONGER (more edge cases)
- Step 5: Integration test (30 min) - SAME
- Step 6: Docs + commit (15 min) - SAME

**Time saved by REF #5:** 30 min (not creating CustomFieldResponse)
**Time added by REF #1:** 30 min (batch-loading complexity)
**Net:** Same duration, but 99% better performance

---

## 📝 Implementation Order (Subagent-Driven Development)

**Task 1:** Step 1 - Extend VideoResponse schema (import existing CustomFieldResponse)
**Task 2:** Step 2 - Create batch-loading helpers with conflict resolution
**Task 3:** Step 3 - Integrate into video GET endpoint
**Task 4:** Step 4 - Write unit tests (8 tests including REF #4 edge case)
**Task 5:** Step 5 - Write integration test
**Task 6:** Step 6 - Update CLAUDE.md
**Task 7:** Verification - TypeScript check, commit, report

Each task dispatches fresh subagent + code review before next task.

---

**Plan Updated:** 2025-11-08 21:45 CET
**REF MCP Validated:** 2025-11-08 21:35 CET (SQLAlchemy 2.0, Pydantic v2)
**Ready for Subagent-Driven Development:** ✅
