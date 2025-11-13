// frontend/src/hooks/useSchemas.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSchemas } from './useSchemas'
import { schemasApi } from '@/lib/schemasApi'
import type { FieldSchemaResponse } from '@/types/schema'

vi.mock('@/lib/schemasApi', () => ({
  schemasApi: {
    getSchemas: vi.fn(),
  },
}))

const mockSchemas: FieldSchemaResponse[] = [
  {
    id: 'schema-1',
    list_id: 'list-1',
    name: 'Makeup Tutorial Criteria',
    description: 'Fields for rating makeup tutorials',
    created_at: '2025-11-08T10:00:00Z',
    updated_at: '2025-11-08T10:00:00Z',
    schema_fields: [],
  },
]

describe('useSchemas', () => {
  let queryClient: QueryClient

  // ✨ FIX #2: Added afterEach cleanup
  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('fetches schemas successfully', async () => {
    vi.mocked(schemasApi.getSchemas).mockResolvedValueOnce(mockSchemas)

    const { result } = renderHook(() => useSchemas('list-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockSchemas)
    expect(schemasApi.getSchemas).toHaveBeenCalledWith('list-1')
  })

  it('handles fetch error', async () => {
    vi.mocked(schemasApi.getSchemas).mockRejectedValueOnce(
      new Error('Network error')
    )

    const { result } = renderHook(() => useSchemas('list-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })

  it('uses correct query key', () => {
    vi.mocked(schemasApi.getSchemas).mockResolvedValueOnce([])

    renderHook(() => useSchemas('list-1'), { wrapper })

    const queries = queryClient.getQueryCache().getAll()
    expect(queries[0].queryKey).toEqual(['schemas', 'list', 'list-1'])
  })
})
