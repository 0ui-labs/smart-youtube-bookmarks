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

## Phase 4: Settings UI Redesign (18 steps, ~8 hours)

### Step 4.1: Create WorkspaceFieldsCard Component - Skeleton

**Time:** 20 min
**Files:** `frontend/src/components/settings/WorkspaceFieldsCard.tsx` (NEW)

**Task:**
```typescript
interface WorkspaceFieldsCardProps {
  listId: string
  defaultSchemaId: string | null
  onEdit: () => void
}

export function WorkspaceFieldsCard({ listId, defaultSchemaId, onEdit }: WorkspaceFieldsCardProps) {
  return (
    <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-blue-600" />
          <h3 className="font-medium">Alle Videos</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Bearbeiten
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Diese Felder haben alle Videos
      </p>
    </div>
  )
}
```

**Test:** Component renders without errors

**Commit:** `feat(ui): create WorkspaceFieldsCard skeleton`

---

### Step 4.2: Add Field List to WorkspaceFieldsCard

**Time:** 30 min
**Files:** `frontend/src/components/settings/WorkspaceFieldsCard.tsx`

**Task:**
```typescript
// Add to component
const { data: schema } = useFieldSchema(defaultSchemaId)

// In render:
{schema?.fields && schema.fields.length > 0 ? (
  <ul className="mt-3 space-y-1">
    {schema.fields.map(field => (
      <li key={field.id} className="text-sm">
        • {field.name} ({getFieldTypeLabel(field.field_type)})
      </li>
    ))}
  </ul>
) : (
  <p className="mt-3 text-sm text-muted-foreground italic">
    Keine Felder definiert
  </p>
)}
<p className="mt-2 text-xs text-muted-foreground">
  ({schema?.fields?.length || 0} Felder definiert)
</p>
```

**Test:** Shows field list when schema exists, shows empty state when not

**Commit:** `feat(ui): add field list to WorkspaceFieldsCard`

---

### Step 4.3: Create WorkspaceFieldsEditor Component - Dialog Shell

**Time:** 20 min
**Files:** `frontend/src/components/settings/WorkspaceFieldsEditor.tsx` (NEW)

