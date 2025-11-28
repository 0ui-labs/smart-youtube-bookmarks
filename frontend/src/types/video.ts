import { z } from 'zod'
import {
  RatingConfigSchema,
  SelectConfigSchema,
  BooleanConfigSchema,
  TextConfigSchema,
} from './customFields'

// ============================================================================
// VideoFieldValue Types - Union by field.field_type (REF MCP #1)
// ============================================================================

/**
 * Zod schema for rating field value
 *
 * Matches backend VideoFieldValueResponse for rating field type.
 * Uses value_numeric column (not value_text or value_boolean).
 *
 * @example
 * // Valid: Rating field value
 * RatingFieldValueSchema.parse({
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: '111e4567-e89b-12d3-a456-426614174000',
 *   field_name: 'Overall Rating',
 *   field: {
 *     id: '111e4567-e89b-12d3-a456-426614174000',
 *     list_id: '123e4567-e89b-12d3-a456-426614174000',
 *     name: 'Overall Rating',
 *     field_type: 'rating',
 *     config: { max_rating: 5 },
 *     created_at: '2025-11-06T10:00:00Z',
 *     updated_at: '2025-11-06T10:00:00Z'
 *   },
 *   value: 4,
 *   updated_at: '2025-11-06T10:30:00Z'
 * }) // ✅
 */
export const RatingFieldValueSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  field_id: z.string().uuid(),
  field_name: z.string().min(1),
  show_on_card: z.boolean().default(false),
  field: z.object({
    id: z.string().uuid(),
    list_id: z.string().uuid(),
    name: z.string().min(1).max(255),
    field_type: z.literal('rating'),
    config: RatingConfigSchema,
    created_at: z.string(),
    updated_at: z.string(),
  }),
  value: z.number().nullable(),
  updated_at: z.string(),
})

/**
 * Zod schema for select field value
 *
 * Matches backend VideoFieldValueResponse for select field type.
 * Uses value_text column (not value_numeric or value_boolean).
 *
 * @example
 * // Valid: Select field value
 * SelectFieldValueSchema.parse({
 *   id: '223e4567-e89b-12d3-a456-426614174001',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: '222e4567-e89b-12d3-a456-426614174001',
 *   field_name: 'Quality',
 *   field: {
 *     id: '222e4567-e89b-12d3-a456-426614174001',
 *     list_id: '123e4567-e89b-12d3-a456-426614174000',
 *     name: 'Quality',
 *     field_type: 'select',
 *     config: { options: ['bad', 'good', 'great'] },
 *     created_at: '2025-11-06T10:00:00Z',
 *     updated_at: '2025-11-06T10:00:00Z'
 *   },
 *   value: 'great',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }) // ✅
 */
export const SelectFieldValueSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  field_id: z.string().uuid(),
  field_name: z.string().min(1),
  show_on_card: z.boolean().default(false),
  field: z.object({
    id: z.string().uuid(),
    list_id: z.string().uuid(),
    name: z.string().min(1).max(255),
    field_type: z.literal('select'),
    config: SelectConfigSchema,
    created_at: z.string(),
    updated_at: z.string(),
  }),
  value: z.string().nullable(),
  updated_at: z.string(),
})

/**
 * Zod schema for boolean field value
 *
 * Matches backend VideoFieldValueResponse for boolean field type.
 * Uses value_boolean column (not value_text or value_numeric).
 *
 * @example
 * // Valid: Boolean field value
 * BooleanFieldValueSchema.parse({
 *   id: '323e4567-e89b-12d3-a456-426614174002',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: '333e4567-e89b-12d3-a456-426614174002',
 *   field_name: 'Recommended',
 *   field: {
 *     id: '333e4567-e89b-12d3-a456-426614174002',
 *     list_id: '123e4567-e89b-12d3-a456-426614174000',
 *     name: 'Recommended',
 *     field_type: 'boolean',
 *     config: {},
 *     created_at: '2025-11-06T10:00:00Z',
 *     updated_at: '2025-11-06T10:00:00Z'
 *   },
 *   value: true,
 *   updated_at: '2025-11-06T10:30:00Z'
 * }) // ✅
 */
export const BooleanFieldValueSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  field_id: z.string().uuid(),
  field_name: z.string().min(1),
  show_on_card: z.boolean().default(false),
  field: z.object({
    id: z.string().uuid(),
    list_id: z.string().uuid(),
    name: z.string().min(1).max(255),
    field_type: z.literal('boolean'),
    config: BooleanConfigSchema,
    created_at: z.string(),
    updated_at: z.string(),
  }),
  value: z.boolean().nullable(),
  updated_at: z.string(),
})

