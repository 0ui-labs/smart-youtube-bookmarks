import { api } from '@/lib/api'
import type {
  CustomField,
  CustomFieldCreate,
  CustomFieldUpdate,
  DuplicateCheckRequest,
  DuplicateCheckResponse,
} from '@/types/customFields'

/**
 * API client for custom fields endpoints
 * Base paths:
 * - GET/POST: /api/lists/{listId}/custom-fields
 * - PUT/DELETE: /api/custom-fields/{fieldId}
 */
export const customFieldsApi = {
  /**
   * Get all custom fields for a list
   */
  async getAll(listId: string): Promise<CustomField[]> {
    const { data } = await api.get<CustomField[]>(
      `/lists/${listId}/custom-fields`
    )
    return data ?? []
  },

  /**
   * Create a new custom field
   */
  async create(
    listId: string,
    fieldData: CustomFieldCreate
  ): Promise<CustomField> {
    const { data } = await api.post<CustomField>(
      `/lists/${listId}/custom-fields`,
      fieldData
    )
    return data
  },

  /**
   * Update an existing custom field
   * Note: Does NOT require listId - field is identified by UUID
   */
  async update(
    fieldId: string,
    fieldData: CustomFieldUpdate
  ): Promise<CustomField> {
    const { data } = await api.put<CustomField>(
      `/custom-fields/${fieldId}`,
      fieldData
    )
    return data
  },

  /**
   * Delete a custom field
   * Note: Does NOT require listId - field is identified by UUID
   * Will fail if field is used in any schema
   */
  async delete(fieldId: string): Promise<void> {
    await api.delete(`/custom-fields/${fieldId}`)
  },

  /**
   * Check if field name already exists (case-insensitive)
   */
  async checkDuplicate(
    listId: string,
    request: DuplicateCheckRequest
  ): Promise<DuplicateCheckResponse> {
    const { data } = await api.post<DuplicateCheckResponse>(
      `/lists/${listId}/custom-fields/check-duplicate`,
      request
    )
    return data
  },
}
