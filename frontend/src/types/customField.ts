import { z } from 'zod'

/**
 * Field type discriminated union matching backend CustomField.field_type
 *
 * REF MCP: Use Literal instead of Enum for better Zod integration
 */
export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

/**
 * Type-specific config interfaces
 */

/**
 * Configuration for 'select' field type
 * Select fields provide a dropdown with predefined options.
 */
export type SelectConfig = {
  options: string[] // Min 1 option, validated by backend
}

/**
 * Configuration for 'rating' field type
 * Rating fields provide numeric scales (e.g., 1-5 stars).
 * Backend validation: max_rating must be between 1 and 10
 */
export type RatingConfig = {
  max_rating: number // 1-10 (validated by backend)
}

/**
 * Configuration for 'text' field type
 * Text fields allow free-form text input with optional length limits.
 * Backend validation: max_length must be ≥1 if specified
 */
export type TextConfig = {
  max_length?: number | null // ≥1 if specified (validated by backend)
}

/**
 * Configuration for 'boolean' field type
 * Boolean fields provide yes/no checkboxes. No configuration needed.
 */
export type BooleanConfig = Record<string, never> // Empty object

/**
 * Type-specific config schemas matching backend validation
 */
export const SelectConfigSchema = z.object({
  options: z.array(z.string().min(1)).min(1, 'At least one option required')
})

export const RatingConfigSchema = z.object({
  max_rating: z.number().int().min(1).max(10)
})

export const TextConfigSchema = z.object({
  max_length: z.number().int().min(1).optional().nullable()
})

export const BooleanConfigSchema = z.object({})

/**
 * Discriminated union type for field config
 * The actual config shape depends on field_type.
 */
export type FieldConfig = SelectConfig | RatingConfig | TextConfig | BooleanConfig

/**
 * FieldValue type - Union of all possible field value types
 * Value type depends on field_type: rating=number, select=string, text=string, boolean=boolean
 */
export type FieldValue = string | number | boolean | null

/**
 * CustomField schema matching backend CustomFieldResponse
 */
export const CustomFieldSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  field_type: z.enum(['select', 'rating', 'text', 'boolean']),
  config: z.record(z.any()), // Validated separately based on field_type
  created_at: z.string(),
  updated_at: z.string(),
})

export type CustomField = z.infer<typeof CustomFieldSchema>

/**
 * Schema for creating new field (matches backend CustomFieldCreate)
 */
export const CustomFieldCreateSchema = z.object({
  name: z.string()
    .min(1, 'Field name is required')
    .max(255, 'Field name must be 255 characters or less')
    .refine(val => val.trim().length > 0, 'Field name cannot be only whitespace'),
  field_type: z.enum(['select', 'rating', 'text', 'boolean']),
  config: z.record(z.any()), // Type-specific validation in form
})

export type CustomFieldCreate = z.infer<typeof CustomFieldCreateSchema>

/**
 * Schema for updating existing field (matches backend CustomFieldUpdate)
 * All fields are optional to support partial updates.
 */
export const CustomFieldUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Field name is required')
    .max(255, 'Field name must be 255 characters or less')
    .optional(),
  field_type: z.enum(['select', 'rating', 'text', 'boolean']).optional(),
  config: z.record(z.any()).optional(), // Type-specific validation in form
})

export type CustomFieldUpdate = z.infer<typeof CustomFieldUpdateSchema>

/**
 * Duplicate check response schema
 */
export const DuplicateCheckResponseSchema = z.object({
  exists: z.boolean(),
  field: CustomFieldSchema.nullable(),
})

export type DuplicateCheckResponse = z.infer<typeof DuplicateCheckResponseSchema>

/**
 * Extended CustomField with usage statistics
 * Used by FieldsList component to show schema usage count
 */
export interface CustomFieldWithUsage extends CustomField {
  usage_count: number; // Number of schemas using this field
}
