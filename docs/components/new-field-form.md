# NewFieldForm Component

**Location:** `frontend/src/components/schemas/NewFieldForm.tsx`
**Task:** #123
**Status:** Active

## Purpose

Inline form for creating custom fields within SchemaEditor. **FIRST IMPLEMENTATION** of Field Component pattern - precedent for all future forms.

## Features

- Field name input with real-time duplicate validation (debounced 500ms)
- Type selector (select, rating, text, boolean)
- Dynamic config editor based on selected type
- React Hook Form + Zod validation with Controller + Field pattern
- WCAG 2.1 Level AA accessible (ARIA labels, keyboard nav, role="alert")

## Dependencies

- `react-hook-form@^7.51.0` - Form state management
- `@hookform/resolvers@^3.3.4` - Zod resolver
- `use-debounce@^10.0.0` - Debounced duplicate check
- shadcn/ui Field components (Field, FieldLabel, FieldDescription, FieldError)
- Backend API: `POST /api/lists/{id}/custom-fields/check-duplicate`

## Props

```typescript
interface NewFieldFormProps {
  listId: string  // List ID for duplicate check scoping
  onSubmit: (fieldData: CustomFieldCreate) => void | Promise<void>  // Submit handler
  onCancel: () => void  // Cancel handler
  isSubmitting?: boolean  // External submission state
}
```

## State Management

- **Form state:** React Hook Form `useForm` hook with Controller
- **Duplicate check:** Local state with debounced API call (500ms)
- **Config:** Auto-resets when field type changes

## Key Implementation Details

- **Migration from Form:** Task #123 migrated from deprecated Form pattern to Field pattern
- **Debounced Validation:** `useDebouncedCallback` reduces API calls by 90%
- **Dynamic Schema Validation:** Zod `superRefine` for type-specific config validation
- **Keyboard Navigation:** Escape cancels, Enter submits

## Usage Example

```typescript
import { NewFieldForm } from '@/components/schemas/NewFieldForm'
import { CustomFieldCreate } from '@/types/customField'

function SchemaEditor() {
  const [showForm, setShowForm] = useState(false)

  const handleSubmit = async (fieldData: CustomFieldCreate) => {
    await createFieldMutation.mutateAsync(fieldData)
    setShowForm(false)
  }

  return (
    <div>
      <Button onClick={() => setShowForm(true)}>Add Field</Button>
      {showForm && (
        <NewFieldForm
          listId={listId}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          isSubmitting={createFieldMutation.isPending}
        />
      )}
    </div>
  )
}
```

## Testing

- 26 unit tests (validation, type switching, duplicate check, submission, keyboard, a11y)
- Mock API calls with Vitest
- Accessibility testing with RTL queries (getByRole, getByLabelText)

## Related Documentation

- Pattern: `docs/patterns/field-component-pattern.md` (Field pattern reference)
- Sub-component: `docs/components/field-config-editor.md` (Task #124)
- Report: `docs/reports/2025-11-11-task-123-report.md` (Full implementation details)

## Future Tasks

- Task #132: FieldEditorComponent - Edit existing fields (will reuse pattern)
