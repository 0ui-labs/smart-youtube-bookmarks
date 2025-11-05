import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VideoCard } from './VideoCard'
import type { VideoResponse } from '@/types/video'

const mockVideo: VideoResponse = {
  id: 'video-123',
  youtube_id: 'dQw4w9WgXcQ',
  title: 'Test Video Title That Is Very Long And Should Be Truncated',
  channel: 'Test Channel',
  duration: 240, // 4 minutes
  thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  published_at: '2025-01-01T00:00:00Z',
  tags: [
    { id: 'tag-1', name: 'Python', color: '#3B82F6' },
    { id: 'tag-2', name: 'Tutorial', color: '#10B981' },
  ],
  list_id: 'list-123',
  processing_status: 'completed',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

describe('VideoCard', () => {
  it('renders video thumbnail with VideoThumbnail component', () => {
    render(<VideoCard video={mockVideo} />)

    const img = screen.getByRole('img', { name: /Test Video/i })
    expect(img).toBeInTheDocument()
  })

  it('renders video title truncated to 2 lines', () => {
    render(<VideoCard video={mockVideo} />)

    const title = screen.getByText(/Test Video Title/)
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('line-clamp-2')
  })

  it('renders channel name in muted color', () => {
    render(<VideoCard video={mockVideo} />)

    const channel = screen.getByText('Test Channel')
    expect(channel).toHaveClass('text-muted-foreground')
  })

  it('renders formatted duration with enhanced overlay', () => {
    render(<VideoCard video={mockVideo} />)

    const duration = screen.getByText('4:00')
    expect(duration).toBeInTheDocument()
    // REF MCP #4: Duration overlay with shadow and border for readability
    expect(duration).toHaveClass('shadow-lg')
    expect(duration).toHaveClass('border')
  })

  it('renders tags as chips with color indicators', () => {
    render(<VideoCard video={mockVideo} />)

    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Tutorial')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<VideoCard video={mockVideo} onClick={onClick} />)

    const card = screen.getByRole('button', { name: /Test Video/i })
    await user.click(card)

    expect(onClick).toHaveBeenCalledWith(mockVideo)
  })

  it('shows hover effects on card hover', () => {
    render(<VideoCard video={mockVideo} />)

    const card = screen.getByRole('button', { name: /Test Video/i })
    expect(card).toHaveClass('hover:shadow-lg')
  })

  // REF MCP #3: Keyboard Navigation Tests (WCAG 2.1)
  it('responds to Enter key press', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<VideoCard video={mockVideo} onClick={onClick} />)

    const card = screen.getByRole('button', { name: /Test Video/i })
    card.focus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledWith(mockVideo)
  })

  it('responds to Space key press', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<VideoCard video={mockVideo} onClick={onClick} />)

    const card = screen.getByRole('button', { name: /Test Video/i })
    card.focus()
    await user.keyboard(' ')

    expect(onClick).toHaveBeenCalledWith(mockVideo)
  })

  it('has aria-label with channel name for screen readers', () => {
    render(<VideoCard video={mockVideo} />)

    const card = screen.getByRole('button', {
      name: 'Video: Test Video Title That Is Very Long And Should Be Truncated von Test Channel'
    })
    expect(card).toBeInTheDocument()
  })

  describe('Three-dot menu', () => {
    it('renders three-dot menu button', () => {
      render(<VideoCard video={mockVideo} />)

      const menuButton = screen.getByLabelText('Aktionen')
      expect(menuButton).toBeInTheDocument()
    })

    it('calls onDelete when delete menu item clicked', async () => {
      const onDelete = vi.fn()
      const user = userEvent.setup()

      render(<VideoCard video={mockVideo} onDelete={onDelete} />)

      // Open dropdown
      const menuButton = screen.getByLabelText('Aktionen')
      await user.click(menuButton)

      // Click delete
      const deleteItem = screen.getByText('Löschen')
      await user.click(deleteItem)

      expect(onDelete).toHaveBeenCalledTimes(1)
      expect(onDelete).toHaveBeenCalledWith(mockVideo)
    })

    it('prevents video click when menu button clicked', async () => {
      const onClick = vi.fn()
      const onDelete = vi.fn()
      const user = userEvent.setup()

      render(<VideoCard video={mockVideo} onClick={onClick} onDelete={onDelete} />)

      // Click menu button
      const menuButton = screen.getByLabelText('Aktionen')
      await user.click(menuButton)

      // Video onClick should NOT be called
      expect(onClick).not.toHaveBeenCalled()
    })
  })
})
