# Fix Strategy

## Goal
Integrate the existing SchemaEditor component into CreateTagDialog to enable inline schema creation when users select "+ Neues Schema erstellen".

## Approach: Minimal Changes

### Principle
The SchemaEditor component is **already developed and tested**. We only need to integrate it into CreateTagDialog.

### Key Changes

#### 1. Import SchemaEditor (CreateTagDialog.tsx)
```tsx
import { SchemaEditor } from './schemas/SchemaEditor'
```

#### 2. Add State for Schema Creation Mode
Track when user is in "creating new schema" mode vs normal mode:
```tsx
const [isCreatingSchema, setIsCreatingSchema] = useState(false)
```

#### 3. Replace Placeholder with SchemaEditor (lines 179-184)
**Before:**
```tsx
{/* TODO (Task #83): Show SchemaEditor when schemaId === 'new' */}
{schemaId === 'new' && (
  <p className="mt-2 text-sm text-amber-600">
    Schema-Editor wird in Task #83 implementiert
  </p>
)}
```

**After:**
```tsx
{schemaId === 'new' && (
  <div className="mt-4 p-4 border rounded-lg bg-gray-50">
    <SchemaEditor
      listId={listId}
      onSave={handleSchemaCreated}
      onCancel={handleSchemaCancelled}
    />
  </div>
)}
```

#### 4. Add Schema Lifecycle Handlers

**handleSchemaCreated:**
```tsx
const handleSchemaCreated = async (schemaData: SchemaFormData) => {
  // Create schema via API
  const newSchema = await createSchema.mutateAsync({
    name: schemaData.name,
    description: schemaData.description,
    fields: schemaData.fields,
  })

  // Set schemaId to newly created schema
  setSchemaId(newSchema.id)

  // Exit schema creation mode
  setIsCreatingSchema(false)
}
```

**handleSchemaCancelled:**
```tsx
const handleSchemaCancelled = () => {
  // Reset to "no schema" when user cancels
  setSchemaId(null)
}
```

#### 5. Update Validation Logic (lines 67-71)
**Before:**
```tsx
if (schemaId === 'new') {
  setError('Bitte schließen Sie die Schema-Erstellung ab oder wählen Sie "Kein Schema"')
  return
}
```

**After:**
```tsx
// Remove this validation entirely - it's no longer needed
// When schemaId === 'new', SchemaEditor handles validation
// When schema is created, schemaId becomes UUID automatically
```

Actually, keep a simpler version:
```tsx
if (schemaId === 'new') {
  setError('Bitte erstellen Sie das Schema oder brechen Sie ab')
  return
}
```

This handles edge case where user bypasses UI and submits while still in 'new' mode.

#### 6. Import useCreateSchema Hook
```tsx
import { useCreateSchema } from '@/hooks/useSchemas'
```

```tsx
const createSchema = useCreateSchema(listId)
```

## Integration Flow

### Happy Path
1. User clicks "+ Neues Schema erstellen" in dropdown
2. `schemaId` becomes `'new'`
3. SchemaEditor appears below dropdown
4. User fills in schema details (name, description, fields)
5. User clicks "Schema erstellen" in SchemaEditor
6. `handleSchemaCreated` is called
7. Schema is created via API → returns new schema with UUID
8. `schemaId` is set to new UUID
9. SchemaEditor disappears
10. User sees newly created schema selected in dropdown
11. User completes tag creation with schema attached

### Cancel Path
1. User clicks "+ Neues Schema erstellen"
2. SchemaEditor appears
3. User clicks "Abbrechen" in SchemaEditor
4. `handleSchemaCancelled` is called
5. `schemaId` reset to `null`
6. Dropdown shows "Kein Schema"
7. User can continue tag creation without schema

### Error Handling
- **Schema name conflict (409):** SchemaEditor handles internally, shows error message
- **Network error:** SchemaEditor handles internally, shows error message
- **Validation error:** SchemaEditor prevents submission via form validation

## Why This Approach is Safe

### 1. Zero Breaking Changes
- Existing tag creation flow unchanged
- Only adds new functionality when 'new' is selected
- All existing validation remains

### 2. Reuses Tested Code
- SchemaEditor already has tests
- API integration already proven
- Validation already implemented

### 3. Minimal Code Changes
- ~30 lines of new code
- No changes to existing logic paths
- Clean separation of concerns

### 4. Clear User Flow
- User stays in same modal (no navigation)
- Clear visual feedback (SchemaEditor appears inline)
- Intuitive cancel behavior

## Bonus Fix: SchemaCreationDialog

Apply same pattern to `SchemaCreationDialog.tsx` line 94-98:
- Replace placeholder in "Start from Scratch" tab with SchemaEditor
- Reuse same integration pattern

## Files to Change

### Primary Fix
- `frontend/src/components/CreateTagDialog.tsx` (~30 line changes)

### Secondary Fix (Similar Issue)
- `frontend/src/components/schemas/SchemaCreationDialog.tsx` (~20 line changes)

### Test Updates
- `frontend/src/components/CreateTagDialog.test.tsx` (update test expecting placeholder not to exist)

## Estimated Effort
- **Primary fix:** 30 minutes
- **Tests:** 20 minutes
- **Secondary fix (SchemaCreationDialog):** 15 minutes
- **Total:** ~1 hour

## Risks
**MINIMAL** - Component already exists and is battle-tested.

Only risk: Integration bugs (e.g., forgetting to reset state on cancel).
Mitigated by: Following established patterns from SchemaEditor tests.
