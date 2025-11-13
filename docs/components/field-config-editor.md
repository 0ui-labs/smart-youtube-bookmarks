# FieldConfigEditor Components

**Location:** `frontend/src/components/fields/FieldConfigEditor.tsx` + 3 sub-components
**Task:** #124
**Status:** Active

## Purpose

Type-specific configuration editors for custom fields (select, rating, text, boolean). Uses Field Component pattern from Task #123.

## Sub-Components

### SelectConfigEditor.tsx
- Dynamic options list with useFieldArray (REF MCP #1)
- Add/remove options dynamically
- At least 1 option required validation

### RatingConfigEditor.tsx
- Numeric input (1-10 range validation)
- Default: 5 stars

### TextConfigEditor.tsx
- Optional max_length with checkbox toggle
- No max_length by default

### Boolean Type
- Returns null (no config needed)

## Features

- Real-time validation matching backend rules (`backend/app/schemas/custom_field.py`)
- German localization (all labels, errors, helper text)
- WCAG 2.1 Level AA accessible (ARIA labels, keyboard nav, role="alert")
- Controlled component pattern with onChange callback
- Empty state handling

## REF MCP Improvements

1. **REF MCP #1:** useFieldArray hook for SelectConfigEditor (NOT manual array state)
2. **REF MCP #2:** Icon accessibility with aria-hidden + sr-only spans
3. Field component pattern from Task #123 (all sub-components use Field/FieldLabel/FieldError)

## Props

```typescript
interface FieldConfigEditorProps {
  fieldType: FieldType  // 'select' | 'rating' | 'text' | 'boolean'
  config: FieldConfig | null  // Current config
  onChange: (config: FieldConfig | null) => void  // Config change handler
  control: Control<any>  // Required for SelectConfigEditor useFieldArray
  error?: string  // External validation error
}
```

## Usage Example

```typescript
import { FieldConfigEditor } from '@/components/fields/FieldConfigEditor'
import { useForm } from 'react-hook-form'

function MyForm() {
  const form = useForm()
  const [fieldType, setFieldType] = useState<FieldType>('select')
  const [config, setConfig] = useState<FieldConfig | null>(null)

  return (
    <FieldConfigEditor
      fieldType={fieldType}
      config={config}
      onChange={setConfig}
      control={form.control}  // Required for SelectConfigEditor
      error={validationError}
    />
  )
}
```

## Key Implementation Details

- **useFieldArray Pattern:** SelectConfigEditor uses react-hook-form's useFieldArray (REF MCP #1)
- **Icon Accessibility:** All icons have aria-hidden="true" + sr-only text on buttons (REF MCP #2)
- **Controlled Components:** All sub-components use onChange callback (not local state mutations)
- **Validation:** Inline validation with local error state + external error prop
- **Type Safety:** Discriminated union for FieldConfig with TypeScript exhaustiveness checks

## Testing

- 42 unit tests (5 parent + 19 SelectConfigEditor + 10 RatingConfigEditor + 6 TextConfigEditor + 2 integration)
- 100% pass rate (42/42 passing)
- Accessibility testing with RTL queries

## Integration

Used by:
- `NewFieldForm.tsx` (Task #123) - Creating new fields
- `FieldEditorComponent.tsx` (Task #132, future) - Editing existing fields

## Related Documentation

- Parent: `docs/components/new-field-form.md` (Task #123)
- Pattern: `docs/patterns/field-component-pattern.md`
- Report: `docs/reports/2025-11-11-task-124-report.md`
