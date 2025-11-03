/**
 * Tests für VideosPage Component
 * Task #24 - Feature Flags für Button Visibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '@/test/renderWithRouter'
import { VideosPage } from './VideosPage'

// Mock hooks
vi.mock('@/hooks/useVideos', () => ({
  useVideos: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateVideo: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useUpdateVideo: vi.fn(() => ({
    mutate: vi.fn(),
  })),
  useDeleteVideo: vi.fn(() => ({
    mutate: vi.fn(),
  })),
  exportVideosCSV: vi.fn(),
}))

vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}))

vi.mock('@/stores/tagStore', () => ({
  useTagStore: vi.fn(() => ({
    selectedTags: [],
    setSelectedTags: vi.fn(),
    clearTags: vi.fn(),
  })),
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
