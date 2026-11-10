import type { UseVideosOptions } from "@/hooks/useVideos";

export const videoKeys = {
  /** Base key for all video queries */
  all: ["videos"] as const,
  detail: (videoId: string | null | undefined) =>
    [...videoKeys.all, "detail", videoId] as const,
  /** Key factory for list-scoped queries */
  lists: () => [...videoKeys.all, "list"] as const,
  /** Key for unfiltered videos in a specific list */
  list: (listId: string) => [...videoKeys.lists(), listId] as const,
  /** Key for tag-filtered videos in a specific list */
  filtered: (listId: string, tagNames: string[]) =>
    // Sort tagNames alphabetically for consistent cache keys regardless of selection order
    [...videoKeys.list(listId), { tags: [...tagNames].sort() }] as const,
  /** Key for videos with filtering and/or sorting options */
  withOptions: (listId: string, options: UseVideosOptions) => {
    const { tags, sortBy, sortOrder } = options;
    const queryParams: Record<string, any> = {};

    // Include tags in query key (sorted for consistency)
    if (tags && tags.length > 0) {
      queryParams.tags = [...tags].sort();
    }

    // Include sort params in query key
    if (sortBy) {
      queryParams.sortBy = sortBy;
      queryParams.sortOrder = sortOrder || "asc";
    }

    return [...videoKeys.list(listId), queryParams] as const;
  },
  /** Base key for all field values queries */
  fieldValues: () => [...videoKeys.all, "field-values"] as const,
  /** Key for field values of a specific video */
  videoFieldValues: (videoId: string) =>
    [...videoKeys.fieldValues(), videoId] as const,
};
