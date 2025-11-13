import { useState, useEffect, useRef } from 'react'
import type { CustomField } from '@/types/customField'
import { RatingEditor } from './editors/RatingEditor'
import { SelectEditor } from './editors/SelectEditor'
import { TextEditor } from './editors/TextEditor'
import { BooleanEditor } from './editors/BooleanEditor'
import { useUpdateVideoFieldValues } from '@/hooks/useVideoFieldValues'
import { parseValidationError } from '@/hooks/useVideos'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldEditorProps {
  videoId: string
  field: CustomField
  value: number | string | boolean | null
  className?: string
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
  const [localValue, setLocalValue] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const updateMutation = useUpdateVideoFieldValues(videoId)

  // Sync local value when prop changes (from optimistic update or refetch)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Cleanup debounce timer on field change or unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [field.id])

  // Auto-save with debounce
  const handleChange = (newValue: number | string | boolean) => {
    // Update local state immediately
    setLocalValue(newValue)
    setError(null) // Clear previous errors

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce save (500ms)
    debounceTimerRef.current = setTimeout(() => {
      updateMutation.mutate(
        [{ field_id: field.id, value: newValue }],
        {
          onError: (err) => {
            // Parse backend validation error
            const errorMessage = parseValidationError(err)
            setError(errorMessage)

            // Rollback local value on error
            setLocalValue(value)
          },
        }
      )
    }, 500)
  }

  // Loading state: show spinner during mutation
  const isLoading = updateMutation.isPending

  // Type-specific editor rendering
  const renderEditor = () => {
    switch (field.field_type) {
      case 'rating': {
        const config = field.config as { max_rating: number }
        return (
          <RatingEditor
            value={localValue as number | null}
            max={config.max_rating}
            onChange={handleChange}
            disabled={isLoading}
            error={error ?? undefined}
          />
        )
      }

      case 'select': {
        const config = field.config as { options: string[] }
        return (
          <SelectEditor
            value={localValue as string | null}
            options={config.options}
            onChange={handleChange}
            disabled={isLoading}
            error={error ?? undefined}
          />
        )
      }

      case 'text': {
        const config = field.config as { max_length?: number | null }
        return (
          <TextEditor
            value={localValue as string | null}
            maxLength={config.max_length}
            onChange={handleChange}
            disabled={isLoading}
            error={error ?? undefined}
          />
        )
      }

      case 'boolean': {
        return (
          <BooleanEditor
            value={localValue as boolean | null}
            label={field.name}
            onChange={handleChange}
            disabled={isLoading}
            error={error ?? undefined}
          />
        )
      }

      default: {
        // TypeScript exhaustiveness check
        return null
      }
    }
  }

  return (
    <div className={cn('relative', className)}>
      {/* Editor with loading overlay */}
      <div className="relative">
        {renderEditor()}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute top-2 right-2 pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
