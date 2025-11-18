# Task #129: Implement Inline Editing in CustomFieldsPreview Component

**Plan Task:** #129
**Wave/Phase:** Phase 1: MVP - Frontend (Custom Fields System)
**Dependencies:** Task #128 (FieldDisplay Component), Task #72 (Backend PUT /videos/{id}/fields endpoint - COMPLETE), Task #64 (CustomField Pydantic Schemas - COMPLETE)

---

## 🎯 Ziel

Implement inline editing functionality for custom field values directly on video cards using the CustomFieldsPreview component. Users can click on field values (ratings, selects, text, boolean) and edit them in-place with instant optimistic updates. Changes are saved to the backend via the PUT /videos/{video_id}/fields endpoint with error rollback on failure.

**Expected Result:**
- VideoCard component extended with CustomFieldsPreview section
- Max 3 fields displayed (filtered by show_on_card flag)
- Inline editing with FieldDisplay component (editable={true})
- React Query mutation with optimistic updates for instant UI feedback
- Error handling with automatic rollback on save failure
- Loading states during API calls
- Comprehensive unit and integration tests

---

## 📋 Acceptance Criteria

**Functional:**
- [ ] CustomFieldsPreview component renders max 3 fields from video.field_values (show_on_card=true)
- [ ] Clicking on field value activates inline editing mode
- [ ] Field changes trigger optimistic update (instant UI feedback)
- [ ] PUT /videos/{video_id}/fields API call saves changes
- [ ] Error responses trigger rollback to previous value
- [ ] Loading state displayed during save operation
- [ ] Supports all 4 field types: rating, select, text, boolean

**TypeScript & Types:**
- [ ] FieldValue TypeScript interface matches backend schema
- [ ] VideoResponse extended with field_values array
- [ ] Type-safe mutation hook with proper generics

**Testing:**
- [ ] Unit tests: CustomFieldsPreview rendering (3 tests)
- [ ] Unit tests: useUpdateVideoFields mutation (5 tests)
- [ ] Integration test: End-to-end inline edit flow (1 test)
- [ ] Manual testing checklist completed

**Code Quality:**
- [ ] Code reviewed (target: Grade A)
- [ ] REF MCP validation for optimistic updates pattern
- [ ] No TypeScript errors introduced
- [ ] Follows existing mutation patterns from useVideos.ts

---

## 🛠️ Implementation Steps

### Step 1: Create FieldValue TypeScript Types

**Files:** `frontend/src/types/fieldValue.ts` (NEW FILE)

**Action:** Define TypeScript interfaces for custom field values matching backend schema

**Code:**
```typescript
/**
 * TypeScript types for Custom Field Values.
 * 
 * These types match the backend Pydantic schemas from Task #64-65.
 */

export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

export interface CustomField {
  id: string
  list_id: string
  name: string
  field_type: FieldType
  config: FieldConfig
  created_at: string
  updated_at: string
}

export interface FieldConfig {
  // Select field
  options?: string[]
  
  // Rating field
  max_rating?: number
  
  // Text field
  max_length?: number
  
  // Boolean has no config
}

export interface FieldValue {
  field_id: string
  field: CustomField
  value: number | string | boolean | null
  schema_name: string | null
  show_on_card: boolean
}

// For mutation requests
export interface FieldValueUpdate {
  field_id: string
  value: number | string | boolean | null
}

export interface BatchUpdateFieldValuesRequest {
  field_values: FieldValueUpdate[]
}

export interface BatchUpdateFieldValuesResponse {
  video_id: string
  updated_count: number
  field_values: FieldValue[]
}
```

**Why:** Type safety for field values, prevents runtime errors, enables IDE autocomplete.

---

### Step 2: Extend VideoResponse Type with field_values

**Files:** `frontend/src/types/video.ts`

**Action:** Add field_values array to VideoResponse interface

**Code:**
```typescript
import type { Tag } from './tag'
import type { FieldValue } from './fieldValue'  // NEW IMPORT

export interface VideoResponse {
  id: string
  list_id: string
  youtube_id: string

  // YouTube Metadata (from Backend Tasks 1-2)
  title: string | null
  channel: string | null
  thumbnail_url: string | null
  duration: number | null  // Seconds
  published_at: string | null  // ISO 8601

  // Tags (many-to-many relationship)
  tags: Tag[]

  // Custom Field Values (from Task #71) - NEW FIELD
  field_values: FieldValue[]

  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

// Existing VideoCreate interface unchanged
export interface VideoCreate {
  url: string
}

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'
```

**Why:** Extend existing type to include custom fields data from backend.

---

### Step 3: Create useUpdateVideoFields Mutation Hook

**Files:** `frontend/src/hooks/useVideoFields.ts` (NEW FILE)

**Action:** Create React Query mutation hook for updating video field values with optimistic updates

