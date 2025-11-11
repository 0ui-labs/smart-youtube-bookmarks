import React from 'react'
import {
  VideoFieldValue,
  isRatingFieldValue,
  isSelectFieldValue,
  isBooleanFieldValue,
  isTextFieldValue,
} from '@/types/video'
import { RatingStars } from './RatingStars'
import { SelectBadge } from './SelectBadge'
import { BooleanCheckbox } from './BooleanCheckbox'
import { TextSnippet } from './TextSnippet'

export interface FieldDisplayProps {
  /**
   * Field value with nested field metadata
   */
  fieldValue: VideoFieldValue
  /**
   * Whether the field is editable
   */
  readonly?: boolean
  /**
   * Size for rating stars (only applies to rating fields)
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Callback when value changes
   * Note: Receives only the new value (not field_id)
   */
  onChange?: (newValue: number | string | boolean) => void
}

/**
 * FieldDisplay Component
 *
 * Router component that renders the appropriate field component based on field type.
 * Uses discriminated union type guards for type-safe field value access.
 *
 * REF MCP Improvements Applied:
 * - #1 (Type Safety): Uses type guards from @/types/video for discriminated union
 * - NO React.memo(): This is a wrapper component, not a leaf component
 *
 * @example
 * // Rating field
 * <FieldDisplay
 *   fieldValue={ratingFieldValue}
 *   size="md"
 *   onChange={(newValue) => console.log(newValue)}
 * />
 *
 * @example
 * // Read-only field
 * <FieldDisplay
 *   fieldValue={selectFieldValue}
 *   readonly
 * />
 */
export const FieldDisplay: React.FC<FieldDisplayProps> = ({
  fieldValue,
  readonly = false,
  size = 'md',
  onChange,
}) => {
  // REF MCP #1: Type-safe routing using discriminated union type guards
  if (isRatingFieldValue(fieldValue)) {
    return (
      <RatingStars
        value={fieldValue.value}
        maxRating={fieldValue.field.config.max_rating}
        size={size}
        fieldName={fieldValue.field_name}
        readonly={readonly}
        onChange={(newValue) => onChange?.(newValue)}
      />
    )
  }

  if (isSelectFieldValue(fieldValue)) {
    return (
      <SelectBadge
        value={fieldValue.value}
        options={fieldValue.field.config.options}
        fieldName={fieldValue.field_name}
        readonly={readonly}
        onChange={(newValue) => onChange?.(newValue)}
      />
    )
  }

  if (isBooleanFieldValue(fieldValue)) {
    return (
      <BooleanCheckbox
        value={fieldValue.value}
        fieldName={fieldValue.field_name}
        readonly={readonly}
        onChange={(newValue) => onChange?.(newValue)}
      />
    )
  }

  if (isTextFieldValue(fieldValue)) {
    return (
      <TextSnippet
        value={fieldValue.value}
        fieldName={fieldValue.field_name}
        maxLength={fieldValue.field.config.max_length}
        readonly={readonly}
        onChange={(newValue) => onChange?.(newValue)}
      />
    )
  }

  // Fallback for unknown field types
  return (
    <div className="text-sm text-muted-foreground" onClick={(e) => e.stopPropagation()}>
      Unknown field type: {(fieldValue.field as { field_type?: string }).field_type}
    </div>
  )
}
