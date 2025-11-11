# Task #74: Implement Multi-Tag Field Union Query with Conflict Resolution

**Plan Task:** #74
**Wave/Phase:** Phase 1 - Backend Data Layer (Custom Fields System)
**Dependencies:** Task #64 (CustomField Pydantic Schemas) ✅ Completed, Task #62 (VideoFieldValue Model) ✅ Completed

---

## 🎯 Ziel

Implement the multi-tag field union logic that combines custom fields from multiple schemas when a video has tags with different schemas. This includes intelligent conflict resolution (same name + different type → schema prefix) and efficient N+1 prevention using batch loading. The implementation will be a reusable helper function integrated into the existing video GET endpoints.

**Expected Outcome:** Videos with multiple tagged schemas correctly display the union of all fields, with automatic schema prefixing for type conflicts. Query performance remains under 100ms for 1000 videos with 10+ fields each.

---

## 📋 Acceptance Criteria

- [ ] **Helper Function Implementation**
  - [ ] `get_fields_for_video()` function in `backend/app/api/helpers/field_union.py`
  - [ ] Takes video_id and db session, returns list of field metadata with values
  - [ ] Implements 4-step union algorithm from design doc (lines 162-168)
  - [ ] Handles conflict resolution: same name + different type → schema prefix
  - [ ] Handles deduplication: same name + same type → show once, use first value

- [ ] **Performance Optimization**
  - [ ] Single batch query loads all schemas for all videos (no N+1)
  - [ ] Uses selectinload for tag relationships
  - [ ] Left join pattern for optional field values
  - [ ] Performance target: <100ms for 1000 videos with 10 fields each

- [ ] **API Integration**
  - [ ] Extend `VideoResponse` schema with `fields` property
  - [ ] Integrate into `GET /api/lists/{list_id}/videos` endpoint
  - [ ] Integrate into `GET /api/videos/{video_id}` endpoint (if exists)
  - [ ] Field data included in response without breaking existing clients

- [ ] **Conflict Resolution Logic**
  - [ ] Detect field name conflicts across schemas
  - [ ] Add schema name prefix for different types: `"Schema: Field"`
  - [ ] Show once for same type, prioritize by tag order
  - [ ] Include metadata: `is_prefixed`, `original_name`, `schema_name`

- [ ] **Testing**
  - [ ] Unit tests for union logic (15+ test cases)
  - [ ] Integration tests with real database queries
  - [ ] Performance benchmark tests (1000 videos, 10 fields)
  - [ ] Edge cases: no tags, no schema, empty schema, single schema

- [ ] **Code Quality**
  - [ ] Comprehensive docstrings with SQL examples
  - [ ] Type hints throughout (Pydantic models for return types)
  - [ ] Follows existing codebase patterns (videos.py batch loading)
  - [ ] Zero new TypeScript errors

---

## 🛠️ Implementation Steps

**NOTE:** Due to the comprehensive nature of this task, the full implementation plan with complete code examples, testing strategy, and design decisions is approximately 50KB. The plan includes:

### Core Components

1. **FieldMetadata Pydantic Schema** (`backend/app/schemas/field_metadata.py`)
   - Typed response schema for field union results
   - Includes conflict resolution metadata

2. **Field Union Helper Module** (`backend/app/api/helpers/field_union.py`)
   - `get_fields_for_video()` - Single video field union
   - `get_fields_for_videos_batch()` - Batch processing for listings
   - Implements 4-step algorithm from design doc (lines 162-168)

3. **API Integration** (`backend/app/api/videos.py`)
   - Extend VideoResponse with `fields` property
   - Integrate batch loading into GET endpoints

### Algorithm Implementation (from Design Doc lines 162-168)

```
1. Collect all schema_id from video's tags
2. Union all fields from all schemas (via schema_fields)
3. If field names conflict with DIFFERENT types:
   → Add schema name prefix: "Video Quality: Rating" vs "Content: Rating"
4. If field names match with SAME type:
   → Show once, use value from first tag's schema
```

### Performance Strategy

- **selectinload()** for N+1 prevention (3-4 queries total vs 1000+)
- Batch loading for list endpoints
- Target: <100ms for 1000 videos with 10 fields each

### Testing Coverage

- 15+ unit tests for union logic
- Integration tests with real database
- Performance benchmarks
- Edge cases: no tags, no schemas, conflicts, deduplication

---

## 📚 Reference

### Design Documentation
- **Design Doc:** `docs/plans/2025-11-05-custom-fields-system-design.md` (lines 160-174)
- **Task #64 Pattern:** `docs/plans/tasks/task-064-custom-field-pydantic-schemas.md`
- **Latest Handoff:** `docs/handoffs/2025-11-07-log-062-video-field-value-model.md`

### Related Code
- **Batch Loading Pattern:** `backend/app/api/videos.py` (lines 364-383)
- **selectinload Usage:** SQLAlchemy 2.0 async pattern
- **VideoFieldValue Model:** `backend/app/models/video_field_value.py`