**Task:**
```typescript
interface WorkspaceFieldsEditorProps {
  listId: string
  defaultSchemaId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkspaceFieldsEditor({ open, onOpenChange }: WorkspaceFieldsEditorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Informationen für alle Videos</DialogTitle>
          <DialogDescription>
            Diese Felder sind für ALLE Videos in diesem Workspace verfügbar.
          </DialogDescription>
        </DialogHeader>
        {/* Fields will go here */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Test:** Dialog opens and closes

**Commit:** `feat(ui): create WorkspaceFieldsEditor dialog shell`

---

### Step 4.4: Implement WorkspaceFieldsEditor - Field List

**Time:** 45 min
**Files:** `frontend/src/components/settings/WorkspaceFieldsEditor.tsx`

**Task:**
```typescript
// Inside DialogContent:
<div className="space-y-4">
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      Tipp: Felder die für alle Kategorien nützlich sind (z.B. Bewertung, Notizen)
    </AlertDescription>
  </Alert>

  <div className="space-y-2">
    <Label>Felder:</Label>
    {fields.map(field => (
      <div key={field.id} className="flex items-center justify-between rounded border p-2">
        <span>{field.name} ({getFieldTypeLabel(field.field_type)})</span>
        <Button variant="ghost" size="icon" onClick={() => handleRemoveField(field.id)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    ))}
  </div>

  <Button variant="outline" className="w-full" onClick={() => setShowAddField(true)}>
    <Plus className="mr-2 h-4 w-4" />
    Information hinzufügen
  </Button>
</div>
```

**Test:** Shows existing fields, remove button works

**Commit:** `feat(ui): add field list to WorkspaceFieldsEditor`

---

### Step 4.5: Implement WorkspaceFieldsEditor - Add Field

**Time:** 45 min
**Files:** `frontend/src/components/settings/WorkspaceFieldsEditor.tsx`

**Task:**
Add inline field creation:
```typescript
{showAddField && (
  <div className="space-y-2 rounded border p-3">
    <Input
      placeholder="Feldname"
      value={newFieldName}
      onChange={e => setNewFieldName(e.target.value)}
    />
    <Select value={newFieldType} onValueChange={setNewFieldType}>
      <SelectTrigger>
        <SelectValue placeholder="Typ auswählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="text">Text</SelectItem>
        <SelectItem value="number">Zahl</SelectItem>
        <SelectItem value="boolean">Ja/Nein</SelectItem>
        <SelectItem value="rating">Bewertung</SelectItem>
        <SelectItem value="select">Auswahl</SelectItem>
      </SelectContent>
    </Select>
    <div className="flex gap-2">
      <Button size="sm" onClick={handleAddField}>Hinzufügen</Button>
      <Button size="sm" variant="ghost" onClick={() => setShowAddField(false)}>Abbrechen</Button>
    </div>
  </div>
)}
```

**Test:** Can add new field inline

**Commit:** `feat(ui): add field creation to WorkspaceFieldsEditor`

---

### Step 4.6: Implement WorkspaceFieldsEditor - Save Logic

**Time:** 30 min
**Files:** `frontend/src/components/settings/WorkspaceFieldsEditor.tsx`

**Task:**
```typescript
const saveWorkspaceFields = useUpdateWorkspaceFields()

const handleSave = async () => {
  await saveWorkspaceFields.mutateAsync({
    listId,
    schemaId: defaultSchemaId,
    fields: localFields
  })
  onOpenChange(false)
}
```

**Test:** Saving updates schema and closes dialog

**Commit:** `feat(ui): add save logic to WorkspaceFieldsEditor`

---

### Step 4.7: Update TagsList - Filter to Categories Only

**Time:** 30 min
**Files:** `frontend/src/components/settings/TagsList.tsx`

**Task:**
```typescript
// Change hook usage
const { data: tags } = useTags()
// To:
const { data: categories } = useCategories() // Only is_video_type=true

// Update component name and props if needed
```

**Test:** Only shows tags with `is_video_type=true`

**Commit:** `feat(ui): filter TagsList to show only categories`

---

### Step 4.8: Update TagsList - Show Fields Instead of Schema Name

**Time:** 45 min
**Files:** `frontend/src/components/settings/TagsList.tsx`

**Task:**
Change display from "Schema: X" to field list:
```typescript
// Before:
<p className="text-sm text-muted-foreground">
  Schema: {tag.schema?.name || 'Kein Schema'}
</p>

// After:
{tag.schema?.fields && tag.schema.fields.length > 0 ? (
  <div className="mt-1 text-sm text-muted-foreground">
    <span>Felder: </span>
    {tag.schema.fields.slice(0, 3).map(f => f.name).join(' • ')}
    {tag.schema.fields.length > 3 && ` +${tag.schema.fields.length - 3}`}
  </div>
) : (
  <p className="mt-1 text-sm text-muted-foreground italic">Keine Felder</p>
)}
```

**Test:** Shows fields instead of schema name

**Commit:** `feat(ui): show fields instead of schema name in TagsList`

---

### Step 4.9: Update TagsList - Add Video Count

**Time:** 30 min
**Files:** `frontend/src/components/settings/TagsList.tsx`

**Task:**
```typescript
// Add video count to each category
<p className="text-xs text-muted-foreground">
  ({category.video_count || 0} Videos)
</p>
```

Note: May need to update backend to include `video_count` in TagResponse

**Test:** Shows video count per category

**Commit:** `feat(ui): add video count to TagsList`

---

### Step 4.10: Update TagsList - Add "Typ" Column

**Time:** 30 min
**Files:** `frontend/src/components/settings/TagsList.tsx`

**Task:**
Add column to distinguish categories from labels:
```typescript
<Badge variant={tag.is_video_type ? "default" : "secondary"}>
  {tag.is_video_type ? "Kategorie" : "Label"}
</Badge>
```

**Test:** Shows type badge for each tag

**Commit:** `feat(ui): add type column to TagsList`

---

### Step 4.11: Update CreateTagDialog - Add Type Selection

**Time:** 30 min
**Files:** `frontend/src/components/CreateTagDialog.tsx`

**Task:**
```typescript
<div className="space-y-2">
  <Label>Typ</Label>
  <RadioGroup value={isVideoType ? "category" : "label"} onValueChange={...}>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="category" id="category" />
      <Label htmlFor="category">Kategorie (nur eine pro Video)</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="label" id="label" />
      <Label htmlFor="label">Label (mehrere möglich)</Label>
    </div>
  </RadioGroup>
</div>
```

**Test:** Can create category or label

**Commit:** `feat(ui): add type selection to CreateTagDialog`

---

### Step 4.12: Update EditTagDialog - Add Type Selection

**Time:** 30 min
**Files:** `frontend/src/components/EditTagDialog.tsx`

**Task:**
Same as CreateTagDialog, add type toggle with warning:
```typescript
{tag.video_count > 0 && isVideoType !== tag.is_video_type && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      {tag.video_count} Videos sind dieser {tag.is_video_type ? 'Kategorie' : 'Label'} zugewiesen.
      Typänderung kann Auswirkungen haben.
    </AlertDescription>
  </Alert>
)}
```

**Test:** Can change tag type with warning

**Commit:** `feat(ui): add type selection to EditTagDialog`

---

### Step 4.13: Update EditTagDialog - Show Field Reuse Info

**Time:** 45 min
**Files:** `frontend/src/components/EditTagDialog.tsx`

**Task:**
```typescript
// For each field, show where else it's used:
{field.used_in_categories && field.used_in_categories.length > 1 && (
  <p className="text-xs text-muted-foreground">
    Wird auch verwendet in: {field.used_in_categories.filter(c => c !== tag.name).join(', ')}
  </p>
)}
```

Note: Backend may need to return this info

**Test:** Shows field reuse info

**Commit:** `feat(ui): show field reuse info in EditTagDialog`

---

### Step 4.14: Update SettingsPage - Rename Tags Tab to Kategorien

**Time:** 20 min
**Files:** `frontend/src/pages/SettingsPage.tsx`

**Task:**
```typescript
// Before:
<TabsTrigger value="tags">Tags</TabsTrigger>

