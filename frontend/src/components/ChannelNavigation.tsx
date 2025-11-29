import { ChevronRight, EyeOff, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Channel } from "@/types/channel";

/**
 * Get initials from channel name (max 2 characters)
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface ChannelNavigationProps {
  channels: Channel[];
  selectedChannelId: string | null;
  onChannelSelect: (channelId: string | null) => void;
  onChannelHide?: (channelId: string) => void;
  isLoading?: boolean;
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
const MAX_VISIBLE_CHANNELS = 10;

export const ChannelNavigation = ({
  channels,
  selectedChannelId,
  onChannelSelect,
  onChannelHide,
  isLoading = false,
}: ChannelNavigationProps) => {
  // Limit displayed channels
  const visibleChannels = channels.slice(0, MAX_VISIBLE_CHANNELS);
  const hasMoreChannels = channels.length > MAX_VISIBLE_CHANNELS;

  if (isLoading) {
    return (
      <div className="channel-navigation p-4">
        <h2 className="mb-4 px-3 font-semibold text-lg">Kanäle</h2>
        <div className="space-y-2 px-3">
          <div className="h-8 animate-pulse rounded-md bg-muted" />
          <div className="h-8 animate-pulse rounded-md bg-muted" />
          <div className="h-8 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="channel-navigation p-4">
        <h2 className="mb-4 px-3 font-semibold text-lg">Kanäle</h2>
        <p className="px-3 text-muted-foreground text-sm">
          Noch keine Kanäle. Füge Videos hinzu um Kanäle zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="channel-navigation p-4">
      {/* Header */}
      <h2 className="mb-4 px-3 font-semibold text-lg">Kanäle</h2>

      {/* Channel list */}
      <div className="space-y-1">
        {/* Individual channels (limited to MAX_VISIBLE_CHANNELS) */}
        {visibleChannels.map((channel) => {
          const isSelected = selectedChannelId === channel.id;

          return (
            <div
              className={cn(
                "group flex items-center gap-1 rounded-md transition-colors",
                "hover:bg-accent",
                isSelected && "bg-accent"
              )}
              key={channel.id}
            >
              <button
                aria-label={`Kanal ${channel.name} ${isSelected ? "abwählen" : "auswählen"}`}
                aria-pressed={isSelected}
                className={cn(
                  "flex flex-1 items-center gap-2 px-3 py-2 text-sm transition-colors",
                  isSelected && "font-medium"
                )}
                onClick={() => onChannelSelect(channel.id)}
              >
                {/* Channel Avatar/Thumbnail */}
                {channel.thumbnail_url ? (
                  <img
                    alt={channel.name}
                    className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    src={channel.thumbnail_url}
                  />
                ) : (
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                    {getInitials(channel.name)}
                  </div>
                )}
                <span
                  className="flex-1 truncate text-left"
                  title={channel.name}
                >
                  {channel.name.length > 20
                    ? `${channel.name.slice(0, 20)}…`
                    : channel.name}
                </span>
                <span className="hidden flex-shrink-0 text-muted-foreground text-xs tabular-nums">
                  {channel.video_count}
                </span>
              </button>

              {/* Context menu for hiding */}
              {onChannelHide && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={`Optionen für ${channel.name}`}
                      className="mr-1 rounded p-1 opacity-0 transition-opacity hover:bg-accent-foreground/10 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onChannelHide(channel.id);
                      }}
                    >
                      <EyeOff className="mr-2 h-4 w-4" />
                      Kanal ausblenden
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}

        {/* Show all link when there are more channels */}
        {hasMoreChannels && (
          <Link
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            to="/channels"
          >
            <span>Alle Kanäle</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
};
