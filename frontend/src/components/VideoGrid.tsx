import { LayoutGrid } from 'lucide-react'
import { VideoCard } from './VideoCard'
import type { VideoResponse } from '@/types/video'
import type { GridColumnCount } from '@/stores/tableSettingsStore'

interface VideoGridProps {
  videos: VideoResponse[]
  gridColumns: GridColumnCount  // NEW: Dynamic column count from store
  onVideoClick?: (video: VideoResponse) => void
  onDeleteVideo?: (video: VideoResponse) => void
}

/**
 * VideoGrid Component - Responsive grid layout for video cards
 *
 * REF MCP Improvements Applied:
 * #5 - Enhanced empty state (icon + headline + description)
 * #6 - Responsive gap spacing (gap-4 mobile, gap-6 desktop)
 *
 * Grid Pattern (Task #35):
 * - Dynamic columns: User can select 2, 3, 4, or 5 columns
 * - Responsive behavior: mobile 1-2 cols, tablet 2 cols, desktop user choice (2-5)
 * - Standard Tailwind breakpoints: sm: 640px, md: 768px, lg: 1024px, xl: 1280px
 * - Responsive gap: gap-4 (16px mobile) → md:gap-6 (24px desktop)
 * - Empty state with centered message when no videos
 *
 * PurgeCSS Safety:
 * - All Tailwind classes explicitly written in object (no template literals)
 * - Pattern from Task #31 (proven working with thumbnailSize)
 */
export const VideoGrid = ({ videos, gridColumns, onVideoClick, onDeleteVideo }: VideoGridProps) => {
  // PurgeCSS-safe: All classes explicitly written in object (no template literals)
  // Responsive behavior: mobile 1-2, tablet 2, desktop user choice (2-5)
  // Pattern from Task #31 (proven working with thumbnailSize)
  // REF IMPROVEMENT #2: 5 cols uses md:grid-cols-2 instead of md:grid-cols-3 for better Tablet UX
  const gridColumnClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5', // Changed from md:grid-cols-3
  } as const
  // REF MCP #5: Enhanced empty state with icon and headline
  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <LayoutGrid className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Keine Videos im Grid</h3>
        <p className="text-muted-foreground max-w-sm">
          Füge Videos hinzu oder ändere deine Filter, um Inhalte in der Grid-Ansicht zu sehen.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`video-grid grid ${gridColumnClasses[gridColumns]} gap-4 md:gap-6`}
      role="list"
      aria-label="Video Grid"
    >
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onClick={onVideoClick}
          onDelete={onDeleteVideo}
        />
      ))}
    </div>
  )
}
