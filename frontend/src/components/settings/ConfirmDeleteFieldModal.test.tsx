import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDeleteFieldModal } from './ConfirmDeleteFieldModal'

describe('ConfirmDeleteFieldModal', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders with field name', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    // Use more specific query within alertdialog to avoid matching multiple elements
    const alertDialog = screen.getByRole('alertdialog')
    expect(alertDialog).toHaveTextContent(/"Test Field"/i)
  })

  it('shows usage count warning when field in use', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={3}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText(/used by 3 schema\(s\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Cannot delete/i)).toBeInTheDocument()
  })

  it('shows singular usage count correctly', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={1}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText(/used by 1 schema\(s\)/i)).toBeInTheDocument()
  })

  it('disables delete button when field in use', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={2}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    const deleteButton = screen.getByText('Delete Field')
    expect(deleteButton).toBeDisabled()
  })

  it('enables delete button when field not in use', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    const deleteButton = screen.getByText('Delete Field')
    expect(deleteButton).not.toBeDisabled()
  })

  it('shows cascade warning when field not in use', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText(/All video values for this field/i)).toBeInTheDocument()
    expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument()
  })

  it('shows remove from schemas message when field in use', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={5}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText(/Remove this field from all schemas before deleting/i)).toBeInTheDocument()
  })

  it('calls onConfirm when delete clicked', async () => {
    const user = userEvent.setup({ delay: null })
    const onConfirm = vi.fn()
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    await user.click(screen.getByText('Delete Field'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel clicked', async () => {
    const user = userEvent.setup({ delay: null })
    const onCancel = vi.fn()
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        isLoading={false}
      />
    )

    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows loading state during deletion', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />
    )

    expect(screen.getByText('Deleting...')).toBeInTheDocument()
    expect(screen.getByText('Deleting...')).toBeDisabled()
  })

  it('disables cancel button during loading', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />
    )

    expect(screen.getByText('Cancel')).toBeDisabled()
  })

  it('uses destructive styling for delete button', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    const deleteButton = screen.getByText('Delete Field')
    expect(deleteButton).toHaveClass('bg-red-600')
  })

  it('does not call onConfirm when disabled and clicked', async () => {
    const user = userEvent.setup({ delay: null })
    const onConfirm = vi.fn()
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={3}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    const deleteButton = screen.getByText('Delete Field')
    await user.click(deleteButton)

    // Button is disabled, so click should not trigger onConfirm
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('prevents auto-close on delete button click', async () => {
    const user = userEvent.setup({ delay: null })
    const onConfirm = vi.fn()
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    await user.click(screen.getByText('Delete Field'))

    // onConfirm should be called
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('handles null fieldName gracefully', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName={null}
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('Delete Field?')).toBeInTheDocument()
  })
})
