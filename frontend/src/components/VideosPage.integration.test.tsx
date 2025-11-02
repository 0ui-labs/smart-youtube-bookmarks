import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VideosPage } from './VideosPage'
import { useTagStore } from '@/stores/tagStore'
import * as useTagsHook from '@/hooks/useTags'
import * as useVideosHook from '@/hooks/useVideos'

// Mock the hooks
vi.mock('@/hooks/useTags')
vi.mock('@/hooks/useVideos')
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    jobProgress: new Map(),
    reconnecting: false,
    historyError: null,
  }),
}))

describe('VideosPage - TagNavigation Integration', () => {
  let queryClient: QueryClient

  const mockTags = [
    { id: '1', name: 'Python', color: '#3b82f6' },
    { id: '2', name: 'Tutorial', color: '#10b981' },
    { id: '3', name: 'Advanced', color: '#f59e0b' },
  ]

  const mockVideos = [
    {
      id: '1',
      youtube_id: 'abc123',
      title: 'Python Tutorial',
      channel: 'Tech Channel',
      duration: 600,
      thumbnail_url: 'https://example.com/thumb.jpg',
    },
  ]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    // Reset Zustand store
    useTagStore.setState({ selectedTagIds: [], tags: [] })

    // Mock useTags hook - successful response
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
      error: null,
      isError: false,
      refetch: vi.fn(),
    } as any)

    // Mock useVideos hook - successful response
    vi.mocked(useVideosHook.useVideos).mockReturnValue({
      data: mockVideos,
      isLoading: false,
      error: null,
      isError: false,
    } as any)

    vi.mocked(useVideosHook.useCreateVideo).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    vi.mocked(useVideosHook.useDeleteVideo).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any)

    vi.mocked(useVideosHook.exportVideosCSV).mockResolvedValue(undefined)
  })

  const renderVideosPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <VideosPage listId="list-123" onBack={vi.fn()} />
      </QueryClientProvider>
    )
  }

  describe('TagNavigation Rendering', () => {
    it('should render TagNavigation component in sidebar', async () => {
      renderVideosPage()

      // TagNavigation should be present (check for its container or tags)
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
        expect(screen.getByText('Tutorial')).toBeInTheDocument()
        expect(screen.getByText('Advanced')).toBeInTheDocument()
      })
    })

    it('should show loading state when tags are loading', async () => {
      vi.mocked(useTagsHook.useTags).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
      } as any)

      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Tags werden geladen...')).toBeInTheDocument()
      })
    })

    it('should show error state when tags fail to load', async () => {
      vi.mocked(useTagsHook.useTags).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch'),
        isError: true,
      } as any)

      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Fehler beim Laden der Tags')).toBeInTheDocument()
      })
    })
  })

  describe('Tag Selection Integration', () => {
    it('should update Zustand store when tag is clicked', async () => {
      const user = userEvent.setup()
      renderVideosPage()

      // Wait for tags to render
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      // Click Python tag
      const pythonTag = screen.getByText('Python').closest('button')
      expect(pythonTag).toBeInTheDocument()
      await user.click(pythonTag!)

      // Check store was updated
      const { selectedTagIds } = useTagStore.getState()
      expect(selectedTagIds).toContain('1')
    })

    it('should show selected tag names in page header', async () => {
      const user = userEvent.setup()
      renderVideosPage()

      // Wait for tags to render
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      // Initially no filter shown
      expect(screen.queryByText(/Gefiltert nach:/)).not.toBeInTheDocument()

      // Click Python tag
      const pythonTag = screen.getByText('Python').closest('button')
      await user.click(pythonTag!)

      // Filter subtitle should appear
      await waitFor(() => {
        expect(screen.getByText(/Gefiltert nach: Python/)).toBeInTheDocument()
      })
    })

    it('should show multiple selected tags in header', async () => {
      const user = userEvent.setup()
      renderVideosPage()

      // Wait for tags to render
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      // Click Python and Tutorial tags
      const pythonTag = screen.getByText('Python').closest('button')
      const tutorialTag = screen.getByText('Tutorial').closest('button')

      await user.click(pythonTag!)
      await user.click(tutorialTag!)

      // Filter subtitle should show both
      await waitFor(() => {
        expect(screen.getByText(/Gefiltert nach: Python, Tutorial/)).toBeInTheDocument()
      })
    })

    it('should have "Filter entfernen" button when tags are selected', async () => {
      const user = userEvent.setup()
      renderVideosPage()

      // Wait for tags to render
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      // Click Python tag
      const pythonTag = screen.getByText('Python').closest('button')
      await user.click(pythonTag!)

      // "Filter entfernen" button should appear
      await waitFor(() => {
        expect(screen.getByText('(Filter entfernen)')).toBeInTheDocument()
      })
    })

    it('should clear all tags when "Filter entfernen" is clicked', async () => {
      const user = userEvent.setup()
      renderVideosPage()

      // Wait for tags to render and click Python tag
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      const pythonTag = screen.getByText('Python').closest('button')
      await user.click(pythonTag!)

      // Verify filter is shown
      await waitFor(() => {
        expect(screen.getByText(/Gefiltert nach: Python/)).toBeInTheDocument()
      })

      // Click "Filter entfernen"
      const clearButton = screen.getByText('(Filter entfernen)')
      await user.click(clearButton)

      // Filter subtitle should disappear
      await waitFor(() => {
        expect(screen.queryByText(/Gefiltert nach:/)).not.toBeInTheDocument()
      })

      // Store should be cleared
      const { selectedTagIds } = useTagStore.getState()
      expect(selectedTagIds).toHaveLength(0)
    })
  })

  describe('Create Tag Placeholder', () => {
    it('should render create tag button in TagNavigation', async () => {
      renderVideosPage()

      // TagNavigation has a "+" button for creating tags
      await waitFor(() => {
        // Look for Plus icon or create button (TagNavigation uses lucide-react Plus)
        const createButton = screen.getByRole('button', { name: /tag erstellen/i })
        expect(createButton).toBeInTheDocument()
      })
    })

    it('should call handleCreateTag when plus button is clicked', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log')
      const user = userEvent.setup()
      renderVideosPage()

      // Wait for TagNavigation to render
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      // Click create tag button
      const createButton = screen.getByRole('button', { name: /tag erstellen/i })
      await user.click(createButton)

      // Should log placeholder message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Create tag')
      )

      consoleLogSpy.mockRestore()
    })
  })

  describe('Page Title', () => {
    it('should always show "Videos" as main title', async () => {
      renderVideosPage()

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1, name: 'Videos' })
        expect(heading).toBeInTheDocument()
      })
    })

    it('should keep "Videos" title even when tags are selected', async () => {
      const user = userEvent.setup()
      renderVideosPage()

      // Click Python tag
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      const pythonTag = screen.getByText('Python').closest('button')
      await user.click(pythonTag!)

      // Title should still be "Videos"
      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1, name: 'Videos' })
        expect(heading).toBeInTheDocument()
      })
    })
  })

  describe('Empty States', () => {
    it('should handle empty tags array', async () => {
      vi.mocked(useTagsHook.useTags).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        isError: false,
      } as any)

      renderVideosPage()

      // Should render TagNavigation with empty state (no tags, just create button)
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /tag erstellen/i })
        expect(createButton).toBeInTheDocument()
      })
    })
  })

  describe('Tag Filtering Integration', () => {
    const mockVideosWithTags = [
      {
        id: 'video-1',
        list_id: 'list-123',
        youtube_id: 'abc123',
        title: 'Python Tutorial',
        channel: 'Tech Channel',
        duration: 600,
        thumbnail_url: 'https://example.com/thumb1.jpg',
        processing_status: 'completed' as const,
        error_message: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'video-2',
        list_id: 'list-123',
        youtube_id: 'def456',
        title: 'JavaScript Basics',
        channel: 'Code Academy',
        duration: 900,
        thumbnail_url: 'https://example.com/thumb2.jpg',
        processing_status: 'completed' as const,
        error_message: null,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        published_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 'video-3',
        list_id: 'list-123',
        youtube_id: 'ghi789',
        title: 'React Advanced',
        channel: 'Frontend Masters',
        duration: 1200,
        thumbnail_url: 'https://example.com/thumb3.jpg',
        processing_status: 'completed' as const,
        error_message: null,
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
        published_at: '2024-01-03T00:00:00Z',
      },
    ]

    beforeEach(() => {
      // Reset mock to default (all videos)
      vi.mocked(useVideosHook.useVideos).mockReturnValue({
        data: mockVideosWithTags,
        isLoading: false,
        error: null,
        isError: false,
      } as any)
    })

    it('should call useVideos with undefined when no tags selected', async () => {
      renderVideosPage()

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('Python Tutorial')).toBeInTheDocument()
      })

      // useVideos should be called with (listId, undefined)
      expect(useVideosHook.useVideos).toHaveBeenCalledWith('list-123', undefined)
    })

    it('should call useVideos with tag names when tag is selected', async () => {
      const user = userEvent.setup()
      renderVideosPage()

      // Wait for tags to render
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      // Click Python tag
      const pythonTag = screen.getByText('Python').closest('button')
      await user.click(pythonTag!)

      // Wait for re-render with filtered call
      await waitFor(() => {
        // useVideos should be called with (listId, ['Python'])
        expect(useVideosHook.useVideos).toHaveBeenCalledWith('list-123', ['Python'])
      })
    })

    it('should call useVideos with multiple tag names when multiple tags selected', async () => {
      const user = userEvent.setup()
      renderVideosPage()

      // Wait for tags to render
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      // Click Python and Tutorial tags
      const pythonTag = screen.getByText('Python').closest('button')
      const tutorialTag = screen.getByText('Tutorial').closest('button')

      await user.click(pythonTag!)
      await user.click(tutorialTag!)

      // Wait for re-render with filtered call
      await waitFor(() => {
        // useVideos should be called with both tag names (OR logic)
        const calls = vi.mocked(useVideosHook.useVideos).mock.calls
        const lastCall = calls[calls.length - 1]
        expect(lastCall[0]).toBe('list-123')
        expect(lastCall[1]).toEqual(expect.arrayContaining(['Python', 'Tutorial']))
      })
    })

    it('should display filtered videos when tag is selected', async () => {
      const user = userEvent.setup()

      // Mock filtered response - only Python video
      vi.mocked(useVideosHook.useVideos).mockImplementation((listId, tagNames) => {
        if (tagNames && tagNames.includes('Python')) {
          return {
            data: [mockVideosWithTags[0]], // Only Python Tutorial
            isLoading: false,
            error: null,
            isError: false,
          } as any
        }
        return {
          data: mockVideosWithTags,
          isLoading: false,
          error: null,
          isError: false,
        } as any
      })

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <VideosPage listId="list-123" onBack={vi.fn()} />
        </QueryClientProvider>
      )

      // Wait for initial load - all videos visible
      await waitFor(() => {
        expect(screen.getByText('Python Tutorial')).toBeInTheDocument()
        expect(screen.getByText('JavaScript Basics')).toBeInTheDocument()
        expect(screen.getByText('React Advanced')).toBeInTheDocument()
      })

      // Click Python tag
      const pythonTag = screen.getByText('Python').closest('button')
      await user.click(pythonTag!)

      // Force re-render to simulate React Query refetch
      rerender(
        <QueryClientProvider client={queryClient}>
          <VideosPage listId="list-123" onBack={vi.fn()} />
        </QueryClientProvider>
      )

      // Wait for filtered results - only Python video visible
      await waitFor(() => {
        expect(screen.getByText('Python Tutorial')).toBeInTheDocument()
        expect(screen.queryByText('JavaScript Basics')).not.toBeInTheDocument()
        expect(screen.queryByText('React Advanced')).not.toBeInTheDocument()
      })

      // Header should show filter status
      expect(screen.getByText(/Gefiltert nach: Python/)).toBeInTheDocument()
    })

    it('should show all videos when "Filter entfernen" is clicked', async () => {
      const user = userEvent.setup()

      // Mock implementation that responds to tag filtering
      vi.mocked(useVideosHook.useVideos).mockImplementation((listId, tagNames) => {
        if (tagNames && tagNames.length > 0) {
          return {
            data: [mockVideosWithTags[0]], // Filtered
            isLoading: false,
            error: null,
            isError: false,
          } as any
        }
        return {
          data: mockVideosWithTags, // All videos
          isLoading: false,
          error: null,
          isError: false,
        } as any
      })

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <VideosPage listId="list-123" onBack={vi.fn()} />
        </QueryClientProvider>
      )

      // Wait for tags to render
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      // Select Python tag first
      const pythonTag = screen.getByText('Python').closest('button')
      await user.click(pythonTag!)

      // Force re-render
      rerender(
        <QueryClientProvider client={queryClient}>
          <VideosPage listId="list-123" onBack={vi.fn()} />
        </QueryClientProvider>
      )

      // Wait for filtered state
      await waitFor(() => {
        expect(screen.queryByText('JavaScript Basics')).not.toBeInTheDocument()
      })

      // Click "Filter entfernen"
      const clearButton = screen.getByRole('button', { name: /filter entfernen/i })
      await user.click(clearButton)

      // Force re-render
      rerender(
        <QueryClientProvider client={queryClient}>
          <VideosPage listId="list-123" onBack={vi.fn()} />
        </QueryClientProvider>
      )

      // All videos should reappear
      await waitFor(() => {
        expect(screen.getByText('Python Tutorial')).toBeInTheDocument()
        expect(screen.getByText('JavaScript Basics')).toBeInTheDocument()
        expect(screen.getByText('React Advanced')).toBeInTheDocument()
      })

      // Filter status should be gone
      expect(screen.queryByText(/Gefiltert nach:/)).not.toBeInTheDocument()
    })

    it('should show loading state during filter change', async () => {
      const user = userEvent.setup()

      // Mock loading state
      vi.mocked(useVideosHook.useVideos).mockImplementation((listId, tagNames) => {
        if (tagNames && tagNames.length > 0) {
          return {
            data: undefined,
            isLoading: true, // Loading filtered results
            error: null,
            isError: false,
          } as any
        }
        return {
          data: mockVideosWithTags,
          isLoading: false,
          error: null,
          isError: false,
        } as any
      })

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <VideosPage listId="list-123" onBack={vi.fn()} />
        </QueryClientProvider>
      )

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Python')).toBeInTheDocument()
      })

      // Click Python tag
      const pythonTag = screen.getByText('Python').closest('button')
      await user.click(pythonTag!)

      // Force re-render
      rerender(
        <QueryClientProvider client={queryClient}>
          <VideosPage listId="list-123" onBack={vi.fn()} />
        </QueryClientProvider>
      )

      // Loading indicator should appear
      await waitFor(() => {
        expect(screen.getByText('Lade Videos...')).toBeInTheDocument()
      })
    })

    it('should handle empty filtered results', async () => {
      const user = userEvent.setup()

      // Mock empty filtered response
      vi.mocked(useVideosHook.useVideos).mockImplementation((listId, tagNames) => {
        if (tagNames && tagNames.includes('Advanced')) {
          return {
            data: [], // No videos with Advanced tag
            isLoading: false,
            error: null,
            isError: false,
          } as any
        }
        return {
          data: mockVideosWithTags,
          isLoading: false,
          error: null,
          isError: false,
        } as any
      })

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <VideosPage listId="list-123" onBack={vi.fn()} />
        </QueryClientProvider>
      )

      // Wait for initial render with all videos
      await waitFor(() => {
        expect(screen.getByText('Python Tutorial')).toBeInTheDocument()
      })

      // Click Advanced tag (no videos have this tag)
      const advancedTag = screen.getByText('Advanced').closest('button')
      await user.click(advancedTag!)

      // Force re-render
      rerender(
        <QueryClientProvider client={queryClient}>
          <VideosPage listId="list-123" onBack={vi.fn()} />
        </QueryClientProvider>
      )

      // Should show empty state message
      await waitFor(() => {
        expect(screen.getByText(/Keine Videos gefunden/i)).toBeInTheDocument()
      })

      // Filter status should still show
      expect(screen.getByText(/Gefiltert nach: Advanced/)).toBeInTheDocument()
    })
  })
})
