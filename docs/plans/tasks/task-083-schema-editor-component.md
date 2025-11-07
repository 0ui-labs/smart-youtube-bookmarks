# Task #83: Create SchemaEditor Component for Inline Schema Creation

**Status:** Planning
**Estimated Effort:** 10-14 hours (RECOMMEND SPLITTING INTO SUB-TASKS)
**Dependencies:** 
- Task #79 (useCustomFields hook) - PENDING, can be mocked
- Task #80 (useSchemas hook) - PENDING, can be mocked
- Task #82 (TagEditDialog extension) - parallel implementation

**Related Documents:**
- Design Doc: `docs/plans/2025-11-05-custom-fields-system-design.md` (lines 330-359, 501-520)
- Latest Handoff: `docs/handoffs/2025-11-07-log-065-field-schema-pydantic-schemas.md`

---

## 🎯 Goal

Create a comprehensive SchemaEditor component that enables inline schema creation within TagEditDialog. This component must support:
1. Creating new custom fields inline (without leaving the dialog)
2. Selecting from existing fields with multi-select
3. Drag-and-drop field ordering with show_on_card toggles
4. Real-time duplicate field name checking
5. Type-specific field configuration (rating max, select options, text length)

This is the **MOST COMPLEX COMPONENT** in the Custom Fields System due to nested form state, dynamic field arrays, drag-drop interactions, and real-time validation.

---

## 📋 Acceptance Criteria

- [ ] SchemaEditor component renders within TagEditDialog
- [ ] User can select from existing custom fields (multi-select dropdown)
- [ ] User can create new fields inline without leaving dialog
- [ ] Field type selector works (select, rating, text, boolean)
- [ ] Type-specific config editors work:
  - [ ] Rating: max_rating slider (1-10)
  - [ ] Select: dynamic options list with add/remove
  - [ ] Text: optional max_length input
  - [ ] Boolean: no config needed
- [ ] Real-time duplicate field name check (debounced, case-insensitive)
- [ ] Drag-and-drop field reordering works
- [ ] Show-on-card toggles work (max 3 enforcement)
- [ ] Form validation prevents invalid submissions
- [ ] WCAG 2.1 Level AA compliant (keyboard navigation, ARIA labels, focus management)
- [ ] 25+ tests passing (unit + integration)
- [ ] 0 TypeScript errors
- [ ] Code review approved

---

## 🔍 REF MCP Pre-Validation Results

### Research Queries Executed (2025-11-07)

1. **shadcn/ui Form + React Hook Form nested forms** ✅
   - URL: https://ui.shadcn.com/docs/forms/react-hook-form#array-fields
   - Key Finding: Use `useFieldArray` with `Controller` pattern
   - Best Practice: Use `field.id` as key (NOT array index)
   
2. **React Hook Form useFieldArray drag-drop** ✅
   - Key Finding: Compatible with drag-drop libraries via `move()` method
   - Pattern: Map over `fields` array, use `field.id` for stable keys
   
3. **dnd-kit best practices 2024** ✅
   - URL: https://docs.dndkit.com/introduction/getting-started
   - Key Finding: Use `useDraggable` + `useDroppable` hooks OR `@dnd-kit/sortable` preset
   - Architecture: NOT built on HTML5 DnD API (better touch/keyboard support)
   - Performance: Minimizes DOM mutations using `translate3d`
   
4. **React Query optimistic updates** ✅
   - URL: TanStack Query v5 migration guide
   - Key Finding: Simplified optimistic updates using `mutation.variables`
   - Pattern: Render pending mutations in UI without cache writes
   
5. **shadcn/ui Combobox multi-select** ✅
   - URL: https://ui.shadcn.com/docs/components/combobox
   - Key Finding: Built with `<Command />` + `<Popover />` composition
   - Installation: Requires both Command and Popover components

### Critical Improvements Identified

**#1: Use @dnd-kit/sortable Preset (NOT custom useDraggable)**
- **Why:** Preset provides `SortableContext` + `useSortable` hook with built-in keyboard support
- **Benefit:** Handles reordering logic automatically, reduces code by ~200 lines
- **Alternative Rejected:** Custom `useDraggable` + `useDroppable` requires manual collision detection

**#2: React Hook Form useFieldArray with field.id Keys**
- **Why:** Stable keys prevent React reconciliation bugs when reordering
- **Pattern:** `{fields.map((field) => <Controller key={field.id} ... />)}`
- **Common Mistake:** Using array index as key breaks drag-drop

**#3: Debounced Duplicate Check with AbortController**
- **Why:** Prevents API spam during typing, cancels stale requests
- **Pattern:** `useMutation` with 300ms debounce + cleanup function
- **Alternative Rejected:** Throttling doesn't cancel in-flight requests

**#4: Nested Form State with Single useForm Hook**
- **Why:** Multiple `useForm` instances conflict, harder to validate
- **Pattern:** Single parent form with nested field paths: `schema.fields[0].name`
- **Alternative Rejected:** Separate forms for NewFieldForm would need manual sync

**#5: Max 3 show_on_card Enforcement with Zod Refinement**
- **Why:** Validation at schema level prevents UI bugs
- **Pattern:** `.refine((data) => data.fields.filter(f => f.show_on_card).length <= 3)`
- **Benefit:** Error message shown before submit, not after API call

**#6: Combobox for Field Selection (NOT native <select>)**
- **Why:** Better UX for large field lists, supports search/filter
- **Pattern:** shadcn/ui Combobox with multi-select state
- **Installation Required:** `npx shadcn@latest add command popover`

**#7: Feature Flag for SchemaEditor Visibility**
- **Why:** Allows hiding incomplete feature during development
- **Pattern:** `VITE_FEATURE_SCHEMA_EDITOR` env var (default: "false")
- **Rationale:** Complex component, staged rollout recommended

---

## 🧩 Component Architecture

### Complexity Analysis

This component has **HIGH COMPLEXITY** due to:
- **Nested Forms:** Schema metadata + dynamic field array + new field form
- **State Synchronization:** React Hook Form + drag-drop + optimistic UI
- **Real-Time Validation:** Duplicate checks, show_on_card limit, type-specific config
- **Accessibility:** Keyboard navigation for drag-drop + form fields

