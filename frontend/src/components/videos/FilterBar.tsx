/**
 * FilterBar Component - Displays active field-based filters
 *
 * Displays active filters as removable badges with Clear All button.
 * Integrates with fieldFilterStore for state management.
 *
 * Features:
 * - Active filter chips with remove button
 * - Clear all filters button
 * - Save as subscription button (opens AI chat modal)
 *
 * Note: Add Filter functionality has been extracted to FilterSettingsModal component
 * for placement in the controls bar.
 *
 * @example
 * ```tsx
 * <FilterBar listId="list-uuid" />
 * ```
 */

import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFieldFilterStore } from "@/stores/fieldFilterStore";
import { useSubscriptionChatStore } from "@/stores/subscriptionChatStore";
import { FieldFilterInput } from "./FieldFilterInput";

interface FilterBarProps {
  listId: string;
}

/**
 * Format a filter value for display in the context message
 */
function formatFilterValue(filter: {
  fieldName: string;
  fieldType: string;
  operator: string;
  value?: string | number | boolean;
  valueMin?: number;
  valueMax?: number;
}): string {
  const operatorLabels: Record<string, string> = {
    eq: "=",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
    between: "zwischen",
    contains: "enthält",
    exact: "ist genau",
    in: "ist einer von",
    is: "ist",
  };

  const op = operatorLabels[filter.operator] || filter.operator;

  if (filter.operator === "between") {
    return `${filter.fieldName} ${op} ${filter.valueMin} und ${filter.valueMax}`;
  }

  if (filter.fieldType === "boolean") {
    return `${filter.fieldName} ${op} ${filter.value ? "ja" : "nein"}`;
  }

  return `${filter.fieldName} ${op} ${filter.value}`;
}

/**
 * Build context message from active filters
 */
function buildFilterContextMessage(
  filters: Array<{
    fieldName: string;
    fieldType: string;
    operator: string;
    value?: string | number | boolean;
    valueMin?: number;
    valueMax?: number;
  }>
): string {
  const filterDescriptions = filters.map(formatFilterValue);
  const filterList = filterDescriptions.join(", ");

  return `Ich möchte ein Abo erstellen basierend auf meinen aktuellen Filtereinstellungen: ${filterList}. Kannst du mir helfen, daraus ein passendes Abo zu konfigurieren?`;
}

export function FilterBar({ listId }: FilterBarProps) {
  const { activeFilters, removeFilter, clearFilters } = useFieldFilterStore();
  const { openChatWithContext } = useSubscriptionChatStore();

  // Handler for "Save as Subscription" button
  const handleSaveAsSubscription = () => {
    const contextMessage = buildFilterContextMessage(activeFilters);
    openChatWithContext(listId, contextMessage);
  };

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

      {/* Save as Subscription Button */}
      <Button
        className="gap-1"
        onClick={handleSaveAsSubscription}
        size="sm"
        variant="outline"
      >
        <Bell className="h-4 w-4" />
        Als Abo speichern
      </Button>

      {/* Clear All Button */}
      <Button onClick={clearFilters} size="sm" variant="ghost">
        Clear All
      </Button>
    </div>
  );
}
