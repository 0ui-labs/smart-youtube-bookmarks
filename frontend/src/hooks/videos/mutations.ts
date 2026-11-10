import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { videoKeys } from "@/lib/videoKeys";
import type { VideoCreate, VideoResponse } from "@/types/video";
import { invalidateVideoViews } from "./cache";
import type {
  BatchUpdateFieldValuesRequest,
  BatchUpdateFieldValuesResponse,
  BulkUploadResponse,
  SetCategoryParams,
  SetCategoryResponse,
} from "./types";

export const useCreateVideo = (listId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoData: VideoCreate) => {
      const { data } = await api.post<VideoResponse>(
        `/lists/${listId}/videos`,
        videoData
      );
      return data;
    },
    onSuccess: () => {
      // Membership, order, and totals are server-owned. Preserve existing data
      // during refetch and mark inactive variants stale for their next mount.
      void invalidateVideoViews(queryClient, listId);
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });
};

export const useDeleteVideo = (_listId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: string) => {
      await api.delete(`/videos/${videoId}`);
    },
    // Optimistic update: immediately remove from UI (including filtered views)
    onMutate: async (videoId) => {
      // Cancel ALL video queries (including useVideosFilter which uses ['videos', 'filter', ...])
      await queryClient.cancelQueries({ queryKey: ["videos"] });

      // Snapshot ALL video queries for potential rollback
      const queryCache = queryClient.getQueryCache();
      const previousQueries: Array<{
        queryKey: readonly unknown[];
        data: VideoResponse[] | undefined;
      }> = [];

      // Find all video queries (both ['videos', 'list', ...] and ['videos', 'filter', ...])
      queryCache.findAll({ queryKey: ["videos"] }).forEach((query) => {
        const data = queryClient.getQueryData<VideoResponse[]>(query.queryKey);
        // Only snapshot if it's an array (video list data)
        if (Array.isArray(data)) {
          previousQueries.push({
            queryKey: query.queryKey,
            data,
          });
        }
      });

      // Update ALL video queries (optimistically remove the deleted video)
      previousQueries.forEach(({ queryKey }) => {
        queryClient.setQueryData<VideoResponse[]>(
          queryKey,
          (old) => old?.filter((video) => video.id !== videoId) ?? []
        );
      });

      return { previousQueries };
    },
    // Rollback on error
    onError: (err, _videoId, context) => {
      console.error("Failed to delete video:", err);
      // Restore ALL queries that were modified
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    // Refetch to ensure consistency - invalidates ALL video queries
    // YouTube Channels feature (Step 6.8): Also invalidate channels for updated counts
    // and to remove auto-deleted empty channels
    onSettled: () => {
      // Invalidate ALL video queries (both useVideos and useVideosFilter)
      void invalidateVideoViews(queryClient);
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });
};

export const useBulkUploadVideos = (listId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      // Note: Content-Type header is intentionally omitted.
      // Axios automatically sets 'multipart/form-data' with proper boundary
      // when FormData is passed as the request body.
      const { data } = await api.post<BulkUploadResponse>(
        `/lists/${listId}/videos/bulk`,
        formData
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate ALL video queries for this list (filtered and unfiltered)
      void invalidateVideoViews(queryClient);
    },
  });
};

export const useAssignTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      videoId,
      tagIds,
    }: {
      videoId: string;
      tagIds: string[];
    }) => {
      const { data } = await api.post(`/videos/${videoId}/tags`, {
        tag_ids: tagIds,
      });
      return data;
    },
    onSuccess: () => {
      // Invalidate all video queries to refetch with updated tags
      void invalidateVideoViews(queryClient);
    },
  });
};