**RECOMMENDATION:** Split into 5 sub-tasks (#83a-#83e) for manageable implementation.

### Sub-Component Breakdown

```
SchemaEditor (Task #83a - Main Shell)
├── SchemaMetadataFields (inline in SchemaEditor)
│   ├── Schema Name (required)
│   └── Description (optional)
├── FieldSelector (Task #83b - 3-4 hours)
│   └── Combobox multi-select from existing fields
├── NewFieldForm (Task #83c - 4-5 hours)
│   ├── Field Name Input + DuplicateWarning
│   ├── Field Type Selector (select, rating, text, boolean)
│   └── FieldConfigEditor (type-specific)
│       ├── RatingConfig (max_rating slider)
│       ├── SelectConfig (dynamic options list)
│       ├── TextConfig (optional max_length)
│       └── BooleanConfig (no config)
├── FieldOrderManager (Task #83d - 3-4 hours)
│   ├── SortableList (dnd-kit/sortable)
│   ├── FieldItem (draggable card)
│   └── ShowOnCardToggle (max 3 enforcement)
└── Form Validation (Task #83e - 2 hours)
    └── Zod schema with refinements
```

---

## 🛠️ Implementation Plan

### Phase 0: Prerequisites & Setup (30 min)

**Install Required Dependencies:**

```bash
cd frontend

# Install shadcn/ui components
npx shadcn@latest add command popover form input label select checkbox switch slider textarea

# Install dnd-kit sortable preset
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Create Feature Flag:**

`frontend/.env.development`
```bash
VITE_FEATURE_SCHEMA_EDITOR=false  # Set to true when ready
```

`frontend/src/config/featureFlags.ts`
```typescript
export const featureFlags = {
  // ... existing flags
  schemaEditor: import.meta.env.VITE_FEATURE_SCHEMA_EDITOR === 'true',
} as const
```

**Create Mock Hooks (until Tasks #79, #80 complete):**

`frontend/src/hooks/__mocks__/useCustomFields.ts`
```typescript
import { useMutation, useQuery } from '@tanstack/react-query'

// Mock API responses
const mockFields = [
  { id: '1', name: 'Presentation Quality', field_type: 'select', config: { options: ['bad', 'good', 'great'] } },
  { id: '2', name: 'Overall Rating', field_type: 'rating', config: { max_rating: 5 } },
]

export function useCustomFields(listId: string) {
  return useQuery({
    queryKey: ['custom-fields', listId],
    queryFn: async () => mockFields,
  })
}

export function useCheckFieldDuplicate(listId: string) {
  return useMutation({
    mutationFn: async (name: string) => {
      // Simulate 300ms API delay
      await new Promise(resolve => setTimeout(resolve, 300))
      const exists = mockFields.some(f => f.name.toLowerCase() === name.toLowerCase())
      return { exists, field: exists ? mockFields[0] : null }
    },
  })
}

export function useCreateField(listId: string) {
  return useMutation({
    mutationFn: async (data: any) => {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id: Date.now().toString(), ...data }
    },
  })
}
```

---

### Task #83a: SchemaEditor Main Shell (2 hours)

**Goal:** Create container component with form state management and basic structure.

**Files:**
- `frontend/src/components/schemas/SchemaEditor.tsx` (NEW)
- `frontend/src/components/schemas/SchemaEditor.test.tsx` (NEW)

**Implementation:**

`frontend/src/components/schemas/SchemaEditor.tsx`
```typescript
import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// Zod Schema with Nested Validation
const schemaFormSchema = z.object({
  name: z.string()
    .min(1, 'Schema-Name ist erforderlich')
    .max(255, 'Schema-Name darf maximal 255 Zeichen lang sein'),
  description: z.string().optional(),
  fields: z.array(z.object({
    field_id: z.string().uuid(),
    display_order: z.number().int().min(0),
    show_on_card: z.boolean(),
  }))
    .min(1, 'Mindestens ein Feld ist erforderlich')
    .refine(
      (fields) => fields.filter(f => f.show_on_card).length <= 3,
      'Maximal 3 Felder können auf der Karte angezeigt werden'
    )
    .refine(
      (fields) => {
        const orders = fields.map(f => f.display_order)
        return new Set(orders).size === orders.length
      },
      'Anzeigereihenfolge muss eindeutig sein'
    ),
})

type SchemaFormData = z.infer<typeof schemaFormSchema>

interface SchemaEditorProps {
  listId: string
  onSave: (data: SchemaFormData) => Promise<void>
  onCancel: () => void
  initialData?: Partial<SchemaFormData>
}

