import { api } from "@/lib/api";
import { videoKeys } from "@/lib/videoKeys";
import { VideoPageSchema } from "./videos/page";
import {
  buildVideoSelection,
  type VideoSelectionOptions,
} from "./videos/selection";

import { useVideoPageQuery } from "./videos/useVideoPageQuery";

export { convertToBackendFilters } from "./videos/selection";

interface UseVideosFilterOptions extends VideoSelectionOptions {
  listId: string;
  offset?: number;
  limit?: number;
  enabled?: boolean;
  continuous?: boolean;
  refetchInterval?: number;
}
export function useVideosFilter({
  listId,
  offset = 0,
  limit = 50,
  enabled = true,
  continuous = false,
  refetchInterval,
  ...selection
}: UseVideosFilterOptions) {
  const query = useVideoPageQuery({
    queryKey: videoKeys.page(listId, { ...selection, offset, limit }),
    queryPage: async (pageOffset, signal) => {
      const { data } = await api.post(
        `/lists/${listId}/videos/filter/page?offset=${pageOffset < 0 ? offset : pageOffset}&limit=${limit}`,
        buildVideoSelection(selection),
        { signal }
      );
      return VideoPageSchema.parse(data);
    },
    enabled: enabled && !!listId,
    continuous,
    staleTime: 30_000,
    refetchInterval,
  });
  return { ...query, data: query.data?.items, total: query.data?.total };
}
