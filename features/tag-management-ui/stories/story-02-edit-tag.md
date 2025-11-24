# User Story 02: Edit Tag Name, Color, and Schema

**Feature ID:** FE-001-tag-management-ui
**Story ID:** US-02
**Priority:** Must Have
**Status:** Planned

---

## Story

**As a** user managing my YouTube bookmarks
**I want to** edit a tag's name, color, and schema binding
**So that** I can fix typos, reorganize my tags, and update their custom fields

---

## Acceptance Criteria

### ✅ AC1: Edit Button Exists
- **Given** I'm viewing the Tags list in Settings
- **When** I click the actions menu (⋮) for any tag
- **Then** I see an "Edit" option in the dropdown

### ✅ AC2: Edit Dialog Opens
- **Given** I click "Edit" on a tag
- **When** the edit dialog opens
- **Then** I see a form pre-filled with:
  - Current tag name
  - Current tag color (color picker)
  - Current schema selection (dropdown with "No Schema" option)

### ✅ AC3: Edit Tag Name
- **Given** The edit dialog is open
- **When** I change the tag name and click "Save"
- **Then** The tag name updates in the list
  - The dialog closes
  - I see a success message "Tag updated"

### ✅ AC4: Edit Tag Color
- **Given** The edit dialog is open
- **When** I change the color and click "Save"
- **Then** The tag color updates in the list
  - The color updates in the sidebar (TagNavigation)
  - The color updates on VideoCards showing this tag

### ✅ AC5: Edit Schema Binding
- **Given** The edit dialog is open
- **When** I change the schema and click "Save"
- **Then** The tag's schema binding updates
  - Videos with this tag now have the new schema's custom fields

### ✅ AC6: Unbind Schema
- **Given** A tag currently has a schema bound
- **When** I select "No Schema" and click "Save"
- **Then** The tag's schema_id becomes null
  - Videos with this tag lose the custom fields
  - Video field values are preserved (not deleted)

### ✅ AC7: Validation - Name Required
- **Given** The edit dialog is open
- **When** I clear the name field and try to save
- **Then** I see an error "Tag name is required"
  - The dialog stays open

### ✅ AC8: Validation - Duplicate Name
- **Given** The edit dialog is open
- **When** I enter a name that already exists (case-insensitive)
- **Then** I see an error "Tag name already exists"
  - The dialog stays open

### ✅ AC9: Cancel Editing
- **Given** The edit dialog is open with changes
- **When** I click "Cancel"
- **Then** The dialog closes
  - Changes are discarded
  - Tag remains unchanged

---

## UX Flow

```
1. User views TagsList
   ↓
2. User clicks actions menu (⋮) on "Python" tag
   ↓
3. Dropdown shows: [Edit] [Delete] [Merge]
   ↓
4. User clicks "Edit"
   ↓
5. EditTagDialog opens with form pre-filled:
   - Name: "Python"
   - Color: #3B82F6 (blue)
   - Schema: "Tech"
   ↓
6. User changes:
   - Name: "Python Tutorials"
   - Color: #10B981 (green)
   - Schema: "Learning"
   ↓
7. User clicks "Save"
   ↓
8. API call: PUT /api/tags/{id} { name, color, schema_id }
   ↓
9. Success: Dialog closes, list updates, toast shows "Tag updated"
   ↓
10. Result: Tag renamed, recolored, schema changed
```

---

## UI Mockup (Text)

```
┌─────────────────────────────────────────────────┐
│ Edit Tag                                    [×] │
├─────────────────────────────────────────────────┤
│                                                 │
│ Name *                                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ Python Tutorials                            │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Color                                           │
│ ┌─────┐                                         │
│ │ 🟢  │ #10B981                                 │
│ └─────┘                                         │
│                                                 │
│ Schema (optional)                               │
│ ┌─────────────────────────────────────────────┐ │
│ │ Learning                              [▼]   │ │
│ └─────────────────────────────────────────────┘ │
│   Options: No Schema, Tech, Learning, Music    │
│                                                 │
│                            [Cancel]  [Save]     │
└─────────────────────────────────────────────────┘
```

---

## Edge Cases

### Edge Case 1: Schema Deleted After Dialog Opens
- **Scenario:** User opens edit dialog, another user deletes the schema
- **When:** User tries to save
- **Expected:** Error "Selected schema no longer exists", suggest selecting different schema

### Edge Case 2: Tag Name Becomes 100 Characters
- **Scenario:** User enters max length name
- **Expected:** Input accepts up to 100 chars, shows character count "100/100"

### Edge Case 3: Color Picker Invalid Hex
- **Scenario:** User manually types invalid hex (e.g., "#ZZZ")
- **Expected:** Color picker validates and shows error "Invalid color format"

### Edge Case 4: Network Error During Save
- **Scenario:** API request fails (network error, 500 error)
- **Expected:** Dialog stays open, error message shows, user can retry

### Edge Case 5: Concurrent Edit Conflict
- **Scenario:** Two users edit same tag simultaneously
- **Expected:** Last write wins (no conflict detection in MVP)
- **Future:** Implement optimistic locking with `updated_at` check

---

## Technical Notes

**API Endpoint:**
```json
PUT /api/tags/{tag_id}
Request Body:
{
  "name": "Python Tutorials",
  "color": "#10B981",
  "schema_id": "uuid-or-null"
}

Response: 200 OK
{
  "id": "uuid",
  "name": "Python Tutorials",
  "color": "#10B981",
  "schema_id": "uuid",
  ...
}
```

**React Hook Form:**
```tsx
const form = useForm<TagFormData>({
  resolver: zodResolver(TagFormSchema),
  defaultValues: {
    name: tag.name,
    color: tag.color || '#3B82F6',
    schema_id: tag.schema_id || null,
  },
})
```