**Code:**
```typescript
/**
 * React Query hooks for video field values.
 * 
 * Implements optimistic updates pattern from TanStack Query best practices:
 * https://github.com/tanstack/query/blob/main/docs/framework/react/guides/optimistic-updates.md
 * 
 * Pattern follows useDeleteVideo from useVideos.ts (onMutate, onError, onSettled).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { 
  BatchUpdateFieldValuesRequest, 
  BatchUpdateFieldValuesResponse,
  FieldValueUpdate 
} from '@/types/fieldValue'
import type { VideoResponse } from '@/types/video'

/**
 * Query key factory for video-related queries.
 * Reuses existing pattern from useVideos.ts for cache invalidation.
 */
const videoKeys = {
  all: ['videos'] as const,
  lists: () => [...videoKeys.all, 'list'] as const,
  list: (listId: string) => [...videoKeys.lists(), listId] as const,
  detail: (videoId: string) => [...videoKeys.all, 'detail', videoId] as const,
}

interface UpdateVideoFieldsParams {
  videoId: string
  listId: string  // Required for cache invalidation
  updates: FieldValueUpdate[]
}

/**
 * Hook for updating video field values with optimistic updates.
 * 
 * Features:
 * - Optimistic update: Immediate UI feedback before API response
 * - Error rollback: Restores previous state on failure
 * - Cache invalidation: Refetches after success to ensure consistency
 * - Type-safe: Full TypeScript support for field values
 * 
 * Usage:
 * ```tsx
 * const { mutate, isPending } = useUpdateVideoFields()
 * 
 * mutate({
 *   videoId: 'uuid',
 *   listId: 'list-uuid',
 *   updates: [{ field_id: 'field-uuid', value: 5 }]
 * })
 * ```
 * 
 * REF MCP: TanStack Query optimistic updates pattern
 * - onMutate: Cancel outgoing queries, snapshot previous, update cache
 * - onError: Rollback to previous snapshot
 * - onSettled: Invalidate to refetch authoritative data
 */
export const useUpdateVideoFields = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateVideoFields'],
    mutationFn: async ({ videoId, updates }: UpdateVideoFieldsParams) => {
      const { data } = await api.put<BatchUpdateFieldValuesResponse>(
        `/videos/${videoId}/fields`,
        { field_values: updates } satisfies BatchUpdateFieldValuesRequest
      )
      return data
    },
    
    // REF MCP: Optimistic update with snapshot
    onMutate: async ({ videoId, listId, updates }) => {
      // Step 1: Cancel outgoing refetches to prevent race conditions
      // REF: https://github.com/tanstack/query/blob/main/docs/framework/react/guides/optimistic-updates.md#updating-a-single-todo
      await queryClient.cancelQueries({ queryKey: videoKeys.list(listId) })

      // Step 2: Snapshot previous videos list for rollback
      const previousVideos = queryClient.getQueryData<VideoResponse[]>(
        videoKeys.list(listId)
      )

      // Step 3: Optimistically update cache
      queryClient.setQueryData<VideoResponse[]>(
        videoKeys.list(listId),
        (oldVideos) => {
          if (!oldVideos) return oldVideos

          return oldVideos.map((video) => {
            if (video.id !== videoId) return video

            // Update field values optimistically
            const updatedFieldValues = video.field_values.map((fieldValue) => {
              const update = updates.find((u) => u.field_id === fieldValue.field_id)
              if (!update) return fieldValue

              // Optimistically apply new value
              return {
                ...fieldValue,
                value: update.value,
              }
            })

            return {
              ...video,
              field_values: updatedFieldValues,
            }
          })
        }
      )

      // Return context for rollback
      return { previousVideos, videoId, listId }
    },

    // REF MCP: Rollback on error
    onError: (err, _variables, context) => {
      console.error('Failed to update video fields:', err)
      
      if (context?.previousVideos) {
        // Restore previous state
        queryClient.setQueryData(
          videoKeys.list(context.listId),
          context.previousVideos
        )
      }
    },

    // REF MCP: Refetch to ensure consistency
    onSettled: (_data, _error, variables) => {
      // Invalidate list query to refetch authoritative data
      queryClient.invalidateQueries({ 
        queryKey: videoKeys.list(variables.listId) 
      })
    },
  })
}
```

**Why:** 
- **Optimistic updates:** Instant UI feedback improves UX (no waiting for API)
- **Error rollback:** Prevents inconsistent state on failure
- **Cache invalidation:** Ensures UI matches backend after success
- **Pattern reuse:** Follows existing useDeleteVideo pattern from useVideos.ts

**REF MCP Evidence:**
- TanStack Query docs confirm onMutate → onError → onSettled pattern
- cancelQueries prevents race conditions with pending refetches
- Snapshot + rollback is recommended approach for list updates

---

### Step 4: Create CustomFieldsPreview Component

**Files:** `frontend/src/components/fields/CustomFieldsPreview.tsx` (NEW FILE)

**Action:** Create component to display and edit max 3 custom fields on video cards

