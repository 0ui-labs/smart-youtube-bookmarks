# Regression Test Design

## Test Purpose
Verify that SchemaEditor component is properly integrated into CreateTagDialog and allows inline schema creation.

## Test File Location
`frontend/src/components/CreateTagDialog.schema-editor.test.tsx` (new file)

## Test Cases

### Test 1: SchemaEditor Appears When "New" Selected
**Status:** Should FAIL now, PASS after fix

```tsx
it('shows SchemaEditor when "new" schema option is selected', async () => {
  const user = userEvent.setup()
  const { container } = renderWithProviders(<CreateTagDialog {...defaultProps} />)

  // Simulate setting schemaId to 'new' (in real app, via SchemaSelector)
  // For testing, we can use data-testid or query the SchemaSelector

  // After selecting 'new'...

  // EXPECT: SchemaEditor is rendered
  expect(screen.getByLabelText('Schema-Name *')).toBeInTheDocument()
  expect(screen.getByText(/Schema erstellen/i)).toBeInTheDocument()

  // EXPECT: Placeholder message does NOT appear
  expect(screen.queryByText(/Task #83 implementiert/i)).not.toBeInTheDocument()
})
```

**Current Result:** FAIL - Placeholder appears, SchemaEditor does not
**After Fix:** PASS - SchemaEditor renders, no placeholder

### Test 2: Schema Creation Flow Works End-to-End
**Status:** Should FAIL now, PASS after fix

```tsx
it('allows creating a schema inline and attaching to tag', async () => {
  const user = userEvent.setup()
  const onOpenChange = vi.fn()

  renderWithProviders(
    <CreateTagDialog
      open={true}
      onOpenChange={onOpenChange}
      listId="list-1"
    />
  )

  // Step 1: Fill tag name
  await user.type(screen.getByLabelText('Name *'), 'Python')

  // Step 2: Select "new" from schema dropdown
  // (Implementation depends on SchemaSelector interaction - may need data-testid)

  // Step 3: Fill SchemaEditor form
  await user.type(screen.getByLabelText('Schema-Name *'), 'Code Quality')
  await user.type(screen.getByLabelText('Beschreibung (optional)'), 'Metrics for code')

  // Step 4: Add field to schema (interact with FieldSelector)
  // await user.click(screen.getByText(/Feld hinzufügen/i))
  // ... select field ...

  // Step 5: Submit schema creation
  await user.click(screen.getByRole('button', { name: /schema erstellen/i }))

  // Step 6: Verify schema was created and selected
  await waitFor(() => {
    // SchemaEditor should disappear
    expect(screen.queryByLabelText('Schema-Name *')).not.toBeInTheDocument()
  })

  // Step 7: Submit tag with newly created schema
  await user.click(screen.getByRole('button', { name: /erstellen/i }))

  // Verify tag creation succeeded
  await waitFor(() => {
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
```

**Current Result:** FAIL - Cannot create schema inline
**After Fix:** PASS - Complete flow works

### Test 3: Cancel Schema Creation Returns to Dropdown
**Status:** Should FAIL now, PASS after fix

```tsx
it('resets to "Kein Schema" when schema creation is cancelled', async () => {
  const user = userEvent.setup()

  renderWithProviders(<CreateTagDialog {...defaultProps} />)

  // Step 1: Select "new" schema
  // (trigger schemaId = 'new')

  // Step 2: Verify SchemaEditor appears
  expect(screen.getByLabelText('Schema-Name *')).toBeInTheDocument()

  // Step 3: Click "Abbrechen" in SchemaEditor
  await user.click(screen.getByRole('button', { name: /abbrechen/i }))

  // Step 4: Verify SchemaEditor disappears
  expect(screen.queryByLabelText('Schema-Name *')).not.toBeInTheDocument()

  // Step 5: Verify schemaId reset to null (dropdown shows "Kein Schema")
  // Can verify by checking dropdown state or trying to submit tag
  // Tag submission should work without schema
  await user.type(screen.getByLabelText('Name *'), 'Test Tag')
  await user.click(screen.getByRole('button', { name: /erstellen/i }))

  await waitFor(() => {
    // Should succeed (no validation error about pending schema)
    expect(screen.queryByText(/schema-erstellung ab/i)).not.toBeInTheDocument()
  })
})
```