/**
 * Zod schema for text field value
 *
 * Matches backend VideoFieldValueResponse for text field type.
 * Uses value_text column (not value_numeric or value_boolean).
 *
 * @example
 * // Valid: Text field value
 * TextFieldValueSchema.parse({
 *   id: '423e4567-e89b-12d3-a456-426614174003',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: '444e4567-e89b-12d3-a456-426614174003',
 *   field_name: 'Notes',
 *   field: {
 *     id: '444e4567-e89b-12d3-a456-426614174003',
 *     list_id: '123e4567-e89b-12d3-a456-426614174000',
 *     name: 'Notes',
 *     field_type: 'text',
 *     config: { max_length: 500 },
 *     created_at: '2025-11-06T10:00:00Z',
 *     updated_at: '2025-11-06T10:00:00Z'
 *   },
 *   value: 'Great tutorial!',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }) // ✅
 */
export const TextFieldValueSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  field_id: z.string().uuid(),
  field_name: z.string().min(1),
  show_on_card: z.boolean().default(false),
  field: z.object({
    id: z.string().uuid(),
    list_id: z.string().uuid(),
    name: z.string().min(1).max(255),
    field_type: z.literal('text'),
    config: TextConfigSchema,
    created_at: z.string(),
    updated_at: z.string(),
  }),
  value: z.string().nullable(),
  updated_at: z.string(),
})

/**
 * Union of all field value types
 *
 * Use field.field_type for type-safe narrowing.
 * Matches backend VideoFieldValueResponse (Task #71).
 *
 * @example
 * // Type narrowing works with manual checks
 * const fieldValue = VideoFieldValueSchema.parse(apiResponse)
 * if (fieldValue.field.field_type === 'rating') {
 *   console.log(fieldValue.value) // TypeScript knows value is number | null
 *   console.log(fieldValue.field.config.max_rating) // ✅ Type-safe access
 * }
 */
export const VideoFieldValueSchema = z.union([
  RatingFieldValueSchema,
  SelectFieldValueSchema,
  BooleanFieldValueSchema,
  TextFieldValueSchema,
])

/**
 * VideoFieldValue type inferred from Zod schema
 *
 * Union type that provides type-safe access to field values.
 * Use field.field_type to narrow the type.
 *
 * @example
 * // Type narrowing example
 * function renderFieldValue(fieldValue: VideoFieldValue) {
 *   switch (fieldValue.field.field_type) {
 *     case 'rating':
 *       return `Rating: ${fieldValue.value}/${fieldValue.field.config.max_rating}`
 *     case 'select':
 *       return `Quality: ${fieldValue.value}`
 *     case 'boolean':
 *       return fieldValue.value ? '✓' : '✗'
 *     case 'text':
 *       return fieldValue.value || 'No notes'
 *   }
 * }
 */
export type VideoFieldValue = z.infer<typeof VideoFieldValueSchema>

// ============================================================================
// VideoResponse Interface (Extended with field_values)
// ============================================================================

// ============================================================================
// AvailableField Type (Task #74 - Field Union)
// ============================================================================

/**
 * Zod schema for AvailableFieldResponse
 *
 * Represents metadata for an available field (without value).
 * Used in detail endpoint to show which fields CAN be filled.
 * Includes schema_name for conflict resolution (Option D).
 */
export const AvailableFieldResponseSchema = z.object({
  field_id: z.string().uuid(),
  field_name: z.string().min(1),
  field_type: z.enum(['rating', 'select', 'text', 'boolean']),
  schema_name: z.string().nullable(),
  display_order: z.number(),
  show_on_card: z.boolean(),
  config: z.record(z.any()).default({}),
})

export type AvailableFieldResponse = z.infer<typeof AvailableFieldResponseSchema>

// ============================================================================
// VideoResponse Interface (Extended with field_values)
// ============================================================================

/**
 * Zod schema for VideoResponse
 *
 * Includes field_values array for displaying custom field data.
 * Includes available_fields for detail endpoint (Task #74 - Field Union).
 * Matches backend VideoResponse schema (Task #71, Task #74).
 */
export const VideoResponseSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  youtube_id: z.string(),
  title: z.string().nullable(),
  channel: z.string().nullable(),
  channel_thumbnail_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable(),
  duration: z.number().nullable(),
  published_at: z.string().nullable(),
  tags: z.array(z.any()), // Tag schema from tag.ts
  processing_status: z.enum(['pending', 'processing', 'completed', 'failed']),
  created_at: z.string(),
  updated_at: z.string(),
  field_values: z.array(VideoFieldValueSchema).optional().default([]),
  available_fields: z.array(AvailableFieldResponseSchema).nullable().optional(),
  // Watch progress tracking (video player integration)
  watch_position: z.number().nullable().optional(),
  watch_position_updated_at: z.string().nullable().optional(),
  // Import progress tracking (Phase 1 - Robust Video Import)
  // IMPORTANT: Use nullable() NOT default() - old videos won't have these fields
  // and we need to distinguish "no value" (old video, already imported) from "created" stage
  import_progress: z.number().nullable().optional(),
  import_stage: z.string().nullable().optional(),
})

