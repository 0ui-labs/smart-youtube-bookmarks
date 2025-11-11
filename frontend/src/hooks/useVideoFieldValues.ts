import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { videoKeys } from '@/hooks/useVideos'
import type { VideoResponse } from '@/types/video'

// ============================================================================
// Types
// ============================================================================

/**
 * Request payload for updating a single field value
 *
 * NOTE: Backend endpoint is `/api/videos/{videoId}/fields` (flat structure),
 * not `/lists/{listId}/videos/{videoId}/fields` as mentioned in original plan.
 *
 * We keep listId parameter for:
 * 1. Query invalidation (invalidate queries for specific list)
 * 2. Future authentication/authorization (ownership checks)
 * 3. Consistency with other hooks (useCustomFields, useVideos)
 */
export interface UpdateFieldValueRequest {
  listId: string       // Used for query invalidation, not API path
  videoId: string
  fieldId: string
  value: string | number | boolean | null
}

/**
 * Response from backend after updating field value
 * Matches backend BatchUpdateFieldValuesResponse.updates[0]
 */
export interface UpdateFieldValueResponse {
  field_id: string
  value: string | number | boolean | null
  updated_at: string
}

/**
 * Backend batch update request format
 * The API expects updates array even for single field
 */
interface BatchUpdateFieldValuesRequest {
  updates: Array<{
    field_id: string
    value: string | number | boolean | null
  }>
}

/**
 * Backend batch update response format
 */
interface BatchUpdateFieldValuesResponse {
  updated_count: number
  updates: UpdateFieldValueResponse[]
}

// ============================================================================
// Mutation Hook
// ============================================================================

/**
 * React Query mutation hook to update a single video field value
 *
 * Uses optimistic updates to immediately reflect changes in UI,
 * with automatic rollback on error.
 *
 * **Backend Endpoint:** `PUT /api/videos/{videoId}/fields`
 *
 * **Optimistic Update Strategy:**
 * - Updates ALL video queries (list and detail views)
 * - Uses videoKeys.all to target all cached video data
 * - Preserves data integrity with snapshot + rollback
 *
 * **Query Invalidation:**
 * - On success: Invalidates all video queries for consistency
 * - Uses refetchType: 'active' to avoid refetching inactive queries
 *
 * @param listId - UUID of the list (used for query invalidation)
 * @returns Mutation hook with mutate function
 *
 * @example
 * ```tsx
 * const updateFieldValue = useUpdateFieldValue(listId)
 *
 * // Update rating field
 * updateFieldValue.mutate({
 *   listId,
 *   videoId: 'video-uuid',
 *   fieldId: 'field-uuid',
 *   value: 4
 * })
 *
 * // Update select field
 * updateFieldValue.mutate({
 *   listId,
 *   videoId: 'video-uuid',
 *   fieldId: 'field-uuid',
 *   value: 'great'
 * })
 *
 * // Clear field value (set to null)
 * updateFieldValue.mutate({
 *   listId,
 *   videoId: 'video-uuid',
 *   fieldId: 'field-uuid',
 *   value: null
 * })
 * ```
 */
export const useUpdateFieldValue = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateFieldValue', listId],
    mutationFn: async (request: UpdateFieldValueRequest) => {
      const { videoId, fieldId, value } = request

      // Backend expects batch format even for single field
      const batchRequest: BatchUpdateFieldValuesRequest = {
        updates: [{ field_id: fieldId, value }],
      }

      // API path: /api/videos/{videoId}/fields (not hierarchical)
      const { data } = await api.put<BatchUpdateFieldValuesResponse>(
        `/videos/${videoId}/fields`,
        batchRequest
      )

      // Return first (and only) update from batch response
      return data.updates[0]
    },

    // Optimistic update: immediately update cache
    onMutate: async (request) => {
      const { videoId, fieldId, value } = request

      // Cancel outgoing refetches (so they don't overwrite optimistic update)
      await queryClient.cancelQueries({ queryKey: videoKeys.all })

      // Snapshot ALL video queries for rollback
      const previousQueries = queryClient
        .getQueryCache()
        .findAll({ queryKey: videoKeys.all })
        .map((query) => ({
          queryKey: query.queryKey,
          data: query.state.data,
        }))

      // Update ALL video queries (list + detail views)
      queryClient.setQueriesData<VideoResponse[]>(
        { queryKey: videoKeys.all },
        (old) => {
          if (!old) return old

          // Update videos array
          return old.map((video) => {
            if (video.id !== videoId) return video

            // Update field_values for matching video
            return {
              ...video,
              field_values: video.field_values.map((fv) =>
                fv.field_id === fieldId
                  ? { ...fv, value: value as any, updated_at: new Date().toISOString() }
                  : fv
              ),
            }
          })
        }
      )

      return { previousQueries }
    },

    // Rollback on error
    onError: (error, _request, context) => {
      console.error('Failed to update field value:', error)

      // Restore all snapshots
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },

    // Invalidate queries on success for consistency
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: videoKeys.all,
        refetchType: 'active', // Only refetch active queries
      })
    },
  })
}
