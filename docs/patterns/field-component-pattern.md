# Field Component Pattern (2025 shadcn/ui)

**Status:** Active (Established in Task #123)
**Last Updated:** 2025-11-11

## Overview

The Field Component pattern is the **required** form pattern for all React Hook Form implementations in this project. The deprecated FormField/FormItem pattern from older shadcn/ui versions must NOT be used.

## Why Field Pattern?

- Form component deprecated per 2025 shadcn/ui documentation
- Better TypeScript inference (fieldState typed correctly)
- Better composability (Field components independent)
- All future forms MUST use Field pattern

## Pattern Structure

### ⚠️ DEPRECATED - DO NOT USE

```typescript
// Form component is DEPRECATED as of 2025
<FormField control={form.control} name="..." render={...} />
<FormItem><FormLabel>...</FormLabel><FormControl>...</FormControl></FormItem>
```

### ✅ REQUIRED - Field Component Pattern

```typescript
import { Controller } from 'react-hook-form'
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'

<Controller
  control={form.control}
  name="fieldName"
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="field-id">Label *</FieldLabel>
      <Input {...field} id="field-id" aria-invalid={fieldState.invalid} />
      <FieldDescription>Helper text</FieldDescription>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

## Key Components

- **Controller**: react-hook-form's controlled component wrapper
- **Field**: Container with validation state (`data-invalid` attribute)
- **FieldLabel**: Accessible label with `htmlFor` binding
- **FieldDescription**: Optional helper text
- **FieldError**: Displays validation errors

## Accessibility Requirements

- Always use `htmlFor` on FieldLabel matching Input `id`
- Set `aria-invalid={fieldState.invalid}` on input elements
- Use `FieldError` with `errors` array for screen readers
- Field descriptions provide context for assistive technologies

## Complete Example

```typescript
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const schema = z.object({
  fieldName: z.string().min(1, 'Name ist erforderlich'),
  fieldType: z.enum(['select', 'rating', 'text', 'boolean'])
})

function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { fieldName: '', fieldType: 'select' }
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        control={form.control}
        name="fieldName"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="field-name">Feldname *</FieldLabel>
            <Input {...field} id="field-name" aria-invalid={fieldState.invalid} />
            <FieldDescription>
              Geben Sie einen eindeutigen Namen ein
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        control={form.control}
        name="fieldType"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="field-type">Feldtyp *</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="field-type" aria-invalid={fieldState.invalid}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select">Auswahlliste</SelectItem>
                <SelectItem value="rating">Bewertung</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="boolean">Ja/Nein</SelectItem>
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </form>
  )
}
```

## Related Documentation

- Implementation: `frontend/src/components/schemas/NewFieldForm.tsx` (Task #123)
- Report: `docs/reports/2025-11-11-task-123-report.md`
- Sub-components: `docs/components/field-config-editor.md` (Task #124)

## Migration Notes

If you encounter old FormField/FormItem patterns, they MUST be migrated to the Field pattern. See Task #123 report for migration examples.
