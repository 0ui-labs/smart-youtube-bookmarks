# Task #79: Create useCustomFields React Query Hook

**Status:** Planning Complete
**Estimated Time:** 2-3 hours
**Dependencies:** Task #78 (TypeScript types - parallel development)
**Branch:** feature/custom-fields-migration

## 🎯 Ziel

Implement React Query hooks and API client for Custom Fields CRUD operations with type-safe query key factories, optimistic updates, and comprehensive error handling. This hook provides the data layer for managing custom field definitions (not to be confused with field values on videos).

## 📋 Acceptance Criteria

| Criterion | Evidence |
|-----------|----------|
| All 5 CRUD hooks implemented (GET, POST, PUT, DELETE, check-duplicate) | Hook exports in useCustomFields.ts |
| Query key factory follows hierarchical pattern (customFieldKeys) | customFieldKeys object with all/lists/list/detail pattern |
| TypeScript types fully inferred (no `any`) | tsc --noEmit passes, Zod validation on responses |
| Query invalidation working correctly after mutations | onSettled invalidates correct query keys |
| API client with typed axios calls | customFieldsApi.ts with CustomField types |
| Debounced duplicate check hook (300ms) | useCheckDuplicateField with debounce logic |
| 15+ unit tests passing (all hooks + edge cases) | npm test useCustomFields.test.tsx |
| Integration with existing pattern (matches useTags.ts) | queryOptions helper, mutation keys, onSettled pattern |

## 🛠️ Implementation Steps

### Step 1: Create API Client (customFieldsApi.ts)

**File:** `frontend/src/lib/customFieldsApi.ts`

**Purpose:** Centralize all API calls with type-safe axios wrappers

```typescript
import { api } from '@/lib/api'
import type {
  CustomField,
  CustomFieldCreate,
  CustomFieldUpdate,
  DuplicateCheckRequest,
  DuplicateCheckResponse,
} from '@/types/customFields'

/**
 * API client for custom fields endpoints
 * Base paths:
 * - GET/POST: /api/lists/{listId}/custom-fields
 * - PUT/DELETE: /api/custom-fields/{fieldId}
 */
export const customFieldsApi = {
  /**
   * Get all custom fields for a list
   */
  async getAll(listId: string): Promise<CustomField[]> {
    const { data } = await api.get<CustomField[]>(
      `/lists/${listId}/custom-fields`
    )
    return data ?? []
  },

  /**
   * Create a new custom field
   */
  async create(
    listId: string,
    fieldData: CustomFieldCreate
  ): Promise<CustomField> {
    const { data } = await api.post<CustomField>(
      `/lists/${listId}/custom-fields`,
      fieldData
    )
    return data
  },

  /**
   * Update an existing custom field
   * Note: Does NOT require listId - field is identified by UUID
   */
  async update(
    fieldId: string,
    fieldData: CustomFieldUpdate
  ): Promise<CustomField> {
    const { data } = await api.put<CustomField>(
      `/custom-fields/${fieldId}`,
      fieldData
    )
    return data
  },

  /**
   * Delete a custom field
   * Note: Does NOT require listId - field is identified by UUID
   * Will fail if field is used in any schema
   */
  async delete(fieldId: string): Promise<void> {
    await api.delete(`/custom-fields/${fieldId}`)
  },

  /**
   * Check if field name already exists (case-insensitive)
   */
  async checkDuplicate(
    listId: string,
    request: DuplicateCheckRequest
  ): Promise<DuplicateCheckResponse> {
    const { data } = await api.post<DuplicateCheckResponse>(
      `/lists/${listId}/custom-fields/check-duplicate`,
      request
    )
    return data
  },
}
```

**Why Separate API Client:**
- Keeps hooks focused on React Query logic
- Easier to test API layer independently
- Consistent with existing pattern (see useTags.ts uses inline api.get, but videos uses mixed approach)
- Better for mocking in Storybook/unit tests

---

### Step 2: Create Query Key Factory

**File:** `frontend/src/hooks/useCustomFields.ts` (Part 1)

**Purpose:** Hierarchical query keys following TanStack Query best practices

```typescript
/**
 * Query Key Factory for custom fields
 * 
 * Follows hierarchical structure from generic to specific:
 * - all: ['custom-fields']
 * - lists: ['custom-fields', 'list']
 * - list: ['custom-fields', 'list', listId]
 * - detail: ['custom-fields', 'detail', fieldId]
 * 
 * Benefits:
 * - Invalidate all fields: invalidateQueries({ queryKey: customFieldKeys.all })
 * - Invalidate one list: invalidateQueries({ queryKey: customFieldKeys.list(listId) })
 * - Precise cache targeting for optimistic updates
 * 
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 */
export const customFieldKeys = {
  /** Base key for all custom field queries */
  all: ['custom-fields'] as const,
  
  /** Key factory for list-scoped queries */
  lists: () => [...customFieldKeys.all, 'list'] as const,
  
  /** Key for all fields in a specific list */
  list: (listId: string) => [...customFieldKeys.lists(), listId] as const,
  
  /** Key factory for detail queries */
  details: () => [...customFieldKeys.all, 'detail'] as const,
  
  /** Key for a specific field detail (future use for GET /custom-fields/{id}) */
  detail: (fieldId: string) => [...customFieldKeys.details(), fieldId] as const,
}
```

