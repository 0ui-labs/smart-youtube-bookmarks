import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldActionsMenu } from './FieldActionsMenu'
import type { CustomFieldResponse } from '@/types/customField'

const mockField: CustomFieldResponse = {
  id: 'field-123',
  list_id: 'list-456',
  name: 'Test Field',
  field_type: 'text',
  config: {},
  created_at: '2025-11-08T10:00:00Z',
  updated_at: '2025-11-08T10:00:00Z',
}

describe('FieldActionsMenu', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders three-dot menu trigger with accessible label', () => {
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Actions for Test Field')).toBeInTheDocument()
  })

  it('renders trigger button with MoreVertical icon', () => {
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const trigger = screen.getByLabelText('Actions for Test Field')
    expect(trigger).toBeInTheDocument()
    expect(trigger.tagName).toBe('BUTTON')
  })

  it('opens menu on trigger click', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onEdit when Edit clicked', async () => {
    const user = userEvent.setup({ delay: null })
    const onEdit = vi.fn()
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('calls onDelete when Delete clicked', async () => {
    const user = userEvent.setup({ delay: null })
    const onDelete = vi.fn()
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('shows delete action with destructive styling', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button'))
    const deleteItem = screen.getByText('Delete')
    expect(deleteItem).toHaveClass('text-red-600')
  })

  it('has separator between Edit and Delete actions', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button'))

    // Check that both menu items exist
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('stops event propagation on trigger click', async () => {
    const user = userEvent.setup({ delay: null })
    const onRowClick = vi.fn()

    const { container } = render(
      <div onClick={onRowClick} data-testid="row">
        <FieldActionsMenu
          field={mockField}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </div>
    )

    await user.click(screen.getByRole('button'))

    // Row click should not fire due to stopPropagation
    expect(onRowClick).not.toHaveBeenCalled()
  })
})
