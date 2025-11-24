# User Story 01: View All Tags

**Feature ID:** FE-001-tag-management-ui
**Story ID:** US-01
**Priority:** Must Have
**Status:** Planned

---

## Story

**As a** user managing my YouTube bookmarks
**I want to** view all my tags in one centralized location
**So that** I can see what tags I have and understand my organization system

---

## Acceptance Criteria

### ✅ AC1: Tags Tab Exists in Settings
- **Given** I navigate to Settings page
- **When** I view the tab navigation
- **Then** I see a "Tags" tab alongside "Schemas", "Fields", and "Analytics"

### ✅ AC2: Tags List Displays All Tags
- **Given** I click on the "Tags" tab
- **When** the tab content loads
- **Then** I see a table/list showing all my tags

### ✅ AC3: Tags Display Essential Information
- **Given** I'm viewing the tags list
- **Then** each tag shows:
  - Tag name
  - Color (as colored badge)
  - Schema name (if bound, or "No Schema")
  - Number of videos using this tag
  - Actions menu (⋮)

### ✅ AC4: Empty State
- **Given** I have no tags created
- **When** I view the Tags tab
- **Then** I see a message "No tags yet. Create your first tag from the sidebar."

### ✅ AC5: Loading State
- **Given** Tags are being fetched from API
- **When** I view the Tags tab
- **Then** I see a loading indicator

---

## UX Flow

```
1. User clicks Settings button (sidebar)
   ↓
2. SettingsPage opens with tabs
   ↓
3. User clicks "Tags" tab
   ↓
4. Loading state appears
   ↓
5. TagsList renders with all tags
   ↓
6. User scrolls through tags
   ↓
7. Result: User sees overview of all tags
```

---

## UI Mockup (Text)

```
┌─────────────────────────────────────────────────────────┐
│ Settings                                                 │
├─────────────────────────────────────────────────────────┤
│ [Schemas] [Fields] [Tags] [Analytics]                   │ ← Active: Tags
├─────────────────────────────────────────────────────────┤
│ Tags                                                     │
│ Manage your tags and their schemas                      │
│                                                          │
│ ┌────────┬───────┬────────────┬────────┬──────────────┐ │
│ │ Name   │ Color │ Schema     │ Videos │ Actions      │ │
│ ├────────┼───────┼────────────┼────────┼──────────────┤ │
│ │ Python │ 🔵    │ Tech       │ 15     │ [⋮]          │ │
│ │ Tutorial│ 🟢   │ Learning   │ 23     │ [⋮]          │ │
│ │ Music  │ 🔴    │ No Schema  │ 8      │ [⋮]          │ │
│ └────────┴───────┴────────────┴────────┴──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Edge Cases

### Edge Case 1: Very Long Tag Name
- **Scenario:** Tag name is 100 characters (max length)
- **Expected:** Tag name truncates with "..." and shows full name on hover

### Edge Case 2: No Schema Binding
- **Scenario:** Tag has `schema_id = null`
- **Expected:** Schema column shows "No Schema" in muted text

### Edge Case 3: Schema Deleted
- **Scenario:** Tag's schema was deleted (ON DELETE SET NULL)
- **Expected:** Schema column shows "No Schema" (schema_id is now null)

### Edge Case 4: Zero Videos
- **Scenario:** Tag exists but not assigned to any videos
- **Expected:** Videos column shows "0"

---

## Technical Notes

**API Endpoint:**
```
GET /api/tags
Response: Tag[]
[
  {
    "id": "uuid",
    "name": "Python",
    "color": "#3B82F6",
    "schema_id": "uuid-or-null",
    "user_id": "uuid",
    "created_at": "2025-11-18T10:00:00Z",
    "updated_at": "2025-11-18T10:00:00Z"
  }
]
```

**Optional Enhancement:** Add `video_count` to response
```json
{
  "id": "uuid",
  "name": "Python",
  "video_count": 15  // NEW
}
```

---

## Dependencies

- ✅ `useTags()` hook (already exists)
- ✅ `GET /api/tags` endpoint (already exists)
- ✅ SettingsPage component (already exists)
- ⚠️ TagsList component (needs to be created)

---

## Testing Scenarios

### Test 1: Render Tags List
```tsx
it('renders all tags in table', () => {
  const tags = [
    { id: '1', name: 'Python', color: '#3B82F6', schema_id: 'schema-1' },
    { id: '2', name: 'Tutorial', color: '#10B981', schema_id: null },
  ]
  render(<TagsList tags={tags} />)
  expect(screen.getByText('Python')).toBeInTheDocument()
  expect(screen.getByText('Tutorial')).toBeInTheDocument()
})
```

### Test 2: Empty State
```tsx
it('shows empty state when no tags', () => {
  render(<TagsList tags={[]} />)
  expect(screen.getByText(/no tags yet/i)).toBeInTheDocument()
})
```

### Test 3: Loading State
```tsx
it('shows loading indicator while fetching', () => {
  render(<TagsList tags={[]} isLoading={true} />)
  expect(screen.getByRole('status')).toBeInTheDocument()
})
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large number of tags (>1000) | Low | Medium | Implement virtualization if needed |
| Schema fetch fails | Low | Low | Show "Unknown" instead of schema name |
| Slow API response | Medium | Low | Show loading state, timeout after 10s |

---

## Definition of Done

- [ ] Tags tab exists in SettingsPage
- [ ] TagsList component renders all tags
- [ ] Table shows name, color, schema, video count
- [ ] Empty state renders when no tags
- [ ] Loading state renders while fetching
- [ ] Component tests pass (>90% coverage)
- [ ] Integration test passes (tab click → tags render)
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: screen reader announces tag count

---

**Related Stories:**
- US-02: Edit Tag Name and Color
- US-03: Delete Tag
- US-04: Edit Tag Schema Binding
