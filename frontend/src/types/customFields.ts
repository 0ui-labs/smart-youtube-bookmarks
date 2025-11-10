import { z } from 'zod'

/**
 * Field type literal union for custom fields
 *
 * Matches backend FieldType (Literal['select', 'rating', 'text', 'boolean'])
 *
 * @example
 * // Valid: Type narrowing works
 * const fieldType: FieldType = 'rating'
 * if (fieldType === 'rating') {
 *   console.log('This is a rating field')
 * }
 *
 * @example
 * // Invalid: Compile error
 * const invalid: FieldType = 'invalid' // ❌ Type '"invalid"' is not assignable to type 'FieldType'
 */
export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

/**
 * Zod schema for FieldType validation
 *
 * @example
 * // Valid
 * FieldTypeSchema.parse('rating') // ✅ Returns 'rating'
 *
 * @example
 * // Invalid
 * FieldTypeSchema.parse('invalid') // ❌ Throws ZodError
 */
export const FieldTypeSchema = z.enum(['select', 'rating', 'text', 'boolean'])

// ============================================================================
// Config Types (Type-Specific Configurations)
// ============================================================================

/**
 * Configuration for 'select' field type
 *
 * Select fields provide a dropdown with predefined options.
 * Backend validation: min 1 option, all options must be non-empty strings
 *
 * @example
 * // Valid: Presentation quality select field
 * const config: SelectConfig = {
 *   options: ['bad', 'all over the place', 'confusing', 'great']
 * }
 *
 * @example
 * // Invalid: Empty options array
 * const invalid: SelectConfig = {
 *   options: [] // ❌ Type error - must have at least 1 option
 * }
 */
export type SelectConfig = {
  options: [string, ...string[]] // Non-empty array (at least 1 option)
}

/**
 * Zod schema for SelectConfig validation
 *
 * @example
 * // Valid
 * SelectConfigSchema.parse({ options: ['bad', 'good', 'great'] }) // ✅
 *
 * @example
 * // Invalid: Empty array
 * SelectConfigSchema.parse({ options: [] }) // ❌ ZodError: Array must contain at least 1 element(s)
 */
export const SelectConfigSchema = z.object({
  options: z.array(z.string().min(1)).min(1),
})

/**
 * Configuration for 'rating' field type
 *
 * Rating fields provide numeric scales (e.g., 1-5 stars).
 * Backend validation: max_rating must be between 1 and 10
 *
 * @example
 * // Valid: 5-star rating scale
 * const config: RatingConfig = {
 *   max_rating: 5
 * }
 *
 * @example
 * // Valid: 10-point scale
 * const config: RatingConfig = {
 *   max_rating: 10
 * }
 *
 * @example
 * // Invalid: max_rating too high
 * const invalid: RatingConfig = {
 *   max_rating: 20 // ❌ Backend validation error: must be between 1-10
 * }
 */
export type RatingConfig = {
  max_rating: number // 1-10 (validated by backend)
}

/**
 * Zod schema for RatingConfig validation
 *
 * @example
 * // Valid
 * RatingConfigSchema.parse({ max_rating: 5 }) // ✅
 *
 * @example
 * // Invalid: max_rating too high
 * RatingConfigSchema.parse({ max_rating: 20 }) // ❌ ZodError: Number must be less than or equal to 10
 */
export const RatingConfigSchema = z.object({
  max_rating: z.number().int().min(1).max(10),
})

/**
 * Configuration for 'text' field type
 *
 * Text fields allow free-form text input with optional length limits.
 * Backend validation: max_length must be ≥1 if specified
 *
 * @example
 * // Valid: Text field with 500-character limit
 * const config: TextConfig = {
 *   max_length: 500
 * }
 *
 * @example
 * // Valid: Text field with no limit
 * const config: TextConfig = {}
 *
 * @example
 * // Invalid: max_length too low
 * const invalid: TextConfig = {
 *   max_length: 0 // ❌ Backend validation error: must be ≥1 if specified
 * }
 */
export type TextConfig = {
  max_length?: number // ≥1 if specified (validated by backend)
}

