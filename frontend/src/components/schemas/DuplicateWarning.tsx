/**
 * DuplicateWarning Component (Placeholder for Task #125)
 *
 * This is a placeholder implementation to unblock Task #123.
 * The full implementation will be done in Task #125.
 *
 * TODO Task #125: Implement reusable duplicate warning with:
 * - Real-time API check with debouncing
 * - Visual warning banner with existing field info
 * - Suggest using existing field vs creating new
 * - Accessibility with role="alert" and ARIA
 */

import { CustomField } from '@/types/customField'

interface DuplicateWarningProps {
  checking: boolean
  exists: boolean
  existingField: CustomField | null
  inputId?: string
}

export const DuplicateWarning = ({
  checking,
  exists,
  existingField,
  inputId,
}: DuplicateWarningProps) => {
  if (checking) {
    return (
      <p className="text-sm text-muted-foreground">
        Checking for duplicates...
      </p>
    )
  }

  if (!exists) {
    return null
  }

  return (
    <div
      id={inputId}
      className="rounded-md bg-yellow-50 border border-yellow-200 p-3 mt-2"
      role="alert"
    >
      <p className="text-sm text-yellow-800">
        ⚠️ A field named "{existingField?.name}" already exists.
        {existingField?.field_type && (
          <> Type: {existingField.field_type}</>
        )}
      </p>
      <p className="text-xs text-yellow-700 mt-1">
        DuplicateWarning full implementation pending (Task #125)
      </p>
    </div>
  )
}
