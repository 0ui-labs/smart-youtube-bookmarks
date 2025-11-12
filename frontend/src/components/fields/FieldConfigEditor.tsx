/**
 * FieldConfigEditor Component
 *
 * Parent component that conditionally renders type-specific config editors
 * based on the selected field type.
 *
 * Supported field types:
 * - 'select' → SelectConfigEditor (dynamic options list)
 * - 'rating' → RatingConfigEditor (max_rating input 1-10)
 * - 'text' → TextConfigEditor (optional max_length input)
 * - 'boolean' → null (no config needed)
 *
 * REF MCP Improvements (Task #123):
 * - Field component pattern established in NewFieldForm
 * - Type-safe discriminated union for FieldConfig
 * - Conditional rendering via switch statement
 */

import { Control } from 'react-hook-form'
import { FieldType } from '@/types/customField'
import { SelectConfigEditor } from './SelectConfigEditor'
import { RatingConfigEditor } from './RatingConfigEditor'
import { TextConfigEditor } from './TextConfigEditor'

interface SelectConfig {
  options: string[]
}

interface RatingConfig {
  max_rating: number
}

interface TextConfig {
  max_length?: number
}

interface BooleanConfig {
  // Empty - no configuration needed
}

export type FieldConfig = SelectConfig | RatingConfig | TextConfig | BooleanConfig

export interface FieldConfigEditorProps {
  /**
   * The field type determines which config editor to render
   */
  fieldType: FieldType

  /**
   * Current config value (controlled component)
   */
  config: FieldConfig

  /**
   * Callback when config changes (validation happens here)
   */
  onChange: (config: FieldConfig) => void

  /**
   * React Hook Form control (required for SelectConfigEditor useFieldArray)
   */
  control?: Control<any>

  /**
   * External error message (e.g., from form validation)
   */
  error?: string
}

/**
 * FieldConfigEditor - Parent component for type-specific config editors
 *
 * Conditionally renders the appropriate sub-component based on fieldType:
 * - 'select' → SelectConfigEditor (dynamic options list)
 * - 'rating' → RatingConfigEditor (max_rating input 1-10)
 * - 'text' → TextConfigEditor (optional max_length input)
 * - 'boolean' → null (no config needed)
 *
 * Validation is performed in each sub-component and bubbled up via onChange.
 *
 * @example
 * ```tsx
 * <FieldConfigEditor
 *   fieldType="rating"
 *   config={{ max_rating: 5 }}
 *   onChange={(config) => setFormConfig(config)}
 *   error={validationError}
 * />
 * ```
 */
export function FieldConfigEditor({
  fieldType,
  config,
  onChange,
  control,
  error,
}: FieldConfigEditorProps) {
  switch (fieldType) {
    case 'select':
      // SelectConfigEditor requires control for useFieldArray
      if (!control) {
        console.error('SelectConfigEditor requires control prop for useFieldArray')
        return null
      }
      return (
        <SelectConfigEditor
          control={control}
          error={error}
        />
      )

    case 'rating':
      return (
        <RatingConfigEditor
          config={config as RatingConfig}
          onChange={onChange}
          error={error}
        />
      )

    case 'text':
      return (
        <TextConfigEditor
          config={config as TextConfig}
          onChange={onChange}
          error={error}
        />
      )

    case 'boolean':
      // Boolean fields have no configuration
      // onChange is called with empty object on mount
      if (Object.keys(config).length > 0) {
        onChange({}) // Ensure empty config for boolean
      }
      return null

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = fieldType
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      void _exhaustive
      return null
  }
}
