/**
 * FieldFilterInput Component - Type-specific filter controls
 *
 * Renders inline editing controls for each filter type:
 * - Rating: Operator selector + number input(s) for value/range
 * - Select: Dropdown with field's options
 * - Text: Text input for search
 * - Boolean: Switch with Yes/No label
 *
 * Features:
 * - Immediate updates via updateFilter()
 * - Remove button for each filter
 * - Compact design (h-7 inputs) to fit in filter chips
 * - Fetches field config from useCustomFields to get options/max_rating
 *
 * @example
 * ```tsx
 * <FieldFilterInput
 *   filter={activeFilter}
 *   listId="list-uuid"
 *   onRemove={() => removeFilter(filter.id)}
 * />
 * ```
 */
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCustomFields } from "@/hooks/useCustomFields";
import {
  type ActiveFilter,
  useFieldFilterStore,
} from "@/stores/fieldFilterStore";

interface FieldFilterInputProps {
  filter: ActiveFilter;
  listId: string;
  onRemove: () => void;
}

export function FieldFilterInput({
  filter,
  listId,
  onRemove,
}: FieldFilterInputProps) {
  const { updateFilter } = useFieldFilterStore();
  const { data: customFields, isLoading } = useCustomFields(listId);

  // Handle loading state
  if (isLoading) return null;

  const field = customFields?.find((f) => f.id === filter.fieldId);
  if (!field) return null;

  // Rating Filter (Operator selector + Number input/Range)
  if (filter.fieldType === "rating") {
    const maxRating = field.config?.max_rating || 5;

    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{filter.fieldName}</span>

        {/* Operator selector */}
        <Select
          onValueChange={(op) => {
            // Type guard: Only values from SelectItem are valid FilterOperators
            if (
              op === "gte" ||
              op === "lte" ||
              op === "eq" ||
              op === "between"
            ) {
              updateFilter(filter.id, { operator: op });
            }
          }}
          value={filter.operator}
        >
          <SelectTrigger className="h-7 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gte">≥</SelectItem>
            <SelectItem value="lte">≤</SelectItem>
            <SelectItem value="eq">=</SelectItem>
            <SelectItem value="between">Range</SelectItem>
          </SelectContent>
        </Select>

        {/* Value input(s) */}
        {filter.operator === "between" ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-7 w-12 text-xs"
              max={maxRating}
              min={1}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(parsed)) {
                  const clamped = Math.max(1, Math.min(parsed, maxRating));
                  const max = filter.valueMax ?? maxRating;
                  updateFilter(filter.id, {
                    valueMin: Math.min(clamped, max),
                  });
                }
              }}
              type="number"
              value={filter.valueMin ?? 1}
            />
            <span className="text-xs">-</span>
            <Input
              className="h-7 w-12 text-xs"
              max={maxRating}
              min={1}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(parsed)) {
                  const clamped = Math.max(1, Math.min(parsed, maxRating));
                  const min = filter.valueMin ?? 1;
                  updateFilter(filter.id, {
                    valueMax: Math.max(clamped, min),
                  });
                }
              }}
              type="number"
              value={filter.valueMax ?? maxRating}
            />
          </div>
        ) : (
          <Input
            className="h-7 w-12 text-xs"
            max={maxRating}
            min={1}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(parsed)) {
                const clamped = Math.max(1, Math.min(parsed, maxRating));
                updateFilter(filter.id, { value: clamped });
              }
            }}
            type="number"
            value={typeof filter.value === "number" ? filter.value : 1}
          />
        )}

        <Button
          className="h-5 w-5"
          onClick={onRemove}
          size="icon"
          variant="ghost"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Select Filter (Dropdown)
  if (filter.fieldType === "select") {
    const options = field.config?.options || [];
    const selectValue =
      typeof filter.value === "string" ? filter.value : undefined;

    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{filter.fieldName}</span>

        <Select
          onValueChange={(val) => updateFilter(filter.id, { value: val })}
          value={selectValue}
        >
          <SelectTrigger className="h-7 w-[120px]">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: string) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="h-5 w-5"
          onClick={onRemove}
          size="icon"
          variant="ghost"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Text Filter (Search Input)
  if (filter.fieldType === "text") {
    const textValue = typeof filter.value === "string" ? filter.value : "";

    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{filter.fieldName}</span>

        <Input
          className="h-7 w-32"
          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
          placeholder="Search..."
          type="text"
          value={textValue}
        />

        <Button
          className="h-5 w-5"
          onClick={onRemove}
          size="icon"
          variant="ghost"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Boolean Filter (Switch)
  if (filter.fieldType === "boolean") {
    const boolValue = typeof filter.value === "boolean" ? filter.value : false;

    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{filter.fieldName}</span>

        <Switch
          checked={boolValue}
          onCheckedChange={(checked) =>
            updateFilter(filter.id, { value: checked })
          }
        />

        <span className="text-muted-foreground text-xs">
          {boolValue ? "Yes" : "No"}
        </span>

        <Button
          className="h-5 w-5"
          onClick={onRemove}
          size="icon"
          variant="ghost"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return null;
}
