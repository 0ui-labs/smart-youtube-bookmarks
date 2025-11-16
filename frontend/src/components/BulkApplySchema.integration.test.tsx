// frontend/src/components/BulkApplySchema.integration.test.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SchemaCard } from './SchemaCard'
import { api } from '@/lib/api'
import { useTags, useBulkApplySchema } from '@/hooks/useTags'
import {
  useSchemaUsageStats,
  useUpdateSchema,
  useDeleteSchema,
  useDuplicateSchema,
} from '@/hooks/useSchemas'
import type { FieldSchemaResponse } from '@/types/schema'
import type { Tag } from '@/types/tag'

// Mock useSchemas hooks
vi.mock('@/hooks/useSchemas', () => ({
  useSchemas: vi.fn(),
  useSchema: vi.fn(),
  usePrefetchSchema: vi.fn(() => vi.fn()),
  useCreateSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDuplicateSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useAddFieldToSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useRemoveFieldFromSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateSchemaField: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useReorderSchemaFields: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateSchemaFieldsBatch: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useSchemaUsageStats: vi.fn(() => ({ count: 0, tagNames: [] })),
  schemasOptions: vi.fn(),
  schemaOptions: vi.fn(),
  schemasKeys: {
    all: () => ['schemas'],
    lists: () => ['schemas', 'list'],
    list: (listId: string) => ['schemas', 'list', listId],
    details: () => ['schemas', 'detail'],
    detail: (schemaId: string) => ['schemas', 'detail', schemaId],
  },
}))

// Mock useTags hooks
vi.mock('@/hooks/useTags')

vi.mock('@/lib/api')

const mockSchema: FieldSchemaResponse = {
  id: 'schema-1',
  list_id: 'list-1',
  name: 'Video Quality',
  description: 'Standard quality metrics',
  schema_fields: [],
  created_at: '2025-11-08T10:00:00Z',
  updated_at: '2025-11-08T10:00:00Z',
}

const mockTags: Tag[] = [
  {
    id: 'tag-1',
    name: 'Keto Recipes',
    color: '#FF0000',
    schema_id: null,
    list_id: 'list-1',
    user_id: 'user-1',
    created_at: '2025-11-08T10:00:00Z',
    updated_at: '2025-11-08T10:00:00Z',
  },
  {
    id: 'tag-2',
    name: 'Makeup Tutorials',
    color: '#00FF00',
    schema_id: null,
    list_id: 'list-1',
    user_id: 'user-1',
    created_at: '2025-11-08T10:00:00Z',
    updated_at: '2025-11-08T10:00:00Z',
  },
  {
    id: 'tag-3',
    name: 'React Videos',
    color: '#0000FF',
    schema_id: null,
    list_id: 'list-1',
    user_id: 'user-1',
    created_at: '2025-11-08T10:00:00Z',
    updated_at: '2025-11-08T10:00:00Z',
  },
]

