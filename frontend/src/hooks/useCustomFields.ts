import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query'
import { customFieldsApi } from '@/lib/customFieldsApi'
import {
  CustomFieldsSchema,
  CustomFieldSchema,
  DuplicateCheckResponseSchema,
  type CustomField,
  type CustomFieldCreate,
  type CustomFieldUpdate,
} from '@/types/customFields'
import { useDebounce } from '@/hooks/useDebounce'

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query Key Factory for custom fields
 *
 * Follows hierarchical structure from generic to specific:
 * - all: ['custom-fields']
 * - lists: ['custom-fields', 'list']
 * - list: ['custom-fields', 'list', listId]
 * - detail: ['custom-fields', 'detail', fieldId]
 *
 * Benefits:
 * - Invalidate all fields: invalidateQueries({ queryKey: customFieldKeys.all })
 * - Invalidate one list: invalidateQueries({ queryKey: customFieldKeys.list(listId) })
 * - Precise cache targeting for optimistic updates
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 */
export const customFieldKeys = {
  /** Base key for all custom field queries */
  all: ['custom-fields'] as const,

  /** Key factory for list-scoped queries */
  lists: () => [...customFieldKeys.all, 'list'] as const,

  /** Key for all fields in a specific list */
  list: (listId: string) => [...customFieldKeys.lists(), listId] as const,

  /** Key factory for detail queries */
  details: () => [...customFieldKeys.all, 'detail'] as const,

  /** Key for a specific field detail (future use for GET /custom-fields/{id}) */
  detail: (fieldId: string) => [...customFieldKeys.details(), fieldId] as const,
}

// ============================================================================
// Query Options Helper
// ============================================================================

/**
 * Query options factory for custom fields
 * Enables type-safe reuse of query configuration
 *
 * @example
 * ```ts
 * // Use in useQuery
 * useQuery(customFieldsOptions(listId))
 *
 * // Use with queryClient
 * queryClient.setQueryData(customFieldsOptions(listId).queryKey, newFields)
 * queryClient.invalidateQueries({ queryKey: customFieldsOptions(listId).queryKey })
 * ```
 */
