import { z } from 'zod'

/**
 * Field type discriminated union matching backend CustomField.field_type
 *
 * REF MCP: Use Literal instead of Enum for better Zod integration
 */
export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

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
  max_length: z.number().int().min(1).optional()
})

export const BooleanConfigSchema = z.object({})

/**
 * Union type for field config (discriminated by field_type)
 */
export type FieldConfig =
  | z.infer<typeof SelectConfigSchema>
  | z.infer<typeof RatingConfigSchema>
  | z.infer<typeof TextConfigSchema>
  | z.infer<typeof BooleanConfigSchema>

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
 * Duplicate check response schema
 */
export const DuplicateCheckResponseSchema = z.object({
  exists: z.boolean(),
  field: CustomFieldSchema.nullable(),
})

export type DuplicateCheckResponse = z.infer<typeof DuplicateCheckResponseSchema>
