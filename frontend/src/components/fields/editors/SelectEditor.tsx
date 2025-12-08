import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface SelectEditorProps {
  value: string | null;
  options: string[]; // From SelectConfig.options
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * SelectEditor - Dropdown select input with Field Component Pattern
 *
 * Features:
 * - Dropdown menu with all options
 * - Checkmark for selected option
 * - Keyboard navigation (Radix UI)
 * - Loading state (disabled button)
 * - Error state with Field Component Pattern
 * - German placeholder "Auswählen..."
 *
 * Pattern: Field Component Pattern (CLAUDE.md requirement)
 */
export const SelectEditor = ({
  value,
  options,
  onChange,
  disabled = false,
  error,
  className,
}: SelectEditorProps) => {
  const displayValue = value ?? "Auswählen...";

  return (
    <Field className={className} data-invalid={!!error}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-invalid={!!error}
            className={cn(
              "w-full justify-between",
              error && "border-red-500",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
            role="combobox"
            variant="outline"
          >
            {displayValue}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          {options.map((option) => (
            <DropdownMenuItem
              className="cursor-pointer"
              key={option}
              onClick={() => onChange(option)}
            >
              <div className="flex w-full items-center justify-between">
                <span>{option}</span>
                {value === option && (
                  <Check className="ml-2 h-4 w-4 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <FieldError errors={[{ message: error }]} />}
    </Field>
  );
};
