import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FilterPopover } from './FilterPopover'

// Mock the custom fields hook
const mockCustomFields = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Rating',
    field_type: 'rating',
    config: { max_rating: 5 },
    list_id: 'list-1',
    created_at: '2025-11-18T10:00:00Z',
    updated_at: '2025-11-18T10:00:00Z',
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    name: 'Category',
    field_type: 'select',
    config: { options: ['tutorial', 'course', 'talk'] },
    list_id: 'list-1',
    created_at: '2025-11-18T11:00:00Z',
    updated_at: '2025-11-18T11:00:00Z',
  },
]

vi.mock('@/hooks/useCustomFields', () => ({
  useCustomFields: vi.fn(() => ({
    data: mockCustomFields,
    isLoading: false,
  })),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('FilterPopover', () => {
  it('renders Add Filter button', () => {
    render(<FilterPopover listId="list-1" />, { wrapper: createWrapper() })

    expect(screen.getByText('Add Filter')).toBeInTheDocument()
  })

  it('opens popover on click', async () => {
    render(<FilterPopover listId="list-1" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByText('Add Filter'))

    // Popover content should appear with search input
    expect(await screen.findByPlaceholderText('Search fields...')).toBeInTheDocument()
  })

  it('shows available fields in popover', async () => {
    render(<FilterPopover listId="list-1" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByText('Add Filter'))

    // Wait for fields to appear
    expect(await screen.findByText('Rating')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
  })

  it('shows field type alongside field name', async () => {
    render(<FilterPopover listId="list-1" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByText('Add Filter'))

    // Wait for content to load
    await screen.findByText('Rating')

    // Check that field types are displayed
    expect(screen.getByText('rating')).toBeInTheDocument()
    expect(screen.getByText('select')).toBeInTheDocument()
  })
})
