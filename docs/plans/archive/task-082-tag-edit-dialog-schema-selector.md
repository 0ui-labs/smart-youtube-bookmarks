# Task #82: Extend TagEditDialog with SchemaSelector Component

**Status:** Planning Complete
**Priority:** P1 (Blocks Task #83-89 frontend components)
**Estimated Time:** 3-4 hours
**Dependencies:**
- Task #80 (useSchemas hook) - Can be mocked for now
- Task #64-65 (Pydantic Schemas) - Completed
- Existing CreateTagDialog component

**Related Files:**
- Design Doc: `docs/plans/2025-11-05-custom-fields-system-design.md` (lines 322-358)
- Existing Component: `frontend/src/components/CreateTagDialog.tsx`
- Backend Tag Model: `backend/app/models/tag.py` (has schema_id field from Task #60)

---

## 🎯 Ziel (Goal)

Extend the existing `CreateTagDialog` component to support schema selection with three modes:
1. **No Schema** - Tag has no custom fields (existing behavior)
2. **Existing Schema** - Select from available schemas
3. **Create New** - Inline schema creation (deferred to Task #83)

This task focuses ONLY on the dropdown selector UI. Schema creation is Task #83.

---

## 📋 Acceptance Criteria

- [ ] CreateTagDialog extended with "Schema" section below color picker
- [ ] SchemaSelector dropdown with 3 options: "Kein Schema", existing schemas, "+ Neues Schema erstellen"
- [ ] Form state properly manages `schema_id` field (null | 'new' | UUID string)
- [ ] Schema selection updates form state correctly
- [ ] Backend API receives schema_id in create/update requests
- [ ] Existing CreateTagDialog functionality NOT broken (name, color still work)
- [ ] TypeScript types updated (Tag, TagCreate, TagUpdate)
- [ ] Accessibility maintained (ARIA labels, keyboard navigation)
- [ ] Tests passing (existing + new schema selection tests)
- [ ] Code reviewed

---

## 🛠️ Implementation Steps

### Step 1: Extend TypeScript Types with schema_id

**Files:** `frontend/src/types/tag.ts`
**Action:** Add optional schema_id field to Tag schemas

**Code (BEFORE):**
```typescript
export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const TagCreateSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})
```

**Code (AFTER):**
```typescript
export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  schema_id: z.string().uuid().nullable(),  // NEW: null = no schema
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const TagCreateSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  schema_id: z.string().uuid().nullable().optional(),  // NEW: optional for backwards compatibility
})

export const TagUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  schema_id: z.string().uuid().nullable().optional(),  // NEW: can update schema binding
})
```

**Why:** Backend already has schema_id field (Task #60). Frontend types must match API contract. Using `.nullable().optional()` allows backwards compatibility (field can be omitted or explicitly set to null).

**Trade-offs:**
- Alternative 1: `.nullable()` only (required field) - Would break existing API calls without schema_id
- Alternative 2: `.string().optional()` (no null) - Doesn't match backend which uses NULL for "no schema"
- Chosen: `.nullable().optional()` - Most flexible, matches backend, backwards compatible

---

### Step 2: Create Mock useSchemas Hook (Temporary)

**Files:** `frontend/src/hooks/useSchemas.ts` (NEW)
**Action:** Create placeholder hook until Task #80 is implemented

**Code:**
```typescript
import { useQuery } from '@tanstack/react-query'

/**
 * Temporary mock hook for Task #82
 * Will be replaced by full implementation in Task #80
 */
export interface FieldSchema {
  id: string
  list_id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
}

export const useSchemas = (listId: string) => {
  return useQuery({
    queryKey: ['schemas', listId],
    queryFn: async (): Promise<FieldSchema[]> => {
      // TODO (Task #80): Replace with real API call
      // return api.get(`/lists/${listId}/schemas`)
      return []  // Empty for now
    },
    enabled: false,  // Disable API calls until Task #80
  })
}
```

**Why:** Task #80 is pending, but we need the hook interface to develop the UI. Mock hook prevents errors and will be replaced with real implementation.

**Alternative:** Wait for Task #80 completion - Would block Task #82 unnecessarily.

---

### Step 3: Install shadcn/ui Select Component

**Command:**
```bash
cd frontend
npx shadcn@latest add select
```

**Files Created:**
- `frontend/src/components/ui/select.tsx`

**Why:** Need Radix UI Select component for accessible dropdown. shadcn/ui provides pre-styled wrapper with proper ARIA attributes.

**Verification:**
```bash
# Check if select.tsx was created
ls frontend/src/components/ui/select.tsx
```

---

### Step 4: Extend CreateTagDialog State with schema_id

**Files:** `frontend/src/components/CreateTagDialog.tsx`
**Action:** Add schema_id to form state, using discriminated union pattern

**Code (BEFORE):**
```typescript
export const CreateTagDialog = ({ open, onOpenChange }: CreateTagDialogProps) => {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [error, setError] = useState<string | null>(null)
  
  // ...
}
```

**Code (AFTER):**
```typescript
export const CreateTagDialog = ({ open, onOpenChange }: CreateTagDialogProps) => {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [schemaId, setSchemaId] = useState<string | null>(null)  // NEW: null | 'new' | UUID
  const [error, setError] = useState<string | null>(null)
  
  // ...
}
```

**Why:** Discriminated union pattern allows single state variable to handle all 3 modes:
- `null` = "Kein Schema" (no custom fields)
- `'new'` = "Create new schema" mode (triggers inline editor in Task #83)
- `UUID string` = Existing schema selected

**Alternative Approaches:**
1. **Two separate fields** (`mode: 'none'|'new'|'existing'` + `selectedSchemaId`)
   - ❌ More complex, duplicate state management
2. **Object with discriminant** (`{ type: 'none' } | { type: 'new' } | { type: 'existing', id: string }`)
   - ❌ Overkill for simple UI state
3. **Chosen: Single nullable string** - Simplest, TypeScript can narrow types naturally

---

### Step 5: Create SchemaSelector Component

**Files:** `frontend/src/components/SchemaSelector.tsx` (NEW)
**Action:** Create reusable Select dropdown for schema selection

**Complete Code:**
```typescript
/**
 * SchemaSelector Component
 *
 * Dropdown for selecting a schema or creating a new one.
 * Displays "Kein Schema" (no schema), existing schemas, and "+ Neues Schema erstellen" option.
 *
 * @example
 * ```tsx
 * <SchemaSelector
 *   value={schemaId}
 *   schemas={schemas}
 *   onChange={setSchemaId}
 * />
 * ```
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FieldSchema {
  id: string
  name: string
  description?: string
}

interface SchemaSelectorProps {
  value: string | null  // null | 'new' | UUID
  schemas: FieldSchema[]
  onChange: (value: string | null) => void
  disabled?: boolean
}

export const SchemaSelector = ({
  value,
  schemas,
  onChange,
  disabled = false,
}: SchemaSelectorProps) => {
  // Convert null to empty string for Radix Select (doesn't support null values)
  const selectValue = value === null ? '' : value

  const handleValueChange = (newValue: string) => {
    // Convert empty string back to null
    onChange(newValue === '' ? null : newValue)
  }

  return (
    <Select
      value={selectValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger 
        className="w-full"
        aria-label="Schema auswählen"
      >
        <SelectValue placeholder="Kein Schema" />
      </SelectTrigger>
      <SelectContent>
        {/* Option 1: No Schema */}
        <SelectItem value="">
          <span className="text-gray-600">Kein Schema</span>
        </SelectItem>

        {/* Option 2: Existing Schemas */}
        {schemas.length > 0 && (
          <>
            {schemas.map((schema) => (
              <SelectItem key={schema.id} value={schema.id}>
                <div className="flex flex-col">
                  <span>{schema.name}</span>
                  {schema.description && (
                    <span className="text-xs text-gray-500">
                      {schema.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Option 3: Create New Schema (Task #83) */}
        <SelectItem value="new">
          <span className="text-blue-600 font-medium">+ Neues Schema erstellen</span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
```

**Why Separate Component:**
- ✅ Reusable (might be used in tag edit modal later)
- ✅ Easier to test in isolation
- ✅ Cleaner separation of concerns
- ✅ Can be extracted to `components/schemas/` folder later

**Accessibility Features:**
- `aria-label` on SelectTrigger for screen readers
- Radix UI Select provides full keyboard navigation (Arrow keys, Enter, Escape)
- WCAG 2.1 Level AA compliant (via Radix UI primitives)

**Design Decisions:**
1. **Empty string for "no schema"** - Radix Select doesn't support null values, must use empty string and convert
2. **Gray color for "Kein Schema"** - Visual distinction from actual schemas
3. **Blue color for "Create new"** - Indicates action item (not a schema)
4. **Optional description** - Shows schema.description as secondary text if available
5. **Disabled prop** - Allows disabling during form submission

---

### Step 6: Integrate SchemaSelector into CreateTagDialog

**Files:** `frontend/src/components/CreateTagDialog.tsx`
**Action:** Add SchemaSelector section between color picker and footer

**Code (Add after Color Picker section):**
```typescript
import { SchemaSelector } from './SchemaSelector'
import { useSchemas } from '@/hooks/useSchemas'

// Inside CreateTagDialog component:
const { data: schemas = [], isLoading: isSchemasLoading } = useSchemas('list-id-hardcoded')  // TODO: Get real listId

// ... existing state ...

// Inside JSX, after color picker <div>:
{/* Schema Selector */}
<div>
  <label
    htmlFor="tag-schema"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    Schema (optional)
  </label>
  <SchemaSelector
    value={schemaId}
    schemas={schemas}
    onChange={setSchemaId}
    disabled={isSchemasLoading}
  />
  <p className="mt-1 text-sm text-gray-500">
    Verknüpfen Sie benutzerdefinierte Felder mit diesem Tag
  </p>
  
  {/* TODO (Task #83): Show SchemaEditor when schemaId === 'new' */}
  {schemaId === 'new' && (
    <p className="mt-2 text-sm text-amber-600">
      Schema-Editor wird in Task #83 implementiert
    </p>
  )}
</div>
```

**Why This Order:**
1. Tag Name (required)
2. Color (optional visual)
3. Schema (optional functionality) ← NEW
4. Footer buttons

**Design Note:** Schema comes last because it's most complex and optional. Users can skip it easily.

---

### Step 7: Update Form Submission to Include schema_id

**Files:** `frontend/src/components/CreateTagDialog.tsx`
**Action:** Modify handleSubmit to send schema_id to backend

**Code (BEFORE):**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  if (!name.trim()) {
    setError('Bitte geben Sie einen Tag-Namen ein')
    return
  }

  try {
    await createTag.mutateAsync({
      name: name.trim(),
      color: color || undefined,
    })

    // Success - reset form
    setName('')
    setColor('#3B82F6')
    setError(null)
    onOpenChange(false)
  } catch (err: any) {
    // ... error handling
  }
}
```

**Code (AFTER):**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  if (!name.trim()) {
    setError('Bitte geben Sie einen Tag-Namen ein')
    return
  }

  // Validation: Cannot submit with 'new' schema (must complete schema creation first)
  if (schemaId === 'new') {
    setError('Bitte erstellen Sie das Schema oder wählen Sie "Kein Schema"')
    return
  }

  try {
    await createTag.mutateAsync({
      name: name.trim(),
      color: color || undefined,
      schema_id: schemaId,  // NEW: null or UUID string
    })

    // Success - reset form
    setName('')
    setColor('#3B82F6')
    setSchemaId(null)  // NEW: reset schema selection
    setError(null)
    onOpenChange(false)
  } catch (err: any) {
    // ... existing error handling
  }
}
```

**Why Validation for 'new' Mode:**
- Task #83 will implement inline schema creation
- For Task #82, 'new' mode should show placeholder and prevent submission
- Alternative: Hide 'new' option until Task #83 - but breaks continuity

---

### Step 8: Update Form Reset on Cancel

**Files:** `frontend/src/components/CreateTagDialog.tsx`
**Action:** Include schema_id in handleCancel

**Code (BEFORE):**
```typescript
const handleCancel = () => {
  setName('')
  setColor('#3B82F6')
  setError(null)
  onOpenChange(false)
}
```

**Code (AFTER):**
```typescript
const handleCancel = () => {
  setName('')
  setColor('#3B82F6')
  setSchemaId(null)  // NEW: reset schema selection
  setError(null)
  onOpenChange(false)
}
```

**Why:** Form state must be fully reset on cancel to prevent stale state when reopening dialog.

---

### Step 9: Write Unit Tests for SchemaSelector Component

**Files:** `frontend/src/components/SchemaSelector.test.tsx` (NEW)
**Action:** Test all schema selection scenarios

**Complete Test File:**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SchemaSelector } from './SchemaSelector'

const mockSchemas = [
  { id: 'schema-1', name: 'Video Quality', description: 'Quality metrics' },
  { id: 'schema-2', name: 'Content Rating', description: undefined },
]

describe('SchemaSelector', () => {
  it('renders with "Kein Schema" placeholder when value is null', () => {
    render(
      <SchemaSelector
        value={null}
        schemas={[]}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('Kein Schema')).toBeInTheDocument()
  })

  it('displays all available schemas in dropdown', async () => {
    const user = userEvent.setup()
    render(
      <SchemaSelector
        value={null}
        schemas={mockSchemas}
        onChange={vi.fn()}
      />
    )

    // Open dropdown
    await user.click(screen.getByRole('combobox'))

    // Check all schemas are visible
    await waitFor(() => {
      expect(screen.getByText('Video Quality')).toBeInTheDocument()
      expect(screen.getByText('Quality metrics')).toBeInTheDocument()
      expect(screen.getByText('Content Rating')).toBeInTheDocument()
    })
  })

  it('shows "Neues Schema erstellen" option', async () => {
    const user = userEvent.setup()
    render(
      <SchemaSelector
        value={null}
        schemas={[]}
        onChange={vi.fn()}
      />
    )

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByText('+ Neues Schema erstellen')).toBeInTheDocument()
    })
  })

  it('calls onChange with null when "Kein Schema" selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(
      <SchemaSelector
        value="schema-1"
        schemas={mockSchemas}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('Kein Schema'))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with schema ID when schema selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(
      <SchemaSelector
        value={null}
        schemas={mockSchemas}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('Video Quality'))

    expect(onChange).toHaveBeenCalledWith('schema-1')
  })

  it('calls onChange with "new" when create new option selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(
      <SchemaSelector
        value={null}
        schemas={[]}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('+ Neues Schema erstellen'))

    expect(onChange).toHaveBeenCalledWith('new')
  })

  it('displays selected schema name when value is UUID', () => {
    render(
      <SchemaSelector
        value="schema-1"
        schemas={mockSchemas}
        onChange={vi.fn()}
      />
    )

    // Radix Select shows selected value in trigger
    expect(screen.getByText('Video Quality')).toBeInTheDocument()
  })

  it('disables dropdown when disabled prop is true', () => {
    render(
      <SchemaSelector
        value={null}
        schemas={[]}
        onChange={vi.fn()}
        disabled={true}
      />
    )

    const combobox = screen.getByRole('combobox')
    expect(combobox).toHaveAttribute('aria-disabled', 'true')
  })

  it('has proper ARIA label for accessibility', () => {
    render(
      <SchemaSelector
        value={null}
        schemas={[]}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Schema auswählen')).toBeInTheDocument()
  })
})
```

**Test Coverage:**
- ✅ Initial render with null value
- ✅ Display all schemas
- ✅ Show create new option
- ✅ onChange with null (no schema)
- ✅ onChange with UUID (existing schema)
- ✅ onChange with 'new' (create mode)
- ✅ Display selected value
- ✅ Disabled state
- ✅ Accessibility (ARIA label)

**Total Tests:** 9/9

---

### Step 10: Write Integration Tests for CreateTagDialog Extension

**Files:** `frontend/src/components/CreateTagDialog.test.tsx` (UPDATE)
**Action:** Add tests for schema selection in tag creation flow

**New Tests to Add:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateTagDialog } from './CreateTagDialog'

// Mock useSchemas hook
vi.mock('@/hooks/useSchemas', () => ({
  useSchemas: () => ({
    data: [
      { id: 'schema-1', name: 'Video Quality' },
      { id: 'schema-2', name: 'Content Rating' },
    ],
    isLoading: false,
  }),
}))

// ... existing tests ...

describe('CreateTagDialog - Schema Selection', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  it('renders schema selector section', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CreateTagDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    expect(screen.getByText('Schema (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Schema auswählen')).toBeInTheDocument()
  })

  it('creates tag without schema when "Kein Schema" selected', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    
    render(
      <QueryClientProvider client={queryClient}>
        <CreateTagDialog open={true} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    )

    // Fill form
    await user.type(screen.getByLabelText('Name *'), 'Python')
    
    // Schema defaults to null (Kein Schema)
    
    // Submit
    await user.click(screen.getByRole('button', { name: /erstellen/i }))

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalledWith({
        name: 'Python',
        color: '#3B82F6',
        schema_id: null,  // No schema
      })
    })
  })

  it('creates tag with selected schema', async () => {
    const user = userEvent.setup()
    
    render(
      <QueryClientProvider client={queryClient}>
        <CreateTagDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    // Fill form
    await user.type(screen.getByLabelText('Name *'), 'Tutorials')
    
    // Select schema
    await user.click(screen.getByLabelText('Schema auswählen'))
    await user.click(screen.getByText('Video Quality'))
    
    // Submit
    await user.click(screen.getByRole('button', { name: /erstellen/i }))

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalledWith({
        name: 'Tutorials',
        color: '#3B82F6',
        schema_id: 'schema-1',
      })
    })
  })

  it('prevents submission when "new" schema mode is selected', async () => {
    const user = userEvent.setup()
    
    render(
      <QueryClientProvider client={queryClient}>
        <CreateTagDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    // Fill form
    await user.type(screen.getByLabelText('Name *'), 'Test Tag')
    
    // Select "Create new"
    await user.click(screen.getByLabelText('Schema auswählen'))
    await user.click(screen.getByText('+ Neues Schema erstellen'))
    
    // Should show Task #83 placeholder
    expect(screen.getByText(/Task #83/i)).toBeInTheDocument()
    
    // Submit should fail
    await user.click(screen.getByRole('button', { name: /erstellen/i }))

    expect(screen.getByText(/Bitte erstellen Sie das Schema/i)).toBeInTheDocument()
    expect(mockCreateTag).not.toHaveBeenCalled()
  })

  it('resets schema selection on cancel', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <CreateTagDialog open={true} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    )

    // Select schema
    await user.click(screen.getByLabelText('Schema auswählen'))
    await user.click(screen.getByText('Video Quality'))
    
    // Cancel
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    
    // Reopen dialog
    rerender(
      <QueryClientProvider client={queryClient}>
        <CreateTagDialog open={true} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    )

    // Schema should be reset to "Kein Schema"
    expect(screen.getByText('Kein Schema')).toBeInTheDocument()
  })

  it('maintains schema selection when switching between schemas', async () => {
    const user = userEvent.setup()
    
    render(
      <QueryClientProvider client={queryClient}>
        <CreateTagDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    // Select first schema
    await user.click(screen.getByLabelText('Schema auswählen'))
    await user.click(screen.getByText('Video Quality'))
    
    expect(screen.getByText('Video Quality')).toBeInTheDocument()
    
    // Switch to second schema
    await user.click(screen.getByLabelText('Schema auswählen'))
    await user.click(screen.getByText('Content Rating'))
    
    expect(screen.getByText('Content Rating')).toBeInTheDocument()
  })
})
```

