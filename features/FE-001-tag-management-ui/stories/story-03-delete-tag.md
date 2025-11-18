# User Story 03: Delete Tag

**Feature ID:** FE-001-tag-management-ui
**Story ID:** US-03
**Priority:** Must Have
**Status:** Planned

---

## Story

**As a** user managing my YouTube bookmarks
**I want to** delete tags I no longer need
**So that** I can keep my tag list clean and organized

---

## Acceptance Criteria

### ✅ AC1: Delete Button Exists
- **Given** I'm viewing the Tags list in Settings
- **When** I click the actions menu (⋮) for any tag
- **Then** I see a "Delete" option in the dropdown

### ✅ AC2: Confirmation Dialog Opens
- **Given** I click "Delete" on a tag
- **When** the confirmation dialog opens
- **Then** I see:
  - Warning message "Delete tag '{tag_name}'?"
  - Information "This will remove the tag from all videos"
  - Video count "(X videos have this tag)"
  - Cancel and Delete buttons

### ✅ AC3: Delete Confirmed
- **Given** The confirmation dialog is open
- **When** I click "Delete"
- **Then** The tag is deleted from the database
- **And** The tag is removed from all videos
- **And** The tag disappears from TagsList
- **And** The tag disappears from sidebar (TagNavigation)
- **And** I see a success message "Tag deleted"

### ✅ AC4: Delete Cancelled
- **Given** The confirmation dialog is open
- **When** I click "Cancel"
- **Then** The dialog closes
- **And** The tag is NOT deleted
- **And** No changes occur

### ✅ AC5: Cascade Deletion
- **Given** A tag assigned to 10 videos
- **When** I delete the tag
- **Then** All 10 video-tag associations are removed (via CASCADE)
- **And** The videos themselves are NOT deleted
- **And** The schema (if bound) is NOT deleted

### ✅ AC6: Schema Unbinding
- **Given** A tag with schema_id bound
- **When** I delete the tag
- **Then** The schema is NOT deleted (tags.schema_id has ON DELETE SET NULL, but tag itself is deleted)
- **And** Other tags with same schema are unaffected

### ✅ AC7: Error Handling
- **Given** API deletion fails (network error, 500)
- **When** Error occurs
- **Then** I see error message "Failed to delete tag. Please try again."
- **And** The dialog stays open
- **And** The tag is NOT deleted from the list

---

## UX Flow

```
1. User views TagsList in Settings
   ↓
2. User clicks actions menu (⋮) on "Old Tag" (15 videos)
   ↓
3. Dropdown shows: [Edit] [Delete] [Merge]
   ↓
4. User clicks "Delete"
   ↓
5. ConfirmDeleteTagDialog opens:
   "Delete tag 'Old Tag'?"
   "This will remove the tag from 15 videos"
   [Cancel] [Delete]
   ↓
6. User clicks "Delete"
   ↓
7. API call: DELETE /api/tags/{id}
   ↓
8. Success (204 No Content)
   ↓
9. Dialog closes
   ↓
10. TagsList refreshes (tag removed)
    ↓
11. Sidebar TagNavigation refreshes (tag removed)
    ↓
12. Toast shows "Tag deleted"
    ↓
13. Result: Tag gone, video-tag associations gone, videos survive
```

---

## UI Mockup (Text)

```
┌─────────────────────────────────────────────────┐
│ Delete Tag                                  [×] │
├─────────────────────────────────────────────────┤
│                                                 │
│ ⚠️  Are you sure you want to delete this tag?  │
│                                                 │
│ Tag: "Old Tag"                                  │
│                                                 │
│ This will remove the tag from 15 videos.       │
│ Videos themselves will not be deleted.          │
│                                                 │
│ This action cannot be undone.                   │
│                                                 │
│                            [Cancel]  [Delete]   │
│                                         ^^^     │
│                                    (destructive │
│                                      red style) │
└─────────────────────────────────────────────────┘
```

---

## Edge Cases

### Edge Case 1: Tag with Zero Videos
- **Scenario:** Tag has no video associations
- **Expected:** Confirmation shows "This tag is not assigned to any videos"

### Edge Case 2: Tag with Many Videos (>100)
- **Scenario:** Tag assigned to 150 videos
- **Expected:** Confirmation shows "This will remove the tag from 150 videos" (future: pagination/confirmation)

### Edge Case 3: Last Tag
- **Scenario:** User deletes their only tag
- **Expected:** TagsList shows empty state after deletion

### Edge Case 4: Tag Currently Selected in Sidebar
- **Scenario:** User is filtering by "Python" tag, then deletes it
- **Expected:** Filter deselects automatically, video list refreshes to show all videos

### Edge Case 5: Network Error During Deletion
- **Scenario:** DELETE request fails (network error, 500)
- **Expected:** Error toast "Failed to delete tag", dialog stays open, tag not deleted

### Edge Case 6: Concurrent Deletion
- **Scenario:** Two users try to delete same tag simultaneously
- **Expected:** First succeeds, second gets 404 Not Found, shows "Tag already deleted"