**Current Result:** FAIL - No cancel handler exists
**After Fix:** PASS - Cancel resets state properly

### Test 4: Validation Prevents Submitting with 'new' State
**Status:** Should PASS now, PASS after fix (edge case protection)

```tsx
it('shows error when trying to submit tag while schema is still in "new" state', async () => {
  const user = userEvent.setup()

  renderWithProviders(<CreateTagDialog {...defaultProps} />)

  // Fill tag name
  await user.type(screen.getByLabelText('Name *'), 'Python')

  // Manually set schemaId to 'new' (simulating edge case bug)
  // In real app: select "new" but don't complete schema creation

  // Try to submit
  await user.click(screen.getByRole('button', { name: /erstellen/i }))

  // Should show validation error
  expect(screen.getByText(/erstellen sie das schema/i)).toBeInTheDocument()
})
```

**Current Result:** PASS (validation exists)
**After Fix:** PASS (validation remains as safety net)

### Test 5: Placeholder Does Not Appear After Fix
**Status:** Current test PASSES, should continue to PASS

This is the EXISTING test at `CreateTagDialog.test.tsx:92-98`:
```tsx
it('shows Task #83 placeholder text when component is rendered', () => {
  renderWithProviders(<CreateTagDialog {...defaultProps} />)

  expect(screen.queryByText(/Schema-Editor wird in Task #83 implementiert/i)).not.toBeInTheDocument()
})
```

**Update After Fix:**
Rename test to be more descriptive:
```tsx
it('does not show Task #83 placeholder - SchemaEditor is integrated', () => {
  // Same test, better name to reflect that feature is complete
})
```

## Manual Testing Checklist

After automated tests pass, verify these user flows:

### ✅ Happy Path
1. Click "+" in sidebar
2. Enter tag name "Python"
3. Click schema dropdown
4. Click "+ Neues Schema erstellen"
5. **Verify:** SchemaEditor appears below dropdown
6. Enter schema name "Code Quality"
7. Enter description "Quality metrics"
8. Add at least one field
9. Click "Schema erstellen"
10. **Verify:** SchemaEditor disappears
11. **Verify:** "Code Quality" is now selected in dropdown
12. Click "Erstellen" to create tag
13. **Verify:** Tag created successfully with schema attached

### ✅ Cancel Path
1. Follow steps 1-6 above
2. Click "Abbrechen" in SchemaEditor
3. **Verify:** SchemaEditor disappears
4. **Verify:** Dropdown shows "Kein Schema"
5. Complete tag creation without schema
6. **Verify:** Tag created successfully without schema

### ✅ Error Handling
1. Follow steps 1-6 above
2. Enter schema name that already exists
3. Click "Schema erstellen"
4. **Verify:** Error message appears in SchemaEditor
5. **Verify:** SchemaEditor stays open (doesn't close on error)
6. Fix error (change name)
7. Click "Schema erstellen" again
8. **Verify:** Schema created successfully

### ✅ Validation
1. Follow steps 1-4 above (SchemaEditor appears)
2. Leave schema name empty
3. Click "Schema erstellen"
4. **Verify:** Validation error appears
5. **Verify:** SchemaEditor stays open

## Test-Driven Development Approach

### Phase 1: RED (Now)
1. Write Test 1 → FAIL (placeholder shows, no SchemaEditor)
2. Write Test 2 → FAIL (cannot create schema inline)
3. Write Test 3 → FAIL (no cancel handler)

### Phase 2: GREEN (After Fix)
1. Implement fix
2. All tests PASS

### Phase 3: REFACTOR
1. Clean up any TODO comments
2. Ensure error handling is consistent
3. Add JSDoc comments to new handlers

## Success Criteria

✅ All automated tests pass
✅ All manual testing checklist items pass
✅ No placeholder messages visible to users
✅ No regressions in existing tag creation flow
✅ Code coverage maintained or improved
