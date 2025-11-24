import { MoreHorizontal, EyeOff, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { Channel } from '@/types/channel'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Get initials from channel name (max 2 characters)
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface ChannelNavigationProps {
  channels: Channel[]
  selectedChannelId: string | null
  onChannelSelect: (channelId: string | null) => void
  onChannelHide?: (channelId: string) => void
  isLoading?: boolean
}

/**
 * ChannelNavigation Component
 *
 * Displays a list of YouTube channels in the sidebar with single-select functionality.
 * Features:
 * - Video count badge per channel
 * - Visual selection state with background color
 * - "Alle Kanäle" option to clear filter
 * - Context menu to hide channels
 * - Full accessibility with ARIA attributes
 */
const MAX_VISIBLE_CHANNELS = 10

export const ChannelNavigation = ({
  channels,
  selectedChannelId,
  onChannelSelect,
  onChannelHide,
  isLoading = false,
}: ChannelNavigationProps) => {
  // Limit displayed channels
  const visibleChannels = channels.slice(0, MAX_VISIBLE_CHANNELS)
  const hasMoreChannels = channels.length > MAX_VISIBLE_CHANNELS

  if (isLoading) {
    return (
      <div className="channel-navigation p-4">
        <h2 className="text-lg font-semibold mb-4 px-3">Kanäle</h2>
        <div className="space-y-2 px-3">
          <div className="h-8 bg-muted animate-pulse rounded-md" />
          <div className="h-8 bg-muted animate-pulse rounded-md" />
          <div className="h-8 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="channel-navigation p-4">
        <h2 className="text-lg font-semibold mb-4 px-3">Kanäle</h2>
        <p className="text-sm text-muted-foreground px-3">
          Noch keine Kanäle. Füge Videos hinzu um Kanäle zu sehen.
        </p>
      </div>
    )
  }

  return (
    <div className="channel-navigation p-4">
      {/* Header */}
      <h2 className="text-lg font-semibold mb-4 px-3">Kanäle</h2>

      {/* Channel list */}
      <div className="space-y-1">
        {/* Individual channels (limited to MAX_VISIBLE_CHANNELS) */}
        {visibleChannels.map((channel) => {
          const isSelected = selectedChannelId === channel.id

          return (
            <div
              key={channel.id}
              className={cn(
                'group flex items-center gap-1 rounded-md transition-colors',
                'hover:bg-accent',
                isSelected && 'bg-accent'
              )}
            >
              <button
                onClick={() => onChannelSelect(channel.id)}
                aria-pressed={isSelected}
                aria-label={`Kanal ${channel.name} ${isSelected ? 'abwählen' : 'auswählen'}`}
                className={cn(
                  'flex-1 flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  isSelected && 'font-medium'
                )}
              >
                {/* Channel Avatar/Thumbnail */}
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.name}
                    className="h-6 w-6 rounded-full flex-shrink-0 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full flex-shrink-0 bg-muted flex items-center justify-center text-xs">
                    {getInitials(channel.name)}
                  </div>
                )}
                <span className="flex-1 text-left truncate" title={channel.name}>
                  {channel.name.length > 20 ? `${channel.name.slice(0, 20)}…` : channel.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 hidden">
                  {channel.video_count}
                </span>
              </button>

              {/* Context menu for hiding */}
              {onChannelHide && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1 mr-1 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/10 rounded transition-opacity"
                      aria-label={`Optionen für ${channel.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onChannelHide(channel.id)
                      }}
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      Kanal ausblenden
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        })}

        {/* Show all link when there are more channels */}
        {hasMoreChannels && (
          <Link
            to="/channels"
            className={cn(
              'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
          >
            <span>Alle Kanäle</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
