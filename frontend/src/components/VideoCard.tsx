import { useRef } from 'react'
import { formatDuration } from '@/utils/formatDuration'
import type { VideoResponse } from '@/types/video'

// Import VideoThumbnail from VideosPage (reuse existing component)
// REF MCP Improvement #2: Use existing VideoThumbnail API (url, title props)
import { VideoThumbnail } from './VideosPage'

interface VideoCardProps {
  video: VideoResponse
  onClick?: (video: VideoResponse) => void
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
 */
export const VideoCard = ({ video, onClick }: VideoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleCardClick = () => {
    onClick?.(video)
  }

  // REF MCP #3: Complete keyboard navigation (Enter, Space)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }


  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      // REF MCP #3: ARIA label with channel name for screen readers
      aria-label={`Video: ${video.title} von ${video.channel || 'Unbekannt'}`}
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
        {/* Title (max 2 lines) */}
        <h3 className="text-sm font-semibold line-clamp-2 leading-tight">
          {video.title}
        </h3>

        {/* Channel Name */}
        {video.channel && (
          <p className="text-xs text-muted-foreground truncate">
            {video.channel}
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
      </div>

    </div>
  )
}
