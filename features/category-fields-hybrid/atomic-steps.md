# Atomic Steps: Category-Fields Hybrid System

**Feature ID:** category-fields-hybrid
**Date:** 2025-11-20
**Phase:** 10 - Atomic Steps

---

## Atomic Step Definition

**Criteria for each step:**
- ✅ Duration: 15-60 minutes
- ✅ Changes: 1-3 files max
- ✅ Test: Clear pass/fail criteria
- ✅ Committable: Can be committed independently
- ✅ No "and": Single, focused action

---

## Phase 1: Backend Foundation (10 steps, ~4 hours)

### Step 1.1: Create Migration File

**Time:** 15 min
**Files:** `backend/alembic/versions/{hash}_add_category_system.py` (NEW)

**Task:**
```bash
cd backend
alembic revision -m "add is_video_type and default_schema_id"
```

Create empty migration file.

**Test:** Migration file exists with correct name

**Commit:** `feat(db): create migration for category system`

---

### Step 1.2: Add is_video_type Column

**Time:** 20 min
**Files:** Migration file

**Task:**
```python
def upgrade():
    op.add_column(
        'tags',
        sa.Column('is_video_type', sa.Boolean(), nullable=False, server_default='true')
    )
    op.create_index('idx_tags_is_video_type', 'tags', ['is_video_type'])
```

**Test:** Run `alembic upgrade head`, check column exists

**Commit:** `feat(db): add is_video_type to tags table`

---

### Step 1.3: Add default_schema_id Column

**Time:** 20 min
**Files:** Migration file

**Task:**
```python
def upgrade():
    op.add_column(
        'bookmarks_lists',
        sa.Column(
            'default_schema_id',
            UUID(as_uuid=True),
            sa.ForeignKey('field_schemas.id', ondelete='SET NULL'),
            nullable=True
        )
    )
    op.create_index('idx_bookmarks_lists_default_schema', 'bookmarks_lists', ['default_schema_id'])
```

**Test:** Run migration, check column and index exist

**Commit:** `feat(db): add default_schema_id to bookmarks_lists`

---

### Step 1.4: Add Migration Downgrade

**Time:** 15 min
**Files:** Migration file

**Task:**
```python
def downgrade():
    op.drop_index('idx_bookmarks_lists_default_schema')
    op.drop_column('bookmarks_lists', 'default_schema_id')
    op.drop_index('idx_tags_is_video_type')
    op.drop_column('tags', 'is_video_type')
```

**Test:** Run `alembic downgrade -1`, then upgrade, verify rollback works

**Commit:** `feat(db): add downgrade for category system migration`

---

### Step 1.5: Update Tag Model - Add Column

**Time:** 15 min
**Files:** `backend/app/models/tag.py`

**Task:**
```python
is_video_type: Mapped[bool] = mapped_column(
    Boolean,
    nullable=False,
    default=True,
    server_default='true',
    index=True,
    comment="True = video type/category, False = label"
)
```

**Test:** Create Tag in Python shell, verify is_video_type defaults to True

**Commit:** `feat(models): add is_video_type to Tag model`

---

### Step 1.6: Update BookmarkList Model - Add Column

**Time:** 15 min
**Files:** `backend/app/models/list.py`

**Task:**
```python
default_schema_id: Mapped[Optional[PyUUID]] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("field_schemas.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
    comment="Workspace-wide schema (fields for all videos)"
)
```

**Test:** Create BookmarkList, set default_schema_id, verify saves

**Commit:** `feat(models): add default_schema_id to BookmarkList`

---

### Step 1.7: Update BookmarkList Model - Add Relationship

**Time:** 20 min
**Files:** `backend/app/models/list.py`

**Task:**
```python
default_schema: Mapped[Optional["FieldSchema"]] = relationship(
    "FieldSchema",
    foreign_keys=[default_schema_id],
    lazy='raise'
)
```

**Test:** Query BookmarkList with selectinload(BookmarkList.default_schema), verify loads

