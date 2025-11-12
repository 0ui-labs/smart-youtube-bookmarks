import { z } from 'zod'
import { CustomFieldSchema } from './customFields'

// ============================================================================
// Schema Field Item (for creation)
// ============================================================================

export const SchemaFieldItemSchema = z.object({
  field_id: z.string().uuid(),
  display_order: z.number().int().min(0),
  show_on_card: z.boolean().default(false),
})

export type SchemaFieldItem = z.infer<typeof SchemaFieldItemSchema>

// ============================================================================
// Schema Field Response (nested in FieldSchemaResponse)
// ============================================================================

export const SchemaFieldResponseSchema = z.object({
  field_id: z.string().uuid(),
  schema_id: z.string().uuid(),
  display_order: z.number().int().min(0),
  show_on_card: z.boolean(),
  // Nested full field details (eliminates N+1 queries)
  field: CustomFieldSchema,
})

export type SchemaFieldResponse = z.infer<typeof SchemaFieldResponseSchema>

// ============================================================================
// Field Schema Response (GET endpoints)
// ============================================================================

export const FieldSchemaResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  list_id: z.string().uuid(),
  created_at: z.string(), // ISO datetime string
  updated_at: z.string(),
  // Nested schema_fields with full field details
  schema_fields: z.array(SchemaFieldResponseSchema),
})

export type FieldSchemaResponse = z.infer<typeof FieldSchemaResponseSchema>

export const FieldSchemasResponseSchema = z.array(FieldSchemaResponseSchema)

// ============================================================================
// Create/Update Schemas
// ============================================================================

export const FieldSchemaCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  fields: z.array(SchemaFieldItemSchema).default([]),
})

export type FieldSchemaCreate = z.infer<typeof FieldSchemaCreateSchema>

export const FieldSchemaUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
})

export type FieldSchemaUpdate = z.infer<typeof FieldSchemaUpdateSchema>

// ============================================================================
// Schema-Field Association Operations
// ============================================================================

export const SchemaFieldCreateSchema = z.object({
  field_id: z.string().uuid(),
  display_order: z.number().int().min(0),
  show_on_card: z.boolean().default(false),
})

export type SchemaFieldCreate = z.infer<typeof SchemaFieldCreateSchema>

export const SchemaFieldUpdateSchema = z.object({
  display_order: z.number().int().min(0).optional(),
  show_on_card: z.boolean().optional(),
})

export type SchemaFieldUpdate = z.infer<typeof SchemaFieldUpdateSchema>

// ============================================================================
// Reorder Operation (for optimistic updates)
// ============================================================================

export const ReorderSchemaFieldsSchema = z.array(z.object({
  field_id: z.string().uuid(),
  display_order: z.number().int().min(0),
}))

export type ReorderSchemaFields = z.infer<typeof ReorderSchemaFieldsSchema>

// ============================================================================
// Batch Update Operations (Task #126)
// ============================================================================

/**
 * Single field update item for batch operations.
 *
 * Used in FieldOrderManager for drag-drop reordering + show_on_card toggling.
 * Backend validates max 3 show_on_card=true constraint.
 */
export const SchemaFieldUpdateItemSchema = z.object({
  field_id: z.string().uuid(),
  display_order: z.number().int().min(0),
  show_on_card: z.boolean(),
})

export type SchemaFieldUpdateItem = z.infer<typeof SchemaFieldUpdateItemSchema>

/**
 * Batch update request schema.
 *
 * PUT /api/lists/{list_id}/schemas/{schema_id}/fields/batch
 *
 * Constraints:
 * - Min 1, Max 50 fields per request
 * - Backend validates max 3 show_on_card=true
 * - Backend validates no duplicate field_ids
 * - Backend validates no duplicate display_orders
 */
export const SchemaFieldBatchUpdateRequestSchema = z.object({
  fields: z.array(SchemaFieldUpdateItemSchema).min(1).max(50),
})

export type SchemaFieldBatchUpdateRequest = z.infer<typeof SchemaFieldBatchUpdateRequestSchema>

/**
 * Batch update response schema.
 *
 * Returns updated count + full field details for cache updates.
 */
export const SchemaFieldBatchUpdateResponseSchema = z.object({
  updated_count: z.number().int(),
  fields: z.array(SchemaFieldResponseSchema),
})

export type SchemaFieldBatchUpdateResponse = z.infer<typeof SchemaFieldBatchUpdateResponseSchema>

// ============================================================================
// API Error Response (for MSW handlers and error handling)
// REF MCP Improvement #3: Type-safe error responses
// ============================================================================

export type ApiErrorResponse = {
  detail: string
}
