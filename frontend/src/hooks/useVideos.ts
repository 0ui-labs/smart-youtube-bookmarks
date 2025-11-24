import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '@/lib/api'
import type { VideoResponse, VideoCreate } from '@/types/video'
import { TagSchema } from '@/types/tag'

const VideoResponseSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  youtube_id: z.string().length(11),

  // YouTube Metadata (optional fields from API)
  title: z.string().nullable(),
  channel: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  duration: z.number().nullable(),
  published_at: z.string().nullable(),

  // Tags (many-to-many relationship)
  tags: z.array(TagSchema).default([]),

  processing_status: z.enum(['pending', 'processing', 'completed', 'failed']),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

/**
 * Options for useVideos hook
 *
 * Supports filtering by tags and sorting by fields.
 */
export interface UseVideosOptions {
  /** Array of tag names for OR filtering (videos with ANY of the specified tags) */
  tags?: string[]
  /** Field to sort by: "title" | "duration" | "created_at" | "field:<field_id>" */
  sortBy?: string
  /** Sort order: "asc" (default) | "desc" */
  sortOrder?: "asc" | "desc"
  /** Custom refetch interval in milliseconds */
  refetchInterval?: number
  /** Whether to refetch in background */
  refetchIntervalInBackground?: boolean
}

/**
 * Query Key Factory for video-related queries
 *
 * Provides consistent, type-safe query keys for React Query.
 * Follows TanStack Query best practices for key organization.
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 *
 * @example
 * ```ts
 * // Invalidate all video queries
 * queryClient.invalidateQueries({ queryKey: videoKeys.all })
 *
 * // Invalidate queries for specific list
 * queryClient.invalidateQueries({ queryKey: videoKeys.list(listId) })
 *
 * // Invalidate filtered queries only
 * queryClient.invalidateQueries({ queryKey: videoKeys.filtered(listId, ['Python']) })
 * ```
 */
export const videoKeys = {
  /** Base key for all video queries */
  all: ['videos'] as const,
  /** Key factory for list-scoped queries */
  lists: () => [...videoKeys.all, 'list'] as const,
  /** Key for unfiltered videos in a specific list */
  list: (listId: string) => [...videoKeys.lists(), listId] as const,
  /** Key for tag-filtered videos in a specific list */
  filtered: (listId: string, tagNames: string[]) =>
    // Sort tagNames alphabetically for consistent cache keys regardless of selection order
    [...videoKeys.list(listId), { tags: [...tagNames].sort() }] as const,
  /** Key for videos with filtering and/or sorting options */
  withOptions: (listId: string, options: UseVideosOptions) => {
    const { tags, sortBy, sortOrder } = options
    const queryParams: Record<string, any> = {}

    // Include tags in query key (sorted for consistency)
    if (tags && tags.length > 0) {
      queryParams.tags = [...tags].sort()
    }

    // Include sort params in query key
    if (sortBy) {
      queryParams.sortBy = sortBy
      queryParams.sortOrder = sortOrder || 'asc'
    }

    return [...videoKeys.list(listId), queryParams] as const
  },
  /** Base key for all field values queries */
  fieldValues: () => [...videoKeys.all, 'field-values'] as const,
  /** Key for field values of a specific video */
  videoFieldValues: (videoId: string) =>
    [...videoKeys.fieldValues(), videoId] as const,
}

/**
 * Represents a single failed video upload in a bulk operation
 */
export interface BulkUploadFailure {
  /** The row number in the CSV file where the error occurred (1-based) */
  row: number
  /** The YouTube URL that failed to be added */
  url: string
  /** Human-readable error message explaining why the upload failed */
  error: string
}

/**
 * Response from bulk video upload operation
 */
export interface BulkUploadResponse {
  /** Number of videos successfully created */
  created_count: number
  /** Number of videos that failed to be created */
  failed_count: number
  /** Array of detailed failure information for each failed upload */
  failures: BulkUploadFailure[]
}

