import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query'
import { schemasApi } from '@/lib/schemasApi'
import type {
  FieldSchemaResponse,
  FieldSchemaCreate,
  FieldSchemaUpdate,
  SchemaFieldCreate,
  SchemaFieldUpdate,
  ReorderSchemaFields,
} from '@/types/schema'

// ============================================================================
// Query Keys Factory (Step 3)
// ============================================================================

/**
 * Query keys factory for schemas.
 *
 * Hierarchical structure enables granular invalidation:
 * - schemasKeys.all() → Invalidates ALL schema queries
 * - schemasKeys.lists() → Invalidates all schema list queries
 * - schemasKeys.list(listId) → Invalidates schemas for specific list
 * - schemasKeys.details() → Invalidates all schema detail queries
 * - schemasKeys.detail(schemaId) → Invalidates specific schema details
 *
 * REF MCP: TanStack Query docs recommend hierarchical key structure
 * for efficient invalidation without over-fetching.
 *
 * @example
 * ```ts
 * // Invalidate all schemas after creating new schema
 * queryClient.invalidateQueries({ queryKey: schemasKeys.all() })
 *
 * // Invalidate only schemas for specific list
 * queryClient.invalidateQueries({ queryKey: schemasKeys.list(listId) })
 *
 * // Invalidate specific schema details (after field added)
 * queryClient.invalidateQueries({ queryKey: schemasKeys.detail(schemaId) })
 * ```
 */
export const schemasKeys = {
  all: () => ['schemas'] as const,
  lists: () => [...schemasKeys.all(), 'list'] as const,
  list: (listId: string) => [...schemasKeys.lists(), listId] as const,
  details: () => [...schemasKeys.all(), 'detail'] as const,
  detail: (schemaId: string) => [...schemasKeys.details(), schemaId] as const,
}

// ============================================================================
// Query Options & Hooks (Step 4)
// ============================================================================

/**
 * Query options for schemas list.
 *
 * Benefits of queryOptions:
 * - Type inference for getQueryData/setQueryData
 * - Reusable across useQuery/useSuspenseQuery/prefetchQuery
 * - Co-locates queryKey and queryFn
 *
 * REF MCP: TanStack Query v5 recommends queryOptions for all queries
 * to improve type safety and reduce duplication.
 *
 * REF MCP Improvement #5: Adaptive staleTime
 * - List: 2 minutes (schemas list changes during creation)
 * - Detail: 5 minutes (single schema more stable)
 */
