# VideoDetailsPage Component

**Location:** `frontend/src/pages/VideoDetailsPage.tsx`
**Tasks:** #130, #131
**Status:** Active

## Purpose

Separate page for viewing and editing video details with custom fields. YouTube-like navigation UX with schema-grouped custom fields.

## Route Configuration

```typescript
// App.tsx
<Route path="/videos/:videoId" element={<VideoDetailsPage />} />
```

## Navigation Pattern

- Click on video thumbnail/title → Navigate to `/videos/:videoId`
- Click on channel name → Filter by channel tag (uses TagNavigation)
- Back button returns to `/videos` grid view

## Page Structure

- **Video header:** Large 16:9 thumbnail, title (h1), channel link, duration, tags
- **Custom Fields section:** Grouped by schema with Collapsible sections
- **All schemas expanded by default** on page load

## Custom Fields Grouping

```typescript
// Group available_fields by schema_name
const groupedFields = (video?.available_fields || []).reduce((acc, field) => {
  const schemaName = field.schema_name || 'Allgemeine Felder'
  if (!acc[schemaName]) {
    acc[schemaName] = []
  }
  acc[schemaName].push(field)
  return acc
}, {} as Record<string, AvailableFieldResponse[]>)
```

## Collapsible Sections (REF MCP Best Practices)

- Controlled Collapsible with `open`/`onOpenChange` props
- Local state: `const [openSchemas, setOpenSchemas] = useState<Record<string, boolean>>({})`
- CollapsibleTrigger uses `asChild` pattern with Button for keyboard navigation
- Shows field count: "Schema Name (5 Felder)"
- Alphabetically sorted schemas

## FieldDisplay Integration

```typescript
// CRITICAL: Use correct interface from Task #129
<FieldDisplay
  fieldValue={videoFieldValue}  // Entire object, NOT separate field+value
  readonly={false}              // NOT "editable" prop
  onChange={(value) => handleFieldChange(field.field_id, value)}
  onExpand={() => ...}          // Optional, for TextSnippet
/>
```

## Field Value Mutations

- Uses PUT `/api/videos/:id/fields` batch update endpoint (Task #72)
- Mutation with `onSuccess` invalidation (simplified, not optimistic updates)
- Type-safe discriminated union handling for all 4 field types

## Channel Tag Filter Integration

```typescript
// VideoCard.tsx - Channel click handler
const handleChannelClick = (e: React.MouseEvent, channelName: string) => {
  e.stopPropagation()  // CRITICAL: Prevent card navigation

  const channelTag = tags.find(tag =>
    tag.name.toLowerCase() === channelName.toLowerCase()
  )

  if (channelTag) {
    toggleTag(channelTag.id)
    navigate('/videos')  // Return to grid with filter applied
  }
}
```

## DRY Component Extraction (Task #131)

VideoDetailsPage was refactored to use `CustomFieldsSection` component:
- **Before:** 344 lines
- **After:** 181 lines (-163 lines, 47% reduction)
- See `docs/components/custom-fields-section.md` for reusable component

## Testing

- 30 comprehensive tests (19 unit + 3 integration + 5 accessibility + 3 edge cases)
- Mock React Router's useParams and useNavigate
- Mock TanStack Query's useQuery and useMutation
- Factory functions for test data (all 4 field types)

## Related Documentation

- Shared Component: `docs/components/custom-fields-section.md` (Task #131)
- Modal Alternative: `docs/components/video-details-modal.md` (Task #131)
- Field Union: `docs/patterns/field-union-pattern.md` (Task #74)
- Field Display: `docs/components/field-display.md` (Task #128)