**Mutation Hook:**
```tsx
const updateTag = useUpdateTag()
updateTag.mutate({ tagId: tag.id, data: { name, color, schema_id } })
```

---

## Dependencies

- ⚠️ `useUpdateTag()` hook (needs to be created)
- ⚠️ EditTagDialog component (needs to be created)
- ✅ `PUT /api/tags/{id}` endpoint (already exists)
- ✅ `useSchemas()` hook (already exists, for schema dropdown)
- ✅ CreateTagDialog component (reference for form structure)

---

## Testing Scenarios

### Test 1: Pre-fill Form
```tsx
it('pre-fills form with tag data', () => {
  const tag = { id: '1', name: 'Python', color: '#3B82F6', schema_id: 'schema-1' }
  render(<EditTagDialog tag={tag} open={true} />)
  expect(screen.getByDisplayValue('Python')).toBeInTheDocument()
  expect(screen.getByDisplayValue('#3B82F6')).toBeInTheDocument()
})
```

### Test 2: Update Tag Name
```tsx
it('updates tag name on submit', async () => {
  const updateTag = jest.fn()
  render(<EditTagDialog tag={tag} open={true} />)

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Name' } })
  fireEvent.click(screen.getByText('Save'))

  await waitFor(() => {
    expect(updateTag).toHaveBeenCalledWith({
      tagId: '1',
      data: { name: 'New Name', color: '#3B82F6', schema_id: 'schema-1' }
    })
  })
})
```

### Test 3: Validation - Name Required
```tsx
it('shows error when name is empty', async () => {
  render(<EditTagDialog tag={tag} open={true} />)

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } })
  fireEvent.click(screen.getByText('Save'))

  expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
})
```

### Test 4: Validation - Duplicate Name
```tsx
it('shows error when name already exists', async () => {
  // Mock API to return 409 Conflict
  server.use(
    rest.put('/api/tags/:id', (req, res, ctx) => {
      return res(ctx.status(409), ctx.json({ detail: 'Tag name already exists' }))
    })
  )

  render(<EditTagDialog tag={tag} open={true} />)

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Existing Tag' } })
  fireEvent.click(screen.getByText('Save'))

  expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
})
```

### Test 5: Update Tag Color (AC4)
```tsx
it('updates tag color and propagates to UI consumers', async () => {
  const tag = { id: '1', name: 'Python', color: '#3B82F6', schema_id: 'schema-1' }
  const updateTag = jest.fn()
  render(<EditTagDialog tag={tag} open={true} onUpdate={updateTag} />)

  // Change color input
  const colorInput = screen.getByLabelText('Color')
  fireEvent.change(colorInput, { target: { value: '#10B981' } })
  fireEvent.click(screen.getByText('Save'))

  await waitFor(() => {
    expect(updateTag).toHaveBeenCalledWith({
      tagId: '1',
      data: { name: 'Python', color: '#10B981', schema_id: 'schema-1' }
    })
  })
})
```

### Test 6: Update Schema Binding (AC5)
```tsx
it('updates schema binding when selecting a different schema', async () => {
  const tag = { id: '1', name: 'Python', color: '#3B82F6', schema_id: 'schema-1' }
  const updateTag = jest.fn()
  render(<EditTagDialog tag={tag} open={true} onUpdate={updateTag} />)

  // Open schema dropdown and select different schema
  const schemaSelect = screen.getByLabelText('Schema')
  fireEvent.mouseDown(schemaSelect)
  const newSchemaOption = await screen.findByText('Tutorial Schema')
  fireEvent.click(newSchemaOption)
  fireEvent.click(screen.getByText('Save'))

  await waitFor(() => {
    expect(updateTag).toHaveBeenCalledWith({
      tagId: '1',
      data: { name: 'Python', color: '#3B82F6', schema_id: 'schema-2' }
    })
  })
})
```

### Test 7: Unbind Schema (AC6)
```tsx
it('sets schema_id to null when selecting "No Schema"', async () => {
  const tag = { id: '1', name: 'Python', color: '#3B82F6', schema_id: 'schema-1' }
  const updateTag = jest.fn()
  render(<EditTagDialog tag={tag} open={true} onUpdate={updateTag} />)

  // Open schema dropdown and select "No Schema"
  const schemaSelect = screen.getByLabelText('Schema')
  fireEvent.mouseDown(schemaSelect)
  const noSchemaOption = await screen.findByText('No Schema')
  fireEvent.click(noSchemaOption)
  fireEvent.click(screen.getByText('Save'))

  await waitFor(() => {
    expect(updateTag).toHaveBeenCalledWith({
      tagId: '1',
      data: { name: 'Python', color: '#3B82F6', schema_id: null }
    })
  })
})
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Renaming breaks video associations | None | Critical | Tags linked by ID, not name - safe to rename |
| Schema change affects many videos | Medium | Medium | Show warning "X videos will be affected" (future enhancement) |
| Color change doesn't update UI | Low | Low | Invalidate tags query to refresh all components |
| Duplicate name validation fails | Low | Medium | Validate client-side AND server-side |

---

## Definition of Done

- [ ] EditTagDialog component created
- [ ] useUpdateTag() hook created
- [ ] Edit button in TagsList actions menu
- [ ] Dialog pre-fills form with tag data
- [ ] Can update name, color, schema_id
- [ ] Validation: name required, no duplicates
- [ ] Success toast shows on save
- [ ] Error toast shows on failure
- [ ] Dialog closes on save success
- [ ] Tags list refreshes after save
- [ ] Component tests pass (>90% coverage)
- [ ] Integration test: edit tag → list updates
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: focus management (dialog → first input)

---

**Related Stories:**
- US-01: View All Tags
- US-03: Delete Tag
- US-04: Edit Tag Schema Binding (covered here)