export function SchemaEditor({ listId, onSave, onCancel, initialData }: SchemaEditorProps) {
  const [isCreatingField, setIsCreatingField] = useState(false)

  const form = useForm<SchemaFormData>({
    resolver: zodResolver(schemaFormSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      fields: initialData?.fields ?? [],
    },
  })

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'fields',
  })

  const handleSubmit = async (data: SchemaFormData) => {
    try {
      await onSave(data)
    } catch (error) {
      // Error handling in parent component
      throw error
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Schema Metadata */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="schema-name">Schema-Name *</Label>
          <Input
            id="schema-name"
            {...form.register('name')}
            placeholder="z.B. Video Quality, Content Metrics"
            aria-invalid={!!form.formState.errors.name}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="schema-description">Beschreibung (optional)</Label>
          <Textarea
            id="schema-description"
            {...form.register('description')}
            placeholder="Kurze Beschreibung des Schemas..."
            rows={2}
          />
        </div>
      </div>

      {/* Field Selection & Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Felder ({fields.length})</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingField(true)}
            >
              + Neues Feld
            </Button>
            {/* FieldSelector Button (Task #83b) */}
          </div>
        </div>

        {/* NewFieldForm (Task #83c) */}
        {isCreatingField && (
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">NewFieldForm placeholder</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreatingField(false)}
            >
              Abbrechen
            </Button>
          </div>
        )}

        {/* FieldOrderManager (Task #83d) */}
        {fields.length > 0 ? (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="p-3 border rounded-lg">
                <p className="text-sm">Field {index + 1} (Placeholder)</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Noch keine Felder hinzugefügt. Erstellen Sie ein neues Feld oder wählen Sie vorhandene aus.
          </p>
        )}

        {form.formState.errors.fields?.root && (
          <p className="text-sm text-red-600">{form.formState.errors.fields.root.message}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Wird gespeichert...' : 'Schema erstellen'}
        </Button>
      </div>
    </form>
  )
}
```

**Tests (5 scenarios):**

`frontend/src/components/schemas/SchemaEditor.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SchemaEditor } from './SchemaEditor'

describe('SchemaEditor', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  it('renders schema metadata fields', () => {
    render(<SchemaEditor listId="list-1" onSave={mockOnSave} onCancel={mockOnCancel} />)
    
    expect(screen.getByLabelText(/schema-name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/beschreibung/i)).toBeInTheDocument()
  })

  it('shows validation error for empty schema name', async () => {
    const user = userEvent.setup()
    render(<SchemaEditor listId="list-1" onSave={mockOnSave} onCancel={mockOnCancel} />)
    
    await user.click(screen.getByRole('button', { name: /schema erstellen/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/schema-name ist erforderlich/i)).toBeInTheDocument()
    })
  })

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    render(<SchemaEditor listId="list-1" onSave={mockOnSave} onCancel={mockOnCancel} />)
    
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    
    expect(mockOnCancel).toHaveBeenCalledOnce()
  })

  it('shows new field form when "Neues Feld" clicked', async () => {
    const user = userEvent.setup()
    render(<SchemaEditor listId="list-1" onSave={mockOnSave} onCancel={mockOnCancel} />)
    
    await user.click(screen.getByRole('button', { name: /neues feld/i }))
    
    expect(screen.getByText(/newfieldform placeholder/i)).toBeInTheDocument()
  })

  it('shows empty state when no fields added', () => {
    render(<SchemaEditor listId="list-1" onSave={mockOnSave} onCancel={mockOnCancel} />)
    
    expect(screen.getByText(/noch keine felder/i)).toBeInTheDocument()
  })
})
```

**Why This Approach:**
- Single `useForm` hook manages all state (schema metadata + fields array)
- `useFieldArray` for dynamic fields with stable `field.id` keys
- Zod refinements enforce business rules (max 3 show_on_card, unique display_order)
- Placeholders for sub-components allow independent development
- Form submission delegated to parent (TagEditDialog) for flexibility

**Alternatives Considered:**
- Multiple `useForm` instances: ❌ Requires manual state sync, validation conflicts
- Formik instead of React Hook Form: ❌ Larger bundle, less TypeScript support
- Manual state with useState: ❌ No built-in validation, more code

---

### Task #83b: FieldSelector Component (3-4 hours)

**Goal:** Multi-select dropdown for choosing existing custom fields.

**Files:**
- `frontend/src/components/schemas/FieldSelector.tsx` (NEW)
- `frontend/src/components/schemas/FieldSelector.test.tsx` (NEW)

**Implementation:**

`frontend/src/components/schemas/FieldSelector.tsx`
```typescript
import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useCustomFields } from '@/hooks/useCustomFields'
import { cn } from '@/lib/utils'

interface FieldSelectorProps {
  listId: string
  selectedFieldIds: string[]
  onFieldsSelected: (fieldIds: string[]) => void
}

