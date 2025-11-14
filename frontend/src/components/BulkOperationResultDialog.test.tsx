// frontend/src/components/BulkOperationResultDialog.test.tsx

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkOperationResultDialog } from './BulkOperationResultDialog'
import type { BulkApplySchemaResponse } from '@/types/bulk'

afterEach(() => {
  vi.clearAllMocks()
})

describe('BulkOperationResultDialog', () => {
  it('renders success summary for 100% success', () => {
    const result: BulkApplySchemaResponse = {
      successCount: 3,
      failureCount: 0,
      totalRequested: 3,
      results: [
        { tagId: '1', tagName: 'Tag1', success: true },
        { tagId: '2', tagName: 'Tag2', success: true },
        { tagId: '3', tagName: 'Tag3', success: true }
      ]
    }

    render(<BulkOperationResultDialog open result={result} onClose={vi.fn()} />)

    // Should show success title
    expect(screen.getByText('Schema erfolgreich angewendet')).toBeInTheDocument()

    // Should show success summary
    expect(screen.getByText('3 von 3 Tags erfolgreich aktualisiert')).toBeInTheDocument()

    // Should show success message
    expect(screen.getByText(/✓ 3 Tags wurden erfolgreich aktualisiert/)).toBeInTheDocument()

    // Should NOT show failure section
    expect(screen.queryByText(/konnte nicht aktualisiert werden/)).not.toBeInTheDocument()

    // Should show "OK" button (not "Schließen")
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()

    // Should NOT show retry button
    expect(screen.queryByRole('button', { name: 'Fehlgeschlagene wiederholen' })).not.toBeInTheDocument()
  })

  it('renders partial failure summary with error list', () => {
    const result: BulkApplySchemaResponse = {
      successCount: 2,
      failureCount: 2,
      totalRequested: 4,
      results: [
        { tagId: '1', tagName: 'Success1', success: true },
        { tagId: '2', tagName: 'Success2', success: true },
        { tagId: '3', tagName: 'Failed1', success: false, error: 'Database error' },
        { tagId: '4', tagName: 'Failed2', success: false, error: 'Network timeout' }
      ]
    }

    render(<BulkOperationResultDialog open result={result} onClose={vi.fn()} />)

    // Should show partial success title
    expect(screen.getByText('Schema teilweise angewendet')).toBeInTheDocument()

    // Should show summary with both success and total
    expect(screen.getByText('2 von 4 Tags erfolgreich aktualisiert')).toBeInTheDocument()

    // Should show success section
    expect(screen.getByText(/✓ 2 Tags wurden erfolgreich aktualisiert/)).toBeInTheDocument()

    // Should show failure header
    expect(screen.getByText(/✗ 2 Tags konnten nicht aktualisiert werden:/)).toBeInTheDocument()

    // Should list failed tags with errors
    expect(screen.getByText('Failed1:', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Database error')).toBeInTheDocument()
    expect(screen.getByText('Failed2:', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Network timeout')).toBeInTheDocument()

    // Should show "Schließen" button (not "OK")
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument()
  })

  it('shows retry button only when onRetry prop is provided', () => {
    const result: BulkApplySchemaResponse = {
      successCount: 1,
      failureCount: 1,
      totalRequested: 2,
      results: [
        { tagId: '1', tagName: 'Success1', success: true },
        { tagId: '2', tagName: 'Failed1', success: false, error: 'Error' }
      ]
    }

    // Without onRetry prop
    const { rerender } = render(
      <BulkOperationResultDialog open result={result} onClose={vi.fn()} />
    )

    expect(screen.queryByRole('button', { name: 'Fehlgeschlagene wiederholen' })).not.toBeInTheDocument()

    // With onRetry prop
    rerender(
      <BulkOperationResultDialog open result={result} onClose={vi.fn()} onRetry={vi.fn()} />
    )

    expect(screen.getByRole('button', { name: 'Fehlgeschlagene wiederholen' })).toBeInTheDocument()
  })

  it('calls onRetry with failed tag IDs when retry button is clicked', async () => {
    const user = userEvent.setup({ delay: null })
    const onRetry = vi.fn()
    const onClose = vi.fn()

    const result: BulkApplySchemaResponse = {
      successCount: 1,
      failureCount: 2,
      totalRequested: 3,
      results: [
        { tagId: 'success-1', tagName: 'Success1', success: true },
        { tagId: 'failed-1', tagName: 'Failed1', success: false, error: 'Error 1' },
        { tagId: 'failed-2', tagName: 'Failed2', success: false, error: 'Error 2' }
      ]
    }

    render(
      <BulkOperationResultDialog
        open
        result={result}
        onClose={onClose}
        onRetry={onRetry}
      />
    )

    const retryButton = screen.getByRole('button', { name: 'Fehlgeschlagene wiederholen' })
    await user.click(retryButton)

    // Should call onRetry with array of failed tag IDs
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(['failed-1', 'failed-2'])

    // Should also close the dialog
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('handles empty/null result gracefully', () => {
    // With null result, component should return null
    const { container } = render(
      <BulkOperationResultDialog open result={null} onClose={vi.fn()} />
    )

    // Should render nothing
    expect(container.firstChild).toBeNull()
  })

  it('handles singular vs plural forms correctly', () => {
    // Test singular form (1 success)
    const singleSuccessResult: BulkApplySchemaResponse = {
      successCount: 1,
      failureCount: 0,
      totalRequested: 1,
      results: [
        { tagId: '1', tagName: 'Tag1', success: true }
      ]
    }

    const { rerender } = render(
      <BulkOperationResultDialog open result={singleSuccessResult} onClose={vi.fn()} />
    )

    // Should use singular "Tag wurde"
    expect(screen.getByText(/✓ 1 Tag wurde erfolgreich aktualisiert/)).toBeInTheDocument()

    // Test singular form (1 failure)
    const singleFailureResult: BulkApplySchemaResponse = {
      successCount: 0,
      failureCount: 1,
      totalRequested: 1,
      results: [
        { tagId: '1', tagName: 'Tag1', success: false, error: 'Error' }
      ]
    }

    rerender(
      <BulkOperationResultDialog open result={singleFailureResult} onClose={vi.fn()} />
    )

    // Should use singular "Tag konnte"
    expect(screen.getByText(/✗ 1 Tag konnte nicht aktualisiert werden:/)).toBeInTheDocument()
  })
})
