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
// API Error Response (for MSW handlers and error handling)
// REF MCP Improvement #3: Type-safe error responses
// ============================================================================

export type ApiErrorResponse = {
  detail: string
}
