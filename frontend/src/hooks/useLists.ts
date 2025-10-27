import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ListResponse, ListCreate } from '@/types/list'

export const useLists = () => {
  return useQuery({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data } = await api.get<ListResponse[]>('/lists')
      return data
    },
  })
}

export const useCreateList = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (listData: ListCreate) => {
      const { data } = await api.post<ListResponse>('/lists', listData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

export const useDeleteList = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (listId: string) => {
      await api.delete(`/lists/${listId}`)
    },
    // Optimistic update: immediately remove from UI
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: ['lists'] })
      const previous = queryClient.getQueryData<ListResponse[]>(['lists'])

      queryClient.setQueryData<ListResponse[]>(['lists'], (old) =>
        old?.filter((list) => list.id !== listId) ?? []
      )

      return { previous }
    },
    // Rollback on error
    onError: (_err, _listId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['lists'], context.previous)
      }
    },
    // Refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}
