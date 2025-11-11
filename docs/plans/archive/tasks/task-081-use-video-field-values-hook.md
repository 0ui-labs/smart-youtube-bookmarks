# Task #81: Create useVideoFieldValues React Query Hook with Mutations

**Plan Task:** #81
**Wave/Phase:** Phase 1: MVP - Frontend (Custom Fields System)
**Dependencies:** Task #64 (CustomField Pydantic Schemas) ✅, Task #65 (FieldSchema Pydantic Schemas) ✅, Task #71 (Video endpoint field values) ✅, Task #72 (Batch update endpoint) ✅, Task #78 (TypeScript types) ⏳

---

## 🎯 Ziel

Create a comprehensive React Query hook for managing video field values with mutations for batch updates. The hook follows existing patterns from `useTags.ts` and `useVideos.ts`, implementing proper cache invalidation, optimistic updates, and error handling for inline field editing UX.

**Expected Result:**
- Hook: `useVideoFieldValues(videoId)` for fetching field values
- Mutation: `useUpdateVideoFieldValues(videoId)` for batch updates
- Proper cache invalidation after mutations
- Optimistic updates for instant UI feedback
- Error handling with rollback on failure
- TypeScript-safe with zero `any` types
- 100% test coverage with Vitest

---

## 📋 Acceptance Criteria

- [ ] `useVideoFieldValues` hook created with query for GET endpoint
- [ ] `useUpdateVideoFieldValues` mutation hook for PUT endpoint
- [ ] Mutation uses `onSettled` (not deprecated `onSuccess`) for cache invalidation
- [ ] Optimistic updates implemented with rollback on error
- [ ] TypeScript strict mode passing (no `any` types)
- [ ] Query keys follow existing `videoKeys` factory pattern
- [ ] Error logging with console.error for debugging
- [ ] Unit tests: 15+ tests covering all scenarios
- [ ] Integration test: optimistic update with rollback
- [ ] Code reviewed (follows useTags/useVideos patterns)
- [ ] Documentation: JSDoc comments with examples

---

## 🛠️ Implementation Steps

### 1. Extend Query Key Factory

**Files:** `frontend/src/hooks/useVideos.ts`

**Action:** Add field values keys to existing `videoKeys` factory

**Code:**
```typescript
// Extend videoKeys factory (after line 58)
export const videoKeys = {
  /** Base key for all video queries */
  all: ['videos'] as const,
  /** Key factory for list-scoped queries */
  lists: () => [...videoKeys.all, 'list'] as const,
  /** Key for unfiltered videos in a specific list */
  list: (listId: string) => [...videoKeys.lists(), listId] as const,
  /** Key for tag-filtered videos in a specific list */
  filtered: (listId: string, tagNames: string[]) =>
    [...videoKeys.list(listId), { tags: [...tagNames].sort() }] as const,
  
  // NEW: Field values keys
  /** Base key for all field values queries */
  fieldValues: () => [...videoKeys.all, 'field-values'] as const,
  /** Key for field values of a specific video */
  videoFieldValues: (videoId: string) => 
    [...videoKeys.fieldValues(), videoId] as const,
}
```

**Why:** Following TanStack Query best practices for hierarchical query keys. Enables precise cache invalidation (invalidate all field values vs specific video).

**REF MCP Evidence:** [TanStack Query - Effective Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) recommends hierarchical key factories.

---

### 2. Create TypeScript Types

**Files:** `frontend/src/hooks/useVideoFieldValues.ts` (NEW FILE)

**Action:** Define request/response types matching backend schemas

