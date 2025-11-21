# Integration Strategy: Category-Fields Hybrid System

**Feature ID:** category-fields-hybrid
**Date:** 2025-11-20
**Phase:** 4 - Integration Strategy

---

## Integration Philosophy

**Goal:** Extend, don't replace.

- Keep existing Tag/Schema/Field system intact
- Add new fields and logic alongside existing code
- Use semantic interpretation (is_video_type) to change behavior
- No breaking changes to existing data structures

---

## Backend Integration Strategy

### Database Layer: Extension Points

#### 1. BookmarkList Model - Clean Extension

**Integration Point:** `backend/app/models/list.py`

**Strategy:** Add optional field

```python
# EXISTING:
class BookmarkList(BaseModel):
    name: Mapped[str]
    user_id: Mapped[PyUUID]
    schema_id: Mapped[Optional[PyUUID]]  # OLD extraction schema
    field_schemas: Mapped[list["FieldSchema"]]  # Existing

# ADD (non-breaking):
    default_schema_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("field_schemas.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    default_schema: Mapped[Optional["FieldSchema"]] = relationship(
        "FieldSchema",
        foreign_keys=[default_schema_id],
        # Use foreign_keys to avoid ambiguity with field_schemas relationship
    )
```

**Why this works:**
- ✅ Nullable field - no migration data needed
- ✅ Uses existing FieldSchema model - no new tables
- ✅ Separate from old schema_id - no conflicts
- ✅ ON DELETE SET NULL - survives schema deletion

**No changes needed to:**
- Existing relationships
- Cascade behavior
- Existing queries (field is optional)

---

#### 2. Tag Model - Semantic Extension

**Integration Point:** `backend/app/models/tag.py`

**Strategy:** Add boolean flag to change interpretation

```python
# EXISTING:
class Tag(BaseModel):
    name: Mapped[str]
    color: Mapped[Optional[str]]
    schema_id: Mapped[Optional[PyUUID]]  # Already exists!
    videos: Mapped[list["Video"]]  # M:N via video_tags

# ADD (non-breaking):
    is_video_type: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default='true',  # DB default for existing rows
        index=True
    )
```

**Why this works:**
- ✅ Existing tags become "video types" (default=true)
- ✅ Can create new "label" tags (is_video_type=false)
- ✅ Same video_tags junction table - no new M:N table
- ✅ Existing Tag→FieldSchema relationship reused
- ✅ No changes to cascade behavior

**Semantic interpretation:**
```python
# In business logic:
video_types = [tag for tag in video.tags if tag.is_video_type]
labels = [tag for tag in video.tags if not tag.is_video_type]

# Validation:
if len(video_types) > 1:
    raise ValidationError("Max 1 category per video")
```

**No changes needed to:**
- video_tags junction table
- Tag relationships
- Existing tag queries (filter by is_video_type in application)

---

#### 3. Video Model - No Changes!

**Integration Point:** `backend/app/models/video.py`

**Strategy:** Use existing video_tags relationship

```python
# EXISTING (unchanged):
class Video(BaseModel):
    tags: Mapped[list["Tag"]]  # M:N via video_tags

# BUSINESS LOGIC (in service layer):
@property
def category(self) -> Optional[Tag]:
    """Get video's category (first video type tag)."""
    return next((t for t in self.tags if t.is_video_type), None)

@property
def labels(self) -> list[Tag]:
    """Get video's labels (non-video-type tags)."""
    return [t for t in self.tags if not t.is_video_type]
```

**Why this works:**
- ✅ No schema changes to Video table
- ✅ Reuses existing video_tags M:N table
- ✅ Category is just filtered view of tags
- ✅ Can still support labels in future (same table)

**Alternative (optional optimization):**
```python
# Could add for performance (not required):
category_id: Mapped[Optional[PyUUID]] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("tags.id", ondelete="SET NULL"),
    nullable=True
)
```

**Decision:** Start without category_id, use filtered tags
- Simpler migration
- Reuses existing infrastructure
- Can add later if performance issue

---

### API Layer: Validation Insertion Points

#### 1. Tags API - Minimal Changes

**Integration Point:** `backend/app/api/tags.py`

**Existing endpoints work as-is, just add field:**

