import { LayoutGrid } from 'lucide-react'
import { VideoCard } from './VideoCard'
import type { VideoResponse } from '@/types/video'

interface VideoGridProps {
  videos: VideoResponse[]
  onVideoClick: (video: VideoResponse) => void
  onDelete: (videoId: string) => void
}

/**
 * VideoGrid Component - Responsive grid layout for video cards
 *
 * REF MCP Improvements Applied:
 * #5 - Enhanced empty state (icon + headline + description)
 * #6 - Responsive gap spacing (gap-4 mobile, gap-6 desktop)
 *
 * Grid Pattern:
 * - Tailwind responsive grid: grid-cols-2 (mobile) → md:grid-cols-3 (tablet) → lg:grid-cols-4 (desktop)
 * - Standard Tailwind breakpoints: sm: 640px, md: 768px, lg: 1024px, xl: 1280px
 * - Responsive gap: gap-4 (16px mobile) → md:gap-6 (24px desktop)
 * - Empty state with centered message when no videos
 *
 * PurgeCSS Safety:
 * - All Tailwind classes explicitly written (no template literals)
 * - grid-cols-2, md:grid-cols-3, lg:grid-cols-4 are all scanned by PurgeCSS
 */
export const VideoGrid = ({ videos, onVideoClick, onDelete }: VideoGridProps) => {
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
      className="video-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
      role="list"
      aria-label="Video Grid"
    >
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onClick={onVideoClick}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
