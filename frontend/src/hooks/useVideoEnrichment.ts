import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  EnrichmentResponse,
  EnrichmentRetryResponse,
} from "@/types/enrichment";

/**
 * Query key factory for enrichment queries.
 * Used for cache invalidation and query identification.
 */
export const enrichmentKeys = {
  all: ["enrichment"] as const,
  detail: (videoId: string) => ["enrichment", videoId] as const,
};

/**
 * React Query hook to fetch video enrichment data.
 *
 * Fetches captions, chapters, thumbnails, and processing status.
 * Automatically polls while status is 'processing'.
 *
 * @param videoId - UUID of the video
 * @param options - Optional configuration
 * @returns Query result with enrichment data
 *
 * @example
 * ```tsx
 * const { data: enrichment, isLoading, error } = useVideoEnrichment(videoId)
 *
 * if (enrichment?.status === 'completed') {
 *   // Show captions/chapters
 * }
 * ```
 */
export const useVideoEnrichment = (
  videoId: string | undefined,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) => {
  return useQuery({
    queryKey: enrichmentKeys.detail(videoId ?? ""),
    queryFn: async (): Promise<EnrichmentResponse | null> => {
      if (!videoId) return null;

      try {
        const { data } = await api.get<EnrichmentResponse>(
          `/videos/${videoId}/enrichment`
        );
        return data;
      } catch (error: unknown) {
        // Return null for 404 (enrichment not found)
        if (
          error &&
          typeof error === "object" &&
          "response" in error &&
          (error as { response?: { status?: number } }).response?.status === 404
        ) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!videoId && (options?.enabled ?? true),
    // Poll while processing
    refetchInterval: (query) => {
      if (options?.refetchInterval !== undefined) {
        return options.refetchInterval;
      }
      // Auto-poll every 2s while processing
      if (query.state.data?.status === "processing") {
        return 2000;
      }
      return false;
    },
    // Keep data fresh
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * React Query mutation hook to retry video enrichment.
 *
 * Creates a new enrichment record if none exists, or resets
 * a failed enrichment to pending status and re-enqueues the job.
 *
 * @returns Mutation result with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const retryEnrichment = useRetryEnrichment()
 *
 * const handleRetry = () => {
 *   retryEnrichment.mutate(videoId, {
 *     onSuccess: (data) => {
 *       console.log('Retry started:', data.message)
 *     }
 *   })
 * }
 * ```
 */
export const useRetryEnrichment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: string): Promise<EnrichmentRetryResponse> => {
      const { data } = await api.post<EnrichmentRetryResponse>(
        `/videos/${videoId}/enrichment/retry`
      );
      return data;
    },
    onSuccess: (data, videoId) => {
      // Update the enrichment cache with new data
      queryClient.setQueryData(enrichmentKeys.detail(videoId), data.enrichment);
      // Also invalidate to trigger refetch
      queryClient.invalidateQueries({
        queryKey: enrichmentKeys.detail(videoId),
      });
    },
    onError: (error) => {
      console.error("Failed to retry enrichment:", error);
    },
  });
};

/**
 * Prefetch enrichment data for a video.
 *
 * Useful for optimistic prefetching when hovering over videos.
 *
 * @param queryClient - React Query client
 * @param videoId - UUID of the video
 */
export const prefetchEnrichment = async (
  queryClient: ReturnType<typeof useQueryClient>,
  videoId: string
) => {
  await queryClient.prefetchQuery({
    queryKey: enrichmentKeys.detail(videoId),
    queryFn: async () => {
      try {
        const { data } = await api.get<EnrichmentResponse>(
          `/videos/${videoId}/enrichment`
        );
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 30 * 1000,
  });
};
