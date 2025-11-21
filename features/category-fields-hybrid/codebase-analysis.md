# Codebase Analysis: Smart Youtube Bookmarks

**Feature ID:** category-fields-hybrid
**Date:** 2025-11-20
**Phase:** 2 - Codebase Analysis

---

## Architecture Overview

### Tech Stack

**Backend:**
- FastAPI (Python async framework)
- SQLAlchemy 2.0 (async ORM)
- PostgreSQL (with UUID primary keys)
- Alembic migrations

**Frontend:**
- React 18 + TypeScript
- TanStack Query (React Query) for data fetching
- TanStack Router for routing
- shadcn/ui + Tailwind CSS
- Zod for validation

---

## Backend Architecture

### Database Models

#### 1. BookmarkList (`backend/app/models/list.py`)

```python
class BookmarkList(BaseModel):
    __tablename__ = "bookmarks_lists"

    name: Mapped[str]
    description: Mapped[Optional[str]]
    user_id: Mapped[PyUUID]  # FK to users.id (CASCADE)
    schema_id: Mapped[Optional[PyUUID]]  # FK to schemas.id (SET NULL) - OLD SCHEMA SYSTEM

    # Relationships
    user: Mapped["User"]
    videos: Mapped[list["Video"]] (CASCADE delete)
    custom_fields: Mapped[list["CustomField"]] (CASCADE delete)
    field_schemas: Mapped[list["FieldSchema"]] (CASCADE delete)
```

**Key Insight:**
- `schema_id` is for the OLD extraction schema system (not custom fields)
- Need to add `default_schema_id` → FieldSchema for workspace-wide fields

---

#### 2. Tag (`backend/app/models/tag.py`)

```python
class Tag(BaseModel):
    __tablename__ = 'tags'

    name: Mapped[str]
    color: Mapped[Optional[str]]  # Hex color
    user_id: Mapped[PyUUID]  # FK to users.id (CASCADE)
    schema_id: Mapped[Optional[PyUUID]]  # FK to field_schemas.id (SET NULL)

    # Relationships
    videos: Mapped[list["Video"]]  # M:N via video_tags junction table
    schema: Mapped[Optional["FieldSchema"]]
```

**Junction Table:**
```python
video_tags = Table(
    'video_tags',
    Column('id', UUID, primary_key=True),
    Column('video_id', UUID, FK('videos.id', ondelete='CASCADE')),
    Column('tag_id', UUID, FK('tags.id', ondelete='CASCADE')),
    UniqueConstraint('video_id', 'tag_id')
)
```

**Key Insights:**
- Currently M:N relationship (video can have multiple tags)
- Need to add `is_video_type: bool` to distinguish categories from labels
- Keep junction table but semantically treat as 1:1 for categories

---

#### 3. Video (`backend/app/models/video.py`)

```python
class Video(BaseModel):
    __tablename__ = "videos"

    list_id: Mapped[UUID]  # FK to bookmarks_lists.id (CASCADE)
    youtube_id: Mapped[str]
    title: Mapped[Optional[str]]
    channel: Mapped[Optional[str]]
    duration: Mapped[Optional[int]]
    published_at: Mapped[Optional[datetime]]
    thumbnail_url: Mapped[Optional[str]]

    # Relationships
    tags: Mapped[list["Tag"]]  # M:N via video_tags
    field_values: Mapped[list["VideoFieldValue"]] (CASCADE delete)
```

**Key Insights:**
- No direct category field yet
- Will add `category_id` or use video_tags with business logic
- Decision: Keep M:N table, enforce 1 category via validation

---

#### 4. FieldSchema (`backend/app/models/field_schema.py`)

```python
class FieldSchema(BaseModel):
    __tablename__ = "field_schemas"

    list_id: Mapped[PyUUID]  # FK to bookmarks_lists.id (CASCADE)
    name: Mapped[str]
    description: Mapped[Optional[str]]

    # Relationships
    schema_fields: Mapped[list["SchemaField"]]  # M:N to CustomFields
    tags: Mapped[list["Tag"]]  # Tags using this schema
```