**Design Decision: Why This Structure?**
- **all** - Invalidate when switching lists or global changes
- **list(listId)** - Scoped invalidation for mutations
- **detail(fieldId)** - Future-proof for individual field queries
- **as const** - TypeScript literal types for type safety

**REF MCP Validation:**
- ✅ TanStack Query v5 queryOptions pattern (Jan 2024)
- ✅ Effective React Query Keys (tkdodo blog #8)
- ✅ Hierarchical key structure enables partial invalidation

---

### Step 3: Create Query Options Helper

**File:** `frontend/src/hooks/useCustomFields.ts` (Part 2)

**Purpose:** Type-safe query configuration with Zod validation

```typescript
import { queryOptions } from '@tanstack/react-query'
import { customFieldsApi } from '@/lib/customFieldsApi'
import { CustomFieldSchema } from '@/types/customFields'

/**
 * Query options factory for custom fields
 * Enables type-safe reuse of query configuration
 * 
 * @example
 * ```ts
 * // Use in useQuery
 * useQuery(customFieldsOptions(listId))
 * 
 * // Use with queryClient
 * queryClient.setQueryData(customFieldsOptions(listId).queryKey, newFields)
 * queryClient.invalidateQueries({ queryKey: customFieldsOptions(listId).queryKey })
 * ```
 */
export function customFieldsOptions(listId: string) {
  return queryOptions({
    queryKey: customFieldKeys.list(listId),
    queryFn: async () => {
      const data = await customFieldsApi.getAll(listId)
      // Validate response with Zod schema for runtime safety
      return CustomFieldsSchema.parse(data)
    },
  })
}
```

**Why queryOptions Helper:**
- Type inference for queryClient.setQueryData()
- Consistent query configuration across components
- Zod validation ensures backend response matches TypeScript types
- Matches pattern from useTags.ts (tagsOptions)

---

### Step 4: Implement useCustomFields Query Hook

**File:** `frontend/src/hooks/useCustomFields.ts` (Part 3)

```typescript
import { useQuery } from '@tanstack/react-query'

/**
 * React Query hook to fetch all custom fields for a list
 * 
 * @param listId - UUID of the list
 * @returns Query result with custom fields array
 * 
 * @example
 * ```tsx
 * const { data: fields, isLoading, error } = useCustomFields(listId)
 * 
 * if (isLoading) return <Spinner />
 * if (error) return <ErrorBanner error={error} />
 * 
 * return fields.map(field => <FieldCard key={field.id} field={field} />)
 * ```
 */
export const useCustomFields = (listId: string) => {
  return useQuery(customFieldsOptions(listId))
}
```

**Why Simple Wrapper:**
- Follows existing pattern (useTags, useLists)
- queryOptions does the heavy lifting
- Easy to add list-specific overrides later (e.g., refetchInterval)

---

### Step 5: Implement useCreateCustomField Mutation Hook

**File:** `frontend/src/hooks/useCustomFields.ts` (Part 4)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * React Query mutation hook to create a new custom field
 * 
 * Automatically invalidates custom fields query after successful creation
 * to ensure UI consistency
 * 
 * @param listId - UUID of the list
 * @returns Mutation result with mutate function
 * 
 * @example
 * ```tsx
 * const createField = useCreateCustomField(listId)
 * 
 * createField.mutate({
 *   name: 'Presentation Quality',
 *   field_type: 'select',
 *   config: { options: ['bad', 'good', 'great'] }
 * })
 * 
 * if (createField.isSuccess) {
 *   toast.success('Field created!')
 * }
 * ```
 */
export const useCreateCustomField = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['createCustomField', listId],
    mutationFn: async (fieldData: CustomFieldCreate) => {
      const data = await customFieldsApi.create(listId, fieldData)
      // Validate response with Zod schema (consistent with query)
      return CustomFieldSchema.parse(data)
    },
    onError: (error) => {
      console.error('Failed to create custom field:', error)
    },
    onSettled: async () => {
      // Invalidate and refetch to ensure UI consistency
      // This runs on both success and error to handle edge cases
      await queryClient.invalidateQueries({
        queryKey: customFieldKeys.list(listId),
      })
    },
  })
}
```

**Design Decision: onSettled vs onSuccess**
- **onSettled** - Runs on both success and error (safer for cache consistency)
- Matches pattern from useTags.ts
- Alternative: Use onSuccess + optimistic updates (not needed for MVP, fields created infrequently)

**REF MCP Validation:**
- ✅ Mutation keys should include contextual data (listId)
- ✅ onSettled pattern recommended over onSuccess for invalidation
- ✅ Zod validation ensures type safety at runtime

---

### Step 6: Implement useUpdateCustomField Mutation Hook

**File:** `frontend/src/hooks/useCustomFields.ts` (Part 5)

```typescript
/**
 * React Query mutation hook to update an existing custom field
 * 
 * Supports partial updates (all fields in CustomFieldUpdate are optional)
 * Invalidates query after success to refetch updated data
 * 
 * @param listId - UUID of the list
 * @returns Mutation result with mutate function
 * 
 * @example
 * ```tsx
 * const updateField = useUpdateCustomField(listId)
 * 
 * // Update only name
 * updateField.mutate({
 *   fieldId: 'uuid',
 *   data: { name: 'New Name' }
 * })
 * 
 * // Update name and config
 * updateField.mutate({
 *   fieldId: 'uuid',
 *   data: {
 *     name: 'Rating',
 *     config: { max_rating: 10 }
 *   }
 * })
 * ```
 */