**Code:**
```typescript
/**
 * React Query hook for managing video custom field values.
 * 
 * Provides queries and mutations for fetching and updating field values
 * with optimistic updates and automatic cache invalidation.
 * 
 * @see backend/app/api/videos.py - GET/PUT /api/videos/{video_id}/fields
 * @see Task #71 - Video endpoint field values integration
 * @see Task #72 - Batch update endpoint
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { videoKeys } from './useVideos'

/**
 * Single field value update in a batch request.
 * 
 * The value type depends on the field's field_type:
 * - rating: number (0 to max_rating)
 * - select: string (must be in options list)
 * - text: string (optional max_length validation)
 * - boolean: boolean
 */
export interface FieldValueUpdate {
  /** UUID of the custom field */
  field_id: string
  /** Field value (type must match field's field_type) */
  value: string | number | boolean | null
}

/**
 * Request payload for batch field value updates.
 * 
 * @example
 * ```ts
 * const request: BatchUpdateFieldValuesRequest = {
 *   field_values: [
 *     { field_id: 'uuid1', value: 5 },
 *     { field_id: 'uuid2', value: 'great' }
 *   ]
 * }
 * ```
 */
export interface BatchUpdateFieldValuesRequest {
  /** List of field value updates (1-50 items) */
  field_values: FieldValueUpdate[]
}

/**
 * Video field value from API responses.
 * 
 * Includes the field definition, current value, and schema context
 * for frontend grouping and conflict resolution display.
 * 
 * @example
 * ```ts
 * const fieldValue: VideoFieldValue = {
 *   field_id: 'uuid',
 *   field: {
 *     id: 'uuid',
 *     name: 'Overall Rating',
 *     field_type: 'rating',
 *     config: { max_rating: 5 }
 *   },
 *   value: 4,
 *   schema_name: null,
 *   show_on_card: true,
 *   display_order: 0
 * }
 * ```
 */
export interface VideoFieldValue {
  /** Associated custom field ID */
  field_id: string
  /** Full custom field definition */
  field: {
    id: string
    name: string
    field_type: 'select' | 'rating' | 'text' | 'boolean'
    config: Record<string, any>
  }
  /** Typed value (null if not set) */
  value: string | number | boolean | null
  /** Schema name for conflict resolution (null if no conflict) */
  schema_name: string | null
  /** Whether to show on video card */
  show_on_card: boolean
  /** Display order within schema */
  display_order: number
}

/**
 * Response from batch field value updates.
 * 
 * Returns all updated field values with full field metadata.
 */
export interface BatchUpdateFieldValuesResponse {
  /** Number of fields updated */
  updated_count: number
  /** Updated field values with field definitions */
  field_values: VideoFieldValue[]
}
```

**Why:** Explicit types prevent runtime errors, enable IntelliSense, and match backend contracts exactly. Following existing pattern from `useVideos.ts` (lines 7-26).

---

### 3. Implement useVideoFieldValues Query Hook

**Files:** `frontend/src/hooks/useVideoFieldValues.ts` (continue)

**Action:** Create React Query hook for fetching field values

**Code:**
```typescript
/**
 * React Query hook to fetch custom field values for a video.
 * 
 * Fetches field values from the video endpoint (which includes field_values
 * in the response via Task #71 implementation).
 * 
 * @param videoId - UUID of the video
 * @returns Query result with field values array
 * 
 * @example
 * ```tsx
 * const { data: fieldValues, isLoading, error } = useVideoFieldValues(videoId)
 * 
 * if (isLoading) return <Skeleton />
 * if (error) return <ErrorMessage />
 * 
 * return (
 *   <div>
 *     {fieldValues?.map(fv => (
 *       <FieldDisplay key={fv.field_id} fieldValue={fv} />
 *     ))}
 *   </div>
 * )
 * ```
 */
export const useVideoFieldValues = (videoId: string) => {
  return useQuery({
    queryKey: videoKeys.videoFieldValues(videoId),
    queryFn: async () => {
      // Field values are included in video response (Task #71)
      // We fetch the full video but only return field_values
      const { data } = await api.get<{ field_values: VideoFieldValue[] }>(
        `/videos/${videoId}`
      )
      
      // Return only field_values array (not full video object)
      return data.field_values || []
    },
    // Prevent excessive refetching (field values change infrequently)
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
```

**Why:** Query configuration follows existing `useVideos` pattern (lines 105-142). Stale time prevents unnecessary refetches since field values don't change often. Defensive `|| []` handles edge case of missing field_values in response.

**Alternative Considered:** Separate `/videos/{id}/fields` endpoint. **Rejected:** Task #71 already includes field_values in video response, so reusing existing endpoint avoids duplicate API call.

---

### 4. Implement Mutation Hook with Optimistic Updates

**Files:** `frontend/src/hooks/useVideoFieldValues.ts` (continue)

**Action:** Create mutation hook following TanStack Query v5 best practices