---

## Technical Notes

**API Endpoint:**
```
DELETE /api/tags/{tag_id}

Response: 204 No Content
(Or 404 if tag doesn't exist)
```

**Database Cascade:**
```sql
-- In video_tags junction table
FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE

-- When tag is deleted:
DELETE FROM tags WHERE id = 'tag-uuid';
-- Automatically executes:
DELETE FROM video_tags WHERE tag_id = 'tag-uuid';

-- Videos table is NOT affected
```

**Mutation Hook:**
```tsx
const deleteTag = useDeleteTag()
deleteTag.mutate(tag.id)

// onSettled: invalidate both tags and videos queries
// (videos query needs refresh to remove tag badges)
```

---

## Dependencies

- ⚠️ `useDeleteTag()` hook (needs to be created)
- ⚠️ ConfirmDeleteTagDialog component (needs to be created)
- ✅ `DELETE /api/tags/{id}` endpoint (already exists)
- ✅ Radix AlertDialog component (already used in codebase)
- ✅ ConfirmDeleteFieldModal (reference pattern)

---

## Testing Scenarios

### Test 1: Show Confirmation Dialog
```tsx
it('opens confirmation dialog on delete click', () => {
  render(<TagsList tags={tags} />)

  fireEvent.click(screen.getByLabelText('Actions for Python'))
  fireEvent.click(screen.getByText('Delete'))

  expect(screen.getByText(/delete tag/i)).toBeInTheDocument()
  expect(screen.getByText('Python')).toBeInTheDocument()
})
```

### Test 2: Delete Tag on Confirm
```tsx
it('deletes tag when confirmed', async () => {
  const deleteTag = jest.fn()
  render(<ConfirmDeleteTagDialog tag={tag} open={true} />)

  fireEvent.click(screen.getByText('Delete'))

  await waitFor(() => {
    expect(deleteTag).toHaveBeenCalledWith(tag.id)
  })
})
```

### Test 3: Cancel Deletion
```tsx
it('does not delete tag when cancelled', async () => {
  const deleteTag = jest.fn()
  render(<ConfirmDeleteTagDialog tag={tag} open={true} onCancel={jest.fn()} />)

  fireEvent.click(screen.getByText('Cancel'))

  expect(deleteTag).not.toHaveBeenCalled()
})
```

### Test 4: Show Video Count
```tsx
it('shows video count in confirmation', () => {
  const tag = { ...mockTag, video_count: 15 }
  render(<ConfirmDeleteTagDialog tag={tag} open={true} />)

  expect(screen.getByText(/15 videos/i)).toBeInTheDocument()
})
```

### Test 5: Error Handling
```tsx
it('shows error on deletion failure', async () => {
  server.use(
    rest.delete('/api/tags/:id', (req, res, ctx) => {
      return res(ctx.status(500), ctx.json({ detail: 'Server error' }))
    })
  )

  render(<ConfirmDeleteTagDialog tag={tag} open={true} />)
  fireEvent.click(screen.getByText('Delete'))

  expect(await screen.findByText(/failed to delete/i)).toBeInTheDocument()
})
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Accidental deletion | Medium | High | Confirmation dialog with tag name display |
| Deleting tag breaks videos | None | Critical | Cascade only deletes video_tags, not videos |
| No undo functionality | High | Medium | Future: trash/archive instead of hard delete |
| Bulk deletion by mistake | Low | High | Future: require typing tag name for important tags |
| Network error leaves orphans | Low | Low | Database constraints prevent orphans |

---

## Future Enhancements

### Soft Delete (Archive)
```tsx
// Instead of hard delete:
PUT /api/tags/{id}
{ "archived": true }

// Tag hidden from UI but can be restored
```

### Undo Deletion (Toast)
```tsx
toast.success('Tag deleted', {
  action: {
    label: 'Undo',
    onClick: () => restoreTag(tag)
  }
})
```

### Bulk Delete with Safeguards
```tsx
// For tags with >50 videos, require typing tag name
<Input placeholder={`Type "${tag.name}" to confirm`} />
```

---

## Definition of Done

- [ ] Delete button in TagsList actions menu
- [ ] ConfirmDeleteTagDialog component created
- [ ] useDeleteTag() hook created
- [ ] Confirmation dialog shows tag name and video count
- [ ] Delete button calls DELETE /api/tags/{id}
- [ ] Success: tag removed from list, sidebar, toast shows
- [ ] Error: dialog stays open, error toast shows
- [ ] Cancel: dialog closes, no deletion
- [ ] Cascade: video-tag associations deleted, videos survive
- [ ] Component tests pass (>90% coverage)
- [ ] Integration test: delete tag → list updates
- [ ] Accessibility: focus moves to Cancel by default
- [ ] Accessibility: Escape key closes dialog

---

**Related Stories:**
- US-01: View All Tags
- US-02: Edit Tag Name and Color
- US-05: Tag Statistics View (shows video count)
