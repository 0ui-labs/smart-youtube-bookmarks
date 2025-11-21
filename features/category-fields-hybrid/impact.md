# Impact Assessment: Category-Fields Hybrid System

**Feature ID:** category-fields-hybrid
**Date:** 2025-11-20
**Phase:** 3 - Impact Assessment

---

## Complexity Estimate

**Overall: HIGH**

- Backend changes: MEDIUM (new fields, validation logic, backup system)
- Frontend changes: HIGH (major UI redesign, new terminology)
- Database changes: LOW (2 new columns + migration)
- Testing needs: MEDIUM (new validation logic, backup/restore)

**Estimated effort:** 2-3 days full implementation

---

## Backend Impact

### Database Schema Changes

#### 1. Add `default_schema_id` to BookmarkList

**File:** New migration file

```sql
ALTER TABLE bookmarks_lists
ADD COLUMN default_schema_id UUID NULL
REFERENCES field_schemas(id) ON DELETE SET NULL;

CREATE INDEX idx_bookmarks_lists_default_schema
ON bookmarks_lists(default_schema_id);
```

**Impact:** LOW - Nullable column, no data migration needed

---

#### 2. Add `is_video_type` to Tag

**File:** New migration file

```sql
ALTER TABLE tags
ADD COLUMN is_video_type BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX idx_tags_is_video_type ON tags(is_video_type);
```

**Impact:** LOW - New column with default, existing tags become "video types"

---

### Model Changes

#### 1. `backend/app/models/list.py` - BookmarkList

**Changes:**
```python
# ADD:
default_schema_id: Mapped[Optional[PyUUID]] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("field_schemas.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
    comment="Workspace-wide schema (fields for all videos)"
)

# ADD relationship:
default_schema: Mapped[Optional["FieldSchema"]] = relationship(
    "FieldSchema",
    foreign_keys=[default_schema_id],
    ...
)
```

**Impact:** LOW - Simple field addition

---

#### 2. `backend/app/models/tag.py` - Tag

**Changes:**
```python
# ADD:
is_video_type: Mapped[bool] = mapped_column(
    Boolean,
    nullable=False,
    default=True,
    server_default='true',
    index=True,
    comment="True = video type/category, False = label"
)
```

**Impact:** LOW - Simple boolean field

---

### API Schema Changes (Pydantic)

#### 1. `backend/app/schemas/list.py` (if exists)

**Changes:**
```python
class BookmarkListResponse(BaseModel):
    ...
    default_schema_id: Optional[UUID] = None  # ADD

class BookmarkListUpdate(BaseModel):
    ...
    default_schema_id: Optional[UUID] = None  # ADD
```

**Impact:** LOW

---

#### 2. `backend/app/schemas/tag.py`

**Changes:**
```python
class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None
    schema_id: Optional[UUID] = None
    is_video_type: bool = True  # ADD with default

class TagResponse(BaseModel):
    ...
    is_video_type: bool  # ADD
```

**Impact:** LOW

---

### API Endpoint Changes

#### 1. `backend/app/api/tags.py`

**Changes:**
- POST /api/tags: Accept `is_video_type` in request body
- GET /api/tags: Include `is_video_type` in response
- PUT /api/tags/{id}: Allow updating `is_video_type`
- DELETE /api/tags/{id}: No change

**New validation:**
- If tag is video type (is_video_type=true), validate max 1 per video

**Impact:** LOW - Minor additions to existing endpoints

---

#### 2. `backend/app/api/videos.py`

**Changes:**
```python
# MODIFY existing endpoint to enforce category logic:
@router.post("/videos/{video_id}/tags")
async def assign_tags_to_video(...):
    # ADD VALIDATION:
    # - Count video types in tag_ids
    # - If > 1 video type: raise HTTPException 400
    # - If video already has video type + new video type: raise HTTPException 409
```

**New endpoint (optional):**
```python
@router.put("/videos/{video_id}/category")
async def set_video_category(
    video_id: UUID,
    category_id: Optional[UUID],  # null = remove category
    db: AsyncSession = Depends(get_db)
):
    # Set video's category (replaces existing video type tag)
    # Creates backup of old category's field values
    # Returns new available fields
```