/**
 * Fetch videos for a list with optional tag filtering and sorting
 *
 * @param listId - UUID of the list to fetch videos from
 * @param options - Optional filtering and sorting options
 * @returns Query result with videos array
 *
 * @example
 * ```tsx
 * // All videos (no filtering or sorting)
 * const { data: videos } = useVideos(listId)
 *
 * // Filter by tags (OR logic: videos with Python OR JavaScript)
 * const { data: videos } = useVideos(listId, { tags: ['Python', 'JavaScript'] })
 *
 * // Sort by title ascending
 * const { data: videos } = useVideos(listId, { sortBy: 'title', sortOrder: 'asc' })
 *
 * // Sort by custom field descending
 * const { data: videos } = useVideos(listId, { sortBy: 'field:abc-123', sortOrder: 'desc' })
 *
 * // Combine filtering and sorting
 * const { data: videos } = useVideos(listId, {
 *   tags: ['Python'],
 *   sortBy: 'created_at',
 *   sortOrder: 'desc'
 * })
 *
 * // With auto-refetch for live updates
 * const { data: videos } = useVideos(listId, { refetchInterval: 2000 })
 * ```
 *
 * @deprecated Second parameter (tagNames: string[]) - Use options.tags instead
 * ```tsx
 * // Old API (still supported for backward compatibility)
 * const { data: videos } = useVideos(listId, ['Python', 'JavaScript'])
 *
 * // New API (recommended)
 * const { data: videos } = useVideos(listId, { tags: ['Python', 'JavaScript'] })
 * ```
 */
export const useVideos = (
  listId: string,
  optionsOrTagNames?: UseVideosOptions | string[],
  legacyOptions?: { refetchInterval?: number; refetchIntervalInBackground?: boolean }
) => {
  // Backward compatibility: Handle both old and new API signatures
  // Old API: useVideos(listId, ['tag1', 'tag2'], { refetchInterval: 2000 })
  // New API: useVideos(listId, { tags: ['tag1', 'tag2'], sortBy: 'title', refetchInterval: 2000 })
  const options: UseVideosOptions = Array.isArray(optionsOrTagNames)
    ? { tags: optionsOrTagNames, ...legacyOptions }
    : { ...optionsOrTagNames }

  const { tags, sortBy, sortOrder = 'asc', refetchInterval, refetchIntervalInBackground } = options

  // Determine query key based on whether we have any options
  const hasOptions = (tags && tags.length > 0) || sortBy
  const queryKey = hasOptions
    ? videoKeys.withOptions(listId, { tags, sortBy, sortOrder })
    : videoKeys.list(listId)

  return useQuery({
    queryKey,
    queryFn: async () => {
      // Build query params for filtering and sorting
      const params = new URLSearchParams()

      // Add tag filters (OR filtering)
      // Backend expects: ?tags=Python&tags=JavaScript
      if (tags && tags.length > 0) {
        tags.forEach((tag) => params.append('tags', tag))
      }

      // Add sorting parameters
      if (sortBy) {
        params.append('sort_by', sortBy)
        params.append('sort_order', sortOrder)
      }

      const queryString = params.toString()
      const url = `/lists/${listId}/videos${queryString ? `?${queryString}` : ''}`

      const { data } = await api.get<VideoResponse[]>(url)

      // Defensive: Handle undefined/null from backend gracefully
      const videos = data ?? []
      return VideoResponseSchema.array().parse(videos)
    },
    // Prevent excessive refetching that causes UI flicker
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Refetch on mount to get latest data including tags
    refetchOnReconnect: false,
    staleTime: refetchInterval ? 0 : 5 * 60 * 1000, // 5 minutes - allow periodic updates
    // Allow custom refetch interval for live updates
    refetchInterval,
    refetchIntervalInBackground,
  })
}

