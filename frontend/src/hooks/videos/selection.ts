import type { ActiveFilter } from "@/stores/fieldFilterStore";
export interface BackendFieldFilter {
  field_id: string;
  operator: string;
  value?: string | number | boolean;
  value_min?: number;
  value_max?: number;
}
export interface VideoSelectionOptions {
  tags?: string[];
  channelId?: string;
  fieldFilters?: ActiveFilter[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
export interface VideoSelectionRequest {
  tags?: string[];
  channel_id?: string;
  field_filters?: BackendFieldFilter[];
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

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

function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

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
export function buildVideoSelection({
  tags,
  channelId,
  fieldFilters,
  sortBy,
  sortOrder = "asc",
}: VideoSelectionOptions): VideoSelectionRequest {
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

  return requestBody;
}