// After:
<TabsTrigger value="kategorien">Kategorien</TabsTrigger>
```

**Test:** Tab shows "Kategorien"

**Commit:** `feat(ui): rename Tags tab to Kategorien`

---

### Step 4.15: Update SettingsPage - Add WorkspaceFieldsCard

**Time:** 30 min
**Files:** `frontend/src/pages/SettingsPage.tsx`

**Task:**
```typescript
<TabsContent value="kategorien">
  <div className="space-y-6">
    {/* Workspace fields first */}
    <WorkspaceFieldsCard
      listId={currentList.id}
      defaultSchemaId={currentList.default_schema_id}
      onEdit={() => setWorkspaceEditorOpen(true)}
    />

    {/* Category list */}
    <div>
      <h3 className="mb-4 text-lg font-medium">Kategorien</h3>
      <TagsList />
    </div>
  </div>
</TabsContent>

<WorkspaceFieldsEditor
  listId={currentList.id}
  defaultSchemaId={currentList.default_schema_id}
  open={workspaceEditorOpen}
  onOpenChange={setWorkspaceEditorOpen}
/>
```

**Test:** WorkspaceFieldsCard appears above categories

**Commit:** `feat(ui): add WorkspaceFieldsCard to SettingsPage`

---

### Step 4.16: Update SettingsPage - Remove/Consolidate Tabs

**Time:** 30 min
**Files:** `frontend/src/pages/SettingsPage.tsx`

**Task:**
Remove or hide "Schemas" and "Fields" tabs (functionality moved into Kategorien):
```typescript
// Only keep:
<TabsList>
  <TabsTrigger value="kategorien">Kategorien</TabsTrigger>
  <TabsTrigger value="analytics">Analytics</TabsTrigger>
