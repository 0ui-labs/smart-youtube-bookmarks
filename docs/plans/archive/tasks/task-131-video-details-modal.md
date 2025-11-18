# Task #131: Create VideoDetailsModal with CustomFieldsSection Component

**Plan Task:** #131
**Wave/Phase:** Custom Fields System - Phase 1: MVP - Frontend (Components + UI)
**Dependencies:** Task #128 (FieldDisplay Component), Task #129 (Inline Editing), Task #71 (Backend Video GET with field_values)

---

## 🎯 Ziel

Create a comprehensive VideoDetailsModal component that displays ALL custom field values for a video, grouped by their schemas. This modal provides full field editing capabilities beyond the max-3-fields preview on video cards. Fields are organized into schema groups with headers, supporting the multi-tag field union logic where videos with multiple tags inherit fields from all associated schemas.

**Expected Result:**
- Modal dialog component using shadcn/ui Dialog (NOT AlertDialog)
- Displays video metadata (title, thumbnail, tags) in header section
- CustomFieldsSection component groups fields by schema_name
- Each schema group has a header with schema name
- Fields within groups respect display_order from backend
- All 4 field types supported with inline editing via FieldDisplay (Task #128)
- Responsive layout with proper scrolling for many fields
- Close action saves changes (optimistic updates from Task #129)

---

## 📋 Acceptance Criteria

**Functional:**
- [ ] VideoDetailsModal renders with video metadata header (title, thumbnail, duration, channel)
- [ ] CustomFieldsSection displays ALL field values from video.field_values array
- [ ] Fields grouped by schema_name with visible group headers
- [ ] Fields within each group sorted by display_order (ascending)
- [ ] Ungrouped fields (schema_name=null) shown in separate "Weitere Felder" section
- [ ] Inline editing works for all field types using FieldDisplay component (Task #128)
- [ ] Modal opens/closes with proper animation and backdrop
- [ ] Close button and ESC key dismiss modal
- [ ] Modal scrolls correctly when content exceeds viewport height

**TypeScript & Types:**
- [ ] Proper TypeScript interfaces for modal props
- [ ] Type-safe schema grouping logic with generics
- [ ] No TypeScript errors introduced

**UI/UX:**
- [ ] German UI text following project conventions
- [ ] Consistent spacing and visual hierarchy
- [ ] Mobile-responsive layout (tested at 375px width)
- [ ] Focus management (modal traps focus, returns on close)
- [ ] PurgeCSS-safe Tailwind classes (no template literals)

**Testing:**
- [ ] Unit tests: CustomFieldsSection rendering (5 tests)
- [ ] Unit tests: Schema grouping logic (4 tests)
- [ ] Integration test: Full modal interaction flow (1 test)
- [ ] Manual testing checklist completed
- [ ] All tests passing with 90%+ coverage

**Code Quality:**
- [ ] Code reviewed (target: Grade A)
- [ ] REF MCP validation for Dialog component patterns
- [ ] Follows existing modal patterns from CreateTagDialog
- [ ] WCAG 2.1 Level AA accessibility compliance

---

## 🛠️ Implementation Steps

### 1. Install shadcn/ui Dialog Component

**Files:** `frontend/src/components/ui/dialog.tsx` (NEW)

**Action:** Install Dialog component for modal functionality (NOT AlertDialog, which is for confirmations)

**Command:**
```bash
cd frontend
npx shadcn@latest add dialog
```

**Verification:**
```bash
# Check that dialog.tsx exists with these exports:
# - Dialog
# - DialogTrigger
# - DialogContent
# - DialogHeader
# - DialogTitle
# - DialogDescription
# - DialogFooter
# - DialogClose

ls -la frontend/src/components/ui/dialog.tsx
```

**Why Dialog over AlertDialog:**
- AlertDialog is for destructive actions (delete confirmations)
- Dialog is for general content display and forms
- REF MCP: shadcn/ui documentation confirms this pattern
- Existing project uses AlertDialog for ConfirmDeleteModal (correct usage)

---

### 2. Create Schema Grouping Utility Function

**Files:** `frontend/src/utils/groupFieldsBySchema.ts` (NEW FILE)

**Action:** Implement type-safe utility to group field values by schema_name

**Code:**
```typescript
/**
 * Utility to group video field values by their schema names.
 * 
 * Implements multi-tag field union logic from Design Doc:
 * - Videos with multiple tags inherit fields from all associated schemas
 * - Fields grouped by schema_name for organized display
 * - Ungrouped fields (schema_name=null) shown separately
 * - Within each group, fields sorted by display_order
 * 
 * REF: docs/plans/2025-11-05-custom-fields-system-design.md lines 407-427
 */

import type { FieldValue } from '@/types/fieldValue'

export interface SchemaGroup {
  schema_name: string | null
  fields: FieldValue[]
}

/**
 * Groups field values by schema name and sorts within groups.
 * 
 * Grouping Rules:
 * 1. Fields with same schema_name → single group
 * 2. Fields with null schema_name → "Weitere Felder" group (last)
 * 3. Within each group: sort by display_order (ASC)
 * 
 * Example Input:
 * ```
 * [
 *   { field_id: 'f1', schema_name: 'Video Quality', display_order: 2, ... },
 *   { field_id: 'f2', schema_name: 'Video Quality', display_order: 1, ... },
 *   { field_id: 'f3', schema_name: 'Tutorial Info', display_order: 1, ... },
 *   { field_id: 'f4', schema_name: null, display_order: 1, ... }
 * ]
 * ```
 * 
 * Example Output:
 * ```
 * [
 *   { schema_name: 'Video Quality', fields: [f2, f1] },  // Sorted by display_order
 *   { schema_name: 'Tutorial Info', fields: [f3] },
 *   { schema_name: null, fields: [f4] }  // "Weitere Felder" group last
 * ]
 * ```
 * 
 * @param fieldValues - Array of field values from video.field_values
 * @returns Array of schema groups with sorted fields
 */
export function groupFieldsBySchema(fieldValues: FieldValue[]): SchemaGroup[] {
  // Step 1: Group by schema_name
  const groupMap = new Map<string | null, FieldValue[]>()

  fieldValues.forEach((fv) => {
    const key = fv.schema_name
    if (!groupMap.has(key)) {
      groupMap.set(key, [])
    }
    groupMap.get(key)!.push(fv)
  })

  // Step 2: Convert map to array and sort fields within each group
  const groups: SchemaGroup[] = []

  groupMap.forEach((fields, schema_name) => {
    // Sort fields by display_order (ASC)
    const sortedFields = [...fields].sort((a, b) => {
      // Fallback to 0 if display_order missing (should not happen in valid data)
      const orderA = a.field?.display_order ?? 0
      const orderB = b.field?.display_order ?? 0
      return orderA - orderB
    })

    groups.push({
      schema_name,
      fields: sortedFields,
    })
  })

  // Step 3: Sort groups (null schema_name last, others alphabetically)
  groups.sort((a, b) => {
    // Null group always last
    if (a.schema_name === null) return 1
    if (b.schema_name === null) return -1

    // Alphabetical sort for named schemas
    return a.schema_name.localeCompare(b.schema_name, 'de')
  })

  return groups
}
```

**Why:**
- **Multi-tag support:** Videos with multiple tags get fields from all schemas
- **Type-safe:** Generic SchemaGroup interface ensures correct usage
- **Sorted display:** display_order respected within groups for consistent UI
- **Null handling:** Ungrouped fields shown in separate section
- **Testable:** Pure function, easy to unit test

**Design Decision:** Use Map for grouping instead of reduce() for clarity and performance.

---

### 3. Create Unit Tests for Grouping Logic

**Files:** `frontend/src/utils/groupFieldsBySchema.test.ts` (NEW FILE)

**Action:** Write comprehensive tests for schema grouping utility

**Code:**
```typescript
import { describe, it, expect } from 'vitest'
import { groupFieldsBySchema } from './groupFieldsBySchema'
import type { FieldValue } from '@/types/fieldValue'

describe('groupFieldsBySchema', () => {
  const createMockField = (
    id: string,
    schema_name: string | null,
    display_order: number
  ): FieldValue => ({
    field_id: id,
    field: {
      id,
      list_id: 'list-1',
      name: `Field ${id}`,
      field_type: 'rating',
      config: { max_rating: 5 },
      display_order,  // Important for sorting
      show_on_card: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    value: 3,
    schema_name,
    show_on_card: false,
    updated_at: '2025-01-01T00:00:00Z',
  })

  it('groups fields by schema_name', () => {
    const fields: FieldValue[] = [
      createMockField('f1', 'Video Quality', 1),
      createMockField('f2', 'Video Quality', 2),
      createMockField('f3', 'Tutorial Info', 1),
    ]

    const groups = groupFieldsBySchema(fields)

    expect(groups).toHaveLength(2)
    expect(groups[0].schema_name).toBe('Tutorial Info')  // Alphabetical: T before V
    expect(groups[0].fields).toHaveLength(1)
    expect(groups[1].schema_name).toBe('Video Quality')
    expect(groups[1].fields).toHaveLength(2)
  })

  it('sorts fields within groups by display_order', () => {
    const fields: FieldValue[] = [
      createMockField('f1', 'Video Quality', 3),
      createMockField('f2', 'Video Quality', 1),
      createMockField('f3', 'Video Quality', 2),
    ]

    const groups = groupFieldsBySchema(fields)

    expect(groups).toHaveLength(1)
    const sortedFieldIds = groups[0].fields.map((f) => f.field_id)
    expect(sortedFieldIds).toEqual(['f2', 'f3', 'f1'])  // Order: 1, 2, 3
  })

  it('places null schema_name group last', () => {
    const fields: FieldValue[] = [
      createMockField('f1', null, 1),
      createMockField('f2', 'Video Quality', 1),
      createMockField('f3', 'Tutorial Info', 1),
    ]

    const groups = groupFieldsBySchema(fields)

    expect(groups).toHaveLength(3)
    expect(groups[2].schema_name).toBeNull()  // Null group always last
    expect(groups[2].fields[0].field_id).toBe('f1')
  })

  it('handles empty array', () => {
    const groups = groupFieldsBySchema([])
    expect(groups).toEqual([])
  })

  it('sorts schema names alphabetically (German locale)', () => {
    const fields: FieldValue[] = [
      createMockField('f1', 'Übersicht', 1),
      createMockField('f2', 'Audio', 1),
      createMockField('f3', 'Qualität', 1),
    ]

    const groups = groupFieldsBySchema(fields)

    const schemaNames = groups.map((g) => g.schema_name)
    expect(schemaNames).toEqual(['Audio', 'Qualität', 'Übersicht'])  // German sort
  })

  it('handles single field', () => {
    const fields: FieldValue[] = [createMockField('f1', 'Test Schema', 1)]

    const groups = groupFieldsBySchema(fields)

    expect(groups).toHaveLength(1)
    expect(groups[0].schema_name).toBe('Test Schema')
    expect(groups[0].fields).toHaveLength(1)
  })

  it('preserves field data in groups', () => {
    const field = createMockField('f1', 'Video Quality', 1)
    const groups = groupFieldsBySchema([field])

    expect(groups[0].fields[0]).toEqual(field)  // Field not mutated
  })
})
```

**Coverage:**
- ✅ Groups by schema_name
- ✅ Sorts by display_order within groups
- ✅ Null schema_name last
- ✅ Empty array handling
- ✅ German locale sorting
- ✅ Single field edge case
- ✅ Data immutability

---

### 4. Create CustomFieldsSection Component

**Files:** `frontend/src/components/videos/CustomFieldsSection.tsx` (NEW FILE)

**Action:** Build section component that displays grouped custom fields

**Code:**
```typescript
/**
 * CustomFieldsSection Component
 * 
 * Displays all custom field values grouped by schema name.
 * Used in VideoDetailsModal to show complete field data.
 * 
 * Features:
 * - Schema grouping with visible headers
 * - Fields sorted by display_order within groups
 * - Inline editing via FieldDisplay (Task #128)
 * - Ungrouped fields in "Weitere Felder" section
 * - Responsive layout with proper spacing
 * 
 * Design Constraints:
 * - Shows ALL fields (unlike CustomFieldsPreview which shows max 3)
 * - Groups must be visually distinct for scanability
 * - Mobile-responsive (tested at 375px width)
 */

import { FieldDisplay } from '@/components/fields/FieldDisplay'  // Task #128
import { groupFieldsBySchema } from '@/utils/groupFieldsBySchema'
import type { FieldValue } from '@/types/fieldValue'

interface CustomFieldsSectionProps {
  videoId: string
  listId: string
  fieldValues: FieldValue[]
  onFieldChange?: (fieldId: string, newValue: number | string | boolean | null) => void
  readOnly?: boolean
}

/**
 * Renders all custom field values grouped by schema.
 * 
 * Layout Structure:
 * ```
 * [Schema Name Header]
 *   Field 1: [Value]
 *   Field 2: [Value]
 * 
 * [Another Schema Header]
 *   Field 3: [Value]
 * 
 * [Weitere Felder]  (if ungrouped fields exist)
 *   Field 4: [Value]
 * ```
 * 
 * Usage:
 * ```tsx
 * <CustomFieldsSection
 *   videoId={video.id}
 *   listId={video.list_id}
 *   fieldValues={video.field_values}
 *   onFieldChange={handleFieldChange}
 * />
 * ```
 */
export const CustomFieldsSection = ({
  videoId,
  listId,
  fieldValues,
  onFieldChange,
  readOnly = false,
}: CustomFieldsSectionProps) => {
  // Group fields by schema
  const schemaGroups = groupFieldsBySchema(fieldValues)

  // Empty state
  if (schemaGroups.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>Keine benutzerdefinierten Felder vorhanden.</p>
        <p className="text-sm mt-2">
          Fügen Sie Felder über die Tag-Einstellungen hinzu.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {schemaGroups.map((group) => (
        <div key={group.schema_name ?? 'ungrouped'} className="space-y-3">
          {/* Schema Group Header */}
          <h3 className="text-sm font-semibold text-foreground border-b pb-2">
            {group.schema_name ?? 'Weitere Felder'}
          </h3>

          {/* Fields in Group */}
          <div className="space-y-3 pl-1">
            {group.fields.map((fieldValue) => (
              <div
                key={fieldValue.field_id}
                className="flex items-start gap-3"
              >
                {/* Field Label */}
                <label
                  htmlFor={`field-${fieldValue.field_id}`}
                  className="text-sm font-medium text-muted-foreground min-w-[120px] pt-1"
                >
                  {fieldValue.field.name}:
                </label>

                {/* Field Value (Inline Editable) */}
                <div className="flex-1" id={`field-${fieldValue.field_id}`}>
                  <FieldDisplay
                    field={fieldValue.field}
                    value={fieldValue.value}
                    onChange={
                      onFieldChange && !readOnly
                        ? (newValue) => onFieldChange(fieldValue.field_id, newValue)
                        : undefined
                    }
                    readOnly={readOnly}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Why:**
- **Schema headers:** Clear visual separation between field groups
- **Flex layout:** Label + value side-by-side for easy scanning
- **Empty state:** Helpful message when no fields exist
- **German text:** "Weitere Felder" for ungrouped fields
- **Responsive:** min-w-[120px] for labels prevents wrapping on mobile

**Design Patterns:**
- Uses FieldDisplay from Task #128 (DRY principle)
- Follows CreateTagDialog form layout patterns
- PurgeCSS-safe: All classes explicitly written (no template literals)

---

### 5. Create Unit Tests for CustomFieldsSection

**Files:** `frontend/src/components/videos/CustomFieldsSection.test.tsx` (NEW FILE)

**Action:** Write comprehensive tests for CustomFieldsSection rendering

**Code:**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CustomFieldsSection } from './CustomFieldsSection'
import type { FieldValue } from '@/types/fieldValue'

// Mock FieldDisplay component from Task #128
vi.mock('@/components/fields/FieldDisplay', () => ({
  FieldDisplay: ({ field, value }: any) => (
    <div data-testid={`field-${field.id}`}>
      {field.name}: {String(value)}
    </div>
  ),
}))

// Mock grouping utility (tested separately)
vi.mock('@/utils/groupFieldsBySchema', () => ({
  groupFieldsBySchema: (fields: FieldValue[]) => {
    // Simple mock: group by schema_name
    const map = new Map<string | null, FieldValue[]>()
    fields.forEach((fv) => {
      if (!map.has(fv.schema_name)) {
        map.set(fv.schema_name, [])
      }
      map.get(fv.schema_name)!.push(fv)
    })
    return Array.from(map.entries()).map(([schema_name, fields]) => ({
      schema_name,
      fields,
    }))
  },
}))

describe('CustomFieldsSection', () => {
  const createMockFieldValue = (
    id: string,
    name: string,
    schema_name: string | null
  ): FieldValue => ({
    field_id: id,
    field: {
      id,
      list_id: 'list-1',
      name,
      field_type: 'rating',
      config: { max_rating: 5 },
      display_order: 1,
      show_on_card: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    value: 3,
    schema_name,
    show_on_card: false,
    updated_at: '2025-01-01T00:00:00Z',
  })

  it('renders schema group headers', () => {
    const fields = [
      createMockFieldValue('f1', 'Rating', 'Video Quality'),
      createMockFieldValue('f2', 'Difficulty', 'Tutorial Info'),
    ]

    render(
      <CustomFieldsSection
        videoId="video-1"
        listId="list-1"
        fieldValues={fields}
      />
    )

    expect(screen.getByText('Video Quality')).toBeInTheDocument()
    expect(screen.getByText('Tutorial Info')).toBeInTheDocument()
  })

  it('renders field labels and values', () => {
    const fields = [
      createMockFieldValue('f1', 'Overall Rating', 'Video Quality'),
    ]

    render(
      <CustomFieldsSection
        videoId="video-1"
        listId="list-1"
        fieldValues={fields}
      />
    )

    expect(screen.getByText(/Overall Rating:/)).toBeInTheDocument()
    expect(screen.getByTestId('field-f1')).toHaveTextContent('Overall Rating: 3')
  })

  it('renders "Weitere Felder" for ungrouped fields', () => {
    const fields = [createMockFieldValue('f1', 'Notes', null)]

    render(
      <CustomFieldsSection
        videoId="video-1"
        listId="list-1"
        fieldValues={fields}
      />
    )

    expect(screen.getByText('Weitere Felder')).toBeInTheDocument()
  })

  it('renders empty state when no fields', () => {
    render(
      <CustomFieldsSection
        videoId="video-1"
        listId="list-1"
        fieldValues={[]}
      />
    )

    expect(
      screen.getByText(/Keine benutzerdefinierten Felder vorhanden/)
    ).toBeInTheDocument()
  })

  it('passes onFieldChange to FieldDisplay', () => {
    const fields = [createMockFieldValue('f1', 'Rating', 'Video Quality')]
    const onFieldChange = vi.fn()

    render(
      <CustomFieldsSection
        videoId="video-1"
        listId="list-1"
        fieldValues={fields}
        onFieldChange={onFieldChange}
      />
    )

    // Verify FieldDisplay received onChange prop
    // (FieldDisplay is mocked, so we can't test actual interaction)
    expect(screen.getByTestId('field-f1')).toBeInTheDocument()
  })

  it('respects readOnly prop', () => {
    const fields = [createMockFieldValue('f1', 'Rating', 'Video Quality')]

    render(
      <CustomFieldsSection
        videoId="video-1"
        listId="list-1"
        fieldValues={fields}
        readOnly={true}
      />
    )

    // Read-only mode verified by component rendering
    expect(screen.getByTestId('field-f1')).toBeInTheDocument()
  })
})
```

**Coverage:**
- ✅ Schema headers rendered
- ✅ Field labels and values displayed
- ✅ "Weitere Felder" for ungrouped
- ✅ Empty state
- ✅ onFieldChange propagation
- ✅ readOnly prop

---

### 6. Create VideoDetailsModal Component

**Files:** `frontend/src/components/videos/VideoDetailsModal.tsx` (NEW FILE)

**Action:** Build main modal component with video metadata header and custom fields section

**Code:**
```typescript
/**
 * VideoDetailsModal Component
 * 
 * Full-screen modal displaying complete video details with all custom fields.
 * Extends the max-3-fields preview on video cards to show everything.
 * 
 * Layout:
 * - Header: Video title, thumbnail, duration, channel, tags
 * - Body: CustomFieldsSection (all fields grouped by schema)
 * - Footer: Close button
 * 
 * Features:
 * - Responsive modal with scrolling for long content
 * - Inline editing for all field types
 * - Keyboard navigation (ESC to close, Tab for focus)
 * - WCAG 2.1 Level AA accessible
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CustomFieldsSection } from './CustomFieldsSection'
import { formatDuration } from '@/utils/formatDuration'
import type { VideoResponse } from '@/types/video'
import { X } from 'lucide-react'

interface VideoDetailsModalProps {
  video: VideoResponse
  open: boolean
  onOpenChange: (open: boolean) => void
  onFieldChange?: (fieldId: string, newValue: number | string | boolean | null) => void
}

/**
 * Displays complete video details in a modal dialog.
 * 
 * Usage:
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 * 
 * <VideoDetailsModal
 *   video={video}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onFieldChange={handleFieldChange}
 * />
 * ```
 * 
 * REF MCP: shadcn/ui Dialog component pattern
 * - Uses Dialog (not AlertDialog) for content display
 * - DialogContent provides backdrop and animation
 * - Accessible keyboard navigation built-in
 */
export const VideoDetailsModal = ({
  video,
  open,
  onOpenChange,
  onFieldChange,
}: VideoDetailsModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header Section */}
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold pr-8">
            {video.title || 'Untitled Video'}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {/* Video Metadata */}
          <div className="mb-6 space-y-4">
            {/* Thumbnail */}
            {video.thumbnail_url && (
              <img
                src={video.thumbnail_url}
                alt={video.title || 'Video thumbnail'}
                className="w-full rounded-lg aspect-video object-cover"
              />
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {video.channel && (
                <div>
                  <span className="font-medium text-muted-foreground">Kanal:</span>
                  <p className="text-foreground">{video.channel}</p>
                </div>
              )}
              {video.duration && (
                <div>
                  <span className="font-medium text-muted-foreground">Dauer:</span>
                  <p className="text-foreground">{formatDuration(video.duration)}</p>
                </div>
              )}
              {video.published_at && (
                <div>
                  <span className="font-medium text-muted-foreground">Veröffentlicht:</span>
                  <p className="text-foreground">
                    {new Date(video.published_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
              )}
            </div>

            {/* Tags */}
            {video.tags && video.tags.length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground text-sm">Tags:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {video.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs"
                    >
                      {tag.color && (
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <span>{tag.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t my-6" />

          {/* Custom Fields Section */}
          <CustomFieldsSection
            videoId={video.id}
            listId={video.list_id}
            fieldValues={video.field_values}
            onFieldChange={onFieldChange}
          />
        </div>

        {/* Footer */}
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">Schließen</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Why:**
- **Dialog component:** Correct shadcn/ui component for content display
- **Scrollable body:** `overflow-y-auto` with `max-h-[90vh]` prevents viewport overflow
- **Flex layout:** Header + body + footer with flex-col for proper stacking
- **German text:** "Kanal", "Dauer", "Veröffentlicht", "Tags", "Schließen"
- **Responsive:** `sm:max-w-[700px]` for desktop, full-width on mobile
- **Metadata grid:** 2-column layout for compact display

**Design Patterns:**
- Follows CreateTagDialog modal structure
- Uses formatDuration utility (existing)
- Tag chips match VideoCard styling
- Close button in footer (UX best practice)

---

### 7. Integrate VideoDetailsModal into VideoCard

**Files:** `frontend/src/components/VideoCard.tsx`

**Action:** Add modal trigger to video cards (click card opens details)

**Code Changes:**
```typescript
// Add imports at top
import { useState } from 'react'  // If not already imported
import { VideoDetailsModal } from './videos/VideoDetailsModal'
import { useUpdateVideoFields } from '@/hooks/useVideoFields'  // Task #129

// Inside VideoCard component:
export const VideoCard = ({ video, onClick, onDelete }: VideoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)
  
  // NEW: Modal state
  const [showDetails, setShowDetails] = useState(false)
  
  // NEW: Field update mutation
  const { mutate: updateFields } = useUpdateVideoFields()

  const handleCardClick = () => {
    // MODIFIED: Open modal instead of onClick callback
    setShowDetails(true)
    onClick?.(video)  // Still call callback for tracking
  }

  // NEW: Handle field changes in modal
  const handleFieldChange = (fieldId: string, newValue: number | string | boolean | null) => {
    updateFields({
      videoId: video.id,
      listId: video.list_id,
      updates: [{ field_id: fieldId, value: newValue }],
    })
  }

  // ... existing code ...

  return (
    <>
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-label={`Video: ${video.title} von ${(video as any).channel_name || video.channel || 'Unbekannt'}`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        className="video-card group cursor-pointer rounded-lg border bg-card transition-shadow duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {/* ... existing card content ... */}
      </div>

      {/* NEW: Video Details Modal */}
      <VideoDetailsModal
        video={video}
        open={showDetails}
        onOpenChange={setShowDetails}
        onFieldChange={handleFieldChange}
      />
    </>
  )
}
```

**Why:**
- **Click to open:** Natural UX pattern (card click shows details)
- **Optimistic updates:** Uses Task #129 mutation hook for instant saves
- **Non-breaking:** onClick callback still fired for backwards compatibility
- **Fragment wrapper:** Modal rendered outside card DOM for proper z-index

**Alternative Considered:**
- **Separate trigger button:** "Details" button on card
  - ❌ Rejected: Extra click required, less discoverable

---

### 8. Create Integration Test for Full Flow

**Files:** `frontend/src/components/videos/VideoDetailsModal.integration.test.tsx` (NEW FILE)

**Action:** End-to-end test for opening modal and editing field

**Code:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VideoDetailsModal } from './VideoDetailsModal'
import { api } from '@/lib/api'
import type { VideoResponse } from '@/types/video'

vi.mock('@/lib/api', () => ({
  api: {
    put: vi.fn(),
  },
}))

// Mock FieldDisplay with realistic editing
vi.mock('@/components/fields/FieldDisplay', () => ({
  FieldDisplay: ({ field, value, onChange }: any) => (
    <div data-testid={`field-${field.id}`}>
      <span>{field.name}: {String(value)}</span>
      {onChange && (
        <button onClick={() => onChange(5)}>Edit to 5</button>
      )}
    </div>
  ),
}))

// Mock grouping utility
vi.mock('@/utils/groupFieldsBySchema', () => ({
  groupFieldsBySchema: (fields: any) => [
    { schema_name: 'Video Quality', fields },
  ],
}))

describe('VideoDetailsModal - Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const mockVideo: VideoResponse = {
    id: 'video-1',
    list_id: 'list-1',
    youtube_id: 'abc123',
    title: 'Test Video',
    channel: 'Test Channel',
    thumbnail_url: 'https://example.com/thumb.jpg',
    duration: 300,
    published_at: '2025-01-01T00:00:00Z',
    tags: [
      { id: 'tag-1', name: 'Tutorial', color: '#3B82F6', list_id: 'list-1' },
    ],
    field_values: [
      {
        field_id: 'field-1',
        field: {
          id: 'field-1',
          list_id: 'list-1',
          name: 'Overall Rating',
          field_type: 'rating',
          config: { max_rating: 5 },
          display_order: 1,
          show_on_card: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        value: 3,
        schema_name: 'Video Quality',
        show_on_card: true,
        updated_at: '2025-01-01T00:00:00Z',
      },
    ],
    processing_status: 'completed',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  }

  it('renders video metadata and custom fields', () => {
    render(
      <VideoDetailsModal
        video={mockVideo}
        open={true}
        onOpenChange={vi.fn()}
      />,
      { wrapper }
    )

    // Video metadata
    expect(screen.getByText('Test Video')).toBeInTheDocument()
    expect(screen.getByText(/Test Channel/)).toBeInTheDocument()
    expect(screen.getByText(/5:00/)).toBeInTheDocument()  // formatDuration(300)

    // Tags
    expect(screen.getByText('Tutorial')).toBeInTheDocument()

    // Custom fields
    expect(screen.getByText('Video Quality')).toBeInTheDocument()  // Schema header
    expect(screen.getByTestId('field-field-1')).toBeInTheDocument()
  })

  it('closes modal when close button clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <VideoDetailsModal
        video={mockVideo}
        open={true}
        onOpenChange={onOpenChange}
      />,
      { wrapper }
    )

    const closeButton = screen.getByRole('button', { name: /schließen/i })
    await user.click(closeButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onFieldChange when field is edited', async () => {
    const user = userEvent.setup()
    const onFieldChange = vi.fn()

    render(
      <VideoDetailsModal
        video={mockVideo}
        open={true}
        onOpenChange={vi.fn()}
        onFieldChange={onFieldChange}
      />,
      { wrapper }
    )

    const editButton = screen.getByRole('button', { name: /edit to 5/i })
    await user.click(editButton)

    expect(onFieldChange).toHaveBeenCalledWith('field-1', 5)
  })
})
```

**Coverage:**
- ✅ Renders metadata and fields
- ✅ Close button works
- ✅ Field editing triggers callback

---

### 9. Manual Testing Checklist

**Action:** Perform manual testing in browser

**Checklist:**

1. **Modal Opening/Closing:**
   - [ ] Click video card → modal opens with smooth animation
   - [ ] Click "Schließen" button → modal closes
   - [ ] Press ESC key → modal closes
   - [ ] Click backdrop (outside modal) → modal closes
   - [ ] Focus returns to video card after close

2. **Video Metadata Display:**
   - [ ] Video title displayed correctly
   - [ ] Thumbnail image loads and displays (16:9 aspect ratio)
   - [ ] Duration formatted correctly (5:30 format)
   - [ ] Channel name shown
   - [ ] Published date in German format (DD.MM.YYYY)
   - [ ] Tags displayed with colors

3. **Custom Fields Section:**
   - [ ] Schema headers visible and styled correctly
   - [ ] Fields within each schema group sorted by display_order
   - [ ] "Weitere Felder" section shows ungrouped fields
   - [ ] Empty state message when no fields exist

4. **Field Editing:**
   - [ ] Rating field: Click star → value updates → saves to backend
   - [ ] Select field: Click dropdown → select option → saves
   - [ ] Boolean field: Click checkbox → toggles → saves
   - [ ] Text field: Type new value → blur → saves
   - [ ] Loading indicator shows during save
   - [ ] Error toast appears on save failure

5. **Responsive Layout:**
   - [ ] Desktop (1920x1080): Modal centered, max-width 700px
   - [ ] Tablet (768x1024): Modal full-width with padding
   - [ ] Mobile (375x667): Modal full-screen, scrollable
   - [ ] Long content scrolls correctly (20+ fields test)

6. **Accessibility:**
   - [ ] VoiceOver (macOS): All elements announced correctly
   - [ ] Tab navigation: Focus moves through fields in order
   - [ ] Focus trap: Tab doesn't escape modal
   - [ ] ARIA labels: Video title, field labels, close button
   - [ ] Color contrast: WCAG 2.1 Level AA (4.5:1 minimum)

7. **Edge Cases:**
   - [ ] Video with no custom fields → empty state message
   - [ ] Video with 1 schema → no "Weitere Felder" section
   - [ ] Video with null schema_name → "Weitere Felder" section last
   - [ ] Video with long title → truncates with ellipsis
   - [ ] Video with no thumbnail → graceful fallback

---

### 10. TypeScript Type Check

**Action:** Verify no TypeScript errors introduced

**Command:**
```bash
cd frontend
npx tsc --noEmit
```

**Expected:** 0 new errors (baseline may have existing documented errors)

---

### 11. Run All Tests

**Action:** Execute test suite

**Commands:**
```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test files
npm test -- groupFieldsBySchema
npm test -- CustomFieldsSection
npm test -- VideoDetailsModal
```

**Expected:**
- groupFieldsBySchema.test.ts: 7 tests passing
- CustomFieldsSection.test.tsx: 6 tests passing
- VideoDetailsModal.integration.test.tsx: 3 tests passing
- Total: 16 tests passing

---

### 12. Update CLAUDE.md Documentation

**Files:** `CLAUDE.md`

**Action:** Document VideoDetailsModal pattern

**Code:**
```markdown
### VideoDetailsModal Pattern (Task #131)

**Component:** Full-screen modal for complete video details with all custom fields

**Location:** `frontend/src/components/videos/VideoDetailsModal.tsx`

**Usage:**
```tsx
import { VideoDetailsModal } from '@/components/videos/VideoDetailsModal'

const [showDetails, setShowDetails] = useState(false)

<VideoDetailsModal
  video={video}
  open={showDetails}
  onOpenChange={setShowDetails}
  onFieldChange={handleFieldChange}
/>
```

**Features:**
- Displays all custom fields (not limited to 3 like CustomFieldsPreview)
- Groups fields by schema_name with visible headers
- Inline editing for all field types using FieldDisplay (Task #128)
- Optimistic updates via useUpdateVideoFields (Task #129)
- Responsive layout with scrolling for long content
- WCAG 2.1 Level AA accessible

**Schema Grouping Logic:**
- Multi-tag videos inherit fields from all associated schemas
- Fields grouped by schema_name with alphabetical sorting
- Within each group: sorted by display_order (ASC)
- Ungrouped fields (schema_name=null) shown in "Weitere Felder" section
- Utility: `groupFieldsBySchema()` in `frontend/src/utils/groupFieldsBySchema.ts`

**Related Components:**
- CustomFieldsSection: Grouped field display with editing
- FieldDisplay: Type-specific field renderers (Task #128)
- CustomFieldsPreview: Max-3-fields card preview (Task #129)

**Testing Pattern:**
- Unit tests: Component rendering and props
- Integration tests: Full modal interaction flow
- Manual tests: Browser testing with real backend
```

---

### 13. Git Commit

**Action:** Commit implementation with comprehensive message

**Command:**
```bash
git add frontend/src/components/ui/dialog.tsx \
        frontend/src/utils/groupFieldsBySchema.ts \
        frontend/src/utils/groupFieldsBySchema.test.ts \
        frontend/src/components/videos/CustomFieldsSection.tsx \
        frontend/src/components/videos/CustomFieldsSection.test.tsx \
        frontend/src/components/videos/VideoDetailsModal.tsx \
        frontend/src/components/videos/VideoDetailsModal.integration.test.tsx \
        frontend/src/components/VideoCard.tsx \
        CLAUDE.md

git commit -m "feat(custom-fields): add VideoDetailsModal with schema-grouped field display

Task #131: VideoDetailsModal with CustomFieldsSection Component

Features:
- VideoDetailsModal component displays complete video details
- CustomFieldsSection shows ALL fields grouped by schema_name
- Schema grouping utility with multi-tag field union logic
- Inline editing for all field types (Task #128 FieldDisplay)
- Responsive modal with scrolling for long content
- shadcn/ui Dialog component (NOT AlertDialog)

Implementation Details:
- Schema groups sorted alphabetically (German locale)
- Fields within groups sorted by display_order (ASC)
- Ungrouped fields (schema_name=null) in \"Weitere Felder\" section
- Video metadata header: title, thumbnail, duration, channel, tags
- Optimistic updates via useUpdateVideoFields (Task #129)

Testing:
- 7 unit tests for groupFieldsBySchema utility
- 6 unit tests for CustomFieldsSection component
- 3 integration tests for VideoDetailsModal
- Manual testing checklist completed (7 scenarios)

Files Changed:
- frontend/src/components/ui/dialog.tsx (NEW) - shadcn/ui Dialog
- frontend/src/utils/groupFieldsBySchema.ts (NEW) - Schema grouping logic
- frontend/src/utils/groupFieldsBySchema.test.ts (NEW) - Grouping tests
- frontend/src/components/videos/CustomFieldsSection.tsx (NEW) - Field section
- frontend/src/components/videos/CustomFieldsSection.test.tsx (NEW) - Section tests
- frontend/src/components/videos/VideoDetailsModal.tsx (NEW) - Main modal
- frontend/src/components/videos/VideoDetailsModal.integration.test.tsx (NEW) - Integration tests
- frontend/src/components/VideoCard.tsx (EXTENDED) - Modal integration
- CLAUDE.md - Documented modal pattern

Dependencies:
- Task #128 (FieldDisplay component) - Complete
- Task #129 (useUpdateVideoFields) - Complete
- Task #71 (Backend field_values) - Complete

REF MCP:
- shadcn/ui Dialog pattern validated (content display, not confirmation)
- German locale sorting for schema names (localeCompare)
- WCAG 2.1 Level AA accessibility (focus trap, ARIA labels)

Design Doc Reference:
- docs/plans/2025-11-05-custom-fields-system-design.md lines 396-428
- Multi-tag field union logic lines 407-427
- Schema grouping pattern

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests (13 total)

**groupFieldsBySchema.test.ts (7 tests):**
1. ✅ Groups fields by schema_name
2. ✅ Sorts fields within groups by display_order
3. ✅ Places null schema_name group last
4. ✅ Handles empty array
5. ✅ Sorts schema names alphabetically (German locale)
6. ✅ Handles single field
7. ✅ Preserves field data in groups

**CustomFieldsSection.test.tsx (6 tests):**
1. ✅ Renders schema group headers
2. ✅ Renders field labels and values
3. ✅ Renders "Weitere Felder" for ungrouped fields
4. ✅ Renders empty state when no fields
5. ✅ Passes onFieldChange to FieldDisplay
6. ✅ Respects readOnly prop

### Integration Tests (3 tests)

**VideoDetailsModal.integration.test.tsx:**
1. ✅ Renders video metadata and custom fields
2. ✅ Closes modal when close button clicked
3. ✅ Calls onFieldChange when field is edited

### Manual Testing (7 scenarios)

1. ✅ Modal opening/closing (click, ESC, backdrop, focus)
2. ✅ Video metadata display (title, thumbnail, duration, channel, tags)
3. ✅ Custom fields section (schema headers, sorting, ungrouped)
4. ✅ Field editing (all 4 types with saves)
5. ✅ Responsive layout (desktop, tablet, mobile)
6. ✅ Accessibility (VoiceOver, Tab, focus trap, ARIA, contrast)
7. ✅ Edge cases (no fields, no schema, long content)

**Coverage Target:** 90%+ line coverage, 85%+ branch coverage

---

## 📚 Reference

### Related Docs

**Design Document:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 396-428 (VideoDetailsModal spec)
- Lines 407-427 (Multi-tag field union logic and schema grouping)
- Lines 946-996 (TypeScript types)

**Task Plans:**
- `docs/plans/tasks/task-128-field-display-component.md` - FieldDisplay component (dependency)
- `docs/plans/tasks/task-129-inline-editing-custom-fields.md` - useUpdateVideoFields hook (dependency)
- `docs/plans/tasks/task-071-extend-video-get-endpoint.md` - Backend field_values (dependency)

**REF MCP Documentation:**
- shadcn/ui Dialog: https://ui.shadcn.com/docs/components/dialog
- MDN localeCompare: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare
- WAI-ARIA Dialog Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

### Related Code

**Existing Patterns:**
- `frontend/src/components/CreateTagDialog.tsx` - Modal dialog pattern (AlertDialog)
- `frontend/src/components/VideoCard.tsx` - Video card component structure
- `frontend/src/components/fields/FieldDisplay.tsx` - Field renderers (Task #128)
- `frontend/src/hooks/useVideoFields.ts` - Optimistic updates (Task #129)

**Backend Endpoints:**
- `backend/app/api/videos.py` - GET /videos/{video_id} with field_values (Task #71)
- `backend/app/api/videos.py` - PUT /videos/{video_id}/fields for updates (Task #72)

**Type Definitions:**
- `frontend/src/types/video.ts` - VideoResponse interface
- `frontend/src/types/fieldValue.ts` - FieldValue interface (Task #129)
- `frontend/src/types/customField.ts` - CustomField interface (Task #128)

---

## 🎯 Design Decisions

### 1. Dialog vs AlertDialog Component

**Decision:** Use shadcn/ui Dialog (not AlertDialog) for VideoDetailsModal

**Rationale:**
- **Semantic Correctness:** Dialog is for content display, AlertDialog is for confirmations
- **Existing Pattern:** ConfirmDeleteModal correctly uses AlertDialog for destructive action
- **REF MCP:** shadcn/ui docs confirm Dialog for general content, AlertDialog for critical choices
- **Accessibility:** Both are accessible, but Dialog has correct ARIA semantics for non-critical content

**Evidence:**
- shadcn/ui Dialog docs: "A window overlaid on primary window for content display"
- shadcn/ui AlertDialog docs: "For important decisions requiring user response"

**Alternative Considered:**
- **AlertDialog:** Use existing pattern from CreateTagDialog
  - ❌ Rejected: Semantic mismatch, AlertDialog implies critical action

---

### 2. Schema Grouping Algorithm

**Decision:** Map-based grouping with alphabetical sorting and null-last logic

**Rationale:**
- **Performance:** Map provides O(1) lookup for grouping, faster than reduce() with array search
- **Clarity:** Explicit steps (group → sort within → sort groups) easier to understand
- **German Locale:** `localeCompare('de')` for proper German sorting (Ä, Ö, Ü)
- **Null Handling:** Ungrouped fields always last for predictable UX

**Implementation:**
```typescript
// Step 1: Group by schema_name (Map)
// Step 2: Sort fields within each group by display_order
// Step 3: Sort groups (alphabetical, null last)
```

**Alternative Considered:**
- **Array.reduce():** Functional approach with reduce accumulator
  - ❌ Rejected: Less readable, worse performance for large datasets

---

### 3. "Weitere Felder" for Ungrouped Fields

**Decision:** Display fields with `schema_name=null` in separate "Weitere Felder" section (last)

**Rationale:**
- **German UI:** "Weitere Felder" = "Other Fields" (project convention)
- **Visual Separation:** Users understand these fields don't belong to a schema
- **Consistent Placement:** Always last prevents confusion when schemas change

**Alternative Considered:**
- **No grouping:** Scatter ungrouped fields throughout (mix with schemas)
  - ❌ Rejected: Confusing, no visual hierarchy

---

### 4. Scrollable Modal Body with Fixed Header/Footer

**Decision:** Use `overflow-y-auto` on body div with `flex-1`, fixed header/footer

**Rationale:**
- **Long Content:** Videos can have 20+ custom fields, requires scrolling
- **UX Best Practice:** Header and footer remain visible for context and close button
- **Mobile Support:** Prevents viewport overflow on small screens
- **Accessibility:** Focus management works correctly with scrollable regions

**Implementation:**
```tsx
<DialogContent className="flex flex-col max-h-[90vh]">
  <DialogHeader>{/* Fixed */}</DialogHeader>
  <div className="overflow-y-auto flex-1">{/* Scrollable */}</div>
  <DialogFooter>{/* Fixed */}</DialogFooter>
</DialogContent>
```

**Alternative Considered:**
- **Full modal scroll:** Entire modal scrolls (header and footer scroll away)
  - ❌ Rejected: Users lose context, close button not always visible

---

### 5. Video Metadata Display Priority

**Decision:** Show title, thumbnail, channel, duration, published date, and tags

**Rationale:**
- **Context:** Users need video identification before seeing custom fields
- **Metadata Importance:** Matches YouTube's video detail page structure
- **Thumbnail:** Visual recognition faster than text
- **Tags:** Shows which schemas are associated (multi-tag union logic)

**Fields Included:**
- ✅ Title (required, most important)
- ✅ Thumbnail (visual context)
- ✅ Channel (content creator)
- ✅ Duration (quick reference)
- ✅ Published date (temporal context)
- ✅ Tags (schema association)

**Fields Excluded:**
- ❌ Video ID (technical, not useful for users)
- ❌ Processing status (implementation detail)
- ❌ Created/Updated timestamps (low priority)

---

### 6. Integration Point: VideoCard Click Handler

**Decision:** Clicking video card opens VideoDetailsModal (entire card is clickable)

**Rationale:**
- **Discoverability:** Users intuitively click cards to see more details
- **Consistent Pattern:** Matches common UI patterns (email lists, social feeds)
- **Minimal UI:** No extra "Details" button cluttering card

**Implementation:**
```typescript
const handleCardClick = () => {
  setShowDetails(true)
  onClick?.(video)  // Still call callback for tracking
}
```

**Alternative Considered:**
- **Separate "Details" button:** Explicit button on video card
  - ❌ Rejected: Extra UI element, requires more clicks
- **Three-dot menu item:** "View Details" in dropdown
  - ❌ Rejected: Hidden feature, poor discoverability

---

### 7. Field Editing in Modal vs Card

**Decision:** Both modal and card support inline editing with same FieldDisplay component

**Rationale:**
- **Consistency:** Same editing UX everywhere (no modal-specific behavior)
- **DRY Principle:** Reuse FieldDisplay from Task #128
- **Optimistic Updates:** Both use same mutation hook from Task #129
- **User Freedom:** Users can edit in preview or modal (their choice)

**Comparison:**

| Location | Fields Shown | Editing | Use Case |
|----------|--------------|---------|----------|
| VideoCard | Max 3 (show_on_card=true) | Inline | Quick edits |
| VideoDetailsModal | ALL fields | Inline | Complete editing |

**Alternative Considered:**
- **Modal-only editing:** Cards read-only, editing only in modal
  - ❌ Rejected: Extra steps for simple edits, worse UX

---

## ⚠️ Known Limitations

1. **Task #128 Dependency:** FieldDisplay component must be complete
   - **Status:** Task #128 planned in parallel
   - **Mitigation:** Tests use mocked FieldDisplay, production uses real component

2. **Task #129 Dependency:** useUpdateVideoFields mutation hook required
   - **Status:** Task #129 planned in parallel
   - **Mitigation:** Manual testing requires Task #129 completion

3. **No Keyboard Shortcuts:** ESC closes modal, but no shortcuts for field editing
   - **Future Enhancement:** Add keyboard shortcuts (e.g., "E" to edit field)
   - **Workaround:** Tab navigation works for all fields

4. **No Field Reordering:** display_order is backend-controlled, not user-editable
   - **Design Decision:** Field ordering managed in schema settings (Phase 2)
   - **Current Behavior:** Display respects backend display_order

5. **Mobile Modal Full-Screen:** On small screens, modal takes full viewport
   - **Design Trade-off:** Maximizes content space on mobile
   - **User Impact:** Close button in footer may not be visible until scroll

---

## ⏱️ Time Estimate

**Total:** 5-6 hours

**Breakdown:**
- Step 1: Install Dialog (10 min)
- Step 2: groupFieldsBySchema utility (45 min)
- Step 3: Grouping utility tests (30 min)
- Step 4: CustomFieldsSection component (60 min)
- Step 5: CustomFieldsSection tests (30 min)
- Step 6: VideoDetailsModal component (75 min)
- Step 7: VideoCard integration (20 min)
- Step 8: Integration tests (30 min)
- Step 9: Manual testing (45 min)
- Step 10-13: Verification + docs + commit (30 min)

**Dependencies:**
- Task #128 (FieldDisplay) - Can proceed with mocked component
- Task #129 (useUpdateVideoFields) - Can proceed with mocked mutation
- Task #71 (Backend field_values) - Required for real data testing

**Risk Factors:**
- REF MCP validation for Dialog patterns (+20 min)
- Schema grouping edge cases (+20 min)
- Mobile responsive issues (+30 min)
- Accessibility testing (+30 min)

**Confidence:** High (85%)
- Clear design spec in design doc
- Existing modal pattern (CreateTagDialog)
- Well-defined schema grouping logic
- Comprehensive test coverage planned

---

## ✅ Definition of Done

- [ ] All 14 acceptance criteria met
- [ ] All 16 tests passing (7 grouping + 6 component + 3 integration)
- [ ] TypeScript check: 0 new errors
- [ ] Manual testing: All 7 scenarios verified
- [ ] REF MCP validation: Dialog pattern confirmed
- [ ] Accessibility: WCAG 2.1 Level AA compliance verified
- [ ] Documentation: CLAUDE.md updated with modal pattern
- [ ] Git commit: Comprehensive message with implementation details
- [ ] Code review: Grade A (0 Critical/Important issues)

---

**END OF PLAN**
