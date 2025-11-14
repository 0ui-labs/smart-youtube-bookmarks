// frontend/src/components/BulkOperationResultDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { BulkApplySchemaResponse } from '@/types/bulk'

export interface BulkOperationResultDialogProps {
  open: boolean
  result: BulkApplySchemaResponse | null
  onClose: () => void
  onRetry?: (failedTagIds: string[]) => void
}

/**
 * BulkOperationResultDialog Component - Display bulk operation results
 *
 * Shows:
 * - Success count and failure count
 * - List of failed tags with error messages
 * - Optional retry button for failed items
 *
 * REF MCP Pattern: Error display with per-item details and retry option
 *
 * @example
 * <BulkOperationResultDialog
 *   open={showResults}
 *   result={bulkApply.data}
 *   onClose={() => setShowResults(false)}
 *   onRetry={(failedIds) => bulkApply.mutate({ tagIds: failedIds, schemaId })}
 * />
 */
export function BulkOperationResultDialog({
  open,
  result,
  onClose,
  onRetry,
}: BulkOperationResultDialogProps) {
  if (!result) return null

  const failures = result.results.filter(r => !r.success)
  const hasFailures = failures.length > 0

  const handleRetry = () => {
    if (onRetry) {
      onRetry(failures.map(f => f.tagId))
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {hasFailures ? 'Schema teilweise angewendet' : 'Schema erfolgreich angewendet'}
          </DialogTitle>
          <DialogDescription>
            {result.successCount} von {result.totalRequested} Tags erfolgreich aktualisiert
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Success Summary */}
          {result.successCount > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-900">
                ✓ {result.successCount} {result.successCount === 1 ? 'Tag wurde' : 'Tags wurden'} erfolgreich aktualisiert.
              </p>
            </div>
          )}

          {/* Failure Details */}
          {hasFailures && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-900 mb-2">
                ✗ {result.failureCount} {result.failureCount === 1 ? 'Tag konnte' : 'Tags konnten'} nicht aktualisiert werden:
              </p>
              <ul className="space-y-1 max-h-[200px] overflow-y-auto">
                {failures.map(failure => (
                  <li key={failure.tagId} className="text-sm text-red-800">
                    <strong>{failure.tagName}:</strong> {failure.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          {hasFailures && onRetry && (
            <Button variant="outline" onClick={handleRetry}>
              Fehlgeschlagene wiederholen
            </Button>
          )}
          <Button onClick={onClose}>
            {hasFailures ? 'Schließen' : 'OK'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
