import type { FieldType } from "@/types/customField";

/**
 * Generate human-readable preview of field config
 * Returns full strings - CSS handles truncation in the component
 *
 * @param fieldType - The type of the field
 * @param config - The field configuration object
 * @returns Formatted preview string
 *
 * @example
 * ```typescript
 * formatConfigPreview('select', { options: ['bad', 'good', 'great'] })
 * // Returns: "Options: bad, good, great"
 *
 * formatConfigPreview('rating', { max_rating: 5 })
 * // Returns: "Max: 5 stars"
 *
 * formatConfigPreview('text', { max_length: 500 })
 * // Returns: "Max length: 500"
 *
 * formatConfigPreview('text', {})
 * // Returns: "No length limit"
 *
 * formatConfigPreview('boolean', {})
 * // Returns: "Yes/No"
 * ```
 */
export function formatConfigPreview(
  fieldType: FieldType,
  config: Record<string, any>
): string {
  switch (fieldType) {
    case "select": {
      const options = config.options as string[] | undefined;
      if (!options || options.length === 0) {
        return "No options";
      }

      return `Options: ${options.join(", ")}`;
    }

    case "rating": {
      const maxRating = config.max_rating as number | undefined;
      return maxRating ? `Max: ${maxRating} stars` : "No max rating";
    }

    case "text": {
      const maxLength = config.max_length as number | undefined;
      return maxLength ? `Max length: ${maxLength}` : "No length limit";
    }

    case "boolean": {
      return "Yes/No";
    }

    default: {
      // Exhaustive check - TypeScript will error if new field type is added without handler
      // This code is unreachable in strict mode but provides runtime safety
      const _exhaustive: never = fieldType;
      void _exhaustive; // Suppress unused variable warning

      // Development safety: log warning if somehow reached (e.g., runtime type mismatch)
      console.warn("Unknown field type encountered:", fieldType);

      return "Unknown type";
    }
  }
}
