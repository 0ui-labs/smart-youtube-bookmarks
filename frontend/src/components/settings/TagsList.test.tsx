import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TagsList } from './TagsList'
import type { Tag } from '@/types/tag'

const mockTags: Tag[] = [
  {
    id: 'tag-1',
    name: 'Python',
    color: '#3B82F6',
    schema_id: 'schema-1',
    user_id: 'user-1',
    created_at: '2025-11-18T10:00:00Z',
    updated_at: '2025-11-18T10:00:00Z',
  },
  {
    id: 'tag-2',
    name: 'Tutorial',
    color: '#10B981',
    schema_id: null,
    user_id: 'user-1',
    created_at: '2025-11-18T11:00:00Z',
    updated_at: '2025-11-18T11:00:00Z',
  },
]

describe('TagsList', () => {
  it('renders all tags in table', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Tutorial')).toBeInTheDocument()
  })

  it('shows empty state when no tags', () => {
    render(<TagsList tags={[]} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText(/no tags yet/i)).toBeInTheDocument()
  })

  it('displays "No Schema" for tags without schema', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('No Schema')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<TagsList tags={[]} isLoading={true} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders table with proper structure', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()

    // Check headers exist - use columnheader role for specificity
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(4)
    expect(headers[0]).toHaveTextContent('Name')
    expect(headers[1]).toHaveTextContent('Color')
    expect(headers[2]).toHaveTextContent('Schema')
    expect(headers[3]).toHaveTextContent('Actions')
  })

  it('displays color badge with hex code', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    // Check hex codes are displayed
    expect(screen.getByText('#3B82F6')).toBeInTheDocument()
    expect(screen.getByText('#10B981')).toBeInTheDocument()
  })

  it('renders colored circles for each tag', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    // Check for color indicators
    const pythonColorIndicator = screen.getByLabelText('Color: #3B82F6')
    const tutorialColorIndicator = screen.getByLabelText('Color: #10B981')

    expect(pythonColorIndicator).toBeInTheDocument()
    expect(tutorialColorIndicator).toBeInTheDocument()
  })

  it('shows schema badge for tags with schema', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    // First tag has schema_id, should show "Schema" badge
    // Use getAllByText since "Schema" appears as header and as badge
    const schemaElements = screen.getAllByText('Schema')
    // Should have at least 2: header + badge for first tag
    expect(schemaElements.length).toBeGreaterThanOrEqual(2)
  })

  it('table rows have hover effect class', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    // Get table rows (skip header row)
    const rows = screen.getAllByRole('row')
    const dataRows = rows.slice(1)

    dataRows.forEach(row => {
      expect(row).toHaveClass('hover:bg-muted/50')
    })
  })

  it('renders TagActionsMenu for each tag', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    // Should have actions menu for each tag
    expect(screen.getByLabelText('Actions for Python')).toBeInTheDocument()
    expect(screen.getByLabelText('Actions for Tutorial')).toBeInTheDocument()
  })
})
