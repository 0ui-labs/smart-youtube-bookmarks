import { VideoResponse } from '@/types/video'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CustomFieldsSection } from '@/components/CustomFieldsSection'
import { Badge } from '@/components/ui/badge'
import { formatDuration } from '@/utils/formatDuration'

/**
 * VideoDetailsModal Component
 *
 * Modal dialog for displaying video details using shadcn/ui Dialog component.
 * Reuses CustomFieldsSection from Task #131 Step 2 (DRY principle).
 *
 * Features:
 * - Controlled modal pattern with open/onOpenChange props (REF MCP #3)
 * - Reuses CustomFieldsSection component (REF MCP #2)
 * - Displays video header: thumbnail, title, channel, duration, tags
 * - Inline field editing via CustomFieldsSection
 * - Responsive layout with max-w-4xl width and scrollable content
 *
 * REF MCP Best Practices:
 * - #3: Controlled Modal Pattern - Uses open/onOpenChange props (Radix UI best practice)
 * - #2: DRY Principle - Reuses CustomFieldsSection component (no duplication)
 *
 * Related Tasks:
 * - Task #131 Step 2: CustomFieldsSection (extracted component)
 * - Task #29: ConfirmDeleteModal (existing Dialog pattern reference)
 * - Task #130: VideoDetailsPage (alternative to modal navigation)
 *
 * @example
 * const [isOpen, setIsOpen] = useState(false)
 * const handleFieldChange = (fieldId: string, value: string | number | boolean) => {
 *   updateField.mutate({ fieldId, value })
 * }
 *
 * <VideoDetailsModal
 *   video={selectedVideo}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   listId="list-123"
 *   onFieldChange={handleFieldChange}
 * />
 */
interface VideoDetailsModalProps {
  /** Video data with available_fields (from Task #74 Two-Tier Strategy) */
  video: VideoResponse | null

  /** Controlled open state (REF MCP #3) */
  open: boolean

  /** Controlled close handler (REF MCP #3) */
  onOpenChange: (open: boolean) => void

  /** List ID for mutations */
  listId: string

  /** Callback when field value changes */
  onFieldChange: (fieldId: string, value: string | number | boolean) => void
}

export const VideoDetailsModal = ({
  video,
  open,
  onOpenChange,
  listId,
  onFieldChange,
}: VideoDetailsModalProps) => {
  // Early return if no video
  if (!video) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Video Header */}
        <DialogHeader>
          <DialogTitle>{video.title}</DialogTitle>
        </DialogHeader>

        {/* Video Content */}
        <div className="space-y-4">
          {/* 16:9 Thumbnail */}
          <div className="relative w-full aspect-video bg-gray-100 rounded-md overflow-hidden">
            <img
              src={video.thumbnail_url || ''}
              alt={video.title || 'Video thumbnail'}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Metadata: Duration, Channel */}
          <div className="flex flex-wrap gap-2 items-center text-sm text-gray-600">
            {video.duration && <span>{formatDuration(video.duration)}</span>}
            {video.channel && (
              <>
                {video.duration && <span>•</span>}
                <span>{video.channel}</span>
              </>
            )}
          </div>

          {/* Tags */}
          {video.tags && video.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {video.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Custom Fields Section (Reuse from Task #131 Step 2) */}
          <CustomFieldsSection
            availableFields={video.available_fields || []}
            fieldValues={video.field_values || []}
            videoId={video.id}
            listId={listId}
            onFieldChange={onFieldChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
