/**
 * FilterBar Component - Displays active field-based filters
 *
 * Displays active filters as removable badges with Clear All button.
 * Integrates with fieldFilterStore for state management.
 *
 * Features:
 * - Active filter chips with remove button
 * - Clear all filters button
 *
 * Note: Add Filter functionality has been extracted to FilterSettingsModal component
 * for placement in the controls bar.
 *
 * @example
 * ```tsx
 * <FilterBar listId="list-uuid" />
 * ```
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFieldFilterStore } from "@/stores/fieldFilterStore";
import { FieldFilterInput } from "./FieldFilterInput";

interface FilterBarProps {
  listId: string;
}

export function FilterBar({ listId }: FilterBarProps) {
  const { activeFilters, removeFilter, clearFilters } = useFieldFilterStore();

  // Don't render anything if no filters are active
  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 border-b bg-background p-4">
      {/* Active Filters */}
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {activeFilters.map((filter) => (
          <Badge className="gap-1 pr-1" key={filter.id} variant="secondary">
            <FieldFilterInput
              filter={filter}
              listId={listId}
              onRemove={() => removeFilter(filter.id)}
            />
          </Badge>
        ))}
      </div>

      {/* Clear All Button */}
      <Button onClick={clearFilters} size="sm" variant="ghost">
        Clear All
      </Button>
    </div>
  );
}
