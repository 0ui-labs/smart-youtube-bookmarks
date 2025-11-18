# Root Cause Analysis

## Summary
The SchemaEditor component was developed and is fully functional, but it was never integrated into the CreateTagDialog component. The dialog still contains placeholder code from an earlier development phase.

## Technical Analysis

### CreateTagDialog.tsx (lines 179-184)
```tsx
{/* TODO (Task #83): Show SchemaEditor when schemaId === 'new' */}
{schemaId === 'new' && (
  <p className="mt-2 text-sm text-amber-600">
    Schema-Editor wird in Task #83 implementiert
  </p>
)}
```

**Problem:** This TODO comment and placeholder was meant to be temporary. The SchemaEditor component exists at `frontend/src/components/schemas/SchemaEditor.tsx` but was never imported and integrated here.

### Validation Blocker (lines 67-71)
```tsx
if (schemaId === 'new') {
  setError('Bitte schließen Sie die Schema-Erstellung ab oder wählen Sie "Kein Schema"')
  return
}
```

**Problem:** This validation prevents form submission when "new" is selected, assuming the schema editor would handle schema creation and update the schemaId. Since the editor is missing, users are blocked.

## Why This Happened

1. **Development Timeline:**
   - Task #82: Implemented SchemaSelector component allowing "new" option
   - Task #83: Was supposed to integrate SchemaEditor
   - Task #83 appears incomplete - SchemaEditor was created but not integrated into CreateTagDialog

2. **Missing Integration Steps:**
   - SchemaEditor component exists and is tested
   - SchemaEditor has proper API: `onSave`, `onCancel`, `initialData`
   - Integration was planned but never completed

3. **Workflow Assumptions:**
   - When schemaId === 'new', the dialog should:
     1. Show SchemaEditor component
     2. Allow user to create schema inline
     3. On successful creation, set schemaId to the new schema's ID
     4. Allow tag creation to proceed with the new schema

## Related Issues

`SchemaCreationDialog.tsx` has a similar issue:
- Line 95-98: "Start from Scratch" tab shows placeholder for Task #121
- Same pattern: SchemaEditor exists but not integrated

## Code References
- Placeholder code: `CreateTagDialog.tsx:180-184`
- Validation blocker: `CreateTagDialog.tsx:67-71`
- Available component: `schemas/SchemaEditor.tsx`
- Similar issue: `schemas/SchemaCreationDialog.tsx:95-98`