/**
 * Zod schema for TextConfig validation
 *
 * @example
 * // Valid: With max_length
 * TextConfigSchema.parse({ max_length: 500 }) // ✅
 *
 * @example
 * // Valid: Without max_length
 * TextConfigSchema.parse({}) // ✅
 *
 * @example
 * // Invalid: max_length too low
 * TextConfigSchema.parse({ max_length: 0 }) // ❌ ZodError: Number must be greater than or equal to 1
 */
export const TextConfigSchema = z.object({
  max_length: z.number().int().min(1).optional(),
})

/**
 * Configuration for 'boolean' field type
 *
 * Boolean fields provide yes/no checkboxes. No configuration needed.
 * Backend validation: config must be empty object
 *
 * @example
 * // Valid: Empty config
 * const config: BooleanConfig = {}
 */
export type BooleanConfig = Record<string, never> // Empty object

/**
 * Zod schema for BooleanConfig validation
 *
 * @example
 * // Valid: Empty object
 * BooleanConfigSchema.parse({}) // ✅
 *
 * @example
 * // Invalid: Non-empty config
 * BooleanConfigSchema.parse({ foo: 'bar' }) // ❌ ZodError: Unrecognized key
 */
export const BooleanConfigSchema = z.object({}).strict()

/**
 * Union type for all possible field configurations
 *
 * Used in CustomField, CustomFieldCreate, CustomFieldUpdate types.
 * The actual config shape depends on field_type.
 *
 * @example
 * // Valid: Rating config
 * const config: FieldConfig = { max_rating: 5 }
 *
 * @example
 * // Valid: Select config
 * const config: FieldConfig = { options: ['bad', 'good', 'great'] }
 *
 * @example
 * // Valid: Text config
 * const config: FieldConfig = { max_length: 500 }
 *
 * @example
 * // Valid: Boolean config (empty)
 * const config: FieldConfig = {}
 */
export type FieldConfig = SelectConfig | RatingConfig | TextConfig | BooleanConfig

/**
 * Zod discriminated union schema for CustomField with config validation
 *
 * This schema uses .refine() to validate that config shape matches field_type.
 * This is REF MCP Improvement #2: Discriminated union with .refine() validation.
 *
 * @example
 * // Valid: Rating field with matching config
 * CustomFieldSchema.parse({
 *   field_type: 'rating',
 *   config: { max_rating: 5 }
 * }) // ✅
 *
 * @example
 * // Invalid: Rating field with select config
 * CustomFieldSchema.parse({
 *   field_type: 'rating',
 *   config: { options: ['bad', 'good'] }
 * }) // ❌ ZodError: Config shape must match field_type
 *
 * @example
 * // Invalid: Select field with rating config
 * CustomFieldSchema.parse({
 *   field_type: 'select',
 *   config: { max_rating: 5 }
 * }) // ❌ ZodError: Config shape must match field_type
 */
export const CustomFieldSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  field_type: FieldTypeSchema,
  config: z.record(z.any()), // Accept any object, validate shape in .refine()
  created_at: z.string(),
  updated_at: z.string(),
}).refine((data) => {
  // REF MCP Improvement #2: Validate config shape matches field_type
  switch (data.field_type) {
    case 'select':
      return SelectConfigSchema.safeParse(data.config).success
    case 'rating':
      return RatingConfigSchema.safeParse(data.config).success
    case 'text':
      return TextConfigSchema.safeParse(data.config).success
    case 'boolean':
      return BooleanConfigSchema.safeParse(data.config).success
    default:
      return false
  }
}, {
  message: "Config shape must match field_type",
  path: ['config'],
})

/**
 * CustomField type inferred from Zod schema
 *
 * Represents a reusable evaluation criterion for videos (e.g., "Presentation Quality",
 * "Overall Rating"). Fields are list-scoped and support four types: select, rating,
 * text, boolean.
 *
 * Matches backend CustomFieldResponse schema (Task #64).
 *
 * @example
 * // Rating field example
 * const field: CustomField = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Overall Rating',
 *   field_type: 'rating',
 *   config: { max_rating: 5 },
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 *
 * @example
 * // Select field example
 * const field: CustomField = {
 *   id: '223e4567-e89b-12d3-a456-426614174001',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Presentation Quality',
 *   field_type: 'select',
 *   config: { options: ['bad', 'all over the place', 'confusing', 'great'] },
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 */
export type CustomField = z.infer<typeof CustomFieldSchema>