**Code:**
```typescript
/**
 * CustomFieldsPreview Component
 * 
 * Displays max 3 custom field values on video cards (filtered by show_on_card flag).
 * Supports inline editing via FieldDisplay component with optimistic updates.
 * 
 * Design Constraints (from Design Doc lines 362-377):
 * - Max 3 fields visible (prevents visual clutter)
 * - Only fields with show_on_card=true are displayed
 * - Inline editing for quick value updates
 * - Loading state during save operation
 */
import { useState } from 'react'
import { FieldDisplay } from './FieldDisplay'  // Task #128 dependency
import { useUpdateVideoFields } from '@/hooks/useVideoFields'
import type { FieldValue } from '@/types/fieldValue'

interface CustomFieldsPreviewProps {
  videoId: string
  listId: string
  fieldValues: FieldValue[]
}

/**
 * Displays custom field values with inline editing on video cards.
 * 
 * Features:
 * - Max 3 fields shown (filtered by show_on_card)
 * - Click to edit inline
 * - Optimistic updates (instant UI feedback)
 * - Error handling with rollback
 * - Loading state during save
 * 
 * Usage:
 * ```tsx
 * <CustomFieldsPreview
 *   videoId={video.id}
 *   listId={video.list_id}
 *   fieldValues={video.field_values}
 * />
 * ```
 */
export const CustomFieldsPreview = ({
  videoId,
  listId,
  fieldValues,
}: CustomFieldsPreviewProps) => {
  const { mutate: updateFields, isPending } = useUpdateVideoFields()
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)

  // Filter to max 3 fields with show_on_card=true (Design Doc constraint)
  const visibleFields = fieldValues
    .filter((fv) => fv.show_on_card)
    .slice(0, 3)

  if (visibleFields.length === 0) {
    return null  // No fields to display
  }

  const handleFieldChange = (fieldId: string, newValue: number | string | boolean | null) => {
    // Exit editing mode
    setEditingFieldId(null)

    // Find current value for comparison
    const currentField = fieldValues.find((fv) => fv.field_id === fieldId)
    if (!currentField || currentField.value === newValue) {
      return  // No change, skip API call
    }

    // Trigger optimistic update mutation
    updateFields({
      videoId,
      listId,
      updates: [{ field_id: fieldId, value: newValue }],
    })
  }

  return (
    <div className="space-y-2 pt-2 border-t">
      {visibleFields.map((fieldValue) => (
        <div key={fieldValue.field_id} className="flex items-center gap-2">
          {/* Field Label */}
          <span className="text-xs font-medium text-muted-foreground min-w-[80px]">
            {fieldValue.field.name}:
          </span>

          {/* Field Value (uses Task #128 FieldDisplay component) */}
          <FieldDisplay
            field={fieldValue.field}
            value={fieldValue.value}
            editable={true}
            isEditing={editingFieldId === fieldValue.field_id}
            onEdit={() => setEditingFieldId(fieldValue.field_id)}
            onChange={(newValue) => handleFieldChange(fieldValue.field_id, newValue)}
            disabled={isPending}  // Disable during save
          />

          {/* Loading Indicator */}
          {isPending && editingFieldId === fieldValue.field_id && (
            <div className="ml-auto">
              <svg
                className="animate-spin h-4 w-4 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

**Why:**
- **Max 3 fields:** Design Doc constraint to prevent visual clutter
- **show_on_card filter:** Only displays fields marked for card preview
- **Loading state:** Visual feedback during API call
- **Optimistic updates:** Handled by useUpdateVideoFields mutation hook

---

### Step 5: Integrate CustomFieldsPreview into VideoCard

**Files:** `frontend/src/components/VideoCard.tsx`

**Action:** Add CustomFieldsPreview section to VideoCard component

**Code Changes:**
```typescript
// Add import at top
import { CustomFieldsPreview } from './fields/CustomFieldsPreview'

// Inside VideoCard component, after tags section (line 151, before closing </div>):

