import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { VideoResponse, VideoCreate } from '@/types/video'

export const useVideos = (listId: string) => {
  return useQuery({
    queryKey: ['videos', listId],
    queryFn: async () => {
      const { data } = await api.get<VideoResponse[]>(`/lists/${listId}/videos`)
      return data
    },
    enabled: !!listId, // Only fetch if listId exists
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
    onError: (_err, _videoId, context) => {
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
