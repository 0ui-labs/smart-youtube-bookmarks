import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

describe('ConfirmDeleteModal', () => {
  it('renders modal with video title', () => {
    render(
      <ConfirmDeleteModal
        open={true}
        videoTitle="Test Video Title"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('Video löschen?')).toBeInTheDocument()
    expect(screen.getByText(/Test Video Title/)).toBeInTheDocument()
    expect(screen.getByText(/Diese Aktion kann nicht rückgängig gemacht werden/)).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    render(
      <ConfirmDeleteModal
        open={false}
        videoTitle="Test Video"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.queryByText('Video löschen?')).not.toBeInTheDocument()
  })
})
