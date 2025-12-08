import { Star } from "lucide-react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface RatingStarsProps {
  /**
   * Current rating value (0-maxRating)
   */
  value: number | null;
  /**
   * Maximum rating value (default: 5)
   */
  maxRating?: number;
  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
  /**
   * Whether the rating is editable
   */
  readonly?: boolean;
  /**
   * Field name for accessibility
   */
  fieldName: string;
  /**
   * Callback when rating changes
   */
  onChange?: (value: number) => void;
  /**
   * Custom className for the container
   */
  className?: string;
}

/**
 * RatingStars Component
 *
 * Interactive star rating component with keyboard navigation and accessibility.
 *
 * REF MCP Improvements Applied:
 * - #1 (ARIA Pattern): role="radiogroup" with role="radio" buttons (proper rating pattern)
 * - #3 (Keyboard Navigation): Arrow Left/Right, Enter, Space keys
 * - #3 (Event Propagation): stopPropagation on all interactive events
 * - #4 (Performance): Wrapped in React.memo()
 * - #5 (Accessibility): aria-hidden="true" on all Star icons
 * - #5 (Accessibility): Complete ARIA labels with screen reader context
 * - #6 (Roving Tabindex): Only selected star is focusable for better keyboard UX
 *
 * @example
 * // Editable rating
 * <RatingStars
 *   value={4}
 *   maxRating={5}
 *   size="md"
 *   fieldName="Overall Rating"
 *   onChange={(newValue) => console.log(newValue)}
 * />
 *
 * @example
 * // Read-only rating
 * <RatingStars
 *   value={3}
 *   maxRating={5}
 *   readonly
 *   fieldName="Quality"
 * />
 */
export const RatingStars = React.memo<RatingStarsProps>(
  ({
    value,
    maxRating = 5,
    size = "md",
    readonly = false,
    fieldName,
    onChange,
    className,
  }) => {
    const [hoverValue, setHoverValue] = useState<number | null>(null);

    const displayValue = hoverValue !== null ? hoverValue : (value ?? 0);

    // Size classes
    const sizeClasses = {
      sm: "w-4 h-4",
      md: "w-5 h-5",
      lg: "w-6 h-6",
    };

    const handleClick = (starValue: number) => {
      if (readonly || !onChange) return;
      onChange(starValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent, currentValue: number) => {
      if (readonly || !onChange) return;

      // REF MCP #3: Keyboard navigation
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation(); // REF MCP #3: Prevent VideoCard click
        const newValue = Math.max(0, currentValue - 1);
        onChange(newValue);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation(); // REF MCP #3: Prevent VideoCard click
        const newValue = Math.min(maxRating, currentValue + 1);
        onChange(newValue);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation(); // REF MCP #3: Prevent VideoCard click
        onChange(currentValue);
      }
    };

    return (
      <div
        aria-label={`${fieldName}: ${value ?? 0} out of ${maxRating}`}
        className={cn("flex items-center gap-0.5", className)}
        onClick={(e) => e.stopPropagation()} // REF MCP #5: Screen reader context
        role="radiogroup" // REF MCP #3: Prevent VideoCard click
      >
        {Array.from({ length: maxRating }, (_, i) => {
          const starValue = i + 1;
          const isFilled = starValue <= displayValue;
          // REF CodeRabbit: First star focusable when unrated (value is null/0)
          const isSelected =
            (value ?? 0) === 0 ? starValue === 1 : starValue === (value ?? 0);

          return (
            <button
              aria-checked={isSelected}
              aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
              className={cn(
                "transition-colors duration-150",
                !readonly && "cursor-pointer hover:scale-110",
                readonly && "cursor-default"
              )}
              disabled={readonly}
              key={starValue}
              onClick={(e) => {
                e.stopPropagation(); // REF MCP #3: Prevent VideoCard click
                handleClick(starValue);
              }}
              onKeyDown={(e) => handleKeyDown(e, starValue)}
              onMouseEnter={() => !readonly && setHoverValue(starValue)}
              onMouseLeave={() => !readonly && setHoverValue(null)}
              role="radio" // REF MCP #5: ARIA label per button
              tabIndex={readonly ? -1 : isSelected ? 0 : -1} // REF CodeRabbit: Only selected star checked (not all filled stars)
              type="button" // Roving tabindex: only selected is focusable
            >
              <Star
                aria-hidden="true"
                className={cn(
                  sizeClasses[size],
                  isFilled
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-none text-gray-300",
                  "transition-all duration-150"
                )} // REF MCP #5: Hide icon from screen readers
              />
            </button>
          );
        })}
      </div>
    );
  }
);

RatingStars.displayName = "RatingStars";
