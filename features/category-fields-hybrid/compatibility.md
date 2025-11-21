# Backward Compatibility: Category-Fields Hybrid System

**Feature ID:** category-fields-hybrid
**Date:** 2025-11-20
**Phase:** 5 - Backward Compatibility

---

## Compatibility Goal

**Zero Breaking Changes:** Existing functionality must continue to work exactly as before, even mid-deployment.

---

## Database Compatibility

### Schema Changes: Additive Only

#### Migration 1: Add `default_schema_id` to BookmarkList

```sql
-- SAFE: Nullable column, no data changes needed
ALTER TABLE bookmarks_lists
ADD COLUMN default_schema_id UUID NULL
REFERENCES field_schemas(id) ON DELETE SET NULL;

CREATE INDEX idx_bookmarks_lists_default_schema
ON bookmarks_lists(default_schema_id);
```

**Compatibility:**
- ✅ Existing rows: `default_schema_id` = NULL (valid state)
- ✅ Existing queries: Ignore new column (still work)
- ✅ New queries: Can filter by default_schema_id
- ✅ Rollback: Drop column, no data loss

---

#### Migration 2: Add `is_video_type` to Tag

```sql
-- SAFE: NOT NULL with server default
ALTER TABLE tags
ADD COLUMN is_video_type BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX idx_tags_is_video_type ON tags(is_video_type);
```

**Compatibility:**
- ✅ Existing tags: Automatically get `is_video_type = true`
- ✅ Existing tag queries: Still work (new column ignored)
- ✅ Existing behavior: All tags treated as "categories" (matches current usage)
- ✅ Rollback: Drop column, tags revert to old behavior

**Why default=true is safe:**
Current system treats all tags equally. Making them all "video types" by default preserves existing behavior (tags can have schemas, videos can have tags).

---

### Data Migration: None Needed!

**No data transformation required because:**
1. `default_schema_id` NULL = no workspace fields (current behavior)
2. `is_video_type=true` = tag with optional schema (current behavior)
3. Existing video_tags entries remain valid
4. Existing VideoFieldValues remain valid

---

## API Compatibility

### Request Compatibility: Optional Fields

#### POST /api/tags

**Before:**
```json
{
  "name": "Python",
  "color": "#3B82F6",
  "schema_id": "uuid-or-null"
}
```

**After (backward compatible):**
```json
{
  "name": "Python",
  "color": "#3B82F6",
  "schema_id": "uuid-or-null",
  "is_video_type": true  // OPTIONAL, defaults to true
}
```

**Compatibility:**
- ✅ Old clients: Can omit `is_video_type` → defaults to true
- ✅ New clients: Can explicitly set `is_video_type`
- ✅ Pydantic validation: `is_video_type: bool = True` provides default

---

#### PUT /api/tags/{id}

**Before:**
```json
{
  "name": "Updated Name",
  "schema_id": "new-uuid"
}
```

**After (backward compatible):**
```json
{
  "name": "Updated Name",
  "schema_id": "new-uuid",
  "is_video_type": true  // OPTIONAL
}
```

**Compatibility:**
- ✅ Old clients: Can omit `is_video_type` → keeps existing value
- ✅ Partial updates still work
- ✅ Pydantic: `is_video_type: Optional[bool]` in update schema

---

### Response Compatibility: Additive Fields

#### GET /api/tags

**Before:**
```json
[
  {
    "id": "uuid",
    "name": "Python",
    "color": "#3B82F6",
    "schema_id": "uuid-or-null",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

**After (backward compatible):**
```json
[
  {
    "id": "uuid",
    "name": "Python",
    "color": "#3B82F6",
    "schema_id": "uuid-or-null",
    "is_video_type": true,  // NEW FIELD
    "created_at": "...",
    "updated_at": "..."
  }
]
```

**Compatibility:**
- ✅ Old clients: Ignore unknown `is_video_type` field (JSON parsers skip it)
- ✅ New clients: Can read and use `is_video_type`
- ✅ TypeScript: Existing `Tag` interface updated, old code still compiles

---

### Validation Compatibility: Progressive Enforcement

#### POST /api/videos/{video_id}/tags

**Before:** No validation on tag types

**After:** Validate max 1 video type

**Compatibility Strategy:**

```python
@router.post("/videos/{video_id}/tags")
async def assign_tags_to_video(video_id, tag_ids, db):
    # EXISTING: Get video and tags
    video = await get_video(video_id, db)
    tags = await get_tags(tag_ids, db)

    # NEW: Validation (only if video types involved)
    video_types_to_add = [t for t in tags if t.is_video_type]

    if len(video_types_to_add) > 1:
        raise HTTPException(400, "Cannot assign multiple categories to one video")

    existing_video_type = next((t for t in video.tags if t.is_video_type), None)
    if existing_video_type and video_types_to_add:
        if video_types_to_add[0].id != existing_video_type.id:
            raise HTTPException(
                409,
                f"Video already has category '{existing_video_type.name}'. "
                "Remove it first or use PUT /videos/{id}/category."
            )

    # EXISTING: Assign tags (unchanged)
    for tag in tags:
        # Insert into video_tags...
