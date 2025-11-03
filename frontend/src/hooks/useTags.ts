import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TagsSchema, TagSchema, type Tag, type TagCreate } from '@/types/tag'

/**
 * Query options factory for tags
 * Enables type-safe reuse of query configuration
 *
 * @example
 * ```ts
 * // Use in useQuery
 * useQuery(tagsOptions())
 *
 * // Use with queryClient
 * queryClient.setQueryData(tagsOptions().queryKey, newTags)
 * queryClient.invalidateQueries({ queryKey: tagsOptions().queryKey })
 * ```
 */
export function tagsOptions() {
  return queryOptions({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get<Tag[]>('/tags')
      // Validate response with Zod schema
      return TagsSchema.parse(data)
    },
  })
}

/**
 * React Query hook to fetch all tags for the current user
 *
 * @returns Query result with tags array
 *
 * @example
 * ```tsx
 * const { data: tags, isLoading, error } = useTags()
 * ```
 */
export const useTags = () => {
  return useQuery(tagsOptions())
}

/**
 * React Query mutation hook to create a new tag
 *
 * Automatically invalidates tags query after successful creation or error
 * to ensure UI consistency
 *
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const createTag = useCreateTag()
 *
 * createTag.mutate({ name: 'Python', color: '#3B82F6' })
 * ```
 */
export const useCreateTag = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['createTag'],
    mutationFn: async (tagData: TagCreate) => {
      const { data } = await api.post<Tag>('/tags', tagData)
      // Validate response with Zod schema (consistent with tagsOptions)
      return TagSchema.parse(data)
    },
    onError: (error) => {
      console.error('Failed to create tag:', error)
    },
    onSettled: async () => {
      // Invalidate and refetch to ensure UI consistency
      // This runs on both success and error to handle edge cases
      await queryClient.invalidateQueries({ queryKey: tagsOptions().queryKey })
    },
  })
}
