import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useVideoDuplicateLookup(
  listId: string | undefined,
  youtubeIds: string[],
  enabled: boolean
) {
  const identities = [...new Set(youtubeIds)].sort();
  return useQuery({
    queryKey: ["videos", "duplicate-lookup", listId, identities],
    enabled: enabled && !!listId && identities.length > 0,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const existing: string[] = [];
      for (let offset = 0; offset < identities.length; offset += 100) {
        const { data } = await api.post<{ existing_youtube_ids: string[] }>(
          `/lists/${listId}/videos/lookup`,
          { youtube_ids: identities.slice(offset, offset + 100) },
          { signal }
        );
        existing.push(...data.existing_youtube_ids);
      }
      return existing;
    },
  });
}
