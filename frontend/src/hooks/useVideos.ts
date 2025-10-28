import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '@/lib/api'
import type { VideoResponse, VideoCreate } from '@/types/video'

const VideoResponseSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  youtube_id: z.string().length(11),
  processing_status: z.enum(['pending', 'processing', 'completed', 'failed']),
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

export const exportVideosCSV = async (listId: string) => {
  const response = await api.get(`/lists/${listId}/export/csv`, {
    responseType: 'blob',
  })

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
