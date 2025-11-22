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
    is_video_type: true,
    user_id: 'user-1',
    created_at: '2025-11-18T10:00:00Z',
    updated_at: '2025-11-18T10:00:00Z',
  },
  {
    id: 'tag-2',
    name: 'Tutorial',
    color: '#10B981',
    schema_id: null,
    is_video_type: false,
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

  it('shows empty state when no tags (German)', () => {
    render(<TagsList tags={[]} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText(/noch keine kategorien/i)).toBeInTheDocument()
  })

  it('displays "Keine Felder" for tags without schema (German)', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Keine Felder')).toBeInTheDocument()
  })

  it('shows loading state (German)', () => {
    render(<TagsList tags={[]} isLoading={true} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText(/lade kategorien/i)).toBeInTheDocument()
  })

  it('renders table with proper structure (German headers)', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()

    // Check German headers exist
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(5) // Name, Farbe, Typ, Felder, Aktionen
    expect(headers[0]).toHaveTextContent('Name')
    expect(headers[1]).toHaveTextContent('Farbe')
    expect(headers[2]).toHaveTextContent('Typ')
    expect(headers[3]).toHaveTextContent('Felder')
    expect(headers[4]).toHaveTextContent('Aktionen')
  })

  it('displays color badge with hex code', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    // Check hex codes are displayed
    expect(screen.getByText('#3B82F6')).toBeInTheDocument()
    expect(screen.getByText('#10B981')).toBeInTheDocument()
  })

  it('renders colored circles for each tag (German label)', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    // Check for color indicators with German labels
    const pythonColorIndicator = screen.getByLabelText('Farbe: #3B82F6')
    const tutorialColorIndicator = screen.getByLabelText('Farbe: #10B981')

    expect(pythonColorIndicator).toBeInTheDocument()
    expect(tutorialColorIndicator).toBeInTheDocument()
  })

  it('shows "Felder konfiguriert" for tags with schema', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    // First tag has schema_id, should show "Felder konfiguriert"
    expect(screen.getByText('Felder konfiguriert')).toBeInTheDocument()
  })

  it('shows type badge (Kategorie/Label)', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    // First tag is_video_type=true -> "Kategorie"
    expect(screen.getByText('Kategorie')).toBeInTheDocument()
    // Second tag is_video_type=false -> "Label"
    expect(screen.getByText('Label')).toBeInTheDocument()
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