export const useUpdateCustomField = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateCustomField', listId],
    mutationFn: async ({
      fieldId,
      data,
    }: {
      fieldId: string
      data: CustomFieldUpdate
    }) => {
      const result = await customFieldsApi.update(fieldId, data)
      return CustomFieldSchema.parse(result)
    },
    onError: (error) => {
      console.error('Failed to update custom field:', error)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: customFieldKeys.list(listId),
      })
    },
  })
}
```

**Why No Optimistic Updates:**
- Field updates are infrequent (user edits field definition rarely)
- Server validation is complex (config must match field_type)
- Rollback logic would duplicate backend validation
- MVP focus: Get it working, optimize later if needed

---

### Step 7: Implement useDeleteCustomField Mutation Hook

**File:** `frontend/src/hooks/useCustomFields.ts` (Part 6)

```typescript
/**
 * React Query mutation hook to delete a custom field
 * 
 * IMPORTANT: Backend will reject deletion if field is used in any schema
 * Frontend should check field usage before calling this hook
 * 
 * Uses optimistic update to immediately remove from UI
 * 
 * @param listId - UUID of the list
 * @returns Mutation result with mutate function
 * 
 * @example
 * ```tsx
 * const deleteField = useDeleteCustomField(listId)
 * 
 * const handleDelete = async (fieldId: string) => {
 *   if (!confirm('Delete this field?')) return
 *   
 *   deleteField.mutate(fieldId, {
 *     onSuccess: () => toast.success('Field deleted'),
 *     onError: (err) => toast.error(err.message)
 *   })
 * }
 * ```
 */
export const useDeleteCustomField = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['deleteCustomField', listId],
    mutationFn: async (fieldId: string) => {
      await customFieldsApi.delete(fieldId)
    },
    // Optimistic update: immediately remove from UI
    onMutate: async (fieldId) => {
      // Cancel outgoing refetches (so they don't overwrite optimistic update)
      await queryClient.cancelQueries({
        queryKey: customFieldKeys.list(listId),
      })

      // Snapshot current value for rollback
      const previous = queryClient.getQueryData<CustomField[]>(
        customFieldKeys.list(listId)
      )

      // Optimistically update cache
      queryClient.setQueryData<CustomField[]>(
        customFieldKeys.list(listId),
        (old) => old?.filter((field) => field.id !== fieldId) ?? []
      )

      return { previous }
    },
    // Rollback on error
    onError: (error, _fieldId, context) => {
      console.error('Failed to delete custom field:', error)
      if (context?.previous) {
        queryClient.setQueryData(customFieldKeys.list(listId), context.previous)
      }
    },
    // Refetch to ensure consistency after success or error
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: customFieldKeys.list(listId),
      })
    },
  })
}
```

**Design Decision: Optimistic Delete**
- DELETE is the best candidate for optimistic updates
- User expectation: Immediate feedback
- Matches pattern from useVideos.ts (useDeleteVideo)
- Rollback on error maintains data consistency

**REF MCP Validation:**
- ✅ Optimistic updates pattern: onMutate + onError rollback
- ✅ cancelQueries prevents race conditions
- ✅ onSettled refetch ensures consistency (TanStack Query v5)

---

### Step 8: Implement useCheckDuplicateField Hook (Debounced)

**File:** `frontend/src/hooks/useCustomFields.ts` (Part 7)

**Purpose:** Real-time duplicate checking while user types field name

**Debouncing Strategy:**
- React Query deduplicates requests by queryKey automatically
- Debounce the **queryKey value** (not the API call) - cleaner approach
- Uses separate useDebounce hook for reusability

```typescript
import { useDebounce } from '@/hooks/useDebounce' // Create utility hook