export function FieldSelector({ listId, selectedFieldIds, onFieldsSelected }: FieldSelectorProps) {
  const [open, setOpen] = useState(false)
  const { data: fields, isLoading } = useCustomFields(listId)

  const handleSelect = (fieldId: string) => {
    const isSelected = selectedFieldIds.includes(fieldId)
    
    if (isSelected) {
      onFieldsSelected(selectedFieldIds.filter(id => id !== fieldId))
    } else {
      onFieldsSelected([...selectedFieldIds, fieldId])
    }
  }

  const selectedCount = selectedFieldIds.length
  const availableFields = fields?.filter(f => !selectedFieldIds.includes(f.id)) ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Vorhandene Felder auswählen"
          className="w-full justify-between"
        >
          {selectedCount > 0 
            ? `${selectedCount} Feld${selectedCount > 1 ? 'er' : ''} ausgewählt`
            : 'Vorhandene Felder auswählen'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Felder suchen..." />
          <CommandEmpty>
            {isLoading ? 'Lädt...' : 'Keine Felder gefunden.'}
          </CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {availableFields.map((field) => (
              <CommandItem
                key={field.id}
                value={field.name}
                onSelect={() => handleSelect(field.id)}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedFieldIds.includes(field.id) ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex-1">
                  <div className="font-medium">{field.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {field.field_type === 'rating' && `Rating (max ${field.config.max_rating})`}
                    {field.field_type === 'select' && `Auswahl (${field.config.options.length} Optionen)`}
                    {field.field_type === 'text' && 'Text'}
                    {field.field_type === 'boolean' && 'Ja/Nein'}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

**Integration into SchemaEditor:**

```typescript
// In SchemaEditor.tsx, replace placeholder button
import { FieldSelector } from './FieldSelector'

// Add handler
const handleFieldsSelected = (fieldIds: string[]) => {
  fieldIds.forEach((fieldId, index) => {
    append({
      field_id: fieldId,
      display_order: fields.length + index,
      show_on_card: false,
    })
  })
}

// In JSX
<FieldSelector
  listId={listId}
  selectedFieldIds={fields.map(f => f.field_id)}
  onFieldsSelected={handleFieldsSelected}
/>
```

**Tests (8 scenarios):**

```typescript
describe('FieldSelector', () => {
  it('renders trigger button with correct label')
  it('opens popover when trigger clicked')
  it('displays available fields in list')
  it('filters fields based on search input')
  it('shows checkmark for selected fields')
  it('adds field when unselected item clicked')
  it('removes field when selected item clicked')
  it('shows empty state when no fields available')
})
```

**Why Combobox Pattern:**
- Searchable: Scales to 50+ custom fields
- Multi-select: Clear visual feedback with checkmarks
- Keyboard navigation: Built-in with Command component
- Accessible: ARIA roles from Radix UI primitives

---

### Task #83c: NewFieldForm Component (4-5 hours)

**Goal:** Inline form for creating new custom fields with type-specific configuration.

**Files:**
- `frontend/src/components/schemas/NewFieldForm.tsx` (NEW)
- `frontend/src/components/schemas/FieldConfigEditor.tsx` (NEW)
- `frontend/src/components/schemas/DuplicateWarning.tsx` (NEW)
- `frontend/src/components/schemas/NewFieldForm.test.tsx` (NEW)

**Implementation:**

`frontend/src/components/schemas/NewFieldForm.tsx`
```typescript
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateField, useCheckFieldDuplicate } from '@/hooks/useCustomFields'
import { FieldConfigEditor } from './FieldConfigEditor'
import { DuplicateWarning } from './DuplicateWarning'
import { useDebounce } from '@/hooks/useDebounce'

const newFieldSchema = z.object({
  name: z.string()
    .min(1, 'Feldname ist erforderlich')
    .max(255, 'Feldname darf maximal 255 Zeichen lang sein'),
  field_type: z.enum(['select', 'rating', 'text', 'boolean']),
  config: z.record(z.any()), // Type-specific, validated by FieldConfigEditor
})

type NewFieldFormData = z.infer<typeof newFieldSchema>

interface NewFieldFormProps {
  listId: string
  onFieldCreated: (fieldId: string) => void
  onCancel: () => void
}

export function NewFieldForm({ listId, onFieldCreated, onCancel }: NewFieldFormProps) {
  const [fieldName, setFieldName] = useState('')
  const debouncedName = useDebounce(fieldName, 300)
  
  const form = useForm<NewFieldFormData>({
    resolver: zodResolver(newFieldSchema),
    defaultValues: {
      name: '',
      field_type: 'text',
      config: {},
    },
  })

  const createField = useCreateField(listId)
  const checkDuplicate = useCheckFieldDuplicate(listId)

  // Duplicate check on debounced name change
  useEffect(() => {
    if (debouncedName.length > 0) {
      checkDuplicate.mutate(debouncedName)
    }
  }, [debouncedName])

  const handleSubmit = async (data: NewFieldFormData) => {
    // Don't submit if duplicate exists
    if (checkDuplicate.data?.exists) {
      return
    }

    try {
      const newField = await createField.mutateAsync(data)
      onFieldCreated(newField.id)
      form.reset()
    } catch (error) {
      // Error handling
      console.error('Failed to create field:', error)
    }
  }

  const fieldType = form.watch('field_type')

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Neues Feld erstellen</h4>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          ✕
        </Button>
      </div>

      {/* Field Name */}
      <div>
        <Label htmlFor="new-field-name">Feldname *</Label>
        <Input
          id="new-field-name"
          {...form.register('name')}
          onChange={(e) => {
            form.register('name').onChange(e)
            setFieldName(e.target.value)
          }}
          placeholder="z.B. Presentation Quality, Difficulty"
          aria-invalid={!!form.formState.errors.name}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
        )}
        
        <DuplicateWarning
          isChecking={checkDuplicate.isPending}
          duplicate={checkDuplicate.data}
        />
      </div>

      {/* Field Type Selector */}
      <div>
        <Label htmlFor="field-type">Feldtyp *</Label>
        <Select
          value={fieldType}
          onValueChange={(value) => form.setValue('field_type', value as any)}
        >
          <SelectTrigger id="field-type">
            <SelectValue placeholder="Feldtyp auswählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="select">Auswahl (Dropdown)</SelectItem>
            <SelectItem value="rating">Bewertung (Sterne)</SelectItem>
            <SelectItem value="boolean">Ja/Nein</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Type-Specific Config */}
      <FieldConfigEditor
        fieldType={fieldType}
        config={form.watch('config')}
        onChange={(config) => form.setValue('config', config)}
      />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button
          type="submit"
          disabled={createField.isPending || checkDuplicate.data?.exists}
        >
          {createField.isPending ? 'Erstellt...' : 'Feld hinzufügen'}
        </Button>
      </div>
    </form>
  )
}
```

`frontend/src/components/schemas/DuplicateWarning.tsx`
```typescript
import { AlertCircle, CheckCircle } from 'lucide-react'

interface DuplicateWarningProps {
  isChecking: boolean
  duplicate: { exists: boolean; field: any } | undefined
}

export function DuplicateWarning({ isChecking, duplicate }: DuplicateWarningProps) {
  if (isChecking) {
    return (
      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
        Prüfe auf Duplikate...
      </div>
    )
  }

  if (duplicate?.exists) {
    return (
      <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
        <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-yellow-800">
            Ein Feld mit diesem Namen existiert bereits
          </p>
          <p className="text-yellow-700 mt-1">
            "{duplicate.field.name}" ({duplicate.field.field_type})
          </p>
        </div>
      </div>
    )
  }

  // Name is unique
  if (duplicate !== undefined && !duplicate.exists) {
    return (
      <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        Feldname verfügbar
      </div>
    )
  }

  return null
}
```

`frontend/src/components/schemas/FieldConfigEditor.tsx`
```typescript
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { X } from 'lucide-react'

interface FieldConfigEditorProps {
  fieldType: 'select' | 'rating' | 'text' | 'boolean'
  config: Record<string, any>
  onChange: (config: Record<string, any>) => void
}

export function FieldConfigEditor({ fieldType, config, onChange }: FieldConfigEditorProps) {
  switch (fieldType) {
    case 'rating':
      return (
        <div className="space-y-2">
          <Label>Maximale Bewertung</Label>
          <div className="flex items-center gap-4">
            <Slider
              min={1}
              max={10}
              step={1}
              value={[config.max_rating ?? 5]}
              onValueChange={([value]) => onChange({ max_rating: value })}
              className="flex-1"
            />
            <span className="text-sm font-medium w-8 text-center">
              {config.max_rating ?? 5}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Nutzer können von 1 bis {config.max_rating ?? 5} Sterne vergeben
          </p>
        </div>
      )

    case 'select':
      return (
        <SelectOptionsConfig
          options={config.options ?? []}
          onChange={(options) => onChange({ options })}
        />
      )

    case 'text':
      return (
        <div className="space-y-2">
          <Label htmlFor="max-length">Maximale Länge (optional)</Label>
          <Input
            id="max-length"
            type="number"
            min={1}
            max={5000}
            value={config.max_length ?? ''}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value) : undefined
              onChange({ max_length: value })
            }}
            placeholder="Keine Begrenzung"
          />
        </div>
      )

    case 'boolean':
      return (
        <p className="text-sm text-muted-foreground">
          Ja/Nein-Felder benötigen keine Konfiguration.
        </p>
      )
  }
}

function SelectOptionsConfig({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const [newOption, setNewOption] = useState('')

  const addOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      onChange([...options, newOption.trim()])
      setNewOption('')
    }
  }

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <Label>Auswahloptionen</Label>
      
      {/* Existing Options */}
      <div className="space-y-1">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-background border rounded">
            <span className="flex-1 text-sm">{option}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeOption(index)}
              aria-label={`Option "${option}" entfernen`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add New Option */}
      <div className="flex gap-2">
        <Input
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
          placeholder="Neue Option hinzufügen..."
        />
        <Button type="button" onClick={addOption} disabled={!newOption.trim()}>
          Hinzufügen
        </Button>
      </div>

      {options.length === 0 && (
        <p className="text-sm text-yellow-600">
          Mindestens eine Option erforderlich
        </p>
      )}
    </div>
  )
}
```

`frontend/src/hooks/useDebounce.ts` (NEW)
```typescript
import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
```

**Tests (12 scenarios):**

```typescript
describe('NewFieldForm', () => {
  it('renders form fields')
  it('validates required field name')
  it('validates max field name length (255)')
  it('shows duplicate warning when name exists')
  it('debounces duplicate check (300ms)')
  it('enables submit only when no duplicate')
  it('calls onFieldCreated with new field ID on success')
  it('resets form after successful creation')
  it('shows loading state during creation')
  it('calls onCancel when cancel clicked')
  it('switches config editor based on field type')
  it('validates select field has at least one option')
})

describe('FieldConfigEditor', () => {
  it('renders rating slider with max value')
  it('renders select options list with add/remove')
  it('renders text max_length input')
  it('renders boolean no-config message')
})

describe('DuplicateWarning', () => {
  it('shows loading spinner when checking')
  it('shows error when duplicate exists')
  it('shows success checkmark when name available')
  it('shows nothing initially')
})
```

---

### Task #83d: FieldOrderManager Component (3-4 hours)

**Goal:** Drag-and-drop sortable list with show_on_card toggles (max 3 enforcement).

**Files:**
- `frontend/src/components/schemas/FieldOrderManager.tsx` (NEW)
- `frontend/src/components/schemas/FieldOrderManager.test.tsx` (NEW)

**Implementation:**

`frontend/src/components/schemas/FieldOrderManager.tsx`
```typescript
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface FieldItem {
  id: string // field.id from useFieldArray
  field_id: string
  display_order: number
  show_on_card: boolean
  // Field metadata for display
  field_name: string
  field_type: string
}

interface FieldOrderManagerProps {
  fields: FieldItem[]
  onReorder: (activeId: string, overId: string) => void
  onToggleShowOnCard: (fieldId: string, show: boolean) => void
  onRemove: (fieldId: string) => void
}

export function FieldOrderManager({ fields, onReorder, onToggleShowOnCard, onRemove }: FieldOrderManagerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  const showOnCardCount = fields.filter(f => f.show_on_card).length
  const canEnableMore = showOnCardCount < 3

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
          onReorder(active.id as string, over.id as string)
        }
      }}
    >
      <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {fields.map((field) => (
            <SortableFieldItem
              key={field.id}
              field={field}
              canEnableShowOnCard={canEnableMore || field.show_on_card}
              onToggleShowOnCard={onToggleShowOnCard}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableFieldItem({ field, canEnableShowOnCard, onToggleShowOnCard, onRemove }: {
  field: FieldItem
  canEnableShowOnCard: boolean
  onToggleShowOnCard: (fieldId: string, show: boolean) => void
  onRemove: (fieldId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-background border rounded-lg"
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        aria-label="Feld verschieben"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Field Info */}
      <div className="flex-1">
        <div className="font-medium">{field.field_name}</div>
        <div className="text-sm text-muted-foreground">
          {field.field_type === 'rating' && 'Bewertung'}
          {field.field_type === 'select' && 'Auswahl'}
          {field.field_type === 'text' && 'Text'}
          {field.field_type === 'boolean' && 'Ja/Nein'}
        </div>
      </div>

      {/* Show on Card Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id={`show-${field.id}`}
          checked={field.show_on_card}
          onCheckedChange={(checked) => onToggleShowOnCard(field.field_id, checked)}
          disabled={!canEnableShowOnCard && !field.show_on_card}
          aria-label={`Auf Karte anzeigen: ${field.field_name}`}
        />
        <Label htmlFor={`show-${field.id}`} className="text-sm cursor-pointer">
          {field.show_on_card ? (
            <Eye className="h-4 w-4 text-green-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </Label>
      </div>

      {/* Remove Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onRemove(field.field_id)}
        aria-label={`Feld "${field.field_name}" entfernen`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

**Integration into SchemaEditor:**

```typescript
// In SchemaEditor.tsx
import { FieldOrderManager } from './FieldOrderManager'
import { useCustomFields } from '@/hooks/useCustomFields'

// Fetch full field details for display
const { data: allFields } = useCustomFields(listId)

// Map fields array to include metadata
const fieldsWithMetadata = fields.map(f => ({
  ...f,
  field_name: allFields?.find(af => af.id === f.field_id)?.name ?? 'Unknown',
  field_type: allFields?.find(af => af.id === f.field_id)?.field_type ?? 'text',
}))

// Handlers
const handleReorder = (activeId: string, overId: string) => {
  const oldIndex = fields.findIndex(f => f.id === activeId)
  const newIndex = fields.findIndex(f => f.id === overId)
  
  move(oldIndex, newIndex)
  
  // Update display_order for all fields
  const reordered = [...fields]
  reordered.forEach((f, index) => {
    form.setValue(`fields.${index}.display_order`, index)
  })
}

const handleToggleShowOnCard = (fieldId: string, show: boolean) => {
  const index = fields.findIndex(f => f.field_id === fieldId)
  if (index !== -1) {
    form.setValue(`fields.${index}.show_on_card`, show)
  }
}

const handleRemoveField = (fieldId: string) => {
  const index = fields.findIndex(f => f.field_id === fieldId)
  if (index !== -1) {
    remove(index)
  }
}

// In JSX (replace placeholder)
<FieldOrderManager
  fields={fieldsWithMetadata}
  onReorder={handleReorder}
  onToggleShowOnCard={handleToggleShowOnCard}
  onRemove={handleRemoveField}
/>
```

**Tests (9 scenarios):**

```typescript
describe('FieldOrderManager', () => {
  it('renders all fields in order')
  it('reorders fields on drag-drop')
  it('updates display_order after reorder')
  it('toggles show_on_card when switch clicked')
  it('disables switch when max 3 already enabled')
  it('allows disabling show_on_card when at max')
  it('removes field when X button clicked')
  it('supports keyboard navigation (Arrow keys + Space/Enter)')
  it('shows visual feedback during drag (opacity 0.5)')
})
```

**Why @dnd-kit/sortable:**
- Built-in keyboard support (Arrow keys + Space/Enter to drop)
- Automatic reordering logic with `move()` helper
- Touch-friendly (works on mobile)
- WCAG 2.1 compliant with ARIA live regions

**Alternatives Considered:**
- react-beautiful-dnd: ❌ No longer maintained, no React 18 support
- Manual useDraggable: ❌ Requires ~200 LOC for collision detection
- No drag-drop (manual up/down buttons): ❌ Poor UX for 5+ fields

---

### Task #83e: Form Validation & Integration (2 hours)

**Goal:** Final validation, error handling, and integration into TagEditDialog.

**Files:**
- Update `frontend/src/components/CreateTagDialog.tsx` (extend for Task #82)
- `frontend/src/components/schemas/SchemaEditor.integration.test.tsx` (NEW)

**Validation Enhancements:**

```typescript
// In SchemaEditor.tsx, enhance Zod schema
const schemaFormSchema = z.object({
  name: z.string()
    .min(1, 'Schema-Name ist erforderlich')
    .max(255, 'Schema-Name darf maximal 255 Zeichen lang sein')
    .refine(
      (name) => name.trim().length > 0,
      'Schema-Name darf nicht nur aus Leerzeichen bestehen'
    ),
  description: z.string().max(1000, 'Beschreibung darf maximal 1000 Zeichen lang sein').optional(),
  fields: z.array(z.object({
    field_id: z.string().uuid('Ungültige Feld-ID'),
    display_order: z.number().int().min(0),
    show_on_card: z.boolean(),
  }))
    .min(1, 'Mindestens ein Feld ist erforderlich')
    .max(20, 'Maximal 20 Felder pro Schema erlaubt')
    .refine(
      (fields) => fields.filter(f => f.show_on_card).length <= 3,
      {
        message: 'Maximal 3 Felder können auf der Karte angezeigt werden',
        path: ['show_on_card'],
      }
    )
    .refine(
      (fields) => {
        const orders = fields.map(f => f.display_order)
        return new Set(orders).size === orders.length
      },
      {
        message: 'Anzeigereihenfolge muss eindeutig sein',
        path: ['display_order'],
      }
    )
    .refine(
      (fields) => {
        const ids = fields.map(f => f.field_id)
        return new Set(ids).size === ids.length
      },
      {
        message: 'Ein Feld kann nicht mehrfach hinzugefügt werden',
        path: ['field_id'],
      }
    ),
})
```

**Integration Test (E2E Flow):**

`frontend/src/components/schemas/SchemaEditor.integration.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SchemaEditor } from './SchemaEditor'

describe('SchemaEditor Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  it('creates schema with new field end-to-end', async () => {
    const user = userEvent.setup()
    const mockOnSave = vi.fn().mockResolvedValue(undefined)

    render(
      <QueryClientProvider client={queryClient}>
        <SchemaEditor listId="list-1" onSave={mockOnSave} onCancel={vi.fn()} />
      </QueryClientProvider>
    )

    // Step 1: Enter schema name
    await user.type(screen.getByLabelText(/schema-name/i), 'Video Quality')

    // Step 2: Open new field form
    await user.click(screen.getByRole('button', { name: /neues feld/i }))

    // Step 3: Create new field
    await user.type(screen.getByLabelText(/feldname/i), 'Presentation Quality')
    await user.click(screen.getByRole('combobox', { name: /feldtyp/i }))
    await user.click(screen.getByRole('option', { name: /auswahl/i }))

    // Step 4: Add select options
    await user.type(screen.getByPlaceholderText(/neue option/i), 'bad')
    await user.click(screen.getByRole('button', { name: /hinzufügen/i }))
    await user.type(screen.getByPlaceholderText(/neue option/i), 'good')
    await user.click(screen.getByRole('button', { name: /hinzufügen/i }))

    // Step 5: Add field to schema
    await user.click(screen.getByRole('button', { name: /feld hinzufügen/i }))

    // Step 6: Verify field appears in list
    await waitFor(() => {
      expect(screen.getByText('Presentation Quality')).toBeInTheDocument()
    })

    // Step 7: Enable show_on_card
    const showOnCardSwitch = screen.getByLabelText(/auf karte anzeigen.*presentation/i)
    await user.click(showOnCardSwitch)

    // Step 8: Submit schema
    await user.click(screen.getByRole('button', { name: /schema erstellen/i }))

    // Step 9: Verify onSave called with correct data
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Video Quality',
        description: '',
        fields: [{
          field_id: expect.any(String),
          display_order: 0,
          show_on_card: true,
        }],
      })
    })
  })

  it('enforces max 3 show_on_card limit', async () => {
    const user = userEvent.setup()
    
    // Setup: Schema with 3 fields already shown on card
    render(
      <QueryClientProvider client={queryClient}>
        <SchemaEditor
          listId="list-1"
          onSave={vi.fn()}
          onCancel={vi.fn()}
          initialData={{
            fields: [
              { field_id: 'f1', display_order: 0, show_on_card: true },
              { field_id: 'f2', display_order: 1, show_on_card: true },
              { field_id: 'f3', display_order: 2, show_on_card: true },
              { field_id: 'f4', display_order: 3, show_on_card: false },
            ],
          }}
        />
      </QueryClientProvider>
    )

    // Try to enable 4th field
    const fourthFieldSwitch = screen.getAllByRole('switch')[3]
    expect(fourthFieldSwitch).toBeDisabled()

    // Disable one of the first 3
    const firstFieldSwitch = screen.getAllByRole('switch')[0]
    await user.click(firstFieldSwitch)

    // Now 4th field should be enabled
    await waitFor(() => {
      expect(fourthFieldSwitch).not.toBeDisabled()
    })
  })

  it('prevents duplicate field names', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <SchemaEditor listId="list-1" onSave={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>
    )

    await user.click(screen.getByRole('button', { name: /neues feld/i }))
    
    // Type existing field name (mocked in useCheckFieldDuplicate)
    await user.type(screen.getByLabelText(/feldname/i), 'Presentation Quality')

    // Wait for debounced check
    await waitFor(() => {
      expect(screen.getByText(/feld mit diesem namen existiert bereits/i)).toBeInTheDocument()
    }, { timeout: 500 })

    // Submit button should be disabled
    const submitButton = screen.getByRole('button', { name: /feld hinzufügen/i })
    expect(submitButton).toBeDisabled()
  })
})
```

**Error Handling:**

```typescript
// In SchemaEditor.tsx
const handleSubmit = async (data: SchemaFormData) => {
  try {
    await onSave(data)
  } catch (error: any) {
    // Show error toast or inline error
    if (error.response?.status === 409) {
      form.setError('name', {
        message: 'Ein Schema mit diesem Namen existiert bereits',
      })
    } else if (error.response?.status === 422) {
      // Validation error from backend
      form.setError('root', {
        message: error.response.data.detail || 'Validierungsfehler',
      })
    } else {
      form.setError('root', {
        message: 'Fehler beim Speichern des Schemas. Bitte versuchen Sie es erneut.',
      })
    }
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests (per component)

**SchemaEditor.test.tsx (5 tests)**
- Renders schema metadata fields
- Shows validation error for empty schema name
- Calls onCancel when cancel clicked
- Shows new field form when button clicked
- Shows empty state when no fields added

**FieldSelector.test.tsx (8 tests)**
- Renders trigger button
- Opens popover on click
- Displays available fields
- Filters fields by search
- Shows checkmarks for selected
- Adds field on click
- Removes field on click
- Shows empty state

**NewFieldForm.test.tsx (12 tests)**
- Renders form fields
- Validates required name
- Validates max name length
- Shows duplicate warning
- Debounces duplicate check
- Disables submit when duplicate
- Calls onFieldCreated on success
- Resets form after creation
- Shows loading state
- Calls onCancel
- Switches config editor by type
- Validates select has options

**FieldOrderManager.test.tsx (9 tests)**
- Renders fields in order
- Reorders on drag-drop
- Updates display_order
- Toggles show_on_card
- Disables switch at max 3
- Allows disabling at max
- Removes field on click
- Keyboard navigation works
- Visual feedback during drag

**TOTAL: 34 unit tests**

### Integration Tests

**SchemaEditor.integration.test.tsx (3 tests)**
- Creates schema with new field E2E
- Enforces max 3 show_on_card
- Prevents duplicate field names

### Manual Testing Checklist

**Functional Testing:**
- [ ] Create schema with 1 field
- [ ] Create schema with 5 fields
- [ ] Reorder fields via drag-drop
- [ ] Reorder fields via keyboard
- [ ] Toggle show_on_card (enable 3, try 4th)
- [ ] Create new field (all 4 types)
- [ ] Select existing fields (1, 3, 5 fields)
- [ ] Duplicate check shows warning
- [ ] Form validation prevents submit
- [ ] Cancel resets form state

**Accessibility Testing:**
- [ ] Tab through all form fields
- [ ] Screen reader announces errors
- [ ] Drag-drop works with keyboard
- [ ] ARIA labels present on all inputs
- [ ] Focus management after actions

**Edge Cases:**
- [ ] Schema with 0 fields (shows error)
- [ ] Schema with 21 fields (max 20 error)
- [ ] Field name with 256 characters (max 255 error)
- [ ] Duplicate field name (case-insensitive)
- [ ] Network error during field creation
- [ ] Slow API response (debounce works)

---

## 📚 Reference Documentation

### Design Document References

**Custom Fields System Design (2025-11-05):**
- Lines 330-359: TagEditDialog extension architecture
- Lines 352-359: SchemaEditor sub-components specification
- Lines 501-520: User flow example (11-step walkthrough)

**Latest Handoff Log (2025-11-07):**
- Task #65 completion: FieldSchema Pydantic schemas available
- Backend validation rules: max 3 show_on_card, unique display_order, unique field_ids

### External Documentation

**React Hook Form:**
- useFieldArray: https://react-hook-form.com/docs/usefieldarray
- Controller pattern: https://react-hook-form.com/docs/usecontroller/controller
- Zod resolver: https://github.com/react-hook-form/resolvers#zod

**dnd-kit:**
- Getting Started: https://docs.dndkit.com/introduction/getting-started
- Sortable Preset: https://docs.dndkit.com/presets/sortable
- Accessibility: https://docs.dndkit.com/guides/accessibility

**shadcn/ui:**
- Form Component: https://ui.shadcn.com/docs/components/form
- Combobox: https://ui.shadcn.com/docs/components/combobox
- Command: https://ui.shadcn.com/docs/components/command

**TanStack Query:**
- Optimistic Updates: https://tanstack.com/query/latest/docs/react/guides/optimistic-updates
- Mutations: https://tanstack.com/query/latest/docs/react/guides/mutations

---

## ⏱️ Time Estimates

### Detailed Breakdown

| Task | Description | Estimated Time |
|------|-------------|----------------|
| **Task #83a** | SchemaEditor main shell + form state | 2 hours |
| **Task #83b** | FieldSelector combobox multi-select | 3-4 hours |
| **Task #83c** | NewFieldForm with duplicate check + FieldConfigEditor | 4-5 hours |
| **Task #83d** | FieldOrderManager with drag-drop | 3-4 hours |
| **Task #83e** | Validation + integration tests | 2 hours |
| **Total** | **14-17 hours** |

### Risk Factors

**High Risk (may add 20-40% time):**
- dnd-kit integration issues with React Hook Form
- Debounced duplicate check race conditions
- Max 3 show_on_card UI state synchronization bugs

**Mitigation:**
- REF MCP validation completed upfront (7 improvements identified)
- Mock hooks allow parallel development with Tasks #79, #80
- Split into sub-tasks enables staged testing

---

## 🚀 Recommended Execution Strategy

### Option 1: Serial Implementation (14-17 hours)

**Pros:** Lower cognitive load, easier debugging
**Cons:** Longer calendar time, blocked on dependencies

**Timeline:**
1. Day 1: Task #83a (2h) + Task #83b (4h) = 6 hours
2. Day 2: Task #83c (5h) + Task #83d start (2h) = 7 hours
3. Day 3: Task #83d finish (2h) + Task #83e (2h) = 4 hours

### Option 2: Split into Sub-Tasks (Recommended)

**Create separate task tickets:**
- Task #83a: SchemaEditor Shell (2h) - Priority: P0
- Task #83b: FieldSelector (4h) - Priority: P1
- Task #83c: NewFieldForm (5h) - Priority: P1
- Task #83d: FieldOrderManager (4h) - Priority: P2
- Task #83e: Integration (2h) - Priority: P3

**Benefits:**
- Parallel development possible (Task #83b + #83c)
- Earlier code reviews (quality gates after each sub-task)
- Easier rollback if issues discovered
- Progress tracking more granular

### Option 3: Staged Rollout with Feature Flag

**Phase 1 (MVP):** Task #83a + #83b only (6 hours)
- Basic schema creation with field selection
- No new field creation yet
- Feature flag: OFF in production

**Phase 2:** Add Task #83c (11 hours total)
- Enable inline field creation
- Still feature flag: OFF

**Phase 3:** Add Task #83d + #83e (17 hours total)
- Full drag-drop + validation
- Feature flag: ON for beta users

**Benefits:** Risk reduction, faster MVP, user feedback earlier

---

## 🎯 Success Criteria

**Must Have (MVP):**
- [ ] Schema creation with name + description
- [ ] Select existing fields (multi-select)
- [ ] Create new fields inline (all 4 types)
- [ ] Drag-drop reordering works
- [ ] Show-on-card toggles (max 3 enforced)
- [ ] Duplicate check prevents duplicate names
- [ ] 34+ tests passing
- [ ] 0 TypeScript errors
- [ ] WCAG 2.1 Level A compliant

**Should Have (Post-MVP):**
- [ ] Field preview (show example of how field will look on card)
- [ ] Schema templates (pre-filled common schemas)
- [ ] Bulk field import from CSV
- [ ] Field usage analytics (show count of videos using field)
- [ ] WCAG 2.1 Level AA compliant

**Nice to Have (Future):**
- [ ] AI-powered field suggestions based on tag name
- [ ] Drag-drop visual animations (smooth transitions)
- [ ] Undo/redo support
- [ ] Real-time collaboration (multiple users editing)

---

## 📝 Notes for Implementation

### Common Pitfalls to Avoid

**1. Using Array Index as Key in useFieldArray**
```typescript
// ❌ WRONG - breaks drag-drop
{fields.map((field, index) => (
  <div key={index}>...</div>
))}

// ✅ CORRECT - stable keys
{fields.map((field) => (
  <div key={field.id}>...</div>
))}
```

**2. Not Debouncing Duplicate Check**
```typescript
// ❌ WRONG - API spam
onChange={(e) => checkDuplicate(e.target.value)}

// ✅ CORRECT - debounce 300ms
const debouncedName = useDebounce(fieldName, 300)
useEffect(() => {
  if (debouncedName) checkDuplicate(debouncedName)
}, [debouncedName])
```

**3. Multiple useForm Hooks**
```typescript
// ❌ WRONG - state sync hell
const schemaForm = useForm()
const fieldForm = useForm()

// ✅ CORRECT - single form with nested paths
const form = useForm()
form.register('schema.name')
form.register('schema.fields[0].name')
```

**4. Forgetting AbortController for Duplicate Check**
```typescript
// ❌ WRONG - stale requests complete
checkDuplicate.mutate(name)

// ✅ CORRECT - cancel previous requests
const controller = new AbortController()
checkDuplicate.mutate(name, { signal: controller.signal })
return () => controller.abort()
```

**5. Max 3 show_on_card Enforcement Only in UI**
```typescript
// ❌ WRONG - only disable switch
<Switch disabled={showOnCardCount >= 3} />

// ✅ CORRECT - also validate in Zod schema
.refine(fields => fields.filter(f => f.show_on_card).length <= 3)
```

### Performance Considerations

**Lazy Load Field Metadata:**
- Don't fetch ALL custom fields upfront if list has 100+ fields
- Use pagination or virtual scrolling in FieldSelector dropdown

**Memoize Expensive Computations:**
```typescript
const fieldsWithMetadata = useMemo(() => 
  fields.map(f => ({
    ...f,
    field_name: allFields?.find(af => af.id === f.field_id)?.name
  })),
  [fields, allFields]
)
```

**Debounce Duplicate Check:**
- 300ms debounce prevents API spam during typing
- Cancel previous requests with AbortController

**Optimize Drag-Drop Rendering:**
- dnd-kit uses CSS transforms (not DOM mutations)
- Keep dragged item opacity at 0.5 (visual feedback without re-layout)

---

## 🔄 Integration with Task #82 (TagEditDialog Extension)

Task #82 will extend CreateTagDialog with SchemaEditor. Integration points:

**TagEditDialog Changes:**
```typescript
// In CreateTagDialog.tsx (Task #82)
import { SchemaEditor } from '@/components/schemas/SchemaEditor'
import { featureFlags } from '@/config/featureFlags'

const [showSchemaEditor, setShowSchemaEditor] = useState(false)

{featureFlags.schemaEditor && (
  <>
    <div className="border-t pt-4">
      <Label>Schema (optional)</Label>
      <Button
        type="button"
        variant="outline"
        onClick={() => setShowSchemaEditor(true)}
      >
        + Schema hinzufügen
      </Button>
    </div>

    {showSchemaEditor && (
      <SchemaEditor
        listId={listId}
        onSave={handleSchemaSave}
        onCancel={() => setShowSchemaEditor(false)}
      />
    )}
  </>
)}
```

**Schema Save Handler:**
```typescript
const handleSchemaSave = async (schemaData) => {
  // Create schema via API
  const newSchema = await createSchema.mutateAsync(schemaData)
  
  // Attach schema to tag
  setFormData({ ...formData, schema_id: newSchema.id })
  
  // Close editor
  setShowSchemaEditor(false)
}
```

---

## ✅ Completion Checklist

**Before Starting Implementation:**
- [ ] Install required dependencies (dnd-kit, shadcn components)
- [ ] Create feature flag in .env.development
- [ ] Set up mock hooks (useCustomFields, useSchemas)
- [ ] Review REF MCP improvements (all 7 applied to plan)

**During Implementation:**
- [ ] Follow TDD approach (write tests first for each sub-component)
- [ ] Use field.id as key (NOT array index)
- [ ] Debounce duplicate check with AbortController
- [ ] Validate max 3 show_on_card in Zod schema
- [ ] Add ARIA labels to all interactive elements

**After Implementation:**
- [ ] 34+ tests passing (unit + integration)
- [ ] 0 TypeScript errors
- [ ] Manual accessibility testing (keyboard nav, screen reader)
- [ ] Code review with focus on performance
- [ ] Update CLAUDE.md with SchemaEditor patterns
- [ ] Create comprehensive handoff log

**Integration with Task #82:**
- [ ] SchemaEditor exported from components/schemas/
- [ ] Feature flag checked in TagEditDialog
- [ ] onSave handler creates schema + attaches to tag
- [ ] E2E test: Create tag with schema with field

---

**END OF TASK PLAN**
