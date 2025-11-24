import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ListResponse, ListCreate, ListUpdate } from '@/types/list'

/**
 * Query options helper for type-safe reuse
 * Enables type inference for getQueryData() and setQueryData()
 */
export function listsOptions() {
  return queryOptions({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data } = await api.get<ListResponse[]>('/lists')
      return data
    },
  })
}

export const useLists = () => {
  return useQuery(listsOptions())
}

export const useCreateList = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['createList'],
    mutationFn: async (listData: ListCreate) => {
      const { data } = await api.post<ListResponse>('/lists', listData)
      return data
    },
    onError: (error) => {
      console.error('Failed to create list:', error)
    },
    onSettled: async () => {
      // Invalidate and refetch to ensure UI consistency
      await queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

export const useDeleteList = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['deleteList'],
    mutationFn: async (listId: string) => {
      await api.delete(`/lists/${listId}`)
    },
    // Optimistic update: immediately remove from UI
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: ['lists'] })
      const previous = queryClient.getQueryData(listsOptions().queryKey)

      queryClient.setQueryData(listsOptions().queryKey, (old: ListResponse[] | undefined) =>
        old?.filter((list) => list.id !== listId) ?? []
      )

      return { previous }
    },
    // Rollback on error
    onError: (error, _listId, context) => {
      console.error('Failed to delete list:', error)
      if (context?.previous) {
        queryClient.setQueryData(listsOptions().queryKey, context.previous)
      }
    },
    // Refetch to ensure consistency after success or error
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

export const useUpdateList = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateList'],
    mutationFn: async ({ listId, data }: { listId: string; data: ListUpdate }) => {
      const { data: response } = await api.put<ListResponse>(`/lists/${listId}`, data)
      return response
    },
    onSuccess: (updatedList) => {
      // Update the list in cache
      queryClient.setQueryData(listsOptions().queryKey, (old: ListResponse[] | undefined) =>
        old?.map((list) => (list.id === updatedList.id ? updatedList : list)) ?? []
      )
    },
    onError: (error) => {
      console.error('Failed to update list:', error)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}