export function customFieldsOptions(listId: string) {
  return queryOptions({
    queryKey: customFieldKeys.list(listId),
    queryFn: async () => {
      const data = await customFieldsApi.getAll(listId)
      // Validate response with Zod schema for runtime safety
      return CustomFieldsSchema.parse(data)
    },
    // REF MCP: staleTime prevents unnecessary refetches
    // Custom fields change infrequently, so 5 minutes is reasonable
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * React Query hook to fetch all custom fields for a list
 *
 * @param listId - UUID of the list
 * @returns Query result with custom fields array
 *
 * @example
 * ```tsx
 * const { data: fields, isLoading, error } = useCustomFields(listId)
 *
 * if (isLoading) return <Spinner />
 * if (error) return <ErrorBanner error={error} />
 *
 * return fields.map(field => <FieldCard key={field.id} field={field} />)
 * ```
 */
export const useCustomFields = (listId: string) => {
  return useQuery(customFieldsOptions(listId))
}

/**
 * React Query hook to check if a field name already exists (case-insensitive)
 *
 * IMPORTANT: This is a query (not mutation) because it doesn't modify state
 * Debounced to avoid excessive API calls while user types
 *
 * @param listId - UUID of the list
 * @param name - Field name to check (debounced 300ms)
 * @param options - Query options (enabled flag)
 * @returns Query result with duplicate check response
 *
 * @example
 * ```tsx
 * const [fieldName, setFieldName] = useState('')
 * const duplicateCheck = useCheckDuplicateField(listId, fieldName, {
 *   enabled: fieldName.length > 0
 * })
 *
 * if (duplicateCheck.data?.exists) {
 *   return <ErrorMessage>Field "{duplicateCheck.data.field.name}" already exists</ErrorMessage>
 * }
 * ```
 */
export const useCheckDuplicateField = (
  listId: string,
  name: string,
  options?: { enabled?: boolean }
) => {
  // Debounce the name value (300ms)
  const debouncedName = useDebounce(name, 300)

  return useQuery({
    queryKey: ['checkDuplicateField', listId, debouncedName] as const,
    queryFn: async () => {
      const data = await customFieldsApi.checkDuplicate(listId, {
        name: debouncedName,
      })
      return DuplicateCheckResponseSchema.parse(data)
    },
    enabled: (options?.enabled ?? true) && debouncedName.length > 0,
    staleTime: 0, // Always fresh
    retry: false, // Fast fail
  })
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * React Query mutation hook to create a new custom field
 *
 * Automatically invalidates custom fields query after successful creation
 * to ensure UI consistency
 *
 * @param listId - UUID of the list
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const createField = useCreateCustomField(listId)
 *
 * createField.mutate({
 *   name: 'Presentation Quality',
 *   field_type: 'select',
 *   config: { options: ['bad', 'good', 'great'] }
 * })
 *
 * if (createField.isSuccess) {
 *   toast.success('Field created!')
 * }
 * ```
 */
export const useCreateCustomField = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['createCustomField', listId],
    mutationFn: async (fieldData: CustomFieldCreate) => {
      const data = await customFieldsApi.create(listId, fieldData)
      // Validate response with Zod schema (consistent with query)
      return CustomFieldSchema.parse(data)
    },
    onError: (error) => {
      console.error('Failed to create custom field:', error)
    },
    onSettled: async () => {
      // Invalidate and refetch to ensure UI consistency
      // This runs on both success and error to handle edge cases
      await queryClient.invalidateQueries({
        queryKey: customFieldKeys.list(listId),
      })
    },
  })
}

/**
 * React Query mutation hook to update an existing custom field
 *
 * Supports partial updates (all fields in CustomFieldUpdate are optional)
 * Invalidates query after success to refetch updated data
 *
 * @param listId - UUID of the list
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const updateField = useUpdateCustomField(listId)
 *
 * // Update only name
 * updateField.mutate({
 *   fieldId: 'uuid',
 *   data: { name: 'New Name' }
 * })
 *
 * // Update name and config
 * updateField.mutate({
 *   fieldId: 'uuid',
 *   data: {
 *     name: 'Rating',
 *     config: { max_rating: 10 }
 *   }
 * })
 * ```
 */
export const useUpdateCustomField = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateCustomField', listId],
    mutationFn: async ({
      fieldId,
      data,
    }: {
      fieldId: string
      data: CustomFieldUpdate
    }) => {
      const result = await customFieldsApi.update(listId, fieldId, data)
      return CustomFieldSchema.parse(result)
    },
    onError: (error) => {
      console.error('Failed to update custom field:', error)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: customFieldKeys.list(listId),
      })
    },
  })
}

/**
 * React Query mutation hook to delete a custom field
 *
 * IMPORTANT: Backend will reject deletion if field is used in any schema
 * Frontend should check field usage before calling this hook
 *
 * Uses optimistic update to immediately remove from UI
 *
 * @param listId - UUID of the list
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const deleteField = useDeleteCustomField(listId)
 *
 * const handleDelete = async (fieldId: string) => {
 *   if (!confirm('Delete this field?')) return
 *
 *   deleteField.mutate(fieldId, {
 *     onSuccess: () => toast.success('Field deleted'),
 *     onError: (err) => toast.error(err.message)
 *   })
 * }
 * ```
 */
export const useDeleteCustomField = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['deleteCustomField', listId],
    mutationFn: async (fieldId: string) => {
      await customFieldsApi.delete(listId, fieldId)
    },
    // Optimistic update: immediately remove from UI
    onMutate: async (fieldId) => {
      // Cancel outgoing refetches (so they don't overwrite optimistic update)
      await queryClient.cancelQueries({
        queryKey: customFieldKeys.list(listId),
      })

      // Snapshot current value for rollback
      const previous = queryClient.getQueryData<CustomField[]>(
        customFieldKeys.list(listId)
      )

      // Optimistically update cache
      queryClient.setQueryData<CustomField[]>(
        customFieldKeys.list(listId),
        (old) => old?.filter((field) => field.id !== fieldId) ?? []
      )

      return { previous }
    },
    // Rollback on error
    onError: (error, _fieldId, context) => {
      console.error('Failed to delete custom field:', error)
      if (context?.previous) {
        queryClient.setQueryData(customFieldKeys.list(listId), context.previous)
      }
    },
    // Refetch to ensure consistency after success or error
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: customFieldKeys.list(listId),
      })
    },
  })
}
