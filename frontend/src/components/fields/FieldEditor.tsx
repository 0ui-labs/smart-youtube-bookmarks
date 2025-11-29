import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUpdateVideoFieldValues } from "@/hooks/useVideoFieldValues";
import { parseValidationError } from "@/hooks/useVideos";
import { cn } from "@/lib/utils";
import type { CustomField } from "@/types/customField";
import { BooleanEditor } from "./editors/BooleanEditor";
import { RatingEditor } from "./editors/RatingEditor";
import { SelectEditor } from "./editors/SelectEditor";
import { TextEditor } from "./editors/TextEditor";

interface FieldEditorProps {
  videoId: string;
  field: CustomField;
  value: number | string | boolean | null;
  className?: string;
}

/**
 * FieldEditor - Auto-saving field value editor
 *
 * Features:
 * - Type-specific editors for all 4 field types
 * - Auto-save on change (500ms debounce)
 * - Optimistic updates (immediate UI feedback)
 * - Loading indicator during save
 * - Inline validation errors
 * - Automatic rollback on error
 *
 * Pattern: Controlled component with mutation hook
 *
 * Usage:
 * ```tsx
 * <FieldEditor
 *   videoId={video.id}
 *   field={customField}
 *   value={currentValue}
 * />
 * ```
 */
export const FieldEditor = ({
  videoId,
  field,
  value,
  className,
}: FieldEditorProps) => {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateMutation = useUpdateVideoFieldValues(videoId);

  // Sync local value when prop changes (from optimistic update or refetch)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Cleanup debounce timer on field change or unmount
  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    },
    []
  );

  // Auto-save with debounce
  const handleChange = (newValue: number | string | boolean) => {
    // Update local state immediately
    setLocalValue(newValue);
    setError(null); // Clear previous errors

    // Clear existing timer (prevents race conditions)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Debounce save (500ms)
    debounceTimerRef.current = setTimeout(() => {
      updateMutation.mutate([{ field_id: field.id, value: newValue }], {
        onSuccess: () => {
          // Clear timer after successful mutation
          debounceTimerRef.current = null;
        },
        onError: (err) => {
          // Parse backend validation error
          const errorMessage = parseValidationError(err);
          setError(errorMessage);

          // Rollback local value on error
          setLocalValue(value);

          // Clear timer after error
          debounceTimerRef.current = null;
        },
      });
    }, 500);
  };

  // Loading state: show spinner during mutation
  const isLoading = updateMutation.isPending;

  // Type-specific editor rendering
  const renderEditor = () => {
    switch (field.field_type) {
      case "rating": {
        const config = field.config as { max_rating: number };
        return (
          <RatingEditor
            disabled={isLoading}
            error={error ?? undefined}
            max={config.max_rating}
            onChange={handleChange}
            value={localValue as number | null}
          />
        );
      }

      case "select": {
        const config = field.config as { options: string[] };
        return (
          <SelectEditor
            disabled={isLoading}
            error={error ?? undefined}
            onChange={handleChange}
            options={config.options}
            value={localValue as string | null}
          />
        );
      }

      case "text": {
        const config = field.config as { max_length?: number | null };
        return (
          <TextEditor
            disabled={isLoading}
            error={error ?? undefined}
            maxLength={config.max_length}
            onChange={handleChange}
            value={localValue as string | null}
          />
        );
      }

      case "boolean": {
        return (
          <BooleanEditor
            disabled={isLoading}
            error={error ?? undefined}
            label={field.name}
            onChange={handleChange}
            value={localValue as boolean | null}
          />
        );
      }

      default: {
        // TypeScript exhaustiveness check
        return null;
      }
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Editor with loading overlay */}
      <div className="relative">
        {renderEditor()}

        {/* Loading indicator */}
        {isLoading && (
          <div className="pointer-events-none absolute top-2 right-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};