```

**Compatibility:**
- ✅ Assigning labels (`is_video_type=false`): No validation, works as before
- ✅ Assigning 1 category: Works (validated)
- ❌ Assigning 2+ categories: Fails with clear error (new restriction)

**Edge Case:** Old client tries to assign 2 tags (both is_video_type=true)
- **Before migration:** Would work
- **After migration:** Returns 400 with clear message
- **Mitigation:** This is acceptable because:
  - We have no production users
  - New system prevents invalid state
  - Error message guides user to correct action

---

## Frontend Compatibility

### TypeScript Type Compatibility

#### Tag Type Evolution

**Before:**
```typescript
interface Tag {
  id: string
  name: string
  color: string | null
  schema_id: string | null
}
```

**After:**
```typescript
interface Tag {
  id: string
  name: string
  color: string | null
  schema_id: string | null
  is_video_type: boolean  // NEW
}
```

**Compatibility:**
- ✅ Existing code using `Tag` type: Still compiles
- ✅ Accessing `tag.name`, `tag.color`: Works
- ✅ Accessing `tag.is_video_type`: TypeScript allows (new field)
- ⚠️ Creating mock `Tag` in tests: Must add `is_video_type: true`

**Migration for tests:**
```typescript
// OLD test mock:
const mockTag: Tag = {
  id: '1',
  name: 'Test',
  color: null,
  schema_id: null,
}

// NEW test mock (add field):
const mockTag: Tag = {
  id: '1',
  name: 'Test',
  color: null,
  schema_id: null,
  is_video_type: true,  // ADD
}
```

**Fix Strategy:** TypeScript compiler will identify all mocks that need updating

---

### Component Compatibility

#### Existing Components Keep Working

**TagsList component:**
```typescript
// BEFORE: Shows all tags
export function TagsList({ tags }: TagsListProps) {
  return tags.map(tag => <TagItem key={tag.id} tag={tag} />)
}

// AFTER: Add optional filter (backward compatible)
interface TagsListProps {
  tags: Tag[]
  filter?: 'all' | 'categories' | 'labels'  // NEW, optional
}

export function TagsList({ tags, filter = 'all' }: TagsListProps) {
  const filtered = filter === 'all' ? tags :
    filter === 'categories' ? tags.filter(t => t.is_video_type) :
    tags.filter(t => !t.is_video_type)

  return filtered.map(tag => <TagItem key={tag.id} tag={tag} />)
}
```

**Compatibility:**
- ✅ Existing usage: `<TagsList tags={tags} />` works (defaults to 'all')
- ✅ New usage: `<TagsList tags={tags} filter="categories" />` works

---

#### Video Detail Components

**BEFORE: Show all tags as badges**
```typescript
export function VideoDetailsPage({ videoId }: Props) {
  const { data: video } = useVideo(videoId)

  return (
    <div>
      {video.tags.map(tag => <Badge key={tag.id}>{tag.name}</Badge>)}
    </div>
  )
}
```

**AFTER: Progressive enhancement (both work)**
```typescript
export function VideoDetailsPage({ videoId }: Props) {
  const { data: video } = useVideo(videoId)
  const category = video.tags.find(t => t.is_video_type)
  const labels = video.tags.filter(t => !t.is_video_type)

  return (
    <div>
      {/* NEW: Category selector */}
      {category && (
        <CategorySelector video={video} category={category} />
      )}

      {/* EXISTING: Tag badges (now filtered to labels) */}
      {labels.map(tag => <Badge key={tag.id}>{tag.name}</Badge>)}
    </div>
  )
}
```

**Compatibility:**
- ✅ Tags still displayed (just filtered)
- ✅ Category shown in new UI element
- ✅ No visual breakage

---

## Hook Compatibility

### useTags() - No Breaking Changes

```typescript
// EXISTING HOOK (unchanged):
export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get<Tag[]>('/tags')
      return TagsSchema.parse(data)  // Now includes is_video_type
    }
  })
}
```

**Compatibility:**
- ✅ Existing components using `useTags()`: Keep working
- ✅ Data shape changes (new field): Zod validates, TypeScript allows
- ✅ Query key unchanged: Cache still works

---

### New Hooks Don't Break Existing Code

```typescript
// NEW hooks (additive):
export const useCategories = () => {
  const { data: tags, ...rest } = useTags()
  return { data: tags?.filter(t => t.is_video_type) ?? [], ...rest }
}

