import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UpdateWatchProgressResponse } from "@/types/player";

interface UpdateWatchProgressParams {
  videoId: string;
  position: number;
}

/**
 * React Query mutation hook to update video watch progress
 *
 * Calls PATCH /api/videos/{id}/progress to save playback position.
 * Used by the VideoPlayer component to persist watch progress.
 *
 * Features:
 * - Debounced by caller (VideoPlayer uses 10s interval)
 * - Immediate save on pause event
 * - Invalidates video queries to keep cache fresh
 *
 * @returns Mutation result with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const updateProgress = useUpdateWatchProgress()
 *
 * // Debounced progress save (every 10 seconds)
 * updateProgress.mutate({ videoId: 'uuid', position: 120 })
 *
 * // Immediate save on pause
 * updateProgress.mutate({ videoId: 'uuid', position: player.currentTime })
 * ```
 */
export const useUpdateWatchProgress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      videoId,
      position,
    }: UpdateWatchProgressParams): Promise<UpdateWatchProgressResponse> => {
      const { data } = await api.patch<UpdateWatchProgressResponse>(
        `/videos/${videoId}/progress`,
        { position }
      );
      return data;
    },
    onSuccess: (_, { videoId }) => {
      // Invalidate video detail query to refresh watch_position
      // Note: VideoDetailsPage uses ['videos', videoId] as query key
      queryClient.invalidateQueries({ queryKey: ["videos", videoId] });
      // Also invalidate videos list queries that might include this video
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    // Silent failure - don't show errors for progress updates
    // (network issues during playback shouldn't interrupt the user)
    onError: (error) => {
      console.warn("Failed to save watch progress:", error);
    },
  });
};
