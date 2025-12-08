import { FieldDisplay } from "@/components/fields";
import type { AvailableFieldResponse, VideoFieldValue } from "@/types/video";

/**
 * CustomFieldsSection Component
 *
 * Displays custom fields as a flat list sorted by display_order.
 * Extracted from VideoDetailsPage for DRY reuse in VideoDetailsModal.
 *
 * Features:
 * - Flat list of fields (no grouping/headers)
 * - Sorted by display_order
 * - Inline field editing via FieldDisplay component
 * - Type-safe field value construction for empty fields
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
        <p>Keine Informationen verfügbar.</p>
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
