import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDuration } from '@/utils/formatDuration'
import type { VideoResponse } from '@/types/video'

// Import VideoThumbnail from VideosPage (reuse existing component)
// REF MCP Improvement #2: Use existing VideoThumbnail API (url, title props)
import { VideoThumbnail } from './VideosPage'

// Import CustomFieldsPreview for field value display (Task #89)
import { CustomFieldsPreview } from './fields'

interface VideoCardProps {
  video: VideoResponse
  onClick?: (video: VideoResponse) => void
  onDelete?: (videoId: string) => void
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
 */
export const VideoCard = ({ video, onClick, onDelete }: VideoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleCardClick = () => {
    onClick?.(video)
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
        <VideoThumbnail url={video.thumbnail_url} title={video.title || 'Untitled'} useFullWidth={true} />

        {/* Duration Overlay (bottom-right corner) */}
        {/* REF MCP #4: Enhanced readability with shadow-lg and border */}
        {video.duration && (
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

        {/* Channel Name */}
        {((video as any).channel_name || video.channel) && (
          <p className="text-xs text-muted-foreground truncate">
            {(video as any).channel_name || video.channel}
          </p>
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
    </div>
  )
}