export const useLabels = () => {
  const { data: tags, ...rest } = useTags()
  return { data: tags?.filter(t => !t.is_video_type) ?? [], ...rest }
}
```

**Compatibility:**
- ✅ Old code: Doesn't use new hooks, no impact
- ✅ New code: Can use new hooks
- ✅ React Query: Same underlying query, shared cache

---

## Deployment Compatibility

### Rolling Deployment Support

**Scenario:** Backend deployed, frontend not yet deployed

#### State 1: New backend, old frontend

**Old frontend sends:**
```json
POST /api/tags
{
  "name": "Python",
  "schema_id": null
  // No is_video_type
}
```

**New backend receives:**
```python
tag_data = TagCreate(**request_data)
# Pydantic fills in: is_video_type = True (default)
```

**Result:** ✅ Works perfectly (default value fills gap)

---

#### State 2: New backend, old frontend, GET response

**New backend returns:**
```json
{
  "id": "uuid",
  "name": "Python",
  "is_video_type": true  // NEW FIELD
}
```

**Old frontend receives:**
```typescript
interface Tag {  // OLD type (no is_video_type)
  id: string
  name: string
}

const tag: Tag = await response.json()
// JavaScript ignores extra "is_video_type" field
```

**Result:** ✅ Works (extra fields ignored)

---

### Database Migration Rollback

**Rollback scenario:** Need to revert migration

```sql
-- Rollback Migration 2:
DROP INDEX idx_tags_is_video_type;
ALTER TABLE tags DROP COLUMN is_video_type;

-- Rollback Migration 1:
DROP INDEX idx_bookmarks_lists_default_schema;
ALTER TABLE bookmarks_lists DROP COLUMN default_schema_id;
```

**Data Safety:**
- ✅ No data lost (columns were nullable or had defaults)
- ✅ Existing tags/lists unaffected
- ✅ Application reverts to old behavior

---

## Existing Feature Compatibility

### Tags Feature

**Before:**
- Create tags with name, color, schema
- Assign multiple tags to videos
- Filter videos by tag
- Delete tags

**After:**
- ✅ Create tags (now with is_video_type)
- ✅ Assign tags (with category validation)
- ✅ Filter videos (by categories or labels)
- ✅ Delete tags (same cascade behavior)

**No features removed!**

---

### Schemas Feature

**Before:**
- Create FieldSchema
- Bind schema to tags
- Add CustomFields to schema
- Videos inherit fields from tag schemas

**After:**
- ✅ Create FieldSchema (can also bind to list)
- ✅ Bind schema to tags/categories
- ✅ Add CustomFields to schema
- ✅ Videos inherit fields (from category + workspace)

**Enhanced, not replaced!**

---

### Custom Fields Feature

**Before:**
- Create CustomField
- Reuse across schemas
- VideoFieldValue stores values
- Values persist when tag removed

**After:**
- ✅ Create CustomField
- ✅ Reuse across schemas (including workspace schema)
- ✅ VideoFieldValue stores values
- ✅ Values persist + backed up

**Improved, not changed!**

---

## Edge Cases & Compatibility

### Edge Case 1: Video with multiple tags (before migration)

**Setup:**
```sql
-- Video has 3 tags:
video_id | tag_id
uuid-1   | tag-a  (Tutorial, has schema)
uuid-1   | tag-b  (Python, has schema)
uuid-1   | tag-c  (Favorites, no schema)
```

**After migration:**
```sql
-- All tags get is_video_type=true:
tag-a: is_video_type=true (category)
tag-b: is_video_type=true (category)
tag-c: is_video_type=true (category)
```

**Problem:** Video now has 3 categories! Violates new rule.

**Solution:**

**Option A: Grandfathering (Recommended)**
```python
# Validation only applies to NEW assignments
if len(new_video_types) > 1:
    raise HTTPException(400, "Cannot assign multiple categories")

# Existing videos with multiple is_video_type tags: Allowed
# They will be fixed when user edits the video
```

**Option B: Migration Script (Optional)**
```python
# One-time script: Convert all but first tag to labels
async def fix_multi_category_videos():
    videos_with_multi_cats = await get_videos_with_multiple_categories()
    for video in videos_with_multi_cats:
        categories = [t for t in video.tags if t.is_video_type]
        # Keep first, convert rest to labels
        for cat in categories[1:]:
            cat.is_video_type = False
```

**Decision:** Option A (grandfathering) is safer
- No automatic changes to user data
- User fixes naturally when they edit video
- Clear validation prevents new violations

---

### Edge Case 2: Field name conflicts

**Setup:**
```sql
-- List has default_schema with field "Rating"
default_schema_id -> schema-A -> field "Rating"

