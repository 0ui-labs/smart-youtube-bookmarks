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
 * Note: Add Filter functionality has been extracted to FilterPopover component
 * for placement in the controls bar (see Task 7).
 *
 * @example
 * ```tsx
 * <FilterBar listId="list-uuid" />
 * ```
 */
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFieldFilterStore } from '@/stores/fieldFilterStore';
import { FieldFilterInput } from './FieldFilterInput';

interface FilterBarProps {
  listId: string;
}

export function FilterBar({ listId }: FilterBarProps) {
  const { activeFilters, removeFilter, clearFilters } = useFieldFilterStore();

  return (
    <div className="flex items-center gap-2 p-4 border-b bg-background">
      {/* Active Filters */}
      <div className="flex items-center gap-2 flex-wrap flex-1">
        {activeFilters.length === 0 && (
          <span className="text-sm text-muted-foreground">
            No filters applied
          </span>
        )}

        {activeFilters.map((filter) => (
          <Badge key={filter.id} variant="secondary" className="gap-1 pr-1">
            <FieldFilterInput
              filter={filter}
              listId={listId}
              onRemove={() => removeFilter(filter.id)}
            />
          </Badge>
        ))}
      </div>

      {/* Clear All Button */}
      {activeFilters.length > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear All
        </Button>
      )}
    </div>
  );
}