**Key Insights:**
- FieldSchema is the "container" for grouped CustomFields
- Currently only bound to Tags
- Need to also allow binding to BookmarkList (for workspace-wide fields)

---

#### 5. CustomField (`backend/app/models/custom_field.py`)

```python
class CustomField(BaseModel):
    __tablename__ = "custom_fields"

    list_id: Mapped[PyUUID]  # FK to bookmarks_lists.id (CASCADE)
    name: Mapped[str]
    field_type: Mapped[str]  # 'select', 'rating', 'text', 'boolean'
    config: Mapped[Dict[str, Any]]  # JSONB (e.g., {"max_rating": 5})

    # Relationships
    schema_fields: Mapped[list["SchemaField"]]  # M:N to FieldSchemas
    video_field_values: Mapped[list["VideoFieldValue"]] (CASCADE delete)
```

**Key Insights:**
- CustomFields are REUSABLE across multiple FieldSchemas
- One CustomField can be in multiple schemas
- Unique constraint: (list_id, name) - prevents duplicate field names in list

---

#### 6. SchemaField (Junction Table for Schema↔Field)

```python
class SchemaField(BaseModel):
    __tablename__ = "schema_fields"

    schema_id: Mapped[PyUUID]  # FK to field_schemas.id (CASCADE)
    field_id: Mapped[PyUUID]  # FK to custom_fields.id (CASCADE)
    display_order: Mapped[int]
```

**Key Insights:**
- Pure junction table with display_order
- Deleting FieldSchema removes all SchemaField entries (CASCADE)
- Deleting CustomField removes all SchemaField entries (CASCADE)

---

#### 7. VideoFieldValue (`backend/app/models/video_field_value.py`)

```python
class VideoFieldValue(BaseModel):
    __tablename__ = "video_field_values"

    video_id: Mapped[PyUUID]  # FK to videos.id (CASCADE)
    field_id: Mapped[PyUUID]  # FK to custom_fields.id (CASCADE)

    # Typed value columns (only one populated)
    value_text: Mapped[Optional[str]]
    value_numeric: Mapped[Optional[float]]
    value_boolean: Mapped[Optional[bool]]

    UniqueConstraint('video_id', 'field_id')
```

**Key Insights:**
- VideoFieldValue → CustomField (not FieldSchema or Tag)
- Values persist even when video's category changes
- No automatic cascade when tag is removed (orphan data issue)

---

## Backend API Endpoints

### Tags API (`backend/app/api/tags.py`)

```
POST   /api/tags              → Create tag
GET    /api/tags              → List all tags for user
GET    /api/tags/{id}         → Get single tag
PUT    /api/tags/{id}         → Update tag (including schema_id)
DELETE /api/tags/{id}         → Delete tag
```

**Key Insights:**
- PUT /api/tags/{id} with schema_id → bind tag to schema
- No validation preventing multiple tags per video
- Need to add validation for category logic

---

### Videos API (`backend/app/api/videos.py`)

```
POST   /api/videos/{video_id}/tags          → Assign tags to video
DELETE /api/videos/{video_id}/tags/{tag_id} → Remove tag from video (EXISTS!)
```

**Key Insights:**
- DELETE endpoint exists but NOT used by frontend
- Need frontend hook: `useRemoveTagFromVideo`
- For categories: use POST with single tag, or add dedicated category endpoint

---

## Frontend Architecture

### State Management Pattern

**TanStack Query for all server state:**
- Hooks in `frontend/src/hooks/`
- Query keys: `['tags']`, `['videos']`, `['schemas']`, `['customFields', listId]`
- Optimistic updates + invalidation pattern

---

### Tags Management

#### Hook: `useTags()` (`frontend/src/hooks/useTags.ts`)

```typescript
export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get<Tag[]>('/tags')
      return TagsSchema.parse(data)  // Zod validation
    }
  })
}
```

