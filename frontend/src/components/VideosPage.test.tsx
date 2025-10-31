import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VideosPage } from './VideosPage'
import type { VideoResponse } from '@/types/video'

// Mock hooks
vi.mock('@/hooks/useVideos', () => ({
  useVideos: () => ({
    data: mockVideos,
    isLoading: false,
    error: null,
  }),
  useCreateVideo: () => ({ mutate: vi.fn(), isPending: false, mutateAsync: vi.fn() }),
  useDeleteVideo: () => ({ mutate: vi.fn() }),
  exportVideosCSV: vi.fn(),
}))

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    jobProgress: new Map(),
    reconnecting: false,
    historyError: null,
  }),
}))

const mockVideos: VideoResponse[] = [
  {
    id: 'video-1',
    list_id: 'list-1',
    youtube_id: 'dQw4w9WgXcQ',
    title: 'Python Tutorial for Beginners',
    channel: 'Tech Academy',
    thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    duration: 930, // 15:30
    published_at: '2024-01-15T10:00:00Z',
    processing_status: 'completed',
    created_at: '2024-01-20T12:00:00Z',
    updated_at: '2024-01-20T12:00:00Z',
  },
  {
    id: 'video-2',
    list_id: 'list-1',
    youtube_id: 'jNQXAC9IVRw',
    title: null,
    channel: null,
    thumbnail_url: null,
    duration: null,
    published_at: null,
    processing_status: 'pending',
    created_at: '2024-01-21T14:00:00Z',
    updated_at: '2024-01-21T14:00:00Z',
  },
]

describe('VideosPage - Metadata Display', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <VideosPage listId="list-1" onBack={() => {}} />
      </QueryClientProvider>
    )

  it('renders video thumbnails with aspect ratio', () => {
    renderComponent()
    const thumbnail = screen.getByAltText('Python Tutorial for Beginners')
    expect(thumbnail).toBeInTheDocument()
    expect(thumbnail).toHaveClass('aspect-video')
    expect(thumbnail).toHaveAttribute('src', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('shows placeholder when thumbnail_url is null', () => {
    renderComponent()
    // Placeholder for video without thumbnail
    const placeholders = document.querySelectorAll('.aspect-video.bg-gray-100')
    expect(placeholders.length).toBeGreaterThan(0)
  })

  it('displays video title and channel', () => {
    renderComponent()
    expect(screen.getByText('Python Tutorial for Beginners')).toBeInTheDocument()
    expect(screen.getByText('Tech Academy')).toBeInTheDocument()
  })

  it('displays fallback title when title is null', () => {
    renderComponent()
    expect(screen.getByText('Video jNQXAC9IVRw')).toBeInTheDocument()
  })

  it('formats duration correctly', () => {
    renderComponent()
    expect(screen.getByText('15:30')).toBeInTheDocument()
  })

  it('shows dash when duration is null', () => {
    renderComponent()
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders YouTube links with correct attributes', () => {
    renderComponent()
    const link = screen.getByRole('link', { name: /Python Tutorial/i })
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('images have lazy loading enabled', () => {
    renderComponent()
    const thumbnail = screen.getByAltText('Python Tutorial for Beginners')
    expect(thumbnail).toHaveAttribute('loading', 'lazy')
  })
})