```python
# POST /api/tags
@router.post("", response_model=TagResponse)
async def create_tag(
    tag_data: TagCreate,  # Now includes is_video_type (default=true)
    db: AsyncSession = Depends(get_db)
):
    # EXISTING CODE UNCHANGED
    tag = Tag(**tag_data.dict())  # is_video_type automatically included
    db.add(tag)
    await db.commit()
    return tag
```

**Strategy:** Pydantic schemas handle new field automatically
- TagCreate gets `is_video_type: bool = True`
- TagResponse gets `is_video_type: bool`
- No changes to endpoint logic needed

**Why this works:**
- ✅ Backward compatible (defaults to true)
- ✅ No breaking changes to API
- ✅ Clients can optionally send is_video_type

---

#### 2. Videos API - Validation Layer

**Integration Point:** `backend/app/api/videos.py`

**Existing endpoint:** `POST /api/videos/{video_id}/tags`

**Strategy:** Add validation BEFORE existing logic

```python
@router.post("/videos/{video_id}/tags")
async def assign_tags_to_video(
    video_id: UUID,
    tag_ids: list[UUID],  # EXISTING parameter
    db: AsyncSession = Depends(get_db)
):
    # NEW: Validation layer
    video = await get_video_or_404(video_id, db)
    tags_to_assign = await get_tags_by_ids(tag_ids, db)

    # VALIDATE: Max 1 video type
    new_video_types = [t for t in tags_to_assign if t.is_video_type]
    existing_video_types = [t for t in video.tags if t.is_video_type]

    if len(new_video_types) > 1:
        raise HTTPException(400, "Cannot assign multiple categories")

    if new_video_types and existing_video_types:
        if new_video_types[0].id != existing_video_types[0].id:
            raise HTTPException(
                409,
                f"Video already has category '{existing_video_types[0].name}'. "
                "Remove it first or use PUT /videos/{video_id}/category"
            )

    # EXISTING CODE (unchanged):
    for tag in tags_to_assign:
        # Add to video_tags...
```

**Why this works:**
- ✅ Existing endpoint still works
- ✅ New validation prevents invalid state
- ✅ Clear error messages
- ✅ Doesn't break existing clients (labels still work)

---

#### 3. New Category Endpoint (Optional)

**Integration Point:** `backend/app/api/videos.py`

**Strategy:** New endpoint as convenience wrapper

```python
@router.put("/videos/{video_id}/category")
async def set_video_category(
    video_id: UUID,
    request: SetCategoryRequest,  # { category_id: UUID | null }
    db: AsyncSession = Depends(get_db)
):
    """
    Set video's category (replaces existing category if any).
    Convenience endpoint for category management.
    """
    video = await get_video_or_404(video_id, db)

    # Remove existing category
    existing_category = next((t for t in video.tags if t.is_video_type), None)
    if existing_category:
        # Create backup BEFORE removing
        await backup_field_values(video_id, existing_category.id, db)
        # Remove from video_tags
        delete_stmt = video_tags.delete().where(
            video_tags.c.video_id == video_id,
            video_tags.c.tag_id == existing_category.id
        )
        await db.execute(delete_stmt)

    # Add new category (if not null)
    if request.category_id:
        # Validate category exists and is video type
        category = await get_tag_or_404(request.category_id, db)
        if not category.is_video_type:
            raise HTTPException(400, "Tag is not a category")

        # Add to video_tags
        insert_stmt = video_tags.insert().values(
            video_id=video_id,
            tag_id=request.category_id
        )
        await db.execute(insert_stmt)

        # Check for backup and offer restoration
        backup_info = await get_backup_info(video_id, request.category_id)

    await db.commit()
    return {"backup_available": backup_info is not None}
```

**Why this works:**
- ✅ Atomic category change
- ✅ Handles backup automatically
- ✅ Clear semantics (PUT = replace)
- ✅ Doesn't interfere with existing tags endpoint

---

### Service Layer: New Services

#### 1. Backup Service - Isolated Module

**Integration Point:** NEW `backend/app/services/field_value_backup.py`

**Strategy:** Standalone service, no coupling

