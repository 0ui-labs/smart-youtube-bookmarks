/**
 * CategoryChangeWarning Component
 * Phase 5 Step 5.4-5.6
 *
 * Warning dialog shown when changing a video's category.
 * Informs user about:
 * - Fields that will be backed up (category-specific)
 * - Fields that will persist (workspace fields)
 * - Option to restore previous backup if available
 */
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertTriangle, Sparkles } from 'lucide-react'
import type { Tag } from '@/types/tag'

interface FieldValue {
  id: string
  field_id: string
  value: string | number | boolean | null
  field: {
    id: string
    name: string
    field_type: string
  }
}

export interface CategoryChangeWarningProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  oldCategory: Tag | null
  newCategory: Tag | null
  fieldValuesToBackup: FieldValue[]
  fieldValuesThatPersist: FieldValue[]
  hasBackup: boolean
  onConfirm: (restoreBackup: boolean) => void
  onCancel: () => void
}

/**
 * Format a field value for display
 */
function formatFieldValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein'
  return String(value)
}

export function CategoryChangeWarning({
  open,
  onOpenChange,
  oldCategory,
  newCategory,
  fieldValuesToBackup,
  fieldValuesThatPersist,
  hasBackup,
  onConfirm,
  onCancel,
}: CategoryChangeWarningProps) {
  const [restoreBackup, setRestoreBackup] = useState(false)

  // Determine dialog title based on operation
  const isRemoving = newCategory === null
  const title = isRemoving ? 'Kategorie entfernen' : 'Kategorie ändern'

  const handleConfirm = () => {
    onConfirm(restoreBackup)
    setRestoreBackup(false) // Reset state
  }

  const handleCancel = () => {
    setRestoreBackup(false) // Reset state
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              data-testid="warning-icon"
              className="h-5 w-5 text-amber-500"
            />
            {title}
          </DialogTitle>
          <DialogDescription>
            {oldCategory && newCategory && (
              <>
                Von <strong>{oldCategory.name}</strong> zu <strong>{newCategory.name}</strong> wechseln.
              </>
            )}
            {oldCategory && !newCategory && (
              <>
                <strong>{oldCategory.name}</strong> wird entfernt.
              </>
            )}
            {!oldCategory && newCategory && (
              <>
                <strong>{newCategory.name}</strong> wird zugewiesen.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Fields that will be backed up */}
          {fieldValuesToBackup.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">
                Folgende Werte werden gesichert:
              </p>
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                {fieldValuesToBackup.map(fv => (
                  <div key={fv.id} className="text-sm flex justify-between">
                    <span className="text-muted-foreground">{fv.field.name}</span>
                    <span>{formatFieldValue(fv.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fields that will persist (workspace fields) */}
          {fieldValuesThatPersist.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">
                Die folgenden Felder bleiben:
              </p>
              <div className="rounded-lg border bg-green-50 p-3 space-y-1">
                {fieldValuesThatPersist.map(fv => (
                  <div key={fv.id} className="text-sm flex justify-between text-green-900">
                    <span>{fv.field.name}</span>
                    <span>{formatFieldValue(fv.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Restore option when backup exists */}
          {hasBackup && (
            <>
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-4">
                <Sparkles className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Gesicherte Werte gefunden!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Du hattest dieses Video schon mal als &quot;{newCategory?.name}&quot; kategorisiert.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="restore-backup"
                  checked={restoreBackup}
                  onCheckedChange={(checked) => setRestoreBackup(checked === true)}
                  aria-label="Gesicherte Werte wiederherstellen"
                />
                <label
                  htmlFor="restore-backup"
                  className="text-sm cursor-pointer"
                >
                  Gesicherte Werte wiederherstellen
                </label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm}>
            {isRemoving ? 'Kategorie entfernen' : 'Kategorie ändern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
