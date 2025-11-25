import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterSettingsModal } from './FilterSettingsModal'
import * as useFiltersByCategory from '@/hooks/useFiltersByCategory'

// Mock the hook
vi.mock('@/hooks/useFiltersByCategory', () => ({
  useFiltersByCategory: vi.fn(),
}))

describe('FilterSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Settings button with correct icon and text', () => {
    vi.spyOn(useFiltersByCategory, 'useFiltersByCategory').mockReturnValue([])

    render(<FilterSettingsModal listId="list-1" selectedTagIds={[]} />)

    const button = screen.getByRole('button', { name: /filter/i })
    expect(button).toBeInTheDocument()
  })

  it('opens modal when Settings button is clicked', async () => {
    const user = userEvent.setup()
    vi.spyOn(useFiltersByCategory, 'useFiltersByCategory').mockReturnValue([])

    render(<FilterSettingsModal listId="list-1" selectedTagIds={[]} />)

    const button = screen.getByRole('button', { name: /filter/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Filter konfigurieren')).toBeInTheDocument()
    })
  })

  it('closes modal when backdrop or close button is clicked', async () => {
    const user = userEvent.setup()
    vi.spyOn(useFiltersByCategory, 'useFiltersByCategory').mockReturnValue([])

    render(<FilterSettingsModal listId="list-1" selectedTagIds={[]} />)

    // Open modal
    const button = screen.getByRole('button', { name: /filter/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Close modal via close button
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('passes correct props to useFiltersByCategory hook', () => {
    const mockHook = vi.spyOn(useFiltersByCategory, 'useFiltersByCategory').mockReturnValue([])

    render(<FilterSettingsModal listId="list-123" selectedTagIds={['tag-1', 'tag-2']} />)

    expect(mockHook).toHaveBeenCalledWith('list-123', ['tag-1', 'tag-2'])
  })

  it('handles empty category filters (fallback case)', async () => {
    const user = userEvent.setup()
    vi.spyOn(useFiltersByCategory, 'useFiltersByCategory').mockReturnValue([
      {
        categoryId: 'all',
        categoryName: 'Alle Felder',
        schemaId: null,
        fields: [],
      },
    ])

    render(<FilterSettingsModal listId="list-1" selectedTagIds={[]} />)

    const button = screen.getByRole('button', { name: /filter/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('Keine Felder verfügbar für diese Kategorie.')).toBeInTheDocument()
    })
  })

  it('displays tabs when multiple categories are selected', async () => {
    const user = userEvent.setup()
    vi.spyOn(useFiltersByCategory, 'useFiltersByCategory').mockReturnValue([
      {
        categoryId: 'tag-1',
        categoryName: 'Tutorial',
        schemaId: 'schema-1',
        fields: [],
      },
      {
        categoryId: 'tag-2',
        categoryName: 'Podcast',
        schemaId: 'schema-2',
        fields: [],
      },
    ])

    render(<FilterSettingsModal listId="list-1" selectedTagIds={['tag-1', 'tag-2']} />)

    const button = screen.getByRole('button', { name: /filter/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Tutorial' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Podcast' })).toBeInTheDocument()
    })
  })

  it('switches between tabs when clicked', async () => {
    const user = userEvent.setup()
    vi.spyOn(useFiltersByCategory, 'useFiltersByCategory').mockReturnValue([
      {
        categoryId: 'tag-1',
        categoryName: 'Tutorial',
        schemaId: 'schema-1',
        fields: [
          {
            id: 'field-1',
            name: 'Tutorial Rating',
            field_type: 'rating',
            config: { max_rating: 5 },
            list_id: 'list-1',
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
          },
        ],
      },
      {
        categoryId: 'tag-2',
        categoryName: 'Podcast',
        schemaId: 'schema-2',
        fields: [
          {
            id: 'field-2',
            name: 'Podcast Quality',
            field_type: 'select',
            config: { options: ['Good', 'Bad'] },
            list_id: 'list-1',
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
          },
        ],
      },
    ])

    render(<FilterSettingsModal listId="list-1" selectedTagIds={['tag-1', 'tag-2']} />)

    const button = screen.getByRole('button', { name: /filter/i })
    await user.click(button)

    // First tab should be active by default
    await waitFor(() => {
      expect(screen.getByText('Tutorial Rating')).toBeInTheDocument()
    })

    // Click on second tab
    const podcastTab = screen.getByRole('tab', { name: 'Podcast' })
    await user.click(podcastTab)

    // Second tab content should be visible
    await waitFor(() => {
      expect(screen.getByText('Podcast Quality')).toBeInTheDocument()
    })
  })

  it('displays FilterTable for each tab content', async () => {
    const user = userEvent.setup()
    vi.spyOn(useFiltersByCategory, 'useFiltersByCategory').mockReturnValue([
      {
        categoryId: 'tag-1',
        categoryName: 'Tutorial',
        schemaId: 'schema-1',
        fields: [],
      },
      {
        categoryId: 'tag-2',
        categoryName: 'Podcast',
        schemaId: 'schema-2',
        fields: [],
      },
      {
        categoryId: 'tag-3',
        categoryName: 'Review',
        schemaId: 'schema-3',
        fields: [],
      },
    ])

    render(<FilterSettingsModal listId="list-1" selectedTagIds={['tag-1', 'tag-2', 'tag-3']} />)

    const button = screen.getByRole('button', { name: /filter/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Tutorial' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Podcast' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Review' })).toBeInTheDocument()
    })
  })
})
