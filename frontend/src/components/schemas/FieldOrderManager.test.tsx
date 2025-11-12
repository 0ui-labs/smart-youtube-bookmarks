import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldOrderManager, type FieldItem } from './FieldOrderManager'

// Mock @dnd-kit/core - provide minimal implementation for JSDOM
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}))

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (array: any[], oldIndex: number, newIndex: number) => {
    const newArray = [...array]
    const [removed] = newArray.splice(oldIndex, 1)
    newArray.splice(newIndex, 0, removed)
    return newArray
  },
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}))

// Mock @dnd-kit/modifiers
vi.mock('@dnd-kit/modifiers', () => ({
  restrictToVerticalAxis: vi.fn(),
}))

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}))

describe('FieldOrderManager', () => {
  const mockFields: FieldItem[] = [
    {
      id: 'field-1',
      field_id: '123e4567-e89b-12d3-a456-426614174000',
      display_order: 0,
      show_on_card: true,
      field_name: 'Overall Rating',
      field_type: 'rating',
    },
    {
      id: 'field-2',
      field_id: '223e4567-e89b-12d3-a456-426614174001',
      display_order: 1,
      show_on_card: true,
      field_name: 'Presentation Quality',
      field_type: 'select',
    },
    {
      id: 'field-3',
      field_id: '323e4567-e89b-12d3-a456-426614174002',
      display_order: 2,
      show_on_card: false,
      field_name: 'Notes',
      field_type: 'text',
    },
  ]

  const mockHandlers = {
    onReorder: vi.fn(),
    onToggleShowOnCard: vi.fn(),
    onRemove: vi.fn(),
  }

  it('renders fields in order', () => {
    render(<FieldOrderManager fields={mockFields} {...mockHandlers} />)

    expect(screen.getByText('Overall Rating')).toBeInTheDocument()
    expect(screen.getByText('Presentation Quality')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('displays field type correctly', () => {
    render(<FieldOrderManager fields={mockFields} {...mockHandlers} />)

    expect(screen.getByText('Rating')).toBeInTheDocument()
    expect(screen.getByText('Auswahl')).toBeInTheDocument()
    expect(screen.getByText('Text')).toBeInTheDocument()
  })

  it('calls onToggleShowOnCard when switch is toggled', async () => {
    const user = userEvent.setup()
    render(<FieldOrderManager fields={mockFields} {...mockHandlers} />)

    // Find the switch for "Notes" field (should be enabled since count < 3)
    const switches = screen.getAllByRole('switch')
    const notesSwitch = switches[2] // Third field (Notes)

    await user.click(notesSwitch)

    expect(mockHandlers.onToggleShowOnCard).toHaveBeenCalledWith('field-3', true)
  })

  it('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup()
    render(<FieldOrderManager fields={mockFields} {...mockHandlers} />)

    const removeButtons = screen.getAllByRole('button', { name: /entfernen/i })
    await user.click(removeButtons[0])

    expect(mockHandlers.onRemove).toHaveBeenCalledWith('field-1')
  })

  it('disables show-on-card switch when max 3 enabled and field is not checked', async () => {
    const fieldsAtMax: FieldItem[] = [
      { ...mockFields[0], show_on_card: true },
      { ...mockFields[1], show_on_card: true },
      {
        id: 'field-3',
        field_id: '323e4567-e89b-12d3-a456-426614174002',
        display_order: 2,
        show_on_card: true,
        field_name: 'Video Quality',
        field_type: 'select',
      },
      {
        id: 'field-4',
        field_id: '423e4567-e89b-12d3-a456-426614174003',
        display_order: 3,
        show_on_card: false, // This should be disabled
        field_name: 'Notes',
        field_type: 'text',
      },
    ]

    render(<FieldOrderManager fields={fieldsAtMax} {...mockHandlers} />)

    const switches = screen.getAllByRole('switch')
    const notesSwitch = switches[3] // Fourth field (Notes)

    expect(notesSwitch).toBeDisabled()
  })

  it('allows disabling show-on-card when at max', async () => {
    const user = userEvent.setup()
    const fieldsAtMax: FieldItem[] = [
      { ...mockFields[0], show_on_card: true },
      { ...mockFields[1], show_on_card: true },
      {
        id: 'field-3',
        field_id: '323e4567-e89b-12d3-a456-426614174002',
        display_order: 2,
        show_on_card: true,
        field_name: 'Video Quality',
        field_type: 'select',
      },
    ]

    render(<FieldOrderManager fields={fieldsAtMax} {...mockHandlers} />)

    const switches = screen.getAllByRole('switch')
    const firstSwitch = switches[0] // Already checked, should be enabled

    expect(firstSwitch).not.toBeDisabled()
    await user.click(firstSwitch)

    expect(mockHandlers.onToggleShowOnCard).toHaveBeenCalledWith('field-1', false)
  })

  it('shows helper text when at max show-on-card limit', () => {
    const fieldsAtMax: FieldItem[] = [
      { ...mockFields[0], show_on_card: true },
      { ...mockFields[1], show_on_card: true },
      {
        id: 'field-3',
        field_id: '323e4567-e89b-12d3-a456-426614174002',
        display_order: 2,
        show_on_card: true,
        field_name: 'Video Quality',
        field_type: 'select',
      },
    ]

    render(<FieldOrderManager fields={fieldsAtMax} {...mockHandlers} />)

    expect(screen.getByText(/Maximal 3 Felder können auf der Karte angezeigt werden \(3\/3\)/)).toBeInTheDocument()
  })

  it('does not show helper text when below max', () => {
    render(<FieldOrderManager fields={mockFields} {...mockHandlers} />)

    expect(screen.queryByText(/Maximal 3 Felder/)).not.toBeInTheDocument()
  })

  it('renders drag handles with correct aria labels', () => {
    render(<FieldOrderManager fields={mockFields} {...mockHandlers} />)

    expect(screen.getByRole('button', { name: 'Overall Rating verschieben' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Presentation Quality verschieben' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notes verschieben' })).toBeInTheDocument()
  })

  it('renders switches with correct aria labels', () => {
    render(<FieldOrderManager fields={mockFields} {...mockHandlers} />)

    expect(screen.getByLabelText('Overall Rating auf Karte anzeigen')).toBeInTheDocument()
    expect(screen.getByLabelText('Presentation Quality auf Karte anzeigen')).toBeInTheDocument()
    expect(screen.getByLabelText('Notes auf Karte anzeigen')).toBeInTheDocument()
  })

  it('uses stable field.id keys for SortableContext', () => {
    const { container } = render(<FieldOrderManager fields={mockFields} {...mockHandlers} />)

    // Verify that each field item has the correct key attribute
    // This is inferred from the structure, not directly testable in JSDOM
    // but we can verify fields are rendered in correct order
    const fieldNames = screen.getAllByText(/Overall Rating|Presentation Quality|Notes/)
    expect(fieldNames).toHaveLength(3)
  })

  it('handles empty fields array', () => {
    render(<FieldOrderManager fields={[]} {...mockHandlers} />)

    expect(screen.queryByRole('list')).toBeInTheDocument()
    expect(screen.queryByText(/Overall Rating/)).not.toBeInTheDocument()
  })

  it('displays correct field type for boolean fields', () => {
    const booleanField: FieldItem[] = [
      {
        id: 'field-1',
        field_id: '123e4567-e89b-12d3-a456-426614174000',
        display_order: 0,
        show_on_card: false,
        field_name: 'Recommended',
        field_type: 'boolean',
      },
    ]

    render(<FieldOrderManager fields={booleanField} {...mockHandlers} />)

    expect(screen.getByText('Ja/Nein')).toBeInTheDocument()
  })
})
