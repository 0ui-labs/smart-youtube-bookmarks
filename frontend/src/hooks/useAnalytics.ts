import { useQuery, queryOptions } from '@tanstack/react-query'
import { getAnalytics } from '@/lib/api'

/**
 * Query Key Factory for analytics queries.
 *
 * Follows TanStack Query best practices for key organization.
 */
export const analyticsKeys = {
  all: ['analytics'] as const,
  lists: () => [...analyticsKeys.all, 'list'] as const,
  list: (listId: string) => [...analyticsKeys.lists(), listId] as const,
}

/**
 * Query options for analytics data.
 *
 * Enables type-safe reuse and prefetching.
 *
 * @param listId - UUID of the bookmark list
 */
export function analyticsOptions(listId: string) {
  return queryOptions({
    queryKey: analyticsKeys.list(listId),
    queryFn: async () => getAnalytics(listId),
    staleTime: 5 * 60 * 1000,   // 5 minutes - analytics change slowly
    gcTime: 10 * 60 * 1000,      // 10 minutes - garbage collection
  })
}

/**
 * Hook to fetch analytics data for a list.
 *
 * Returns aggregated statistics for:
 * - Most-used fields (top 10)
 * - Unused schemas
 * - Field coverage
 * - Schema effectiveness
 *
 * @param listId - UUID of the bookmark list
 * @returns Query result with analytics data
 *
 * @example
 * ```tsx
 * const { data: analytics, isLoading, error } = useAnalytics(listId)
 *
 * if (isLoading) return <Skeleton />
 * if (error) return <ErrorState error={error} />
 *
 * return (
 *   <AnalyticsView
 *     mostUsedFields={analytics.most_used_fields}
 *     unusedSchemas={analytics.unused_schemas}
 *     fieldCoverage={analytics.field_coverage}
 *     schemaEffectiveness={analytics.schema_effectiveness}
 *   />
 * )
 * ```
 */
export function useAnalytics(listId: string) {
  return useQuery(analyticsOptions(listId))
}
