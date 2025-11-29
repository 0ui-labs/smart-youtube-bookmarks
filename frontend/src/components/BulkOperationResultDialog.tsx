// frontend/src/components/BulkOperationResultDialog.tsx

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BulkApplySchemaResponse } from "@/types/bulk";

export interface BulkOperationResultDialogProps {
  open: boolean;
  result: BulkApplySchemaResponse | null;
  onClose: () => void;
  onRetry?: (failedTagIds: string[]) => void;
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
  if (!result) return null;

  const failures = result.results.filter((r) => !r.success);
  const hasFailures = failures.length > 0;

  const handleRetry = () => {
    if (onRetry) {
      onRetry(failures.map((f) => f.tagId));
      onClose();
    }
  };

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {hasFailures
              ? "Schema teilweise angewendet"
              : "Schema erfolgreich angewendet"}
          </DialogTitle>
          <DialogDescription>
            {result.successCount} von {result.totalRequested} Tags erfolgreich
            aktualisiert
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Success Summary */}
          {result.successCount > 0 && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-green-900 text-sm">
                ✓ {result.successCount}{" "}
                {result.successCount === 1 ? "Tag wurde" : "Tags wurden"}{" "}
                erfolgreich aktualisiert.
              </p>
            </div>
          )}

          {/* Failure Details */}
          {hasFailures && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-2 font-medium text-red-900 text-sm">
                ✗ {result.failureCount}{" "}
                {result.failureCount === 1 ? "Tag konnte" : "Tags konnten"}{" "}
                nicht aktualisiert werden:
              </p>
              <ul className="max-h-[200px] space-y-1 overflow-y-auto">
                {failures.map((failure) => (
                  <li className="text-red-800 text-sm" key={failure.tagId}>
                    <strong>{failure.tagName}:</strong> {failure.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          {hasFailures && onRetry && (
            <Button onClick={handleRetry} variant="outline">
              Fehlgeschlagene wiederholen
            </Button>
          )}
          <Button onClick={onClose}>{hasFailures ? "Schließen" : "OK"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
