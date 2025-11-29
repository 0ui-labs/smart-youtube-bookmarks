import { useQueryClient } from "@tanstack/react-query";
import { Info, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateCustomField } from "@/hooks/useCustomFields";
import { listsOptions, useUpdateList } from "@/hooks/useLists";
import {
  schemasKeys,
  useCreateSchema,
  useSchema,
  useUpdateSchemaFieldsBatch,
} from "@/hooks/useSchemas";
import type {
  CustomField,
  CustomFieldCreate,
  FieldType,
} from "@/types/customField";
import { FieldTypeBadge } from "./FieldTypeBadge";

/** German labels for field types */
const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "rating", label: "Bewertung" },
  { value: "boolean", label: "Ja/Nein" },
  { value: "select", label: "Auswahl" },
];

/** Default config for each field type */
const DEFAULT_CONFIGS: Record<FieldType, object> = {
  text: {}, // max_length is optional, omit instead of null
  rating: { max_rating: 5 },
  boolean: {},
  select: { options: ["Option 1", "Option 2"] },
};

interface WorkspaceFieldsEditorProps {
  listId: string;
  defaultSchemaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for editing workspace-level fields that apply to all videos.
 *
 * Features:
 * - Shows existing fields with remove button
 * - Add new fields inline with name and type
 * - Info tip about workspace-level fields
 * - Save/Cancel with local state management
 *
 * @example
 * ```tsx
 * <WorkspaceFieldsEditor
 *   listId={currentList.id}
 *   defaultSchemaId={currentList.default_schema_id}
 *   open={workspaceEditorOpen}
 *   onOpenChange={setWorkspaceEditorOpen}
 * />
 * ```
 */
export function WorkspaceFieldsEditor({
  listId,
  defaultSchemaId,
  open,
  onOpenChange,
}: WorkspaceFieldsEditorProps) {
  const queryClient = useQueryClient();

  // Fetch schema with nested fields
  const { data: schema, isLoading } = useSchema(
    listId,
    defaultSchemaId ?? undefined
  );

  // Mutations
  const createField = useCreateCustomField(listId);
  const createSchema = useCreateSchema(listId);
  const updateSchemaFields = useUpdateSchemaFieldsBatch(
    listId,
    defaultSchemaId ?? ""
  );
  const updateList = useUpdateList();

  // Local state for fields being edited
  const [localFields, setLocalFields] = useState<CustomField[]>([]);
  const [showAddField, setShowAddField] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New field form state
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");

  // Sync local state when schema loads or dialog opens
  useEffect(() => {
    if (schema && open) {
      const fields =
        schema.schema_fields
          ?.slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((sf) => sf.field) ?? [];
      setLocalFields(fields);
    }
  }, [schema, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowAddField(false);
      setNewFieldName("");
      setNewFieldType("text");
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [open]);

  const handleRemoveField = (fieldId: string) => {
    setLocalFields((prev) => prev.filter((f) => f.id !== fieldId));
  };

  const handleAddField = () => {
    const trimmedName = newFieldName.trim();
    if (!trimmedName) return;

    // Create temporary field object (will be persisted in save step)
    const tempField: CustomField = {
      id: `temp-${Date.now()}`,
      list_id: listId,
      name: trimmedName,
      field_type: newFieldType,
      config: DEFAULT_CONFIGS[newFieldType],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLocalFields((prev) => [...prev, tempField]);
    setNewFieldName("");
    setNewFieldType("text");
    setShowAddField(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Step 1: Create new fields (those with temp-* IDs)
      const tempFields = localFields.filter((f) => f.id.startsWith("temp-"));
      const existingFields = localFields.filter(
        (f) => !f.id.startsWith("temp-")
      );

      // Create new fields and collect their real IDs
      const createdFieldIds: string[] = [];
      for (const tempField of tempFields) {
        const fieldData: CustomFieldCreate = {
          name: tempField.name,
          field_type: tempField.field_type,
          config: tempField.config,
        };
        const created = await createField.mutateAsync(fieldData);
        createdFieldIds.push(created.id);
      }

      // Combine existing field IDs with newly created field IDs
      const allFieldIds = [
        ...existingFields.map((f) => f.id),
        ...createdFieldIds,
      ];

      // Step 2: Update or create schema with fields
      if (defaultSchemaId && allFieldIds.length > 0) {
        // Update existing schema
        await updateSchemaFields.mutateAsync({
          fields: allFieldIds.map((fieldId, index) => ({
            field_id: fieldId,
            display_order: index,
            show_on_card: false,
          })),
        });
      } else if (!defaultSchemaId && allFieldIds.length > 0) {
        // Create new workspace schema and update list
        const newSchema = await createSchema.mutateAsync({
          name: "Workspace Felder",
          description: "Standard-Felder für alle Videos",
          fields: allFieldIds.map((fieldId, index) => ({
            field_id: fieldId,
            display_order: index,
            show_on_card: false,
          })),
        });

        // Update list with new default_schema_id
        await updateList.mutateAsync({
          listId,
          data: { default_schema_id: newSchema.id },
        });

        // Invalidate lists query to refresh UI
        await queryClient.invalidateQueries({
          queryKey: listsOptions().queryKey,
        });
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: schemasKeys.all() });

      // Show success feedback briefly before closing
      // TODO: Replace with toast notification when toast component is available
      setSaveSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      setSaveError(`Speichern fehlgeschlagen: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isAddDisabled = !newFieldName.trim();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Informationen für alle Videos</DialogTitle>
          <DialogDescription>
            Diese Felder sind für ALLE Videos in diesem Workspace verfügbar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Tipp: Felder die für alle Kategorien nützlich sind (z.B.
              Bewertung, Notizen)
            </AlertDescription>
          </Alert>

          {/* Field List */}
          <div className="space-y-2">
            <Label>Felder:</Label>

            {isLoading ? (
              <p className="text-muted-foreground text-sm">Lade Felder...</p>
            ) : localFields.length > 0 ? (
              <div className="space-y-2">
                {localFields.map((field) => (
                  <div
                    className="flex items-center justify-between rounded border p-2"
                    key={field.id}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{field.name}</span>
                      <FieldTypeBadge
                        className="px-1.5 py-0 text-[10px]"
                        fieldType={field.field_type}
                      />
                    </div>
                    <Button
                      aria-label={`${field.name} entfernen`}
                      className="h-7 w-7"
                      onClick={() => handleRemoveField(field.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                Keine Felder definiert
              </p>
            )}
          </div>

          {/* Add Field Button */}
          {!showAddField && (
            <Button
              className="w-full"
              onClick={() => setShowAddField(true)}
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Information hinzufügen
            </Button>
          )}

          {/* Add Field Form */}
          {showAddField && (
            <div className="space-y-3 rounded border bg-muted/50 p-3">
              <div className="space-y-2">
                <Label htmlFor="new-field-name">Feldname</Label>
                <Input
                  autoFocus
                  id="new-field-name"
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="z.B. Notizen, Bewertung"
                  value={newFieldName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-field-type">Typ</Label>
                <Select
                  onValueChange={(value) => setNewFieldType(value as FieldType)}
                  value={newFieldType}
                >
                  <SelectTrigger id="new-field-type">
                    <SelectValue placeholder="Typ auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  disabled={isAddDisabled}
                  onClick={handleAddField}
                  size="sm"
                >
                  Hinzufügen
                </Button>
                <Button
                  onClick={() => {
                    setShowAddField(false);
                    setNewFieldName("");
                    setNewFieldType("text");
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Success display */}
        {saveSuccess && (
          <Alert className="border-green-500 bg-green-50 text-green-800">
            <AlertDescription>Felder erfolgreich gespeichert!</AlertDescription>
          </Alert>
        )}

        {/* Error display */}
        {saveError && (
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Abbrechen
          </Button>
          <Button disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