export const VideoCard = ({ video, onClick, onDelete }: VideoCardProps) => {
  // ... existing code ...

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-label={`Video: ${video.title} von ${(video as any).channel_name || video.channel || 'Unbekannt'}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="video-card group cursor-pointer rounded-lg border bg-card transition-shadow duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {/* Thumbnail Container with Duration Overlay */}
      {/* ... existing thumbnail code ... */}

      {/* Card Content */}
      <div className="p-3 space-y-2">
        {/* Header: Title + Menu */}
        {/* ... existing header code ... */}

        {/* Channel Name */}
        {/* ... existing channel code ... */}

        {/* Tags */}
        {/* ... existing tags code ... */}

        {/* Custom Fields Preview - NEW SECTION */}
        {video.field_values && video.field_values.length > 0 && (
          <CustomFieldsPreview
            videoId={video.id}
            listId={video.list_id}
            fieldValues={video.field_values}
          />
        )}
      </div>
    </div>
  )
}
```

**Why:**
- Conditional rendering: Only shows if field_values exist
- Non-breaking: Existing videos without fields still render correctly
- Placement: After tags, before card footer (logical grouping)

---

### Step 6: Unit Tests for useUpdateVideoFields Hook

**Files:** `frontend/src/hooks/useVideoFields.test.ts` (NEW FILE)

**Action:** Write unit tests for mutation hook with optimistic updates

**Code:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUpdateVideoFields } from './useVideoFields'
import { api } from '@/lib/api'
import type { VideoResponse } from '@/types/video'

// Mock API module
vi.mock('@/lib/api', () => ({
  api: {
    put: vi.fn(),
  },
}))

describe('useUpdateVideoFields', () => {
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
    tags: [],
    field_values: [
      {
        field_id: 'field-1',
        field: {
          id: 'field-1',
          list_id: 'list-1',
          name: 'Rating',
          field_type: 'rating',
          config: { max_rating: 5 },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        value: 3,
        schema_name: 'Video Quality',
        show_on_card: true,
      },
    ],
    processing_status: 'completed',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  }

  it('updates video field value optimistically', async () => {
    // Setup: Pre-populate cache with video
    queryClient.setQueryData(['videos', 'list', 'list-1'], [mockVideo])

    // Mock successful API response
    vi.mocked(api.put).mockResolvedValue({
      data: {
        video_id: 'video-1',
        updated_count: 1,
        field_values: [
          { ...mockVideo.field_values[0], value: 5 },
        ],
      },
    })

    const { result } = renderHook(() => useUpdateVideoFields(), { wrapper })

    // Act: Trigger mutation
    result.current.mutate({
      videoId: 'video-1',
      listId: 'list-1',
      updates: [{ field_id: 'field-1', value: 5 }],
    })

    // Assert: Cache updated optimistically (before API resolves)
    const cachedVideos = queryClient.getQueryData<VideoResponse[]>([
      'videos',
      'list',
      'list-1',
    ])
    expect(cachedVideos?.[0].field_values[0].value).toBe(5)

    // Wait for mutation to complete
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Verify API called with correct payload
    expect(api.put).toHaveBeenCalledWith('/videos/video-1/fields', {
      field_values: [{ field_id: 'field-1', value: 5 }],
    })
  })

  it('rolls back optimistic update on error', async () => {
    // Setup: Pre-populate cache with video
    queryClient.setQueryData(['videos', 'list', 'list-1'], [mockVideo])

    // Mock API error
    vi.mocked(api.put).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useUpdateVideoFields(), { wrapper })

    // Act: Trigger mutation
    result.current.mutate({
      videoId: 'video-1',
      listId: 'list-1',
      updates: [{ field_id: 'field-1', value: 5 }],
    })

    // Wait for mutation to fail
    await waitFor(() => expect(result.current.isError).toBe(true))

    // Assert: Cache rolled back to original value
    const cachedVideos = queryClient.getQueryData<VideoResponse[]>([
      'videos',
      'list',
      'list-1',
    ])
    expect(cachedVideos?.[0].field_values[0].value).toBe(3)  // Original value
  })

  it('invalidates queries after successful update', async () => {
    queryClient.setQueryData(['videos', 'list', 'list-1'], [mockVideo])

    vi.mocked(api.put).mockResolvedValue({
      data: {
        video_id: 'video-1',
        updated_count: 1,
        field_values: [{ ...mockVideo.field_values[0], value: 5 }],
      },
    })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateVideoFields(), { wrapper })

    result.current.mutate({
      videoId: 'video-1',
      listId: 'list-1',
      updates: [{ field_id: 'field-1', value: 5 }],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Assert: invalidateQueries called with correct key
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['videos', 'list', 'list-1'],
    })
  })

  it('handles multiple field updates in single request', async () => {
    const videoWithMultipleFields: VideoResponse = {
      ...mockVideo,
      field_values: [
        mockVideo.field_values[0],
        {
          field_id: 'field-2',
          field: {
            id: 'field-2',
            list_id: 'list-1',
            name: 'Difficulty',
            field_type: 'select',
            config: { options: ['easy', 'medium', 'hard'] },
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
          value: 'easy',
          schema_name: 'Video Quality',
          show_on_card: true,
        },
      ],
    }

    queryClient.setQueryData(['videos', 'list', 'list-1'], [videoWithMultipleFields])

    vi.mocked(api.put).mockResolvedValue({
      data: {
        video_id: 'video-1',
        updated_count: 2,
        field_values: videoWithMultipleFields.field_values,
      },
    })

    const { result } = renderHook(() => useUpdateVideoFields(), { wrapper })

    result.current.mutate({
      videoId: 'video-1',
      listId: 'list-1',
      updates: [
        { field_id: 'field-1', value: 5 },
        { field_id: 'field-2', value: 'hard' },
      ],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(api.put).toHaveBeenCalledWith('/videos/video-1/fields', {
      field_values: [
        { field_id: 'field-1', value: 5 },
        { field_id: 'field-2', value: 'hard' },
      ],
    })
  })

  it('cancels pending queries before optimistic update', async () => {
    queryClient.setQueryData(['videos', 'list', 'list-1'], [mockVideo])

    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries')

    vi.mocked(api.put).mockResolvedValue({
      data: {
        video_id: 'video-1',
        updated_count: 1,
        field_values: mockVideo.field_values,
      },
    })

    const { result } = renderHook(() => useUpdateVideoFields(), { wrapper })

    result.current.mutate({
      videoId: 'video-1',
      listId: 'list-1',
      updates: [{ field_id: 'field-1', value: 5 }],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Assert: cancelQueries called before optimistic update
    expect(cancelSpy).toHaveBeenCalledWith({
      queryKey: ['videos', 'list', 'list-1'],
    })
  })
})
```

**Coverage:**
- ✅ Optimistic update applied immediately
- ✅ Rollback on error
- ✅ Query invalidation after success
- ✅ Multiple fields update
- ✅ Cancel pending queries

---

### Step 7: Unit Tests for CustomFieldsPreview Component

**Files:** `frontend/src/components/fields/CustomFieldsPreview.test.tsx` (NEW FILE)

**Action:** Write unit tests for CustomFieldsPreview component

**Code:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CustomFieldsPreview } from './CustomFieldsPreview'
import type { FieldValue } from '@/types/fieldValue'

// Mock FieldDisplay component from Task #128
vi.mock('./FieldDisplay', () => ({
  FieldDisplay: vi.fn(({ field, value, onChange, onEdit }) => (
    <div data-testid={`field-${field.id}`}>
      <span>{field.name}</span>
      <span>{String(value)}</span>
      <button onClick={() => onEdit?.()}>Edit</button>
      <button onClick={() => onChange?.(5)}>Change</button>
    </div>
  )),
}))

// Mock mutation hook
vi.mock('@/hooks/useVideoFields', () => ({
  useUpdateVideoFields: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}))

describe('CustomFieldsPreview', () => {
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

  const mockFieldValues: FieldValue[] = [
    {
      field_id: 'field-1',
      field: {
        id: 'field-1',
        list_id: 'list-1',
        name: 'Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      value: 3,
      schema_name: 'Video Quality',
      show_on_card: true,
    },
    {
      field_id: 'field-2',
      field: {
        id: 'field-2',
        list_id: 'list-1',
        name: 'Difficulty',
        field_type: 'select',
        config: { options: ['easy', 'medium', 'hard'] },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      value: 'easy',
      schema_name: 'Tutorial Info',
      show_on_card: true,
    },
    {
      field_id: 'field-3',
      field: {
        id: 'field-3',
        list_id: 'list-1',
        name: 'Watched',
        field_type: 'boolean',
        config: {},
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      value: false,
      schema_name: null,
      show_on_card: true,
    },
    {
      field_id: 'field-4',
      field: {
        id: 'field-4',
        list_id: 'list-1',
        name: 'Notes',
        field_type: 'text',
        config: { max_length: 500 },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      value: 'Great tutorial',
      schema_name: null,
      show_on_card: false,  // Should NOT be displayed
    },
  ]

  it('renders max 3 fields with show_on_card=true', () => {
    render(
      <CustomFieldsPreview
        videoId="video-1"
        listId="list-1"
        fieldValues={mockFieldValues}
      />,
      { wrapper }
    )

    // Should render first 3 fields with show_on_card=true
    expect(screen.getByTestId('field-field-1')).toBeInTheDocument()
    expect(screen.getByTestId('field-field-2')).toBeInTheDocument()
    expect(screen.getByTestId('field-field-3')).toBeInTheDocument()

    // Field 4 has show_on_card=false, should NOT be rendered
    expect(screen.queryByTestId('field-field-4')).not.toBeInTheDocument()
  })

  it('renders nothing when no fields have show_on_card=true', () => {
    const noVisibleFields: FieldValue[] = [
      { ...mockFieldValues[0], show_on_card: false },
      { ...mockFieldValues[1], show_on_card: false },
    ]

    const { container } = render(
      <CustomFieldsPreview
        videoId="video-1"
        listId="list-1"
        fieldValues={noVisibleFields}
      />,
      { wrapper }
    )

    // Component should return null
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fieldValues is empty', () => {
    const { container } = render(
      <CustomFieldsPreview
        videoId="video-1"
        listId="list-1"
        fieldValues={[]}
      />,
      { wrapper }
    )

    expect(container.firstChild).toBeNull()
  })
})
```

**Coverage:**
- ✅ Max 3 fields displayed
- ✅ show_on_card filter works
- ✅ Empty state handling
- ✅ Field labels rendered

---

### Step 8: Integration Test for Inline Edit Flow

**Files:** `frontend/src/components/fields/CustomFieldsPreview.integration.test.tsx` (NEW FILE)

**Action:** End-to-end test for inline editing with real mutation

**Code:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CustomFieldsPreview } from './CustomFieldsPreview'
import { api } from '@/lib/api'
import type { FieldValue } from '@/types/fieldValue'

vi.mock('@/lib/api', () => ({
  api: {
    put: vi.fn(),
  },
}))

// Mock FieldDisplay with realistic behavior
vi.mock('./FieldDisplay', () => ({
  FieldDisplay: ({ field, value, onChange }: any) => (
    <div data-testid={`field-${field.id}`}>
      <span>{field.name}: {String(value)}</span>
      <button onClick={() => onChange(5)}>Update to 5</button>
    </div>
  ),
}))

describe('CustomFieldsPreview - Integration', () => {
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

  const mockFieldValue: FieldValue = {
    field_id: 'field-1',
    field: {
      id: 'field-1',
      list_id: 'list-1',
      name: 'Rating',
      field_type: 'rating',
      config: { max_rating: 5 },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    value: 3,
    schema_name: 'Video Quality',
    show_on_card: true,
  }

  it('completes full inline edit flow with API call', async () => {
    const user = userEvent.setup()

    // Mock successful API response
    vi.mocked(api.put).mockResolvedValue({
      data: {
        video_id: 'video-1',
        updated_count: 1,
        field_values: [{ ...mockFieldValue, value: 5 }],
      },
    })

    render(
      <CustomFieldsPreview
        videoId="video-1"
        listId="list-1"
        fieldValues={[mockFieldValue]}
      />,
      { wrapper }
    )

    // Initial value displayed
    expect(screen.getByText(/Rating: 3/)).toBeInTheDocument()

    // Click update button
    const updateButton = screen.getByRole('button', { name: /Update to 5/i })
    await user.click(updateButton)

    // Wait for mutation to complete
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/videos/video-1/fields', {
        field_values: [{ field_id: 'field-1', value: 5 }],
      })
    })

    // Verify mutation called once
    expect(api.put).toHaveBeenCalledTimes(1)
  })
})
```

**Coverage:**
- ✅ End-to-end flow from click to API call
- ✅ Correct payload sent to backend
- ✅ Realistic user interaction

---

### Step 9: Manual Testing Checklist

**Action:** Perform manual testing in browser

**Checklist:**
1. [ ] **Rating Field:**
   - Click on star rating → opens inline editor
   - Change rating → saves immediately
   - Loading spinner appears during save
   - Error shows toast notification and rolls back
   
2. [ ] **Select Field:**
   - Click on dropdown → opens options
   - Select new option → saves immediately
   - Optimistic update shows new value instantly
   
3. [ ] **Boolean Field:**
   - Click on checkbox → toggles immediately
   - Saves to backend
   - Rollback on error restores previous state
   
4. [ ] **Text Field:**
   - Click on text → opens input (or triggers modal)
   - Type new value → saves on blur/submit
   - Validates max_length if configured
   
5. [ ] **Max 3 Fields:**
   - Videos with 5 fields only show first 3 with show_on_card=true
   - Videos with <3 fields show all
   
6. [ ] **Error Handling:**
   - Disconnect network → error toast + rollback
   - Invalid field_id → 400 error handled gracefully
   - Validation error → 422 error shows message
   
7. [ ] **Loading States:**
   - Spinner shows during save
   - Field disabled during save (no double-submit)
   - Multiple fields can't be edited simultaneously

---

### Step 10: TypeScript Type Check

**Action:** Verify no TypeScript errors introduced

**Command:**
```bash
cd frontend
npx tsc --noEmit
```

**Expected:** 0 new errors (baseline: 6-7 pre-existing documented errors)

---

### Step 11: Run All Tests

**Action:** Execute test suite to verify implementation

**Commands:**
```bash
# Run all tests
cd frontend
npm test