/**
 * Schema for creating a new custom field
 *
 * Used in: POST /api/lists/{list_id}/custom-fields
 * Matches backend CustomFieldCreate schema (Task #64).
 *
 * @example
 * // Valid: Create rating field with as const
 * const request: CustomFieldCreate = {
 *   name: 'Overall Rating',
 *   field_type: 'rating' as const,
 *   config: { max_rating: 5 } as const
 * }
 *
 * @example
 * // Valid: Create select field
 * const request: CustomFieldCreate = {
 *   name: 'Presentation Quality',
 *   field_type: 'select' as const,
 *   config: { options: ['bad', 'good', 'great'] } as const
 * }
 *
 * @example
 * // Valid: Create text field with max_length
 * const request: CustomFieldCreate = {
 *   name: 'Notes',
 *   field_type: 'text' as const,
 *   config: { max_length: 500 } as const
 * }
 *
 * @example
 * // Valid: Create boolean field
 * const request: CustomFieldCreate = {
 *   name: 'Recommended',
 *   field_type: 'boolean' as const,
 *   config: {} as const
 * }
 */
export const CustomFieldCreateSchema = z.object({
  name: z.string().min(1).max(255),
  field_type: FieldTypeSchema,
  config: z.record(z.any()), // Accept any object, validate shape in .refine()
}).refine((data) => {
  // REF MCP Improvement #2: Validate config shape matches field_type
  switch (data.field_type) {
    case 'select':
      return SelectConfigSchema.safeParse(data.config).success
    case 'rating':
      return RatingConfigSchema.safeParse(data.config).success
    case 'text':
      return TextConfigSchema.safeParse(data.config).success
    case 'boolean':
      return BooleanConfigSchema.safeParse(data.config).success
    default:
      return false
  }
}, {
  message: "Config shape must match field_type",
  path: ['config'],
})

export type CustomFieldCreate = z.infer<typeof CustomFieldCreateSchema>

/**
 * Schema for updating an existing custom field
 *
 * Used in: PUT /api/custom-fields/{field_id}
 * Matches backend CustomFieldUpdate schema (Task #64).
 * All fields are optional to support partial updates.
 *
 * @example
 * // Valid: Update only name
 * const request: CustomFieldUpdate = {
 *   name: 'Updated Field Name'
 * }
 *
 * @example
 * // Valid: Update name and config
 * const request: CustomFieldUpdate = {
 *   name: 'Overall Rating',
 *   field_type: 'rating' as const,
 *   config: { max_rating: 10 } as const
 * }
 *
 * @example
 * // Valid: Update only config
 * const request: CustomFieldUpdate = {
 *   config: { max_rating: 10 } as const
 * }
 *
 * @example
 * // Invalid: Mismatched field_type and config
 * const invalid: CustomFieldUpdate = {
 *   field_type: 'rating' as const,
 *   config: { options: ['bad', 'good'] } as const // ❌ Config doesn't match field_type
 * }
 *
 * Note: Backend validates that changing field_type on existing fields with values
 * requires confirmation.
 */
export const CustomFieldUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  field_type: FieldTypeSchema.optional(),
  config: z.record(z.any()).optional(),
}).refine((data) => {
  // REF MCP Improvement #2: Validate config shape matches field_type (if both present)
  if (!data.field_type || !data.config) {
    return true // Skip validation if either is missing (partial update)
  }

  switch (data.field_type) {
    case 'select':
      return SelectConfigSchema.safeParse(data.config).success
    case 'rating':
      return RatingConfigSchema.safeParse(data.config).success
    case 'text':
      return TextConfigSchema.safeParse(data.config).success
    case 'boolean':
      return BooleanConfigSchema.safeParse(data.config).success
    default:
      return false
  }
}, {
  message: "Config shape must match field_type",
  path: ['config'],
})

export type CustomFieldUpdate = z.infer<typeof CustomFieldUpdateSchema>

// ============================================================================
// Field Schema Types (Task #65)
// ============================================================================

/**
 * SchemaFieldInput type for adding a field to a schema during creation
 *
 * Used in FieldSchemaCreate.fields array to specify initial fields.
 * Matches backend SchemaFieldInput schema (Task #65).
 *
 * @example
 * // Valid: Add field to schema with display order
 * const input: SchemaFieldInput = {
 *   field_id: '123e4567-e89b-12d3-a456-426614174000',
 *   display_order: 0,
 *   show_on_card: true
 * }
 *
 * @example
 * // Valid: Add field without showing on card
 * const input: SchemaFieldInput = {
 *   field_id: '223e4567-e89b-12d3-a456-426614174001',
 *   display_order: 1,
 *   show_on_card: false
 * }
 */
