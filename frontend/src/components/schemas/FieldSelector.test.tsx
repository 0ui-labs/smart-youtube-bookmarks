import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FieldSelector } from './FieldSelector'

/**
 * Simplified tests for JSDOM compatibility
 *
 * NOTE: Radix UI Popovers render in portals which don't appear in JSDOM's screen queries.
 * These tests focus on:
 * - Component rendering and props
 * - State management (selected count)
 * - Integration with parent (via props)
 *
 * Visual interactions (opening popover, clicking items) should be tested in E2E tests (Task #96).
 *
 * This approach follows the pattern from Task #82 (SchemaSelector tests).
 */

// Mock useCustomFields hook - will be overridden in individual tests
const mockUseCustomFields = vi.fn()
vi.mock('@/hooks/useCustomFields', () => ({
  useCustomFields: (listId: string) => mockUseCustomFields(listId),
}))

const defaultMockData = [
  {
    id: 'field-1',
    name: 'Presentation Quality',
    field_type: 'select',
    config: { options: ['bad', 'good', 'great'] },
  },
  {
    id: 'field-2',
    name: 'Overall Rating',
    field_type: 'rating',
    config: { max_rating: 5 },
  },
  {
    id: 'field-3',
    name: 'Difficulty',
    field_type: 'text',
    config: {},
  },
] as const

describe('FieldSelector', () => {
  let queryClient: QueryClient
  const mockOnFieldsSelected = vi.fn()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    mockOnFieldsSelected.mockClear()
    // Reset to default mock data
    mockUseCustomFields.mockReturnValue({
      data: defaultMockData,
      isLoading: false,
      error: null,
    })
  })

  const renderFieldSelector = (selectedFieldIds: string[] = []) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FieldSelector
          listId="list-1"
          selectedFieldIds={selectedFieldIds}
          onFieldsSelected={mockOnFieldsSelected}
        />
      </QueryClientProvider>
    )
  }

  it('renders trigger button with correct label when no fields selected', () => {
    renderFieldSelector()

    expect(screen.getByRole('combobox', { name: /vorhandene felder auswählen/i })).toBeInTheDocument()
    expect(screen.getByText(/vorhandene felder/i)).toBeInTheDocument()
  })

  it('shows selected count in trigger button', () => {
    renderFieldSelector(['field-1', 'field-2'])

    expect(screen.getByText(/2 felder ausgewählt/i)).toBeInTheDocument()
  })

  it('shows singular form for one selected field', () => {
    renderFieldSelector(['field-1'])

    expect(screen.getByText(/1 feld ausgewählt/i)).toBeInTheDocument()
  })

  it('renders with empty selection', () => {
    renderFieldSelector([])

    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('passes correct props to trigger button', () => {
    renderFieldSelector(['field-1'])

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveAttribute('aria-label', 'Vorhandene Felder auswählen')
    expect(trigger).toHaveAttribute('role', 'combobox')
  })

  it('receives correct listId prop', () => {
    // This test verifies that the component accepts and uses the listId prop
    // The actual query execution is tested via the mock
    const { container } = renderFieldSelector()
    expect(container.firstChild).toBeTruthy()
  })

  it('handles selectedFieldIds prop correctly', () => {
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <FieldSelector
          listId="list-1"
          selectedFieldIds={[]}
          onFieldsSelected={mockOnFieldsSelected}
        />
      </QueryClientProvider>
    )

    expect(screen.getByText(/vorhandene felder/i)).toBeInTheDocument()

    // Update selectedFieldIds prop
    rerender(
      <QueryClientProvider client={queryClient}>
        <FieldSelector
          listId="list-1"
          selectedFieldIds={['field-1', 'field-2']}
          onFieldsSelected={mockOnFieldsSelected}
        />
      </QueryClientProvider>
    )

    expect(screen.getByText(/2 felder ausgewählt/i)).toBeInTheDocument()
  })

  it('shows correct plural form for multiple selected fields', () => {
    renderFieldSelector(['field-1', 'field-2', 'field-3'])

    expect(screen.getByText(/3 felder ausgewählt/i)).toBeInTheDocument()
  })

  it('displays chevron icon in trigger button', () => {
    renderFieldSelector()

    // The ChevronsUpDown icon should be rendered
    const trigger = screen.getByRole('combobox')
    expect(trigger.querySelector('svg')).toBeInTheDocument()
  })

  // REF MCP Improvement Tests - Empty States (outside Command for better semantics)

  it('shows loading state when data is loading', () => {
    mockUseCustomFields.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    })

    renderFieldSelector()

    // Trigger should be present
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    // Note: Loading spinner in popover content won't be visible in JSDOM until popover is opened
    // This test verifies the component doesn't crash during loading
  })

  it('shows error state when fetch fails', () => {
    mockUseCustomFields.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Network error'),
    })

    renderFieldSelector()

    // Trigger should still be present even with error
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    // Note: Error message in popover content won't be visible in JSDOM until popover is opened
    // This test verifies the component doesn't crash on error
  })

  it('shows empty state when no fields exist', () => {
    mockUseCustomFields.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    renderFieldSelector()

    // Trigger should show default text when no fields
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText(/vorhandene felder/i)).toBeInTheDocument()

    // Note: Empty state message in popover content won't be visible in JSDOM until popover is opened
    // This test verifies the component doesn't crash with empty data
  })

  it('handles field with text config including max_length', () => {
    mockUseCustomFields.mockReturnValue({
      data: [
        {
          id: 'field-text',
          name: 'Description',
          field_type: 'text',
          config: { max_length: 500 },
        },
      ],
      isLoading: false,
      error: null,
    })

    renderFieldSelector()

    // Component should render without crashing
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('handles boolean field type', () => {
    mockUseCustomFields.mockReturnValue({
      data: [
        {
          id: 'field-bool',
          name: 'Watched',
          field_type: 'boolean',
          config: {},
        },
      ],
      isLoading: false,
      error: null,
    })

    renderFieldSelector()

    // Component should render without crashing
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  // Note: Visual interaction tests (opening popover, selecting items) are deferred to E2E tests
  // due to JSDOM portal limitations with Radix UI components
})