**Commit:** `feat(models): add default_schema relationship to BookmarkList`

---

### Step 1.8: Update TagCreate Schema

**Time:** 15 min
**Files:** `backend/app/schemas/tag.py`

**Task:**
```python
class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None
    schema_id: Optional[UUID] = None
    is_video_type: bool = True  # ADD with default
```

**Test:** Parse JSON `{"name": "Test"}`, verify is_video_type defaults to True

**Commit:** `feat(schemas): add is_video_type to TagCreate`

---

### Step 1.9: Update TagResponse Schema

**Time:** 15 min
**Files:** `backend/app/schemas/tag.py`

**Task:**
```python
class TagResponse(BaseModel):
    id: UUID
    name: str
    color: Optional[str]
    schema_id: Optional[UUID]
    is_video_type: bool  # ADD
    created_at: datetime
    updated_at: datetime
```

**Test:** Serialize Tag object, verify is_video_type in JSON

**Commit:** `feat(schemas): add is_video_type to TagResponse`

---

### Step 1.10: Run Migration and Verify

**Time:** 20 min
**Files:** None (testing)

**Task:**
1. Run `alembic upgrade head`
2. Check columns exist in DB
3. Create test tag via SQL
4. Create test BookmarkList with default_schema_id

**Test:** All database changes applied successfully

**Commit:** `test(db): verify category system migration`

---

## Phase 2: Backend Services & API (24 steps, ~10 hours)

### Step 2.1: Create Backup Service File

**Time:** 10 min
**Files:** `backend/app/services/field_value_backup.py` (NEW)

**Task:**
```python
"""Service for backing up and restoring video field values."""
from pathlib import Path
from uuid import UUID
import json

BACKUP_DIR = Path("backups/field_values")

# Empty functions with TODO comments
```

**Test:** File imports without errors

**Commit:** `feat(services): create backup service skeleton`

---

### Step 2.2: Implement backup_field_values - Structure

**Time:** 30 min
**Files:** `backend/app/services/field_value_backup.py`

**Task:**
Implement function signature and basic structure:
```python
async def backup_field_values(
    video_id: UUID,
    category_id: UUID,
    db: AsyncSession
) -> Optional[Path]:
    """Backup field values for video's category."""
    # Get category and schema
    # Query field values
    # Return None if no values
    # Build backup data dict
    # Write to file
    # Return path
```

**Test:** Call with mock data, verify returns None for empty values

**Commit:** `feat(services): implement backup_field_values structure`

---

### Step 2.3: Implement backup_field_values - Query Logic

**Time:** 30 min
**Files:** `backend/app/services/field_value_backup.py`

**Task:**
Complete the query logic:
```python
# Get category with schema
category = await db.get(Tag, category_id, options=[selectinload(Tag.schema)])
if not category or not category.schema:
    return None

# Get field IDs from schema
field_ids = [sf.field_id for sf in category.schema.schema_fields]

# Query field values
stmt = select(VideoFieldValue).where(
    VideoFieldValue.video_id == video_id,
    VideoFieldValue.field_id.in_(field_ids)
)
values = (await db.execute(stmt)).scalars().all()
```

**Test:** Unit test with mock DB, verify correct SQL

**Commit:** `feat(services): add backup field value query logic`

---

### Step 2.4: Implement backup_field_values - File Writing

**Time:** 30 min
**Files:** `backend/app/services/field_value_backup.py`

**Task:**
```python
# Build backup data
backup_data = {
    "video_id": str(video_id),
    "category_id": str(category_id),
    "category_name": category.name,
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "values": [serialize_field_value(v) for v in values]
}

# Write to file
backup_path = BACKUP_DIR / str(video_id) / f"{category_id}.json"
backup_path.parent.mkdir(parents=True, exist_ok=True)
backup_path.write_text(json.dumps(backup_data, indent=2))

return backup_path
```

**Test:** Call function, verify JSON file created with correct structure