### SQLAlchemy 2.0 References (REF MCP)

**selectinload for N+1 Prevention:**
- URL: https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html#select-in-loading
- Pattern: `selectinload(Video.tags).selectinload(Tag.schema)`
- Benefit: "emits a SELECT for up to 500 parent primary key values at a time"
- Performance: 2-3 queries total vs N+1 queries (3-10x faster)

---

## Design Decisions

### Decision 1: Helper Function vs Direct Endpoint Logic

**Chosen:** Separate helper module `app/api/helpers/field_union.py`

**Rationale:**
- ✅ **Reusability:** Multiple endpoints need field union (list videos, single video, search)
- ✅ **Testability:** Pure function easier to unit test than endpoint
- ✅ **Separation of Concerns:** Field logic separate from HTTP handling
- ✅ **DRY Principle:** Batch and single versions share core logic

---

### Decision 2: Conflict Resolution Strategy

**Chosen:** Prefix with schema name for type conflicts, deduplicate for same type

**Implementation:**
```python
if len(types_in_entries) == 1:
    # Same type → show once, first wins
    prefixed_name = field.name
else:
    # Different types → prefix ALL with schema name
    prefixed_name = f"{schema_name}: {field.name}"
```

**Example from Design Doc:**
```
Video has tags: ["Makeup Tutorial", "Product Review"]
- "Makeup Tutorial" schema: [Presentation (Select), Overall Rating (Rating)]
- "Product Review" schema: [Product Quality (Rating), Overall Rating (Rating)]
→ Result: [Presentation, Product Quality, Overall Rating] (3 fields)
```

---

### Decision 3: Performance Strategy - selectinload vs joinedload

**Chosen:** `selectinload()` for tags → schemas → schema_fields → fields

**Comparison:**

| Strategy | Queries | Cartesian Products | Best For |
|----------|---------|-------------------|----------|
| selectinload | 3-4 | No | Collections (tags, values) ✅ |
| joinedload | 1 | Yes (N*M rows) | Single objects |
| Lazy loading | N+1 | No | Never (async breaks) |

**REF MCP Evidence:**
> "selectinload is the most simple and efficient way to eagerly load collections"

**Rationale:**
- ✅ **No Cartesian Product:** Video with 3 tags × 10 fields = 30 rows with joinedload, 13 rows with selectinload
- ✅ **Async Compatible:** Lazy loading fails in async
- ✅ **3-4 queries total** vs N+1 (1000+ queries for 1000 videos)

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Single video query | <50ms | `get_fields_for_video()` with 2 tags, 5 fields |
| Batch query (100 videos) | <100ms | Typical page size |
| Batch query (1000 videos) | <100ms | Performance benchmark test |
| Database queries per batch | 3-4 | selectinload pattern |
| Memory usage | <50MB | 1000 videos × 10 fields |

---

## Implementation Checklist

- [ ] Create `backend/app/api/helpers/__init__.py`
- [ ] Create `backend/app/schemas/field_metadata.py` with FieldMetadata schema
- [ ] Export FieldMetadata in `backend/app/schemas/__init__.py`
- [ ] Create `backend/app/api/helpers/field_union.py` with both functions
- [ ] Extend VideoResponse schema with `fields: list[FieldMetadata]`
- [ ] Integrate batch function into `GET /api/lists/{list_id}/videos`
- [ ] Write 15+ unit tests in `backend/tests/api/helpers/test_field_union.py`
- [ ] Write 2+ integration tests
- [ ] Write performance benchmark test (target: <100ms for 1000 videos)
- [ ] Run `pytest backend/tests/api/helpers/` (all pass)
- [ ] Manual test: Create video with 2 tags (different schemas, conflicting field names)
- [ ] Verify: Field names prefixed correctly in API response
- [ ] Update CLAUDE.md with field union pattern documentation

---

**Estimated Duration:** 3-4 hours
- Helper function implementation: 45-60 min
- Pydantic schema: 15 min
- API integration: 30 min
- Unit tests (15 cases): 60-90 min
- Integration tests: 30 min
- Performance tests: 15 min
- Manual testing & verification: 15 min

**Ready for:** Immediate implementation after Task #64 completion

---

## Full Implementation Code

For the complete implementation code including:
- Full FieldMetadata Pydantic schema with examples
- Complete `get_fields_for_video()` function with 200+ lines
- Complete `get_fields_for_videos_batch()` function
- All 15+ unit test cases with complete setup
- Integration test examples
- Performance benchmark code

Please refer to the full task plan which includes ~1500 lines of production-ready code examples.

**Key Implementation Highlights:**

1. **FieldMetadata Schema** includes all metadata for conflict resolution
2. **selectinload chain** prevents N+1: `selectinload(Video.tags).selectinload(Tag.schema).selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)`
3. **Conflict detection** via `defaultdict` grouping by `(name_lower, field_type)`
4. **Value extraction** from typed columns (value_text, value_numeric, value_boolean)
5. **Sorting** by schema_id then display_order for stable ordering

