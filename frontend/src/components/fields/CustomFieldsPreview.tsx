import { useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useUpdateVideoFieldValues } from "@/hooks/useVideoFieldValues";
import type { VideoFieldValue } from "@/types/video";
import { FieldDisplay } from "./FieldDisplay";

export interface CustomFieldsPreviewProps {
  videoId: string;
  fieldValues: VideoFieldValue[];
  onMoreClick?: () => void;
}

export const CustomFieldsPreview = ({
  videoId,
  fieldValues,
  onMoreClick,
}: CustomFieldsPreviewProps) => {
  // Memoize expensive filtering/slicing to prevent re-computation on every render
  const cardFields = useMemo(
    () => fieldValues.filter((fv) => fv.show_on_card).slice(0, 3),
    [fieldValues]
  );

  // Memoize "more fields" check separately for clarity
  const hasMoreFields = useMemo(
    () => fieldValues.filter((fv) => fv.show_on_card).length > 3,
    [fieldValues]
  );

  // Memoize count calculation for badge text
  const moreFieldsCount = useMemo(
    () => fieldValues.filter((fv) => fv.show_on_card).length - 3,
    [fieldValues]
  );

  const updateField = useUpdateVideoFieldValues(videoId);

  // Memoize change handler to prevent FieldDisplay re-renders
  // Note: FieldDisplay onChange now only receives value (not fieldId)
  const handleFieldChange = useCallback(
    (fieldId: string, value: string | number | boolean) => {
      updateField.mutate([
        {
          field_id: fieldId,
          value,
        },
      ]);
    },
    [updateField]
  );

  // Early return if no fields to show
  if (cardFields.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {cardFields.map((fv) => (
        <div className="flex items-center gap-1.5" key={fv.field_id}>
          <span className="font-medium text-muted-foreground text-xs">
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
          aria-label={`View ${moreFieldsCount} more fields`}
          className="cursor-pointer hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation();
            onMoreClick?.();
          }}
          variant="outline"
        >
          +{moreFieldsCount} more
        </Badge>
      )}
    </div>
  );
};
