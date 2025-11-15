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
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useFieldFilterStore, ActiveFilter } from '@/stores/fieldFilterStore';
import { useCustomFields } from '@/hooks/useCustomFields';

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
  const { data: customFields } = useCustomFields(listId);

  const field = customFields?.find((f) => f.id === filter.fieldId);
  if (!field) return null;

  // Rating Filter (Operator selector + Number input/Range)
  if (filter.fieldType === 'rating') {
    const maxRating = field.config?.max_rating || 5;

    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{filter.fieldName}</span>

        {/* Operator selector */}
        <Select
          value={filter.operator}
          onValueChange={(op) =>
            updateFilter(filter.id, { operator: op as any })
          }
        >
          <SelectTrigger className="w-[70px] h-7">
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
        {filter.operator === 'between' ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={maxRating}
              value={filter.valueMin || 1}
              onChange={(e) =>
                updateFilter(filter.id, {
                  valueMin: parseInt(e.target.value),
                })
              }
              className="w-12 h-7 text-xs"
            />
            <span className="text-xs">-</span>
            <Input
              type="number"
              min={1}
              max={maxRating}
              value={filter.valueMax || maxRating}
              onChange={(e) =>
                updateFilter(filter.id, {
                  valueMax: parseInt(e.target.value),
                })
              }
              className="w-12 h-7 text-xs"
            />
          </div>
        ) : (
          <Input
            type="number"
            min={1}
            max={maxRating}
            value={(filter.value as number) || 1}
            onChange={(e) =>
              updateFilter(filter.id, { value: parseInt(e.target.value) })
            }
            className="w-12 h-7 text-xs"
          />
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Select Filter (Dropdown)
  if (filter.fieldType === 'select') {
    const options = field.config?.options || [];

    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{filter.fieldName}</span>

        <Select
          value={filter.value as string}
          onValueChange={(val) => updateFilter(filter.id, { value: val })}
        >
          <SelectTrigger className="w-[120px] h-7">
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
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Text Filter (Search Input)
  if (filter.fieldType === 'text') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{filter.fieldName}</span>

        <Input
          type="text"
          placeholder="Search..."
          value={(filter.value as string) || ''}
          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
          className="w-32 h-7"
        />

        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Boolean Filter (Switch)
  if (filter.fieldType === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{filter.fieldName}</span>

        <Switch
          checked={filter.value as boolean}
          onCheckedChange={(checked) =>
            updateFilter(filter.id, { value: checked })
          }
        />

        <span className="text-xs text-muted-foreground">
          {filter.value ? 'Yes' : 'No'}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return null;
}