export type SchemaFieldInput = {
  field_id: string // UUID
  display_order: number // 0-indexed
  show_on_card: boolean
}

/**
 * Zod schema for SchemaFieldInput validation
 *
 * @example
 * // Valid
 * SchemaFieldInputSchema.parse({
 *   field_id: '123e4567-e89b-12d3-a456-426614174000',
 *   display_order: 0,
 *   show_on_card: true
 * }) // ✅
 *
 * @example
 * // Invalid: Negative display_order
 * SchemaFieldInputSchema.parse({
 *   field_id: '123e4567-e89b-12d3-a456-426614174000',
 *   display_order: -1,
 *   show_on_card: true
 * }) // ❌ ZodError: Number must be greater than or equal to 0
 */
export const SchemaFieldInputSchema = z.object({
  field_id: z.string().uuid(),
  display_order: z.number().int().min(0),
  show_on_card: z.boolean(),
})

/**
 * FieldInSchemaResponse type for full custom field details in schema response
 *
 * Includes all CustomField attributes for rich display in frontend.
 * Matches backend FieldInSchemaResponse schema (Task #65).
 *
 * @example
 * // Rating field in schema
 * const field: FieldInSchemaResponse = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Overall Rating',
 *   field_type: 'rating',
 *   config: { max_rating: 5 },
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 */
export type FieldInSchemaResponse = {
  id: string // UUID
  list_id: string // UUID
  name: string
  field_type: FieldType
  config: FieldConfig
  created_at: string
  updated_at: string
}

/**
 * Zod schema for FieldInSchemaResponse validation
 *
 * @example
 * // Valid: Rating field
 * FieldInSchemaResponseSchema.parse({
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Overall Rating',
 *   field_type: 'rating',
 *   config: { max_rating: 5 },
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }) // ✅
 */
export const FieldInSchemaResponseSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  field_type: FieldTypeSchema,
  config: z.record(z.any()),
  created_at: z.string(),
  updated_at: z.string(),
})

/**
 * SchemaFieldResponse type combining schema field metadata with full field details
 *
 * Combines join table metadata (display_order, show_on_card) with full field data.
 * Matches backend SchemaFieldResponse schema (Task #65).
 *
 * @example
 * // Schema field with rating field
 * const schemaField: SchemaFieldResponse = {
 *   field_id: '123e4567-e89b-12d3-a456-426614174000',
 *   schema_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   display_order: 0,
 *   show_on_card: true,
 *   field: {
 *     id: '123e4567-e89b-12d3-a456-426614174000',
 *     list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *     name: 'Overall Rating',
 *     field_type: 'rating',
 *     config: { max_rating: 5 },
 *     created_at: '2025-11-06T10:30:00Z',
 *     updated_at: '2025-11-06T10:30:00Z'
 *   }
 * }
 */
export type SchemaFieldResponse = {
  field_id: string // UUID
  schema_id: string // UUID
  display_order: number
  show_on_card: boolean
  field: FieldInSchemaResponse
}

/**
 * Zod schema for SchemaFieldResponse validation
 *
 * @example
 * // Valid: Schema field with rating field
 * SchemaFieldResponseSchema.parse({
 *   field_id: '123e4567-e89b-12d3-a456-426614174000',
 *   schema_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   display_order: 0,
 *   show_on_card: true,
 *   field: {
 *     id: '123e4567-e89b-12d3-a456-426614174000',
 *     list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *     name: 'Overall Rating',
 *     field_type: 'rating',
 *     config: { max_rating: 5 },
 *     created_at: '2025-11-06T10:30:00Z',
 *     updated_at: '2025-11-06T10:30:00Z'
 *   }
 * }) // ✅
 */
export const SchemaFieldResponseSchema = z.object({
  field_id: z.string().uuid(),
  schema_id: z.string().uuid(),
  display_order: z.number().int().min(0),
  show_on_card: z.boolean(),
  field: FieldInSchemaResponseSchema,
})