**Impact:** MEDIUM - New validation logic + backup system

---

#### 3. `backend/app/api/lists.py` (if exists)

**Changes:**
```python
@router.put("/lists/{list_id}")
async def update_list(...):
    # ADD: Allow updating default_schema_id
```

**Impact:** LOW

---

### New Backend Components

#### 1. Backup Service

**File:** `backend/app/services/field_value_backup.py` (NEW)

**Purpose:** Handle category change backups

**Functions:**
```python
async def backup_field_values(
    video_id: UUID,
    old_category_id: UUID,
    db: AsyncSession
) -> Path:
    """
    Backup VideoFieldValues for old category to JSON file.
    Returns path to backup file.
    """

async def restore_field_values(
    video_id: UUID,
    category_id: UUID,
    db: AsyncSession
) -> int:
    """
    Restore VideoFieldValues from backup if available.
    Returns count of restored values.
    """

async def list_backups(video_id: UUID) -> List[BackupInfo]:
    """
    List available backups for a video.
    """

async def delete_backup(
    video_id: UUID,
    category_id: UUID
) -> bool:
    """
    Delete specific backup.
    """
```

**Impact:** MEDIUM - New service, needs tests

---

#### 2. Field Aggregation Logic

**File:** `backend/app/services/field_aggregation.py` (NEW)

**Purpose:** Get available fields for a video

**Functions:**
```python
async def get_available_fields(
    video: Video,
    db: AsyncSession
) -> List[CustomField]:
    """
    Returns all fields available for this video:
    - List default_schema fields
    - Video's category schema fields (if has category)

    Deduplicates by field ID.
    """
```

**Impact:** MEDIUM - Core business logic

---

### Modified Backend Components

#### 1. Video Queries

**Files:** Various endpoints that fetch videos with fields

**Changes:**
- Update field aggregation to include default_schema
- Ensure category (video type tag) is loaded
- Filter tags by is_video_type for display

**Impact:** LOW-MEDIUM - Refactor existing queries

---

## Frontend Impact

### Type Definitions

#### 1. `frontend/src/types/tag.ts`

**Changes:**
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

export interface TagCreate {
  name: string
  color?: string | null
  schema_id?: string | null
  is_video_type?: boolean  // ADD with default true
}

// ADD Zod schema update
export const TagSchema = z.object({
  ...
  is_video_type: z.boolean(),  // ADD
})
```

**Impact:** LOW - Type addition

---

#### 2. `frontend/src/types/list.ts` (if exists)

**Changes:**
```typescript
export interface BookmarkList {
  ...
  default_schema_id: string | null  // ADD
}
```

**Impact:** LOW

---

### Hook Changes

#### 1. `frontend/src/hooks/useTags.ts`

**Changes:**
- useCreateTag: Accept `is_video_type` in mutation
- useTags: Types updated to include `is_video_type`

**New hooks:**
```typescript
// Filter tags by type
export const useVideoTypes = () => {
  const { data: tags, ...rest } = useTags()
  return {
    data: tags?.filter(t => t.is_video_type),
    ...rest
  }
}

export const useLabels = () => {
  const { data: tags, ...rest } = useTags()
  return {
    data: tags?.filter(t => !t.is_video_type),
    ...rest
  }
}
```

**Impact:** LOW-MEDIUM

---

#### 2. `frontend/src/hooks/useVideos.ts`

**New hook:**
```typescript
export const useSetVideoCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      videoId,
      categoryId
    }: {
      videoId: string
      categoryId: string | null
    }) => {
      // Call new category endpoint or use existing tags endpoint
      // Handle backup prompt if needed
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    }
  })
}

