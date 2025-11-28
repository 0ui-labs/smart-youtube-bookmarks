import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDuration } from '@/utils/formatDuration'
import type { VideoResponse } from '@/types/video'
import { useTagStore } from '@/stores/tagStore'
import { useImportProgressStore } from '@/stores/importProgressStore'

// Import VideoThumbnail from VideosPage (reuse existing component)
// REF MCP Improvement #2: Use existing VideoThumbnail API (url, title props)
import { VideoThumbnail } from './VideosPage'

// Import CustomFieldsPreview for field value display (Task #89)
import { CustomFieldsPreview } from './fields'

// Import ProgressOverlay for import progress display
import { ProgressOverlay } from './ProgressOverlay'

interface VideoCardProps {
  video: VideoResponse
  onDelete?: (videoId: string) => void
  onCardClick?: () => void  // NEW: Optional click handler from parent
}

/**
 * VideoCard Component - Grid view card for video display
 *
 * REF MCP Improvements Applied:
 * #2 - Reuses VideoThumbnail component (url, title props) - no recreation
 * #3 - Complete keyboard navigation (Enter, Space, Focus Management)
 * #4 - Duration overlay with shadow-lg and border for readability
 * #7 - Radix UI asChild pattern for DropdownMenu (better accessibility)
 *
 * Design Patterns:
 * - Responsive card with hover effects (shadow-lg transition)
 * - Clickable card with keyboard support (role="button", onKeyDown)
 * - Three-dot menu with stopPropagation (defense-in-depth)
 * - Native lazy loading via VideoThumbnail (already implemented)
 * - YouTube-inspired design (16:9 thumbnail, line-clamp-2 title, tag chips)
 * - WCAG 2.1 Level AA compliant (ARIA labels, keyboard navigation)
 *
 * Custom Fields Integration (Task #89):
 * - Shows CustomFieldsPreview component after tags
 * - Max 3 fields with inline editing
 * - "More fields" opens modal (placeholder for Task #90)
 *
 * Navigation (Task #130):
 * - Task #6: Click card/title/thumbnail → Navigate to /videos/:videoId
 * - Task #7: Click channel name → Select channel tag, filter to /videos
 * - useNavigate hook for React Router v6 navigation
 * - useTagStore for channel tag filtering with toggle action
 */
export const VideoCard = ({ video, onDelete, onCardClick }: VideoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { tags, toggleTag } = useTagStore()
  const { getProgress } = useImportProgressStore()

  // Two-phase import: Check BOTH WebSocket store AND DB fields for import state
  // WebSocket store provides real-time updates with smooth animation, DB fields provide fallback
  const storeProgress = getProgress(video.id)

  // Determine if video is importing: WebSocket store takes priority, DB fields as fallback
  // Simple logic: Only import_stage matters (data migration fixed legacy videos)
  // - 'complete' or 'error' = done
  // - 'created', 'metadata', 'captions', 'chapters' = still importing
  // - null/undefined = old video before feature (treat as done)
  const importing = storeProgress
    ? storeProgress.stage !== 'complete' && storeProgress.stage !== 'error'
    : video.import_stage != null &&
      video.import_stage !== 'complete' &&
      video.import_stage !== 'error'

  // Merge progress from store (real-time animated) or DB (fallback)
  // Use displayProgress for smooth animation, fallback to DB import_progress
  const importProgress = storeProgress ? {
    progress: storeProgress.displayProgress,  // Animated value for smooth UI
    stage: storeProgress.stage
  } : (video.import_stage ? {
    progress: video.import_progress ?? 0,
    stage: video.import_stage as 'created' | 'metadata' | 'captions' | 'chapters' | 'complete' | 'error'
  } : undefined)

  // Check if video import failed
  const hasError = video.import_stage === 'error'

  // Modal state removed - now handled at VideosPage level

  // Task #6: Navigate to video details page on card click
  // Updated: Use parent callback if provided (Grid view with modal/page logic)
  const handleCardClick = () => {
    // Disable card click while importing
    if (importing) {
      return
    }

    // Use parent callback if provided (VideosPage handles modal/page decision)
    if (onCardClick) {
      onCardClick()
      return
    }

    // Fallback: navigate to page (for standalone usage)
    navigate(`/videos/${video.id}`)
  }

  // Task #7: Find channel tag by name (case-insensitive) and toggle it
  const handleChannelClick = (e: React.MouseEvent, channelName: string) => {
    e.stopPropagation() // CRITICAL: Prevent card click navigation

    // Find channel tag by name (case-insensitive)
    const channelTag = tags.find(tag =>
      tag.name.toLowerCase() === channelName.toLowerCase()
    )

    if (channelTag) {
      toggleTag(channelTag.id)
      // Navigate to /videos to show filtered results
      navigate('/videos')
    }
  }

  // REF MCP #3: Complete keyboard navigation (Enter, Space)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  // Task #89: Handler for "More fields" click (placeholder for Task #90)
  const handleMoreFieldsClick = () => {
    // TODO: Task #90 - VideoDetailsModal implementation
    console.log('Open video details modal for:', video.id)
  }

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      // REF MCP #3: ARIA label with channel name for screen readers
      aria-label={`Video: ${video.title} von ${(video as any).channel_name || video.channel || 'Unbekannt'}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="video-card group cursor-pointer rounded-lg border bg-card transition-shadow duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {/* Thumbnail Container with Duration Overlay */}
      <div className="relative">
        {/* REF MCP #2: Reuse VideoThumbnail with correct API (url, title) */}
        {/* Task #35 Fix: Use useFullWidth={true} for Grid mode (container-adapted sizing) */}
        <div className={importing ? 'grayscale' : ''}>
          <VideoThumbnail url={video.thumbnail_url} title={video.title || 'Untitled'} useFullWidth={true} />
        </div>

        {/* Import Progress Overlay */}
        {importing && importProgress && (
          <ProgressOverlay progress={importProgress.progress} stage={importProgress.stage} />
        )}

        {/* Error Indicator (top-right corner) */}
        {hasError && (
          <div
            className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white shadow-lg"
            aria-label="Import-Fehler"
            data-error="true"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        )}

        {/* Duration Overlay (bottom-right corner) - hide while importing */}
        {/* REF MCP #4: Enhanced readability with shadow-lg and border */}
        {video.duration && !importing && (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white shadow-lg border border-white/20">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3 space-y-2">
        {/* Header: Title + Menu */}
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-sm font-semibold line-clamp-2 leading-tight">
            {video.title}
          </h3>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                }
              }}
              tabIndex={-1}
              className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              aria-label="Aktionen"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.(video.id)
                }}
                className="text-red-600 focus:text-red-700 cursor-pointer"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Channel Name - Task #7: Clickable to filter by channel tag */}
        {((video as any).channel_name || video.channel) && (
          <button
            onClick={(e) => handleChannelClick(e, (video as any).channel_name || video.channel)}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline truncate text-left w-full transition-colors"
            aria-label={`Filter by channel: ${(video as any).channel_name || video.channel}`}
          >
            {(video as any).channel_name || video.channel}
          </button>
        )}

        {/* Tags */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {video.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {tag.color && (
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span>{tag.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Custom Fields Preview (Task #89) */}
        {video.field_values && video.field_values.length > 0 && (
          <CustomFieldsPreview
            videoId={video.id}
            fieldValues={video.field_values}
            onMoreClick={handleMoreFieldsClick}
          />
        )}
      </div>

      {/* VideoDetailsModal removed - now rendered at VideosPage level */}
    </div>
  )
}