**New Tests:** 6
**Total CreateTagDialog Tests:** 6 new + existing = ~12

---

### Step 11: Manual Testing Checklist

**Test Scenarios:**

**Basic Functionality:**
- [ ] Open CreateTagDialog, schema selector visible
- [ ] Default selection is "Kein Schema"
- [ ] Dropdown shows all available schemas
- [ ] Can select existing schema
- [ ] Can select "Kein Schema" to remove selection
- [ ] Create tag without schema → tag created successfully
- [ ] Create tag with schema → tag.schema_id matches selection

**Schema Selection:**
- [ ] Select "Video Quality" → displays in selector
- [ ] Switch to "Content Rating" → updates correctly
- [ ] Switch back to "Kein Schema" → resets to null
- [ ] Select "+ Neues Schema erstellen" → shows Task #83 placeholder

**Form Reset:**
- [ ] Select schema, click Cancel → schema resets on reopen
- [ ] Select schema, create tag → schema resets after success
- [ ] Fill name, select schema, get error → schema selection preserved

**Error Handling:**
- [ ] Select "new" mode, submit → error message shown
- [ ] Network error when creating tag → schema selection preserved
- [ ] Empty schemas list → only shows "Kein Schema" and "Create new"

**Accessibility:**
- [ ] Tab navigation works (Name → Color → Schema → Buttons)
- [ ] Arrow keys navigate schema dropdown
- [ ] Enter selects schema
- [ ] Escape closes dropdown
- [ ] Screen reader announces "Schema auswählen"

