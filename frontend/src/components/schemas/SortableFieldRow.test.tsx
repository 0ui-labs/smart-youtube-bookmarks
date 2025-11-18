/**
 * SortableFieldRow Component Tests (Task #126)
 *
 * Tests with REF MCP Improvement #2: Direct Mocking (NOT MSW)
 *
 * Coverage:
 * - Renders field name and type
 * - Renders drag handle with aria-label
 * - Calls onToggleShowOnCard when checkbox clicked
 * - Disables checkbox when isShowOnCardDisabled
 * - Displays correct field type labels (all 4 types)
 * - GripVertical icon has aria-hidden
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortableFieldRow } from './SortableFieldRow'
import type { SchemaFieldResponse } from '@/types/schema'

// REF MCP Improvement #2: Direct Mocking (NOT MSW)
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}))

describe('SortableFieldRow', () => {
  const mockField: SchemaFieldResponse = {
    field_id: '123e4567-e89b-12d3-a456-426614174000',
    schema_id: 'schema-1',
    display_order: 0,
    show_on_card: true,
    field: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      list_id: 'list-1',
      name: 'Overall Rating',
      field_type: 'rating',
      config: { max_rating: 5 },
      created_at: '2025-11-12T10:00:00Z',
      updated_at: '2025-11-12T10:00:00Z',
    },
  }

  const mockOnToggleShowOnCard = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders field name and type', () => {
    render(
      <SortableFieldRow
        field={mockField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    expect(screen.getByText('Overall Rating')).toBeInTheDocument()
    expect(screen.getByText('Bewertung')).toBeInTheDocument()
  })

  it('renders drag handle with aria-label', () => {
    render(
      <SortableFieldRow
        field={mockField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    const dragHandle = screen.getByRole('button', { name: 'Overall Rating verschieben' })
    expect(dragHandle).toBeInTheDocument()
  })

  it('calls onToggleShowOnCard when checkbox clicked', async () => {
    const user = userEvent.setup()
    render(
      <SortableFieldRow
        field={mockField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(mockOnToggleShowOnCard).toHaveBeenCalledWith(
      mockField.field_id,
      expect.any(Boolean)
    )
  })

  it('disables checkbox when isShowOnCardDisabled', () => {
    render(
      <SortableFieldRow
        field={{ ...mockField, show_on_card: false }}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={true}
      />
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeDisabled()
  })

  it('displays correct field type label for select', () => {
    const selectField: SchemaFieldResponse = {
      ...mockField,
      field: {
        ...mockField.field,
        field_type: 'select',
        config: { options: ['bad', 'good', 'great'] },
      },
    }

    render(
      <SortableFieldRow
        field={selectField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    expect(screen.getByText('Auswahl')).toBeInTheDocument()
  })

  it('displays correct field type label for text', () => {
    const textField: SchemaFieldResponse = {
      ...mockField,
      field: {
        ...mockField.field,
        field_type: 'text',
        config: { max_length: 500 },
      },
    }

    render(
      <SortableFieldRow
        field={textField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    expect(screen.getByText('Text')).toBeInTheDocument()
  })

  it('displays correct field type label for boolean', () => {
    const booleanField: SchemaFieldResponse = {
      ...mockField,
      field: {
        ...mockField.field,
        field_type: 'boolean',
        config: {},
      },
    }

    render(
      <SortableFieldRow
        field={booleanField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    expect(screen.getByText('Ja/Nein')).toBeInTheDocument()
  })

  it('GripVertical icon has aria-hidden', () => {
    const { container } = render(
      <SortableFieldRow
        field={mockField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    // Find svg with aria-hidden attribute
    const icon = container.querySelector('svg[aria-hidden="true"]')
    expect(icon).toBeInTheDocument()
  })

  it('checkbox has correct aria-label', () => {
    render(
      <SortableFieldRow
        field={mockField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    const checkbox = screen.getByLabelText('Overall Rating auf Karte anzeigen')
    expect(checkbox).toBeInTheDocument()
  })

  it('label text is clickable', async () => {
    const user = userEvent.setup()
    render(
      <SortableFieldRow
        field={mockField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    const label = screen.getByText('Auf Karte')
    await user.click(label)

    // Clicking label should trigger checkbox
    expect(mockOnToggleShowOnCard).toHaveBeenCalled()
  })

  it('renders with correct role attribute', () => {
    render(
      <SortableFieldRow
        field={mockField}
        onToggleShowOnCard={mockOnToggleShowOnCard}
        isShowOnCardDisabled={false}
      />
    )

    const row = screen.getByRole('listitem')
    expect(row).toBeInTheDocument()
  })
})