export const useRemoveTagFromVideo = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      videoId,
      tagId
    }: {
      videoId: string
      tagId: string
    }) => {
      await api.delete(`/videos/${videoId}/tags/${tagId}`)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    }
  })
}
```

**Impact:** MEDIUM - New hooks

---

#### 3. `frontend/src/hooks/useLists.ts` (if exists)

**Changes:**
- useUpdateList: Accept `default_schema_id`
- Types updated

**Impact:** LOW

---

### Component Changes

#### MAJOR: Settings Page Redesign

**File:** `frontend/src/pages/SettingsPage.tsx`

**Changes:**

1. **Rename "Tags" tab → "Kategorien"**
2. **Add "Alle Videos" as special first item** in categories list
3. **Split tags by is_video_type** for display
4. **Update terminology** throughout

**Before:**
```
Tabs: Schemas | Fields | Tags | Analytics
```

**After:**
```
Tabs: Kategorien | Analytics
```

**New structure:**
```
Kategorien Tab:
  [Alle Videos]             [Bearbeiten]
    • Bewertung
    • Notizen

  [Python Tutorials]        [Bearbeiten]
    • Schwierigkeit
    • Dauer

  [+ Neue Kategorie]
```

**Impact:** HIGH - Major UI redesign

---

#### MAJOR: Tags List Component

**File:** `frontend/src/components/settings/TagsList.tsx`

**Changes:**

**Before:** Show all tags with schema dropdown

**After:**
- Filter by is_video_type
- Show video types as "Categories"
- Add "Alle Videos" special item at top
- Different styling for workspace vs category
- Click to edit opens modal with fields

**Impact:** HIGH - Complete rewrite

---

#### NEW: Category Selector Component

**File:** `frontend/src/components/CategorySelector.tsx` (NEW)

**Purpose:** Dropdown to select video's category

**Props:**
```typescript
interface CategorySelectorProps {
  videoId: string
  currentCategoryId: string | null
  onCategoryChange: (categoryId: string | null) => void
}
```

**Features:**
- Dropdown with all video types
- "Keine Kategorie" option
- Confirmation dialog on change (show warning about field hiding)

**Impact:** MEDIUM - New component

---

#### MODIFIED: Video Details Page

**File:** `frontend/src/pages/VideoDetailsPage.tsx`

**Changes:**

1. **Add category selector** at top
2. **Remove tag badges** (or filter to only labels if we keep labels)
3. **Show fields** from default_schema + category schema
4. **No visual separation** between field sources

**Before:**
```tsx
<div>
  {video.tags.map(tag => <Badge>{tag.name}</Badge>)}
</div>
```

**After:**
```tsx
<div>
  <Label>Kategorie</Label>
  <CategorySelector
    videoId={video.id}
    currentCategoryId={video.category_id}
    onCategoryChange={handleCategoryChange}
  />
</div>

{/* Field values - no separation */}
<div>
  {video.available_fields.map(field => (
    <FieldInput key={field.id} field={field} />
  ))}
</div>
```

**Impact:** MEDIUM - UI changes

---

#### MODIFIED: Video Details Modal

**File:** `frontend/src/components/VideoDetailsModal.tsx`

**Changes:** Same as VideoDetailsPage

**Impact:** MEDIUM

---

#### NEW: Category Change Warning Dialog

**File:** `frontend/src/components/CategoryChangeWarning.tsx` (NEW)

**Purpose:** Warn user about field value hiding

**Content:**
```
⚠️ Kategorie ändern

Die Felder von "Tutorial" werden ausgeblendet (nicht gelöscht).

Schwierigkeit: Anfänger
Dauer: 30 min

Diese Werte sind wieder verfügbar wenn du zurück zu
"Tutorial" wechselst.