**Regression:**
- [ ] Existing functionality still works (name, color, validation)
- [ ] All existing tests pass
- [ ] No console errors

---

## 🧪 Testing Strategy

### Unit Tests
- **SchemaSelector.test.tsx** (9 tests)
  - Render states (null, UUID, 'new')
  - Dropdown options display
  - onChange callbacks
  - Disabled state
  - Accessibility

### Integration Tests
- **CreateTagDialog.test.tsx** (6 new tests)
  - Schema selector integration
  - Tag creation with/without schema
  - Validation for 'new' mode
  - Form reset behavior
  - Schema switching

### Manual Tests
- User flow testing (16 scenarios)
- Accessibility audit (keyboard, screen reader)
- Regression testing (existing functionality)

### Coverage Target
- Line coverage: 90%+
- Branch coverage: 85%+
- All user-facing paths tested

---

## 📚 Reference

### Design Documents
- Custom Fields System Design: `docs/plans/2025-11-05-custom-fields-system-design.md` (lines 322-358)
- Component architecture specification
- Multi-tag field union logic (lines 160-174)

### Existing Code Patterns
- CreateTagDialog structure (manual state management, no React Hook Form)
- AlertDialog usage (Radix UI)
- useTags hook pattern (TanStack Query with queryOptions)
- Error handling in form submission

