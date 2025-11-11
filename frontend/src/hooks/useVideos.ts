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
 * Fetch videos for a list with optional tag filtering
 *
 * @param listId - UUID of the list to fetch videos from
 * @param tagNames - Optional array of tag names for OR filtering (videos with ANY of the specified tags)
 * @param options - Optional query options (refetchInterval, etc.)
 * @returns Query result with videos array
 *
 * @example
 * ```tsx
 * // All videos
 * const { data: videos } = useVideos(listId)
 *
 * // Filter by tags (OR logic: videos with Python OR JavaScript)
 * const { data: videos } = useVideos(listId, ['Python', 'JavaScript'])
 *
 * // With auto-refetch for live updates
 * const { data: videos } = useVideos(listId, undefined, { refetchInterval: 2000 })
 * ```
 */
export const useVideos = (
  listId: string,
  tagNames?: string[],
  options?: { refetchInterval?: number; refetchIntervalInBackground?: boolean }
) => {
  return useQuery({
    queryKey:
      tagNames && tagNames.length > 0
        ? videoKeys.filtered(listId, tagNames)
        : videoKeys.list(listId),
    queryFn: async () => {
      // Build query params for tag filtering
      const params = new URLSearchParams()

      // Add multiple 'tags' query params for OR filtering
      // Backend expects: ?tags=Python&tags=JavaScript
      if (tagNames && tagNames.length > 0) {
        tagNames.forEach((tag) => params.append('tags', tag))
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
    staleTime: options?.refetchInterval ? 0 : 5 * 60 * 1000, // 5 minutes - allow periodic updates
    // Allow custom refetch interval for live updates
    ...options,
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
    },
  })
}

export const useDeleteVideo = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoId: string) => {
      await api.delete(`/videos/${videoId}`)
    },
    // Optimistic update: immediately remove from UI
    onMutate: async (videoId) => {
      await queryClient.cancelQueries({ queryKey: videoKeys.list(listId) })
      const previous = queryClient.getQueryData<VideoResponse[]>(videoKeys.list(listId))

      queryClient.setQueryData<VideoResponse[]>(videoKeys.list(listId), (old) =>
        old?.filter((video) => video.id !== videoId) ?? []
      )

      return { previous }
    },
    // Rollback on error
    onError: (err, _videoId, context) => {
      console.error('Failed to delete video:', err)
      if (context?.previous) {
        queryClient.setQueryData(videoKeys.list(listId), context.previous)
      }
    },
    // Refetch to ensure consistency - invalidates ALL queries for this list
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.list(listId) })
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