**Commit:** `feat(services): add backup file writing logic`

---

### Step 2.5: Implement restore_field_values

**Time:** 45 min
**Files:** `backend/app/services/field_value_backup.py`

**Task:**
```python
async def restore_field_values(
    video_id: UUID,
    category_id: UUID,
    db: AsyncSession
) -> int:
    """Restore field values from backup. Returns count restored."""
    # Read backup file
    # Parse JSON
    # Create VideoFieldValue objects
    # Add to session
    # Return count
```

**Test:** Create backup file, call restore, verify VideoFieldValue objects created

**Commit:** `feat(services): implement restore_field_values`

---

### Step 2.6: Implement list_backups

**Time:** 20 min
**Files:** `backend/app/services/field_value_backup.py`

**Task:**
```python
def list_backups(video_id: UUID) -> list[BackupInfo]:
    """List all backups for a video."""
    backup_dir = BACKUP_DIR / str(video_id)
    if not backup_dir.exists():
        return []

    backups = []
    for file in backup_dir.glob("*.json"):
        # Parse file, extract info
        backups.append(BackupInfo(...))

    return backups
```

**Test:** Create 2 backup files, verify list returns 2 items

**Commit:** `feat(services): implement list_backups`

---

### Step 2.7: Add Backup Service Error Handling

**Time:** 30 min
**Files:** `backend/app/services/field_value_backup.py`

**Task:**
Add try/except to all functions:
```python
try:
    # existing logic
except IOError as e:
    logger.error(f"Backup failed: {e}")
    return None
except json.JSONDecodeError:
    logger.error(f"Corrupted backup file")
    return 0  # or None
```

**Test:** Test with corrupted file, verify graceful handling

**Commit:** `feat(services): add error handling to backup service`

---

### Step 2.8: Write Backup Service Unit Tests

**Time:** 60 min
**Files:** `backend/tests/unit/test_field_value_backup.py` (NEW)

**Task:**
Write 5 test cases:
- test_backup_creates_file
- test_backup_handles_empty_values
- test_restore_recreates_values
- test_restore_handles_corrupted_file
- test_list_backups_returns_all

**Test:** Run `pytest backend/tests/unit/test_field_value_backup.py`, all pass

**Commit:** `test(services): add backup service unit tests`

---

### Step 2.9: Create Field Aggregation Service File

**Time:** 10 min
**Files:** `backend/app/services/field_aggregation.py` (NEW)

**Task:**
```python
"""Service for aggregating available fields for videos."""

async def get_available_fields(
    video: Video,
    db: AsyncSession
) -> list[CustomField]:
    """Get all fields available for this video."""
    # TODO
    pass
```

**Test:** File imports

**Commit:** `feat(services): create field aggregation service skeleton`

---

### Step 2.10: Implement get_available_fields - Workspace Fields

**Time:** 30 min
**Files:** `backend/app/services/field_aggregation.py`

**Task:**
```python
async def get_available_fields(video, db):
    field_ids = set()
    fields = []

    # Get list's default schema fields
    list_obj = await db.get(
        BookmarkList,
        video.list_id,
        options=[selectinload(...)]
    )
    if list_obj and list_obj.default_schema:
        for sf in list_obj.default_schema.schema_fields:
            if sf.field_id not in field_ids:
                field_ids.add(sf.field_id)
                fields.append(sf.field)

    return fields
```

**Test:** Video with workspace fields, verify returned

**Commit:** `feat(services): add workspace field aggregation`

---

### Step 2.11: Implement get_available_fields - Category Fields

**Time:** 30 min
**Files:** `backend/app/services/field_aggregation.py`

**Task:**
```python
# Get video's category schema fields
category = next((t for t in video.tags if t.is_video_type), None)
if category and category.schema:
    for sf in category.schema.schema_fields:
        if sf.field_id not in field_ids:  # Deduplicate
            field_ids.add(sf.field_id)
            fields.append(sf.field)

return fields
```