### External Documentation
- shadcn/ui Select: https://ui.shadcn.com/docs/components/select
- Radix UI Select API: https://www.radix-ui.com/docs/primitives/components/select
- shadcn/ui Form (for reference): https://ui.shadcn.com/docs/components/form
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview

### Related Tasks
- Task #80: useSchemas hook (mocked for now)
- Task #83: SchemaEditor component (shows when schemaId === 'new')
- Task #64-65: Backend Pydantic schemas (completed)
- Task #60: FieldSchema model with Tag.schema_id (completed)

---

## ⏱️ Time Estimate

**Breakdown:**
- Step 1-2: TypeScript types + mock hook: 20 min
- Step 3: Install shadcn Select: 5 min
- Step 4-8: Implementation (CreateTagDialog + SchemaSelector): 90 min
- Step 9: SchemaSelector unit tests: 45 min
- Step 10: CreateTagDialog integration tests: 45 min
- Step 11: Manual testing: 30 min
- Documentation + commit: 15 min

**Total Estimate:** 3.5 hours (210 minutes)

**Risk Buffer:** +30 min for unexpected issues

**Final Estimate:** 3-4 hours

---

## 🎨 Design Decisions

### Decision 1: Extend CreateTagDialog vs Create Separate TagEditDialog

**Options:**
1. **Extend CreateTagDialog** - Add schema selector to existing component
2. **Create TagEditDialog** - New component for editing tags with schemas
3. **Unified TagDialog** - Single component with `mode: 'create' | 'edit'` prop

