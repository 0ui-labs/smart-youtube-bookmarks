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
