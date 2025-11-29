import { z } from "zod";

/**
 * Single search result with video info and matching snippet.
 */
export const SearchResultSchema = z.object({
  video_id: z.string().uuid(),
  list_id: z.string().uuid(),
  youtube_id: z.string(),
  title: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  snippet: z.string(),
  rank: z.number(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Paginated search response.
 */
export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  query: z.string(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
