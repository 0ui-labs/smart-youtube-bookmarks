import { Check } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface SelectBadgeProps {
  /**
   * Current selected value
   */
  value: string | null;
  /**
   * Available options to select from
   */
  options: string[];
  /**
   * Field name for accessibility
   */
  fieldName: string;
  /**
   * Whether the field is read-only
   */
  readonly?: boolean;
  /**
   * Whether the field is disabled
   */
  disabled?: boolean;
  /**
   * Callback when value changes
   */
  onChange?: (value: string) => void;
  /**
   * Custom CSS class
   */
  className?: string;
}

/**
 * SelectBadge Component
 *
 * Interactive badge component for selecting from predefined options.
 * Displays selected value in a badge with optional dropdown for editing.
 *
 * REF MCP Improvements Applied:
 * - #4 (Event Propagation): stopPropagation() on DropdownMenuRadioItem onClick to prevent VideoCard click
 * - #5 (Accessibility): aria-hidden="true" on Check icon to hide from screen readers
 *
 * @example
 * // Editable select
 * <SelectBadge
 *   value="good"
 *   options={['bad', 'good', 'great']}
 *   fieldName="Quality"
 *   onChange={(newValue) => console.log(newValue)}
 * />
 *
 * @example
 * // Read-only select
 * <SelectBadge
 *   value="good"
 *   options={['bad', 'good', 'great']}
 *   fieldName="Quality"
 *   readonly
 * />
 */
export const SelectBadge = React.memo<SelectBadgeProps>(
  ({
    value,
    options,
    fieldName,
    readonly = false,
    disabled = false,
    onChange,
    className,
  }) => {
    // Display value: use placeholder dash for null
    const displayValue = value ?? "—";

    // Read-only mode: static badge
    if (readonly) {
      return (
        <Badge
          className={cn("cursor-default", className)}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          variant="secondary"
        >
          {displayValue}
        </Badge>
      );
    }

    // Editable mode: badge as dropdown trigger
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`${fieldName}: ${displayValue}, click to edit`}
            className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-0.5 font-semibold text-xs",
              "border-transparent bg-secondary text-secondary-foreground",
              "cursor-pointer transition-colors hover:bg-secondary/80",
              disabled && "cursor-not-allowed opacity-50",
              className
            )}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) e.preventDefault();
            }}
            type="button"
          >
            {displayValue}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuRadioGroup value={value ?? ""}>
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option}
                onClick={(e) => {
                  // REF MCP #4: stopPropagation to prevent VideoCard click
                  e.stopPropagation();
                  if (onChange) {
                    onChange(option);
                  }
                }}
                value={option}
              >
                <span className="flex-1">{option}</span>
                {value === option && (
                  <Check
                    aria-hidden="true"
                    // REF MCP #5: aria-hidden="true" to hide icon from screen readers
                    className="ml-2 h-4 w-4 shrink-0"
                  />
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

SelectBadge.displayName = "SelectBadge";