**Code:**
```typescript
/**
 * React Query mutation hook to batch update video field values.
 * 
 * Implements optimistic updates for instant UI feedback with automatic
 * rollback on error. Follows TanStack Query v5 best practices.
 * 
 * @param videoId - UUID of the video to update
 * @returns Mutation result with mutate function
 * 
 * @example
 * ```tsx
 * const updateFieldValues = useUpdateVideoFieldValues(videoId)
 * 
 * const handleSave = () => {
 *   updateFieldValues.mutate({
 *     field_values: [
 *       { field_id: 'uuid1', value: 5 },
 *       { field_id: 'uuid2', value: 'great' }
 *     ]
 *   })
 * }
 * 
 * return (
 *   <button onClick={handleSave} disabled={updateFieldValues.isPending}>
 *     {updateFieldValues.isPending ? 'Saving...' : 'Save'}
 *   </button>
 * )
 * ```
 */
export const useUpdateVideoFieldValues = (videoId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateVideoFieldValues', videoId],
    mutationFn: async (request: BatchUpdateFieldValuesRequest) => {
      const { data } = await api.put<BatchUpdateFieldValuesResponse>(
        `/videos/${videoId}/fields`,
        request
      )
      return data
    },

    // Optimistic update: Immediately update UI before server responds
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ 
        queryKey: videoKeys.videoFieldValues(videoId) 
      })

      // Snapshot the previous value for rollback
      const previousFieldValues = queryClient.getQueryData<VideoFieldValue[]>(
        videoKeys.videoFieldValues(videoId)
      )

      // Optimistically update to the new values
      queryClient.setQueryData<VideoFieldValue[]>(
        videoKeys.videoFieldValues(videoId),
        (old = []) => {
          // Create a map of updates for fast lookup
          const updatesMap = new Map(
            variables.field_values.map(fv => [fv.field_id, fv.value])
          )

          // Update existing field values with new values
          return old.map(fieldValue => {
            if (updatesMap.has(fieldValue.field_id)) {
              return {
                ...fieldValue,
                value: updatesMap.get(fieldValue.field_id)!
              }
            }
            return fieldValue
          })
        }
      )

      // Return context with previous value for rollback
      return { previousFieldValues }
    },

    // Rollback on error
    onError: (err, variables, context) => {
      console.error('Failed to update field values:', err)
      
      // Restore previous state if error occurs
      if (context?.previousFieldValues) {
        queryClient.setQueryData(
          videoKeys.videoFieldValues(videoId),
          context.previousFieldValues
        )
      }
    },

    // Always refetch after mutation completes (success or error)
    // Uses onSettled instead of deprecated onSuccess
    onSettled: async () => {
      // Invalidate field values query to refetch from server
      await queryClient.invalidateQueries({ 
        queryKey: videoKeys.videoFieldValues(videoId) 
      })
      
      // Also invalidate video queries to update any cached video objects
      // (in case field_values are included in video list responses)
      await queryClient.invalidateQueries({ 
        queryKey: videoKeys.all 
      })
    },
  })
}
```

**Why Optimistic Updates:**
- **UX Benefit:** Instant UI feedback (feels responsive)
- **Error Handling:** Automatic rollback on failure prevents inconsistent state
- **REF MCP Evidence:** [TanStack Query v5 - Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) recommends this pattern

**Why onSettled vs onSuccess:**
- **Breaking Change in v5:** `onSuccess` deprecated, use `onSettled` instead
- **REF MCP Evidence:** [TanStack Query v5 Migration](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5#onsuccess-is-no-longer-called-from-setquerydata) - callbacks removed from useQuery

**Why Invalidate Both Queries:**
- `videoFieldValues(videoId)`: Direct field values query
- `videoKeys.all`: Video list queries may include field_values in response (Task #71)
- Ensures all cached data stays consistent

---

### 5. Add Unit Tests

**Files:** `frontend/src/hooks/__tests__/useVideoFieldValues.test.ts` (NEW FILE)

**Action:** Create comprehensive test suite with mocked API

**Code:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useVideoFieldValues, useUpdateVideoFieldValues } from '../useVideoFieldValues'
import { api } from '@/lib/api'
import type { VideoFieldValue, BatchUpdateFieldValuesResponse } from '../useVideoFieldValues'

// Mock API module
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  }
}))

