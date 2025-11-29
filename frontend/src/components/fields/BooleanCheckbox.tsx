import React from "react";

export interface BooleanCheckboxProps {
  /**
   * Current boolean value (null treated as false)
   */
  value: boolean | null;
  /**
   * Field name for label and accessibility
   */
  fieldName: string;
  /**
   * Whether the field is editable
   */
  readonly?: boolean;
  /**
   * Callback when value changes
   */
  onChange?: (value: boolean) => void;
  /**
   * Optional custom CSS class
   */
  className?: string;
}

/**
 * BooleanCheckbox Component
 *
 * Native checkbox input with label for boolean field values.
 * Uses native HTML <input type="checkbox"> for maximum compatibility
 * and accessibility.
 *
 * REF MCP Improvements Applied:
 * - #3 (Event Propagation): stopPropagation on all interactive events
 * - #4 (Performance): Wrapped in React.memo()
 * - #5 (Accessibility): Complete ARIA labels with checked state
 *
 * @example
 * // Editable checkbox
 * <BooleanCheckbox
 *   value={true}
 *   fieldName="Recommended"
 *   onChange={(newValue) => console.log(newValue)}
 * />
 *
 * @example
 * // Read-only checkbox
 * <BooleanCheckbox
 *   value={false}
 *   fieldName="Watched"
 *   readonly
 * />
 */
export const BooleanCheckbox = React.memo<BooleanCheckboxProps>(
  ({ value, fieldName, readonly = false, onChange, className = "" }) => {
    const checked = value ?? false; // Treat null as false
    const id = React.useId();
    const checkboxId = `${id}-${fieldName}`;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation(); // REF MCP #3: Prevent event bubbling
      onChange?.(e.target.checked);
    };

    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation(); // REF MCP #3: Prevent event bubbling
    };

    const handleLabelClick = (e: React.MouseEvent<HTMLLabelElement>) => {
      e.stopPropagation(); // REF MCP #3: Prevent event bubbling
    };

    return (
      <div
        className={`flex items-center gap-2 ${className}`}
        onClick={(e) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
      >
        <input
          aria-label={`${fieldName}: ${checked ? "checked" : "unchecked"}`}
          checked={checked}
          className="h-4 w-4 cursor-pointer rounded accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={readonly}
          id={checkboxId}
          onChange={handleChange}
          onClick={handleClick} // REF MCP #5: Screen reader context
          type="checkbox"
        />
        <label
          className={`text-sm ${readonly ? "cursor-default" : "cursor-pointer"}`}
          htmlFor={checkboxId}
          onClick={handleLabelClick}
        >
          {fieldName}
        </label>
      </div>
    );
  }
);

BooleanCheckbox.displayName = "BooleanCheckbox";