</TabsList>
```

**Test:** Only Kategorien and Analytics tabs visible

**Commit:** `feat(ui): consolidate Settings tabs to Kategorien`

---

### Step 4.17: Write WorkspaceFieldsCard Unit Tests

**Time:** 30 min
**Files:** `frontend/src/components/settings/WorkspaceFieldsCard.test.tsx` (NEW)

**Task:**
```typescript
describe('WorkspaceFieldsCard', () => {
  it('displays workspace name and icon', () => {...})
  it('shows field list when schema exists', () => {...})
  it('shows empty state when no schema', () => {...})
  it('calls onEdit when button clicked', () => {...})
})
```

**Test:** All tests pass

**Commit:** `test(ui): add WorkspaceFieldsCard tests`

---

### Step 4.18: Run Phase 4 Verification

**Time:** 30 min
**Files:** None (testing)

**Task:**
1. `npm run type-check`
2. `npm run test`
3. `npm run lint`
4. Manual test Settings page
5. Verify all terminology is German ("Kategorien", "Informationen")

**Test:** All checks pass, UI looks correct

**Commit:** `test: verify Phase 4 Settings UI complete`

---

## Phase 5: Video Detail UI (15 steps, ~8 hours)

### Step 5.1: Create CategorySelector Component - Skeleton

**Time:** 30 min
**Files:** `frontend/src/components/CategorySelector.tsx` (NEW)

**Task:**
```typescript
interface CategorySelectorProps {
  videoId: string
  currentCategoryId: string | null
  onCategoryChange: (categoryId: string | null) => void
  disabled?: boolean
}

