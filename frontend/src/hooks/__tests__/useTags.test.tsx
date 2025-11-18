import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useUpdateTag, useDeleteTag } from '../useTags'
import { api } from '@/lib/api'
import type { Tag } from '@/types/tag'

// Mock API client
vi.mock('@/lib/api', () => ({
  api: {
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockTag: Tag = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Python',
  color: '#3B82F6',
  schema_id: null,
  user_id: '550e8400-e29b-41d4-a716-446655440001',
  created_at: '2025-11-18T10:00:00Z',
  updated_at: '2025-11-18T10:00:00Z',
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useUpdateTag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates a tag', async () => {
    const updatedTag = { ...mockTag, name: 'Updated Name' }
    vi.mocked(api.put).mockResolvedValueOnce({ data: updatedTag })

    const { result } = renderHook(() => useUpdateTag(), { wrapper: createWrapper() })

    result.current.mutate({
      tagId: mockTag.id,
      data: { name: 'Updated Name', color: '#3B82F6', schema_id: null },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Updated Name')
    expect(api.put).toHaveBeenCalledWith(`/tags/${mockTag.id}`, {
      name: 'Updated Name',
      color: '#3B82F6',
      schema_id: null,
    })
  })

  it('handles API errors', async () => {
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useUpdateTag(), { wrapper: createWrapper() })

    result.current.mutate({
      tagId: mockTag.id,
      data: { name: 'Updated Name' },
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeDefined()
  })
})

describe('useDeleteTag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a tag', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined })

    const { result } = renderHook(() => useDeleteTag(), { wrapper: createWrapper() })

    result.current.mutate(mockTag.id)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.delete).toHaveBeenCalledWith(`/tags/${mockTag.id}`)
  })

  it('handles API errors', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useDeleteTag(), { wrapper: createWrapper() })

    result.current.mutate(mockTag.id)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeDefined()
  })
})
