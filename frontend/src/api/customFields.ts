import axios from 'axios'
import { CustomFieldCreate, CustomField, DuplicateCheckResponse, DuplicateCheckResponseSchema, CustomFieldSchema } from '@/types/customField'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Check if a field name already exists (case-insensitive)
 *
 * REF MCP: Use debouncing at call site, not in API client
 */
export async function checkFieldNameDuplicate(
  listId: string,
  name: string
): Promise<DuplicateCheckResponse> {
  const response = await axios.post(
    `${API_BASE_URL}/api/lists/${listId}/custom-fields/check-duplicate`,
    { name: name.trim() }
  )

  // Validate response with Zod
  return DuplicateCheckResponseSchema.parse(response.data)
}

/**
 * Create a new custom field
 */
export async function createCustomField(
  listId: string,
  data: CustomFieldCreate
): Promise<CustomField> {
  const response = await axios.post(
    `${API_BASE_URL}/api/lists/${listId}/custom-fields`,
    data
  )

  return CustomFieldSchema.parse(response.data)
}