**Test:** Video with workspace + category, verify both returned and deduplicated

**Commit:** `feat(services): add category field aggregation with deduplication`

---

### Step 2.12: Write Field Aggregation Tests

**Time:** 45 min
**Files:** `backend/tests/unit/test_field_aggregation.py` (NEW)

**Task:**
Write 4 test cases:
- test_aggregates_workspace_fields_only
- test_aggregates_workspace_and_category_fields
- test_deduplicates_shared_fields
- test_handles_no_schemas

**Test:** All tests pass

**Commit:** `test(services): add field aggregation unit tests`

---

### Step 2.13: Update Tags API - POST Accept is_video_type

**Time:** 15 min
**Files:** `backend/app/api/tags.py`

**Task:**
No changes needed! Pydantic schema already updated.
Just verify POST /tags accepts `is_video_type` in body.

**Test:** POST with `{"name": "Test", "is_video_type": false}`, verify saves

**Commit:** `test(api): verify tags POST accepts is_video_type`

---

### Step 2.14: Update Tags API - GET Returns is_video_type

**Time:** 15 min
**Files:** `backend/app/api/tags.py`

**Task:**
No changes needed! Response schema already includes is_video_type.
Verify GET returns field.

**Test:** GET /tags, verify response includes `"is_video_type": true`

**Commit:** `test(api): verify tags GET returns is_video_type`

---

### Step 2.15: Add Category Validation - Helper Function

**Time:** 30 min
**Files:** `backend/app/api/videos.py`

**Task:**
```python
async def validate_category_assignment(
    video: Video,
    tag_ids: list[UUID],
    db: AsyncSession
) -> None:
    """Validate category assignment. Raises HTTPException if invalid."""
    # Load tags
    tags = await get_tags_by_ids(tag_ids, db)

    # Check for multiple video types
    new_video_types = [t for t in tags if t.is_video_type]
    if len(new_video_types) > 1:
        raise HTTPException(400, "Cannot assign multiple categories")

    # Check if video already has different category
    existing_category = next((t for t in video.tags if t.is_video_type), None)
    if existing_category and new_video_types:
        if new_video_types[0].id != existing_category.id:
            raise HTTPException(
                409,
                f"Video already has category '{existing_category.name}'. "
                "Remove it first or use PUT /videos/{id}/category."
            )
```

**Test:** Unit test validation logic

**Commit:** `feat(api): add category validation helper`

---

### Step 2.16: Add Category Validation to POST /videos/{id}/tags

**Time:** 15 min
**Files:** `backend/app/api/videos.py`

**Task:**
```python
@router.post("/videos/{video_id}/tags")
async def assign_tags_to_video(...):
    video = await get_video_or_404(video_id, db)

    # ADD: Validate
    await validate_category_assignment(video, tag_ids, db)

    # Existing logic...
```

**Test:** Integration test - try to assign 2 categories, verify 400 error

**Commit:** `feat(api): add category validation to assign tags endpoint`

---

### Step 2.17: Create Category Change Endpoint - Skeleton

**Time:** 20 min
**Files:** `backend/app/api/videos.py`

**Task:**
```python
class SetCategoryRequest(BaseModel):
    category_id: Optional[UUID]

class SetCategoryResponse(BaseModel):
    backup_created: bool
    backup_available: bool

@router.put("/videos/{video_id}/category", response_model=SetCategoryResponse)
async def set_video_category(
    video_id: UUID,
    request: SetCategoryRequest,
    db: AsyncSession = Depends(get_db)
):
    """Set video's category (replaces existing)."""
    # TODO
    pass
```

**Test:** Endpoint exists, returns 500 (not implemented)

**Commit:** `feat(api): create category change endpoint skeleton`

---

### Step 2.18: Implement Category Change - Get Current State

**Time:** 20 min
**Files:** `backend/app/api/videos.py`