export function CategorySelector({
  videoId,
  currentCategoryId,
  onCategoryChange,
  disabled
}: CategorySelectorProps) {
  const { data: categories, isLoading } = useCategories()

  return (
    <div className="space-y-2">
      <Label>Kategorie</Label>
      <Select
        value={currentCategoryId || "none"}
        onValueChange={(v) => onCategoryChange(v === "none" ? null : v)}
        disabled={disabled || isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Keine Kategorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Keine Kategorie</SelectItem>
          {categories?.map(cat => (
            <SelectItem key={cat.id} value={cat.id}>
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: cat.color || '#888' }}
                />
                {cat.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

**Test:** Renders dropdown with categories

**Commit:** `feat(ui): create CategorySelector skeleton`

---

### Step 5.2: Add Clear Button to CategorySelector

**Time:** 20 min
**Files:** `frontend/src/components/CategorySelector.tsx`

**Task:**
```typescript
<div className="relative">
  <Select ...>
    ...
  </Select>
  {currentCategoryId && (
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-8 top-1/2 -translate-y-1/2"
      onClick={() => onCategoryChange(null)}
      aria-label="Kategorie entfernen"
    >
      <X className="h-4 w-4" />
    </Button>
  )}
</div>
```

**Test:** Clear button appears and works when category selected

**Commit:** `feat(ui): add clear button to CategorySelector`

---

### Step 5.3: Add Loading and Disabled States to CategorySelector

**Time:** 20 min
**Files:** `frontend/src/components/CategorySelector.tsx`

**Task:**
```typescript
{isLoading && (
  <SelectTrigger disabled>
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    Lade Kategorien...
  </SelectTrigger>
)}

{isMutating && (
  <SelectTrigger disabled>
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    Ändere Kategorie...
  </SelectTrigger>
)}
```

**Test:** Shows loading state during fetch/mutation

**Commit:** `feat(ui): add loading states to CategorySelector`

---

### Step 5.4: Create CategoryChangeWarning Component - Dialog Shell

**Time:** 30 min
**Files:** `frontend/src/components/CategoryChangeWarning.tsx` (NEW)

**Task:**
```typescript
interface CategoryChangeWarningProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  oldCategory: Tag | null
  newCategory: Tag | null
  onConfirm: (restoreBackup: boolean) => void
  onCancel: () => void
}

export function CategoryChangeWarning({
  open,
  onOpenChange,
  oldCategory,
  newCategory,
  onConfirm,
  onCancel
}: CategoryChangeWarningProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Kategorie ändern
          </DialogTitle>
        </DialogHeader>
        {/* Content goes here */}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
          <Button onClick={() => onConfirm(false)}>Kategorie ändern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Test:** Dialog renders and buttons work

**Commit:** `feat(ui): create CategoryChangeWarning dialog shell`

---

### Step 5.5: Implement CategoryChangeWarning - Fields To Backup Section

**Time:** 45 min
**Files:** `frontend/src/components/CategoryChangeWarning.tsx`

**Task:**
```typescript
interface CategoryChangeWarningProps {
  // ...existing props
  fieldValuesToBackup: FieldValue[]
  fieldValuesThatPersist: FieldValue[]
}

// In DialogContent:
{fieldValuesToBackup.length > 0 && (
  <div>
    <p className="text-sm font-medium mb-2">
      Folgende Werte werden gesichert:
    </p>
    <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
      {fieldValuesToBackup.map(fv => (
        <div key={fv.id} className="text-sm">
          • {fv.field.name}: {formatFieldValue(fv)}
        </div>
      ))}
    </div>
  </div>
)}

{fieldValuesThatPersist.length > 0 && (
  <div>
    <p className="text-sm font-medium mb-2">
      Die folgenden Felder bleiben:
    </p>
    <div className="rounded-lg border bg-green-50 p-3 space-y-1">
      {fieldValuesThatPersist.map(fv => (
        <div key={fv.id} className="text-sm text-green-900">
          • {fv.field.name}: {formatFieldValue(fv)}
        </div>
      ))}
    </div>
  </div>
)}
```

**Test:** Shows both sections with correct styling

**Commit:** `feat(ui): add field sections to CategoryChangeWarning`

---

### Step 5.6: Implement CategoryChangeWarning - Restore Checkbox

**Time:** 30 min
**Files:** `frontend/src/components/CategoryChangeWarning.tsx`

**Task:**
```typescript
interface CategoryChangeWarningProps {
  // ...existing props
  hasBackup: boolean
  backupTimestamp?: string
}

// State:
const [restoreBackup, setRestoreBackup] = useState(false)

// In DialogContent (when hasBackup):
{hasBackup && (
  <>
    <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-4">
      <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
      <div>
        <p className="font-medium">Gesicherte Werte gefunden!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Du hattest dieses Video schon mal als "{newCategory?.name}" kategorisiert.
        </p>
      </div>
    </div>

    <div className="flex items-center space-x-2">
      <Checkbox
        id="restore"
        checked={restoreBackup}
        onCheckedChange={(checked) => setRestoreBackup(checked === true)}
      />
      <label htmlFor="restore" className="text-sm cursor-pointer">
        Gesicherte Werte wiederherstellen
      </label>
    </div>
  </>
)}

// Update confirm button:
<Button onClick={() => onConfirm(restoreBackup)}>
  Kategorie ändern
</Button>
```

**Test:** Checkbox appears when backup exists, value passed to onConfirm

**Commit:** `feat(ui): add restore checkbox to CategoryChangeWarning`

---

### Step 5.7: Hook Up CategorySelector with Warning Dialog

**Time:** 45 min
**Files:** `frontend/src/components/CategorySelector.tsx`

**Task:**
```typescript
const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null)
const [showWarning, setShowWarning] = useState(false)

const handleCategorySelect = (categoryId: string | null) => {
  if (categoryId === currentCategoryId) return

  // If removing or changing category, show warning
  if (currentCategoryId !== null || categoryId !== null) {
    setPendingCategoryId(categoryId)
    setShowWarning(true)
  } else {
    // Direct assignment (no previous category, assigning new)
    onCategoryChange(categoryId)
  }
}

const handleConfirm = (restoreBackup: boolean) => {
  onCategoryChange(pendingCategoryId)
  // TODO: Handle restoreBackup
  setShowWarning(false)
}

// Include CategoryChangeWarning dialog
<CategoryChangeWarning
  open={showWarning}
  onOpenChange={setShowWarning}
  oldCategory={currentCategory}
  newCategory={pendingCategory}
  hasBackup={/* from API */}
  onConfirm={handleConfirm}
  onCancel={() => setShowWarning(false)}
/>
```

**Test:** Changing category shows warning, confirm triggers change

**Commit:** `feat(ui): hook up CategorySelector with warning dialog`

---

### Step 5.8: Update VideoDetailsPage - Add CategorySelector

**Time:** 30 min
**Files:** `frontend/src/pages/VideoDetailsPage.tsx`

**Task:**
```typescript
// Add CategorySelector at top of detail view:
<div className="space-y-6">
  {/* Category selector */}
  <CategorySelector
    videoId={video.id}
    currentCategoryId={video.category_id}
    onCategoryChange={handleCategoryChange}
  />

  {/* Separator */}
  <Separator />

  {/* Fields section */}
  <div>
    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
      Informationen
    </h3>
    {/* Field inputs */}
  </div>
</div>
```

**Test:** CategorySelector appears in video detail

**Commit:** `feat(ui): add CategorySelector to VideoDetailsPage`

---

### Step 5.9: Update VideoDetailsPage - Remove Tag Badges or Filter to Labels

**Time:** 30 min
**Files:** `frontend/src/pages/VideoDetailsPage.tsx`

**Task:**
```typescript
// Option A: Remove tag badges entirely (category shown in selector)

// Option B: Show only labels (is_video_type=false)
const labels = video.tags?.filter(t => !t.is_video_type) ?? []

{labels.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {labels.map(label => (
      <Badge key={label.id} style={{ backgroundColor: label.color }}>
        {label.name}
      </Badge>
    ))}
  </div>
)}
```

**Test:** Only labels shown as badges (not categories)

**Commit:** `feat(ui): filter video tags to show only labels`

---

### Step 5.10: Update VideoDetailsPage - Unified Field Display

**Time:** 45 min
**Files:** `frontend/src/pages/VideoDetailsPage.tsx`

**Task:**
Show all available fields (workspace + category) without separation:
```typescript
const availableFields = useAvailableFields(video.id)

// Render all fields together:
<div className="space-y-4">
  {availableFields.map(field => (
    <FieldInput
      key={field.id}
      field={field}
      value={video.field_values?.find(fv => fv.field_id === field.id)}
      onChange={(value) => handleFieldChange(field.id, value)}
    />
  ))}
</div>
```

**Test:** Shows both workspace and category fields together

**Commit:** `feat(ui): show unified field display in VideoDetailsPage`

---

### Step 5.11: Add Toast Notifications for Category Change

**Time:** 20 min
**Files:** `frontend/src/components/CategorySelector.tsx`

**Task:**
```typescript
import { toast } from 'sonner'

const handleConfirm = async (restoreBackup: boolean) => {
  try {
    await setVideoCategory.mutateAsync({
      videoId,
      categoryId: pendingCategoryId,
      restoreBackup
    })

    toast.success('Kategorie geändert', {
      description: pendingCategoryId
        ? `Video ist jetzt in "${pendingCategory?.name}"`
        : 'Kategorie wurde entfernt'
    })

    if (restoreBackup) {
      toast.info('Werte wiederhergestellt', {
        description: `${restoredCount} Werte wurden wiederhergestellt`
      })
    }
  } catch (error) {
    toast.error('Kategorie konnte nicht geändert werden', {
      description: error.message
    })
  }
}
```

**Test:** Toast appears on success/error

**Commit:** `feat(ui): add toast notifications to category change`

---

### Step 5.12: Update VideoDetailsModal - Same Changes

**Time:** 30 min
**Files:** `frontend/src/components/VideoDetailsModal.tsx`

**Task:**
Apply same changes as VideoDetailsPage:
- Add CategorySelector
- Filter tags to labels only
- Unified field display

**Test:** Modal has same functionality as page

**Commit:** `feat(ui): update VideoDetailsModal with category selector`

---

### Step 5.13: Write CategorySelector Unit Tests

**Time:** 45 min
**Files:** `frontend/src/components/CategorySelector.test.tsx` (NEW)

**Task:**
```typescript
describe('CategorySelector', () => {
  it('displays current category', () => {...})
  it('shows "Keine Kategorie" when no category assigned', () => {...})
  it('opens dropdown on click', async () => {...})
  it('shows warning dialog when changing category', async () => {...})
  it('shows clear button on hover when category assigned', async () => {...})
  it('disables selector when disabled prop is true', () => {...})
  it('shows loading state', () => {...})
})
```

**Test:** All tests pass

**Commit:** `test(ui): add CategorySelector tests`

---

### Step 5.14: Write CategoryChangeWarning Unit Tests

**Time:** 45 min
**Files:** `frontend/src/components/CategoryChangeWarning.test.tsx` (NEW)

**Task:**
```typescript
describe('CategoryChangeWarning', () => {
  it('shows fields that will be backed up', () => {...})
  it('shows fields that will persist', () => {...})
  it('shows restore checkbox when backup exists', () => {...})
  it('calls onConfirm with restore=true when checkbox checked', async () => {...})
  it('calls onCancel when cancel button clicked', async () => {...})
})
```

**Test:** All tests pass

**Commit:** `test(ui): add CategoryChangeWarning tests`

---

### Step 5.15: Run Phase 5 Verification

**Time:** 30 min
**Files:** None (testing)

**Task:**
1. `npm run type-check`
2. `npm run test`
3. `npm run lint`
4. Manual test video detail page
5. Test category change flow end-to-end
6. Verify warning dialog shows correct fields
7. Test backup restore (if backend ready)

**Test:** All checks pass, category change flow works

**Commit:** `test: verify Phase 5 Video Detail UI complete`

---

## Phase 6: Testing & Polish (12 steps, ~6 hours)

### Step 6.1: Create Backend Backup Service Unit Tests

**Time:** 45 min
**Files:** `backend/tests/unit/test_field_value_backup.py` (NEW)

**Task:**
Write tests from testing.md:
```python
class TestFieldValueBackupService:
    def test_backup_creates_json_file(self, tmp_path): ...
    def test_backup_handles_empty_values(self, tmp_path): ...
    def test_restore_recreates_field_values(self, tmp_path, mock_db): ...
    def test_restore_handles_corrupted_file(self, tmp_path, mock_db): ...
    def test_list_backups_returns_all_for_video(self, tmp_path): ...
    def test_delete_backup_removes_file(self, tmp_path): ...
```

**Test:** Run `pytest backend/tests/unit/test_field_value_backup.py`, all pass

**Commit:** `test(backend): add backup service unit tests`

---

### Step 6.2: Create Backend Field Aggregation Unit Tests

**Time:** 30 min
**Files:** `backend/tests/unit/test_field_aggregation.py` (NEW)

**Task:**
```python
class TestFieldAggregationService:
    async def test_aggregates_workspace_fields_only(self, mock_db): ...
    async def test_aggregates_workspace_and_category_fields(self, mock_db): ...
    async def test_deduplicates_shared_fields(self, mock_db): ...
    async def test_handles_no_schemas(self, mock_db): ...
```

**Test:** Run `pytest backend/tests/unit/test_field_aggregation.py`, all pass

**Commit:** `test(backend): add field aggregation unit tests`

---

### Step 6.3: Create Backend Category Validation Integration Tests

**Time:** 45 min
**Files:** `backend/tests/integration/test_category_validation.py` (NEW)

**Task:**
```python
class TestCategoryValidation:
    async def test_can_assign_single_category(self, client, test_video, test_category): ...
    async def test_cannot_assign_multiple_categories(self, client, test_video, test_categories): ...
    async def test_cannot_assign_second_category_if_video_has_one(self, ...): ...
    async def test_can_assign_labels_with_category(self, ...): ...
    async def test_can_reassign_same_category(self, ...): ...
```

**Test:** Run `pytest backend/tests/integration/test_category_validation.py`, all pass

**Commit:** `test(backend): add category validation integration tests`

---

### Step 6.4: Create Backend Category Change Integration Tests

**Time:** 45 min
**Files:** `backend/tests/integration/test_category_change.py` (NEW)

**Task:**
```python
class TestCategoryChange:
    async def test_change_category_creates_backup(self, ...): ...
    async def test_change_category_detects_existing_backup(self, ...): ...
    async def test_remove_category_creates_backup(self, ...): ...
    async def test_change_category_without_values_no_backup(self, ...): ...
```

**Test:** Run `pytest backend/tests/integration/test_category_change.py`, all pass

**Commit:** `test(backend): add category change integration tests`

---

### Step 6.5: Update Existing Frontend Tests for is_video_type

**Time:** 45 min
**Files:** All test files with Tag mocks

**Task:**
Search for Tag mocks and add `is_video_type: true`:
```bash
grep -r "const.*Tag.*=.*{" frontend/src --include="*.test.tsx"
```

Update each mock:
```typescript
const mockTag = {
  id: '1',
  name: 'Test',
  color: '#FF0000',
  is_video_type: true, // ADD THIS
  // ...
}
```

**Test:** `npm run test` - all existing tests pass

**Commit:** `test(frontend): add is_video_type to all Tag mocks`

---

### Step 6.6: Manual E2E Test - Story 001 (First-Time Setup)

**Time:** 30 min
**Files:** None (manual testing)

**Task:**
Follow story 001 exactly:
1. Open app (no categories exist)
2. Go to Settings → Kategorien
3. Click "+ Neue Kategorie"
4. Enter "Keto Rezepte", pick color, save
5. Click "Bearbeiten" on category
6. Add field "Kalorien" (Zahl)
7. Save
8. Go to video detail
9. Select "Keto Rezepte" from dropdown
10. Fill in fields
11. Save

**Test:** All steps complete successfully

**Commit:** None (manual verification)

---

### Step 6.7: Manual E2E Test - Story 002 (Category Switch)

**Time:** 30 min
**Files:** None (manual testing)

**Task:**
Follow story 002 exactly:
1. Video has category "Keto" with filled values
2. Open video detail
3. Change category to "Vegan"
4. See warning dialog with backed-up values
5. Confirm
6. Verify Keto fields hidden, Vegan fields shown
7. Verify workspace fields persisted
8. Change back to "Keto"
9. See restore prompt
10. Check "Restore values"
11. Confirm
12. Verify values restored

**Test:** Backup and restore work correctly

**Commit:** None (manual verification)

---

### Step 6.8: Fix Any Bugs Found in E2E Testing

**Time:** 60 min (variable)
**Files:** Various (depends on bugs found)

**Task:**
Fix any issues discovered during E2E testing:
- UI bugs
- API errors
- State management issues
- Missing error handling

**Test:** Re-run failing scenarios

**Commit:** `fix: [description of fix]` (multiple commits likely)

---

### Step 6.9: Accessibility Audit

**Time:** 30 min
**Files:** Various component files

**Task:**
Check all new components:
- [ ] Keyboard navigation works (Tab, Enter, Escape, Arrow keys)
- [ ] ARIA labels present (`aria-label`, `aria-expanded`, `aria-selected`)
- [ ] Focus management (focus returns to trigger after dialog close)
- [ ] Screen reader announcements (role="status", aria-live)

Fix any issues found.

**Test:** Run `npx axe-core` on components

**Commit:** `fix(a11y): improve accessibility of category components`

---

### Step 6.10: Polish Loading and Error States

**Time:** 30 min
**Files:** CategorySelector.tsx, CategoryChangeWarning.tsx

**Task:**
Ensure all states are covered:
- Loading spinners with descriptive text
- Error messages are user-friendly (German)
- Empty states have helpful guidance
- Transitions are smooth

**Test:** Manually test all states

**Commit:** `fix(ui): polish loading and error states`

---

### Step 6.11: Run Full Test Suite

**Time:** 30 min
**Files:** None (testing)

**Task:**
```bash
# Backend
cd backend
pytest --cov=app --cov-report=html
# Check coverage > 85%

# Frontend
cd frontend
npm run test -- --coverage
# Check coverage > 80%

npm run type-check
npm run lint
npm run build
```

**Test:** All tests pass, coverage meets targets, build succeeds

**Commit:** `test: verify full test suite passing`

---

### Step 6.12: Final Verification and Documentation

**Time:** 30 min
**Files:** `features/category-fields-hybrid/atomic-steps.md`

**Task:**
1. Remove false "Implementation Status" section from atomic-steps.md
2. Update status to reflect actual completion
3. Document any deviations from plan
4. Verify all acceptance criteria from plan.md are met

**Test:** All criteria checked

**Commit:** `docs: update implementation status`

---

## Summary

**Total Steps:** 91 atomic steps across 6 phases
**Estimated Time:** 45-50 hours

Each step is:
- ✅ 15-60 minutes
- ✅ Focused on one thing
- ✅ Independently committable
- ✅ Clearly testable

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

✅ Ready for Implementation
- Start with Step 1.1
- Work through all 91 steps sequentially
- Commit after each step