**Chosen:** Option 1 (Extend CreateTagDialog)

**Rationale:**
- Design doc says "extend" existing component
- Simpler for MVP (no edit mode needed yet)
- Can refactor to unified component later if needed
- Follows existing codebase pattern (single-purpose components)

**Trade-offs:**
- Future: May need TagEditDialog component for editing existing tags
- Alternative would be more future-proof but over-engineers MVP

---

### Decision 2: Discriminated Union for schema_id State

**Options:**
1. **Single nullable string** - `schemaId: string | null` (with 'new' as magic string)
2. **Two separate fields** - `mode: 'none'|'new'|'existing'` + `selectedSchemaId: string | null`
3. **Tagged union object** - `{ type: 'none' } | { type: 'new' } | { type: 'existing', id: string }`

**Chosen:** Option 1 (Single nullable string)

**Rationale:**
- Simplest implementation (one useState)
- TypeScript can narrow types: `if (schemaId === 'new')`, `if (schemaId === null)`
- Matches backend schema (nullable schema_id field)
- Easy to serialize for API calls

**Trade-offs:**
- 'new' is a magic string (could conflict if schema IDs use 'new')
- Mitigation: UUIDs will never be 'new' string

---

### Decision 3: Mock useSchemas Hook vs Wait for Task #80