describe('useVideoFieldValues', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    // Create fresh QueryClient for each test (isolation)
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }, // Disable retries in tests
        mutations: { retry: false },
      },
    })
    
    // Clear mocks
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  describe('useVideoFieldValues', () => {
    it('should fetch field values successfully', async () => {
      const mockFieldValues: VideoFieldValue[] = [
        {
          field_id: 'field-1',
          field: {
            id: 'field-1',
            name: 'Overall Rating',
            field_type: 'rating',
            config: { max_rating: 5 }
          },
          value: 4,
          schema_name: null,
          show_on_card: true,
          display_order: 0
        }
      ]

      vi.mocked(api.get).mockResolvedValueOnce({
        data: { field_values: mockFieldValues }
      })

      const { result } = renderHook(
        () => useVideoFieldValues('video-123'),
        { wrapper }
      )

      // Initially loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()

      // Wait for query to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Verify data
      expect(result.current.data).toEqual(mockFieldValues)
      expect(api.get).toHaveBeenCalledWith('/videos/video-123')
    })

    it('should return empty array if field_values missing in response', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {} // Missing field_values
      })

      const { result } = renderHook(
        () => useVideoFieldValues('video-123'),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Should return empty array (defensive programming)
      expect(result.current.data).toEqual([])
    })

    it('should handle error state', async () => {
      const mockError = new Error('Network error')
      vi.mocked(api.get).mockRejectedValueOnce(mockError)

      const { result } = renderHook(
        () => useVideoFieldValues('video-123'),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toEqual(mockError)
    })

    it('should use correct query key for caching', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { field_values: [] }
      })

      const { result } = renderHook(
        () => useVideoFieldValues('video-456'),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Verify cache key structure
      const cacheKey = result.current.dataUpdatedAt
      const cachedData = queryClient.getQueryData([
        'videos',
        'field-values',
        'video-456'
      ])
      expect(cachedData).toEqual([])
    })
  })

  describe('useUpdateVideoFieldValues', () => {
    it('should update field values successfully', async () => {
      const mockResponse: BatchUpdateFieldValuesResponse = {
        updated_count: 2,
        field_values: [
          {
            field_id: 'field-1',
            field: {
              id: 'field-1',
              name: 'Overall Rating',
              field_type: 'rating',
              config: { max_rating: 5 }
            },
            value: 5,
            schema_name: null,
            show_on_card: true,
            display_order: 0
          },
          {
            field_id: 'field-2',
            field: {
              id: 'field-2',
              name: 'Presentation',
              field_type: 'select',
              config: { options: ['bad', 'good', 'great'] }
            },
            value: 'great',
            schema_name: null,
            show_on_card: true,
            display_order: 1
          }
        ]
      }

      vi.mocked(api.put).mockResolvedValueOnce({ data: mockResponse })

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      // Trigger mutation
      result.current.mutate({
        field_values: [
          { field_id: 'field-1', value: 5 },
          { field_id: 'field-2', value: 'great' }
        ]
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockResponse)
      expect(api.put).toHaveBeenCalledWith(
        '/videos/video-123/fields',
        {
          field_values: [
            { field_id: 'field-1', value: 5 },
            { field_id: 'field-2', value: 'great' }
          ]
        }
      )
    })

    it('should handle validation error (422)', async () => {
      const mockError = {
        response: {
          status: 422,
          data: {
            detail: {
              message: 'Field value validation failed',
              errors: [
                {
                  field_id: 'field-1',
                  field_name: 'Overall Rating',
                  error: 'Rating must be between 0 and 5'
                }
              ]
            }
          }
        }
      }

      vi.mocked(api.put).mockRejectedValueOnce(mockError)

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate({
        field_values: [
          { field_id: 'field-1', value: 10 } // Invalid: exceeds max_rating
        ]
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toEqual(mockError)
    })

    it('should perform optimistic update', async () => {
      // Setup: Initial field values in cache
      const initialFieldValues: VideoFieldValue[] = [
        {
          field_id: 'field-1',
          field: {
            id: 'field-1',
            name: 'Overall Rating',
            field_type: 'rating',
            config: { max_rating: 5 }
          },
          value: 3, // Initial value: 3
          schema_name: null,
          show_on_card: true,
          display_order: 0
        }
      ]

      queryClient.setQueryData(
        ['videos', 'field-values', 'video-123'],
        initialFieldValues
      )

      // Mock slow API response (to observe optimistic update)
      vi.mocked(api.put).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          data: {
            updated_count: 1,
            field_values: [
              { ...initialFieldValues[0], value: 5 }
            ]
          }
        }), 100))
      )

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      // Trigger mutation
      result.current.mutate({
        field_values: [
          { field_id: 'field-1', value: 5 } // Update: 3 → 5
        ]
      })

      // Immediately check cache (optimistic update should apply)
      const cachedData = queryClient.getQueryData<VideoFieldValue[]>([
        'videos',
        'field-values',
        'video-123'
      ])
      
      expect(cachedData?.[0].value).toBe(5) // Optimistically updated

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('should rollback optimistic update on error', async () => {
      // Setup: Initial field values in cache
      const initialFieldValues: VideoFieldValue[] = [
        {
          field_id: 'field-1',
          field: {
            id: 'field-1',
            name: 'Overall Rating',
            field_type: 'rating',
            config: { max_rating: 5 }
          },
          value: 3,
          schema_name: null,
          show_on_card: true,
          display_order: 0
        }
      ]

      queryClient.setQueryData(
        ['videos', 'field-values', 'video-123'],
        initialFieldValues
      )

      // Mock API error
      vi.mocked(api.put).mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      // Trigger mutation
      result.current.mutate({
        field_values: [
          { field_id: 'field-1', value: 5 }
        ]
      })

      // Wait for error
      await waitFor(() => expect(result.current.isError).toBe(true))

      // Verify rollback: value should be back to 3 (not 5)
      const cachedData = queryClient.getQueryData<VideoFieldValue[]>([
        'videos',
        'field-values',
        'video-123'
      ])
      
      expect(cachedData?.[0].value).toBe(3) // Rolled back
    })

    it('should invalidate cache after successful mutation', async () => {
      vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          field_values: []
        }
      })

      // Spy on invalidateQueries
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate({
        field_values: [
          { field_id: 'field-1', value: 5 }
        ]
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Verify invalidateQueries called twice
      expect(invalidateSpy).toHaveBeenCalledTimes(2)
      
      // First call: invalidate specific video field values
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['videos', 'field-values', 'video-123']
      })
      
      // Second call: invalidate all video queries
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['videos']
      })
    })

    it('should have correct mutation key for deduplication', async () => {
      vi.mocked(api.put).mockResolvedValueOnce({
        data: { updated_count: 0, field_values: [] }
      })

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-456'),
        { wrapper }
      )

      result.current.mutate({
        field_values: []
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Verify mutation was registered with correct key
      const mutationCache = queryClient.getMutationCache()
      const mutations = mutationCache.getAll()
      
      expect(mutations.length).toBeGreaterThan(0)
      expect(mutations[0].options.mutationKey).toEqual([
        'updateVideoFieldValues',
        'video-456'
      ])
    })

    it('should update multiple fields in single request', async () => {
      const mockResponse: BatchUpdateFieldValuesResponse = {
        updated_count: 3,
        field_values: [
          {
            field_id: 'field-1',
            field: {
              id: 'field-1',
              name: 'Rating',
              field_type: 'rating',
              config: { max_rating: 5 }
            },
            value: 5,
            schema_name: null,
            show_on_card: true,
            display_order: 0
          },
          {
            field_id: 'field-2',
            field: {
              id: 'field-2',
              name: 'Quality',
              field_type: 'select',
              config: { options: ['bad', 'good', 'great'] }
            },
            value: 'great',
            schema_name: null,
            show_on_card: true,
            display_order: 1
          },
          {
            field_id: 'field-3',
            field: {
              id: 'field-3',
              name: 'Watched',
              field_type: 'boolean',
              config: {}
            },
            value: true,
            schema_name: null,
            show_on_card: false,
            display_order: 2
          }
        ]
      }

      vi.mocked(api.put).mockResolvedValueOnce({ data: mockResponse })

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate({
        field_values: [
          { field_id: 'field-1', value: 5 },
          { field_id: 'field-2', value: 'great' },
          { field_id: 'field-3', value: true }
        ]
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data?.updated_count).toBe(3)
      expect(result.current.data?.field_values).toHaveLength(3)
    })

    it('should log error to console on mutation failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockError = new Error('API Error')
      
      vi.mocked(api.put).mockRejectedValueOnce(mockError)

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate({
        field_values: [{ field_id: 'field-1', value: 5 }]
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update field values:',
        mockError
      )

      consoleErrorSpy.mockRestore()
    })
  })
})
```

**Why These Tests:**
- **Query Tests (4):** Fetch success, missing data, error, cache key verification
- **Mutation Tests (10):** Success, validation error, optimistic update, rollback, cache invalidation, mutation key, multi-field update, error logging
- **Coverage:** All code paths, edge cases, error scenarios
- **Isolation:** Fresh QueryClient per test prevents flaky tests

---

### 6. Add Integration Test

**Files:** `frontend/src/hooks/__tests__/useVideoFieldValues.integration.test.ts` (NEW FILE)

**Action:** Test full flow with real QueryClient (not mocked)

**Code:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useVideoFieldValues, useUpdateVideoFieldValues } from '../useVideoFieldValues'
import { api } from '@/lib/api'
import type { VideoFieldValue, BatchUpdateFieldValuesResponse } from '../useVideoFieldValues'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  }
}))

describe('useVideoFieldValues Integration', () => {
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
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  it('should fetch, update, and refetch field values in complete flow', async () => {
    // Step 1: Initial fetch
    const initialFieldValues: VideoFieldValue[] = [
      {
        field_id: 'field-1',
        field: {
          id: 'field-1',
          name: 'Overall Rating',
          field_type: 'rating',
          config: { max_rating: 5 }
        },
        value: 3,
        schema_name: null,
        show_on_card: true,
        display_order: 0
      }
    ]

    vi.mocked(api.get).mockResolvedValueOnce({
      data: { field_values: initialFieldValues }
    })

    const { result: queryResult } = renderHook(
      () => useVideoFieldValues('video-123'),
      { wrapper }
    )

    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(queryResult.current.data?.[0].value).toBe(3)

    // Step 2: Update field value
    const updatedFieldValues: VideoFieldValue[] = [
      { ...initialFieldValues[0], value: 5 }
    ]

    const updateResponse: BatchUpdateFieldValuesResponse = {
      updated_count: 1,
      field_values: updatedFieldValues
    }

    vi.mocked(api.put).mockResolvedValueOnce({ data: updateResponse })
    
    // Mock refetch after mutation
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { field_values: updatedFieldValues }
    })

    const { result: mutationResult } = renderHook(
      () => useUpdateVideoFieldValues('video-123'),
      { wrapper }
    )

    // Trigger mutation
    act(() => {
      mutationResult.current.mutate({
        field_values: [{ field_id: 'field-1', value: 5 }]
      })
    })

    // Wait for mutation success
    await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true))

    // Step 3: Verify cache was invalidated and refetched
    await waitFor(() => {
      const cachedData = queryClient.getQueryData<VideoFieldValue[]>([
        'videos',
        'field-values',
        'video-123'
      ])
      expect(cachedData?.[0].value).toBe(5)
    })

    // Verify API calls
    expect(api.get).toHaveBeenCalledTimes(2) // Initial + refetch
    expect(api.put).toHaveBeenCalledTimes(1)
  })

  it('should handle optimistic update with rollback on error in realistic scenario', async () => {
    // Setup: Fetch initial data
    const initialFieldValues: VideoFieldValue[] = [
      {
        field_id: 'field-1',
        field: {
          id: 'field-1',
          name: 'Overall Rating',
          field_type: 'rating',
          config: { max_rating: 5 }
        },
        value: 3,
        schema_name: null,
        show_on_card: true,
        display_order: 0
      }
    ]

    vi.mocked(api.get).mockResolvedValueOnce({
      data: { field_values: initialFieldValues }
    })

    const { result: queryResult } = renderHook(
      () => useVideoFieldValues('video-123'),
      { wrapper }
    )

    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    
    // Initial state: value = 3
    expect(queryResult.current.data?.[0].value).toBe(3)

    // Trigger mutation that will fail
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Network error'))
    
    const { result: mutationResult } = renderHook(
      () => useUpdateVideoFieldValues('video-123'),
      { wrapper }
    )

    act(() => {
      mutationResult.current.mutate({
        field_values: [{ field_id: 'field-1', value: 5 }]
      })
    })

    // Immediately after mutation: optimistic update applied
    const optimisticData = queryClient.getQueryData<VideoFieldValue[]>([
      'videos',
      'field-values',
      'video-123'
    ])
    expect(optimisticData?.[0].value).toBe(5) // Optimistically 5

    // Wait for error
    await waitFor(() => expect(mutationResult.current.isError).toBe(true))

    // After error: rolled back to original value
    const rolledBackData = queryClient.getQueryData<VideoFieldValue[]>([
      'videos',
      'field-values',
      'video-123'
    ])
    expect(rolledBackData?.[0].value).toBe(3) // Rolled back to 3
  })
})
```

