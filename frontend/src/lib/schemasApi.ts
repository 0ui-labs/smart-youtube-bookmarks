import { api } from './api'
import {
  FieldSchemaResponse,
  FieldSchemasResponseSchema,
  FieldSchemaResponseSchema,
  FieldSchemaCreate,
  FieldSchemaUpdate,
  SchemaFieldCreate,
  SchemaFieldUpdate,
  SchemaFieldResponse,
  SchemaFieldResponseSchema,
  ReorderSchemaFields,
  SchemaFieldBatchUpdateRequest,
  SchemaFieldBatchUpdateResponse,
  SchemaFieldBatchUpdateResponseSchema,
} from '@/types/schema'

/**
 * API client for Field Schema CRUD operations.
 *
 * Endpoints:
 * - GET    /lists/{list_id}/schemas - List all schemas
 * - POST   /lists/{list_id}/schemas - Create schema (with optional fields)
 * - GET    /lists/{list_id}/schemas/{schema_id} - Get single schema
 * - PUT    /lists/{list_id}/schemas/{schema_id} - Update schema metadata
 * - DELETE /lists/{list_id}/schemas/{schema_id} - Delete schema
 *
 * Schema-Field Endpoints (Task #69):
 * - GET    /lists/{list_id}/schemas/{schema_id}/fields - Get schema fields
 * - POST   /lists/{list_id}/schemas/{schema_id}/fields - Add field to schema
 * - PUT    /lists/{list_id}/schemas/{schema_id}/fields/{field_id} - Update field config
 * - DELETE /lists/{list_id}/schemas/{schema_id}/fields/{field_id} - Remove field
 */
