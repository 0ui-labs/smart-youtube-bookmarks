import { api } from "@/lib/api";
import type {
  CustomField,
  CustomFieldCreate,
  CustomFieldUpdate,
  DuplicateCheckRequest,
  DuplicateCheckResponse,
} from "@/types/customFields";

/**
 * API client for custom fields endpoints
 * Base path: /api/lists/{listId}/custom-fields
 *
 * All endpoints are list-scoped for validation and authorization
 */
export const customFieldsApi = {
  /**
   * Get all custom fields for a list
   */
  async getAll(listId: string): Promise<CustomField[]> {
    const { data } = await api.get<CustomField[]>(
      `/lists/${listId}/custom-fields`
    );
    return data ?? [];
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
    );
    return data;
  },

  /**
   * Update an existing custom field
   * Requires listId for list validation and authorization
   */
  async update(
    listId: string,
    fieldId: string,
    fieldData: CustomFieldUpdate
  ): Promise<CustomField> {
    const { data } = await api.put<CustomField>(
      `/lists/${listId}/custom-fields/${fieldId}`,
      fieldData
    );
    return data;
  },

  /**
   * Delete a custom field
   * Requires listId for list validation and authorization
   * Will fail if field is used in any schema
   */
  async delete(listId: string, fieldId: string): Promise<void> {
    await api.delete(`/lists/${listId}/custom-fields/${fieldId}`);
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
    );
    return data;
  },
};
