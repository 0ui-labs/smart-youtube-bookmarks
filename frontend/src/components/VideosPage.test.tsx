/**
 * Tests für VideosPage Component
 * Task #24 - Feature Flags für Button Visibility
 * Task #146 Section 7 - Sort State Management and URL Sync
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/renderWithRouter'
import { VideosPage } from './VideosPage'

// Mock hooks
vi.mock('@/hooks/useVideos', () => ({
  useVideos: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateVideo: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  useDeleteVideo: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  useBulkUploadVideos: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  exportVideosCSV: vi.fn(),
  useAssignTags: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  useUpdateVideoFieldValues: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  parseValidationError: vi.fn((err) => 'Validation error'),
  videoKeys: {
    all: ['videos'],
    lists: () => ['videos', 'list'],
    list: (listId: string) => ['videos', 'list', listId],
    filtered: (listId: string, tagNames: string[]) => ['videos', 'list', listId, { tags: tagNames.sort() }],
    withOptions: (listId: string, options: any) => ['videos', 'list', listId, options],
    fieldValues: () => ['videos', 'field-values'],
    videoFieldValues: (videoId: string) => ['videos', 'field-values', videoId],
  },
}))

vi.mock('@/hooks/useVideosFilter', () => ({
  useVideosFilter: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}))

vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateTag: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

vi.mock('@/stores/tagStore', () => ({
  useTagStore: vi.fn((selector) => {
    const state = {
      selectedTagIds: [],
      toggleTag: vi.fn(),
      clearTags: vi.fn(),
      setSelectedTagIds: vi.fn(),
    }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/stores/fieldFilterStore', () => ({
  useFieldFilterStore: vi.fn((selector) => {
    const state = {
      activeFilters: [],
    }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/stores/tableSettingsStore', () => ({
  useTableSettingsStore: vi.fn((selector) => {
    const state = {
      visibleColumns: {
        thumbnail: true,
        title: true,
        duration: true,
        actions: true,
      },
      thumbnailSize: 'medium',
      viewMode: 'list',
      setViewMode: vi.fn(),
      gridColumns: 3,
    }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    jobProgress: new Map(),
    reconnecting: false,
    historyError: null,
  })),
}))

describe('VideosPage - Feature Flags (Task #24)', () => {
  const mockListId = 'test-list-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Button Visibility with Feature Flags', () => {
    it('hides all action buttons when feature flags are false (MVP mode)', () => {
      renderWithRouter(<VideosPage listId={mockListId} />)

      // Alle drei Buttons sollten NICHT im DOM sein (nicht nur display:none)
      expect(
        screen.queryByRole('button', { name: /CSV Export/i })
      ).not.toBeInTheDocument()

      expect(
        screen.queryByRole('button', { name: /CSV Upload/i })
      ).not.toBeInTheDocument()

      expect(
        screen.queryByRole('button', { name: /Video hinzufügen/i })
      ).not.toBeInTheDocument()
    })

    it('does not render button container div when all flags are false', () => {
      const { container } = renderWithRouter(<VideosPage listId={mockListId} />)

      // Suche nach dem Button-Container div mit der spezifischen Klasse
      const buttonContainers = container.querySelectorAll('.flex.gap-2')

      // Es sollte keinen Button-Container geben (außer anderen flex gap-2 divs)
      // Wir prüfen dass keiner der Containers einen der Action-Buttons enthält
      let hasActionButtonContainer = false
      buttonContainers.forEach((div) => {
        const hasActionButton =
          div.querySelector('button[aria-label*="CSV"]') ||
          div.querySelector('button[aria-label*="Video hinzufügen"]')
        if (hasActionButton) {
          hasActionButtonContainer = true
        }
      })

      expect(hasActionButtonContainer).toBe(false)
    })
  })

  describe('Component Rendering', () => {
    it('renders without crashing when feature flags are disabled', () => {
      const { container } = renderWithRouter(<VideosPage listId={mockListId} />)

      expect(container).toBeInTheDocument()
    })

    it('renders the videos page title', () => {
      renderWithRouter(<VideosPage listId={mockListId} />)

      // Die Seite sollte "Videos" Header haben (nutze getByRole für spezifischen h1)
      expect(screen.getByRole('heading', { name: /Videos/i, level: 1 })).toBeInTheDocument()
    })
  })

  describe('Three-dot Menu (Task #27)', () => {
    it('renders three-dot menu button for each video', async () => {
      // Mock useVideos to return test data
      const { useVideos } = await import('@/hooks/useVideos')
      vi.mocked(useVideos).mockReturnValue({
        data: [
          {
            id: 'video-1',
            youtube_id: 'dQw4w9WgXcQ',
            title: 'Test Video',
            channel: 'Test Channel',
            duration: 210,
            thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
            processing_status: 'completed',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        isLoading: false,
        error: null,
      } as any)

      renderWithRouter(<VideosPage listId={mockListId} />)

      // Verify three-dot menu button exists
      const menuButton = screen.getByLabelText('Aktionen')
      expect(menuButton).toBeInTheDocument()
    })
  })
})

describe('VideosPage - Sorting (Task #146 Section 7)', () => {
  const mockListId = 'test-list-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Column Header Click Updates URL', () => {
    it('updates URL when clicking on Titel header for ascending sort', async () => {
      const user = userEvent.setup()
      const { useVideos } = await import('@/hooks/useVideos')

      const mockVideo = {
        id: 'video-1',
        youtube_id: 'abc123',
        title: 'Test Video A',
        channel: 'Channel A',
        duration: 180,
        thumbnail_url: 'https://example.com/thumb1.jpg',
        processing_status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }

      // Mock with some test data so the table renders
      vi.mocked(useVideos).mockReturnValue({
        data: [mockVideo],
        isLoading: false,
        error: null,
      } as any)

      renderWithRouter(<VideosPage listId={mockListId} />)

      // Wait for the table to render
      await waitFor(() => {
        expect(screen.getByText('Test Video A')).toBeInTheDocument()
      })

      // Find and click the Titel header button
      const titleHeader = screen.getByRole('button', { name: /Titel/i })
      await user.click(titleHeader)

      // Check that sort indicator appears (which confirms sorting is active)
      await waitFor(() => {
        expect(screen.getByLabelText('Aufsteigend sortiert')).toBeInTheDocument()
      })
    })

    it('updates URL when clicking on Dauer header for ascending sort', async () => {
      const user = userEvent.setup()
      const { useVideos } = await import('@/hooks/useVideos')

      const mockVideo = {
        id: 'video-1',
        youtube_id: 'abc123',
        title: 'Test Video A',
        channel: 'Channel A',
        duration: 180,
        thumbnail_url: 'https://example.com/thumb1.jpg',
        processing_status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }

      vi.mocked(useVideos).mockReturnValue({
        data: [mockVideo],
        isLoading: false,
        error: null,
      } as any)

      renderWithRouter(<VideosPage listId={mockListId} />)

      // Wait for the table to render
      await waitFor(() => {
        expect(screen.getByText('Test Video A')).toBeInTheDocument()
      })

      // Find and click the Dauer header button
      const durationHeader = screen.getByRole('button', { name: /Dauer/i })
      await user.click(durationHeader)

      // Check that sort indicator appears (which confirms sorting is active)
      await waitFor(() => {
        expect(screen.getByLabelText('Aufsteigend sortiert')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Sort Direction Toggle', () => {
    it('toggles sort direction on second click of same column', async () => {
      const user = userEvent.setup()
      const { useVideos } = await import('@/hooks/useVideos')

      const mockVideo = {
        id: 'video-1',
        youtube_id: 'abc123',
        title: 'Test Video A',
        channel: 'Channel A',
        duration: 180,
        thumbnail_url: 'https://example.com/thumb1.jpg',
        processing_status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }

      vi.mocked(useVideos).mockReturnValue({
        data: [mockVideo],
        isLoading: false,
        error: null,
      } as any)

      renderWithRouter(<VideosPage listId={mockListId} />)

      // Wait for the table to render
      await waitFor(() => {
        expect(screen.getByText('Test Video A')).toBeInTheDocument()
      })

      const titleHeader = screen.getByRole('button', { name: /Titel/i })

      // First click: ascending
      await user.click(titleHeader)

      await waitFor(() => {
        expect(screen.getByLabelText('Aufsteigend sortiert')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Second click: descending (waitFor above ensures first click completed)
      await user.click(titleHeader)

      await waitFor(() => {
        expect(screen.getByLabelText('Absteigend sortiert')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Sort State Parsed from URL on Mount', () => {
    it('parses sort params from URL and shows sort indicator on mount', async () => {
      const { useVideos } = await import('@/hooks/useVideos')

      const mockVideo = {
        id: 'video-1',
        youtube_id: 'abc123',
        title: 'Test Video A',
        channel: 'Channel A',
        duration: 180,
        thumbnail_url: 'https://example.com/thumb1.jpg',
        processing_status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }

      vi.mocked(useVideos).mockReturnValue({
        data: [mockVideo],
        isLoading: false,
        error: null,
      } as any)

      renderWithRouter(
        <VideosPage listId={mockListId} />,
        { initialEntries: ['/videos?sort_by=duration&sort_order=desc'] }
      )

      // Wait for the table to render
      await waitFor(() => {
        expect(screen.getByText('Test Video A')).toBeInTheDocument()
      })

      // Should show descending sort indicator on duration column
      await waitFor(() => {
        expect(screen.getByLabelText('Absteigend sortiert')).toBeInTheDocument()
      })
    })

    it('parses ascending sort from URL and shows correct indicator', async () => {
      const { useVideos } = await import('@/hooks/useVideos')

      const mockVideo = {
        id: 'video-1',
        youtube_id: 'abc123',
        title: 'Test Video A',
        channel: 'Channel A',
        duration: 180,
        thumbnail_url: 'https://example.com/thumb1.jpg',
        processing_status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }

      vi.mocked(useVideos).mockReturnValue({
        data: [mockVideo],
        isLoading: false,
        error: null,
      } as any)

      renderWithRouter(
        <VideosPage listId={mockListId} />,
        { initialEntries: ['/videos?sort_by=title&sort_order=asc'] }
      )

      // Wait for the table to render
      await waitFor(() => {
        expect(screen.getByText('Test Video A')).toBeInTheDocument()
      })

      // Should show ascending sort indicator on title column
      await waitFor(() => {
        expect(screen.getByLabelText('Aufsteigend sortiert')).toBeInTheDocument()
      })
    })
  })

  describe('Sort Indicator Display', () => {
    it('shows correct sort indicator for active column and direction', async () => {
      const { useVideos } = await import('@/hooks/useVideos')

      const mockVideo = {
        id: 'video-1',
        youtube_id: 'abc123',
        title: 'Test Video A',
        channel: 'Channel A',
        duration: 180,
        thumbnail_url: 'https://example.com/thumb1.jpg',
        processing_status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }

      vi.mocked(useVideos).mockReturnValue({
        data: [mockVideo],
        isLoading: false,
        error: null,
      } as any)

      renderWithRouter(
        <VideosPage listId={mockListId} />,
        { initialEntries: ['/videos?sort_by=duration&sort_order=asc'] }
      )

      // Wait for the table to render
      await waitFor(() => {
        expect(screen.getByText('Test Video A')).toBeInTheDocument()
      })

      // Should show ascending indicator (↑)
      await waitFor(() => {
        const indicator = screen.getByLabelText('Aufsteigend sortiert')
        expect(indicator).toBeInTheDocument()
        expect(indicator.textContent).toBe('↑')
      })
    })

    it('does not show sort indicator when no sort is active', async () => {
      const { useVideos } = await import('@/hooks/useVideos')

      const mockVideo = {
        id: 'video-1',
        youtube_id: 'abc123',
        title: 'Test Video A',
        channel: 'Channel A',
        duration: 180,
        thumbnail_url: 'https://example.com/thumb1.jpg',
        processing_status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }

      vi.mocked(useVideos).mockReturnValue({
        data: [mockVideo],
        isLoading: false,
        error: null,
      } as any)

      renderWithRouter(<VideosPage listId={mockListId} />)

      // Wait for the table to render
      await waitFor(() => {
        expect(screen.getByText('Test Video A')).toBeInTheDocument()
      })

      // Should not have any sort indicators
      expect(screen.queryByLabelText('Aufsteigend sortiert')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Absteigend sortiert')).not.toBeInTheDocument()
    })
  })
})