export const useUpdateVideoFieldValues = (videoId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BatchUpdateFieldValuesRequest) => {
      const { data } = await api.put<BatchUpdateFieldValuesResponse>(
        `/videos/${videoId}/fields`,
        request
      );
      return data;
    },

    // Optimistic update pattern (same as useDeleteVideo)
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: videoKeys.lists() });
      const previousVideos = queryClient.getQueriesData({
        queryKey: videoKeys.lists(),
      });

      // Note: Using type assertion due to complex VideoFieldValue union type
      // The optimistic update logic is correct, but TypeScript struggles with Zod unions
      queryClient.setQueriesData(
        { queryKey: videoKeys.lists() },
        (oldVideos: VideoResponse[] | undefined) => {
          if (!Array.isArray(oldVideos)) return oldVideos;

          return oldVideos.map((video) => {
            if (video.id !== videoId) return video;

            const updatedFieldValues = (video.field_values ?? []).map((fv) => {
              const update = request.field_values.find(
                (u) => u.field_id === fv.field_id
              );
              if (!update) return fv;

              return {
                ...fv,
                value: update.value,
                updated_at: new Date().toISOString(),
              };
            });

            request.field_values.forEach((update) => {
              const exists = updatedFieldValues.some(
                (fv) => fv.field_id === update.field_id
              );
              if (!exists) {
                const existingField = video.field_values?.find(
                  (fv) => fv.field_id === update.field_id
                )?.field;
                if (existingField) {
                  // Use any to bypass complex Zod union type - optimistic update will be replaced by server response
                  (updatedFieldValues as any[]).push({
                    id: `temp-${update.field_id}`,
                    video_id: videoId,
                    field_id: update.field_id,
                    value: update.value,
                    updated_at: new Date().toISOString(),
                    field: existingField,
                    field_name: existingField.name,
                    show_on_card: false,
                  });
                }
              }
            });

            return {
              ...video,
              field_values: updatedFieldValues,
            };
          });
        }
      );

      return { previousVideos };
    },

    onError: (err, _request, context) => {
      console.error("Failed to update field values:", err);

      if (context?.previousVideos) {
        context.previousVideos.forEach(([queryKey, data]) => {
          queryClient.setQueryData<VideoResponse[]>(
            queryKey,
            data as VideoResponse[]
          );
        });
      }
    },

    onSettled: () => {
      void invalidateVideoViews(queryClient);
    },
  });
};

export const useSetVideoCategory = () => {
  const queryClient = useQueryClient();

  return useMutation<
    SetCategoryResponse,
    Error,
    SetCategoryParams,
    { previousVideos: [readonly unknown[], VideoResponse[] | undefined][] }
  >({
    mutationKey: ["setVideoCategory"],

    mutationFn: async ({
      videoId,
      categoryId,
      restoreBackup,
    }: SetCategoryParams) => {
      const { data } = await api.put<SetCategoryResponse>(
        `/videos/${videoId}/category`,
        {
          category_id: categoryId,
        },
        { params: { restore_backup: restoreBackup ?? false } }
      );
      return data;
    },

    // Step 3.9: Optimistic update
    onMutate: async ({ videoId, categoryId }) => {
      // Cancel outgoing queries to prevent overwrites
      await queryClient.cancelQueries({ queryKey: videoKeys.lists() });

      // Snapshot previous state for rollback
      const previousVideos = queryClient.getQueriesData<VideoResponse[]>({
        queryKey: videoKeys.lists(),
      });

      // Optimistically update the video's tags
      queryClient.setQueriesData<VideoResponse[]>(
        { queryKey: videoKeys.lists() },
        (oldVideos) => {
          // Guard against non-array data (setQueriesData iterates all matching queries)
          if (!(oldVideos && Array.isArray(oldVideos))) return oldVideos;

          return oldVideos.map((video) => {
            if (video.id !== videoId) return video;

            // Remove old category (is_video_type=true) and add new one
            const labelsOnly = video.tags.filter((t) => !t.is_video_type);

            // If categoryId is null, just keep labels
            if (!categoryId) {
              return { ...video, tags: labelsOnly };
            }

            // Find the new category from cache (tags query)
            const allTags = queryClient.getQueryData<any[]>(["tags"]) ?? [];
            const newCategory = allTags.find((t) => t.id === categoryId);

            if (newCategory) {
              return { ...video, tags: [...labelsOnly, newCategory] };
            }

            return video;
          });
        }
      );

      return { previousVideos };
    },

    // Step 3.10: Error handling - rollback on error
    onError: (error, _variables, context) => {
      console.error("Failed to set video category:", error);

      // Rollback to previous state
      if (context?.previousVideos) {
        context.previousVideos.forEach(([queryKey, data]) => {
          queryClient.setQueryData<VideoResponse[]>(queryKey as any, data);
        });
      }
    },

    // Step 3.11: Query invalidation
    onSettled: (_data, _error, { videoId }) => {
      // Invalidate all video queries to refetch with updated category
      void invalidateVideoViews(queryClient);
      // Also invalidate the single video detail query (used by VideoDetailsModal)
      queryClient.invalidateQueries({ queryKey: videoKeys.detail(videoId) });
      // Also invalidate field values as they may have changed
      queryClient.invalidateQueries({
        queryKey: videoKeys.videoFieldValues(videoId),
      });
    },
  });
};
