import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnusedSchemasTable } from './UnusedSchemasTable'
import type { UnusedSchemaStat } from '@/types/analytics'

const mockData: UnusedSchemaStat[] = [
  {
    schema_id: 'schema-1',
    schema_name: 'Old Quality Metrics',
    field_count: 5,
    tag_count: 0,
    last_used: null,
    reason: 'no_tags',
  },
  {
    schema_id: 'schema-2',
    schema_name: 'Tutorial Metrics',
    field_count: 3,
    tag_count: 2,
    last_used: '2025-11-01T10:00:00Z',
    reason: 'no_values',
  },
]

describe('UnusedSchemasTable', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders table with data', () => {
    render(<UnusedSchemasTable data={mockData} />)

    expect(screen.getByText('Unused Schemas')).toBeInTheDocument()
    expect(screen.getByText('2 schemas not actively used')).toBeInTheDocument()
    expect(screen.getByText('Old Quality Metrics')).toBeInTheDocument()
    expect(screen.getByText('Tutorial Metrics')).toBeInTheDocument()
  })

  it('renders empty state when no unused schemas', () => {
    render(<UnusedSchemasTable data={[]} />)

    expect(screen.getByText('All schemas are in use')).toBeInTheDocument()
    expect(screen.getByText('No unused schemas found')).toBeInTheDocument()
  })

  it('displays correct badge for no_tags reason', () => {
    render(<UnusedSchemasTable data={mockData} />)

    expect(screen.getByText('No Tags')).toBeInTheDocument()
  })

  it('displays correct badge for no_values reason', () => {
    render(<UnusedSchemasTable data={mockData} />)

    expect(screen.getByText('No Values')).toBeInTheDocument()
  })

  it('calls onDelete when delete button clicked', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup({ delay: null })

    render(<UnusedSchemasTable data={mockData} onDelete={onDelete} />)

    const deleteButtons = screen.getAllByRole('button')
    await user.click(deleteButtons[0])

    expect(onDelete).toHaveBeenCalledWith('schema-1')
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('does not render delete button when onDelete not provided', () => {
    render(<UnusedSchemasTable data={mockData} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