**Options:**
1. **Mock hook** - Create placeholder that returns empty array
2. **Wait for Task #80** - Block Task #82 until schemas API is ready
3. **Inline mock** - Mock in tests only, no production mock

**Chosen:** Option 1 (Mock hook)

**Rationale:**
- Unblocks UI development
- Provides interface contract for Task #80
- Can be easily replaced (same file path)
- Allows testing component in isolation

**Implementation:**
```typescript
export const useSchemas = (listId: string) => {
  return useQuery({
    queryKey: ['schemas', listId],
    queryFn: async () => [],  // Empty for now
    enabled: false,  // Disable API calls
  })
}
```

---

### Decision 4: Separate SchemaSelector Component vs Inline

**Options:**
1. **Separate component** - `<SchemaSelector>` as reusable component
2. **Inline in CreateTagDialog** - All Select logic inside dialog
3. **Extract later** - Start inline, refactor when needed

**Chosen:** Option 1 (Separate component)

**Rationale:**
- Easier to test in isolation
- Reusable (might be used in TagEditDialog later)
- Cleaner separation of concerns
- Follows React best practices

**File Structure:**
```
frontend/src/components/
  CreateTagDialog.tsx      (uses SchemaSelector)
  SchemaSelector.tsx       (NEW)
  SchemaSelector.test.tsx  (NEW)
```

