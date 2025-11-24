# Testing Strategy

## Test Categories

### 1. Manual Testing (Primary)

Since this is a UI-focused feature, manual testing is most effective.

#### Bug Fix Verification
- [ ] Navigate to `/channels`
- [ ] Hide a channel via sidebar
- [ ] Verify channel still appears on `/channels`
- [ ] Verify hidden indicator is shown

#### Toggle Visibility
- [ ] Click menu on visible channel
- [ ] Select "In Navigation ausblenden"
- [ ] Verify channel shows hidden indicator
- [ ] Verify channel disappears from sidebar
- [ ] Click menu on hidden channel
- [ ] Select "In Navigation einblenden"
- [ ] Verify hidden indicator disappears
- [ ] Verify channel reappears in sidebar

#### Delete Flow
- [ ] Click menu → "Kanal löschen"
- [ ] Verify confirmation dialog appears
- [ ] Verify dialog shows channel name
- [ ] Verify dialog shows video count
- [ ] Click "Abbrechen" → dialog closes, nothing deleted
- [ ] Click "Löschen" → channel is deleted
- [ ] Verify channel gone from list
- [ ] Verify videos still exist (navigate to /videos)

#### Edge Cases
- [ ] Channel with 0 videos - delete works
- [ ] All channels hidden - page still works
- [ ] Rapid clicking - no duplicate requests

### 2. Integration Testing (Optional)

If time permits, add Playwright tests:

```typescript
test('hidden channels appear on channels page', async ({ page }) => {
  // Hide a channel via sidebar
  // Navigate to /channels
  // Assert channel is visible with hidden indicator
})

test('can toggle channel visibility from channels page', async ({ page }) => {
  // Navigate to /channels
  // Click menu → toggle visibility
  // Assert indicator changes
  // Navigate to home, assert sidebar updated
})

test('delete channel shows confirmation', async ({ page }) => {
  // Navigate to /channels
  // Click menu → delete
  // Assert dialog appears
  // Cancel, assert channel still exists
})
```

### 3. Regression Testing

Verify existing functionality still works:
- [ ] Sidebar channel list works
- [ ] Sidebar hide menu still works
- [ ] Clicking channel navigates to filtered videos
- [ ] Channel count is correct

## Test Data Requirements

- At least 2 channels (one hidden, one visible)
- Channels with varying video counts (0, some, many)
