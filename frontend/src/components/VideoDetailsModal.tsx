import { useState, useEffect, useRef } from 'react'
import { VideoResponse } from '@/types/video'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CustomFieldsSection } from '@/components/CustomFieldsSection'
import { ChannelInfo } from '@/components/ChannelInfo'
import { useSetVideoCategory } from '@/hooks/useVideos'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatDuration } from '@/utils/formatDuration'
import { useVideoDetail } from '@/hooks/useVideoDetail'
import { VideoPlayer } from '@/components/VideoPlayer'
import { useVideoEnrichment, useRetryEnrichment } from '@/hooks/useVideoEnrichment'
import { EnrichmentStatus } from '@/components/EnrichmentStatus'
import type { TextTrack } from '@/types/player'
import { getLanguageLabel } from '@/lib/enrichmentUtils'

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

  // Enrichment data (captions, chapters)
  const {
    data: enrichment,
    isLoading: isEnrichmentLoading,
  } = useVideoEnrichment(video?.id, { enabled: open })

  const retryEnrichment = useRetryEnrichment()

  // Generate text tracks from enrichment data with proper cleanup
  const [textTracks, setTextTracks] = useState<TextTrack[]>([])
  const blobUrlsRef = useRef<string[]>([])

  useEffect(() => {
    // Cleanup previous blob URLs
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    blobUrlsRef.current = []

    const tracks: TextTrack[] = []

    if (enrichment?.captions_vtt) {
      // Create a blob URL from VTT content
      const blob = new Blob([enrichment.captions_vtt], { type: 'text/vtt' })
      const src = URL.createObjectURL(blob)
      blobUrlsRef.current.push(src)

      tracks.push({
        src,
        label: getLanguageLabel(enrichment.captions_language, enrichment.captions_source),
        language: enrichment.captions_language || 'en',
        kind: 'captions',
        type: 'vtt',
        default: true,
      })
    }

    if (enrichment?.chapters_vtt) {
      const blob = new Blob([enrichment.chapters_vtt], { type: 'text/vtt' })
      const src = URL.createObjectURL(blob)
      blobUrlsRef.current.push(src)

      tracks.push({
        src,
        label: 'Chapters',
        language: 'en',
        kind: 'chapters',
        type: 'vtt',
        default: true,
      })
    }

    setTextTracks(tracks)

    // Cleanup on unmount
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      blobUrlsRef.current = []
    }
  }, [enrichment?.captions_vtt, enrichment?.captions_language, enrichment?.captions_source, enrichment?.chapters_vtt])

  // Category change mutation (Step 5.12)
  const setVideoCategory = useSetVideoCategory()
  const [categoryError, setCategoryError] = useState<string | null>(null)

  // Handle category change
  const handleCategoryChange = (categoryId: string | null, restoreBackup?: boolean) => {
    if (!displayVideo?.id) return

    // TODO: Pass restoreBackup to API when endpoint supports it
    setVideoCategory.mutate(
      { videoId: displayVideo.id, categoryId, restoreBackup },
      {
        onSuccess: () => {
          setCategoryError(null)
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail || error.message || 'Kategorie konnte nicht geändert werden'
          setCategoryError(message)
        },
      }
    )
  }

  // Get current category and labels
  const currentCategory = displayVideo?.tags?.find((t) => t.is_video_type) ?? null
  const labels = displayVideo?.tags?.filter((t) => !t.is_video_type) ?? []

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
          {/* Video Player (replaces thumbnail) */}
          {/* key forces remount on video change to prevent "provider destroyed" errors */}
          <VideoPlayer
            key={displayVideo.youtube_id}
            youtubeId={displayVideo.youtube_id}
            videoId={displayVideo.id}
            initialPosition={displayVideo.watch_position}
            thumbnailUrl={displayVideo.thumbnail_url}
            textTracks={textTracks}
            thumbnailsVtt={enrichment?.thumbnails_vtt_url}
          />

          {/* Duration */}
          {displayVideo.duration && (
            <div className="text-sm text-gray-600">
              {formatDuration(displayVideo.duration)}
            </div>
          )}

          {/* Channel Info with Category (YouTube-style) */}
          <ChannelInfo
            channelName={displayVideo.channel}
            channelAvatarUrl={displayVideo.channel_thumbnail_url}
            currentCategory={currentCategory}
            onCategoryChange={handleCategoryChange}
            isCategoryMutating={setVideoCategory.isPending}
          />

          {/* Category Error */}
          {categoryError && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {categoryError}
            </div>
          )}

          {/* Labels (only is_video_type=false tags) - Step 5.12 */}
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {labels.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Enrichment Status */}
          <EnrichmentStatus
            enrichment={enrichment}
            isLoading={isEnrichmentLoading}
            onRetry={() => retryEnrichment.mutate(displayVideo.id)}
            isRetrying={retryEnrichment.isPending}
          />

          <Separator />

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
