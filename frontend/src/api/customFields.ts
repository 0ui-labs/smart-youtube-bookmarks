import { api } from '@/lib/api'
import { CustomFieldCreate, CustomField, DuplicateCheckResponse, DuplicateCheckResponseSchema, CustomFieldSchema } from '@/types/customField'

/**
 * Check if a field name already exists (case-insensitive)
 *
 * REF MCP: Use debouncing at call site, not in API client
 *
 * Uses shared api client with relative baseURL (works with Vite proxy and MSW)
 */
export async function checkFieldNameDuplicate(
  listId: string,
  name: string
): Promise<DuplicateCheckResponse> {
  const response = await api.post(
    `/lists/${listId}/custom-fields/check-duplicate`,
    { name: name.trim() }
  )

  // Validate response with Zod
  return DuplicateCheckResponseSchema.parse(response.data)
}

/**
 * Create a new custom field
 *
 * Uses shared api client with relative baseURL (works with Vite proxy and MSW)
 */
export async function createCustomField(
  listId: string,
  data: CustomFieldCreate
): Promise<CustomField> {
  const response = await api.post(
    `/lists/${listId}/custom-fields`,
    data
  )

  return CustomFieldSchema.parse(response.data)
}
