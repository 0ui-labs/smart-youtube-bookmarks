import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SchemaCard } from './SchemaCard'
import type { FieldSchemaResponse } from '@/types/schema'

const mockSchema: FieldSchemaResponse = {
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
    {
      id: 'sf-2',
      schema_id: 'schema-1',
      field_id: 'field-2',
      display_order: 2,
      show_on_card: false,
      field: {
        id: 'field-2',
        list_id: 'list-1',
        name: 'Difficulty',
        field_type: 'select',
        config: { options: ['Easy', 'Medium', 'Hard'] },
        created_at: '2025-11-08T09:00:00Z',
        updated_at: '2025-11-08T09:00:00Z',
      },
    },
  ],
}

describe('SchemaCard', () => {
  // ✨ FIX #2: Added afterEach cleanup
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders schema name', () => {
    render(
      <SchemaCard
        schema={mockSchema}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        tagCount={3}
      />
    )

    expect(screen.getByText('Makeup Tutorial Criteria')).toBeInTheDocument()
  })

  it('renders schema description', () => {
    render(
      <SchemaCard
        schema={mockSchema}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        tagCount={3}
      />
    )

    expect(screen.getByText('Fields for rating makeup tutorials')).toBeInTheDocument()
  })

  it('renders field count', () => {
    render(
      <SchemaCard
        schema={mockSchema}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        tagCount={3}
      />
    )

    expect(screen.getByText('2 fields')).toBeInTheDocument()
  })

  it('renders tag usage count', () => {
    render(
      <SchemaCard
        schema={mockSchema}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        tagCount={3}
      />
    )

    expect(screen.getByText('Used by 3 tags')).toBeInTheDocument()
  })

  it('renders action menu button', () => {
    render(
      <SchemaCard
        schema={mockSchema}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        tagCount={0}
      />
    )

    // ✨ FIX #6: More specific aria-label with schema name
    expect(screen.getByRole('button', { name: /actions for makeup tutorial criteria/i })).toBeInTheDocument()
  })

  it('calls onEdit when edit action clicked', async () => {
    const onEdit = vi.fn()
    // ✨ FIX #1: Use userEvent.setup({ delay: null })
    const user = userEvent.setup({ delay: null })

    render(
      <SchemaCard
        schema={mockSchema}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        tagCount={0}
      />
    )

    await user.click(screen.getByRole('button', { name: /actions for/i }))
    await user.click(screen.getByText('Edit'))

    expect(onEdit).toHaveBeenCalledWith('schema-1')
  })

  it('calls onDelete when delete action clicked', async () => {
    const onDelete = vi.fn()
    // ✨ FIX #1: Use userEvent.setup({ delay: null })
    const user = userEvent.setup({ delay: null })

    render(
      <SchemaCard
        schema={mockSchema}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onDuplicate={vi.fn()}
        tagCount={0}
      />
    )

    await user.click(screen.getByRole('button', { name: /actions for/i }))
    await user.click(screen.getByText('Delete'))

    expect(onDelete).toHaveBeenCalledWith('schema-1')
  })

  it('calls onDuplicate when duplicate action clicked', async () => {
    const onDuplicate = vi.fn()
    // ✨ FIX #1: Use userEvent.setup({ delay: null })
    const user = userEvent.setup({ delay: null })

    render(
      <SchemaCard
        schema={mockSchema}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={onDuplicate}
        tagCount={0}
      />
    )

    await user.click(screen.getByRole('button', { name: /actions for/i }))
    await user.click(screen.getByText('Duplicate'))

    expect(onDuplicate).toHaveBeenCalledWith('schema-1')
  })

  it('shows warning when schema is used by tags', () => {
    render(
      <SchemaCard
        schema={mockSchema}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        tagCount={5}
      />
    )

    expect(screen.getByText('Used by 5 tags')).toBeInTheDocument()
  })

  it('renders without description when not provided', () => {
    const schemaNoDescription = { ...mockSchema, description: null }

    render(
      <SchemaCard
        schema={schemaNoDescription}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        tagCount={0}
      />
    )

    expect(screen.getByText('Makeup Tutorial Criteria')).toBeInTheDocument()
    expect(screen.queryByText('Fields for rating makeup tutorials')).not.toBeInTheDocument()
  })

  it('renders singular field count correctly', () => {
    const singleFieldSchema = {
      ...mockSchema,
      schema_fields: [mockSchema.schema_fields[0]],
    }

    render(
      <SchemaCard
        schema={singleFieldSchema}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        tagCount={0}
      />
    )

    expect(screen.getByText('1 field')).toBeInTheDocument()
  })
})
