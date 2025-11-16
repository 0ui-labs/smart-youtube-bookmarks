import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SchemasList } from './SchemasList'
import type { FieldSchemaResponse } from '@/types/schema'

// Helper to wrap components with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const mockSchemas: FieldSchemaResponse[] = [
  {
    id: 'schema-1',
    list_id: 'list-1',
    name: 'Makeup Tutorial Criteria',
    description: 'Fields for rating makeup tutorials',
    created_at: '2025-11-08T10:00:00Z',
    updated_at: '2025-11-08T10:00:00Z',
    schema_fields: [
      {
        id: 'sf-1',
        schema_id: 'schema-1',
        field_id: 'field-1',
        display_order: 1,
        show_on_card: true,
        field: {
          id: 'field-1',
          list_id: 'list-1',
          name: 'Presentation Quality',
          field_type: 'rating',
          config: { max_rating: 5 },
          created_at: '2025-11-08T09:00:00Z',
          updated_at: '2025-11-08T09:00:00Z',
        },
      },
    ],
  },
  {
    id: 'schema-2',
    list_id: 'list-1',
    name: 'Keto Recipe Criteria',
    description: null,
    created_at: '2025-11-08T11:00:00Z',
    updated_at: '2025-11-08T11:00:00Z',
    schema_fields: [],
  },
]

describe('SchemasList', () => {
  // ✨ FIX #2: Added afterEach cleanup
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders all schemas as cards', () => {
    render(
      <SchemasList
        schemas={mockSchemas}
        listId="list-1"
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Makeup Tutorial Criteria')).toBeInTheDocument()
    expect(screen.getByText('Keto Recipe Criteria')).toBeInTheDocument()
  })

  it('renders schemas in grid layout', () => {
    const { container } = render(
      <SchemasList
        schemas={mockSchemas}
        listId="list-1"
      />,
      { wrapper: createWrapper() }
    )

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
  })

  it('renders action menus for all schema cards', () => {
    render(
      <SchemasList
        schemas={mockSchemas}
        listId="list-1"
      />,
      { wrapper: createWrapper() }
    )

    // Verify cards render with action menus
    expect(screen.getAllByRole('button', { name: /actions for/i })).toHaveLength(2)
  })

  it('renders empty list gracefully', () => {
    const { container } = render(
      <SchemasList
        schemas={[]}
        listId="list-1"
      />,
      { wrapper: createWrapper() }
    )

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
    expect(grid?.children).toHaveLength(0)
  })
})
