// frontend/src/components/fields/FieldEditor.integration.test.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FieldEditor } from './FieldEditor'

// Mock the mutation hook
const mockState = {
  mutate: vi.fn(),
  isPending: false,
}

vi.mock('@/hooks/useVideoFieldValues', () => ({
  useUpdateVideoFieldValues: vi.fn(() => mockState),
}))

// Mock parseValidationError from useVideos
vi.mock('@/hooks/useVideos', () => ({
  useVideos: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateVideo: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  useDeleteVideo: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  useBulkUploadVideos: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  exportVideosCSV: vi.fn(),
  useAssignTags: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  useUpdateVideoFieldValues: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  parseValidationError: vi.fn((err: any) => {
    if (err?.response?.status === 422 && err?.response?.data?.detail?.errors?.length > 0) {
      return err.response.data.detail.errors[0].error
    }
    return 'Validation failed'
  }),
  videoKeys: {
    all: ['videos'],
    lists: () => ['videos', 'list'],
    list: (listId: string) => ['videos', 'list', listId],
    filtered: (listId: string, tagNames: string[]) => ['videos', 'list', listId, { tags: tagNames.sort() }],
    withOptions: (listId: string, options: any) => ['videos', 'list', listId, options],
    fieldValues: () => ['videos', 'field-values'],
    videoFieldValues: (videoId: string) => ['videos', 'field-values', videoId],
  },
}))

describe('FieldEditor Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    // Use fake timers for debounce testing
    vi.useFakeTimers()

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
    mockState.mutate.mockClear()
    mockState.isPending = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders rating field with correct initial value', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FieldEditor
          videoId="video-1"
          field={{
            id: 'field-1',
            list_id: 'list-1',
            name: 'Overall Rating',
            field_type: 'rating',
            config: { max_rating: 5 },
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          }}
          value={3}
        />
      </QueryClientProvider>
    )

    // Verify component renders
    expect(screen.getByRole('radiogroup', { name: /bewertung/i })).toBeInTheDocument()

    // Verify correct star is selected
    const thirdStar = screen.getByLabelText('3 Sterne')
    expect(thirdStar).toHaveAttribute('aria-checked', 'true')
  })

  it('renders text field with character counter', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FieldEditor
          videoId="video-1"
          field={{
            id: 'field-2',
            list_id: 'list-1',
            name: 'Notes',
            field_type: 'text',
            config: { max_length: 200 },
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          }}
          value="Test note"
        />
      </QueryClientProvider>
    )

    // Verify text input renders with value
    expect(screen.getByDisplayValue('Test note')).toBeInTheDocument()

    // Verify character counter
    expect(screen.getByText(/9 \/ 200/)).toBeInTheDocument()
  })
})