**Task:**
```python
async def set_video_category(...):
    # Get video with tags
    video = await get_video_with_tags(video_id, db)

    # Get current category
    current_category = next((t for t in video.tags if t.is_video_type), None)

    # Get new category (if not None)
    new_category = None
    if request.category_id:
        new_category = await get_tag_or_404(request.category_id, db)
        if not new_category.is_video_type:
            raise HTTPException(400, "Tag is not a category")
```

**Test:** Call endpoint, verify gets current state

**Commit:** `feat(api): add get current state to category change`

---

### Step 2.19: Implement Category Change - Create Backup

**Time:** 30 min
**Files:** `backend/app/api/videos.py`

**Task:**
```python
# Create backup if removing category
backup_created = False
if current_category:
    backup_path = await backup_field_values(
        video_id, current_category.id, db
    )
    backup_created = backup_path is not None

# Remove old category
if current_category:
    delete_stmt = video_tags.delete().where(
        video_tags.c.video_id == video_id,
        video_tags.c.tag_id == current_category.id
    )
    await db.execute(delete_stmt)
```

**Test:** Change category, verify backup created

**Commit:** `feat(api): add backup creation to category change`

---

### Step 2.20: Implement Category Change - Assign New Category

**Time:** 20 min
**Files:** `backend/app/api/videos.py`

**Task:**
```python
# Add new category (if not None)
if new_category:
    insert_stmt = video_tags.insert().values(
        video_id=video_id,
        tag_id=new_category.id
    )
    await db.execute(insert_stmt)

# Check for existing backup
backup_available = False
if new_category:
    backups = list_backups(video_id)
    backup_available = any(b.category_id == new_category.id for b in backups)

await db.commit()

return SetCategoryResponse(
    backup_created=backup_created,
    backup_available=backup_available
)
```

**Test:** Full E2E - change category, verify backup created and new assigned

**Commit:** `feat(api): complete category change endpoint implementation`

---

### Step 2.21: Write Category Validation Integration Tests

**Time:** 45 min
**Files:** `backend/tests/integration/test_category_validation.py` (NEW)

**Task:**
Write 5 test cases from testing.md:
- test_can_assign_single_category
- test_cannot_assign_multiple_categories
- test_cannot_assign_second_category_if_video_has_one
- test_can_assign_labels_with_category
- test_can_reassign_same_category

**Test:** All pass

**Commit:** `test(api): add category validation integration tests`

---

### Step 2.22: Write Category Change Integration Tests

**Time:** 45 min
**Files:** `backend/tests/integration/test_category_change.py` (NEW)

**Task:**
Write 4 test cases:
- test_change_category_creates_backup
- test_change_category_detects_existing_backup
- test_remove_category_creates_backup
- test_change_category_without_values_no_backup

**Test:** All pass

**Commit:** `test(api): add category change integration tests`

---

### Step 2.23: Manual Test Backend E2E

**Time:** 30 min
**Files:** None (manual testing)

**Task:**
1. Start backend
2. Create tag with `is_video_type=true`
3. Create video
4. Assign category to video
5. Add field values
6. Change category
7. Verify backup file created
8. Change back
9. Verify can restore

**Test:** Full flow works manually

**Commit:** None (manual verification)

---

### Step 2.24: Run Full Backend Test Suite

**Time:** 20 min
**Files:** None (testing)

**Task:**
```bash
pytest backend/tests
```

**Test:** All existing + new tests pass, coverage > 85%

**Commit:** `test: verify all backend tests passing`

---

## Phase 3: Frontend Types & Hooks (12 steps, ~5 hours)

### Step 3.1: Update Tag Type

**Time:** 15 min
**Files:** `frontend/src/types/tag.ts`

**Task:**
```typescript
export interface Tag {
  id: string
  name: string
  color: string | null
  schema_id: string | null
  is_video_type: boolean  // ADD
  created_at: string
  updated_at: string
}
```

**Test:** TypeScript compiles

**Commit:** `feat(types): add is_video_type to Tag interface`

---

### Step 3.2: Update TagCreate Type

