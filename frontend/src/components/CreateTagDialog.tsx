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
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCreateTag } from "@/hooks/useTags";

interface CreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
}

export const CreateTagDialog = ({
  open,
  onOpenChange,
  listId: _listId,
}: CreateTagDialogProps) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6"); // Default blue
  const [error, setError] = useState<string | null>(null);

  const createTag = useCreateTag();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      setError("Bitte gib einen Namen ein");
      return;
    }

    if (name.length > 50) {
      setError("Name darf maximal 50 Zeichen lang sein");
      return;
    }

    try {
      await createTag.mutateAsync({
        name: name.trim(),
        color: color || undefined,
        is_video_type: true, // Always category
      });

      // Success - reset form and close dialog
      setName("");
      setColor("#3B82F6");
      setError(null);
      onOpenChange(false);
    } catch (err: any) {
      // Handle errors
      if (err.response?.status === 409) {
        setError("Eine Kategorie mit diesem Namen existiert bereits");
      } else {
        setError("Fehler beim Erstellen. Bitte versuche es erneut.");
      }
    }
  };

  const handleCancel = () => {
    setName("");
    setColor("#3B82F6");
    setError(null);
    onOpenChange(false);
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Neue Kategorie erstellen</AlertDialogTitle>
          <AlertDialogDescription>
            Kategorien helfen dir Videos zu organisieren. Jedes Video kann nur
            eine Kategorie haben.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Name Input */}
            <div>
              <label
                className="mb-1 block font-medium text-gray-700 text-sm"
                htmlFor="tag-name"
              >
                Name *
              </label>
              <input
                autoFocus
                className={`w-full border px-3 py-2 ${
                  error ? "border-red-500" : "border-gray-300"
                } rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500`}
                id="tag-name"
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Tutorial, Review, Vlog"
                type="text"
                value={name}
              />
              {error && <p className="mt-1 text-red-600 text-sm">{error}</p>}
            </div>

            {/* Color Picker */}
            <div>
              <label
                className="mb-1 block font-medium text-gray-700 text-sm"
                htmlFor="tag-color"
              >
                Farbe
              </label>
              <div className="flex items-center gap-3">
                <input
                  className="h-10 w-20 cursor-pointer rounded border border-gray-300"
                  id="tag-color"
                  onChange={(e) => setColor(e.target.value)}
                  type="color"
                  value={color}
                />
                <span className="text-gray-600 text-sm">{color}</span>
              </div>
            </div>

            {/* Hint about fields */}
            <p className="rounded-lg bg-muted/50 p-3 text-muted-foreground text-sm">
              Nach dem Erstellen kannst du über "Bearbeiten" eigene Felder
              hinzufügen (z.B. Bewertung, Notizen, Kalorien).
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} type="button">
              Abbrechen
            </AlertDialogCancel>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={createTag.isPending}
              type="submit"
            >
              {createTag.isPending ? "Wird erstellt..." : "Erstellen"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
