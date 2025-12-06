/**
 * Custom hooks for subscription management.
 *
 * Provides simple interfaces for subscription CRUD operations
 * with proper cache invalidation.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  SubscriptionResponse,
  SubscriptionUpdate,
  SyncResponse,
} from "@/api/generated/model";
import { api } from "@/lib/api";

/**
 * Query options for subscriptions.
 */
export function subscriptionsOptions(listId?: string, isActive?: boolean) {
  return queryOptions({
    queryKey: ["subscriptions", { listId, isActive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (listId) params.append("list_id", listId);
      if (isActive !== undefined) params.append("is_active", String(isActive));

      const { data } = await api.get<SubscriptionResponse[]>(
        `/subscriptions${params.toString() ? `?${params.toString()}` : ""}`
      );
      return data;
    },
  });
}

/**
 * Hook to fetch all subscriptions.
 *
 * @param listId - Optional filter by target list
 * @param isActive - Optional filter by active status
 */
export function useSubscriptions(listId?: string, isActive?: boolean) {
  return useQuery(subscriptionsOptions(listId, isActive));
}

/**
 * Hook to delete a subscription.
 * Invalidates the subscriptions cache on success.
 */
export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/subscriptions/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
}

/**
 * Hook to update a subscription.
 * Invalidates the subscriptions cache on success.
 */
export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: SubscriptionUpdate;
    }): Promise<SubscriptionResponse> => {
      const { data: response } = await api.put<SubscriptionResponse>(
        `/subscriptions/${id}`,
        data
      );
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
}

/**
 * Hook to trigger manual sync for a subscription.
 * Invalidates both subscriptions and videos caches on success.
 */
export function useSyncSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<number> => {
      const { data } = await api.post<SyncResponse>(
        `/subscriptions/${id}/sync`
      );
      return data.new_videos;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });
}

/**
 * Hook to toggle subscription active status.
 */
export function useToggleSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      currentIsActive,
    }: {
      id: string;
      currentIsActive: boolean;
    }): Promise<void> => {
      await api.put(`/subscriptions/${id}`, {
        is_active: !currentIsActive,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
}