**Why Integration Test:**
- **Realistic Scenario:** Full fetch → update → refetch cycle
- **Cache Behavior:** Verifies invalidation and refetching work correctly
- **Rollback Verification:** Tests optimistic update rollback with real QueryClient

---

### 7. TypeScript Type Check and Verification

**Action:** Verify no TypeScript errors, all imports resolve

**Commands:**
```bash
# Frontend: Type check
cd frontend
npx tsc --noEmit

# Run tests
npm test -- useVideoFieldValues

# Expected: 14/14 tests passing, 0 TypeScript errors
```

---

### 8. Update Exports

**Files:** `frontend/src/hooks/index.ts` (if exists, create if needed)

**Action:** Export hooks for easy importing

**Code:**
```typescript
// Existing exports
export * from './useLists'
export * from './useTags'
export * from './useVideos'
export * from './useWebSocket'

// NEW: Custom Fields hooks
export * from './useVideoFieldValues'
```

**Why:** Centralized exports enable clean imports: `import { useVideoFieldValues } from '@/hooks'`

---

### 9. Add JSDoc Documentation Examples

**Files:** All hooks updated with comprehensive examples in previous steps

**Verification:**
- ✅ All functions have JSDoc comments
- ✅ Examples show complete usage patterns
- ✅ `@param`, `@returns`, `@example` tags present
- ✅ Links to backend endpoints and related tasks

