import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SearchResponse } from '@/types/search'

/**
 * Query key factory for search queries.
 */
export const searchKeys = {
  all: ['search'] as const,
  query: (q: string, listId?: string, limit?: number, offset?: number) =>
    ['search', q, listId, limit, offset] as const,
}

interface UseTranscriptSearchOptions {
  /** Filter by list ID */
  listId?: string
  /** Results per page (default: 20) */
  limit?: number
  /** Pagination offset (default: 0) */
  offset?: number
  /** Enable/disable the query */
  enabled?: boolean
}

/**
 * React Query hook for transcript full-text search.
 *
 * Searches video transcripts using PostgreSQL full-text search.
 * Supports pagination and list filtering.
 *
 * @param query - Search query string (min 1 character)
 * @param options - Search options (list filter, pagination, enabled)
 * @returns Query result with search results
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useTranscriptSearch('python tutorial', {
 *   listId: 'uuid',
 *   limit: 10,
 * })
 *
 * data?.results.forEach(result => {
 *   console.log(result.title, result.snippet)
 * })
 * ```
 */
export const useTranscriptSearch = (
  query: string,
  options: UseTranscriptSearchOptions = {}
) => {
  const { listId, limit = 20, offset = 0, enabled = true } = options

  return useQuery({
    queryKey: searchKeys.query(query, listId, limit, offset),
    queryFn: async (): Promise<SearchResponse> => {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String(offset),
      })

      if (listId) {
        params.append('list_id', listId)
      }

      const { data } = await api.get<SearchResponse>(`/search?${params}`)
      return data
    },
    enabled: enabled && query.length >= 1,
    // Keep previous data while loading new results
    placeholderData: keepPreviousData,
    // Cache for 1 minute
    staleTime: 60 * 1000,
  })
}

/**
 * Hook for debounced search input.
 * Use in combination with useDebounce for text input.
 *
 * @example
 * ```tsx
 * const [searchInput, setSearchInput] = useState('')
 * const debouncedQuery = useDebounce(searchInput, 300)
 * const { data } = useTranscriptSearch(debouncedQuery)
 * ```
 */
export default useTranscriptSearch
