# CustomFieldsSection Component

**Location:** `frontend/src/components/CustomFieldsSection.tsx`
**Task:** #131 (DRY extraction)
**Status:** Active

## Purpose

Shared component for displaying custom fields grouped by schema. Used by both VideoDetailsPage and VideoDetailsModal to eliminate code duplication (DRY principle).

## Features

- Groups fields by `schema_name` with Collapsible sections
- All schemas expanded by default
- Uses FieldDisplay for type-specific rendering
- Supports optional `onExpand` callback for modal scroll handling

## Props

```typescript
interface CustomFieldsSectionProps {
  availableFields: AvailableFieldResponse[]  // All available fields (filled + empty)
  fieldValues: VideoFieldValue[]             // Current field values
  videoId: string                            // Video ID for mutations
  listId: string                             // List ID for mutations
  onFieldChange: (fieldId: string, value: string | number | boolean) => void  // Change handler
  onExpand?: () => void  // Optional: modal scroll to expanded field
}
```

## Usage Examples

### In VideoDetailsPage

```typescript
<CustomFieldsSection
  availableFields={video.available_fields || []}
  fieldValues={video.field_values || []}
  videoId={video.id}
  listId={video.list_id}
  onFieldChange={handleFieldChange}
/>
```

### In VideoDetailsModal

```typescript
<CustomFieldsSection
  availableFields={video.available_fields || []}
  fieldValues={video.field_values || []}
  videoId={video.id}
  listId={listId}
  onFieldChange={onFieldChange}
  onExpand={() => {
    // Optional: scroll to expanded field in modal
  }}
/>
```

## Implementation Details

### Schema Grouping

```typescript
const groupedFields = availableFields.reduce((acc, field) => {
  const schemaName = field.schema_name || 'Allgemeine Felder'
  if (!acc[schemaName]) {
    acc[schemaName] = []
  }
  acc[schemaName].push(field)
  return acc
}, {} as Record<string, AvailableFieldResponse[]>)

// Sort schemas alphabetically
const sortedSchemas = Object.keys(groupedFields).sort()
```

### Collapsible State Management

```typescript
const [openSchemas, setOpenSchemas] = useState<Record<string, boolean>>({})

// All schemas expanded by default
useEffect(() => {
  const initialState = sortedSchemas.reduce((acc, schema) => {
    acc[schema] = true
    return acc
  }, {} as Record<string, boolean>)
  setOpenSchemas(initialState)
}, [sortedSchemas])
```

## Code Reduction Impact

**VideoDetailsPage refactoring:**
- Before: 344 lines (with inline schema grouping)
- After: 181 lines (-163 lines, 47% reduction)

**VideoDetailsModal benefit:**
- Reuses same component instead of duplicating logic
- Eliminates 200+ lines of potential duplication

## Testing

- 42/42 tests passing
- Tests cover: schema grouping, Collapsible behavior, field rendering, change handlers

## Related Documentation

- Usage: `docs/components/video-details-page.md` (Task #130)
- Usage: `docs/components/video-details-modal.md` (Task #131)
- Sub-component: `docs/components/field-display.md` (Task #128)
- Report: `docs/reports/2025-11-13-task-131-report.md`