/**
 * FieldSchemaCreate type for creating a new field schema
 *
 * Used in: POST /api/lists/{list_id}/schemas
 * Matches backend FieldSchemaCreate schema (Task #65).
 *
 * Validates:
 * - Max 3 fields can have show_on_card=true
 * - No duplicate display_order values
 * - No duplicate field_id values
 *
 * @example
 * // Valid: Create schema with 2 fields
 * const request: FieldSchemaCreate = {
 *   name: 'Video Quality',
 *   description: 'Standard quality metrics',
 *   fields: [
 *     {
 *       field_id: '123e4567-e89b-12d3-a456-426614174000',
 *       display_order: 0,
 *       show_on_card: true
 *     },
 *     {
 *       field_id: '223e4567-e89b-12d3-a456-426614174001',
 *       display_order: 1,
 *       show_on_card: true
 *     }
 *   ]
 * }
 *
 * @example
 * // Valid: Create schema without fields
 * const request: FieldSchemaCreate = {
 *   name: 'Video Quality',
 *   description: 'Standard quality metrics'
 * }
 *
 * @example
 * // Invalid: More than 3 fields with show_on_card=true
 * const invalid: FieldSchemaCreate = {
 *   name: 'Video Quality',
 *   fields: [
 *     { field_id: 'uuid-1', display_order: 0, show_on_card: true },
 *     { field_id: 'uuid-2', display_order: 1, show_on_card: true },
 *     { field_id: 'uuid-3', display_order: 2, show_on_card: true },
 *     { field_id: 'uuid-4', display_order: 3, show_on_card: true } // ❌ More than 3
 *   ]
 * }
 */
export type FieldSchemaCreate = {
  name: string // 1-255 characters
  description?: string | null // 0-1000 characters
  fields?: SchemaFieldInput[] // Optional initial fields
}

/**
 * Zod schema for FieldSchemaCreate validation
 *
 * Includes all 3 backend validators:
 * 1. Max 3 fields with show_on_card=true
 * 2. No duplicate display_order values
 * 3. No duplicate field_id values
 *
 * @example
 * // Valid: Schema with 2 fields
 * FieldSchemaCreateSchema.parse({
 *   name: 'Video Quality',
 *   description: 'Standard quality metrics',
 *   fields: [
 *     { field_id: '123e4567-e89b-12d3-a456-426614174000', display_order: 0, show_on_card: true },
 *     { field_id: '223e4567-e89b-12d3-a456-426614174001', display_order: 1, show_on_card: true }
 *   ]
 * }) // ✅
 *
 * @example
 * // Invalid: Duplicate display_order
 * FieldSchemaCreateSchema.parse({
 *   name: 'Video Quality',
 *   fields: [
 *     { field_id: '123e4567-e89b-12d3-a456-426614174000', display_order: 0, show_on_card: true },
 *     { field_id: '223e4567-e89b-12d3-a456-426614174001', display_order: 0, show_on_card: true }
 *   ]
 * }) // ❌ ZodError: Duplicate display_order values found
 */
export const FieldSchemaCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  fields: z.array(SchemaFieldInputSchema).optional(),
}).refine((data) => {
  // Validator 1: Max 3 fields with show_on_card=true
  if (!data.fields) return true
  const showOnCardFields = data.fields.filter(f => f.show_on_card)
  return showOnCardFields.length <= 3
}, {
  message: "At most 3 fields can have show_on_card=true",
  path: ['fields'],
}).refine((data) => {
  // Validator 2: No duplicate display_order values
  if (!data.fields) return true
  const displayOrders = data.fields.map(f => f.display_order)
  return displayOrders.length === new Set(displayOrders).size
}, {
  message: "Duplicate display_order values found. Each field must have a unique display_order.",
  path: ['fields'],
}).refine((data) => {
  // Validator 3: No duplicate field_id values
  if (!data.fields) return true
  const fieldIds = data.fields.map(f => f.field_id)
  return fieldIds.length === new Set(fieldIds).size
}, {
  message: "Duplicate field_id values found. Each field can only be added once to a schema.",
  path: ['fields'],
})

