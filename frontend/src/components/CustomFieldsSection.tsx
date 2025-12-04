import { useState, useEffect } from 'react'
import { AvailableFieldResponse, VideoFieldValue } from '@/types/video'
import { FieldDisplay } from '@/components/fields'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * CustomFieldsSection Component
 *
 * Displays custom fields grouped by schema with collapsible sections.
 * Extracted from VideoDetailsPage (Task #131 Step 2) for DRY reuse in VideoDetailsModal.
 *
 * Features:
 * - Groups available_fields by schema_name (or "Allgemeine Felder" for null)
 * - Alphabetically sorted schema sections
 * - All schemas expanded by default
 * - Collapsible sections with ChevronDown/ChevronUp icons
 * - Inline field editing via FieldDisplay component
 * - Type-safe field value construction for empty fields
 *
 * REF MCP Best Practices:
 * - Collapsible controlled with open/onOpenChange + local state
 * - CollapsibleTrigger with asChild + Button for keyboard navigation
 * - FieldDisplay interface: fieldValue prop (NOT field+value), readonly prop
 *
 * Related Tasks:
 * - Task #130: VideoDetailsPage (original implementation)
 * - Task #131: Extract to shared component (this task)
 * - Task #129: FieldDisplay component
 *
 * @example
 * <CustomFieldsSection
 *   availableFields={video.available_fields || []}
 *   fieldValues={video.field_values || []}
 *   videoId={video.id}
 *   listId={video.list_id}
 *   onFieldChange={(fieldId, value) => updateField.mutate({ fieldId, value })}
 * />
 */
interface CustomFieldsSectionProps {
  /** All available fields for this video (filled + empty) from available_fields */
  availableFields: AvailableFieldResponse[]

  /** Current field values with metadata */
  fieldValues: VideoFieldValue[]

  /** Video ID for mutation context */
  videoId: string

  /** List ID for API calls */
  listId: string

  /** Callback when field value changes */
  onFieldChange: (fieldId: string, value: string | number | boolean) => void

  /** Optional: Callback when text field expands (for modal scroll adjustment) */
  onExpand?: () => void
}

export const CustomFieldsSection = ({
  availableFields,
  fieldValues,
  videoId,
  listId,
  onFieldChange,
  onExpand,
}: CustomFieldsSectionProps) => {
  // Track which schemas are expanded (default: all expanded)
  const [openSchemas, setOpenSchemas] = useState<Record<string, boolean>>({})

  // Group available_fields by schema_name
  const groupedFields = availableFields.reduce((acc, field) => {
    const schemaName = field.schema_name || 'Allgemein'
    if (!acc[schemaName]) {
      acc[schemaName] = []
    }
    acc[schemaName].push(field)
    return acc
  }, {} as Record<string, AvailableFieldResponse[]>)

  // Initialize all schemas as expanded on first render
  useEffect(() => {
    if (availableFields.length > 0 && Object.keys(openSchemas).length === 0) {
      const initialOpenState = Object.keys(groupedFields).reduce((acc, schemaName) => {
        acc[schemaName] = true
        return acc
      }, {} as Record<string, boolean>)
      setOpenSchemas(initialOpenState)
    }
  }, [availableFields.length, openSchemas, groupedFields])

  // No fields message
  if (availableFields.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>Keine Informationen verfügbar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold mb-4">Informationen</h2>

      {Object.entries(groupedFields)
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
        .map(([schemaName, fields]) => {
          const fieldCount = fields.length
          const isOpen = openSchemas[schemaName] ?? true

          return (
            <Collapsible
              key={schemaName}
              open={isOpen}
              onOpenChange={(open) =>
                setOpenSchemas((prev) => ({ ...prev, [schemaName]: open }))
              }
              className="border rounded-lg p-4"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex justify-between items-center p-0 h-auto hover:bg-transparent"
                >
                  <span className="text-lg font-semibold">
                    {schemaName} ({fieldCount})
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-5 w-5" aria-hidden="true" />
                  )}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-4">
                {fields
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((field) => {
                    // Find existing value from field_values
                    const existingValue = fieldValues.find(
                      (fv) => fv.field_id === field.field_id
                    )

                    // Create type-specific VideoFieldValue for FieldDisplay
                    // TypeScript requires exact discriminated union types
                    let fieldValue: VideoFieldValue

                    if (existingValue) {
                      fieldValue = existingValue
                    } else {
                      // Create type-specific placeholder based on field_type
                      const baseField = {
                        id: crypto.randomUUID(),
                        video_id: videoId,
                        field_id: field.field_id,
                        field_name: field.field_name,
                        show_on_card: field.show_on_card,
                        updated_at: new Date().toISOString(),
                      }

                      const fieldMeta = {
                        id: field.field_id,
                        list_id: listId,
                        name: field.field_name,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      }

                      if (field.field_type === 'rating') {
                        fieldValue = {
                          ...baseField,
                          field: {
                            ...fieldMeta,
                            field_type: 'rating' as const,
                            config: field.config as { max_rating: number },
                          },
                          value: null,
                        }
                      } else if (field.field_type === 'select') {
                        fieldValue = {
                          ...baseField,
                          field: {
                            ...fieldMeta,
                            field_type: 'select' as const,
                            config: field.config as { options: string[] },
                          },
                          value: null,
                        }
                      } else if (field.field_type === 'text') {
                        const textConfig = field.config as { max_length?: number | null }
                        fieldValue = {
                          ...baseField,
                          field: {
                            ...fieldMeta,
                            field_type: 'text' as const,
                            config: {
                              max_length: textConfig.max_length ?? undefined,
                            },
                          },
                          value: null,
                        }
                      } else {
                        // boolean
                        fieldValue = {
                          ...baseField,
                          field: {
                            ...fieldMeta,
                            field_type: 'boolean' as const,
                            config: {},
                          },
                          value: null,
                        }
                      }
                    }

                    return (
                      <div key={field.field_id} className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-1">{field.field_name}</p>
                          <FieldDisplay
                            fieldValue={fieldValue}
                            readonly={false}
                            onChange={(value) => onFieldChange(field.field_id, value)}
                            onExpand={onExpand}
                          />
                        </div>
                      </div>
                    )
                  })}
              </CollapsibleContent>
            </Collapsible>
          )
        })}
    </div>
  )
}
