# Fix Strategy: 500 Error When Updating Tag with schema_id

## Bug ID
`schema-id-500-error`

## Date
2025-11-18

## Fix Approach

We need to fix **TWO separate issues**:

1. TagCreate missing schema_id field (simple)
2. Nested selectinload with string-based primaryjoin (complex)

## Fix 1: Add schema_id to TagCreate (P0 - Critical)

### Location
`/backend/app/schemas/tag.py:13-14`

### Current Code
```python
class TagCreate(TagBase):
    pass  # Only inherits name and color
```

### Proposed Fix
```python
class TagCreate(TagBase):
    schema_id: UUID | None = None  # Allow schema binding during creation
```

### Why This Works
- Pydantic will accept schema_id in request body
- Backend will set tag.schema_id in create_tag() handler
- Matches TagUpdate pattern (consistency)

### Changes Required
1. Update TagCreate schema (1 line)
2. Update create_tag() endpoint to handle schema_id:
   ```python
   new_tag = Tag(
       name=tag.name,
       color=tag.color,
       schema_id=tag.schema_id,  # ← ADD THIS
       user_id=current_user.id
   )
   ```
3. Add schema validation (like in update_tag)

### Risk Assessment
**Low risk:**
- Additive change (doesn't break existing functionality)
- schema_id is optional (nullable)
- Validation already exists in update_tag (reuse logic)

### Testing
- Create tag WITHOUT schema → should work (backwards compatible)
- Create tag WITH schema → should set schema_id
- Create tag with invalid schema_id → should return 404

## Fix 2: Replace String-Based primaryjoin (P0 - Critical)

### Location
`/backend/app/models/field_schema.py:93`

### Current Code
```python
schema_fields = relationship(
    "SchemaField",
    primaryjoin="FieldSchema.id==SchemaField.schema_id",  # STRING!
    uselist=True,
    back_populates="schema",
    ...
)
```

### Option A: Lambda-Based Join (RECOMMENDED)
```python
schema_fields = relationship(
    "SchemaField",
    primaryjoin=lambda: FieldSchema.id == SchemaField.schema_id,  # LAMBDA!
    uselist=True,
    back_populates="schema",
    ...
)
```

**Pros:**
- Minimal change (just wrap in lambda)
- Preserves existing logic
- SQLAlchemy can resolve in nested context

**Cons:**
- Slightly less readable
- Lambda executed on every relationship access (minor performance impact)

### Option B: Foreign Key Reference (Alternative)
```python
schema_fields = relationship(
    "SchemaField",
    foreign_keys="[SchemaField.schema_id]",
    uselist=True,
    back_populates="schema",
    ...
)
```

**Pros:**
- More explicit
- Better performance (no lambda execution)
- Clearer intent

**Cons:**
- Requires SchemaField to be imported (circular import risk)
- May require TYPE_CHECKING guards

### Option C: Remove primaryjoin Entirely (Test First)
```python
schema_fields = relationship(
    "SchemaField",
    uselist=True,
    back_populates="schema",
    ...
)
```

**Pros:**
- Simplest solution
- Lets SQLAlchemy infer the join

**Cons:**
- Original comment said "Explicit join for composite PK"
- Might not work with composite primary key
- Need to test if inference works

### Recommended Approach
**Try Option C first** → If it works, keep it (simplest)
**If fails** → Use Option A (lambda)

### Risk Assessment
**Medium risk:**
- Changes core ORM relationship
- Affects multiple endpoints (tags.py, schemas.py)
- Need comprehensive testing

### Testing Required
After fix:
1. GET /api/tags → verify list loads with schema-tagged tags
2. GET /api/tags/{id} → verify single tag loads with schema
3. PUT /api/tags/{id} → verify update works with schema_id
4. GET /api/schemas → verify schema list still works
5. GET /api/lists/{id}/videos → verify videos load with schema-tagged videos

## Implementation Plan

### Step 1: Fix TagCreate (Quick Win)
1. Add schema_id field to TagCreate
2. Update create_tag() to handle schema_id
3. Add validation (reuse from update_tag)
4. Test tag creation with schema

**Time:** 15 minutes
**Impact:** Enables tag creation with schemas

### Step 2: Fix primaryjoin (Core Fix)
1. Try Option C (remove primaryjoin)
2. Run tests
3. If fails → Use Option A (lambda)
4. Test all affected endpoints

**Time:** 30 minutes
**Impact:** Fixes all nested selectinload issues

### Step 3: Remove Debug Instrumentation
1. Remove /tmp/tag_debug.log writes
2. Remove try-catch blocks added for debugging
3. Clean up logs

**Time:** 5 minutes

### Step 4: Add Regression Tests
1. Test tag creation with schema_id
2. Test tag update with schema_id
3. Test GET /api/tags with schema tags
4. Test videos loading with schema-tagged tags

**Time:** 30 minutes

### Total Estimated Time
**1-2 hours** (including testing)

## Minimal Change Principle

**Smallest possible fix:**
1. TagCreate: Add 1 field, modify 3 lines in create_tag()
2. primaryjoin: Try removing it first (0 lines changed!)
3. If removal fails: Wrap in lambda (1 line changed)

**Why minimal:**
- Lower risk of introducing new bugs
- Easier to review
- Faster to test
- Easier to rollback if needed

## Verification Plan

### Before Fix
```bash
curl -X POST /api/tags -d '{"name": "Test", "schema_id": "71f69fa1-..."}'
# Returns: schema_id=null

curl -X PUT /api/tags/{id} -d '{"schema_id": "71f69fa1-..."}'
# Returns: 500 Internal Server Error
```

### After Fix
```bash
curl -X POST /api/tags -d '{"name": "Test", "schema_id": "71f69fa1-..."}'
# Returns: schema_id="71f69fa1-..." ✓

curl -X PUT /api/tags/{id} -d '{"schema_id": "71f69fa1-..."}'
# Returns: 200 with updated tag ✓

curl -X GET /api/lists/{id}/videos
# Returns: videos with schema-tagged tags ✓
```

## Rollback Plan

If fix causes issues:

**Rollback Fix 1 (TagCreate):**
```python
class TagCreate(TagBase):
    pass  # Remove schema_id field
```

**Rollback Fix 2 (primaryjoin):**
```python
# Restore string-based join
primaryjoin="FieldSchema.id==SchemaField.schema_id"
```

**Impact:** Returns to original broken state (better than new broken state)

## Dependencies

**No external dependencies** - all changes internal to backend

**Database migration:** NOT REQUIRED (schema already supports schema_id)

## Success Criteria

1. Tags can be created with schema_id
2. Tags can be updated with schema_id
3. GET /api/tags works with schema tags
4. GET /api/lists/{id}/videos works with schema-tagged videos
5. No new test failures
6. All existing tests pass

## Next Steps

1. Write regression tests (Phase 6)
2. Implement fixes (Phase 7)
3. Run validation (Phase 8)
4. Document prevention (Phase 9)
