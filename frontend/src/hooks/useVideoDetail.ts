import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { videoKeys } from "@/lib/videoKeys";
import type { VideoResponse } from "@/types/video";

/**
 * Hook to fetch a single video's details with available_fields.
 *
 * Uses the GET /api/videos/{id} endpoint (detail endpoint) which includes:
 * - available_fields: All fields that CAN be filled (from tag schemas)
 * - field_values: All fields that HAVE been filled
 *
 * This is different from the list endpoint which only includes field_values.
 *
 * @param videoId - The video ID to fetch
 * @param enabled - Whether the query should run (default: true)
 * @returns Query result with video details
 *
 * @example
 * const { data: video, isLoading } = useVideoDetail(videoId)
 * if (video) {
 *   console.log(video.available_fields) // Array of AvailableFieldResponse
 * }
 */
export const useVideoDetail = (videoId: string | null, enabled = true) => {
  return useQuery<VideoResponse>({
    queryKey: videoKeys.detail(videoId),
    queryFn: async () => {
      if (!videoId) throw new Error("Video ID is required");

      const { data } = await api.get<VideoResponse>(`/videos/${videoId}`);
      return data;
    },
    enabled: enabled && !!videoId,
    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
};
