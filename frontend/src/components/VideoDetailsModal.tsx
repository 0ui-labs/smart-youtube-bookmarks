import { VideoResponse } from '@/types/video'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CustomFieldsSection } from '@/components/CustomFieldsSection'
import { Badge } from '@/components/ui/badge'
import { formatDuration } from '@/utils/formatDuration'
import { useVideoDetail } from '@/hooks/useVideoDetail'

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
  // FIX BUG #004: Load video from detail endpoint to get available_fields
  // The video from list endpoint has available_fields: null
  // We need to fetch from GET /api/videos/{id} to get the full data
  const { data: videoDetail, isLoading } = useVideoDetail(
    video?.id || null,
    open // Only fetch when modal is open
  )

  // Use videoDetail if loaded, fallback to prop video for basic info
  const displayVideo = videoDetail || video

  // Early return if no video
  if (!displayVideo) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Video Header */}
        <DialogHeader>
          <DialogTitle>{displayVideo.title}</DialogTitle>
        </DialogHeader>

        {/* Video Content */}
        <div className="space-y-4">
          {/* 16:9 Thumbnail */}
          <div className="relative w-full aspect-video bg-gray-100 rounded-md overflow-hidden">
            <img
              src={displayVideo.thumbnail_url || ''}
              alt={displayVideo.title || 'Video thumbnail'}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Metadata: Duration, Channel */}
          <div className="flex flex-wrap gap-2 items-center text-sm text-gray-600">
            {displayVideo.duration && <span>{formatDuration(displayVideo.duration)}</span>}
            {displayVideo.channel && (
              <>
                {displayVideo.duration && <span>•</span>}
                <span>{displayVideo.channel}</span>
              </>
            )}
          </div>

          {/* Tags */}
          {displayVideo.tags && displayVideo.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {displayVideo.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="text-center text-gray-500">Lade Felder...</div>
          )}

          {/* Custom Fields Section (Reuse from Task #131 Step 2) */}
          {/* Only show fields when videoDetail is loaded (has available_fields) */}
          {!isLoading && (
            <CustomFieldsSection
              availableFields={displayVideo.available_fields || []}
              fieldValues={displayVideo.field_values || []}
              videoId={displayVideo.id}
              listId={listId}
              onFieldChange={onFieldChange}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