```python
# File system based backups (simple, reliable)
BACKUP_DIR = Path("backups/field_values")

async def backup_field_values(
    video_id: UUID,
    category_id: UUID,
    db: AsyncSession
) -> Path:
    """
    Backup VideoFieldValues for video's category.
    Returns path to backup file.
    """
    # Query field values for this video + category's schema
    category = await db.get(Tag, category_id, options=[selectinload(Tag.schema)])
    if not category or not category.schema:
        return None  # No fields to backup

    field_ids = [sf.field_id for sf in category.schema.schema_fields]
    stmt = select(VideoFieldValue).where(
        VideoFieldValue.video_id == video_id,
        VideoFieldValue.field_id.in_(field_ids)
    )
    values = (await db.execute(stmt)).scalars().all()

    if not values:
        return None

    # Serialize to JSON
    backup_data = {
        "video_id": str(video_id),
        "category_id": str(category_id),
        "category_name": category.name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "values": [
            {
                "field_id": str(v.field_id),
                "value_text": v.value_text,
                "value_numeric": float(v.value_numeric) if v.value_numeric else None,
                "value_boolean": v.value_boolean,
            }
            for v in values
        ]
    }

    # Write to file
    backup_path = BACKUP_DIR / str(video_id) / f"{category_id}.json"
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    backup_path.write_text(json.dumps(backup_data, indent=2))

    return backup_path
```

**Why this works:**
- ✅ No database tables needed
- ✅ Simple file-based storage
- ✅ Easy to backup/restore
- ✅ No coupling to existing models
- ✅ Can compress later if needed

---

#### 2. Field Aggregation Service - Business Logic Layer

**Integration Point:** NEW `backend/app/services/field_aggregation.py`

**Strategy:** Centralize field aggregation logic

```python
async def get_available_fields(
    video: Video,
    db: AsyncSession
) -> list[CustomField]:
    """
    Get all fields available for this video.
    Combines list default_schema + video's category schema.
    """
    field_ids = set()
    fields = []

    # 1. Get list's default schema fields
    list_obj = await db.get(
        BookmarkList,
        video.list_id,
        options=[selectinload(BookmarkList.default_schema).selectinload(FieldSchema.schema_fields)]
    )
    if list_obj and list_obj.default_schema:
        for sf in list_obj.default_schema.schema_fields:
            if sf.field_id not in field_ids:
                field_ids.add(sf.field_id)
                fields.append(sf.field)

    # 2. Get video's category schema fields
    category = next((t for t in video.tags if t.is_video_type), None)
    if category and category.schema:
        for sf in category.schema.schema_fields:
            if sf.field_id not in field_ids:  # Deduplicate
                field_ids.add(sf.field_id)
                fields.append(sf.field)

    return fields
```

**Why this works:**
- ✅ Single source of truth for field logic
- ✅ Automatic deduplication
- ✅ Reuses existing relationships
- ✅ Can be tested in isolation

**Usage in API:**
```python
# In video detail endpoint:
video = await get_video_with_tags(video_id, db)
available_fields = await get_available_fields(video, db)
return {
    "video": video,
    "available_fields": available_fields
}
```

---

## Frontend Integration Strategy

### Type Layer: Extension Pattern

**Integration Point:** `frontend/src/types/tag.ts`

**Strategy:** Extend existing types

```typescript
// EXISTING:
export interface Tag {
  id: string
  name: string
  color: string | null
  schema_id: string | null
}

// EXTEND (non-breaking):
export interface Tag {
  id: string
  name: string
  color: string | null
  schema_id: string | null
  is_video_type: boolean  // ADD
}

// ADD helper types:
export type Category = Tag & { is_video_type: true }
export type Label = Tag & { is_video_type: false }
```

**Zod Schema:**
```typescript
// EXISTING:
export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  schema_id: z.string().nullable(),
})

// UPDATE:
export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  schema_id: z.string().nullable(),
  is_video_type: z.boolean(),  // ADD
})
```

**Why this works:**
- ✅ Existing code using Tag still works
- ✅ New code can filter by is_video_type
- ✅ Zod validation ensures type safety

---

### Hook Layer: Facade Pattern

**Integration Point:** `frontend/src/hooks/useTags.ts`

**Strategy:** Existing hook returns all, add filtered versions