/**
 * FieldSchemaUpdate type for updating field schema metadata
 *
 * Used in: PUT /api/lists/{list_id}/schemas/{schema_id}
 * Matches backend FieldSchemaUpdate schema (Task #65).
 *
 * Only updates name and/or description. Field management (adding/removing fields)
 * is handled by separate endpoints in Task #69.
 *
 * @example
 * // Valid: Update name only
 * const request: FieldSchemaUpdate = {
 *   name: 'Updated Video Quality'
 * }
 *
 * @example
 * // Valid: Update both name and description
 * const request: FieldSchemaUpdate = {
 *   name: 'Tutorial Evaluation',
 *   description: 'Comprehensive tutorial assessment criteria'
 * }
 */
export type FieldSchemaUpdate = {
  name?: string // 1-255 characters
  description?: string | null // 0-1000 characters
}

/**
 * Zod schema for FieldSchemaUpdate validation
 *
 * @example
 * // Valid: Update name only
 * FieldSchemaUpdateSchema.parse({ name: 'Updated Video Quality' }) // ✅
 *
 * @example
 * // Valid: Update both
 * FieldSchemaUpdateSchema.parse({
 *   name: 'Tutorial Evaluation',
 *   description: 'Comprehensive tutorial assessment criteria'
 * }) // ✅
 *
 * @example
 * // Invalid: Name too short
 * FieldSchemaUpdateSchema.parse({ name: '' }) // ❌ ZodError: String must contain at least 1 character(s)
 */
export const FieldSchemaUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
})

/**
 * FieldSchemaResponse type for field schema response from API
 *
 * Includes all database fields plus eager-loaded schema_fields relationship.
 * Matches backend FieldSchemaResponse schema (Task #65).
 *
 * Used in:
 * - GET /api/lists/{list_id}/schemas (list)
 * - POST /api/lists/{list_id}/schemas (single)
 * - PUT /api/lists/{list_id}/schemas/{schema_id} (single)
 * - GET /api/lists/{list_id}/schemas/{schema_id} (single)
 *
 * @example
 * // Complete schema response with 2 fields
 * const response: FieldSchemaResponse = {
 *   id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   list_id: '123e4567-e89b-12d3-a456-426614174000',
 *   name: 'Video Quality',
 *   description: 'Standard quality metrics',
 *   schema_fields: [
 *     {
 *       field_id: '111e4567-e89b-12d3-a456-426614174000',
 *       schema_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *       display_order: 0,
 *       show_on_card: true,
 *       field: {
 *         id: '111e4567-e89b-12d3-a456-426614174000',
 *         list_id: '123e4567-e89b-12d3-a456-426614174000',
 *         name: 'Presentation Quality',
 *         field_type: 'select',
 *         config: { options: ['bad', 'good', 'great'] },
 *         created_at: '2025-11-06T10:00:00Z',
 *         updated_at: '2025-11-06T10:00:00Z'
 *       }
 *     },
 *     {
 *       field_id: '222e4567-e89b-12d3-a456-426614174001',
 *       schema_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *       display_order: 1,
 *       show_on_card: true,
 *       field: {
 *         id: '222e4567-e89b-12d3-a456-426614174001',
 *         list_id: '123e4567-e89b-12d3-a456-426614174000',
 *         name: 'Overall Rating',
 *         field_type: 'rating',
 *         config: { max_rating: 5 },
 *         created_at: '2025-11-06T10:00:00Z',
 *         updated_at: '2025-11-06T10:00:00Z'
 *       }
 *     }
 *   ],
 *   created_at: '2025-11-06T09:00:00Z',
 *   updated_at: '2025-11-06T09:00:00Z'
 * }
 */
export type FieldSchemaResponse = {
  id: string // UUID
  list_id: string // UUID
  name: string
  description?: string | null
  schema_fields: SchemaFieldResponse[]
  created_at: string
  updated_at: string
}

/**
 * Zod schema for FieldSchemaResponse validation
 *
 * @example
 * // Valid: Schema with 2 fields
 * FieldSchemaResponseSchema.parse({
 *   id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   list_id: '123e4567-e89b-12d3-a456-426614174000',
 *   name: 'Video Quality',
 *   description: 'Standard quality metrics',
 *   schema_fields: [
 *     {
 *       field_id: '111e4567-e89b-12d3-a456-426614174000',
 *       schema_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *       display_order: 0,
 *       show_on_card: true,
 *       field: { ... }
 *     }
 *   ],
 *   created_at: '2025-11-06T09:00:00Z',
 *   updated_at: '2025-11-06T09:00:00Z'
 * }) // ✅
 */
