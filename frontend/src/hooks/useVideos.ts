import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '@/lib/api'
import type { VideoResponse, VideoCreate } from '@/types/video'

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

  processing_status: z.enum(['pending', 'processing', 'completed', 'failed']),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

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

export const useVideos = (listId: string) => {
  return useQuery({
    queryKey: ['videos', listId],
    queryFn: async () => {
      const { data } = await api.get<VideoResponse[]>(`/lists/${listId}/videos`)
      return VideoResponseSchema.array().parse(data)
    },
    // Prevent excessive refetching that causes UI flicker
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
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
    onSuccess: () => {
      // Invalidate videos query to refetch
      queryClient.invalidateQueries({ queryKey: ['videos', listId] })
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
      await queryClient.cancelQueries({ queryKey: ['videos', listId] })
      const previous = queryClient.getQueryData<VideoResponse[]>(['videos', listId])

      queryClient.setQueryData<VideoResponse[]>(['videos', listId], (old) =>
        old?.filter((video) => video.id !== videoId) ?? []
      )

      return { previous }
    },
    // Rollback on error
    onError: (err, _videoId, context) => {
      console.error('Failed to delete video:', err)
      if (context?.previous) {
        queryClient.setQueryData(['videos', listId], context.previous)
      }
    },
    // Refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['videos', listId] })
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
      // Invalidate videos query to refetch
      queryClient.invalidateQueries({ queryKey: ['videos', listId] })
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