```typescript
// EXISTING (unchanged):
export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get<Tag[]>('/tags')
      return TagsSchema.parse(data)
    }
  })
}

// ADD facades (new hooks):
export const useCategories = () => {
  const { data: tags, ...rest } = useTags()
  return {
    data: tags?.filter(t => t.is_video_type) ?? [],
    ...rest
  }
}

export const useLabels = () => {
  const { data: tags, ...rest } = useTags()
  return {
    data: tags?.filter(t => !t.is_video_type) ?? [],
    ...rest
  }
}
```

**Why this works:**
- ✅ useTags() still works for existing code
- ✅ New code uses useCategories() for clarity
- ✅ Single query, multiple views
- ✅ React Query caching works automatically

---

### Component Layer: Composition Pattern

**Integration Point:** `frontend/src/pages/SettingsPage.tsx`

**Strategy:** Reuse TagsList component with filter prop

```typescript
// EXISTING component (slightly modified):
interface TagsListProps {
  tags: Tag[]
  filter?: 'categories' | 'labels' | 'all'  // ADD
}

export function TagsList({ tags, filter = 'all' }: TagsListProps) {
  const filteredTags = useMemo(() => {
    if (filter === 'categories') return tags.filter(t => t.is_video_type)
    if (filter === 'labels') return tags.filter(t => !t.is_video_type)
    return tags
  }, [tags, filter])

  // Render with filteredTags...
}

// USAGE in SettingsPage:
export function SettingsPage() {
  const { data: tags = [] } = useTags()

  return (
    <Tabs value={activeTab}>
      <TabsContent value="kategorien">
        {/* Show categories + "Alle Videos" special item */}
        <WorkspaceFieldsCard />  {/* NEW component */}
        <TagsList tags={tags} filter="categories" />  {/* EXISTING component */}
      </TabsContent>
    </Tabs>
  )
}
```

**Why this works:**
- ✅ Reuses existing TagsList component
- ✅ Filter prop is optional (backward compatible)
- ✅ Composition over rewrite

---

### UI Layer: Progressive Enhancement

**Integration Point:** `frontend/src/pages/VideoDetailsPage.tsx`

**Strategy:** Add category selector WITHOUT removing tags

```typescript
// PHASE 1: Add category selector (tags still visible)
export function VideoDetailsPage() {
  const video = useVideo(videoId)
  const category = video.tags.find(t => t.is_video_type)
  const labels = video.tags.filter(t => !t.is_video_type)

  return (
    <div>
      {/* NEW: Category selector */}
      <div>
        <Label>Kategorie</Label>
        <CategorySelector
          videoId={video.id}
          currentCategory={category}
        />
      </div>

      {/* EXISTING: Tags (filtered to labels only) */}
      {labels.length > 0 && (
        <div>
          <Label>Labels</Label>
          {labels.map(label => <Badge key={label.id}>{label.name}</Badge>)}
        </div>
      )}

      {/* EXISTING: Fields (now aggregated) */}
      <FieldsSection video={video} />
    </div>
  )
}
```

