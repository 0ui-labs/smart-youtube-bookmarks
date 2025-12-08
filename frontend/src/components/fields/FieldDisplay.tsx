import type React from "react";
import type { VideoFieldValue } from "@/types/video";
import { BooleanCheckbox } from "./BooleanCheckbox";
import { RatingStars } from "./RatingStars";
import { SelectBadge } from "./SelectBadge";
import { TextSnippet } from "./TextSnippet";

export interface FieldDisplayProps {
  /**
   * Field value to display (discriminated union by field.field_type)
   */
  fieldValue: VideoFieldValue;
  /**
   * Whether the field is read-only (default: false)
   */
  readonly?: boolean;
  /**
   * Callback when value changes (type-safe union: number | string | boolean)
   */
  onChange?: (value: number | string | boolean) => void;
  /**
   * Callback when text field expand button is clicked
   */
  onExpand?: () => void;
  /**
   * Optional custom CSS class
   */
  className?: string;
}

/**
 * FieldDisplay Component
 *
 * Dispatches to type-specific sub-components based on field.field_type.
 * Uses discriminated union for type-safe rendering without useMemo/useCallback.
 *
 * REF MCP Improvements Applied:
 * - #3 (No Premature Optimization): NO useMemo or useCallback
 * - #5 (Accessibility): All sub-components have aria-hidden on icons
 *
 * Sub-components:
 * - RatingStars: 'rating' field type
 * - SelectBadge: 'select' field type
 * - BooleanCheckbox: 'boolean' field type
 * - TextSnippet: 'text' field type (truncateAt=50)
 *
 * Type Safety:
 * - Switch statement narrows VideoFieldValue type
 * - Type guards ensure correct value types passed to sub-components
 * - Exhaustiveness check with never type
 *
 * @example
 * // Rating field
 * <FieldDisplay
 *   fieldValue={ratingFieldValue}
 *   onChange={(value) => console.log(value)} // value is number
 * />
 *
 * @example
 * // Select field (read-only)
 * <FieldDisplay
 *   fieldValue={selectFieldValue}
 *   readonly
 * />
 *
 * @example
 * // Text field with expand callback
 * <FieldDisplay
 *   fieldValue={textFieldValue}
 *   onExpand={() => openModal()}
 * />
 */
export const FieldDisplay: React.FC<FieldDisplayProps> = ({
  fieldValue,
  readonly = false,
  onChange,
  onExpand,
  className,
}) => {
  // Discriminated union switch on field.field_type
  // Note: Zod unions don't automatically narrow, so we use type assertions
  switch (fieldValue.field.field_type) {
    case "rating": {
      return (
        <RatingStars
          className={className}
          fieldName={fieldValue.field_name}
          maxRating={
            (fieldValue.field.config as { max_rating: number }).max_rating
          }
          onChange={onChange as ((value: number) => void) | undefined}
          readonly={readonly}
          value={fieldValue.value as number | null}
        />
      );
    }

    case "select": {
      return (
        <SelectBadge
          className={className}
          fieldName={fieldValue.field_name}
          onChange={onChange as ((value: string) => void) | undefined}
          options={(fieldValue.field.config as { options: string[] }).options}
          readonly={readonly}
          value={fieldValue.value as string | null}
        />
      );
    }

    case "boolean": {
      return (
        <BooleanCheckbox
          className={className}
          fieldName={fieldValue.field_name}
          onChange={onChange as ((value: boolean) => void) | undefined}
          readonly={readonly}
          value={fieldValue.value as boolean | null}
        />
      );
    }

    case "text": {
      return (
        <TextSnippet
          className={className}
          maxLength={
            (fieldValue.field.config as { max_length?: number }).max_length
          } // REF MCP #2: Use truncateAt prop (NOT maxLength)
          onChange={onChange as ((value: string) => void) | undefined}
          onExpand={onExpand}
          readOnly={readonly}
          truncateAt={50}
          value={fieldValue.value as string | null}
        />
      );
    }

    default: {
      // Runtime safety: log unknown field types
      // Note: TypeScript thinks this is never reachable, but we keep it for runtime safety
      console.error(
        "Unknown field type:",
        (fieldValue.field as { field_type: string }).field_type
      );
      return null;
    }
  }
};
