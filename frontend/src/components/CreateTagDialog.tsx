/**
 * CreateTagDialog Component
 *
 * Simplified dialog for creating categories and labels.
 * Schema/field management is hidden from the user - they add fields
 * after creating the category via the edit dialog.
 *
 * @example
 * ```tsx
 * <CreateTagDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   listId={listId}
 * />
 * ```
 */
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useCreateTag } from '@/hooks/useTags'

interface CreateTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listId: string
}

export const CreateTagDialog = ({ open, onOpenChange, listId: _listId }: CreateTagDialogProps) => {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6') // Default blue
  const [error, setError] = useState<string | null>(null)

  const createTag = useCreateTag()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      setError('Bitte gib einen Namen ein')
      return
    }

    if (name.length > 50) {
      setError('Name darf maximal 50 Zeichen lang sein')
      return
    }

    try {
      await createTag.mutateAsync({
        name: name.trim(),
        color: color || undefined,
        is_video_type: true, // Always category
      })

      // Success - reset form and close dialog
      setName('')
      setColor('#3B82F6')
      setError(null)
      onOpenChange(false)
    } catch (err: any) {
      // Handle errors
      if (err.response?.status === 409) {
        setError('Eine Kategorie mit diesem Namen existiert bereits')
      } else {
        setError('Fehler beim Erstellen. Bitte versuche es erneut.')
      }
    }
  }

  const handleCancel = () => {
    setName('')
    setColor('#3B82F6')
    setError(null)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Neue Kategorie erstellen</AlertDialogTitle>
          <AlertDialogDescription>
            Kategorien helfen dir Videos zu organisieren. Jedes Video kann nur eine Kategorie haben.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Name Input */}
            <div>
              <label
                htmlFor="tag-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Name *
              </label>
              <input
                id="tag-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Tutorial, Review, Vlog"
                className={`w-full px-3 py-2 border ${
                  error ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                autoFocus
                maxLength={50}
              />
              {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
              )}
            </div>

            {/* Color Picker */}
            <div>
              <label
                htmlFor="tag-color"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Farbe
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="tag-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-20 rounded cursor-pointer border border-gray-300"
                />
                <span className="text-sm text-gray-600">{color}</span>
              </div>
            </div>

            {/* Hint about fields */}
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              Nach dem Erstellen kannst du über "Bearbeiten" eigene Felder hinzufügen
              (z.B. Bewertung, Notizen, Kalorien).
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} type="button">
              Abbrechen
            </AlertDialogCancel>
            <Button
              type="submit"
              disabled={createTag.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createTag.isPending ? 'Wird erstellt...' : 'Erstellen'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
