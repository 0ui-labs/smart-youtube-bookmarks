import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { videoKeys } from "@/lib/videoKeys";
import { VideoPageSchema } from "./page";
import type { UseVideosOptions } from "./types";

export const useVideos = (
  listId: string,
  optionsOrTagNames?: UseVideosOptions | string[],
  legacyOptions?: Pick<
    UseVideosOptions,
    "refetchInterval" | "refetchIntervalInBackground"
  >
) => {
  const options: UseVideosOptions = Array.isArray(optionsOrTagNames)
    ? { tags: optionsOrTagNames, ...legacyOptions }
    : { ...optionsOrTagNames };
  const {
    tags,
    sortBy,
    sortOrder = "asc",
    offset = 0,
    limit = 50,
    enabled = true,
    refetchInterval,
    refetchIntervalInBackground,
  } = options;
  const query = useQuery({
    queryKey: videoKeys.page(listId, {
      tags,
      sortBy,
      sortOrder,
      offset,
      limit,
    }),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      });
      tags?.forEach((tag) => params.append("tags", tag));
      if (sortBy) {
        params.set("sort_by", sortBy);
        params.set("sort_order", sortOrder);
      }
      const { data } = await api.get(`/lists/${listId}/videos/page?${params}`, {
        signal,
      });
      return VideoPageSchema.parse(data);
    },
    enabled: enabled && !!listId,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    staleTime: refetchInterval ? 0 : 5 * 60 * 1000,
    refetchInterval,
    refetchIntervalInBackground,
  });
  return { ...query, data: query.data?.items, total: query.data?.total };
};