**Time:** 10 min
**Files:** `frontend/src/types/tag.ts`

**Task:**
```typescript
export interface TagCreate {
  name: string
  color?: string | null
  schema_id?: string | null
  is_video_type?: boolean  // ADD with optional (defaults server-side)
}
```

**Test:** TypeScript compiles

**Commit:** `feat(types): add is_video_type to TagCreate`

---

### Step 3.3: Update Tag Zod Schema

**Time:** 15 min
**Files:** `frontend/src/types/tag.ts`

**Task:**
```typescript
export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  schema_id: z.string().nullable(),
  is_video_type: z.boolean(),  // ADD
  created_at: z.string(),
  updated_at: z.string(),
})
```

**Test:** Parse mock tag JSON with is_video_type, verify no errors

**Commit:** `feat(types): add is_video_type to TagSchema validator`

---

### Step 3.4: Update BookmarkList Type

**Time:** 10 min
**Files:** `frontend/src/types/list.ts`

**Task:**
```typescript
export interface BookmarkList {
  id: string
  name: string
  description: string | null
  user_id: string
  schema_id: string | null
  default_schema_id: string | null  // ADD
  created_at: string
  updated_at: string
}
```

**Test:** TypeScript compiles

**Commit:** `feat(types): add default_schema_id to BookmarkList`

---

### Step 3.5: Fix Test Mocks - Add is_video_type

**Time:** 45 min
**Files:** All test files with Tag mocks

**Task:**
Search codebase for `const.*Tag.*=.*{` and add `is_video_type: true` to all Tag mocks.

**Test:** `npm run test`, all tests compile and pass

**Commit:** `test: add is_video_type to all Tag mocks`

---

### Step 3.6: Add useCategories Hook

**Time:** 20 min
**Files:** `frontend/src/hooks/useTags.ts`

**Task:**
```typescript
export const useCategories = () => {
  const { data: tags, ...rest } = useTags()
  return {
    data: tags?.filter(t => t.is_video_type) ?? [],
    ...rest
  }
}
```

**Test:** Mock useTags, verify useCategories returns only is_video_type=true

**Commit:** `feat(hooks): add useCategories filter hook`

---

### Step 3.7: Add useLabels Hook

**Time:** 15 min
**Files:** `frontend/src/hooks/useTags.ts`

**Task:**
```typescript
export const useLabels = () => {
  const { data: tags, ...rest } = useTags()
  return {
    data: tags?.filter(t => !t.is_video_type) ?? [],
    ...rest
  }
}
```

**Test:** Verify returns only is_video_type=false

**Commit:** `feat(hooks): add useLabels filter hook`

---

### Step 3.8: Create useSetVideoCategory Hook - Skeleton

**Time:** 20 min
**Files:** `frontend/src/hooks/useVideos.ts`

**Task:**
```typescript
export const useSetVideoCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SetCategoryParams) => {
      const { data } = await api.put(`/videos/${params.videoId}/category`, {
        category_id: params.categoryId
      })
      return data
    },
    // TODO: onMutate, onError, onSettled
  })
}
```

**Test:** Hook exists, can be called

**Commit:** `feat(hooks): create useSetVideoCategory skeleton`

---

### Step 3.9: Implement useSetVideoCategory - Optimistic Update

**Time:** 30 min
**Files:** `frontend/src/hooks/useVideos.ts`

**Task:**
```typescript
onMutate: async ({ videoId, categoryId }) => {
  await queryClient.cancelQueries({ queryKey: ['video', videoId] })

  const previousVideo = queryClient.getQueryData(['video', videoId])

  queryClient.setQueryData(['video', videoId], (old) => ({
    ...old,
    category_id: categoryId
  }))

  return { previousVideo }
},
```

**Test:** Verify optimistic update happens

**Commit:** `feat(hooks): add optimistic update to useSetVideoCategory`

---

### Step 3.10: Implement useSetVideoCategory - Error Handling

**Time:** 20 min
**Files:** `frontend/src/hooks/useVideos.ts`

