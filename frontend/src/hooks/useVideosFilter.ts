import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ActiveFilter } from "@/stores/fieldFilterStore";
import type { VideoResponse } from "@/types/video";

interface UseVideosFilterOptions {
  listId: string;
  tags?: string[];
  channelId?: string; // Filter by channel (YouTube Channels feature)
  fieldFilters?: ActiveFilter[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  enabled?: boolean; // Allow disabling the query
  refetchInterval?: number; // Polling interval in ms (for real-time updates after import)
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
 * @throws Error if BETWEEN operator is used without both valueMin and valueMax
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
export function convertToBackendFilters(
  filters: ActiveFilter[]
): BackendFieldFilter[] {
  return filters.map((f) => {
    const backendFilter: BackendFieldFilter = {
      field_id: f.fieldId,
      operator: f.operator,
    };

    // BETWEEN operator requires both min and max values
    if (f.operator === "between") {
      if (f.valueMin === undefined || f.valueMax === undefined) {
        throw new Error(
          `BETWEEN operator requires both valueMin and valueMax for field "${f.fieldName}" (${f.fieldId})`
        );
      }
      backendFilter.value_min = f.valueMin;
      backendFilter.value_max = f.valueMax;
    } else {
      // Other operators use the value field
      if (f.value !== undefined) {
        backendFilter.value = f.value;
      }
      // Include min/max if they're defined (for potential future operators)
      if (f.valueMin !== undefined) {
        backendFilter.value_min = f.valueMin;
      }
      if (f.valueMax !== undefined) {
        backendFilter.value_max = f.valueMax;
      }
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
/**
 * Check if a string is a valid UUID format
 * Used to filter out temporary IDs from optimistic updates
 */
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Check if a filter has all required fields to be sent to the backend
 * Operators that don't require a value: is_empty, is_not_empty
 * Operators that require value_min and value_max: between
 * All other operators require a value
 */
function isFilterComplete(filter: ActiveFilter): boolean {
  const noValueOperators = ["is_empty", "is_not_empty"];

  if (noValueOperators.includes(filter.operator)) {
    return true;
  }

  if (filter.operator === "between") {
    return filter.valueMin !== undefined && filter.valueMax !== undefined;
  }

  // All other operators require a value
  return filter.value !== undefined && filter.value !== "";
}

export function useVideosFilter({
  listId,
  tags,
  channelId,
  fieldFilters,
  sortBy,
  sortOrder = "asc",
  enabled = true,
  refetchInterval,
}: UseVideosFilterOptions) {
  const isQueryEnabled = enabled && !!listId;

  return useQuery({
    queryKey: [
      "videos",
      "filter",
      listId,
      tags,
      channelId,
      fieldFilters,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const requestBody: {
        tags?: string[];
        channel_id?: string;
        field_filters?: BackendFieldFilter[];
        sort_by?: string;
        sort_order?: "asc" | "desc";
      } = {};

      // Add tags if provided
      if (tags && tags.length > 0) {
        requestBody.tags = tags;
      }

      // Add channel_id if provided (YouTube Channels filter)
      if (channelId) {
        requestBody.channel_id = channelId;
      }

      // Add field filters if provided (convert to backend format)
      // IMPORTANT: Filter out:
      // - Filters with invalid UUIDs (e.g., temp IDs from optimistic updates)
      // - Incomplete filters (e.g., text filter without a value yet)
      if (fieldFilters && fieldFilters.length > 0) {
        const validFilters = fieldFilters.filter(
          (f) => isValidUUID(f.fieldId) && isFilterComplete(f)
        );
        if (validFilters.length > 0) {
          requestBody.field_filters = convertToBackendFilters(validFilters);
        }
      }

      // Add sorting parameters if provided
      if (sortBy) {
        requestBody.sort_by = sortBy;
        requestBody.sort_order = sortOrder;
      }

      const response = await api.post<VideoResponse[]>(
        `/lists/${listId}/videos/filter`,
        requestBody
      );

      return response.data;
    },
    enabled: isQueryEnabled, // Only run if enabled and listId exists
    staleTime: 30 * 1000, // 30 seconds - filters don't change often
    // Prevent excessive refetching that causes UI flicker
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval, // Polling for real-time updates (undefined = disabled)
  });
}
