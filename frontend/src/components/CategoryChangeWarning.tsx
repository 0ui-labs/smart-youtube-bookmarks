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

import { AlertTriangle, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Tag } from "@/types/tag";

interface FieldValueInfo {
  id: string;
  fieldName: string;
  value: string | number | boolean | null;
}

export interface CategoryChangeWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldCategory: Tag | null;
  newCategory: Tag | null;
  fieldValuesToBackup: FieldValueInfo[];
  fieldValuesThatPersist: FieldValueInfo[];
  hasBackup: boolean;
  onConfirm: (restoreBackup: boolean) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Format a field value for display
 */
function formatFieldValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  return String(value);
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
  const [restoreBackup, setRestoreBackup] = useState(false);

  // Determine dialog title based on operation
  const isRemoving = newCategory === null;
  const title = isRemoving ? "Kategorie entfernen" : "Kategorie ändern";

  const handleConfirm = () => {
    onConfirm(restoreBackup);
    setRestoreBackup(false); // Reset state
  };

  const handleCancel = () => {
    setRestoreBackup(false); // Reset state
    onCancel();
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className="h-5 w-5 text-amber-500"
              data-testid="warning-icon"
            />
            {title}
          </DialogTitle>
          <DialogDescription>
            {oldCategory && newCategory && (
              <>
                Von <strong>{oldCategory.name}</strong> zu{" "}
                <strong>{newCategory.name}</strong> wechseln.
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
              <p className="mb-2 font-medium text-sm">
                Folgende Werte werden gesichert:
              </p>
              <div className="space-y-1 rounded-lg border bg-muted/50 p-3">
                {fieldValuesToBackup.map((fv) => (
                  <div className="flex justify-between text-sm" key={fv.id}>
                    <span className="text-muted-foreground">
                      {fv.fieldName}
                    </span>
                    <span>{formatFieldValue(fv.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fields that will persist (workspace fields) */}
          {fieldValuesThatPersist.length > 0 && (
            <div>
              <p className="mb-2 font-medium text-sm">
                Die folgenden Felder bleiben:
              </p>
              <div className="space-y-1 rounded-lg border bg-green-50 p-3 dark:bg-green-950/30">
                {fieldValuesThatPersist.map((fv) => (
                  <div
                    className="flex justify-between text-green-900 text-sm dark:text-green-100"
                    key={fv.id}
                  >
                    <span>{fv.fieldName}</span>
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
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                <div>
                  <p className="font-medium">Gesicherte Werte gefunden!</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Du hattest dieses Video schon mal als &quot;
                    {newCategory?.name}&quot; kategorisiert.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  aria-label="Gesicherte Werte wiederherstellen"
                  checked={restoreBackup}
                  id="restore-backup"
                  onCheckedChange={(checked) =>
                    setRestoreBackup(checked === true)
                  }
                />
                <label
                  className="cursor-pointer text-sm"
                  htmlFor="restore-backup"
                >
                  Gesicherte Werte wiederherstellen
                </label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleCancel} variant="outline">
            Abbrechen
          </Button>
          <Button onClick={handleConfirm}>
            {isRemoving ? "Kategorie entfernen" : "Kategorie ändern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
