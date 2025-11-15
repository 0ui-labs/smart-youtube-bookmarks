import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { VideoResponse } from '@/types/video';
import type { ActiveFilter } from '@/stores/fieldFilterStore';

interface UseVideosFilterOptions {
  listId: string;
  tags?: string[];
  fieldFilters?: ActiveFilter[];
  enabled?: boolean;  // Allow disabling the query
}

/**
 * Backend field filter format (snake_case)
 * Matches FieldFilter schema from backend API
 */
interface BackendFieldFilter {
  field_id: string;
  operator: string;
  value?: string | number | boolean;
  value_min?: number;
  value_max?: number;
}

/**
 * Convert ActiveFilter (UI format) to backend FieldFilter format
 *
 * Transforms camelCase UI filters to snake_case backend API format
 *
 * @param filters - Array of active filters from fieldFilterStore
 * @returns Array of backend-compatible field filters
 *
 * @example
 * ```ts
 * const uiFilters = [
 *   { id: 'f1', fieldId: 'field-123', fieldName: 'Rating', fieldType: 'rating', operator: 'gte', value: 4 }
 * ];
 * const backendFilters = convertToBackendFilters(uiFilters);
 * // Result: [{ field_id: 'field-123', operator: 'gte', value: 4 }]
 * ```
 */
export function convertToBackendFilters(filters: ActiveFilter[]): BackendFieldFilter[] {
  return filters.map((f) => {
    const backendFilter: BackendFieldFilter = {
      field_id: f.fieldId,
      operator: f.operator,
    };

    // Add value fields only if they're defined
    if (f.value !== undefined) {
      backendFilter.value = f.value;
    }
    if (f.valueMin !== undefined) {
      backendFilter.value_min = f.valueMin;
    }
    if (f.valueMax !== undefined) {
      backendFilter.value_max = f.valueMax;
    }

    return backendFilter;
  });
}

/**
 * React Query hook for filtering videos with tags and custom field filters
 *
 * Calls POST /api/lists/{listId}/videos/filter with tags and field filters.
 * Returns videos matching ALL field filters AND ANY of the specified tags.
 *
 * Features:
 * - Type-safe conversion from UI filters to backend format
 * - React Query caching with dependency-based cache keys
 * - Optional tags and fieldFilters parameters
 * - Can be disabled via enabled flag
 * - 30-second stale time (filters don't change often)
 *
 * @param options - Filter options
 * @param options.listId - UUID of the list to filter videos from
 * @param options.tags - Optional array of tag names (OR logic: videos with ANY tag)
 * @param options.fieldFilters - Optional array of custom field filters (AND logic: videos matching ALL filters)
 * @param options.enabled - Optional flag to disable the query (default: true)
 * @returns Query result with filtered videos array
 *
 * @example
 * ```tsx
 * // Filter by tags only
 * const { data: videos, isLoading } = useVideosFilter({
 *   listId: 'list-123',
 *   tags: ['Python', 'Tutorial']
 * });
 *
 * // Filter by custom fields only
 * const { data: videos } = useVideosFilter({
 *   listId: 'list-123',
 *   fieldFilters: [
 *     { id: 'f1', fieldId: 'field-456', fieldName: 'Rating', fieldType: 'rating', operator: 'gte', value: 4 }
 *   ]
 * });
 *
 * // Combine tags and field filters
 * const { data: videos } = useVideosFilter({
 *   listId: 'list-123',
 *   tags: ['Python'],
 *   fieldFilters: [
 *     { id: 'f1', fieldId: 'field-456', fieldName: 'Rating', fieldType: 'rating', operator: 'gte', value: 4 }
 *   ]
 * });
 *
 * // Disabled until user clicks "Apply Filters"
 * const { data: videos } = useVideosFilter({
 *   listId: 'list-123',
 *   fieldFilters: activeFilters,
 *   enabled: hasAppliedFilters
 * });
 * ```
 */
export function useVideosFilter({
  listId,
  tags,
  fieldFilters,
  enabled = true,
}: UseVideosFilterOptions) {
  return useQuery({
    queryKey: ['videos', 'filter', listId, tags, fieldFilters],
    queryFn: async () => {
      const requestBody: {
        tags?: string[];
        field_filters?: BackendFieldFilter[];
      } = {};

      // Add tags if provided
      if (tags && tags.length > 0) {
        requestBody.tags = tags;
      }

      // Add field filters if provided (convert to backend format)
      if (fieldFilters && fieldFilters.length > 0) {
        requestBody.field_filters = convertToBackendFilters(fieldFilters);
      }

      const response = await api.post<VideoResponse[]>(
        `/lists/${listId}/videos/filter`,
        requestBody
      );

      return response.data;
    },
    enabled: enabled && !!listId,  // Only run if enabled and listId exists
    staleTime: 30000,  // 30 seconds - filters don't change often
    // Prevent excessive refetching that causes UI flicker
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });
}