/**
 * VideoResponse type inferred from Zod schema
 *
 * Represents a video with metadata and custom field values.
 *
 * @example
 * // Video with field values
 * const video: VideoResponse = {
 *   id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   list_id: '123e4567-e89b-12d3-a456-426614174000',
 *   youtube_id: 'dQw4w9WgXcQ',
 *   title: 'Tutorial Video',
 *   channel: 'Tech Channel',
 *   thumbnail_url: 'https://...',
 *   duration: 600,
 *   published_at: '2024-01-01T00:00:00Z',
 *   tags: [],
 *   processing_status: 'completed',
 *   created_at: '2024-01-01T00:00:00Z',
 *   updated_at: '2024-01-01T00:00:00Z',
 *   field_values: [
 *     {
 *       id: '123e4567-e89b-12d3-a456-426614174000',
 *       video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *       field_id: '111e4567-e89b-12d3-a456-426614174000',
 *       field_name: 'Overall Rating',
 *       field: { ... },
 *       value: 4,
 *       updated_at: '2024-01-01T00:00:00Z'
 *     }
 *   ]
 * }
 */
export type VideoResponse = z.infer<typeof VideoResponseSchema>

export interface VideoCreate {
  url: string
}

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ============================================================================
// Type Guards for VideoFieldValue (REF MCP #1)
// ============================================================================

/**
 * Type guard to check if VideoFieldValue is a rating field
 *
 * @example
 * if (isRatingFieldValue(fieldValue)) {
 *   console.log(fieldValue.field.config.max_rating) // ✅ Type-safe
 * }
 */
export function isRatingFieldValue(
  fieldValue: VideoFieldValue
): fieldValue is VideoFieldValue & {
  field: { field_type: 'rating'; config: { max_rating: number } }
  value: number | null
} {
  return fieldValue.field.field_type === 'rating'
}

/**
 * Type guard to check if VideoFieldValue is a select field
 *
 * @example
 * if (isSelectFieldValue(fieldValue)) {
 *   console.log(fieldValue.field.config.options) // ✅ Type-safe
 * }
 */
export function isSelectFieldValue(
  fieldValue: VideoFieldValue
): fieldValue is VideoFieldValue & {
  field: { field_type: 'select'; config: { options: string[] } }
  value: string | null
} {
  return fieldValue.field.field_type === 'select'
}

/**
 * Type guard to check if VideoFieldValue is a boolean field
 *
 * @example
 * if (isBooleanFieldValue(fieldValue)) {
 *   console.log(fieldValue.value) // ✅ Type-safe (boolean | null)
 * }
 */
export function isBooleanFieldValue(
  fieldValue: VideoFieldValue
): fieldValue is VideoFieldValue & {
  field: { field_type: 'boolean'; config: Record<string, never> }
  value: boolean | null
} {
  return fieldValue.field.field_type === 'boolean'
}

/**
 * Type guard to check if VideoFieldValue is a text field
 *
 * @example
 * if (isTextFieldValue(fieldValue)) {
 *   console.log(fieldValue.field.config.max_length) // ✅ Type-safe
 * }
 */
export function isTextFieldValue(
  fieldValue: VideoFieldValue
): fieldValue is VideoFieldValue & {
  field: {
    field_type: 'text'
    config: { max_length?: number }
  }
  value: string | null
} {
  return fieldValue.field.field_type === 'text'
}

// ============================================================================
// Field Value Update Types (Task #81)
// ============================================================================

/**
 * Single field value update in a batch request.
 * Value type depends on field_type: rating=number, select=string, text=string, boolean=boolean
 *
 * @example
 * // Update a rating field
 * const update: FieldValueUpdate = {
 *   field_id: '111e4567-e89b-12d3-a456-426614174000',
 *   value: 4
 * }
 *
 * // Update a select field
 * const update: FieldValueUpdate = {
 *   field_id: '222e4567-e89b-12d3-a456-426614174001',
 *   value: 'great'
 * }
 *
 * // Clear a field value
 * const update: FieldValueUpdate = {
 *   field_id: '333e4567-e89b-12d3-a456-426614174002',
 *   value: null
 * }
 */
export interface FieldValueUpdate {
  field_id: string
  value: string | number | boolean | null
}

/**
 * Response from PUT /videos/{id}/fields (batch update)
 *
 * Returns updated count and all field values after update.
 * Matches backend BatchUpdateFieldValuesResponse from Task #72.
 *
 * @example
 * // API response after updating 2 fields
 * const response: BatchUpdateFieldValuesResponse = {
 *   updated_count: 2,
 *   field_values: [
 *     {
 *       id: '123e4567-e89b-12d3-a456-426614174000',
 *       video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *       field_id: '111e4567-e89b-12d3-a456-426614174000',
 *       field_name: 'Overall Rating',
 *       field: { ... },
 *       value: 5, // Updated value
 *       updated_at: '2024-01-01T00:05:00Z'
 *     },
 *     {
 *       id: '223e4567-e89b-12d3-a456-426614174001',
 *       video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *       field_id: '222e4567-e89b-12d3-a456-426614174001',
 *       field_name: 'Quality',
 *       field: { ... },
 *       value: 'great', // Updated value
 *       updated_at: '2024-01-01T00:05:00Z'
 *     }
 *   ]
 * }
 */
export interface BatchUpdateFieldValuesResponse {
  updated_count: number
  field_values: VideoFieldValue[]
}