**Other hooks:**
- `useCreateTag()` - Create new tag
- `useUpdateTag()` - Update existing tag
- `useDeleteTag()` - Delete tag (invalidates both tags AND videos)
- `useBulkApplySchema()` - Bulk assign schema to tags

**Missing hooks:**
- ❌ `useRemoveTagFromVideo()` - Remove tag from specific video

---

### Settings Page (`frontend/src/pages/SettingsPage.tsx`)

**Current tabs:**
1. Schemas - List of FieldSchemas with create/edit/delete
2. Fields - List of CustomFields with create/edit/delete
3. Tags - List of Tags with create/edit/delete (Task 6)
4. Analytics - Usage statistics

**Components:**
- `SchemasList` - Shows schemas
- `FieldsList` - Shows custom fields
- `TagsList` - Shows tags with schema binding
- `EditTagDialog` - Edit tag (name, color, schema)
- `ConfirmDeleteTagDialog` - Delete tag with warnings

**Key Insights:**
- Settings is tabbed interface using shadcn/ui Tabs
- Fetches listId dynamically via `useLists()[0]`
- Each tab has create/edit/delete dialogs

---

### Video Detail UI

**Components:**
- `VideoDetailsPage` - Full page video detail
- `VideoDetailsModal` - Modal version for quick view