export const FieldSchemaResponseSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  schema_fields: z.array(SchemaFieldResponseSchema),
  created_at: z.string(),
  updated_at: z.string(),
})

// ============================================================================
// VideoFieldValue Types (Task #62)
// ============================================================================

/**
 * VideoFieldValue type for storing actual field values for videos
 *
 * Stores user-assigned values for custom fields on videos with typed columns
 * for performance. Only ONE of the value_* columns is populated based on field_type.
 *
 * Matches backend VideoFieldValue model (Task #62).
 *
 * IMPORTANT: No created_at column (migration omits it, only id and updated_at).
 *
 * @example
 * // Rating field value (value_numeric populated)
 * const value: VideoFieldValue = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: '111e4567-e89b-12d3-a456-426614174000',
 *   value_text: null,
 *   value_numeric: 4.5,
 *   value_boolean: null,
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 *
 * @example
 * // Select field value (value_text populated)
 * const value: VideoFieldValue = {
 *   id: '223e4567-e89b-12d3-a456-426614174001',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: '222e4567-e89b-12d3-a456-426614174001',
 *   value_text: 'great',
 *   value_numeric: null,
 *   value_boolean: null,
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 *
 * @example
 * // Boolean field value (value_boolean populated)
 * const value: VideoFieldValue = {
 *   id: '323e4567-e89b-12d3-a456-426614174002',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: '333e4567-e89b-12d3-a456-426614174002',
 *   value_text: null,
 *   value_numeric: null,
 *   value_boolean: true,
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 */
export type VideoFieldValue = {
  id: string // UUID (auto-generated)
  video_id: string // UUID (FK to videos.id CASCADE)
  field_id: string // UUID (FK to custom_fields.id CASCADE)
  value_text: string | null // For 'text' and 'select' field types
  value_numeric: number | null // For 'rating' field types
  value_boolean: boolean | null // For 'boolean' field types
  updated_at: string // Last update timestamp (NO created_at!)
}

/**
 * Zod schema for VideoFieldValue validation
 *
 * @example
 * // Valid: Rating field value
 * VideoFieldValueSchema.parse({
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: '111e4567-e89b-12d3-a456-426614174000',
 *   value_text: null,
 *   value_numeric: 4.5,
 *   value_boolean: null,
 *   updated_at: '2025-11-06T10:30:00Z'
 * }) // ✅
 *
 * @example
 * // Valid: Select field value
 * VideoFieldValueSchema.parse({
 *   id: '223e4567-e89b-12d3-a456-426614174001',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: '222e4567-e89b-12d3-a456-426614174001',
 *   value_text: 'great',
 *   value_numeric: null,
 *   value_boolean: null,
 *   updated_at: '2025-11-06T10:30:00Z'
 * }) // ✅
 */
export const VideoFieldValueSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  field_id: z.string().uuid(),
  value_text: z.string().nullable(),
  value_numeric: z.number().nullable(),
  value_boolean: z.boolean().nullable(),
  updated_at: z.string(),
})

// ============================================================================
// Type Guards (REF MCP Improvement #4: Better type narrowing helpers)
// ============================================================================

/**
 * Type guard to check if a field is a rating field
 *
 * Narrows CustomField type to { field_type: 'rating', config: RatingConfig }
 *
 * @example
 * // Valid: Type narrowing works
 * const field: CustomField = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Overall Rating',
 *   field_type: 'rating',
 *   config: { max_rating: 5 },
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 *
 * if (isRatingField(field)) {
 *   console.log(field.config.max_rating) // ✅ TypeScript knows config has max_rating
 * }
 *
 * @example
 * // Invalid: Type guard returns false
 * const field: CustomField = {
 *   field_type: 'select',
 *   config: { options: ['bad', 'good'] }
 * }
 *
 * if (isRatingField(field)) {
 *   // This block won't execute
 * } else {
 *   console.log('Not a rating field') // ✅ Output
 * }
 */
export function isRatingField(field: CustomField): field is CustomField & { field_type: 'rating'; config: RatingConfig } {
  return field.field_type === 'rating'
}

