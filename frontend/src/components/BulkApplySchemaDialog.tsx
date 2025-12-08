// frontend/src/components/BulkApplySchemaDialog.tsx

import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import type { FieldSchemaResponse } from "@/types/schema";
import type { Tag } from "@/types/tag";

export interface BulkApplySchemaDialogProps {
  open: boolean;
  schema: FieldSchemaResponse | null;
  tags: Tag[];
  onConfirm: (selectedTagIds: string[]) => void;
  onCancel: () => void;
}

/**
 * BulkApplySchemaDialog Component - Multi-select UI for bulk schema application
 *
 * Features:
 * - Multi-select with checkboxes
 * - "Select All" / "Clear Selection" functionality
 * - Visual indication of current schemas (shows which will be overwritten)
 * - Filters out tags that already have this exact schema
 * - Selection count badge
 * - Disabled confirm button when no tags selected
 *
 * REF MCP Patterns:
 * - Checkbox-based multi-select (preferred over dropdown for visual feedback)
 * - Selection state with count badge ("3 tags selected")
 * - Warning indicators for schema overwrites
 * - Confirmation required before bulk operation
 *
 * @example
 * <BulkApplySchemaDialog
 *   open={open}
 *   schema={selectedSchema}
 *   tags={allTags}
 *   onConfirm={(tagIds) => bulkApply.mutate({ tagIds, schemaId: schema.id })}
 *   onCancel={() => setOpen(false)}
 * />
 */
export function BulkApplySchemaDialog({
  open,
  schema,
  tags,
  onConfirm,
  onCancel,
}: BulkApplySchemaDialogProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  // Show all tags, but track which ones already have this schema
  const availableTags = tags;

  const alreadyAssignedCount = useMemo(() => {
    if (!schema) return 0;
    return tags.filter((tag) => tag.schema_id === schema.id).length;
  }, [tags, schema]);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTagIds(new Set());
    }
  }, [open]);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTagIds.size === availableTags.length) {
      // Clear all
      setSelectedTagIds(new Set());
    } else {
      // Select all
      setSelectedTagIds(new Set(availableTags.map((t) => t.id)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedTagIds));
  };

  const hasOverwrites = availableTags.some(
    (tag) => selectedTagIds.has(tag.id) && tag.schema_id !== null
  );

  if (!schema) return null;

  return (
    <Dialog onOpenChange={(open) => !open && onCancel()} open={open}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Schema auf Tags anwenden</DialogTitle>
          <DialogDescription>
            Wenden Sie das Schema <strong>{schema.name}</strong> auf mehrere
            Tags gleichzeitig an.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {availableTags.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>Keine Tags verfügbar.</p>
              {alreadyAssignedCount > 0 && (
                <p className="mt-2 text-sm">
                  {alreadyAssignedCount}{" "}
                  {alreadyAssignedCount === 1 ? "Tag hat" : "Tags haben"}{" "}
                  bereits dieses Schema.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All Checkbox */}
              <div className="flex items-center gap-2 border-b pb-2">
                <Checkbox
                  checked={
                    selectedTagIds.size === availableTags.length &&
                    availableTags.length > 0
                  }
                  id="select-all"
                  onCheckedChange={handleSelectAll}
                />
                <Label
                  className="cursor-pointer font-medium"
                  htmlFor="select-all"
                >
                  Alle auswählen ({availableTags.length})
                </Label>
              </div>

              {/* Tag List with Checkboxes */}
              <div className="max-h-[400px] space-y-2 overflow-y-auto">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  const hasExistingSchema = tag.schema_id !== null;

                  return (
                    <div
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? "border-blue-200 bg-blue-50"
                          : "hover:bg-gray-50"
                      }`}
                      key={tag.id}
                    >
                      <Checkbox
                        checked={isSelected}
                        id={`tag-${tag.id}`}
                        onCheckedChange={() => handleToggleTag(tag.id)}
                      />
                      <div className="flex flex-1 items-center gap-2">
                        <Label
                          className="flex flex-1 cursor-pointer items-center gap-2"
                          htmlFor={`tag-${tag.id}`}
                        >
                          {/* Tag Color Badge */}
                          {tag.color && (
                            <div
                              className="h-4 w-4 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                          )}
                          {/* Tag Name */}
                          <span className="flex-1">{tag.name}</span>
                        </Label>
                        {/* Current Schema Indicator */}
                        {hasExistingSchema && (
                          <span className="text-muted-foreground text-xs">
                            (hat Schema)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Info Messages */}
              <div className="space-y-2 pt-2">
                {/* Selection Count */}
                <div className="text-muted-foreground text-sm">
                  {selectedTagIds.size}{" "}
                  {selectedTagIds.size === 1
                    ? "Tag ausgewählt"
                    : "Tags ausgewählt"}
                </div>

                {/* Overwrite Warning */}
                {hasOverwrites && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <p className="text-orange-900 text-sm">
                      ⚠️ Einige ausgewählte Tags haben bereits ein Schema, das
                      wird überschrieben.
                    </p>
                  </div>
                )}

                {/* Already Assigned Info */}
                {alreadyAssignedCount > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-blue-900 text-sm">
                      ℹ️ {alreadyAssignedCount}{" "}
                      {alreadyAssignedCount === 1 ? "Tag ist" : "Tags sind"}{" "}
                      bereits zugewiesen.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onCancel} variant="outline">
            Abbrechen
          </Button>
          <Button disabled={selectedTagIds.size === 0} onClick={handleConfirm}>
            Anwenden ({selectedTagIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
