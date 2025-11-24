# Codebase Analysis: Tag Management & UI Structure

**Feature ID:** FE-001-tag-management-ui
**Phase:** 2 - Codebase Analysis
**Date:** 2025-11-18

---

## Executive Summary

The Smart YouTube Bookmarks application has a well-architected tag system with:
- ✅ Complete backend CRUD operations (POST, GET, PUT, DELETE)
- ✅ Optional schema binding for custom fields
- ✅ Tag filtering UI in sidebar
- ✅ Tag creation dialog
- ❌ **Missing:** Centralized tag management UI
- ❌ **Missing:** Edit/delete dialogs

**Stack:** FastAPI backend, React 18 + TypeScript frontend, PostgreSQL, Redis, TanStack Query, Zustand, Radix UI + Tailwind CSS

---

## 1. Backend Tag Implementation

### Tag Model (`backend/app/models/tag.py`)

```python
class Tag(BaseModel):
    __tablename__ = 'tags'

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)  # Hex color
    user_id: Mapped[PyUUID] = mapped_column(UUID, ForeignKey('users.id', ondelete='CASCADE'))

    # Optional schema binding
    schema_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID,
        ForeignKey("field_schemas.id", ondelete="SET NULL"),
        nullable=True
    )
```

**Key Features:**
- Tags can optionally bind to a FieldSchema (custom fields)
- When bound, videos with that tag inherit the schema's custom fields
- Color stored as hex codes (e.g., `#FF0000`)
- Max name length: 100 characters

### Database Relationships

**Tag ↔ Video (Many-to-Many via `video_tags` junction table):**
- Tag deleted → Video-tag associations CASCADE deleted (videos survive)
- Video deleted → Video-tag associations CASCADE deleted (tags survive)

**Tag → FieldSchema (Many-to-One, Optional):**
- Schema deleted → Tag.schema_id SET NULL (tag survives, loses custom fields)
- Relationship uses `lazy='raise'` to prevent N+1 queries

### API Endpoints (`backend/app/api/tags.py`)

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/tags` | POST | Create new tag | ✅ Exists |
| `/api/tags` | GET | List all user tags | ✅ Exists |
| `/api/tags/{tag_id}` | GET | Get specific tag | ✅ Exists |
| `/api/tags/{tag_id}` | PUT | Update tag (name, color, schema) | ✅ Exists |
| `/api/tags/{tag_id}` | DELETE | Delete tag (cascades to video_tags) | ✅ Exists |

**Validation:**
- Tag names unique per user (case-insensitive)
- Schema binding validated (schema must exist and belong to user's lists)
- Color must match hex pattern `^#[0-9A-Fa-f]{6}$`

**Security Note:** Currently uses test authentication. Production requires JWT.

---

## 2. Frontend Tag Implementation

### Tag Display & Creation

**Components:**
- `TagNavigation.tsx` - Sidebar tag filtering (multi-select with OR logic)
- `CreateTagDialog.tsx` - Modal for creating tags with name, color, schema selection

**Current Location in VideosPage:**
```
┌─────────────────────────────────────────────────┐
│ CollapsibleSidebar  │  Main Content Area        │
│ ┌─────────────────┐ │  ┌──────────────────────┐ │
│ │ TagNavigation   │ │  │ Header + Title       │ │
│ │ - Python        │ │  │ ┌──────────────────┐ │ │
│ │ - Tutorial ✓    │ │  │ │ Controls Bar     │ │ │
│ │ + Create Tag    │ │  │ │ [Settings] [View]│ │ │  ← Settings button HERE
│ └─────────────────┘ │  │ └──────────────────┘ │ │
│                     │  │ FilterBar            │ │  ← Add Filter button HERE
│                     │  │ Video Grid           │ │
│                     │  └──────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Settings Button Location

**File:** `frontend/src/components/VideosPage.tsx` (line ~779-787)

```tsx
<div className="flex gap-1 items-center flex-shrink-0 ml-auto">
  <Button
    variant="outline"
    size="sm"
    onClick={() => navigate('/settings/schemas')}
  >
    <Settings className="h-4 w-4 mr-2" />
    Settings
  </Button>
  <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />
  <TableSettingsDropdown />
