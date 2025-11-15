/**
 * FilterBar Component - Manages active field-based filters
 *
 * Displays active filters as removable badges and provides UI to add new filters.
 * Integrates with fieldFilterStore for state management and useCustomFields for field metadata.
 *
 * Features:
 * - Active filter chips with remove button
 * - Add filter popover with command palette
 * - Smart default operators per field type
 * - Prevents duplicate filters (hides already-filtered fields)
 * - Clear all filters button
 *
 * @example
 * ```tsx
 * <FilterBar listId="list-uuid" />
 * ```
 */
import React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
} from '@/components/ui/command';
import { useFieldFilterStore } from '@/stores/fieldFilterStore';
import { useCustomFields } from '@/hooks/useCustomFields';

interface FilterBarProps {
  listId: string;
}

export function FilterBar({ listId }: FilterBarProps) {
  const { activeFilters, addFilter, removeFilter, clearFilters } =
    useFieldFilterStore();
  const { data: customFields, isLoading } = useCustomFields(listId);
  const [open, setOpen] = React.useState(false);

  // Get available fields (exclude already filtered fields)
  const activeFieldIds = new Set(activeFilters.map((f) => f.fieldId));
  const availableFields =
    customFields?.filter((f) => !activeFieldIds.has(f.id)) || [];

  const handleAddFilter = (fieldId: string) => {
    const field = customFields?.find((f) => f.id === fieldId);
    if (!field) return;

    // Default operator based on field type
    const defaultOperator =
      field.field_type === 'rating'
        ? 'gte'
        : field.field_type === 'select'
          ? 'in'
          : field.field_type === 'boolean'
            ? 'is'
            : 'contains';

    // Default value based on field type
    const defaultValue =
      field.field_type === 'boolean'
        ? true
        : field.field_type === 'rating'
          ? 3
          : undefined;

    addFilter({
      fieldId: field.id,
      fieldName: field.name,
      fieldType: field.field_type,
      operator: defaultOperator,
      value: defaultValue,
    });

    setOpen(false);
  };

  /**
   * Format filter value for display
   * Handles different value types (single value, range, etc.)
   */
  const formatFilterValue = (filter: (typeof activeFilters)[0]): string => {
    if (filter.value !== undefined) {
      return String(filter.value);
    }
    if (filter.valueMin !== undefined && filter.valueMax !== undefined) {
      return `${filter.valueMin}-${filter.valueMax}`;
    }
    return '';
  };

  if (isLoading) {
    return <div className="p-4 border-b">Loading filters...</div>;
  }

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
            <span className="text-sm">
              {filter.fieldName} {filter.operator}{' '}
              {formatFilterValue(filter)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => removeFilter(filter.id)}
              aria-label={`Remove ${filter.fieldName} filter`}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      {/* Add Filter Button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={availableFields.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search fields..." />
            <CommandList>
              <CommandEmpty>No fields found.</CommandEmpty>
              <CommandGroup>
                {availableFields.map((field) => (
                  <CommandItem
                    key={field.id}
                    value={field.name}
                    onSelect={() => handleAddFilter(field.id)}
                  >
                    {field.name}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {field.field_type}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Clear All Button */}
      {activeFilters.length > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear All
        </Button>
      )}
    </div>
  );
}