/**
 * React Query hook to check if a field name already exists (case-insensitive)
 * 
 * Uses debounced name in queryKey to avoid excessive API calls
 * React Query's built-in deduplication handles the rest
 */
export const useCheckDuplicateField = (
  listId: string,
  name: string,
  options?: { enabled?: boolean }
) => {
  // Debounce the name value (300ms)
  const debouncedName = useDebounce(name, 300)

  return useQuery({
    queryKey: ['checkDuplicateField', listId, debouncedName] as const,
    queryFn: async () => {
      const data = await customFieldsApi.checkDuplicate(listId, {
        name: debouncedName,
      })
      return DuplicateCheckResponseSchema.parse(data)
    },
    enabled: (options?.enabled ?? true) && debouncedName.length > 0,
    staleTime: 0, // Always fresh
    retry: false, // Fast fail
  })
}
```

**Note:** Requires creating `frontend/src/hooks/useDebounce.ts`:

```typescript
import { useState, useEffect } from 'react'

/**
 * Debounce a value by delaying updates
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

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

---

### Step 9: Add Type Imports and Exports

**File:** `frontend/src/hooks/useCustomFields.ts` (Complete File Structure)

```typescript
// ===== IMPORTS =====
import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query'
import { customFieldsApi } from '@/lib/customFieldsApi'
import {
  CustomFieldSchema,
  DuplicateCheckResponseSchema,
  type CustomField,
  type CustomFieldCreate,
  type CustomFieldUpdate,
} from '@/types/customFields'
import { useDebounce } from '@/hooks/useDebounce'

// ===== QUERY KEY FACTORY =====
export const customFieldKeys = {
  // ... (from Step 2)
}

// ===== QUERY OPTIONS =====
export function customFieldsOptions(listId: string) {
  // ... (from Step 3)
}

// ===== QUERY HOOKS =====
export const useCustomFields = (listId: string) => {
  // ... (from Step 4)
}

export const useCheckDuplicateField = (
  listId: string,
  name: string,
  options?: { enabled?: boolean }
) => {
  // ... (from Step 8 - revised version)
}

// ===== MUTATION HOOKS =====
export const useCreateCustomField = (listId: string) => {
  // ... (from Step 5)
}

export const useUpdateCustomField = (listId: string) => {
  // ... (from Step 6)
}

export const useDeleteCustomField = (listId: string) => {
  // ... (from Step 7)
}
```

---

### Step 10: Create useDebounce Utility Hook

**File:** `frontend/src/hooks/useDebounce.ts`

```typescript
import { useState, useEffect } from 'react'

/**
 * Debounce a value by delaying updates
 * 
 * Useful for search inputs, duplicate checks, and other real-time validation
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500)
 * @returns Debounced value
 * 
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('')
 * const debouncedSearch = useDebounce(searchTerm, 300)
 * 
 * useEffect(() => {
 *   // API call with debounced value
 *   fetchResults(debouncedSearch)
 * }, [debouncedSearch])
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Cleanup: Cancel timeout if value changes before delay
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
```

**Testing Considerations:**
- Mock timers with `vi.useFakeTimers()`
- Test debounce delay with `vi.advanceTimersByTime(300)`
- Verify cleanup on unmount

---

## 🧪 Testing Strategy

### Test File: `frontend/src/hooks/useCustomFields.test.tsx`

**Test Coverage Requirements:**
- Query hooks: Success, error, loading states
- Mutation hooks: Success, error, loading states
- Query invalidation after mutations
- Optimistic updates (delete)
- Debounce behavior (duplicate check)
- TypeScript type inference

**Mock Setup:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import {
  useCustomFields,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
  useCheckDuplicateField,
  customFieldKeys,
  customFieldsOptions,
} from './useCustomFields'
import { customFieldsApi } from '@/lib/customFieldsApi'
import type { CustomField } from '@/types/customFields'

// Mock API client
vi.mock('@/lib/customFieldsApi', () => ({
  customFieldsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    checkDuplicate: vi.fn(),
  },
}))

const mockListId = '00000000-0000-0000-0000-000000000001'

const mockField: CustomField = {
  id: '00000000-0000-0000-0000-000000000101',
  list_id: mockListId,
  name: 'Presentation Quality',
  field_type: 'select',
  config: { options: ['bad', 'good', 'great'] },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const mockRatingField: CustomField = {
  id: '00000000-0000-0000-0000-000000000102',
  list_id: mockListId,
  name: 'Overall Rating',
  field_type: 'rating',
  config: { max_rating: 5 },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}
```

**Test Suite Structure:**

```typescript
describe('customFieldKeys', () => {
  it('generates correct hierarchical keys', () => {
    expect(customFieldKeys.all).toEqual(['custom-fields'])
    expect(customFieldKeys.lists()).toEqual(['custom-fields', 'list'])
    expect(customFieldKeys.list(mockListId)).toEqual(['custom-fields', 'list', mockListId])
    expect(customFieldKeys.details()).toEqual(['custom-fields', 'detail'])
    expect(customFieldKeys.detail('field-id')).toEqual(['custom-fields', 'detail', 'field-id'])
  })
})

describe('customFieldsOptions', () => {
  it('returns query options with correct structure', () => {
    const options = customFieldsOptions(mockListId)

    expect(options.queryKey).toEqual(['custom-fields', 'list', mockListId])
    expect(options.queryFn).toBeDefined()
    expect(typeof options.queryFn).toBe('function')
  })
})

describe('useCustomFields', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('fetches custom fields successfully', async () => {
    vi.mocked(customFieldsApi.getAll).mockResolvedValueOnce([mockField, mockRatingField])

    const { result } = renderHook(() => useCustomFields(mockListId), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([mockField, mockRatingField])
    expect(result.current.data).toHaveLength(2)
    expect(customFieldsApi.getAll).toHaveBeenCalledWith(mockListId)
    expect(customFieldsApi.getAll).toHaveBeenCalledTimes(1)
  })

  it('handles empty field list', async () => {
    vi.mocked(customFieldsApi.getAll).mockResolvedValueOnce([])

    const { result } = renderHook(() => useCustomFields(mockListId), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })

  it('handles fetch error', async () => {
    const error = new Error('Network error')
    vi.mocked(customFieldsApi.getAll).mockRejectedValueOnce(error)

    const { result } = renderHook(() => useCustomFields(mockListId), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBe(error)
  })
})

describe('useCreateCustomField', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('creates custom field successfully', async () => {
    vi.mocked(customFieldsApi.create).mockResolvedValueOnce(mockField)

    const { result } = renderHook(() => useCreateCustomField(mockListId), { wrapper })

    result.current.mutate({
      name: 'Presentation Quality',
      field_type: 'select',
      config: { options: ['bad', 'good', 'great'] },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockField)
    expect(customFieldsApi.create).toHaveBeenCalledWith(mockListId, {
      name: 'Presentation Quality',
      field_type: 'select',
      config: { options: ['bad', 'good', 'great'] },
    })
  })

  it('handles create error', async () => {
    const error = new Error('Field already exists')
    vi.mocked(customFieldsApi.create).mockRejectedValueOnce(error)

    const { result } = renderHook(() => useCreateCustomField(mockListId), { wrapper })

    result.current.mutate({
      name: 'Duplicate Field',
      field_type: 'text',
      config: {},
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBe(error)
  })

  it('invalidates custom fields query after successful creation', async () => {
    vi.mocked(customFieldsApi.create).mockResolvedValueOnce(mockField)
    vi.mocked(customFieldsApi.getAll).mockResolvedValueOnce([mockField])

    // Pre-populate cache
    queryClient.setQueryData(customFieldKeys.list(mockListId), [])

    const { result } = renderHook(() => useCreateCustomField(mockListId), { wrapper })

    result.current.mutate({
      name: 'Presentation Quality',
      field_type: 'select',
      config: { options: ['bad', 'good', 'great'] },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Query should be invalidated
    const queryState = queryClient.getQueryState(customFieldKeys.list(mockListId))
    expect(queryState?.isInvalidated).toBe(true)
  })
})

describe('useUpdateCustomField', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('updates custom field successfully', async () => {
    const updatedField = { ...mockField, name: 'Updated Name' }
    vi.mocked(customFieldsApi.update).mockResolvedValueOnce(updatedField)

    const { result } = renderHook(() => useUpdateCustomField(mockListId), { wrapper })

    result.current.mutate({
      fieldId: mockField.id,
      data: { name: 'Updated Name' },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(updatedField)
    expect(customFieldsApi.update).toHaveBeenCalledWith(
      mockListId,
      mockField.id,
      { name: 'Updated Name' }
    )
  })

  it('handles partial updates', async () => {
    const updatedField = {
      ...mockField,
      config: { options: ['bad', 'good', 'great', 'excellent'] },
    }
    vi.mocked(customFieldsApi.update).mockResolvedValueOnce(updatedField)

    const { result } = renderHook(() => useUpdateCustomField(mockListId), { wrapper })

    result.current.mutate({
      fieldId: mockField.id,
      data: { config: { options: ['bad', 'good', 'great', 'excellent'] } },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.config).toEqual({
      options: ['bad', 'good', 'great', 'excellent'],
    })
  })

  it('invalidates query after successful update', async () => {
    vi.mocked(customFieldsApi.update).mockResolvedValueOnce(mockField)
    vi.mocked(customFieldsApi.getAll).mockResolvedValueOnce([mockField])

    queryClient.setQueryData(customFieldKeys.list(mockListId), [mockField])

    const { result } = renderHook(() => useUpdateCustomField(mockListId), { wrapper })

    result.current.mutate({
      fieldId: mockField.id,
      data: { name: 'New Name' },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const queryState = queryClient.getQueryState(customFieldKeys.list(mockListId))
    expect(queryState?.isInvalidated).toBe(true)
  })
})

describe('useDeleteCustomField', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('deletes custom field with optimistic update', async () => {
    vi.mocked(customFieldsApi.delete).mockResolvedValueOnce()

    // Pre-populate cache with multiple fields
    queryClient.setQueryData(customFieldKeys.list(mockListId), [mockField, mockRatingField])

    const { result } = renderHook(() => useDeleteCustomField(mockListId), { wrapper })

    result.current.mutate(mockField.id)

    // Optimistic update should remove field immediately
    const cacheData = queryClient.getQueryData<CustomField[]>(
      customFieldKeys.list(mockListId)
    )
    expect(cacheData).toHaveLength(1)
    expect(cacheData?.[0].id).toBe(mockRatingField.id)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(customFieldsApi.delete).toHaveBeenCalledWith(mockField.id)
  })

  it('rolls back optimistic update on error', async () => {
    const error = new Error('Field is used in schemas')
    vi.mocked(customFieldsApi.delete).mockRejectedValueOnce(error)

    queryClient.setQueryData(customFieldKeys.list(mockListId), [mockField, mockRatingField])

    const { result } = renderHook(() => useDeleteCustomField(mockListId), { wrapper })

    result.current.mutate(mockField.id)

    await waitFor(() => expect(result.current.isError).toBe(true))

    // Cache should be restored
    const cacheData = queryClient.getQueryData<CustomField[]>(
      customFieldKeys.list(mockListId)
    )
    expect(cacheData).toHaveLength(2)
    expect(cacheData).toContainEqual(mockField)
  })
})

describe('useCheckDuplicateField', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('checks for duplicate field name', async () => {
    vi.mocked(customFieldsApi.checkDuplicate).mockResolvedValueOnce({
      exists: true,
      field: mockField,
    })

    const { result, rerender } = renderHook(
      ({ name }) => useCheckDuplicateField(mockListId, name),
      { wrapper, initialProps: { name: 'presentation quality' } }
    )

    // Advance timers for debounce
    vi.advanceTimersByTime(300)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.exists).toBe(true)
    expect(result.current.data?.field).toEqual(mockField)
    expect(customFieldsApi.checkDuplicate).toHaveBeenCalledWith(mockListId, {
      name: 'presentation quality',
    })
  })

  it('returns false when field does not exist', async () => {
    vi.mocked(customFieldsApi.checkDuplicate).mockResolvedValueOnce({
      exists: false,
      field: null,
    })

    const { result } = renderHook(
      () => useCheckDuplicateField(mockListId, 'unique field'),
      { wrapper }
    )

    vi.advanceTimersByTime(300)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.exists).toBe(false)
  })

  it('debounces API calls', async () => {
    const { rerender } = renderHook(
      ({ name }) => useCheckDuplicateField(mockListId, name),
      { wrapper, initialProps: { name: 'p' } }
    )

    // Rapidly change name
    rerender({ name: 'pr' })
    vi.advanceTimersByTime(100)
    rerender({ name: 'pre' })
    vi.advanceTimersByTime(100)
    rerender({ name: 'pres' })
    vi.advanceTimersByTime(100)

    // Should only call API once after 300ms debounce
    vi.advanceTimersByTime(300)

    expect(customFieldsApi.checkDuplicate).toHaveBeenCalledTimes(1)
  })

  it('respects enabled option', async () => {
    const { result } = renderHook(
      () => useCheckDuplicateField(mockListId, 'test', { enabled: false }),
      { wrapper }
    )

    vi.advanceTimersByTime(300)

    expect(result.current.isPending).toBe(false)
    expect(customFieldsApi.checkDuplicate).not.toHaveBeenCalled()
  })

  it('does not query when name is empty', async () => {
    const { result } = renderHook(
      () => useCheckDuplicateField(mockListId, ''),
      { wrapper }
    )

    vi.advanceTimersByTime(300)

    expect(result.current.isPending).toBe(false)
    expect(customFieldsApi.checkDuplicate).not.toHaveBeenCalled()
  })
})
```

**Test Coverage Summary:**
- ✅ Query key factory structure
- ✅ Query options helper
- ✅ useCustomFields: Success, error, empty list
- ✅ useCreateCustomField: Success, error, invalidation
- ✅ useUpdateCustomField: Full and partial updates, invalidation
- ✅ useDeleteCustomField: Optimistic update, rollback on error
- ✅ useCheckDuplicateField: Duplicate found, not found, debouncing, enabled flag

**Additional Test File: `frontend/src/hooks/useDebounce.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDebounce } from './useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('debounces value updates', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    expect(result.current).toBe('initial')

    // Update value
    rerender({ value: 'updated', delay: 500 })

    // Value should not update immediately
    expect(result.current).toBe('initial')

    // Advance timers by 499ms (just before delay)
    vi.advanceTimersByTime(499)
    expect(result.current).toBe('initial')

    // Advance timers by 1ms (total 500ms)
    vi.advanceTimersByTime(1)
    expect(result.current).toBe('updated')
  })

  it('resets debounce timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'ab' })
    vi.advanceTimersByTime(250)
    
    rerender({ value: 'abc' })
    vi.advanceTimersByTime(250)
    
    rerender({ value: 'abcd' })
    vi.advanceTimersByTime(250)

    // Value should still be initial (timer keeps resetting)
    expect(result.current).toBe('a')

    // After full delay from last change
    vi.advanceTimersByTime(250)
    expect(result.current).toBe('abcd')
  })

  it('cleans up timeout on unmount', () => {
    const { unmount } = renderHook(() => useDebounce('test', 500))

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
```

---

## 📚 Reference

### REF MCP Findings

1. **Query Options Factory Pattern (TanStack Query v5)**
   - Source: https://github.com/TanStack/query/blob/main/docs/framework/react/guides/query-options.md
   - Key Insight: `queryOptions()` helper enables type-safe reuse across useQuery, useSuspenseQuery, queryClient operations
   - Implementation: Used in `customFieldsOptions(listId)` for consistent query configuration

2. **Hierarchical Query Keys (tkdodo blog #8)**
   - Source: https://tkdodo.eu/blog/effective-react-query-keys
   - Key Insight: Structure keys from generic to specific (`all > lists > list > detail`)
   - Benefits: Precise cache invalidation, easier refactoring, prevents manual declaration errors
   - Implementation: `customFieldKeys` object with layered structure

3. **Mutation Keys Best Practices**
   - Source: https://github.com/TanStack/query/blob/main/docs/framework/react/typescript.md
   - Key Insight: Include contextual data in mutation keys (e.g., `['createCustomField', listId]`)
   - Benefits: Better debugging, mutation state filtering, devtools clarity
   - Implementation: All mutation hooks use descriptive keys with listId

4. **Optimistic Updates Pattern (v5 Simplified)**
   - Source: https://github.com/tanstack/query/blob/main/docs/framework/react/guides/optimistic-updates.md
   - Key Insight: v5 simplified pattern - onMutate + onError rollback + onSettled refetch
   - Benefits: Immediate UI feedback, automatic error recovery, cache consistency
   - Implementation: `useDeleteCustomField` uses optimistic removal with rollback

5. **onSettled vs onSuccess for Invalidation**
   - Source: TanStack Query v5 migration guide
   - Key Insight: `onSettled` runs on both success and error (safer for cache consistency)
   - Benefits: Handles edge cases where mutation succeeds but response is malformed
   - Implementation: All mutation hooks use `onSettled` for invalidation

6. **Debouncing in React Query**
   - Source: React Query community patterns
   - Key Insight: Debounce the **query key value**, not the API call (leverage React Query's deduplication)
   - Benefits: Simpler implementation, React Query handles race conditions
   - Implementation: `useDebounce` hook updates query key after 300ms delay

### Existing Hook Patterns (Reference Files)

**Pattern Source:** `frontend/src/hooks/useTags.ts`
- ✅ Query options helper (`tagsOptions()`)
- ✅ Mutation keys array (`['createTag']`)
- ✅ Zod validation in queryFn
- ✅ onSettled for invalidation
- ✅ Console error logging

**Pattern Source:** `frontend/src/hooks/useVideos.ts`
- ✅ Hierarchical query keys (`videoKeys` factory)
- ✅ Optimistic updates on delete (onMutate + rollback)
- ✅ Cache manipulation with setQueryData
- ✅ Refetch options (refetchOnMount, staleTime)

**Pattern Source:** `frontend/src/hooks/useLists.ts`
- ✅ Simple queryOptions wrapper
- ✅ Mutation with optimistic delete
- ✅ Type-safe getQueryData with listsOptions().queryKey

### Design Decision: Invalidation Strategy

**Chosen Approach:** Granular invalidation with `customFieldKeys.list(listId)`

**Why Not Broader Invalidation:**
- ❌ `invalidateQueries({ queryKey: customFieldKeys.all })` - Too broad, refetches all lists
- ✅ `invalidateQueries({ queryKey: customFieldKeys.list(listId) })` - Scoped to current list only

**Trade-offs:**
- ✅ Performance: Only refetches affected list
- ✅ Multi-tab support: Different lists don't interfere
- ❌ Complexity: Must track listId in all mutation hooks

**Alternative Considered:** Optimistic updates for all mutations
- ❌ Rejected: Create/update have complex validation (field_type + config), rollback logic would duplicate backend validation
- ✅ Only delete uses optimistic updates (simple operation, user expects immediate feedback)

### Debouncing: 300ms Rationale

**Chosen Delay:** 300ms (balance between responsiveness and API load)

**Research:**
- Google search: 200ms debounce (fast, but high API load)
- GitHub search: 300ms debounce
- Stripe input validation: 500ms debounce

**Why 300ms:**
- User types ~5 chars/second → 300ms = ~1.5 chars
- Feels instant for users (< 400ms perceived threshold)
- Reduces API calls by ~80% for typical typing speed
- Backend can handle burst of 3-4 requests/second

### TypeScript Type Inference

**No Explicit Generics Needed:**
- React Query v5 infers types from `queryFn` return type
- Zod schema parsing ensures runtime safety
- queryOptions helper preserves type information

**Example:**
```typescript
const { data } = useCustomFields(listId)
// ✅ data is typed as CustomField[] | undefined (inferred)
// ✅ No need for useCustomFields<CustomField[]>()
```

---

## 🎯 Verification Checklist

Before marking task complete, verify:

- [ ] All 5 hooks exported from useCustomFields.ts
- [ ] customFieldsApi.ts exports all 5 methods
- [ ] useDebounce.ts created and working
- [ ] Query keys follow hierarchical pattern
- [ ] TypeScript compilation passes (no `any` types)
- [ ] Zod validation on all API responses
- [ ] 15+ tests passing (useCustomFields.test.tsx)
- [ ] Debounce tests passing (useDebounce.test.ts)
- [ ] onSettled invalidation working
- [ ] Optimistic delete with rollback working
- [ ] Mutation keys include listId
- [ ] Console.error logs on mutation errors
- [ ] Pattern matches existing hooks (useTags, useVideos)

---

## 📝 Notes

**Dependencies:**
- Task #78 must provide TypeScript types (`CustomField`, `CustomFieldCreate`, etc.)
- Types are ready in `frontend/src/types/customFields.ts` (86/86 tests passing)

**Future Enhancements (Not MVP):**
- Optimistic updates for create/update (low priority, fields created infrequently)
- Query prefetching when hovering field edit button
- Infinite query for large field lists (unlikely, most lists < 20 fields)
- Field usage tracking (how many schemas use this field?)

**Potential Gotchas:**
1. **Debounce on unmount:** Ensure useDebounce cleanup prevents memory leaks
2. **Zod validation errors:** If backend response changes, Zod will throw - add try/catch if needed
3. **Optimistic delete failure:** Users might see field disappear then reappear on error (acceptable UX)
4. **Query key immutability:** Always use `as const` for query keys to prevent accidental mutations

**Testing Tips:**
- Use `vi.useFakeTimers()` for debounce tests
- Mock customFieldsApi, not axios directly (better abstraction)
- Test invalidation with `queryClient.getQueryState()`
- Verify optimistic updates with `queryClient.getQueryData()`

**Time Breakdown Estimate:**
- API client: 20 min
- Query hooks (GET + check-duplicate): 30 min
- Mutation hooks (POST/PUT/DELETE): 40 min
- useDebounce utility: 15 min
- Unit tests (15+ tests): 60 min
- Integration testing & debugging: 30 min
- **Total: ~3 hours**

---

**Implementation Order:**
1. Create useDebounce.ts (independent, reusable)
2. Create customFieldsApi.ts (no React dependencies)
3. Create useCustomFields.ts (hooks depend on API client)
4. Create useCustomFields.test.tsx (TDD approach)
5. Create useDebounce.test.ts (verify utility)
6. Manual testing with React Query DevTools

---

**REF MCP Summary:**
- ✅ 4 documentation sources validated (TanStack Query v5, tkdodo blog)
- ✅ Query options factory pattern confirmed (v5 best practice)
- ✅ Hierarchical query keys validated (tkdodo #8)
- ✅ Optimistic updates pattern validated (v5 simplified)
- ✅ Mutation keys best practices confirmed
- ✅ TypeScript generics inference validated

**Existing Hook Patterns:**
- ✅ useTags.ts - Query options + Zod validation
- ✅ useVideos.ts - Query key factory + optimistic delete
- ✅ useLists.ts - Simple queryOptions wrapper

**All acceptance criteria defined with evidence column** ✅
**Complete code examples (not pseudocode)** ✅
**React Query v5 best practices followed** ✅
**TypeScript types properly inferred** ✅
**15+ unit tests planned** ✅