</div>
```

**Position:** Right side of controls bar, above video grid

### Add Filter Button Location

**File:** `frontend/src/components/videos/FilterBar.tsx`

**Features:**
- Separate component below controls bar
- Displays active filters as badges
- "Add Filter" button opens command palette popover
- "Clear all filters" button

### SettingsPage Structure

**File:** `frontend/src/pages/SettingsPage.tsx`
**Route:** `/settings/schemas`

**Current Tabs:**
1. **Schemas** - Manage field schema templates
2. **Fields** - Manage custom field definitions
3. **Analytics** - View usage statistics
4. **Tags** - ❌ MISSING (opportunity!)

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="schemas">Schemas</TabsTrigger>
    <TabsTrigger value="fields">Fields</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    {/* Need to add "tags" tab here */}
  </TabsList>

  <TabsContent value="schemas">
    <SchemasList schemas={schemas} listId={listId} />
  </TabsContent>
  {/* ... */}
</Tabs>
```

---

## 3. UI Framework & Patterns

### Tech Stack

- **Framework:** React 18.2.0 + TypeScript 5.3.3
- **Components:** Radix UI primitives (Dialog, AlertDialog, Tabs, Dropdown, etc.)
- **Styling:** Tailwind CSS 3.4.1
- **Icons:** Lucide React 0.552.0
- **Router:** React Router DOM 6.21.3

### Common Patterns

**Modal Pattern (AlertDialog):**
```tsx
<AlertDialog open={open} onOpenChange={onOpenChange}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Title</AlertDialogTitle>
    </AlertDialogHeader>
    <form onSubmit={handleSubmit}>{/* fields */}</form>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <Button type="submit">Confirm</Button>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Tab Pattern:**
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">{/* Content */}</TabsContent>
</Tabs>
```

**List Component Pattern (from FieldsList, SchemasList):**
- Table or card layout
- Action buttons per row (Edit, Delete)
- Loading/error states
- Empty state messages

---

## 4. State Management & Data Fetching

### State Management: Zustand 4.5.0

**Tag Filter Store:** `frontend/src/stores/tagStore.ts`
```tsx
export const useTagStore = create<TagStore>()(
  persist(
    (set) => ({
      tags: [],
      selectedTagIds: [],
      toggleTag: (tagId) => { /* ... */ },
      clearTags: () => { /* ... */ },
    }),
    {
      name: 'tag-filter-selection',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

### Data Fetching: TanStack Query 5.17.19

**Query Pattern:**
```tsx
// hooks/useTags.ts
export function tagsOptions() {
  return queryOptions({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get<Tag[]>('/tags')
      return TagsSchema.parse(data)  // Zod validation
    },
  })
}

export const useTags = () => useQuery(tagsOptions())
```

**Mutation Pattern:**
```tsx
export const useCreateTag = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['createTag'],
    mutationFn: async (tagData: TagCreate) => {
      const { data } = await api.post<Tag>('/tags', tagData)
      return TagSchema.parse(data)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}
```

### Form Handling: React Hook Form 7.66.0 + Zod

```tsx
const form = useForm<TagFormData>({
  resolver: zodResolver(TagFormSchema),
  defaultValues: { name: '', color: '#3B82F6' },
})
```

---

## 5. Existing Components to Reuse

### UI Components (`frontend/src/components/ui/`)
- `Button`, `Badge` - Actions and visual tags
- `Dialog`, `AlertDialog` - Modals
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` - Tab navigation
- `DropdownMenu` - Action menus
- `Input`, `Label` - Form fields
- `Table`, `TableHeader`, `TableRow`, `TableCell` - Data tables

### Existing Hooks (`frontend/src/hooks/`)
- `useTags()` - ✅ Fetch all tags
- `useCreateTag()` - ✅ Create tag
- `useSchemas()` - ✅ Fetch schemas for selector
- `useUpdateTag()` - ❌ MISSING (need to create)
- `useDeleteTag()` - ❌ MISSING (need to create)

