/**
 * EditTagDialog Component
 *
 * Modal dialog for editing categories/labels.
 * User can edit name, color, type and manage fields directly.
 * Schema management happens automatically in the background.
 *
 * @example
 * ```tsx
 * <EditTagDialog
 *   tag={selectedTag}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   listId={listId}
 * />
 * ```
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateCustomField, useCustomFields } from "@/hooks/useCustomFields";
import {
  useAddFieldToSchema,
  useCreateSchema,
  useRemoveFieldFromSchema,
  useSchema,
  useUpdateSchema,
} from "@/hooks/useSchemas";
import { useUpdateTag } from "@/hooks/useTags";
import type { CustomField } from "@/types/customField";
import type { Tag } from "@/types/tag";

const TagFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name ist erforderlich")
    .max(100, "Name darf maximal 100 Zeichen haben"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Ungültiges Farbformat")
    .nullable(),
});

type TagFormData = z.infer<typeof TagFormSchema>;

interface EditTagDialogProps {
  tag: Tag;
  open: boolean;
  onClose: () => void;
  listId: string;
}

// Field type options - must match backend FieldType: 'select', 'rating', 'text', 'boolean'
const FIELD_TYPES = [
  { value: "text", label: "Text", defaultConfig: {} },
  {
    value: "rating",
    label: "Bewertung (1-5)",
    defaultConfig: { max_rating: 5 },
  },
  { value: "boolean", label: "Ja/Nein", defaultConfig: {} },
  {
    value: "select",
    label: "Auswahl",
    defaultConfig: { options: ["Option 1", "Option 2"] },
  },
] as const;

export function EditTagDialog({
  tag,
  open,
  onClose,
  listId,
}: EditTagDialogProps) {
  const updateTag = useUpdateTag();
  const createSchema = useCreateSchema(listId);
  const updateSchema = useUpdateSchema(listId);

  // Fetch existing schema if tag has one
  const { data: existingSchema } = useSchema(listId, tag.schema_id || "");

  // Hooks for syncing schema fields (add/remove)
  const addFieldToSchema = useAddFieldToSchema(listId, tag.schema_id || "");
  const removeFieldFromSchema = useRemoveFieldFromSchema(
    listId,
    tag.schema_id || ""
  );

  // Fetch all available fields for the list
  const { data: availableFields = [] } = useCustomFields(listId);
  const createField = useCreateCustomField(listId);

  // Local state for field management
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [showAddField, setShowAddField] = useState(false);
  const [showCreateField, setShowCreateField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<
    "text" | "rating" | "boolean" | "select"
  >("text");
  const [createFieldError, setCreateFieldError] = useState<string | null>(null);

  const form = useForm<TagFormData>({
    resolver: zodResolver(TagFormSchema),
    defaultValues: {
      name: tag.name,
      color: tag.color || "#3B82F6",
    },
  });

  // Initialize selected fields from existing schema
  useEffect(() => {
    if (open && existingSchema?.schema_fields) {
      const fieldIds = existingSchema.schema_fields.map(
        (sf: any) => sf.field_id
      );
      setSelectedFieldIds(fieldIds);
    } else if (open) {
      setSelectedFieldIds([]);
    }
  }, [open, existingSchema]);

  // Reset form when tag changes or dialog opens
  useEffect(() => {
    if (open && tag) {
      form.reset({
        name: tag.name,
        color: tag.color || "#3B82F6",
      });
    }
  }, [tag, open, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      let schemaId = tag.schema_id;

      // If fields are selected, ensure schema exists
      if (selectedFieldIds.length > 0) {
        const schemaFields = selectedFieldIds.map((fieldId, index) => ({
          field_id: fieldId,
          display_order: index,
          show_on_card: true,
        }));

        if (schemaId && existingSchema) {
          // Update existing schema: name only (backend doesn't accept fields in PUT)
          await updateSchema.mutateAsync({
            schemaId,
            updates: { name: `${data.name} Schema` },
          });

          // Sync fields: calculate diff and add/remove
          const currentFieldIds =
            existingSchema.schema_fields?.map((sf: any) => sf.field_id) || [];
          const fieldsToAdd = selectedFieldIds.filter(
            (id) => !currentFieldIds.includes(id)
          );
          const fieldsToRemove = currentFieldIds.filter(
            (id: string) => !selectedFieldIds.includes(id)
          );

          // Remove fields that are no longer selected
          // Execute all removals and verify they all succeeded before proceeding
          if (fieldsToRemove.length > 0) {
            const removalResults = await Promise.allSettled(
              fieldsToRemove.map((fieldId: string) =>
                removeFieldFromSchema.mutateAsync(fieldId)
              )
            );

            // Check if any removal failed
            const failedRemovals = removalResults.filter(
              (result): result is PromiseRejectedResult =>
                result.status === "rejected"
            );

            if (failedRemovals.length > 0) {
              // Abort: don't proceed with additions as display_order would be incorrect
              const firstFailure = failedRemovals[0];
              const errorMsg =
                (firstFailure?.reason as Error)?.message ||
                "Fehler beim Entfernen von Feldern";
              throw new Error(
                `Feld-Synchronisation fehlgeschlagen: ${errorMsg}`
              );
            }
          }

          // All removals succeeded - now compute correct display_order and add new fields
          const remainingFieldCount =
            currentFieldIds.length - fieldsToRemove.length;
          for (const [i, fieldId] of fieldsToAdd.entries()) {
            await addFieldToSchema.mutateAsync({
              field_id: fieldId,
              display_order: remainingFieldCount + i,
              show_on_card: true,
            });
          }
        } else {
          // Create new schema with fields (POST accepts fields)
          const newSchema = await createSchema.mutateAsync({
            name: `${data.name} Schema`,
            fields: schemaFields,
          });
          schemaId = newSchema.id;
        }
      } else if (schemaId) {
        // No fields selected but had schema - remove schema reference
        schemaId = null;
      }

      // Update the tag
      await updateTag.mutateAsync({
        tagId: tag.id,
        data: {
          name: data.name.trim(),
          color: data.color ?? undefined,
          schema_id: schemaId,
        },
      });

      onClose();
    } catch (error: any) {
      // Handle Pydantic validation errors (array of objects) or string errors
      const detail = error.response?.data?.detail;
      let errorMessage = "Fehler beim Speichern";
      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Extract message from first Pydantic validation error
        errorMessage = detail[0]?.msg || "Validierungsfehler";
      }
      form.setError("name", {
        type: "server",
        message: errorMessage,
      });
    }
  });

  const handleAddExistingField = (fieldId: string) => {
    if (!selectedFieldIds.includes(fieldId)) {
      setSelectedFieldIds([...selectedFieldIds, fieldId]);
    }
    setShowAddField(false);
  };

  const handleRemoveField = (fieldId: string) => {
    setSelectedFieldIds(selectedFieldIds.filter((id) => id !== fieldId));
  };

  const handleCreateNewField = async () => {
    if (!newFieldName.trim()) return;

    // Get default config for the selected field type
    const fieldTypeConfig = FIELD_TYPES.find((t) => t.value === newFieldType);
    const config = fieldTypeConfig?.defaultConfig || {};

    try {
      const newField = await createField.mutateAsync({
        name: newFieldName.trim(),
        field_type: newFieldType,
        config,
      });
      // Success: clear error and reset form
      setCreateFieldError(null);
      setSelectedFieldIds([...selectedFieldIds, newField.id]);
      setNewFieldName("");
      setNewFieldType("text");
      setShowCreateField(false);
    } catch (error: any) {
      console.error("Failed to create field:", error);
      // Surface error to user
      const detail = error.response?.data?.detail;
      let errorMessage = "Feld konnte nicht erstellt werden";
      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0]?.msg || "Validierungsfehler";
      } else if (error.message) {
        errorMessage = error.message;
      }
      setCreateFieldError(errorMessage);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setShowAddField(false);
      setShowCreateField(false);
      setNewFieldName("");
      setNewFieldType("text");
      setCreateFieldError(null);
      onClose();
    }
  };

  // Get field details for display
  const selectedFields = selectedFieldIds
    .map((id) => availableFields.find((f: CustomField) => f.id === id))
    .filter(Boolean) as CustomField[];

  // Fields not yet selected
  const unselectedFields = availableFields.filter(
    (f: CustomField) => !selectedFieldIds.includes(f.id)
  );

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={open}>
      <AlertDialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Kategorie bearbeiten</AlertDialogTitle>
          <AlertDialogDescription>
            Bearbeite Name, Farbe und Felder.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Name Field */}
          <div>
            <Label htmlFor="edit-tag-name">Name *</Label>
            <Input
              id="edit-tag-name"
              {...form.register("name")}
              autoFocus
              disabled={updateTag.isPending}
              maxLength={100}
              placeholder="Name eingeben"
            />
            {form.formState.errors.name && (
              <p className="mt-1 text-red-600 text-sm">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Color Field */}
          <div>
            <Label htmlFor="edit-tag-color">Farbe</Label>
            <div className="flex gap-2">
              <input
                className="h-10 w-16 cursor-pointer rounded border"
                disabled={updateTag.isPending}
                id="edit-tag-color"
                onChange={(e) => form.setValue("color", e.target.value)}
                type="color"
                value={form.watch("color") || "#3B82F6"}
              />
              <Input
                {...form.register("color")}
                className="flex-1"
                disabled={updateTag.isPending}
                placeholder="#3B82F6"
              />
            </div>
          </div>

          {/* Fields Section */}
          <div className="border-t pt-4">
            <div className="mb-3 flex items-center justify-between">
              <Label>Felder</Label>
              <Button
                onClick={() => setShowAddField(!showAddField)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="mr-1 h-4 w-4" />
                Feld hinzufügen
              </Button>
            </div>

            {/* Add Field Options */}
            {showAddField && (
              <div className="mb-3 space-y-3 rounded-lg bg-muted/50 p-3">
                {/* Select existing field */}
                {unselectedFields.length > 0 && (
                  <div>
                    <Label className="mb-2 block text-sm">
                      Vorhandenes Feld hinzufügen:
                    </Label>
                    <Select onValueChange={handleAddExistingField}>
                      <SelectTrigger>
                        <SelectValue placeholder="Feld auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unselectedFields.map((field: CustomField) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name} (
                            {FIELD_TYPES.find(
                              (t) => t.value === field.field_type
                            )?.label || field.field_type}
                            )
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Divider if both options available */}
                {unselectedFields.length > 0 && !showCreateField && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <div className="flex-1 border-t" />
                    <span>oder</span>
                    <div className="flex-1 border-t" />
                  </div>
                )}

                {/* Create new field button/form */}
                {showCreateField ? (
                  <div className="space-y-2 rounded-lg border bg-background p-2">
                    <Label className="text-sm">Neues Feld erstellen:</Label>
                    <Input
                      className="text-sm"
                      onChange={(e) => setNewFieldName(e.target.value)}
                      placeholder="Feldname (z.B. Kalorien, Bewertung)"
                      value={newFieldName}
                    />
                    <Select
                      onValueChange={(v) =>
                        setNewFieldType(
                          v as "text" | "rating" | "boolean" | "select"
                        )
                      }
                      value={newFieldType}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        disabled={!newFieldName.trim() || createField.isPending}
                        onClick={handleCreateNewField}
                        size="sm"
                        type="button"
                      >
                        {createField.isPending
                          ? "Erstellt..."
                          : "Erstellen & Hinzufügen"}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowCreateField(false);
                          setNewFieldName("");
                          setNewFieldType("text");
                          setCreateFieldError(null);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Abbrechen
                      </Button>
                    </div>
                    {createFieldError && (
                      <p className="mt-1 text-red-600 text-sm">
                        {createFieldError}
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => setShowCreateField(true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Neues Feld erstellen
                  </Button>
                )}
              </div>
            )}

            {/* Selected Fields List */}
            {selectedFields.length > 0 ? (
              <div className="space-y-2">
                {selectedFields.map((field) => (
                  <div
                    className="flex items-center gap-2 rounded-lg bg-muted/30 p-2"
                    key={field.id}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{field.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {
                        FIELD_TYPES.find((t) => t.value === field.field_type)
                          ?.label
                      }
                    </span>
                    <Button
                      className="h-8 w-8 p-0"
                      onClick={() => handleRemoveField(field.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                Keine Felder konfiguriert. Videos dieser Kategorie haben nur die
                Basis-Infos.
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose} type="button">
              Abbrechen
            </AlertDialogCancel>
            <Button
              disabled={
                updateTag.isPending ||
                createSchema.isPending ||
                updateSchema.isPending ||
                addFieldToSchema.isPending ||
                removeFieldFromSchema.isPending
              }
              type="submit"
            >
              {updateTag.isPending ||
              createSchema.isPending ||
              updateSchema.isPending ||
              addFieldToSchema.isPending ||
              removeFieldFromSchema.isPending
                ? "Speichert..."
                : "Speichern"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
