/**
 * DuplicateWarning Component (Task #125 Phase 2)
 *
 * Displays real-time duplicate field name warnings with debounced API checks.
 * Automatically queries the backend to check for existing fields with the same name.
 *
 * Features:
 * - useQuery (NOT useMutation) for automatic request cancellation and caching
 * - Debounced field name input (300ms default) to reduce API calls
 * - Alert variant="default" with amber styling (NOT custom variant)
 * - Zod validation in config preview for runtime safety
 * - German labels and messages
 * - WCAG 2.1 Level AA accessible
 *
 * REF MCP Improvements:
 * #1 - useQuery instead of useMutation (automatic cancellation, caching)
 * #2 - default variant + className instead of custom warning variant
 * #3 - Zod validation in formatConfigPreview (runtime safety)
 *
 * @example
 * // In NewFieldForm:
 * <DuplicateWarning
 *   fieldName={fieldName}
 *   listId={listId}
 *   debounceMs={300}
 * />
 */

import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { AlertCircle, Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { checkFieldNameDuplicate } from '@/api/customFields'
import {
  CustomField,
  SelectConfigSchema,
  RatingConfigSchema,
  TextConfigSchema,
  BooleanConfigSchema,
} from '@/types/customFields'

interface DuplicateWarningProps {
  /** Field name to check for duplicates */
  fieldName: string
  /** List ID to scope the duplicate check */
  listId: string
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number
}

/**
 * Format field config for display preview
 *
 * REF MCP #3: Zod validation with graceful fallback
 */
function formatConfigPreview(field: CustomField): string {
  try {
    switch (field.field_type) {
      case 'select': {
        const result = SelectConfigSchema.safeParse(field.config)
        if (!result.success) return 'Konfiguration ungültig'

        const options = result.data.options
        if (options.length <= 3) {
          return `Optionen: ${options.join(', ')}`
        }
        const remaining = options.length - 3
        return `Optionen: ${options.slice(0, 3).join(', ')} +${remaining} weitere`
      }

      case 'rating': {
        const result = RatingConfigSchema.safeParse(field.config)
        if (!result.success) return 'Konfiguration ungültig'
        return `1-${result.data.max_rating} Sterne`
      }

      case 'text': {
        const result = TextConfigSchema.safeParse(field.config)
        if (!result.success) return 'Konfiguration ungültig'
        return result.data.max_length
          ? `Max. ${result.data.max_length} Zeichen`
          : 'Unbegrenzte Länge'
      }

      case 'boolean': {
        const result = BooleanConfigSchema.safeParse(field.config)
        if (!result.success) return 'Konfiguration ungültig'
        return 'Ja/Nein'
      }

      default:
        return 'Unbekannter Typ'
    }
  } catch {
    return 'Fehler beim Laden der Konfiguration'
  }
}

/**
 * Map field type to German label
 */
function getFieldTypeLabel(fieldType: string): string {
  const labels: Record<string, string> = {
    select: 'Auswahl',
    rating: 'Bewertung',
    text: 'Text',
    boolean: 'Ja/Nein',
  }
  return labels[fieldType] || fieldType
}

export const DuplicateWarning = ({
  fieldName,
  listId,
  debounceMs = 300,
}: DuplicateWarningProps) => {
  // REF MCP #1: useDebounce to reduce API calls
  const [debouncedName] = useDebounce(fieldName.trim(), debounceMs)

  // REF MCP #1: useQuery (NOT useMutation) for automatic cancellation and caching
  const { data, isLoading, error } = useQuery({
    queryKey: ['checkDuplicateField', listId, debouncedName],
    queryFn: () => checkFieldNameDuplicate(listId, debouncedName),
    enabled: debouncedName.length > 0, // Only run when there's a name to check
    staleTime: 30000, // Cache for 30 seconds (field names don't change frequently)
  })

  // Empty field name - return nothing
  if (!fieldName.trim()) {
    return null
  }

  // Loading state - show spinner
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Prüfe auf Duplikate...</span>
      </div>
    )
  }

  // Error state - show error message
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Fehler beim Prüfen</AlertTitle>
        <AlertDescription>
          Die Duplikatsprüfung konnte nicht durchgeführt werden. Bitte versuchen Sie es erneut.
        </AlertDescription>
      </Alert>
    )
  }

  // No duplicate - return nothing (silent success)
  if (!data?.exists || !data?.field) {
    return null
  }

  // Duplicate exists - show warning
  // REF MCP #2: variant="default" with className (NOT custom variant)
  return (
    <Alert
      variant="default"
      className="border-amber-500 bg-amber-50 dark:bg-amber-950 dark:border-amber-700"
      role="alert"
    >
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Feld existiert bereits
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <p className="mb-2">
          Ein Feld mit dem Namen <strong>"{data.field.name}"</strong> existiert bereits
          in dieser Liste.
        </p>
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-medium">Typ:</span>{' '}
            {getFieldTypeLabel(data.field.field_type)}
          </p>
          <p>
            <span className="font-medium">Konfiguration:</span>{' '}
            {formatConfigPreview(data.field)}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  )
}
