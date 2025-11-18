import { useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { FieldDisplay } from './FieldDisplay'
import { useUpdateVideoFieldValues } from '@/hooks/useVideoFieldValues'
import type { VideoFieldValue } from '@/types/video'

export interface CustomFieldsPreviewProps {
  videoId: string
  fieldValues: VideoFieldValue[]
  onMoreClick?: () => void
}

export const CustomFieldsPreview = ({
  videoId,
  fieldValues,
  onMoreClick
}: CustomFieldsPreviewProps) => {
  // Memoize expensive filtering/slicing to prevent re-computation on every render
  const cardFields = useMemo(
    () => fieldValues.filter(fv => fv.show_on_card).slice(0, 3),
    [fieldValues]
  )

  // Memoize "more fields" check separately for clarity
  const hasMoreFields = useMemo(
    () => fieldValues.filter(fv => fv.show_on_card).length > 3,
    [fieldValues]
  )

  // Memoize count calculation for badge text
  const moreFieldsCount = useMemo(
    () => fieldValues.filter(fv => fv.show_on_card).length - 3,
    [fieldValues]
  )

  const updateField = useUpdateVideoFieldValues(videoId)

  // Memoize change handler to prevent FieldDisplay re-renders
  // Note: FieldDisplay onChange now only receives value (not fieldId)
  const handleFieldChange = useCallback(
    (fieldId: string, value: string | number | boolean) => {
      updateField.mutate([{
        field_id: fieldId,
        value
      }])
    },
    [updateField]
  )

  // Early return if no fields to show
  if (cardFields.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {cardFields.map((fv) => (
        <div key={fv.field_id} className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">
            {fv.field.name}:
          </span>
          <FieldDisplay
            fieldValue={fv}
            onChange={(value) => handleFieldChange(fv.field_id, value)}
          />
        </div>
      ))}
      {hasMoreFields && (
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation()
            onMoreClick?.()
          }}
          aria-label={`View ${moreFieldsCount} more fields`}
        >
          +{moreFieldsCount} more
        </Badge>
      )}
    </div>
  )
}
