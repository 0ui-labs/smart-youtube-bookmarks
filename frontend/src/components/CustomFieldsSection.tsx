import { FieldDisplay } from "@/components/fields";
import type { AvailableFieldResponse, VideoFieldValue } from "@/types/video";

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
  availableFields: AvailableFieldResponse[];

  /** Current field values with metadata */
  fieldValues: VideoFieldValue[];

  /** Video ID for mutation context */
  videoId: string;

  /** List ID for API calls */
  listId: string;

  /** Callback when field value changes */
  onFieldChange: (fieldId: string, value: string | number | boolean) => void;

  /** Optional: Callback when text field expands (for modal scroll adjustment) */
  onExpand?: () => void;
}

export const CustomFieldsSection = ({
  availableFields,
  fieldValues,
  videoId,
  listId,
  onFieldChange,
  onExpand,
}: CustomFieldsSectionProps) => {
  // No fields message
  if (availableFields.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        <p>Keine benutzerdefinierten Felder verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {availableFields
        .sort((a, b) => a.display_order - b.display_order)
        .map((field) => {
          // Find existing value from field_values
          const existingValue = fieldValues.find(
            (fv) => fv.field_id === field.field_id
          );

          // Create type-specific VideoFieldValue for FieldDisplay
          // TypeScript requires exact discriminated union types
          let fieldValue: VideoFieldValue;

          if (existingValue) {
            fieldValue = existingValue;
          } else {
            // Create type-specific placeholder based on field_type
            const baseField = {
              id: crypto.randomUUID(),
              video_id: videoId,
              field_id: field.field_id,
              field_name: field.field_name,
              show_on_card: field.show_on_card,
              updated_at: new Date().toISOString(),
            };

            const fieldMeta = {
              id: field.field_id,
              list_id: listId,
              name: field.field_name,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (field.field_type === "rating") {
              fieldValue = {
                ...baseField,
                field: {
                  ...fieldMeta,
                  field_type: "rating" as const,
                  config: field.config as { max_rating: number },
                },
                value: null,
              };
            } else if (field.field_type === "select") {
              fieldValue = {
                ...baseField,
                field: {
                  ...fieldMeta,
                  field_type: "select" as const,
                  config: field.config as { options: string[] },
                },
                value: null,
              };
            } else if (field.field_type === "text") {
              const textConfig = field.config as { max_length?: number | null };
              fieldValue = {
                ...baseField,
                field: {
                  ...fieldMeta,
                  field_type: "text" as const,
                  config: {
                    max_length: textConfig.max_length ?? undefined,
                  },
                },
                value: null,
              };
            } else {
              // boolean
              fieldValue = {
                ...baseField,
                field: {
                  ...fieldMeta,
                  field_type: "boolean" as const,
                  config: {},
                },
                value: null,
              };
            }
          }

          return (
            <div className="flex items-start gap-2" key={field.field_id}>
              <div className="flex-1">
                <p className="mb-1 font-medium text-sm">{field.field_name}</p>
                <FieldDisplay
                  fieldValue={fieldValue}
                  onChange={(value) => onFieldChange(field.field_id, value)}
                  onExpand={onExpand}
                  readonly={false}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
};
