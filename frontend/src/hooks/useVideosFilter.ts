import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { videoKeys } from "@/lib/videoKeys";
import { VideoPageSchema } from "./videos/page";
import {
  buildVideoSelection,
  type VideoSelectionOptions,
} from "./videos/selection";

export { convertToBackendFilters } from "./videos/selection";

interface UseVideosFilterOptions extends VideoSelectionOptions {
  listId: string;
  offset?: number;
  limit?: number;
  enabled?: boolean;
  refetchInterval?: number;
}
export function useVideosFilter({
  listId,
  offset = 0,
  limit = 50,
  enabled = true,
  refetchInterval,
  ...selection
}: UseVideosFilterOptions) {
  const query = useQuery({
    queryKey: videoKeys.page(listId, { ...selection, offset, limit }),
    queryFn: async ({ signal }) => {
      const { data } = await api.post(
        `/lists/${listId}/videos/filter/page?offset=${offset}&limit=${limit}`,
        buildVideoSelection(selection),
        { signal }
      );
      return VideoPageSchema.parse(data);
    },
    enabled: enabled && !!listId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: (query) =>
      refetchInterval ??
      (query.state.data?.items.some(
        (video) =>
          video.import_stage &&
          !["complete", "error"].includes(video.import_stage)
      )
        ? 2000
        : false),
  });
  return { ...query, data: query.data?.items, total: query.data?.total };
}
