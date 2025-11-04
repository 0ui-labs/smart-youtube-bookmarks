import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoGrid } from './VideoGrid'
import type { VideoResponse } from '@/types/video'
import type { GridColumnCount } from '@/stores/tableSettingsStore'

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
      <VideoGrid videos={mockVideos} gridColumns={3} onVideoClick={vi.fn()} onDelete={vi.fn()} />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid')
    expect(grid).toHaveClass('grid-cols-1')
    expect(grid).toHaveClass('md:grid-cols-2')
    expect(grid).toHaveClass('lg:grid-cols-3')
  })

  // REF MCP #6: Responsive gap spacing
  it('uses responsive gap spacing (gap-4 on mobile, gap-6 on desktop)', () => {
    const { container } = render(
      <VideoGrid videos={mockVideos} gridColumns={3} onVideoClick={vi.fn()} onDelete={vi.fn()} />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('gap-4')
    expect(grid).toHaveClass('md:gap-6')
  })

  it('renders VideoCard for each video', () => {
    render(<VideoGrid videos={mockVideos} gridColumns={3} onVideoClick={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.getByText('Video 2')).toBeInTheDocument()
  })

  // REF MCP #5: Enhanced empty state
  it('shows enhanced empty state when no videos', () => {
    const { container } = render(
      <VideoGrid videos={[]} gridColumns={3} onVideoClick={vi.fn()} onDelete={vi.fn()} />
    )

    expect(screen.getByText('Keine Videos im Grid')).toBeInTheDocument()
    expect(screen.getByText(/Füge Videos hinzu/i)).toBeInTheDocument()

    // Should have icon (SVG with aria-hidden)
    const icon = container.querySelector('svg[aria-hidden="true"]')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('lucide-layout-grid')
  })
})

describe('grid column configuration', () => {
  const mockVideos: VideoResponse[] = [
    {
      id: '1',
      youtube_id: 'dQw4w9WgXcQ',
      title: 'Test Video 1',
      thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
      duration: 180,
      channel_name: 'Test Channel',
      published_at: '2024-01-01T00:00:00Z',
      tags: [],
      list_id: 'list-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ]

  it('applies correct grid classes for 2 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={2}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const grid = container.querySelector('.video-grid')

    // REF IMPROVEMENT #3: Use both toHaveClass and toContain for robust testing
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2')

    const classes = grid?.className || ''
    expect(classes).toContain('grid-cols-1')
    expect(classes).toContain('md:grid-cols-2')
    expect(classes).not.toContain('lg:grid-cols') // No lg: breakpoint for 2 cols
  })

  it('applies correct grid classes for 3 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={3}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')

    const classes = grid?.className || ''
    expect(classes).toContain('grid-cols-1')
    expect(classes).toContain('md:grid-cols-2')
    expect(classes).toContain('lg:grid-cols-3')
  })

  it('applies correct grid classes for 4 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={4}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')

    const classes = grid?.className || ''
    expect(classes).toContain('grid-cols-1')
    expect(classes).toContain('md:grid-cols-2')
    expect(classes).toContain('lg:grid-cols-4')
  })

  it('applies correct grid classes for 5 columns (REF Improvement #2: md:grid-cols-2)', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={5}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const grid = container.querySelector('.video-grid')

    // REF IMPROVEMENT #2: 5 cols now uses md:grid-cols-2 (not 3) for better Tablet UX
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-5')

    const classes = grid?.className || ''
    expect(classes).toContain('grid-cols-1')
    expect(classes).toContain('md:grid-cols-2') // Tablet: 2 cols (not 3)
    expect(classes).toContain('lg:grid-cols-5')
    expect(classes).not.toContain('md:grid-cols-3') // Verify NOT 3 cols on tablet
  })

  it('renders empty state correctly regardless of gridColumns value', () => {
    const { container } = render(
      <VideoGrid
        videos={[]}
        gridColumns={5}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Keine Videos im Grid')).toBeInTheDocument()
    // Empty state should not have grid classes
    const emptyState = container.querySelector('.flex.flex-col')
    expect(emptyState).not.toHaveClass('video-grid')
  })
})
