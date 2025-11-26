import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CustomFieldsSection } from '@/components/CustomFieldsSection'
import { AvailableFieldResponse, VideoFieldValue } from '@/types/video'

/**
 * CustomFieldsModal Component
 *
 * Modal dialog for displaying and editing custom fields.
 * Used on VideoDetailsPage to show fields in a separate dialog
 * instead of inline (full-width) display.
 *
 * Features:
 * - Controlled modal pattern with open/onOpenChange props
 * - Reuses CustomFieldsSection component (DRY principle)
 * - Scrollable content for many fields
 */
interface CustomFieldsModalProps {
  /** Modal open state */
  open: boolean

  /** Handler for modal state changes */
  onOpenChange: (open: boolean) => void

  /** All available fields for this video */
  availableFields: AvailableFieldResponse[]

  /** Current field values with metadata */
  fieldValues: VideoFieldValue[]

  /** Video ID for mutation context */
  videoId: string

  /** List ID for API calls */
  listId: string

  /** Callback when field value changes */
  onFieldChange: (fieldId: string, value: string | number | boolean) => void
}

export const CustomFieldsModal = ({
  open,
  onOpenChange,
  availableFields,
  fieldValues,
  videoId,
  listId,
  onFieldChange,
}: CustomFieldsModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="mt-2">
          <CustomFieldsSection
            availableFields={availableFields}
            fieldValues={fieldValues}
            videoId={videoId}
            listId={listId}
            onFieldChange={onFieldChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