**Current Tag Display:**
- Tags shown as Badge components
- No interactivity (can't remove tags)
- No category selector

---

## Naming Conventions

### Backend

**Files:**
- Models: `backend/app/models/{entity}.py` (snake_case)
- API: `backend/app/api/{entity}s.py` (plural)
- Schemas: `backend/app/schemas/{entity}.py`

**Code Style:**
- Classes: PascalCase (`Tag`, `CustomField`)
- Functions: snake_case (`get_user_for_testing`)
- SQLAlchemy: mapped_column, relationship

### Frontend

**Files:**
- Pages: `frontend/src/pages/{Name}Page.tsx` (PascalCase)
- Components: `frontend/src/components/{Name}.tsx`
- Hooks: `frontend/src/hooks/use{Entity}.ts`

**Code Style:**
- Components: PascalCase (`TagsList`, `EditTagDialog`)
- Hooks: camelCase starting with `use` (`useTags`, `useCreateTag`)
- Props: camelCase interfaces (`TagsListProps`)

---

## Database Cascade Patterns

| Parent Deleted | Child | Behavior | Why |
|----------------|-------|----------|-----|
| BookmarkList | Video | CASCADE | Videos belong to list |
| BookmarkList | CustomField | CASCADE | Fields are list-scoped |
| BookmarkList | FieldSchema | CASCADE | Schemas are list-scoped |
| FieldSchema | SchemaField | CASCADE | Junction entry removed |
| CustomField | SchemaField | CASCADE | Junction entry removed |
| CustomField | VideoFieldValue | CASCADE | Values deleted with field |
| Video | VideoFieldValue | CASCADE | Values deleted with video |
| Tag (deleted) | Tag.schema_id | SET NULL | Schema survives |
| FieldSchema (deleted) | Tag.schema_id | SET NULL | Tag survives |
| Tag | video_tags | CASCADE | Junction entry removed |
| Video | video_tags | CASCADE | Junction entry removed |

**Important:** VideoFieldValue has NO relationship to Tag → orphan data when tag removed

---

## Testing Patterns

**Backend:**
- Integration tests: `backend/tests/integration/test_cascade_deletes.py`
- Tests cascade behavior with real DB
- Uses pytest async fixtures

**Frontend:**
- Component tests: `*.test.tsx` next to component
- Uses Vitest + React Testing Library
- Example: `TableSettingsDropdown.test.tsx`

---

## Migration System

**Alembic migrations:**
- Location: `backend/alembic/versions/`
- Naming: `{hash}_{description}.py`
- Pattern: auto-generated + manual edits

**Current latest:**
- Multiple migrations for CustomFields, FieldSchemas, VideoFieldValues

---

## Key Architecture Decisions

### 1. Reusable Fields

CustomFields are NOT tied to a specific FieldSchema. They can be reused across multiple schemas.

**Example:**
```
CustomField "Rating" (id=uuid-1)
  ├─ Used in FieldSchema "Video Quality"
  ├─ Used in FieldSchema "Tutorial Rating"
  └─ Used in FieldSchema "Recipe Rating"
```

### 2. M:N Junction Tables

- video_tags: M:N between Video and Tag
- schema_fields: M:N between FieldSchema and CustomField

Both use SQLAlchemy `Table()` (not Model) for performance.

### 3. Lazy Loading Strategy

- Most relationships: `lazy='raise'` → force explicit selectinload
- Prevents N+1 queries and MissingGreenlet errors
- Example: Tag.schema uses `lazy='raise'`

### 4. Passive Deletes

- Most CASCADE relationships use `passive_deletes=True`
- Trusts database CASCADE instead of ORM
- Performance optimization (no SELECT before DELETE)

---

## Patterns to Follow

### Backend API Pattern

```python
@router.post("", response_model=ResponseSchema, status_code=201)
async def create_entity(
    data: CreateSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_for_testing)
):
    entity = Entity(**data.dict(), user_id=user.id)
    db.add(entity)
    await db.commit()
    await db.refresh(entity)
    return entity
```

### Frontend Hook Pattern

```typescript
export const useCreateEntity = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: EntityCreate) => {
      const { data: response } = await api.post('/entities', data)
      return EntitySchema.parse(response)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['entities'] })
    }
  })
}
```

### Component Pattern (shadcn/ui Dialog)

```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>...</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit}>
      ...
    </form>
  </DialogContent>
</Dialog>
```

---

## Similar Features (Pattern Reference)

### Tags Tab (Task 6) - Most Similar!

**Location:** `SettingsPage.tsx` → Tags tab

**Features:**
- List tags with name, color, schema binding
- Create tag dialog
- Edit tag dialog (name, color, schema_id)
- Delete tag dialog with warnings
- Schema assignment dropdown

**This is the PERFECT reference for implementing category management!**

---

## File Organization

```
backend/
  app/
    models/       # SQLAlchemy models
    api/          # FastAPI routers
    schemas/      # Pydantic schemas (request/response)
    core/         # Config, database, utils
  tests/
    integration/  # Integration tests
    unit/         # Unit tests
  alembic/        # Database migrations

frontend/
  src/
    pages/        # Route pages
    components/   # Reusable components
      ui/         # shadcn/ui primitives
      settings/   # Settings-specific components
      schemas/    # Schema-specific components
    hooks/        # TanStack Query hooks
    types/        # TypeScript types
    lib/          # Utilities (api.ts, etc.)
```

---

## Dependencies

### Backend Key Libraries

- `fastapi` - Web framework
- `sqlalchemy[asyncio]` - ORM
- `asyncpg` - PostgreSQL driver
- `alembic` - Migrations
- `pydantic` - Validation

### Frontend Key Libraries

- `react` - UI framework
- `@tanstack/react-query` - Data fetching
- `@tanstack/react-router` - Routing
- `zod` - Runtime validation
- `shadcn/ui` - UI components (built on radix-ui)
- `tailwindcss` - Styling

---

## Summary

**Strengths:**
- ✅ Clean separation of concerns (models, API, hooks)
- ✅ Type-safe with TypeScript + Zod
- ✅ Consistent patterns (hooks, dialogs, queries)
- ✅ Reusable field system already built
- ✅ CASCADE behavior well-defined

**Challenges:**
- ⚠️ No UI for removing tags from videos (backend endpoint exists)
- ⚠️ No UI for removing fields from schemas
- ⚠️ Video→Tag is M:N, need to enforce 1 category
- ⚠️ VideoFieldValues can become orphaned
- ⚠️ No backup system for category changes

**Integration Points:**
- BookmarkList.default_schema_id (new field)
- Tag.is_video_type (new field)
- Category assignment UI in VideoDetailsPage
- Settings redesign for "Categories" instead of "Tags"
- Backup system for VideoFieldValue preservation
