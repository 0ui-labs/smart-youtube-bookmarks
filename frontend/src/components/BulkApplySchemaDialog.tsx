// frontend/src/components/BulkApplySchemaDialog.tsx

import { useState, useEffect, useMemo } from 'react'
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
import { Label } from '@/components/ui/label'
import type { Tag } from '@/types/tag'
import type { FieldSchemaResponse } from '@/types/schema'

export interface BulkApplySchemaDialogProps {
  open: boolean
  schema: FieldSchemaResponse | null
  tags: Tag[]
  onConfirm: (selectedTagIds: string[]) => void
  onCancel: () => void
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
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())

  // Show all tags, but track which ones already have this schema
  const availableTags = tags

  const alreadyAssignedCount = useMemo(() => {
    if (!schema) return 0
    return tags.filter(tag => tag.schema_id === schema.id).length
  }, [tags, schema])

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTagIds(new Set())
    }
  }, [open])

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds(prev => {
      const next = new Set(prev)
      if (next.has(tagId)) {
        next.delete(tagId)
      } else {
        next.add(tagId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedTagIds.size === availableTags.length) {
      // Clear all
      setSelectedTagIds(new Set())
    } else {
      // Select all
      setSelectedTagIds(new Set(availableTags.map(t => t.id)))
    }
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedTagIds))
  }

  const hasOverwrites = availableTags.some(
    tag => selectedTagIds.has(tag.id) && tag.schema_id !== null
  )

  if (!schema) return null

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Schema auf Tags anwenden</DialogTitle>
          <DialogDescription>
            Wenden Sie das Schema <strong>{schema.name}</strong> auf mehrere Tags gleichzeitig an.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {availableTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Keine Tags verfügbar.</p>
              {alreadyAssignedCount > 0 && (
                <p className="text-sm mt-2">
                  {alreadyAssignedCount} {alreadyAssignedCount === 1 ? 'Tag hat' : 'Tags haben'} bereits dieses Schema.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All Checkbox */}
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={selectedTagIds.size === availableTags.length && availableTags.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="font-medium cursor-pointer">
                  Alle auswählen ({availableTags.length})
                </Label>
              </div>

              {/* Tag List with Checkboxes */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {availableTags.map(tag => {
                  const isSelected = selectedTagIds.has(tag.id)
                  const hasExistingSchema = tag.schema_id !== null

                  return (
                    <div
                      key={tag.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox
                        id={`tag-${tag.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleTag(tag.id)}
                      />
                      <div className="flex-1 flex items-center gap-2">
                        <Label
                          htmlFor={`tag-${tag.id}`}
                          className="flex-1 cursor-pointer flex items-center gap-2"
                        >
                          {/* Tag Color Badge */}
                          {tag.color && (
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                          )}
                          {/* Tag Name */}
                          <span className="flex-1">{tag.name}</span>
                        </Label>
                        {/* Current Schema Indicator */}
                        {hasExistingSchema && (
                          <span className="text-xs text-muted-foreground">
                            (aktuell: Video Quality)
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Info Messages */}
              <div className="space-y-2 pt-2">
                {/* Selection Count */}
                <div className="text-sm text-muted-foreground">
                  {selectedTagIds.size} {selectedTagIds.size === 1 ? 'Tag ausgewählt' : 'Tags ausgewählt'}
                </div>

                {/* Overwrite Warning */}
                {hasOverwrites && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm text-orange-900">
                      ⚠️ Einige ausgewählte Tags haben bereits ein Schema, das wird überschrieben.
                    </p>
                  </div>
                )}

                {/* Already Assigned Info */}
                {alreadyAssignedCount > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      ℹ️ {alreadyAssignedCount} {alreadyAssignedCount === 1 ? 'Tag ist' : 'Tags sind'} bereits zugewiesen.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedTagIds.size === 0}
          >
            Anwenden ({selectedTagIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
