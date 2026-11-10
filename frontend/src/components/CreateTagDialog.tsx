/**
 * CreateTagDialog Component
 *
 * Modal dialog for creating new tags with name, optional color, and optional schema.
 * Uses AlertDialog from Radix UI for accessibility.
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

import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Tag as TagIcon } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { schemasOptions, useCreateSchema } from "@/hooks/useSchemas";
import { useCreateTag } from "@/hooks/useTags";
import { SchemaSelector } from "./SchemaSelector";
import { SchemaEditor, type SchemaFormData } from "./schemas/SchemaEditor";

interface CreateTagDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  listId?: string;
  defaultIsVideoType?: boolean;
}

export const CreateTagDialog = ({
  open,
  onOpenChange,
  onClose,
  listId,
  defaultIsVideoType = true,
}: CreateTagDialogProps) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6"); // Default blue
  const [isVideoType, setIsVideoType] = useState(defaultIsVideoType);
  const [error, setError] = useState<string | null>(null);
  // Task #82: Schema ID state for SchemaSelector
  // null = "Kein Schema", 'new' = Create new schema, UUID string = Existing schema
  const [schemaId, setSchemaId] = useState<string | null>(null);

  const createTag = useCreateTag();
  const createSchema = useCreateSchema(listId ?? "");

  // Task #82 Batch 3: Fetch schemas with dependent query
  const { data: schemas = [], isLoading: isSchemasLoading } = useQuery({
    ...schemasOptions(listId ?? ""),
    enabled: !!listId, // REF MCP Improvement #4: Dependent query pattern
  });

  // Bug #001 Fix: Handlers for inline schema creation
  const handleSchemaCreated = async (schemaData: SchemaFormData) => {
    const newSchema = await createSchema.mutateAsync({
      name: schemaData.name,
      description: schemaData.description,
      fields: schemaData.fields,
    });

    // Set schemaId to newly created schema
    setSchemaId(newSchema.id);
  };

  const handleSchemaCancelled = () => {
    // Reset to "no schema" when user cancels
    setSchemaId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      setError("Bitte geben Sie einen Tag-Namen ein");
      return;
    }

    if (name.length > 50) {
      setError("Tag-Name darf maximal 50 Zeichen lang sein");
      return;
    }

    // Bug #001 Fix: Validate 'new' mode (edge case protection)
    if (schemaId === "new") {
      setError(
        "Bitte erstellen Sie das Schema oder brechen Sie die Erstellung ab"
      );
      return;
    }

    try {
      await createTag.mutateAsync({
        name: name.trim(),
        color: color || undefined, // Send undefined if empty
        schema_id: schemaId, // Task #82 Batch 3: Include schema_id
        is_video_type: isVideoType, // Category/Label support
      });

      // Success - reset form and close dialog
      setName("");
      setColor("#3B82F6");
      setIsVideoType(defaultIsVideoType);
      setSchemaId(null);
      setError(null);
      onClose?.();
      onOpenChange?.(false);
    } catch (err: any) {
      // Handle errors
      if (err.response?.status === 409) {
        setError("Ein Tag mit diesem Namen existiert bereits");
      } else {
        setError(
          "Fehler beim Erstellen des Tags. Bitte versuchen Sie es erneut."
        );
      }
    }
  };

  const handleCancel = () => {
    setName("");
    setColor("#3B82F6");
    setIsVideoType(defaultIsVideoType);
    setSchemaId(null);
    setError(null);
    onClose?.();
    onOpenChange?.(false);
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Neuen Tag erstellen</AlertDialogTitle>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Tag Name Input */}
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
                placeholder="z.B. Python, Tutorial, Wichtig"
                type="text"
                value={name}
              />
              {error && <p className="mt-1 text-red-600 text-sm">{error}</p>}
            </div>

            {/* Type Selector */}
            <div>
              <Label className="mb-1 block font-medium text-gray-700 text-sm">
                Typ
              </Label>
              <RadioGroup
                className="mt-2 flex gap-4"
                disabled={createTag.isPending}
                onValueChange={(value) => setIsVideoType(value === "category")}
                value={isVideoType ? "category" : "label"}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="create-type-category" value="category" />
                  <Label
                    className="flex cursor-pointer items-center gap-1"
                    htmlFor="create-type-category"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Kategorie
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="create-type-label" value="label" />
                  <Label
                    className="flex cursor-pointer items-center gap-1"
                    htmlFor="create-type-label"
                  >
                    <TagIcon className="h-4 w-4" />
                    Label
                  </Label>
                </div>
              </RadioGroup>
              <p className="mt-1 text-gray-500 text-sm">
                Kategorien sind exklusiv (ein Video kann nur eine haben), Labels
                nicht.
              </p>
            </div>

            {/* Color Picker */}
            <div>
              <label
                className="mb-1 block font-medium text-gray-700 text-sm"
                htmlFor="tag-color"
              >
                Farbe (optional)
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
              <p className="mt-1 text-gray-500 text-sm">
                Wählen Sie eine Farbe zur visuellen Unterscheidung
              </p>
            </div>

            {/* Task #82 Batch 3: Schema Selector */}
            <div>
              <label
                className="mb-1 block font-medium text-gray-700 text-sm"
                htmlFor="tag-schema"
              >
                Schema (optional)
              </label>
              <SchemaSelector
                disabled={isSchemasLoading}
                onChange={setSchemaId}
                schemas={schemas}
                value={schemaId}
              />
              <p className="mt-1 text-gray-500 text-sm">
                Verknüpfen Sie benutzerdefinierte Felder mit diesem Tag
              </p>
            </div>
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
        {/* Bug #001 Fix: Show SchemaEditor when schemaId === 'new' */}
        {schemaId === "new" && listId && (
          <div className="mt-4 rounded-lg border bg-gray-50 p-4">
            <SchemaEditor
              listId={listId}
              onCancel={handleSchemaCancelled}
              onSave={handleSchemaCreated}
            />
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