[Abbrechen]  [Kategorie ändern]
```

**Impact:** MEDIUM - New dialog

---

#### MODIFIED: Edit Tag Dialog

**File:** `frontend/src/components/EditTagDialog.tsx`

**Changes:**
- Add `is_video_type` checkbox (or hide it, treat as implicit)
- Update terminology if tag is video type
- Different UI for "Alle Videos" (can only edit fields, not name/color)

**Impact:** LOW-MEDIUM

---

#### NEW: Workspace Fields Editor

**File:** `frontend/src/components/WorkspaceFieldsEditor.tsx` (NEW)

**Purpose:** Edit default_schema fields for "Alle Videos"

**Features:**
- Show current workspace fields
- Add field button
- Remove field button
- Same UI as schema field editor

**Impact:** MEDIUM - New component

---

### Page Changes

#### Modified Pages

| Page | Changes | Impact |
|------|---------|--------|
| SettingsPage | Major redesign (see above) | HIGH |
| VideoDetailsPage | Add category selector, update fields display | MEDIUM |

#### New Pages

None - all changes are component-level

---

### Routing Changes

**File:** `frontend/src/App.tsx` (or routing config)

**Changes:** None - all routes stay same

**Impact:** NONE

---

## Testing Impact

### Backend Tests

#### New Test Files

1. **`backend/tests/unit/test_field_value_backup.py`**
   - Test backup creation
   - Test backup restoration
   - Test backup deletion
   - Test missing backup handling

2. **`backend/tests/unit/test_field_aggregation.py`**
   - Test field aggregation logic
   - Test deduplication
   - Test default_schema + category schema combination

3. **`backend/tests/integration/test_category_validation.py`**
   - Test max 1 category per video
   - Test category change with backup
   - Test video type vs label logic

**Impact:** HIGH - New test coverage needed

---

#### Modified Test Files

1. **`backend/tests/integration/test_cascade_deletes.py`**
   - Update to test default_schema_id SET NULL
   - Test backup creation on category change

2. **`backend/tests/api/test_tags.py`**
   - Add is_video_type to test data
   - Test filtering by is_video_type

3. **`backend/tests/api/test_videos.py`**
   - Test category validation
   - Test category change endpoint

**Impact:** MEDIUM - Updates to existing tests

---

### Frontend Tests

#### New Test Files

1. **`frontend/src/components/CategorySelector.test.tsx`**
   - Test category selection
   - Test warning dialog
   - Test clearing category

2. **`frontend/src/components/WorkspaceFieldsEditor.test.tsx`**
   - Test adding/removing workspace fields
   - Test field name conflict detection

**Impact:** MEDIUM

---

#### Modified Test Files

1. **`frontend/src/pages/SettingsPage.test.tsx`** (if exists)
   - Update for new UI structure
   - Test "Kategorien" tab

2. **`frontend/src/components/EditTagDialog.test.tsx`**
   - Add is_video_type handling

**Impact:** MEDIUM

---

## API Contract Changes

### New Endpoints

```
PUT /api/videos/{video_id}/category
  Request: { category_id: UUID | null }
  Response: { available_fields: Field[], backup_created: boolean }

GET /api/videos/{video_id}/backups
  Response: BackupInfo[]

POST /api/videos/{video_id}/backups/{category_id}/restore
  Response: { restored_count: number }
```

**Impact:** MEDIUM

---

### Modified Endpoints

```
POST /api/tags
  Request: + is_video_type: boolean (default true)
  Response: + is_video_type: boolean

GET /api/tags
  Response items: + is_video_type: boolean

PUT /api/tags/{id}
  Request: + is_video_type: boolean
  Response: + is_video_type: boolean

POST /api/videos/{video_id}/tags
  Validation: MAX 1 video type tag

PUT /api/lists/{list_id}
  Request: + default_schema_id: UUID | null
  Response: + default_schema_id: UUID | null
