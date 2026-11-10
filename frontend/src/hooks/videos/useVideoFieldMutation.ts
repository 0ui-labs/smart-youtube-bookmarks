import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { videoKeys } from "@/lib/videoKeys";
import type { VideoResponse } from "@/types/video";
import { invalidateVideoViews } from "./cache";
export function useVideoFieldMutation() {
  const queryClient = useQueryClient();
  // Mutation for updating field values in video detail modal
  return useMutation({
    mutationFn: async ({
      videoId,
      fieldId,
      value,
    }: {
      videoId: string;
      fieldId: string;
      value: string | number | boolean;
    }) => {
      const { data } = await api.put(`/videos/${videoId}/fields`, {
        field_values: [{ field_id: fieldId, value }], // FIX: Backend expects "field_values" not "updates"
      });
      return data;
    },
    onMutate: async ({ videoId, fieldId, value }) => {
      // Cancel ALL video queries
      await queryClient.cancelQueries({ queryKey: videoKeys.all });

      // Snapshot ALL video queries for rollback
      const previousVideos = queryClient.getQueriesData({
        queryKey: videoKeys.all,
      });

      // Optimistically update ALL video queries
      queryClient.setQueriesData(
        { queryKey: videoKeys.all },
        (oldVideos: VideoResponse[] | undefined) => {
          // Guard against non-array data (setQueriesData iterates all matching queries)
          if (!(oldVideos && Array.isArray(oldVideos))) return oldVideos;

          return oldVideos.map((video) => {
            if (video.id !== videoId) return video;

            return {
              ...video,
              field_values:
                video.field_values?.map((fv) =>
                  fv.field_id === fieldId ? { ...fv, value } : fv
                ) ?? [],
            };
          });
        }
      );

      return { previousVideos };
    },
    onSettled: () => {
      invalidateVideoViews(queryClient);
    },
    onError: (error: unknown, _variables, context) => {
      console.error("Failed to update field value:", error);

      // Rollback ALL queries
      if (context?.previousVideos) {
        context.previousVideos.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      alert("Failed to update field value. Please try again.");
    },
  });
}