export const schemasApi = {
  // ========================================================================
  // Schema CRUD Operations (Task #68)
  // ========================================================================

  /**
   * Fetch all schemas for a list with nested fields.
   *
   * Backend uses eager loading (selectinload) to avoid N+1 queries.
   * Each schema includes schema_fields with full CustomField details.
   */
  async getSchemas(listId: string): Promise<FieldSchemaResponse[]> {
    const { data } = await api.get(`/lists/${listId}/schemas`)
    return FieldSchemasResponseSchema.parse(data)
  },

  /**
   * Fetch single schema with nested fields.
   *
   * Used for schema detail modal/page.
   * Prefetch this on hover for instant modal opening.
   */
  async getSchema(listId: string, schemaId: string): Promise<FieldSchemaResponse> {
    const { data } = await api.get(`/lists/${listId}/schemas/${schemaId}`)
    return FieldSchemaResponseSchema.parse(data)
  },

  /**
   * Create new schema with optional fields.
   *
   * POST /schemas with fields array creates schema + SchemaField associations
   * in a single transaction (backend Task #68).
   *
   * Example:
   * ```ts
   * createSchema('list-uuid', {
   *   name: 'Video Quality',
   *   description: 'Standard metrics',
   *   fields: [
   *     { field_id: 'field-1', display_order: 0, show_on_card: true },
   *     { field_id: 'field-2', display_order: 1, show_on_card: false },
   *   ]
   * })
   * ```
   */
  async createSchema(
    listId: string,
    schema: FieldSchemaCreate
  ): Promise<FieldSchemaResponse> {
    const { data } = await api.post(`/lists/${listId}/schemas`, schema)
    return FieldSchemaResponseSchema.parse(data)
  },

  /**
   * Update schema name/description only.
   *
   * Field associations are managed via schema-field endpoints (Task #69).
   */
  async updateSchema(
    listId: string,
    schemaId: string,
    updates: FieldSchemaUpdate
  ): Promise<FieldSchemaResponse> {
    const { data } = await api.put(`/lists/${listId}/schemas/${schemaId}`, updates)
    return FieldSchemaResponseSchema.parse(data)
  },

  /**
   * Delete schema if not used by tags.
   *
   * Backend returns 409 Conflict if schema is bound to any tags.
   * Frontend should show confirmation modal with tag count.
   */
  async deleteSchema(listId: string, schemaId: string): Promise<void> {
    await api.delete(`/lists/${listId}/schemas/${schemaId}`)
  },

  // ========================================================================
  // Schema-Field Association Operations (Task #69)
  // ========================================================================

  /**
   * Add field to schema with display configuration.
   *
   * Backend validates:
   * - Field exists in same list
   * - No duplicate field in schema (409 Conflict)
   * - Max 3 show_on_card=true (409 Conflict)
   */
  async addFieldToSchema(
    listId: string,
    schemaId: string,
    fieldData: SchemaFieldCreate
  ): Promise<SchemaFieldResponse> {
    const { data } = await api.post(
      `/lists/${listId}/schemas/${schemaId}/fields`,
      fieldData
    )
    return SchemaFieldResponseSchema.parse(data)
  },

  /**
   * Update field display_order or show_on_card.
   *
   * Used for:
   * - Drag-drop reordering (with optimistic updates)
   * - Toggling show_on_card checkbox
   *
   * Backend validates max 3 show_on_card constraint.
   *
   * REF MCP Improvement #1: Use SchemaFieldUpdate TYPE not Schema
   */
  async updateSchemaField(
    listId: string,
    schemaId: string,
    fieldId: string,
    updates: SchemaFieldUpdate  // ✅ FIXED: Type statt Schema
  ): Promise<SchemaFieldResponse> {
    const { data } = await api.put(
      `/lists/${listId}/schemas/${schemaId}/fields/${fieldId}`,
      updates
    )
    return SchemaFieldResponseSchema.parse(data)
  },

  /**
   * Remove field from schema (deletes SchemaField association only).
   *
   * CustomField itself is NOT deleted (managed via Task #79 hooks).
   */
  async removeFieldFromSchema(
    listId: string,
    schemaId: string,
    fieldId: string
  ): Promise<void> {
    await api.delete(`/lists/${listId}/schemas/${schemaId}/fields/${fieldId}`)
  },

  /**
   * Batch reorder schema fields (for drag-drop).
   *
   * IMPLEMENTATION NOTE: Frontend-only helper calling updateSchemaField
   * sequentially. Backend has no batch endpoint (Task #69).
   *
   * LIMITATION (REF MCP Improvement #4): Sequential updates without transaction.
   * If request 3/5 fails, first 2 changes persist (partial state).
   * Optimistic update + rollback mitigate UX impact.
   *
   * FUTURE: Backend batch endpoint (PUT /schemas/{id}/fields/reorder)
   * for atomic updates would eliminate this limitation.
   *
   * Used by useReorderSchemaFields hook for optimistic updates.
   */
  async reorderSchemaFields(
    listId: string,
    schemaId: string,
    reorderedFields: ReorderSchemaFields
  ): Promise<void> {
    // Sequential updates (no transaction guarantee)
    // Optimistic update in hook ensures instant UI feedback
    for (const field of reorderedFields) {
      await this.updateSchemaField(listId, schemaId, field.field_id, {
        display_order: field.display_order,
      })
    }
  },

  /**
   * Batch update schema fields (display_order + show_on_card).
   *
   * PUT /api/lists/{list_id}/schemas/{schema_id}/fields/batch (Task #126)
   *
   * Atomic transaction: All updates succeed or all fail.
   * Used by FieldOrderManager for drag-drop + checkbox toggling.
   *
   * Backend validates:
   * - Max 50 fields per request
   * - Max 3 show_on_card=true
   * - No duplicate field_ids
   * - No duplicate display_orders
   *
   * @example
   * ```ts
   * await updateSchemaFieldsBatch('list-1', 'schema-1', {
   *   fields: [
   *     { field_id: 'field-1', display_order: 0, show_on_card: true },
   *     { field_id: 'field-2', display_order: 1, show_on_card: true },
   *     { field_id: 'field-3', display_order: 2, show_on_card: false },
   *   ]
   * })
   * ```
   */
  async updateSchemaFieldsBatch(
    listId: string,
    schemaId: string,
    request: SchemaFieldBatchUpdateRequest
  ): Promise<SchemaFieldBatchUpdateResponse> {
    const { data } = await api.put(
      `/lists/${listId}/schemas/${schemaId}/fields/batch`,
      request
    )
    return SchemaFieldBatchUpdateResponseSchema.parse(data)
  },
}
