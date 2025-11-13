# Custom Fields Display Pattern

**Status:** Active (Task #89)
**Last Updated:** 2025-11-12

## Overview

Pattern for displaying and editing custom field values with type-safe discriminated unions, optimistic UI updates, and inline editing.

## Type System - Discriminated Union Pattern

```typescript
// Zod schemas define runtime validation + TypeScript types
export const RatingFieldValueSchema = z.object({
  field_id: z.string().uuid(),
  field: z.object({
    name: z.string(),
    field_type: z.literal('rating'),
    config: z.object({ max_rating: z.number() })
  }),
  value: z.number().nullable(),
  schema_name: z.string(),
  show_on_card: z.boolean().default(false)
})

export const VideoFieldValueSchema = z.union([
  RatingFieldValueSchema,
  SelectFieldValueSchema,
  BooleanFieldValueSchema,
  TextFieldValueSchema
])

export type VideoFieldValue = z.infer<typeof VideoFieldValueSchema>

// Type guards for discriminated unions
export function isRatingFieldValue(fv: VideoFieldValue): fv is RatingFieldValue {
  return fv.field.field_type === 'rating'
}
```

## Optimistic UI Updates Pattern

```typescript
export const useUpdateFieldValue = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoId, fieldId, value }) => {
      const { data } = await api.put(`/api/videos/${videoId}/fields`, {
        updates: [{ field_id: fieldId, value }]
      })
      return data
    },
    onMutate: async ({ videoId, fieldId, value }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: videoKeys.all })

      // Snapshot current state
      const previousData = queryClient.getQueriesData({ queryKey: videoKeys.all })

      // Optimistically update UI
      queryClient.setQueriesData({ queryKey: videoKeys.all }, (old) => {
        // Update logic...
      })

      return { previousData }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    }
  })
}
```

## Inline Editing Pattern

**Features:**
- **saveOnBlur**: Save changes when focus leaves input (default: true)
- **Keyboard shortcuts**: Tab/Enter saves, Escape cancels
- **Event isolation**: `stopPropagation()` prevents parent click handlers

**Components:**
- `RatingStars.tsx` - Star rating with keyboard navigation
- `SelectBadge.tsx` - Dropdown selection with Badge UI
- `TextSnippet.tsx` - Inline text edit with expand/collapse
- `BooleanCheckbox.tsx` - Checkbox toggle

## Performance Optimization for Large Lists

```typescript
// Memoize derived data to prevent recalculations on every render
const cardFields = useMemo(
  () => fieldValues.filter(fv => fv.show_on_card).slice(0, 3),
  [fieldValues]
)

const hasMoreFields = useMemo(
  () => fieldValues.filter(fv => fv.show_on_card).length > 3,
  [fieldValues]
)

// Memoize callbacks to prevent child re-renders
const handleFieldChange = useCallback(
  (fieldId: string, value: string | number | boolean) => {
    updateField.mutate({ listId, videoId, fieldId, value })
  },
  [updateField, listId, videoId]
)

// Memo entire component if it receives stable props
export const CustomFieldsPreview = React.memo(({ ... }) => { ... })
```

## Accessibility Pattern (WCAG 2.1 AA)

```typescript
// Semantic ARIA labels with context
<div
  role="group"
  aria-label={`${fieldName}: ${value ?? 0} out of ${maxRating}`}
>
  <button
    aria-label={`Rate ${index + 1} out of ${maxRating}`}
    onKeyDown={(e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()  // Prevent VideoCard navigation
        onChange?.(index + 2)
      }
    }}
  />
</div>

// More badge with count
<Badge aria-label={`View ${moreFieldsCount} more fields`}>
  +{moreFieldsCount} more
</Badge>
```

## Implementation Files

- **Types:** `frontend/src/types/video.ts` (VideoFieldValue schemas)
- **Hook:** `frontend/src/hooks/useVideoFieldValues.ts` (optimistic updates)
- **Components:** `frontend/src/components/fields/`
  - RatingStars.tsx
  - SelectBadge.tsx
  - TextSnippet.tsx
  - BooleanCheckbox.tsx
  - FieldDisplay.tsx (type dispatcher)
  - CustomFieldsPreview.tsx (card preview)
- **Integration:** `frontend/src/components/VideoCard.tsx` (lines 167-175)

## Performance Targets

- Grid with 100 VideoCards: Smooth 60fps scrolling with memoization
- Optimistic update latency: <16ms (single frame)
- API call: Backend validation + DB update <100ms

## Testing

- 41 tests total (16 unit + 13 hook + 12 integration)
- Located in `frontend/src/components/fields/__tests__/`

## Related Documentation

- Task #78: CustomField TypeScript types
- Task #79: useCustomFields hook (CRUD operations template)
- Task #89: CustomFieldsPreview implementation
- Components: `docs/components/field-display.md`
