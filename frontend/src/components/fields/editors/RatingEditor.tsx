// frontend/src/components/fields/editors/RatingEditor.tsx

import { Star } from "lucide-react";
import { useState } from "react";
import { Field, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface RatingEditorProps {
  value: number | null;
  max: number; // From RatingConfig.max_rating (1-10)
  onChange: (value: number) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * RatingEditor - Editable star rating input with Field Component Pattern
 *
 * Features:
 * - Interactive star buttons (1-10 max)
 * - Hover preview
 * - Keyboard navigation (Arrow keys, Tab, Enter/Space)
 * - Loading state (disabled prop)
 * - Error state with Field Component Pattern
 * - German accessibility labels
 *
 * Pattern: Field Component Pattern (CLAUDE.md requirement)
 */
export const RatingEditor = ({
  value,
  max,
  onChange,
  disabled = false,
  error,
  className,
}: RatingEditorProps) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue ?? value ?? 0;

  const handleClick = (starValue: number) => {
    if (!disabled) {
      onChange(starValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentValue: number) => {
    if (disabled) return;

    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      if (currentValue < max) {
        onChange(currentValue + 1);
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      if (currentValue > 0) {
        onChange(currentValue - 1);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(currentValue);
    }
  };

  return (
    <Field className={className} data-invalid={!!error}>
      <div
        aria-label="Bewertung"
        className={cn(
          "flex gap-0.5 rounded-md border p-2",
          error ? "border-red-500" : "border-input",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onMouseLeave={() => !disabled && setHoverValue(null)}
        role="radiogroup"
      >
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1;
          const isFilled = starValue <= displayValue;
          const isSelected = starValue === value;

          return (
            <button
              aria-checked={isSelected}
              aria-label={`${starValue} ${starValue === 1 ? "Stern" : "Sterne"}`}
              className={cn(
                "cursor-pointer rounded transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isSelected && "ring-2 ring-ring ring-offset-2",
                disabled && "cursor-not-allowed"
              )}
              disabled={disabled}
              key={starValue}
              onClick={() => handleClick(starValue)}
              onKeyDown={(e) => handleKeyDown(e, starValue)}
              onMouseEnter={() => !disabled && setHoverValue(starValue)}
              role="radio"
              tabIndex={
                isSelected || (value === null && starValue === 1) ? 0 : -1
              }
              type="button"
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  isFilled
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-gray-200 text-gray-200"
                )}
              />
            </button>
          );
        })}
      </div>
      {error && <FieldError errors={[{ message: error }]} />}
    </Field>
  );
};
