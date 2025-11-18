import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
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

  it('calls onConfirm when Löschen button clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <ConfirmDeleteModal
        open={true}
        videoTitle="Test Video"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /löschen/i })
    await user.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Abbrechen button clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <ConfirmDeleteModal
        open={true}
        videoTitle="Test Video"
        onConfirm={vi.fn()}
        onCancel={onCancel}
        isLoading={false}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /abbrechen/i })
    await user.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables buttons when isLoading is true', () => {
    render(
      <ConfirmDeleteModal
        open={true}
        videoTitle="Test Video"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /löschen/i })
    const cancelButton = screen.getByRole('button', { name: /abbrechen/i })

    expect(deleteButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
    expect(screen.getByText('Löschen...')).toBeInTheDocument()
  })
})
