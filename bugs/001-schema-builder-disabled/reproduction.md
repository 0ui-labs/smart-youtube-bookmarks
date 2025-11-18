# Bug #001: Schema Builder Shows Placeholder Message

## Bug Report
**Date:** 2025-11-17
**Reporter:** User
**Status:** Confirmed

## Description
When clicking the "+" button in the left sidebar to create a new tag, users can select "+ Neues Schema erstellen" (+ Create new schema) from the schema dropdown. However, instead of showing the schema builder, a placeholder message appears: "Schema-Editor wird in Task #83 implementiert" (Schema editor will be implemented in Task #83).

The schema builder component (`SchemaEditor.tsx`) has already been developed and is functional, so this is a integration bug where the CreateTagDialog is not using the available component.

## Reproduction Steps
1. Click the "+" button in the left sidebar (tag navigation)
2. The CreateTagDialog modal opens
3. In the "Schema (optional)" section, click the dropdown
4. Select "+ Neues Schema erstellen"
5. **Expected:** Schema editor appears allowing user to create a new schema
6. **Actual:** Placeholder message "Schema-Editor wird in Task #83 implementiert" appears
7. Attempting to submit the form shows error: "Bitte schließen Sie die Schema-Erstellung ab oder wählen Sie 'Kein Schema'"

## Affected Components
- `frontend/src/components/CreateTagDialog.tsx` (lines 180-184)
- `frontend/src/components/SchemaSelector.tsx` (allows "new" selection)

## Related Components (Already Developed)
- `frontend/src/components/schemas/SchemaEditor.tsx` - Fully functional schema editor
- `frontend/src/components/schemas/SchemaCreationDialog.tsx` - Has similar issue on "Start from Scratch" tab (Task #121 placeholder)

## Environment
- **Browser:** N/A (code inspection)
- **Version:** Current development branch
- **User Impact:** High - Users cannot create schemas inline when creating tags
