import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoGrid } from './VideoGrid'
import type { VideoResponse } from '@/types/video'

const mockVideos: VideoResponse[] = [
  {
    id: 'video-1',
    youtube_id: 'video1',
    title: 'Video 1',
    channel_name: 'Channel 1',
    duration: 180,
    thumbnail_url: 'https://example.com/1.jpg',
    published_at: '2025-01-01',
    tags: [],
    list_id: 'list-1',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  },
  {
    id: 'video-2',
    youtube_id: 'video2',
    title: 'Video 2',
    channel_name: 'Channel 2',
    duration: 240,
    thumbnail_url: 'https://example.com/2.jpg',
    published_at: '2025-01-02',
    tags: [],
    list_id: 'list-1',
    created_at: '2025-01-02',
    updated_at: '2025-01-02',
  },
]

describe('VideoGrid', () => {
  it('renders grid with responsive columns', () => {
    const { container } = render(
      <VideoGrid videos={mockVideos} onVideoClick={vi.fn()} onDelete={vi.fn()} />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid')
    expect(grid).toHaveClass('grid-cols-2')
    expect(grid).toHaveClass('md:grid-cols-3')
    expect(grid).toHaveClass('lg:grid-cols-4')
  })

  // REF MCP #6: Responsive gap spacing
  it('uses responsive gap spacing (gap-4 on mobile, gap-6 on desktop)', () => {
    const { container } = render(
      <VideoGrid videos={mockVideos} onVideoClick={vi.fn()} onDelete={vi.fn()} />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('gap-4')
    expect(grid).toHaveClass('md:gap-6')
  })

  it('renders VideoCard for each video', () => {
    render(<VideoGrid videos={mockVideos} onVideoClick={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.getByText('Video 2')).toBeInTheDocument()
  })

  // REF MCP #5: Enhanced empty state
  it('shows enhanced empty state when no videos', () => {
    const { container } = render(
      <VideoGrid videos={[]} onVideoClick={vi.fn()} onDelete={vi.fn()} />
    )

    expect(screen.getByText('Keine Videos im Grid')).toBeInTheDocument()
    expect(screen.getByText(/Füge Videos hinzu/i)).toBeInTheDocument()

    // Should have icon (SVG with aria-hidden)
    const icon = container.querySelector('svg[aria-hidden="true"]')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('lucide-layout-grid')
  })
})