export function schemasOptions(listId: string) {
  return queryOptions({
    queryKey: schemasKeys.list(listId),
    queryFn: async () => schemasApi.getSchemas(listId),
    // Lower staleTime for lists (user creates/deletes schemas frequently)
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Query options for single schema details.
 *
 * Used for schema detail modal/page.
 * Prefetch on hover for instant opening.
 */
export function schemaOptions(listId: string, schemaId: string) {
  return queryOptions({
    queryKey: schemasKeys.detail(schemaId),
    queryFn: async () => schemasApi.getSchema(listId, schemaId),
    // Higher staleTime for details (single schema changes less frequently)
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch all schemas for a list.
 *
 * Returns schemas with nested fields (eager loaded by backend).
 *
 * @example
 * ```tsx
 * function SchemaList({ listId }: { listId: string }) {
 *   const { data: schemas, isLoading, error } = useSchemas(listId)
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <ErrorMessage error={error} />
 *
 *   return (
 *     <div>
 *       {schemas?.map(schema => (
 *         <SchemaCard key={schema.id} schema={schema} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useSchemas(listId: string) {
  return useQuery(schemasOptions(listId))
}

/**
 * Hook to fetch single schema with nested fields.
 *
 * Dependent query: only runs if schemaId is provided.
 *
 * REF MCP: Dependent queries use `enabled` option to control execution.
 *
 * REF MCP Improvement #2: listId parameter clarity
 * Both listId and schemaId parameters are REQUIRED for proper routing.
 *
 * @param listId - The list ID containing the schema (required for API path)
 * @param schemaId - The schema ID to fetch (optional for dependent query pattern)
 *
 * @example
 * ```tsx
 * // In component with both listId and optional schemaId
 * function SchemaModal({ listId, schemaId }: { listId: string, schemaId?: string }) {
 *   const { data: schema, isLoading } = useSchema(listId, schemaId)
 *
 *   if (!schemaId) return null  // Modal closed
 *   if (isLoading) return <Spinner />
 *
 *   return <SchemaDetails schema={schema} />
 * }
 * ```
 */
export function useSchema(listId: string, schemaId?: string) {
  return useQuery({
    ...schemaOptions(listId, schemaId!),
    // Dependent query: only run if schemaId exists
    enabled: !!schemaId,
  })
}

/**
 * Prefetch schema details on hover for instant modal opening.
 *
 * REF MCP: Prefetching in event handlers improves perceived performance.
 *
 * @example
 * ```tsx
 * function SchemaCard({ schema, listId }: Props) {
 *   const prefetchSchema = usePrefetchSchema(listId)
 *
 *   return (
 *     <div
 *       onMouseEnter={() => prefetchSchema(schema.id)}
 *       onClick={() => openModal(schema.id)}
 *     >
 *       {schema.name}
 *     </div>
 *   )
 * }
 * ```
 */
export function usePrefetchSchema(listId: string) {
  const queryClient = useQueryClient()

  return (schemaId: string) => {
    queryClient.prefetchQuery(schemaOptions(listId, schemaId))
  }
}

// ============================================================================
// Schema Mutation Hooks (Step 5)
// ============================================================================

/**
 * Hook to create new schema with optional fields.
 *
 * Invalidation strategy:
 * - Invalidates schemas list (new schema appears immediately)
 * - Does NOT invalidate schema details (new schema has no detail view yet)
 *
 * @example
 * ```tsx
 * function CreateSchemaForm({ listId }: Props) {
 *   const createSchema = useCreateSchema(listId)
 *
 *   const handleSubmit = (formData: FieldSchemaCreate) => {
 *     createSchema.mutate(formData, {
 *       onSuccess: (newSchema) => {
 *         toast.success(`Schema "${newSchema.name}" created`)
 *         navigate(`/schemas/${newSchema.id}`)
 *       },
 *       onError: (error) => {
 *         if (error.response?.status === 409) {
 *           toast.error('Schema name already exists')
 *         }
 *       }
 *     })
 *   }
 *
 *   return <form onSubmit={handleSubmit}>...</form>
 * }
 * ```
 */
export function useCreateSchema(listId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['createSchema', listId],
    mutationFn: async (schemaData: FieldSchemaCreate) =>
      schemasApi.createSchema(listId, schemaData),
    onSuccess: () => {
      // Invalidate schemas list to show new schema
      queryClient.invalidateQueries({ queryKey: schemasKeys.list(listId) })
    },
  })
}

/**
 * Hook to update schema metadata (name/description).
 *
 * Field associations are managed via schema-field hooks.
 *
 * Invalidation strategy:
 * - Invalidates schemas list (name change visible in list)
 * - Invalidates specific schema details (detail modal shows update)
 *
 * @example
 * ```tsx
 * function EditSchemaForm({ listId, schemaId }: Props) {
 *   const updateSchema = useUpdateSchema(listId)
 *
 *   const handleSubmit = (updates: FieldSchemaUpdate) => {
 *     updateSchema.mutate({ schemaId, updates }, {
 *       onSuccess: () => {
 *         toast.success('Schema updated')
 *       }
 *     })
 *   }
 *
 *   return <form onSubmit={handleSubmit}>...</form>
 * }
 * ```
 */
export function useUpdateSchema(listId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateSchema', listId],
    mutationFn: async ({
      schemaId,
      updates,
    }: {
      schemaId: string
      updates: FieldSchemaUpdate
    }) => schemasApi.updateSchema(listId, schemaId, updates),
    onSuccess: (_data, variables) => {
      // Invalidate both list and detail views
      queryClient.invalidateQueries({ queryKey: schemasKeys.list(listId) })
      queryClient.invalidateQueries({
        queryKey: schemasKeys.detail(variables.schemaId),
      })
    },
  })
}

/**
 * Hook to delete schema.
 *
 * Backend validates schema is not used by tags (409 Conflict).
 * Frontend should show confirmation modal with tag count before calling.
 *
 * Invalidation strategy:
 * - Invalidates schemas list (removed schema disappears)
 * - Removes specific schema from cache (detail modal closes)
 *
 * @example
 * ```tsx
 * function DeleteSchemaButton({ listId, schemaId }: Props) {
 *   const deleteSchema = useDeleteSchema(listId)
 *
 *   const handleDelete = async () => {
 *     const confirmed = await confirmDialog({
 *       title: 'Delete schema?',
 *       message: 'This will remove the schema from all tags.',
 *     })
 *
 *     if (confirmed) {
 *       deleteSchema.mutate(schemaId, {
 *         onSuccess: () => {
 *           toast.success('Schema deleted')
 *           navigate('/schemas')
 *         },
 *         onError: (error) => {
 *           if (error.response?.status === 409) {
 *             toast.error('Cannot delete schema used by tags')
 *           }
 *         }
 *       })
 *     }
 *   }
 *
 *   return <Button onClick={handleDelete}>Delete</Button>
 * }
 * ```
 */
export function useDeleteSchema(listId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['deleteSchema', listId],
    mutationFn: async (schemaId: string) =>
      schemasApi.deleteSchema(listId, schemaId),
    onSuccess: (_data, schemaId) => {
      // Remove from list
      queryClient.invalidateQueries({ queryKey: schemasKeys.list(listId) })
      // Remove detail cache
      queryClient.removeQueries({ queryKey: schemasKeys.detail(schemaId) })
    },
  })
}

// ============================================================================
// Schema-Field Mutation Hooks (Step 6)
// ============================================================================

/**
 * Hook to add field to schema.
 *
 * Backend validates:
 * - Field exists in same list
 * - No duplicate field in schema (409 Conflict)
 * - Max 3 show_on_card=true (409 Conflict)
 *
 * Invalidation strategy:
 * - Invalidates schema details (new field appears in modal)
 * - Does NOT invalidate schemas list (list doesn't show fields)
 *
 * @example
 * ```tsx
 * function AddFieldButton({ listId, schemaId, fieldId }: Props) {
 *   const addField = useAddFieldToSchema(listId, schemaId)
 *
 *   const handleAdd = () => {
 *     addField.mutate({
 *       field_id: fieldId,
 *       display_order: nextOrder,
 *       show_on_card: false,
 *     }, {
 *       onError: (error) => {
 *         if (error.response?.status === 409) {
 *           toast.error('Field already in schema or max 3 show_on_card')
 *         }
 *       }
 *     })
 *   }
 *
 *   return <Button onClick={handleAdd}>Add Field</Button>
 * }
 * ```
 */
export function useAddFieldToSchema(listId: string, schemaId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['addFieldToSchema', schemaId],
    mutationFn: async (fieldData: SchemaFieldCreate) =>
      schemasApi.addFieldToSchema(listId, schemaId, fieldData),
    onSuccess: () => {
      // Only invalidate schema details (list doesn't show fields)
      queryClient.invalidateQueries({ queryKey: schemasKeys.detail(schemaId) })
    },
  })
}

/**
 * Hook to remove field from schema.
 *
 * Deletes SchemaField association only (CustomField remains).
 *
 * Invalidation strategy:
 * - Invalidates schema details (removed field disappears)
 *
 * @example
 * ```tsx
 * function RemoveFieldButton({ listId, schemaId, fieldId }: Props) {
 *   const removeField = useRemoveFieldFromSchema(listId, schemaId)
 *
 *   const handleRemove = () => {
 *     removeField.mutate(fieldId, {
 *       onSuccess: () => {
 *         toast.success('Field removed from schema')
 *       }
 *     })
 *   }
 *
 *   return <Button onClick={handleRemove}>Remove</Button>
 * }
 * ```
 */
export function useRemoveFieldFromSchema(listId: string, schemaId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['removeFieldFromSchema', schemaId],
    mutationFn: async (fieldId: string) =>
      schemasApi.removeFieldFromSchema(listId, schemaId, fieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schemasKeys.detail(schemaId) })
    },
  })
}

/**
 * Hook to update schema field configuration.
 *
 * Used for:
 * - Toggling show_on_card checkbox
 * - Single field display_order change (manual input)
 *
 * For drag-drop reordering, use useReorderSchemaFields instead.
 *
 * @example
 * ```tsx
 * function ShowOnCardCheckbox({ listId, schemaId, fieldId, currentValue }: Props) {
 *   const updateField = useUpdateSchemaField(listId, schemaId)
 *
 *   const handleToggle = (checked: boolean) => {
 *     updateField.mutate({
 *       fieldId,
 *       updates: { show_on_card: checked },
 *     }, {
 *       onError: (error) => {
 *         if (error.response?.status === 409) {
 *           toast.error('Max 3 fields can have show_on_card=true')
 *         }
 *       }
 *     })
 *   }
 *
 *   return <Checkbox checked={currentValue} onChange={handleToggle} />
 * }
 * ```
 */
export function useUpdateSchemaField(listId: string, schemaId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateSchemaField', schemaId],
    mutationFn: async ({
      fieldId,
      updates,
    }: {
      fieldId: string
      updates: SchemaFieldUpdate
    }) => schemasApi.updateSchemaField(listId, schemaId, fieldId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schemasKeys.detail(schemaId) })
    },
  })
}

/**
 * Hook to reorder schema fields with optimistic updates.
 *
 * Optimistic updates provide instant UI feedback for drag-drop.
 * If backend fails, changes rollback automatically.
 *
 * REF MCP: Optimistic updates critical for drag-drop UX.
 *
 * @example
 * ```tsx
 * function DraggableFieldList({ listId, schemaId, fields }: Props) {
 *   const reorderFields = useReorderSchemaFields(listId, schemaId)
 *
 *   const handleDragEnd = (result: DropResult) => {
 *     if (!result.destination) return
 *
 *     const reordered = reorderArray(
 *       fields,
 *       result.source.index,
 *       result.destination.index
 *     ).map((field, index) => ({
 *       field_id: field.field_id,
 *       display_order: index,
 *     }))
 *
 *     reorderFields.mutate(reordered, {
 *       onError: () => {
 *         toast.error('Failed to reorder fields')
 *       }
 *     })
 *   }
 *
 *   return <DragDropContext onDragEnd={handleDragEnd}>...</DragDropContext>
 * }
 * ```
 */
export function useReorderSchemaFields(listId: string, schemaId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['reorderSchemaFields', schemaId],
    mutationFn: async (reorderedFields: ReorderSchemaFields) =>
      schemasApi.reorderSchemaFields(listId, schemaId, reorderedFields),
    // Optimistic update: apply changes immediately
    onMutate: async (reorderedFields) => {
      // Cancel outgoing refetches (prevent race conditions)
      await queryClient.cancelQueries({ queryKey: schemasKeys.detail(schemaId) })

      // Snapshot current value for rollback
      const previousSchema = queryClient.getQueryData<FieldSchemaResponse>(
        schemasKeys.detail(schemaId)
      )

      // Optimistically update cache
      if (previousSchema) {
        queryClient.setQueryData<FieldSchemaResponse>(
          schemasKeys.detail(schemaId),
          (old) => {
            if (!old) return old

            // Create map of field_id → new display_order
            const orderMap = new Map(
              reorderedFields.map((f) => [f.field_id, f.display_order])
            )

            // Update schema_fields with new display_orders
            const updatedFields = old.schema_fields
              .map((sf) => ({
                ...sf,
                display_order: orderMap.get(sf.field_id) ?? sf.display_order,
              }))
              .sort((a, b) => a.display_order - b.display_order)

            return {
              ...old,
              schema_fields: updatedFields,
            }
          }
        )
      }

      // Return context for rollback
      return { previousSchema }
    },
    // Rollback on error
    onError: (_error, _variables, context) => {
      if (context?.previousSchema) {
        queryClient.setQueryData(
          schemasKeys.detail(schemaId),
          context.previousSchema
        )
      }
    },
    // Refetch after success or error to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schemasKeys.detail(schemaId) })
    },
  })
}