---

## 6. Missing Features (Implementation Opportunities)

### Backend
✅ All CRUD endpoints exist - **No backend changes needed!**

**Optional Enhancement:**
- Add `video_count` to `GET /api/tags` response for statistics display

### Frontend

1. **Tag Edit Dialog** (`EditTagDialog.tsx`)
   - Reuse form structure from `CreateTagDialog`
   - Allow updating name, color, schema_id
   - Validation: prevent duplicate names

2. **Tag Delete Confirmation** (`ConfirmDeleteTagDialog.tsx`)
   - Show warning with video count
   - Confirm/cancel actions

3. **Tags List Component** (`TagsList.tsx`)
   - Table layout showing: name, color badge, schema, video count
   - Actions: Edit, Delete buttons per row
   - Follow pattern from `FieldsList.tsx`

4. **Mutation Hooks** (`hooks/useTags.ts`)
   - `useUpdateTag()` - Update tag
   - `useDeleteTag()` - Delete tag
   - Both should invalidate queries on success

5. **Settings Page Integration** (`SettingsPage.tsx`)
   - Add "Tags" tab to TabsList
   - Add TabsContent for tags with TagsList component

6. **Tag Merge Functionality** (Future enhancement)
   - Dialog to select tags to merge
   - Choose target tag or create new name
   - Handle schema conflicts

---

## 7. File Organization Conventions

```
frontend/src/
├── components/
│   ├── ui/               # Radix UI primitives
│   ├── settings/         # Settings page components
│   │   ├── FieldsList.tsx
│   │   ├── SchemasList.tsx
│   │   └── TagsList.tsx  # ← NEW
│   ├── CreateTagDialog.tsx
│   ├── EditTagDialog.tsx # ← NEW
│   └── ConfirmDeleteTagDialog.tsx # ← NEW
├── hooks/
│   └── useTags.ts        # ← ADD useUpdateTag, useDeleteTag
├── pages/
│   └── SettingsPage.tsx  # ← ADD Tags tab
└── types/
    └── tag.ts
```

**Naming Conventions:**
- Components: PascalCase (`TagsList.tsx`)
- Hooks: camelCase with `use` prefix (`useUpdateTag`)
- Types: PascalCase (`Tag`, `TagUpdate`)

---

## 8. Key Technical Constraints

1. **Authentication:** Currently test mode, production needs JWT
2. **Performance:** Tag filtering uses PostgreSQL indexes (performant)
3. **Data Integrity:** Cascade deletes, unique constraints, SET NULL on schema delete
4. **Accessibility:** Radix UI provides ARIA-compliant primitives

---

## 9. Architectural Insights

### Why TagResponse excludes nested schema
```python
# backend/app/schemas/tag.py
class TagResponse(TagBase):
    schema_id: UUID | None = None
    # NO nested schema object to avoid lazy-loading errors
```

### Why lazy='raise' on Tag.schema relationship
```python
schema: Mapped[Optional["FieldSchema"]] = relationship(
    "FieldSchema",
    lazy='raise'  # Prevents N+1 queries, forces explicit eager loading
)
```

### Multi-Tag Field Union
- If video has multiple tags with different schemas
- Available fields = UNION of all fields from all tag schemas
- Location: `backend/app/api/helpers/field_union.py`

---

## 10. Reference Files

**Backend:**
- Model: `backend/app/models/tag.py`
- API: `backend/app/api/tags.py`
- Schemas: `backend/app/schemas/tag.py`

**Frontend:**
- Types: `frontend/src/types/tag.ts`
- Hooks: `frontend/src/hooks/useTags.ts`
- Create Dialog: `frontend/src/components/CreateTagDialog.tsx`
- Settings Page: `frontend/src/pages/SettingsPage.tsx`
- Fields List (pattern): `frontend/src/components/settings/FieldsList.tsx`

---

**Next Phase:** Impact Assessment - Identify all files that need changes for tag management feature