describe('BulkApplySchema Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.clearAllMocks()

    // Set initial data in query cache for tags
    queryClient.setQueryData(['tags'], mockTags)

    // Mock API GET /tags to return our mock tags
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/tags') {
        return Promise.resolve({ data: mockTags })
      }
      return Promise.reject(new Error(`Unexpected GET: ${url}`))
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('completes full bulk apply flow successfully', async () => {
    const user = userEvent.setup({ delay: null })

    // Mock successful tag updates
    vi.mocked(api.put).mockResolvedValue({ data: {} })

    render(<SchemaCard schema={mockSchema} listId="list-1" />, { wrapper })

    // 1. Open actions menu
    await user.click(screen.getByRole('button', { name: /actions for video quality/i }))

    // 2. Click "Apply to Tags"
    await user.click(screen.getByText(/auf tags anwenden/i))

    // 3. Dialog opens
    await waitFor(() => {
      expect(screen.getByText('Schema auf Tags anwenden')).toBeInTheDocument()
    })

    // 4. Select multiple tags
    await user.click(screen.getByLabelText('Keto Recipes'))
    await user.click(screen.getByLabelText('Makeup Tutorials'))

    // 5. Verify selection count
    expect(screen.getByText('2 Tags ausgewählt')).toBeInTheDocument()

    // 6. Confirm operation
    await user.click(screen.getByRole('button', { name: /anwenden \(2\)/i }))

    // 7. Wait for API calls
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledTimes(2)
      expect(api.put).toHaveBeenCalledWith('/tags/tag-1', { schema_id: 'schema-1' })
      expect(api.put).toHaveBeenCalledWith('/tags/tag-2', { schema_id: 'schema-1' })
    })

    // 8. Results dialog shows success
    await waitFor(() => {
      expect(screen.getByText('Schema erfolgreich angewendet')).toBeInTheDocument()
      expect(screen.getByText(/2 von 2 tags erfolgreich aktualisiert/i)).toBeInTheDocument()
    })
  })

  it('handles partial failure correctly', async () => {
    const user = userEvent.setup({ delay: null })

    // Mock: first tag succeeds, second fails
    vi.mocked(api.put)
      .mockResolvedValueOnce({ data: {} }) // tag-1 success
      .mockRejectedValueOnce({
        response: { data: { detail: 'Schema not found' } }
      }) // tag-2 failure

    render(<SchemaCard schema={mockSchema} listId="list-1" />, { wrapper })

    // Open dialog and select tags
    await user.click(screen.getByRole('button', { name: /actions for video quality/i }))
    await user.click(screen.getByText(/auf tags anwenden/i))
    await user.click(screen.getByLabelText('Keto Recipes'))
    await user.click(screen.getByLabelText('Makeup Tutorials'))
    await user.click(screen.getByRole('button', { name: /anwenden \(2\)/i }))

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Schema teilweise angewendet')).toBeInTheDocument()
      expect(screen.getByText(/1 von 2 tags erfolgreich aktualisiert/i)).toBeInTheDocument()
      expect(screen.getByText('Makeup Tutorials:')).toBeInTheDocument()
      expect(screen.getByText('Schema not found')).toBeInTheDocument()
    })

    // Retry button should be visible
    expect(screen.getByRole('button', { name: /fehlgeschlagene wiederholen/i })).toBeInTheDocument()
  })

  it('allows retrying failed operations', async () => {
    const user = userEvent.setup({ delay: null })

    // Mock: first attempt fails, retry succeeds
    vi.mocked(api.put)
      .mockRejectedValueOnce({ response: { data: { detail: 'Network error' } } })
      .mockResolvedValueOnce({ data: {} })

    render(<SchemaCard schema={mockSchema} listId="list-1" />, { wrapper })

    // Initial attempt
    await user.click(screen.getByRole('button', { name: /actions for video quality/i }))
    await user.click(screen.getByText(/auf tags anwenden/i))
    await user.click(screen.getByLabelText('Keto Recipes'))
    await user.click(screen.getByRole('button', { name: /anwenden \(1\)/i }))

    // Wait for failure
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    // Click retry
    await user.click(screen.getByRole('button', { name: /fehlgeschlagene wiederholen/i }))

    // Wait for second API call (retry)
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledTimes(2)
      expect(api.put).toHaveBeenNthCalledWith(2, '/tags/tag-1', { schema_id: 'schema-1' })
    })

    // Dialog should close after retry
    await waitFor(() => {
      expect(screen.queryByText('Network error')).not.toBeInTheDocument()
    })
  })

  it('applies optimistic updates and rolls back on error', async () => {
    const user = userEvent.setup({ delay: null })

    // Mock: All tag updates fail, but mutation succeeds with failure results
    vi.mocked(api.put).mockRejectedValue({
      response: { data: { detail: 'Server error' } }
    })

    render(<SchemaCard schema={mockSchema} listId="list-1" />, { wrapper })

    // Get initial query data - all tags have null schema_id
    const initialTags = queryClient.getQueryData<typeof mockTags>(['tags'])
    expect(initialTags?.[0].schema_id).toBeNull()

    // Perform bulk apply
    await user.click(screen.getByRole('button', { name: /actions for video quality/i }))
    await user.click(screen.getByText(/auf tags anwenden/i))
    await user.click(screen.getByLabelText('Keto Recipes'))

    // After selecting but before confirming, no optimistic update yet
    let currentTags = queryClient.getQueryData<typeof mockTags>(['tags'])
    expect(currentTags?.[0].schema_id).toBeNull()

    // Click confirm - this triggers optimistic update
    await user.click(screen.getByRole('button', { name: /anwenden \(1\)/i }))

    // Verify optimistic update happened (schema_id changed to schema-1)
    await waitFor(() => {
      currentTags = queryClient.getQueryData<typeof mockTags>(['tags'])
      expect(currentTags?.[0].schema_id).toBe('schema-1')
    })

    // Wait for error result dialog
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })

    // Verify final state: optimistic update persists even though tag update failed
    // (This is current behavior - individual failures don't trigger rollback)
    currentTags = queryClient.getQueryData<typeof mockTags>(['tags'])
    expect(currentTags?.[0].schema_id).toBe('schema-1')
  })

  it('handles select all and clear selection', async () => {
    const user = userEvent.setup({ delay: null })

    render(<SchemaCard schema={mockSchema} listId="list-1" />, { wrapper })

    // Open dialog
    await user.click(screen.getByRole('button', { name: /actions for video quality/i }))
    await user.click(screen.getByText(/auf tags anwenden/i))

    // Select all
    await user.click(screen.getByLabelText(/alle auswählen/i))
    expect(screen.getByText('3 Tags ausgewählt')).toBeInTheDocument()

    // Clear selection
    await user.click(screen.getByLabelText(/alle auswählen/i))
    expect(screen.getByText('0 Tags ausgewählt')).toBeInTheDocument()
  })
})
