// frontend/src/components/settings/ConfirmDeleteFieldModal.tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDeleteFieldModalProps {
  open: boolean
  fieldName: string | null
  usageCount: number
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

/**
 * Confirmation modal for deleting custom fields
 *
 * Features:
 * - Shows usage count warning ("Used by N schema(s)")
 * - Blocks deletion if field in use (button disabled + explanation)
 * - Warns about cascade deletion of video field values
 * - Follows ConfirmDeleteModal pattern from Task #29
 *
 * Behavior:
 * - usageCount > 0: Delete button DISABLED, shows error message
 * - usageCount === 0: Delete button ENABLED, shows cascade warning
 *
 * Defense-in-Depth:
 * - Frontend check (usageCount > 0 disables button)
 * - Backend check (409 Conflict if field in use)
 */
export const ConfirmDeleteFieldModal = ({
  open,
  fieldName,
  usageCount,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDeleteFieldModalProps) => {
  const isInUse = usageCount > 0

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Field?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete the field{' '}
                <strong>"{fieldName}"</strong>?
              </p>

              {isInUse ? (
                <div className="rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-900 font-semibold">
                    ⚠️ Cannot delete: This field is used by {usageCount} schema(s)
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Remove this field from all schemas before deleting.
                  </p>
                </div>
              ) : (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-sm text-yellow-900">
                    <strong>Warning:</strong> This will permanently delete:
                  </p>
                  <ul className="text-sm text-yellow-800 mt-2 ml-4 list-disc">
                    <li>The field definition</li>
                    <li>All video values for this field</li>
                  </ul>
                  <p className="text-sm text-yellow-900 mt-2">
                    This action cannot be undone.
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.preventDefault() // CRITICAL: Prevents auto-close during mutation
                onConfirm()
              }}
              disabled={isLoading || isInUse} // Disable if loading OR field in use
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            >
              {isLoading ? 'Deleting...' : 'Delete Field'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