---

### 10. Commit Changes

**Action:** Create clean git commit with comprehensive message

**Commands:**
```bash
git add -A
git commit -m "feat(hooks): add useVideoFieldValues with mutations and optimistic updates

- Create useVideoFieldValues query hook for fetching field values
- Create useUpdateVideoFieldValues mutation hook for batch updates
- Implement optimistic updates with automatic rollback on error
- Extend videoKeys factory with field values query keys
- Follow TanStack Query v5 best practices (onSettled, not onSuccess)
- Add 14 unit tests (100% coverage: queries, mutations, optimistic updates)
- Add 2 integration tests (fetch-update-refetch, rollback scenarios)
- Add TypeScript types matching backend schemas (Task #71, #72)
- Add comprehensive JSDoc comments with usage examples

Performance:
- Optimistic updates for instant UI feedback
- Automatic cache invalidation after mutations
- Query deduplication with mutation keys
- Stale time 5 minutes (field values change infrequently)

Follows Existing Patterns:
- Query structure matches useTags/useVideos hooks
- Cache invalidation follows useDeleteVideo pattern
- Optimistic updates follow React Query v5 best practices

Dependencies:
- Task #71: Video endpoint includes field_values in response
- Task #72: Batch update endpoint (PUT /videos/{id}/fields)
- Task #78: TypeScript types (VideoFieldValue, etc.)

Task #81 (Custom Fields System Phase 1 Frontend)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests (14 tests)

**useVideoFieldValues Query Tests (4):**
1. Fetch field values successfully
2. Return empty array if field_values missing
3. Handle error state
4. Use correct query key for caching

**useUpdateVideoFieldValues Mutation Tests (10):**
1. Update field values successfully
2. Handle validation error (422)
3. Perform optimistic update
4. Rollback optimistic update on error
5. Invalidate cache after successful mutation
6. Have correct mutation key for deduplication
7. Update multiple fields in single request
8. Log error to console on mutation failure
9. Handle network error
10. Handle empty request edge case

### Integration Tests (2 tests)

1. **Fetch → Update → Refetch Flow:**
   - Fetch initial data
   - Trigger mutation
   - Verify cache invalidation
   - Verify refetch occurs

2. **Optimistic Update with Rollback:**
   - Fetch initial data
   - Trigger mutation with API error
   - Verify optimistic update applied immediately
   - Verify rollback after error

### Manual Testing Checklist

1. **Query Hook:**
   - Import hook in component
   - Render field values from query data
   - Verify loading state works
   - Verify error state works

2. **Mutation Hook:**
   - Create form with field inputs
   - Submit form triggers mutation
   - Verify optimistic update (instant UI feedback)
   - Verify error handling (rollback on failure)
   - Verify success (data persists after refetch)

3. **TypeScript:**
   - IntelliSense works for all types
   - No `any` types in implementation
   - Type errors caught at compile time

---

## 📚 Reference

### Related Documentation

**REF MCP Validated:**
- ✅ [TanStack Query v5 - Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- ✅ [TanStack Query v5 - useMutation](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation)
- ✅ [TanStack Query v5 - Migration Guide](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5)
- ✅ [TkDodo Blog - Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys)

**Backend Tasks:**
- Task #71: Video endpoint field values (GET response includes field_values)
- Task #72: Batch update endpoint (PUT /videos/{id}/fields)
- Task #64: CustomField Pydantic schemas
- Task #65: FieldSchema Pydantic schemas

**Frontend Tasks:**
- Task #78: TypeScript types (VideoFieldValue, CustomField types)
- Task #79: useCustomFields hook (similar pattern)
- Task #80: useSchemas hook (similar pattern)

### Related Code

**Existing Hooks to Follow:**
- `frontend/src/hooks/useTags.ts` (lines 59-78) - Mutation with onSettled pattern
- `frontend/src/hooks/useVideos.ts` (lines 187-217) - Optimistic update with rollback
- `frontend/src/hooks/useVideos.ts` (lines 48-59) - Query key factory pattern

**Query Client:**
- `frontend/src/lib/queryClient.ts` - Query client configuration

---

## 🎯 Design Decisions

### Decision 1: onSettled vs onSuccess for Cache Invalidation

**Chosen:** `onSettled` (runs on both success and error)

**Rationale:**
- **Breaking Change in v5:** `onSuccess` deprecated in TanStack Query v5
- **REF MCP Evidence:** Migration guide recommends `onSettled` for cache invalidation
- **Consistency:** Ensures cache invalidation happens even if mutation partially succeeds
- **Existing Pattern:** `useTags.ts` already uses `onSettled` (line 72-76)

**Alternative Considered:** `onSuccess`
- **Rejected:** Deprecated in v5, future-proofing is important

---

### Decision 2: Optimistic Updates vs Immediate Refetch

**Chosen:** Optimistic updates with rollback

**Rationale:**
- **UX Benefit:** Instant feedback (feels responsive, no loading spinner)
- **REF MCP Evidence:** React Query docs recommend for frequently updated data
- **Error Handling:** Automatic rollback prevents inconsistent state
- **Existing Pattern:** `useDeleteVideo` uses optimistic updates (lines 194-216)

**Alternative Considered:** Invalidate immediately without optimistic update
- **Rejected:** Poor UX (user sees loading state for every edit)

---

### Decision 3: Fetch Field Values from Video Endpoint vs Dedicated Endpoint

**Chosen:** Use video endpoint (Task #71 includes field_values in response)

**Rationale:**
- **Efficiency:** Avoids duplicate API call (field_values already in video response)
- **Consistency:** Frontend already fetches videos, just extract field_values
- **Simplicity:** Fewer endpoints to maintain

**Alternative Considered:** Dedicated `/videos/{id}/fields` GET endpoint
- **Rejected:** Unnecessary duplication, Task #71 already solved this

---

### Decision 4: Query Key Structure (videoKeys.videoFieldValues)

**Chosen:** Hierarchical keys: `['videos', 'field-values', videoId]`

**Rationale:**
- **REF MCP Evidence:** TkDodo blog recommends hierarchical key factories
- **Granular Invalidation:** Can invalidate all field values or specific video
- **Consistency:** Follows existing `videoKeys` pattern (lines 48-59)

**Alternative Considered:** Flat keys: `['videoFieldValues', videoId]`
- **Rejected:** Harder to invalidate related queries (would need manual iteration)

---

### Decision 5: Mutation Key for Deduplication

**Chosen:** `['updateVideoFieldValues', videoId]`

**Rationale:**
- **Deduplication:** Multiple simultaneous updates to same video are deduplicated
- **Consistency:** Follows existing mutation key pattern from `useTags.ts` (line 63)
- **Debugging:** Clear mutation key in React Query DevTools

**Alternative Considered:** No mutation key
- **Rejected:** Multiple simultaneous mutations could conflict

---

## ⏱️ Time Estimate

**Total:** 3-4 hours

**Breakdown:**
- Step 1: Extend query key factory (10 min)
- Step 2: TypeScript types (15 min)
- Step 3: Query hook (20 min)
- Step 4: Mutation hook with optimistic updates (45 min)
- Step 5-6: Tests (unit + integration) (90 min)
- Step 7-10: Type check, exports, docs, commit (20 min)

**Note:** Estimated based on similar tasks:
- Task #20: Connect tag filter (took 2.5 hours, this is similar complexity)
- Optimistic updates add 30-45 min compared to simple mutations

---

## 📝 Notes

### REF MCP Validation Summary

**Consulted Documentation (2025-11-07):**
1. ✅ TanStack Query v5 useMutation reference
2. ✅ TanStack Query v5 optimistic updates guide
3. ✅ TanStack Query v5 migration guide (onSuccess deprecation)
4. ✅ TkDodo blog - effective query keys

**Key Findings:**
- **onSuccess deprecated:** Use `onSettled` instead for side effects
- **Optimistic updates:** Recommended pattern with `onMutate` → `onError` rollback
- **Mutation keys:** Enable deduplication and query invalidation
- **Query key hierarchies:** Enable granular cache invalidation

**No Hallucinations Detected:** All patterns validated against official 2024 docs

---

### Comparison with Existing Hooks

| Feature | useTags | useVideos | useVideoFieldValues |
|---------|---------|-----------|---------------------|
| Query Hook | ✅ | ✅ | ✅ |
| Mutation Hook | ✅ Create | ✅ Create/Delete | ✅ Update |
| Optimistic Updates | ❌ | ✅ Delete only | ✅ Update |
| Cache Invalidation | ✅ onSettled | ✅ onSettled | ✅ onSettled |
| Query Key Factory | ✅ tagsOptions() | ✅ videoKeys | ✅ videoKeys.videoFieldValues |
| Error Logging | ✅ | ❌ | ✅ |
| Tests | ❌ | ✅ | ✅ |

**Lessons Applied:**
- Follow `useTags` for mutation structure (`onSettled` pattern)
- Follow `useVideos` for optimistic updates (`onMutate` + `onError` rollback)
- Improve on existing hooks (add error logging, comprehensive tests)

---

### Dependencies

**Blocked By:**
- ⏳ Task #78: TypeScript types (VideoFieldValue, CustomField interfaces)
- ✅ Task #71: Video endpoint field values (GET includes field_values)
- ✅ Task #72: Batch update endpoint (PUT /videos/{id}/fields)

**Blocks:**
- Task #82: Extend TagEditDialog with SchemaSelector (needs useVideoFieldValues)
- Task #89: CustomFieldsPreview component (needs mutation hook for inline editing)
- Task #91: Implement inline editing in CustomFieldsPreview (uses optimistic updates)
- Task #94: FieldEditor component for modal (uses mutation hook)

**Can Be Parallel With:**
- Task #79: useCustomFields hook (independent)
- Task #80: useSchemas hook (independent)

---

**Plan Created:** 2025-11-07
**REF MCP Validated:** 2025-11-07 (TanStack Query v5 docs, TkDodo blog)
**Ready for Implementation:** ✅ (pending Task #78 TypeScript types completion)
