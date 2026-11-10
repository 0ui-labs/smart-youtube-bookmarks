import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api";
import { videoKeys } from "@/lib/videoKeys";
import { TagSchema } from "@/types/tag";
import type { VideoResponse } from "@/types/video";
import type { UseVideosOptions } from "./types";

const VideoResponseSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  youtube_id: z.string().length(11),

  // YouTube Metadata (optional fields from API)
  title: z.string().nullable(),
  channel: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  duration: z.number().nullable(),
  published_at: z.string().nullable(),

  // Tags (many-to-many relationship)
  tags: z.array(TagSchema).default([]),

  processing_status: z.enum(["pending", "processing", "completed", "failed"]),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),

  // Import progress tracking (Phase 1 - Robust Video Import)
  // These fields enable the progress overlay on VideoCard during import
  // IMPORTANT: Use nullable() NOT default() - old videos won't have these fields
  // and we need to distinguish "no value" from "created" stage
  import_progress: z.number().nullable().optional(),
  import_stage: z.string().nullable().optional(),
});

export const useVideos = (
  listId: string,
  optionsOrTagNames?: UseVideosOptions | string[],
  legacyOptions?: {
    refetchInterval?: number;
    refetchIntervalInBackground?: boolean;
  }
) => {
  // Backward compatibility: Handle both old and new API signatures
  // Old API: useVideos(listId, ['tag1', 'tag2'], { refetchInterval: 2000 })
  // New API: useVideos(listId, { tags: ['tag1', 'tag2'], sortBy: 'title', refetchInterval: 2000 })
  const options: UseVideosOptions = Array.isArray(optionsOrTagNames)
    ? { tags: optionsOrTagNames, ...legacyOptions }
    : { ...optionsOrTagNames };

  const {
    tags,
    sortBy,
    sortOrder = "asc",
    refetchInterval,
    refetchIntervalInBackground,
  } = options;

  // Determine query key based on whether we have any options
  const hasOptions = (tags && tags.length > 0) || sortBy;
  const queryKey = hasOptions
    ? videoKeys.withOptions(listId, { tags, sortBy, sortOrder })
    : videoKeys.list(listId);

  return useQuery({
    queryKey,
    queryFn: async () => {
      // Build query params for filtering and sorting
      const params = new URLSearchParams();

      // Add tag filters (OR filtering)
      // Backend expects: ?tags=Python&tags=JavaScript
      if (tags && tags.length > 0) {
        tags.forEach((tag) => params.append("tags", tag));
      }

      // Add sorting parameters
      if (sortBy) {
        params.append("sort_by", sortBy);
        params.append("sort_order", sortOrder);
      }

      const queryString = params.toString();
      const url = `/lists/${listId}/videos${queryString ? `?${queryString}` : ""}`;

      const { data } = await api.get<VideoResponse[]>(url);

      // Defensive: Handle undefined/null from backend gracefully
      const videos = data ?? [];
      return VideoResponseSchema.array().parse(videos);
    },
    // Prevent excessive refetching that causes UI flicker
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Refetch on mount to get latest data including tags
    refetchOnReconnect: false,
    staleTime: refetchInterval ? 0 : 5 * 60 * 1000, // 5 minutes - allow periodic updates
    // Allow custom refetch interval for live updates
    refetchInterval,
    refetchIntervalInBackground,
  });
};
