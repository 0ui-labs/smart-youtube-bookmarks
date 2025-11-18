/**
 * React Query hooks for managing video custom field values.
 *
 * Provides queries and mutations for fetching and updating field values
 * with simplified optimistic updates (React Query v5 pattern).
 *
 * @see backend/app/api/videos.py - GET /videos/{id} includes field_values
 * @see backend/app/api/videos.py - PUT /videos/{id}/fields batch update
 * @see Task #71 - Video endpoint field_values integration
 * @see Task #72 - Batch update endpoint
 */

import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { videoFieldValuesApi } from '@/lib/videoFieldValuesApi'
import { videoKeys } from './useVideos'
import type { FieldValueUpdate } from '@/types/video'

/**
 * Query options factory for video field values.
 * Enables type-safe reusability across useQuery/prefetchQuery/setQueryData.
 *
 * @param videoId - UUID of the video
 * @returns Query options object
 */
export function videoFieldValuesOptions(videoId: string) {
  return queryOptions({
    queryKey: videoKeys.videoFieldValues(videoId),
    queryFn: async () => videoFieldValuesApi.getFieldValues(videoId),
    staleTime: 5 * 60 * 1000, // 5 minutes (field values change infrequently)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/**
 * React Query hook to fetch custom field values for a video.
 *
 * Fetches field values from the video endpoint which includes field_values
 * in the response via Task #71 implementation.
 *
 * @param videoId - UUID of the video
 * @returns Query result with field values array
 *
 * @example
 * ```tsx
 * const { data: fieldValues, isLoading, error } = useVideoFieldValues(videoId)
 *
 * if (isLoading) return <Skeleton />
 * if (error) return <ErrorMessage />
 *
 * return (
 *   <div>
 *     {fieldValues?.map(fv => (
 *       <FieldDisplay key={fv.field_id} fieldValue={fv} />
 *     ))}
 *   </div>
 * )
 * ```
 */
export const useVideoFieldValues = (videoId: string) => {
  return useQuery(videoFieldValuesOptions(videoId))
}

/**
 * React Query mutation hook to batch update video field values.
 *
 * Uses React Query v5 simplified optimistic updates pattern:
 * - UI components read mutation.variables directly during isPending
 * - No manual cache manipulation (less error-prone)
 * - Automatic cache invalidation via onSettled
 *
 * @param videoId - UUID of the video to update
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const { data: fieldValues } = useVideoFieldValues(videoId)
 * const updateFields = useUpdateVideoFieldValues(videoId)
 *
 * // UI-based optimistic updates (v5 pattern):
 * return (
 *   <div>
 *     {fieldValues?.map(fv => {
 *       // Show pending value during mutation:
 *       const pendingValue = updateFields.isPending &&
 *         updateFields.variables?.find(v => v.field_id === fv.field_id)?.value
 *
 *       return (
 *         <FieldDisplay
 *           key={fv.field_id}
 *           value={pendingValue ?? fv.value}
 *           opacity={updateFields.isPending ? 0.5 : 1}
 *         />
 *       )
 *     })}
 *   </div>
 * )
 * ```
 */
export const useUpdateVideoFieldValues = (videoId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateVideoFieldValues', videoId],

    mutationFn: async (updates: FieldValueUpdate[]) => {
      return videoFieldValuesApi.updateFieldValues(videoId, updates)
    },

    // React Query v5: Use onSettled for cache invalidation (not deprecated onSuccess)
    onSettled: async () => {
      // Invalidate field values query to refetch from server
      await queryClient.invalidateQueries({
        queryKey: videoKeys.videoFieldValues(videoId)
      })

      // Also invalidate video queries (field_values included in video response)
      await queryClient.invalidateQueries({
        queryKey: videoKeys.all
      })
    },

    // Error logging for debugging
    onError: (error) => {
      console.error('Failed to update field values:', error)
    },
  })
}
