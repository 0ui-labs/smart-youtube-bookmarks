/**
 * Field Filter Store - Zustand state management for field-based filtering
 *
 * Manages active custom field filters with complex operator support.
 * HYBRID architecture: Store state in Zustand + URL hash for shareability.
 * Uses sessionStorage for persistence (filters reset on new tab/session).
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Generate a UUID v4 with fallback for older browsers
 * Uses crypto.randomUUID() if available, otherwise falls back to Math.random()
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: Simple UUID v4 implementation for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Field filter operator (matches backend FieldFilterOperator enum)
 */
export type FilterOperator =
  | "eq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between" // Numeric
  | "contains"
  | "exact"
  | "in" // Text/Select
  | "is"; // Boolean

/**
 * Active field filter (UI state representation)
 */
export interface ActiveFilter {
  id: string; // Unique ID for this filter instance (UUID v4)
  fieldId: string; // Custom field UUID
  fieldName: string; // Display name (e.g., "Overall Rating")
  fieldType: "rating" | "select" | "text" | "boolean";
  operator: FilterOperator;
  value?: string | number | boolean;
  valueMin?: number; // For BETWEEN operator
  valueMax?: number; // For BETWEEN operator
}

/**
 * Field filter store state and actions
 */
interface FieldFilterStore {
  /** Active filters */
  activeFilters: ActiveFilter[];

  /** Add a new filter */
  addFilter: (filter: Omit<ActiveFilter, "id">) => void;

  /** Update an existing filter */
  updateFilter: (id: string, updates: Partial<ActiveFilter>) => void;

  /** Remove a filter */
  removeFilter: (id: string) => void;

  /** Clear all filters */
  clearFilters: () => void;
}

/**
 * Field filter store hook with sessionStorage persistence
 *
 * WHY sessionStorage (not localStorage):
 * - Filters are query-specific and should reset on new session
 * - Avoids stale filters when switching between lists
 * - User expectation: filters are temporary (like search terms)
 *
 * WHY NOT URL query params ONLY:
 * - Complex filter state doesn't serialize well to URLs
 * - Better UX to preserve filters during page refresh
 * - URL params used for final API call (source of truth)
 *
 * @example
 * ```tsx
 * const { activeFilters, addFilter, updateFilter, removeFilter, clearFilters } = useFieldFilterStore();
 *
 * // Add a new filter
 * addFilter({
 *   fieldId: 'field-123',
 *   fieldName: 'Overall Rating',
 *   fieldType: 'rating',
 *   operator: 'gte',
 *   value: 4
 * });
 *
 * // Update filter value
 * updateFilter(filterId, { value: 5 });
 *
 * // Remove filter
 * removeFilter(filterId);
 *
 * // Clear all
 * clearFilters();
 * ```
 */
export const useFieldFilterStore = create<FieldFilterStore>()(
  persist(
    (set) => ({
      activeFilters: [],

      addFilter: (filter) =>
        set((state) => ({
          activeFilters: [
            ...state.activeFilters,
            { ...filter, id: generateUUID() },
          ],
        })),

      updateFilter: (id, updates) =>
        set((state) => ({
          activeFilters: state.activeFilters.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        })),

      removeFilter: (id) =>
        set((state) => ({
          activeFilters: state.activeFilters.filter((f) => f.id !== id),
        })),

      clearFilters: () => set({ activeFilters: [] }),
    }),
    {
      name: "field-filter-state", // sessionStorage key
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