```

**Impact:** LOW-MEDIUM

---

## Configuration/Environment Changes

**None required**

---

## Documentation Impact

### Files to Update

1. **README.md** - Update feature description
2. **API.md** (if exists) - Document new endpoints
3. **ARCHITECTURE.md** (if exists) - Update data model diagram

**Impact:** LOW

---

## Deployment Considerations

### Database Migration

**Steps:**
1. Run migration to add columns
2. Existing tags default to `is_video_type=true` (backward compatible)
3. No data backfill needed

**Downtime:** None (nullable columns, no breaking changes)

---

### Feature Flags

**Recommendation:** No feature flag needed
- Changes are additive
- No production users yet
- Can be deployed directly

---

## Summary: Files Affected

### Backend

**Models (2 files):**
- ✏️ `backend/app/models/list.py` - Add default_schema_id
- ✏️ `backend/app/models/tag.py` - Add is_video_type

**API (3 files):**
- ✏️ `backend/app/api/tags.py` - Add is_video_type handling
- ✏️ `backend/app/api/videos.py` - Add category validation + backup
- ✏️ `backend/app/api/lists.py` - Add default_schema_id handling

**Schemas (2 files):**
- ✏️ `backend/app/schemas/tag.py` - Add is_video_type
- ✏️ `backend/app/schemas/list.py` - Add default_schema_id

**Services (2 NEW files):**
- ➕ `backend/app/services/field_value_backup.py` - Backup system
- ➕ `backend/app/services/field_aggregation.py` - Field logic

**Migrations (1 NEW file):**
- ➕ `backend/alembic/versions/{hash}_add_category_system.py`

**Tests (5 files + 3 NEW):**
- ✏️ `backend/tests/integration/test_cascade_deletes.py`
- ✏️ `backend/tests/api/test_tags.py`
- ✏️ `backend/tests/api/test_videos.py`
- ➕ `backend/tests/unit/test_field_value_backup.py`
- ➕ `backend/tests/unit/test_field_aggregation.py`
- ➕ `backend/tests/integration/test_category_validation.py`

**Total Backend:** ~14 files (8 modified, 6 new)

---

### Frontend

**Types (2 files):**
- ✏️ `frontend/src/types/tag.ts` - Add is_video_type
- ✏️ `frontend/src/types/list.ts` - Add default_schema_id

**Hooks (3 files):**
- ✏️ `frontend/src/hooks/useTags.ts` - Add filters + is_video_type
- ✏️ `frontend/src/hooks/useVideos.ts` - Add category hooks
- ✏️ `frontend/src/hooks/useLists.ts` - Add default_schema_id

**Pages (1 file):**
- ✏️ `frontend/src/pages/SettingsPage.tsx` - Major redesign

**Components (6 files + 3 NEW):**
- ✏️ `frontend/src/components/settings/TagsList.tsx` - Rewrite for categories
- ✏️ `frontend/src/pages/VideoDetailsPage.tsx` - Add category selector
- ✏️ `frontend/src/components/VideoDetailsModal.tsx` - Add category selector
- ✏️ `frontend/src/components/EditTagDialog.tsx` - Update for is_video_type
- ➕ `frontend/src/components/CategorySelector.tsx` - NEW
- ➕ `frontend/src/components/CategoryChangeWarning.tsx` - NEW
- ➕ `frontend/src/components/WorkspaceFieldsEditor.tsx` - NEW

**Tests (2 files + 2 NEW):**
- ✏️ `frontend/src/pages/SettingsPage.test.tsx`
- ✏️ `frontend/src/components/EditTagDialog.test.tsx`
- ➕ `frontend/src/components/CategorySelector.test.tsx`
- ➕ `frontend/src/components/WorkspaceFieldsEditor.test.tsx`

**Total Frontend:** ~17 files (9 modified, 5 new)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Backup system failure | HIGH | Comprehensive tests, graceful degradation |
| Field name conflicts | MEDIUM | Validation at creation, clear error messages |
| Category validation missed | MEDIUM | Backend + frontend validation |
| UI confusion | MEDIUM | User-friendly terminology, tooltips, warnings |
| Data migration issues | LOW | No production data, simple migration |

---

## Estimated Effort Breakdown

| Area | Complexity | Time Estimate |
|------|-----------|---------------|
| Database migration | LOW | 0.5 hours |
| Backend models | LOW | 1 hour |
| Backend API changes | MEDIUM | 4 hours |
| Backup service | MEDIUM | 4 hours |
| Field aggregation | LOW | 2 hours |
| Backend tests | MEDIUM | 4 hours |
| **Backend Total** | | **15.5 hours** |
| | | |
| Frontend types | LOW | 0.5 hours |
| Frontend hooks | MEDIUM | 3 hours |
| Settings redesign | HIGH | 6 hours |
| Category selector | MEDIUM | 3 hours |
| Video detail updates | MEDIUM | 3 hours |
| New dialogs | MEDIUM | 3 hours |
| Frontend tests | MEDIUM | 3 hours |
| **Frontend Total** | | **21.5 hours** |
| | | |
| **GRAND TOTAL** | | **~37 hours (4-5 days)** |

---

## Next Steps

After this impact assessment, proceed to:

1. ✅ Phase 4: Integration Strategy
2. ✅ Phase 5: Backward Compatibility
3. ✅ Phase 6: User Stories
4. ✅ Phase 7: UI/UX Integration
5. ✅ Phase 8: Implementation Plan
