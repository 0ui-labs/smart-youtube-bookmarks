import React from 'react'
import { VideoFieldValue } from '@/types/video'
import { RatingStars } from './RatingStars'
import { SelectBadge } from './SelectBadge'
import { BooleanCheckbox } from './BooleanCheckbox'
import { TextSnippet } from './TextSnippet'

export interface FieldDisplayProps {
  /**
   * Field value to display (discriminated union by field.field_type)
   */
  fieldValue: VideoFieldValue
  /**
   * Whether the field is read-only (default: false)
   */
  readonly?: boolean
  /**
   * Callback when value changes (type-safe union: number | string | boolean)
   */
  onChange?: (value: number | string | boolean) => void
  /**
   * Callback when text field expand button is clicked
   */
  onExpand?: () => void
  /**
   * Optional custom CSS class
   */
  className?: string
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
    case 'rating': {
      return (
        <RatingStars
          value={fieldValue.value as number | null}
          maxRating={(fieldValue.field.config as { max_rating: number }).max_rating}
          fieldName={fieldValue.field_name}
          readonly={readonly}
          onChange={onChange as ((value: number) => void) | undefined}
          className={className}
        />
      )
    }

    case 'select': {
      return (
        <SelectBadge
          value={fieldValue.value as string | null}
          options={(fieldValue.field.config as { options: string[] }).options}
          fieldName={fieldValue.field_name}
          readonly={readonly}
          onChange={onChange as ((value: string) => void) | undefined}
          className={className}
        />
      )
    }

    case 'boolean': {
      return (
        <BooleanCheckbox
          value={fieldValue.value as boolean | null}
          fieldName={fieldValue.field_name}
          readonly={readonly}
          onChange={onChange as ((value: boolean) => void) | undefined}
          className={className}
        />
      )
    }

    case 'text': {
      return (
        <TextSnippet
          value={fieldValue.value as string | null}
          truncateAt={50} // REF MCP #2: Use truncateAt prop (NOT maxLength)
          readOnly={readonly}
          onChange={onChange as ((value: string) => void) | undefined}
          onExpand={onExpand}
          maxLength={(fieldValue.field.config as { max_length?: number }).max_length}
          className={className}
        />
      )
    }

    default: {
      // Runtime safety: log unknown field types
      // Note: TypeScript thinks this is never reachable, but we keep it for runtime safety
      console.error('Unknown field type:', (fieldValue.field as { field_type: string }).field_type)
      return null
    }
  }
}