**Why this works:**
- ✅ Additive change (doesn't break existing UI)
- ✅ Category and labels coexist
- ✅ Can remove labels later if not needed
- ✅ User sees both concepts during transition

---

## Integration Sequence

### Phase 1: Backend Foundation (No UI changes)

1. ✅ Add database columns (migration)
2. ✅ Update models (BookmarkList, Tag)
3. ✅ Update Pydantic schemas
4. ✅ Add is_video_type to API responses
5. ✅ Add validation to video tag assignment
6. ✅ Create backup service
7. ✅ Create field aggregation service
8. ✅ Write backend tests

**At this point:** API accepts is_video_type but UI doesn't use it yet

---

### Phase 2: Frontend Types (No UI changes)

1. ✅ Update TypeScript types (Tag, BookmarkList)
2. ✅ Update Zod schemas
3. ✅ Add useCategories() / useLabels() hooks
4. ✅ Add category-specific hooks (useSetVideoCategory)

**At this point:** Types ready, hooks available, UI unchanged

---

### Phase 3: Settings UI (First visible change)

1. ✅ Add WorkspaceFieldsCard component
2. ✅ Update SettingsPage to show "Kategorien" tab
3. ✅ Filter TagsList to categories only
4. ✅ Add "Alle Videos" special item
5. ✅ Update EditTagDialog for categories

**At this point:** Settings shows new structure, videos unchanged

---

### Phase 4: Video Detail UI (Complete integration)

1. ✅ Add CategorySelector component
2. ✅ Add CategoryChangeWarning dialog
3. ✅ Update VideoDetailsPage with category selector
4. ✅ Update VideoDetailsModal
5. ✅ Update field display logic

**At this point:** Full feature complete

---

## Rollback Strategy

Each phase is independently deployable:

**Rollback from Phase 4:**
- Remove category selector from UI
- Videos still work with tags

**Rollback from Phase 3:**
- Revert SettingsPage changes
- Tags tab works as before

**Rollback from Phase 2:**
- Remove new hooks (unused)
- Types revert to old schema

**Rollback from Phase 1:**
- Revert migration (drop columns)
- Remove backend validation
- API works as before

---

## Interface Boundaries

### Backend

**Clean interfaces:**

```python
# Service interfaces
class FieldValueBackupService:
    async def backup(video_id, category_id) -> Path
    async def restore(video_id, category_id) -> int
    async def list_backups(video_id) -> List[BackupInfo]

class FieldAggregationService:
    async def get_available_fields(video) -> List[CustomField]
    async def validate_field_name_conflict(list_id, name, schema_id) -> bool
```

**API contracts:**
```python
# Request/Response schemas
class SetCategoryRequest(BaseModel):
    category_id: Optional[UUID]

class SetCategoryResponse(BaseModel):
    backup_created: bool
    backup_available: bool
    available_fields: List[CustomFieldResponse]
```

---

### Frontend

**Clean interfaces:**

```typescript
// Hook interfaces
interface UseSetVideoCategoryResult {
  mutate: (params: SetCategoryParams) => void
  isLoading: boolean
  error: Error | null
}

interface SetCategoryParams {
  videoId: string
  categoryId: string | null
}

// Component props
interface CategorySelectorProps {
  videoId: string
  currentCategory: Category | null
  onCategoryChange?: (category: Category | null) => void
}
```

---

## Testing Integration

### Unit Tests: Isolated

**Backend services tested independently:**
```python
# test_field_value_backup.py
def test_backup_creates_file():
    # No DB needed, mock file system

# test_field_aggregation.py
def test_deduplication():
    # Mock video and schemas
```

---

### Integration Tests: Minimal Setup

**Use existing test fixtures:**
```python
# test_category_validation.py
async def test_max_one_category(test_db, test_user, test_list):
    # Reuse existing fixtures
    tag1 = await create_tag(is_video_type=True)
    tag2 = await create_tag(is_video_type=True)

    # Should fail
    with pytest.raises(HTTPException):
        await assign_tags_to_video(video_id, [tag1.id, tag2.id])
```

---

## Summary: Integration Principles

| Principle | Application |
|-----------|-------------|
| **Extension over modification** | Add fields, don't change existing ones |
| **Semantic interpretation** | is_video_type changes meaning, not structure |
| **Validation layers** | Add validation before existing logic |
| **Service isolation** | New services don't touch existing code |
| **Progressive UI enhancement** | Add features without removing old ones |
| **Phased deployment** | Each phase independently deployable |
| **Clear interfaces** | Services have explicit contracts |
| **Backward compatibility** | Old code keeps working |

---

## Risk Mitigation

### Risk: Field name conflicts

**Mitigation:**
- Validation at creation time (backend)
- Clear error message (frontend)
- Check against both default_schema and all category schemas

### Risk: Backup system failure

**Mitigation:**
- Graceful degradation (feature works without backups)
- File-based (simple, reliable)
- Comprehensive error handling

### Risk: Multiple categories slip through

**Mitigation:**
- Backend validation (primary defense)
- Frontend validation (UX improvement)
- Database constraint (future: unique index on video_tags where is_video_type)

### Risk: UI confusion during transition

**Mitigation:**
- Phased rollout (settings first, then video detail)
- Both old and new concepts visible initially
- Clear labeling ("Kategorie" vs "Labels")

---

## Next Phase

✅ Ready for Phase 5: Backward Compatibility
- Ensure existing data still works
- Migration strategy for existing tags
- API versioning considerations