export const useCreateVideo = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoData: VideoCreate) => {
      const { data } = await api.post<VideoResponse>(
        `/lists/${listId}/videos`,
        videoData
      )
      return data
    },
    // Optimistic update: add new video immediately to cache
    onSuccess: (newVideo) => {
      // Update cache directly instead of invalidating (prevents re-fetch flicker)
      queryClient.setQueryData<VideoResponse[]>(
        videoKeys.list(listId),
        (old = []) => {
          // Check if video already exists (prevent duplicates)
          const exists = old?.some(v => v.id === newVideo.id)
          if (exists) return old
          return [...(old || []), newVideo]
        }
      )

      // Also update filtered queries if they exist
      const queryCache = queryClient.getQueryCache()
      queryCache.findAll({ queryKey: videoKeys.lists() }).forEach((query) => {
        if (query.queryKey.length >= 3 && query.queryKey[1] === 'list' && query.queryKey[2] === listId) {
          queryClient.setQueryData<VideoResponse[]>(
            query.queryKey as any,
            (old = []) => {
              // Check if video already exists (prevent duplicates)
              const exists = old?.some(v => v.id === newVideo.id)
              if (exists) return old
              return [...(old || []), newVideo]
            }
          )
        }
      })

      // YouTube Channels Feature: Invalidate channels query to show new/updated channels
      // Creating a video may create a new channel or update video counts
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
  })
}

export const useDeleteVideo = (_listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoId: string) => {
      await api.delete(`/videos/${videoId}`)
    },
    // Optimistic update: immediately remove from UI (including filtered views)
    onMutate: async (videoId) => {
      // Cancel ALL video queries (including useVideosFilter which uses ['videos', 'filter', ...])
      await queryClient.cancelQueries({ queryKey: ['videos'] })

      // Snapshot ALL video queries for potential rollback
      const queryCache = queryClient.getQueryCache()
      const previousQueries: Array<{ queryKey: readonly unknown[]; data: VideoResponse[] | undefined }> = []

      // Find all video queries (both ['videos', 'list', ...] and ['videos', 'filter', ...])
      queryCache.findAll({ queryKey: ['videos'] }).forEach((query) => {
        const data = queryClient.getQueryData<VideoResponse[]>(query.queryKey)
        // Only snapshot if it's an array (video list data)
        if (Array.isArray(data)) {
          previousQueries.push({
            queryKey: query.queryKey,
            data,
          })
        }
      })

      // Update ALL video queries (optimistically remove the deleted video)
      previousQueries.forEach(({ queryKey }) => {
        queryClient.setQueryData<VideoResponse[]>(queryKey, (old) =>
          old?.filter((video) => video.id !== videoId) ?? []
        )
      })

      return { previousQueries }
    },
    // Rollback on error
    onError: (err, _videoId, context) => {
      console.error('Failed to delete video:', err)
      // Restore ALL queries that were modified
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    // Refetch to ensure consistency - invalidates ALL video queries
    // YouTube Channels feature (Step 6.8): Also invalidate channels for updated counts
    // and to remove auto-deleted empty channels
    onSettled: () => {
      // Invalidate ALL video queries (both useVideos and useVideosFilter)
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
  })
}

export const useBulkUploadVideos = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      // Note: Content-Type header is intentionally omitted.
      // Axios automatically sets 'multipart/form-data' with proper boundary
      // when FormData is passed as the request body.
      const { data } = await api.post<BulkUploadResponse>(
        `/lists/${listId}/videos/bulk`,
        formData
      )
      return data
    },
    onSuccess: () => {
      // Invalidate ALL video queries for this list (filtered and unfiltered)
      queryClient.invalidateQueries({ queryKey: videoKeys.list(listId) })
    },
  })
}

/**
 * Exports videos from a list as a CSV file and triggers a browser download.
 *
 * @param listId - The UUID of the list to export videos from
 * @throws {Error} If the API response is not a valid Blob
 */
