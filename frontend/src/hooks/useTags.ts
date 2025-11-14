import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TagsSchema, TagSchema, type Tag, type TagCreate } from '@/types/tag'
import type {
  BulkApplySchemaRequest,
  BulkApplySchemaResponse,
  TagUpdateResult
} from '@/types/bulk'

/**
 * Query options factory for tags
 * Enables type-safe reuse of query configuration
 *
 * @example
 * ```ts
 * // Use in useQuery
 * useQuery(tagsOptions())
 *
 * // Use with queryClient
 * queryClient.setQueryData(tagsOptions().queryKey, newTags)
 * queryClient.invalidateQueries({ queryKey: tagsOptions().queryKey })
 * ```
 */
export function tagsOptions() {
  return queryOptions({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get<Tag[]>('/tags')
      // Validate response with Zod schema
      return TagsSchema.parse(data)
    },
  })
}

/**
 * React Query hook to fetch all tags for the current user
 *
 * @returns Query result with tags array
 *
 * @example
 * ```tsx
 * const { data: tags, isLoading, error } = useTags()
 * ```
 */
export const useTags = () => {
  return useQuery(tagsOptions())
}

/**
 * React Query mutation hook to create a new tag
 *
 * Automatically invalidates tags query after successful creation or error
 * to ensure UI consistency
 *
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const createTag = useCreateTag()
 *
 * createTag.mutate({ name: 'Python', color: '#3B82F6' })
 * ```
 */
export const useCreateTag = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['createTag'],
    mutationFn: async (tagData: TagCreate) => {
      const { data } = await api.post<Tag>('/tags', tagData)
      // Validate response with Zod schema (consistent with tagsOptions)
      return TagSchema.parse(data)
    },
    onError: (error) => {
      console.error('Failed to create tag:', error)
    },
    onSettled: async () => {
      // Invalidate and refetch to ensure UI consistency
      // This runs on both success and error to handle edge cases
      await queryClient.invalidateQueries({ queryKey: tagsOptions().queryKey })
    },
  })
}

/**
 * Hook to apply schema to multiple tags in bulk
 *
 * Uses frontend-side batch processing with Promise.allSettled for partial failure handling.
 * Each tag is updated individually via PUT /api/tags/{tag_id}.
 *
 * @returns Mutation hook with progress tracking and error details
 *
 * @example
 * ```tsx
 * const bulkApply = useBulkApplySchema()
 *
 * bulkApply.mutate({
 *   tagIds: ['uuid1', 'uuid2', 'uuid3'],
 *   schemaId: 'schema-uuid' // or null to unbind
 * })
 *
 * // Access results
 * if (bulkApply.data) {
 *   console.log(`${bulkApply.data.successCount} of ${bulkApply.data.totalRequested} updated`)
 *   bulkApply.data.results.filter(r => !r.success).forEach(failure => {
 *     console.error(`Failed to update ${failure.tagName}: ${failure.error}`)
 *   })
 * }
 * ```
 */
export const useBulkApplySchema = () => {
  const queryClient = useQueryClient()

  return useMutation<
    BulkApplySchemaResponse,
    Error,
    BulkApplySchemaRequest,
    { previousTags: Tag[] | undefined }
  >({
    mutationKey: ['bulkApplySchema'],
    mutationFn: async ({ tagIds, schemaId }: BulkApplySchemaRequest) => {
      // Fetch current tags to get names for error reporting
      const currentTags = queryClient.getQueryData<Tag[]>(tagsOptions().queryKey) || []
      const tagMap = new Map(currentTags.map(t => [t.id, t]))

      // Execute all updates in parallel with Promise.all
      const updatePromises = tagIds.map(async (tagId): Promise<TagUpdateResult> => {
        try {
          await api.put(`/tags/${tagId}`, { schema_id: schemaId })
          return {
            tagId,
            tagName: tagMap.get(tagId)?.name || 'Unknown',
            success: true,
          }
        } catch (error: any) {
          return {
            tagId,
            tagName: tagMap.get(tagId)?.name || 'Unknown',
            success: false,
            error: error.response?.data?.detail || error.message || 'Unknown error',
          }
        }
      })

      const results = await Promise.all(updatePromises)

      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length

      return {
        successCount,
        failureCount,
        totalRequested: tagIds.length,
        results,
      }
    },

    // Optimistic updates
    onMutate: async ({ tagIds, schemaId }) => {
      // Cancel outgoing queries to prevent overwrites
      await queryClient.cancelQueries({ queryKey: tagsOptions().queryKey })

      // Snapshot previous state for rollback
      const previousTags = queryClient.getQueryData<Tag[]>(tagsOptions().queryKey)

      // Optimistically update tags
      if (previousTags) {
        queryClient.setQueryData<Tag[]>(
          tagsOptions().queryKey,
          previousTags.map(tag =>
            tagIds.includes(tag.id)
              ? { ...tag, schema_id: schemaId }
              : tag
          )
        )
      }

      return { previousTags }
    },

    // Rollback on error
    // Note: This only rolls back the optimistic updates, not individual tag failures.
    // Individual failures are captured in the response and handled by the UI.
    onError: (error, _variables, context) => {
      console.error('Bulk schema application failed:', error)
      if (context?.previousTags) {
        queryClient.setQueryData(tagsOptions().queryKey, context.previousTags)
      }
    },

    // Always invalidate to ensure consistency
    // REF MCP Improvement: Invalidate both tags AND schemas to keep schema usage counts accurate
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tagsOptions().queryKey })
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
    },
  })
}