---

### Decision 5: Validation for 'new' Schema Mode

**Options:**
1. **Block submission** - Show error when 'new' selected and form submitted
2. **Hide option** - Don't show "+ Neues Schema erstellen" until Task #83
3. **Auto-expand** - Automatically show SchemaEditor when 'new' selected (Task #83)

**Chosen:** Option 1 (Block submission with placeholder message)

**Rationale:**
- Shows continuity (user knows feature is coming)
- Prevents broken UX (can't submit incomplete state)
- Clear messaging: "Schema-Editor wird in Task #83 implementiert"
- Easy to replace placeholder with real editor

**Implementation:**
```typescript
if (schemaId === 'new') {
  setError('Bitte erstellen Sie das Schema oder wählen Sie "Kein Schema"')
  return
}
```

---

## 🚨 Potential Issues & Mitigations

### Issue 1: Radix Select Doesn't Support null Values

**Problem:** Radix UI Select `value` prop only accepts strings, but we need null for "no schema"

**Mitigation:**
```typescript
// Convert null to empty string for Select
const selectValue = value === null ? '' : value

const handleValueChange = (newValue: string) => {
  // Convert back to null
  onChange(newValue === '' ? null : newValue)
}
```

**Verification:** Unit tests cover null → '' → null conversion

---

### Issue 2: Task #80 Dependency (useSchemas Hook)

**Problem:** Task #80 is pending, but we need schemas data for UI

**Mitigation:**
- Mock hook returns empty array
- Component renders correctly with 0 schemas
- Tests use mock data
- Can be replaced without breaking changes

**Risk:** If Task #80 changes interface, need to update mock

---

### Issue 3: Backend schema_id Field Not in Current Tag Type

**Problem:** Frontend Tag type doesn't have schema_id yet

**Mitigation:**
- Add schema_id in Step 1 (TypeScript types)
- Mark as `.optional()` for backwards compatibility
- Backend already supports field (Task #60)

**Verification:** Check backend Tag response includes schema_id

---

### Issue 4: Form State Complexity with 3 Modes

**Problem:** Managing null | 'new' | UUID can be confusing

**Mitigation:**
- Clear variable naming (`schemaId` not `schema` or `value`)
- Comments explain each mode
- Type guards in conditionals: `if (schemaId === 'new')`
- Comprehensive tests cover all transitions

---

### Issue 5: Accessibility with Nested Dialog (Task #83)

**Problem:** SchemaEditor (Task #83) will be nested inside AlertDialog, might break ARIA

**Mitigation:**
- Task #82 only shows placeholder, no nested dialog
- Task #83 will research Dialog nesting patterns
- Alternative: Replace AlertDialog with regular Dialog if needed

**Note:** AlertDialog is for destructive actions, might not be correct for CreateTagDialog anyway

---

## ✅ Definition of Done

- [ ] TypeScript types updated (Tag, TagCreate with schema_id)
- [ ] Mock useSchemas hook created
- [ ] shadcn/ui Select component installed
- [ ] SchemaSelector component implemented
- [ ] CreateTagDialog extended with schema section
- [ ] Form submission includes schema_id
- [ ] 9 SchemaSelector unit tests passing
- [ ] 6 CreateTagDialog integration tests passing
- [ ] All existing tests still pass (regression check)
- [ ] Manual testing checklist completed (16 scenarios)
- [ ] Accessibility verified (keyboard navigation, screen reader)
- [ ] Code reviewed (TypeScript strict mode, no linting errors)
- [ ] Documentation updated (CLAUDE.md if needed)
- [ ] Git commit with comprehensive message
- [ ] No console errors or warnings

---

## 🔄 Handoff Notes for Task #83

**What Task #83 Needs:**
1. Replace placeholder message with `<SchemaEditor>` component when `schemaId === 'new'`
2. SchemaEditor should allow:
   - Name/description input
   - Field selection (needs Task #84 FieldSelector)
   - Save/cancel actions
3. On save: Create schema via API, update `schemaId` to new UUID
4. Remove validation block for 'new' mode in handleSubmit

**Interface Contract:**
```typescript
// Task #83 will implement:
<SchemaEditor
  listId={listId}
  onSave={(newSchemaId: string) => {
    setSchemaId(newSchemaId)  // Update to new schema UUID
  }}
  onCancel={() => {
    setSchemaId(null)  // Reset to "Kein Schema"
  }}
/>
```

**Files to Modify:**
- `CreateTagDialog.tsx` - Replace placeholder with SchemaEditor
- Add SchemaEditor component in `components/schemas/`

---

## 📝 Commit Message Template

```
feat(tags): add schema selector to tag creation dialog (Task #82)

Extend CreateTagDialog with SchemaSelector dropdown to support
tag-schema binding for custom fields system.

Changes:
- Add schema_id to Tag/TagCreate/TagUpdate TypeScript types
- Create mock useSchemas hook (Task #80 dependency)
- Install shadcn/ui Select component
- Implement SchemaSelector component (3 modes: none, existing, new)
- Integrate SchemaSelector into CreateTagDialog
- Update form submission to include schema_id
- Add 9 SchemaSelector unit tests (100% coverage)
- Add 6 CreateTagDialog integration tests
- Add validation for 'new' mode (blocks until Task #83)

Schema Modes:
- null: "Kein Schema" (no custom fields)
- UUID: Existing schema selected
- 'new': Create new schema (Task #83 placeholder)

Related:
- Task #80: useSchemas hook (mocked for now)
- Task #83: SchemaEditor component (next task)
- Design Doc: docs/plans/2025-11-05-custom-fields-system-design.md

🤖 Generated with Claude Code
```

---

**END OF PLAN**
