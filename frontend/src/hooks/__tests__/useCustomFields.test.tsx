import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
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
} from '../useCustomFields'
import { customFieldsApi } from '@/lib/customFieldsApi'
import type { CustomField } from '@/types/customFields'

// Mock useDebounce to return value immediately for useCheckDuplicateField tests
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: vi.fn((value) => value), // Return value immediately, no delay
}))

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

    // Wait for optimistic update to apply
    await waitFor(() => {
      const cacheData = queryClient.getQueryData<CustomField[]>(
        customFieldKeys.list(mockListId)
      )
      expect(cacheData).toHaveLength(1)
    })

    const cacheData = queryClient.getQueryData<CustomField[]>(
      customFieldKeys.list(mockListId)
    )
    expect(cacheData?.[0].id).toBe(mockRatingField.id)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(customFieldsApi.delete).toHaveBeenCalledWith(mockListId, mockField.id)
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
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('checks for duplicate field name', async () => {
    vi.mocked(customFieldsApi.checkDuplicate).mockResolvedValueOnce({
      exists: true,
      field: mockField,
    })

    const { result } = renderHook(
      ({ name }) => useCheckDuplicateField(mockListId, name),
      { wrapper, initialProps: { name: 'presentation quality' } }
    )

    // useDebounce is mocked to return immediately, so query executes right away
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

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

    // useDebounce is mocked to return immediately, so query executes right away
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.exists).toBe(false)
  })

  it('debounces API calls', () => {
    // This test verifies the behavior conceptually, but since useDebounce
    // is mocked to return immediately, we just verify the hook structure
    const { rerender } = renderHook(
      ({ name }) => useCheckDuplicateField(mockListId, name),
      { wrapper, initialProps: { name: 'p' } }
    )

    // Rapidly change name
    rerender({ name: 'pr' })
    rerender({ name: 'pre' })
    rerender({ name: 'pres' })

    // With mocked useDebounce, each rerender creates new query keys
    // The actual debouncing behavior is tested in useDebounce.test.ts
    expect(customFieldsApi.checkDuplicate).toHaveBeenCalled()
  })

  it('respects enabled option', () => {
    const { result } = renderHook(
      () => useCheckDuplicateField(mockListId, 'test', { enabled: false }),
      { wrapper }
    )

    // Query should not execute when enabled is false
    expect(result.current.fetchStatus).toBe('idle')
    expect(customFieldsApi.checkDuplicate).not.toHaveBeenCalled()
  })

  it('does not query when name is empty', () => {
    const { result } = renderHook(
      () => useCheckDuplicateField(mockListId, ''),
      { wrapper }
    )

    // Query should not execute when name is empty
    expect(result.current.fetchStatus).toBe('idle')
    expect(customFieldsApi.checkDuplicate).not.toHaveBeenCalled()
  })
})