export const exportVideosCSV = async (listId: string) => {
  const response = await api.get<Blob>(`/lists/${listId}/export/csv`, {
    responseType: 'blob',
  })

  // Validate response is actually a Blob
  if (!(response.data instanceof Blob)) {
    throw new Error('Invalid response type: Expected Blob but received ' + typeof response.data)
  }

  // Create download link
  const blob = new Blob([response.data], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `videos_${listId}.csv`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

/**
 * Hook to assign tags to a video
 *
 * @param videoId - The UUID of the video to assign tags to
 * @returns Mutation hook for assigning tags
 *
 * @example
 * ```tsx
 * const assignTags = useAssignTags()
 * assignTags.mutate({ videoId: 'uuid', tagIds: ['tag-uuid-1', 'tag-uuid-2'] })
 * ```
 */
export const useAssignTags = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoId, tagIds }: { videoId: string; tagIds: string[] }) => {
      const { data } = await api.post(`/videos/${videoId}/tags`, {
        tag_ids: tagIds
      })
      return data
    },
    onSuccess: () => {
      // Invalidate all video queries to refetch with updated tags
      queryClient.invalidateQueries({ queryKey: videoKeys.all })
    },
  })
}

/**
 * Request/Response types for field value updates
 */
export interface FieldValueUpdate {
  field_id: string
  value: number | string | boolean | null
}

export interface BatchUpdateFieldValuesRequest {
  field_values: FieldValueUpdate[]
}

export interface VideoFieldValueResponse {
  id: string
  video_id: string
  field_id: string
  value: number | string | boolean | null
  updated_at: string
  field: {
    id: string
    name: string
    field_type: 'select' | 'rating' | 'text' | 'boolean'
    config: Record<string, any>
  }
}

export interface BatchUpdateFieldValuesResponse {
  updated_count: number
  field_values: VideoFieldValueResponse[]
}

/**
 * Hook for batch updating video field values with optimistic updates
 * Pattern: Follows useDeleteVideo mutation pattern
 */
export const useUpdateVideoFieldValues = (videoId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: BatchUpdateFieldValuesRequest) => {
      const { data } = await api.put<BatchUpdateFieldValuesResponse>(
        `/videos/${videoId}/fields`,
        request
      )
      return data
    },

    // Optimistic update pattern (same as useDeleteVideo)
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: videoKeys.all })
      const previousVideos = queryClient.getQueriesData({ queryKey: videoKeys.all })

      // Note: Using type assertion due to complex VideoFieldValue union type
      // The optimistic update logic is correct, but TypeScript struggles with Zod unions
      queryClient.setQueriesData(
        { queryKey: videoKeys.all },
        (oldVideos: VideoResponse[] | undefined) => {
          if (!oldVideos) return oldVideos

          return oldVideos.map((video) => {
            if (video.id !== videoId) return video

            const updatedFieldValues = (video.field_values ?? []).map((fv) => {
              const update = request.field_values.find(u => u.field_id === fv.field_id)
              if (!update) return fv

              return {
                ...fv,
                value: update.value,
                updated_at: new Date().toISOString(),
              }
            })

            request.field_values.forEach(update => {
              const exists = updatedFieldValues.some((fv) => fv.field_id === update.field_id)
              if (!exists) {
                const existingField = video.field_values?.find((fv) => fv.field_id === update.field_id)?.field
                if (existingField) {
                  // Use any to bypass complex Zod union type - optimistic update will be replaced by server response
                  (updatedFieldValues as any[]).push({
                    id: `temp-${update.field_id}`,
                    video_id: videoId,
                    field_id: update.field_id,
                    value: update.value,
                    updated_at: new Date().toISOString(),
                    field: existingField,
                    field_name: existingField.name,
                    show_on_card: false,
                  })
                }
              }
            })

            return {
              ...video,
              field_values: updatedFieldValues,
            }
          })
        }
      )

      return { previousVideos }
    },

    onError: (err, _request, context) => {
      console.error('Failed to update field values:', err)

      if (context?.previousVideos) {
        context.previousVideos.forEach(([queryKey, data]) => {
          queryClient.setQueryData<VideoResponse[]>(queryKey, data as VideoResponse[])
        })
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.all })
    },
  })
}

/**
 * Parse backend validation errors (422 responses)
 * German error messages for UI
 */
