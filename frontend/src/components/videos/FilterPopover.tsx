/**
 * FilterPopover Component - Add Filter button with field selection popover
 *
 * Extracted from FilterBar to allow placement in the controls bar.
 * Provides a command palette interface to select fields for filtering.
 *
 * Features:
 * - Add Filter button with Plus icon
 * - Command palette with field search
 * - Smart default operators per field type
 * - Prevents duplicate filters (hides already-filtered fields)
 *
 * @example
 * ```tsx
 * <FilterPopover listId="list-uuid" />
 * ```
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface FilterPopoverProps {
  listId: string;
}

export function FilterPopover({ listId }: FilterPopoverProps) {
  const { activeFilters, addFilter } = useFieldFilterStore();
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || availableFields.length === 0}
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
  );
}
