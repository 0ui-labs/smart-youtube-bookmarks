import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagNavigation } from './TagNavigation'
import type { Tag } from '@/types/tag'

const mockTags: Tag[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Python',
    color: '#3B82F6',
    user_id: '00000000-0000-0000-0000-000000000100',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Tutorial',
    color: null,
    user_id: '00000000-0000-0000-0000-000000000100',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'JavaScript',
    color: '#F7DF1E',
    user_id: '00000000-0000-0000-0000-000000000100',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
]

describe('TagNavigation', () => {
  it('renders header with title', () => {
    render(
      <TagNavigation
        tags={[]}
        selectedTagIds={[]}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    )

    expect(screen.getByText('Tags')).toBeInTheDocument()
  })

  it('renders plus icon button with aria-label', () => {
    render(
      <TagNavigation
        tags={[]}
        selectedTagIds={[]}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    )

    const button = screen.getByRole('button', { name: /neuen tag erstellen/i })
    expect(button).toBeInTheDocument()
  })

  it('renders all tags with names', () => {
    render(
      <TagNavigation
        tags={mockTags}
        selectedTagIds={[]}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    )

    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Tutorial')).toBeInTheDocument()
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
  })

  it('calls onTagSelect when tag is clicked', () => {
    const onTagSelect = vi.fn()

    render(
      <TagNavigation
        tags={mockTags}
        selectedTagIds={[]}
        onTagSelect={onTagSelect}
        onTagCreate={() => {}}
      />
    )

    const pythonButton = screen.getByRole('button', { name: /python auswählen/i })
    fireEvent.click(pythonButton)

    expect(onTagSelect).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001')
    expect(onTagSelect).toHaveBeenCalledTimes(1)
  })

  it('calls onTagCreate when plus icon is clicked', () => {
    const onTagCreate = vi.fn()

    render(
      <TagNavigation
        tags={mockTags}
        selectedTagIds={[]}
        onTagSelect={() => {}}
        onTagCreate={onTagCreate}
      />
    )

    const createButton = screen.getByRole('button', { name: /neuen tag erstellen/i })
    fireEvent.click(createButton)

    expect(onTagCreate).toHaveBeenCalledTimes(1)
  })

  it('shows selected state for selected tags with aria-pressed', () => {
    render(
      <TagNavigation
        tags={mockTags}
        selectedTagIds={['00000000-0000-0000-0000-000000000001']}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    )

    const pythonButton = screen.getByRole('button', { name: /python abwählen/i })
    expect(pythonButton).toHaveClass('bg-accent')
    expect(pythonButton).toHaveAttribute('aria-pressed', 'true')

    const tutorialButton = screen.getByRole('button', { name: /tutorial auswählen/i })
    expect(tutorialButton).not.toHaveClass('bg-accent')
    expect(tutorialButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows multiple selected tags', () => {
    render(
      <TagNavigation
        tags={mockTags}
        selectedTagIds={[
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000003',
        ]}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    )

    const pythonButton = screen.getByRole('button', { name: /python abwählen/i })
    const jsButton = screen.getByRole('button', { name: /javascript abwählen/i })
    const tutorialButton = screen.getByRole('button', { name: /tutorial auswählen/i })

    expect(pythonButton).toHaveClass('bg-accent')
    expect(pythonButton).toHaveAttribute('aria-pressed', 'true')
    expect(jsButton).toHaveClass('bg-accent')
    expect(jsButton).toHaveAttribute('aria-pressed', 'true')
    expect(tutorialButton).not.toHaveClass('bg-accent')
    expect(tutorialButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders color indicator for tags with color', () => {
    const { container } = render(
      <TagNavigation
        tags={mockTags}
        selectedTagIds={[]}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    )

    // Python has color #3B82F6
    const pythonButton = screen.getByRole('button', { name: /python auswählen/i })
    const colorIndicator = pythonButton.querySelector('[style*="background-color"]')
    expect(colorIndicator).toBeInTheDocument()
    expect(colorIndicator).toHaveStyle({ backgroundColor: '#3B82F6' })

    // Tutorial has no color
    const tutorialButton = screen.getByRole('button', { name: /tutorial auswählen/i })
    const noColorIndicator = tutorialButton.querySelector('[style*="background-color"]')
    expect(noColorIndicator).not.toBeInTheDocument()
  })

  it('handles empty tags array', () => {
    render(
      <TagNavigation
        tags={[]}
        selectedTagIds={[]}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    )

    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /auswählen/i })).not.toBeInTheDocument()
  })

  it('has proper keyboard navigation with role="button"', () => {
    render(
      <TagNavigation
        tags={[mockTags[0]]}
        selectedTagIds={[]}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    )

    const tagButton = screen.getByRole('button', { name: /python auswählen/i })
    expect(tagButton).toHaveAttribute('role', 'button')
  })

  it('color indicator has aria-hidden for accessibility', () => {
    const { container } = render(
      <TagNavigation
        tags={[mockTags[0]]}
        selectedTagIds={[]}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    )

    const colorIndicator = container.querySelector('[style*="background-color"]')
    expect(colorIndicator).toHaveAttribute('aria-hidden', 'true')
  })
})