-- Category "Tutorials" also has field "Rating"
category-schema -> schema-B -> field "Rating"
```

**Question:** Which "Rating" is shown?

**Answer:** Same field! CustomFields are reusable.

```python
# Field aggregation deduplicates by field_id:
field_ids = set()
if default_schema:
    for sf in default_schema.schema_fields:
        if sf.field_id not in field_ids:  # ← Deduplication
            field_ids.add(sf.field_id)
            fields.append(sf.field)
```

**If different fields with same name:**
```sql
-- Different field IDs, same name:
field-1: name="Rating" (in default_schema)
field-2: name="Rating" (in category schema)
```

**Solution:** Prevented at creation
```python
# When adding field-2 to category schema:
if field_name in default_schema_field_names:
    raise HTTPException(
        409,
        "Field 'Rating' already exists in workspace fields. "
        "Please use a different name or use the existing field."
    )
```

---

### Edge Case 3: Deleting category with videos

**Before:** Delete tag → video_tags CASCADE → videos lose tag

**After (same behavior):**
```python
@router.delete("/tags/{tag_id}")
async def delete_tag(tag_id, db):
    tag = await db.get(Tag, tag_id)

    # NEW: If category with videos, create backups
    if tag.is_video_type:
        videos = await get_videos_with_tag(tag_id, db)
        for video in videos:
            await backup_field_values(video.id, tag_id, db)

    # EXISTING: Delete tag (CASCADE to video_tags)
    await db.delete(tag)
    await db.commit()
```

**Compatibility:**
- ✅ Same outcome (videos lose tag)
- ✅ Enhanced (field values backed up)
- ✅ Backups can be cleaned up later

---

## Testing Compatibility

### Existing Tests Keep Passing

**Strategy:** Minimal test updates

```python
# BEFORE:
def test_create_tag():
    tag = Tag(name="Test", user_id=user_id)
    # Creates tag

# AFTER (add default):
def test_create_tag():
    tag = Tag(name="Test", user_id=user_id, is_video_type=True)
    # Creates tag (explicit default)
```

**Automated fix:** Add `is_video_type=True` to all Tag() constructors

---

### Test Data Fixtures

**Before:**
```python
@pytest.fixture
async def sample_tag(db, user):
    tag = Tag(name="Python", color="#3B82F6", user_id=user.id)
    db.add(tag)
    await db.commit()
    return tag
```

**After (backward compatible):**
```python
@pytest.fixture
async def sample_tag(db, user):
    tag = Tag(
        name="Python",
        color="#3B82F6",
        user_id=user.id,
        is_video_type=True  # ADD (or use default)
    )
    db.add(tag)
    await db.commit()
    return tag
```

**Compatibility:**
- ✅ Existing tests using fixture: Keep working
- ✅ SQLAlchemy uses server default if omitted
- ✅ Explicit is better (add to fixtures)

---

## Documentation Compatibility

### API Documentation

**Approach:** Mark new fields clearly

```yaml
# OpenAPI spec:
Tag:
  properties:
    id:
      type: string
    name:
      type: string
    is_video_type:
      type: boolean
      default: true
      description: |
        NEW in v1.1: Distinguishes categories (true) from labels (false).
        Existing tags default to true.
```

**Compatibility:**
- ✅ Version noted (v1.1)
- ✅ Default documented
- ✅ Purpose explained

---

## Summary: Compatibility Checklist

### Database
- ✅ Migrations are additive (nullable or defaults)
- ✅ No data transformation required
- ✅ Rollback possible without data loss
- ✅ Existing rows get safe defaults

### API
- ✅ Request schemas: New fields optional with defaults
- ✅ Response schemas: Additive fields (clients ignore unknown)
- ✅ Validation: Progressive enforcement (clear errors)
- ✅ Endpoints: No removals, only additions

### Frontend
- ✅ Types: Extended (not changed)
- ✅ Hooks: New hooks additive, old hooks unchanged
- ✅ Components: Enhanced (not rewritten)
- ✅ Tests: Require minimal updates (add is_video_type)

### Deployment
- ✅ Rolling deployment safe (backend first, then frontend)
- ✅ Old frontend + new backend: Works (defaults fill gaps)
- ✅ New frontend + new backend: Full features
- ✅ Rollback: Clean revert path

### Features
- ✅ No existing features removed
- ✅ All existing workflows still work
- ✅ New features are enhancements
- ✅ Data safety maintained

---

## Compatibility Validation

**Before release, verify:**

1. ✅ Run full test suite (all existing tests pass)
2. ✅ Migration up + down successful
3. ✅ API contract tests pass
4. ✅ Frontend type checks pass
5. ✅ Old client can talk to new backend
6. ✅ New client can gracefully handle old data

---

## Next Phase

✅ Ready for Phase 6: User Stories
- Document specific user flows
- Interaction with new features
- Edge cases from user perspective
