import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ChannelsSchema, ChannelSchema, type Channel, type ChannelUpdate } from '@/types/channel'

/**
 * Query options factory for channels
 * Enables type-safe reuse of query configuration
 *
 * @param includeHidden - Whether to include hidden channels
 *
 * @example
 * ```ts
 * // Use in useQuery
 * useQuery(channelsOptions())
 *
 * // Use with queryClient
 * queryClient.invalidateQueries({ queryKey: channelsOptions().queryKey })
 * ```
 */
export function channelsOptions(includeHidden = false) {
  return queryOptions({
    queryKey: ['channels', { includeHidden }],
    queryFn: async () => {
      const { data } = await api.get<Channel[]>('/channels', {
        params: { include_hidden: includeHidden }
      })
      // Validate response with Zod schema
      return ChannelsSchema.parse(data)
    },
  })
}

/**
 * React Query hook to fetch all channels for the current user
 *
 * Channels are automatically created when videos are added.
 * By default, hidden channels are excluded.
 *
 * @param includeHidden - Whether to include hidden channels (default: false)
 * @returns Query result with channels array
 *
 * @example
 * ```tsx
 * const { data: channels, isLoading, error } = useChannels()
 *
 * // Include hidden channels
 * const { data: allChannels } = useChannels(true)
 * ```
 */
export const useChannels = (includeHidden = false) => {
  return useQuery(channelsOptions(includeHidden))
}

/**
 * React Query mutation hook to update a channel (hide/unhide)
 *
 * Automatically invalidates channels query after successful update
 *
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const updateChannel = useUpdateChannel()
 *
 * // Hide a channel
 * updateChannel.mutate({ channelId: 'uuid', data: { is_hidden: true } })
 *
 * // Unhide a channel
 * updateChannel.mutate({ channelId: 'uuid', data: { is_hidden: false } })
 * ```
 */
export const useUpdateChannel = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateChannel'],
    mutationFn: async ({ channelId, data }: { channelId: string; data: ChannelUpdate }) => {
      const { data: responseData } = await api.patch<Channel>(`/channels/${channelId}`, data)
      return ChannelSchema.parse(responseData)
    },
    onError: (error) => {
      console.error('Failed to update channel:', error)
    },
    onSettled: async () => {
      // Invalidate both visible and hidden channel queries
      await queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
  })
}

/**
 * React Query mutation hook to delete a channel
 *
 * Videos linked to the deleted channel will have channel_id set to NULL.
 * Automatically invalidates channels and videos queries.
 *
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const deleteChannel = useDeleteChannel()
 *
 * deleteChannel.mutate('channel-uuid')
 * ```
 */
export const useDeleteChannel = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['deleteChannel'],
    mutationFn: async (channelId: string) => {
      await api.delete(`/channels/${channelId}`)
      // 204 No Content - no response body
    },
    onError: (error) => {
      console.error('Failed to delete channel:', error)
    },
    onSettled: async () => {
      // Invalidate channels and videos (videos may need refresh since channel_id is now null)
      await queryClient.invalidateQueries({ queryKey: ['channels'] })
      await queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}