/**
 * Type guard to check if a field is a select field
 *
 * Narrows CustomField type to { field_type: 'select', config: SelectConfig }
 *
 * @example
 * // Valid: Type narrowing works
 * const field: CustomField = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Presentation Quality',
 *   field_type: 'select',
 *   config: { options: ['bad', 'good', 'great'] },
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 *
 * if (isSelectField(field)) {
 *   console.log(field.config.options) // ✅ TypeScript knows config has options
 * }
 */
export function isSelectField(field: CustomField): field is CustomField & { field_type: 'select'; config: SelectConfig } {
  return field.field_type === 'select'
}

/**
 * Type guard to check if a field is a text field
 *
 * Narrows CustomField type to { field_type: 'text', config: TextConfig }
 *
 * @example
 * // Valid: Type narrowing works
 * const field: CustomField = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Notes',
 *   field_type: 'text',
 *   config: { max_length: 500 },
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 *
 * if (isTextField(field)) {
 *   console.log(field.config.max_length) // ✅ TypeScript knows config has optional max_length
 * }
 */
export function isTextField(field: CustomField): field is CustomField & { field_type: 'text'; config: TextConfig } {
  return field.field_type === 'text'
}

/**
 * Type guard to check if a field is a boolean field
 *
 * Narrows CustomField type to { field_type: 'boolean', config: BooleanConfig }
 *
 * @example
 * // Valid: Type narrowing works
 * const field: CustomField = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Recommended',
 *   field_type: 'boolean',
 *   config: {},
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 *
 * if (isBooleanField(field)) {
 *   console.log('This is a boolean field') // ✅ TypeScript knows field_type is 'boolean'
 * }
 */
export function isBooleanField(field: CustomField): field is CustomField & { field_type: 'boolean'; config: BooleanConfig } {
  return field.field_type === 'boolean'
}

// ============================================================================
// Duplicate Check Types
// ============================================================================

/**
 * Request schema for checking if a field name already exists
 *
 * Used in: POST /api/lists/{list_id}/custom-fields/check-duplicate
 * Performs case-insensitive comparison.
 *
 * @example
 * // Valid: Check if field name exists
 * const request: DuplicateCheckRequest = {
 *   name: 'presentation quality'
 * }
 */
export type DuplicateCheckRequest = {
  name: string // Field name to check (1-255 chars)
}

/**
 * Zod schema for DuplicateCheckRequest validation
 *
 * @example
 * // Valid
 * DuplicateCheckRequestSchema.parse({ name: 'Rating' }) // ✅
 *
 * @example
 * // Invalid: Empty name
 * DuplicateCheckRequestSchema.parse({ name: '' }) // ❌ ZodError
 */
export const DuplicateCheckRequestSchema = z.object({
  name: z.string().min(1).max(255),
})

/**
 * Response schema for duplicate field name check
 *
 * Indicates whether a field with the given name (case-insensitive)
 * already exists. If exists=true, the existing field details are included.
 *
 * @example
 * // Field exists
 * const response: DuplicateCheckResponse = {
 *   exists: true,
 *   field: {
 *     id: '123e4567-e89b-12d3-a456-426614174000',
 *     list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *     name: 'Presentation Quality',
 *     field_type: 'select',
 *     config: { options: ['bad', 'good', 'great'] },
 *     created_at: '2025-11-06T10:30:00Z',
 *     updated_at: '2025-11-06T10:30:00Z'
 *   }
 * }
 *
 * @example
 * // Field does not exist
 * const response: DuplicateCheckResponse = {
 *   exists: false,
 *   field: null
 * }
 */
export type DuplicateCheckResponse = {
  exists: boolean
  field: CustomField | null
}

/**
 * Zod schema for DuplicateCheckResponse validation
 *
 * @example
 * // Valid: Field exists
 * DuplicateCheckResponseSchema.parse({
 *   exists: true,
 *   field: { id: '...', name: 'Rating', ... }
 * }) // ✅
 *
 * @example
 * // Valid: Field does not exist
 * DuplicateCheckResponseSchema.parse({
 *   exists: false,
 *   field: null
 * }) // ✅
 */
export const DuplicateCheckResponseSchema = z.object({
  exists: z.boolean(),
  field: CustomFieldSchema.nullable(),
})

/**
 * Helper for parsing arrays of CustomField from API responses
 *
 * @example
 * const fields = CustomFieldsSchema.parse(apiResponse)
 */
export const CustomFieldsSchema = z.array(CustomFieldSchema)