export const parseValidationError = (error: any): string => {
  if (error.response?.status === 422) {
    const detail = error.response.data?.detail

    if (detail?.errors && Array.isArray(detail.errors)) {
      return detail.errors[0]?.error || 'Validierungsfehler'
    }

    if (detail?.message) {
      return detail.message
    }
  }

  return 'Fehler beim Speichern. Bitte versuchen Sie es erneut.'
}

/**
 * Parameters for setting a video's category
 */
export interface SetCategoryParams {
  videoId: string
  categoryId: string | null
  restoreBackup?: boolean
}

/**
 * Response from category change endpoint
 */
export interface SetCategoryResponse {
  backup_created: boolean
  backup_available: boolean
  restored_count?: number
}

/**
 * Hook to set or change a video's category
 *
 * Categories are tags with is_video_type=true. Only one category can be
 * assigned per video. Changing categories will backup field values from
 * the old category.
 *
 * @returns Mutation hook for setting video category
 *
 * @example
 * ```tsx
 * const setCategory = useSetVideoCategory()
 *
 * // Assign category
 * setCategory.mutate({ videoId: 'uuid', categoryId: 'category-uuid' })
 *
 * // Remove category
 * setCategory.mutate({ videoId: 'uuid', categoryId: null })
 *
 * // Change category and restore backup if available
 * setCategory.mutate({ videoId: 'uuid', categoryId: 'new-cat', restoreBackup: true })
 * ```
 */
export const useSetVideoCategory = () => {
  const queryClient = useQueryClient()

  return useMutation<
    SetCategoryResponse,
    Error,
    SetCategoryParams,
    { previousVideos: [readonly unknown[], VideoResponse[] | undefined][] }
  >({
    mutationKey: ['setVideoCategory'],

    mutationFn: async ({ videoId, categoryId, restoreBackup }: SetCategoryParams) => {
      const { data } = await api.put<SetCategoryResponse>(`/videos/${videoId}/category`, {
        category_id: categoryId,
        restore_backup: restoreBackup ?? false,
      })
      return data
    },

    // Step 3.9: Optimistic update
    onMutate: async ({ videoId, categoryId }) => {
      // Cancel outgoing queries to prevent overwrites
      await queryClient.cancelQueries({ queryKey: videoKeys.all })

      // Snapshot previous state for rollback
      const previousVideos = queryClient.getQueriesData<VideoResponse[]>({ queryKey: videoKeys.all })

      // Optimistically update the video's tags
      queryClient.setQueriesData<VideoResponse[]>(
        { queryKey: videoKeys.all },
        (oldVideos) => {
          // Guard against non-array data (setQueriesData iterates all matching queries)
          if (!oldVideos || !Array.isArray(oldVideos)) return oldVideos

          return oldVideos.map((video) => {
            if (video.id !== videoId) return video

            // Remove old category (is_video_type=true) and add new one
            const labelsOnly = video.tags.filter(t => !t.is_video_type)

            // If categoryId is null, just keep labels
            if (!categoryId) {
              return { ...video, tags: labelsOnly }
            }

            // Find the new category from cache (tags query)
            const allTags = queryClient.getQueryData<any[]>(['tags']) ?? []
            const newCategory = allTags.find(t => t.id === categoryId)

            if (newCategory) {
              return { ...video, tags: [...labelsOnly, newCategory] }
            }

            return video
          })
        }
      )

      return { previousVideos }
    },

    // Step 3.10: Error handling - rollback on error
    onError: (error, _variables, context) => {
      console.error('Failed to set video category:', error)

      // Rollback to previous state
      if (context?.previousVideos) {
        context.previousVideos.forEach(([queryKey, data]) => {
          queryClient.setQueryData<VideoResponse[]>(queryKey as any, data)
        })
      }
    },

    // Step 3.11: Query invalidation
    onSettled: (_data, _error, { videoId }) => {
      // Invalidate all video queries to refetch with updated category
      queryClient.invalidateQueries({ queryKey: videoKeys.all })
      // Also invalidate field values as they may have changed
      queryClient.invalidateQueries({ queryKey: videoKeys.videoFieldValues(videoId) })
    },
  })
}

