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

interface ConfirmDeleteModalProps {
  open: boolean
  videoTitle: string | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

export const ConfirmDeleteModal = ({
  open,
  videoTitle,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDeleteModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Video löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie das Video "{videoTitle}" wirklich löschen? Diese Aktion kann nicht
            rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={(e) => {
                // WICHTIG: preventDefault verhindert dass AlertDialog automatisch schließt
                // Wir wollen erst die Mutation abschließen (mit isLoading state) bevor Modal schließt
                // Modal wird manuell geschlossen in onSuccess callback der Mutation
                e.preventDefault()
                onConfirm()
              }}
              disabled={isLoading}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            >
              {isLoading ? 'Löschen...' : 'Löschen'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