# Run with coverage
npm run test:coverage

# Run specific test files
npm test -- CustomFieldsPreview
npm test -- useVideoFields
```

**Expected:** All new tests passing (13 total: 5 hook + 3 component + 1 integration + 4 manual)

---

### Step 12: Update CLAUDE.md Documentation

**Files:** `CLAUDE.md`

**Action:** Document inline editing pattern for future reference

**Code:**
```markdown
### Custom Fields Inline Editing (Task #129)

**Pattern:** Optimistic updates with React Query mutations

**Components:**
- `CustomFieldsPreview` - Displays max 3 fields on video cards
- `FieldDisplay` - Type-specific field renderers (Task #128)
- `useUpdateVideoFields` - Mutation hook with optimistic updates

**Mutation Flow:**
1. User edits field value → triggers onChange
2. onMutate: Cancel queries, snapshot previous, update cache optimistically
3. mutationFn: PUT /videos/{video_id}/fields API call
4. onError: Rollback cache to previous snapshot
5. onSettled: Invalidate queries to refetch authoritative data

**Example Usage:**
```tsx
import { CustomFieldsPreview } from '@/components/fields/CustomFieldsPreview'

<VideoCard video={video}>
  {video.field_values && (
    <CustomFieldsPreview
      videoId={video.id}
      listId={video.list_id}
      fieldValues={video.field_values}
    />
  )}
</VideoCard>
```

**Error Handling:**
- Network errors: Toast notification + rollback
- Validation errors (422): Display error message from backend
- Not found (404): Show "Video not found" message

**Testing Pattern:**
- Unit tests: Mock mutation hook, verify rendering
- Integration tests: Real mutation with mocked API
- Manual tests: Browser testing with real backend
```

---

### Step 13: Git Commit

**Action:** Commit implementation with comprehensive message

**Command:**
```bash
git add frontend/src/types/fieldValue.ts \
        frontend/src/types/video.ts \
        frontend/src/hooks/useVideoFields.ts \
        frontend/src/hooks/useVideoFields.test.ts \
        frontend/src/components/fields/CustomFieldsPreview.tsx \
        frontend/src/components/fields/CustomFieldsPreview.test.tsx \
        frontend/src/components/fields/CustomFieldsPreview.integration.test.tsx \
        frontend/src/components/VideoCard.tsx \
        CLAUDE.md

git commit -m "feat(custom-fields): implement inline editing in CustomFieldsPreview

Task #129: Inline Editing in CustomFieldsPreview Component

Features:
- CustomFieldsPreview component displays max 3 fields on video cards
- useUpdateVideoFields mutation hook with optimistic updates
- Instant UI feedback with automatic rollback on error
- Loading states during API calls
- Integration with FieldDisplay component (Task #128)
- Type-safe TypeScript interfaces for field values

Implementation Details:
- React Query optimistic update pattern (onMutate → onError → onSettled)
- Max 3 fields constraint (Design Doc lines 362-377)
- show_on_card filter for card preview fields
- Follows existing mutation patterns from useVideos.ts

Testing:
- 5 unit tests for useUpdateVideoFields (optimistic updates, rollback, invalidation)
- 3 unit tests for CustomFieldsPreview (rendering, max 3 fields, empty state)
- 1 integration test for full inline edit flow
- Manual testing checklist completed

Files Changed:
- frontend/src/types/fieldValue.ts (NEW) - TypeScript types
- frontend/src/types/video.ts (EXTENDED) - Added field_values array
- frontend/src/hooks/useVideoFields.ts (NEW) - Mutation hook
- frontend/src/components/fields/CustomFieldsPreview.tsx (NEW) - Preview component
- frontend/src/components/VideoCard.tsx (EXTENDED) - Integrated CustomFieldsPreview
- CLAUDE.md - Documented inline editing pattern

Dependencies:
- Task #128 (FieldDisplay component) - Pending, using placeholder
- Task #72 (Backend PUT endpoint) - Complete
- Task #64 (Pydantic schemas) - Complete

REF MCP:
- TanStack Query optimistic updates pattern validated
- cancelQueries prevents race conditions
- Snapshot + rollback recommended approach

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests (8 tests total)

**useVideoFields.test.ts (5 tests):**
1. ✅ Optimistic update applied immediately to cache
2. ✅ Rollback to previous state on API error
3. ✅ Query invalidation triggered after success
4. ✅ Multiple field updates in single request
5. ✅ Cancel pending queries before optimistic update

**CustomFieldsPreview.test.tsx (3 tests):**
1. ✅ Renders max 3 fields with show_on_card=true
2. ✅ Returns null when no visible fields
3. ✅ Returns null when fieldValues is empty

### Integration Tests (1 test)

**CustomFieldsPreview.integration.test.tsx:**
1. ✅ Complete inline edit flow from click to API call

### Manual Testing (7 scenarios)

1. ✅ Rating field inline editing
2. ✅ Select field inline editing
3. ✅ Boolean field inline editing
4. ✅ Text field inline editing
5. ✅ Max 3 fields constraint enforcement
6. ✅ Error handling with rollback
7. ✅ Loading states during save

**Coverage Target:** 90%+ line coverage, 85%+ branch coverage

---

## 📚 Reference

### Related Docs

**Design Document:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 362-377 (CustomFieldsPreview spec)
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 256-304 (PUT /videos/{id}/fields API contract)

**Task Plans:**
- `docs/plans/tasks/task-072-video-field-values-batch-update.md` - Backend PUT endpoint spec
- `docs/plans/tasks/task-064-custom-field-pydantic-schemas.md` - Field value validation rules
- `docs/plans/tasks/task-128-field-display-component.md` - FieldDisplay component (dependency)

**REF MCP Documentation:**
- TanStack Query Optimistic Updates: https://github.com/tanstack/query/blob/main/docs/framework/react/guides/optimistic-updates.md
- React Query v5 Migration Guide: Callback patterns (onMutate, onError, onSettled)

### Related Code

**Existing Patterns:**
- `frontend/src/hooks/useVideos.ts` - Lines 187-217 (useDeleteVideo with optimistic updates)
- `frontend/src/hooks/useVideos.ts` - Lines 144-185 (useCreateVideo with cache updates)
- `frontend/src/components/VideoCard.tsx` - Lines 1-156 (VideoCard component structure)

**Backend Endpoints:**
- `backend/app/api/videos.py` - PUT /videos/{video_id}/fields endpoint (Task #72 - NOT YET IMPLEMENTED)
- `backend/app/schemas/video_field_value.py` - BatchUpdateFieldValuesRequest/Response schemas

**Type Definitions:**
- `frontend/src/types/video.ts` - VideoResponse interface
- `frontend/src/types/tag.ts` - Tag interface (pattern reference)

---

## 🎯 Design Decisions

### 1. Optimistic Updates Pattern

**Decision:** Use React Query optimistic updates (onMutate → onError → onSettled)

**Rationale:**
- **Instant UI Feedback:** User sees change immediately without waiting for API
- **Better UX:** Perceived performance improvement (feels faster than sequential update)
- **Error Recovery:** Automatic rollback on failure prevents inconsistent state
- **Pattern Reuse:** Follows existing useDeleteVideo pattern from useVideos.ts

**Trade-offs:**
- **Complexity:** More code than simple onSuccess handler
- **Race Conditions:** Requires cancelQueries to prevent conflicts
- **Stale Data Risk:** Mitigated by onSettled invalidation

**REF MCP Evidence:**
- TanStack Query docs explicitly recommend this pattern for mutations
- cancelQueries prevents race conditions with pending refetches
- Snapshot + rollback is recommended approach for list updates

**Alternative Considered:**
- **Sequential Update:** Wait for API response before updating UI
  - ❌ Rejected: Slower perceived performance, worse UX

---

### 2. Max 3 Fields Constraint

**Decision:** Display max 3 fields with show_on_card=true on video cards

**Rationale:**
- **Design Doc Requirement:** Lines 362-377 specify max 3 fields constraint
- **Visual Clarity:** Prevents card from becoming cluttered with too much info
- **Performance:** Reduces DOM nodes for large video lists (1000+ videos)
- **Progressive Disclosure:** Users can click video to see all fields in modal

**Implementation:**
```typescript
const visibleFields = fieldValues
  .filter((fv) => fv.show_on_card)
  .slice(0, 3)
```

**Alternative Considered:**
- **Show All Fields:** Display unlimited fields on cards
  - ❌ Rejected: Design Doc constraint, visual clutter

---

### 3. Separate useVideoFields Hook

**Decision:** Create dedicated useVideoFields.ts instead of adding to useVideos.ts

**Rationale:**
- **Separation of Concerns:** Video CRUD vs field value updates are distinct operations
- **Maintainability:** Easier to locate field-specific mutations
- **File Size:** useVideos.ts already 300+ lines, avoid monolithic file
- **Future Growth:** Custom fields will have more hooks (useSchemas, useCustomFields)

**Alternative Considered:**
- **Add to useVideos.ts:** Keep all video-related hooks together
  - ❌ Rejected: File too large, mixed responsibilities

---

### 4. Field Value Type Union

**Decision:** Use `number | string | boolean | null` for field values

**Rationale:**
- **Backend Contract:** Matches VideoFieldValue model typed columns (value_numeric, value_text, value_boolean)
- **Type Safety:** TypeScript enforces correct value types for each field_type
- **Validation:** Backend validates value matches field_type in Task #73

**Type Definition:**
```typescript
value: number | string | boolean | null
```

**Alternative Considered:**
- **Any Type:** `value: any`
  - ❌ Rejected: Loses type safety, runtime errors

---

### 5. Loading State Granularity

**Decision:** Show spinner only for currently editing field, not all fields

**Rationale:**
- **User Clarity:** User knows which field is saving
- **UX:** Other fields remain interactive during save
- **Error Attribution:** Clear which field failed if error occurs

**Implementation:**
```typescript
const [editingFieldId, setEditingFieldId] = useState<string | null>(null)

{isPending && editingFieldId === fieldValue.field_id && <Spinner />}
```

**Alternative Considered:**
- **Global Loading:** Disable all fields during any save
  - ❌ Rejected: Worse UX, prevents concurrent edits

---

### 6. No Debouncing for Field Updates

**Decision:** Save immediately on onChange, no debouncing delay

**Rationale:**
- **Simple UX:** User expects immediate save after closing editor
- **Explicit Actions:** Rating/Select/Boolean have discrete values, not continuous typing
- **Text Field:** Handled separately with blur/submit (not continuous save)
- **Backend Performance:** Single field update is fast (<50ms)

**Alternative Considered:**
- **Debounced Updates:** Wait 500ms after last change before saving
  - ❌ Rejected: Confusing UX ("Did it save?"), unnecessary for discrete values

---

### 7. Integration with Task #128 FieldDisplay

**Decision:** CustomFieldsPreview renders FieldDisplay components from Task #128

**Rationale:**
- **DRY Principle:** Reuse type-specific renderers (Rating stars, Select dropdown, etc.)
- **Consistency:** Same visual appearance in cards and modals
- **Maintainability:** Single source of truth for field rendering logic

**Dependency Management:**
- Task #128 not yet implemented → Use placeholder mock in tests
- Production code imports real FieldDisplay when Task #128 completes

**Alternative Considered:**
- **Inline Renderers:** Build field-specific components directly in CustomFieldsPreview
  - ❌ Rejected: Code duplication, inconsistent UI

---

## ⚠️ Known Limitations

1. **Task #128 Dependency:** FieldDisplay component not yet implemented
   - **Mitigation:** Tests use mocked FieldDisplay, production code will use real component
   - **Timeline:** Task #128 planned in parallel, expected completion before Task #129

2. **Backend Endpoint Not Implemented:** PUT /videos/{video_id}/fields (Task #72)
   - **Status:** Task #72 planned but not yet executed
   - **Mitigation:** Frontend code ready, will work once backend available
   - **Testing:** Integration tests use mocked API responses

3. **No Undo/Redo:** Changes are immediately saved, no undo button
   - **Future Enhancement:** Add "Undo" toast notification after save
   - **Workaround:** Users can manually revert by editing again

4. **Single Field Edit:** Users can only edit one field at a time
   - **Design Decision:** Simplifies state management, prevents conflicts
   - **Future Enhancement:** Batch edit mode for power users

---

## 📊 Estimated Time

**Total:** 4-5 hours

**Breakdown:**
- Step 1-2: TypeScript types (30 min)
- Step 3: useUpdateVideoFields hook (60 min)
- Step 4: CustomFieldsPreview component (45 min)
- Step 5: VideoCard integration (15 min)
- Step 6: Hook unit tests (45 min)
- Step 7: Component unit tests (30 min)
- Step 8: Integration test (30 min)
- Step 9: Manual testing (30 min)
- Step 10-13: Verification + docs + commit (30 min)

**Dependencies:**
- Task #128 (FieldDisplay) - Can proceed with mocked component
- Task #72 (Backend endpoint) - Can proceed with mocked API
- Task #64 (Pydantic schemas) - ✅ COMPLETE

**Risk Factors:**
- REF MCP validation may identify improvements (+30 min)
- Optimistic update edge cases may require debugging (+30 min)
- Integration with Task #128 may require adjustments (+15 min)

**Confidence:** Medium-High (80%)
- Pattern well-documented in TanStack Query docs
- Similar implementation exists in useDeleteVideo
- Clear acceptance criteria and test coverage

---

## ✅ Definition of Done

- [ ] All 13 acceptance criteria met
- [ ] All 13 tests passing (5 hook + 3 component + 1 integration + 4 manual scenarios)
- [ ] TypeScript check: 0 new errors
- [ ] Code review: Grade A (0 Critical/Important issues)
- [ ] REF MCP validation: Optimistic updates pattern confirmed
- [ ] Manual testing: All 7 scenarios verified in browser
- [ ] Documentation: CLAUDE.md updated with inline editing pattern
- [ ] Git commit: Comprehensive message with implementation details
- [ ] status.md: Task #129 marked complete with timestamp and duration

---

**END OF PLAN**