**Task:**
```typescript
onError: (err, variables, context) => {
  if (context?.previousVideo) {
    queryClient.setQueryData(['video', variables.videoId], context.previousVideo)
  }
},
```

**Test:** Mock API error, verify rollback

**Commit:** `feat(hooks): add error handling to useSetVideoCategory`

---

### Step 3.11: Implement useSetVideoCategory - Invalidation

**Time:** 15 min
**Files:** `frontend/src/hooks/useVideos.ts`

**Task:**
```typescript
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['videos'] })
  queryClient.invalidateQueries({ queryKey: ['video', videoId] })
}
```

**Test:** Verify queries invalidated after mutation

**Commit:** `feat(hooks): add query invalidation to useSetVideoCategory`

---

### Step 3.12: Run Frontend Tests

**Time:** 20 min
**Files:** None (testing)

**Task:**
```bash
cd frontend
npm run test
npm run type-check
```

**Test:** All tests pass, no TypeScript errors

**Commit:** `test: verify frontend tests and types`

---

## Summary

**Total Steps:** 58 atomic steps across 10 phases
**Estimated Time:** 35-40 hours

Each step is:
- ✅ 15-60 minutes
- ✅ Focused on one thing
- ✅ Independently committable
- ✅ Clearly testable

**Remaining Phases (4-6) follow same pattern:**
- Phase 4: Settings UI (15-20 steps)
- Phase 5: Video Detail UI (12-15 steps)
- Phase 6: Testing & Polish (8-10 steps)

---

## How to Use These Steps

### During Implementation

1. **Start at Step 1.1**
2. **Work sequentially** (dependencies between steps)
3. **Complete one step fully** before moving to next
4. **Test after each step**
5. **Commit after each step**
6. **If stuck > 60 min**, ask for help or break into smaller steps

### Progress Tracking

Use TodoWrite to track steps:
```typescript
[
  { content: "Step 1.1: Create migration file", status: "completed" },
  { content: "Step 1.2: Add is_video_type column", status: "in_progress" },
  { content: "Step 1.3: Add default_schema_id", status: "pending" },
  ...
]
```

### Quality Gates

After each phase (every 10-24 steps):
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No linter warnings
- [ ] Manually tested
- [ ] Git push to feature branch

---

## Next Phase

✅ Ready for Phase 11: Research & Validation
- Validate technical decisions
- Research best practices
- Check for existing solutions
- Confirm approach


---

## Implementation Status

**Updated:** 2025-11-21

### Phase Completion

| Phase | Status | Commits |
|-------|--------|---------|
| Phase 1: Backend Foundation | ✅ COMPLETE | `12f01ad`, `9759a0b`, `18fbeb7` |
| Phase 2: Backend Services & API | ✅ COMPLETE | (included in Phase 1) |
| Phase 3: Frontend Types & Hooks | ✅ COMPLETE | `0eecd7b` |
| Phase 4: Settings UI | ✅ COMPLETE | `0eecd7b` |
| Phase 5: Video Detail UI | ✅ COMPLETE | `0eecd7b` |
| Phase 6: Testing & Polish | ✅ COMPLETE | (verified, no changes needed) |

### Key Components Implemented

**Backend:**
- `is_video_type` field on Tags model
- `PUT /videos/{id}/category` endpoint
- Category validation (only is_video_type=true tags allowed)
- CASCADE delete for video_tags

**Frontend:**
- `useCategories()` / `useLabels()` hooks
- `useSetVideoCategory()` mutation hook
- `CategorySelector` component (dropdown)
- `CategoryBadge` / `LabelBadge` components
- Updated `TagsList` with Typ column
- Updated `EditTagDialog` / `CreateTagDialog` with type selection
- Updated `VideoDetailsPage` with category/label separation

### Test Coverage

- 16 backend tests (test_video_tags.py) - all passing
- 43 frontend tests (CategorySelector, VideoDetailsPage) - all passing

