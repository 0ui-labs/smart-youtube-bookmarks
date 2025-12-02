import { Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useChannels,
  useDeleteChannel,
  useUpdateChannel,
} from "@/hooks/useChannels";
import type { Channel } from "@/types/channel";
import { getOptimizedAvatarUrl } from "@/utils/avatarUrl";

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

/**
 * ChannelsPage - YouTube-style list of all channels
 *
 * Displays all channels with:
 * - Large round avatar thumbnail
 * - Channel name
 * - Channel description (truncated to 2 lines)
 *
 * Clicking a channel navigates to videos filtered by that channel.
 *
 * Route: /channels
 */
export function ChannelsPage() {
  const navigate = useNavigate();
  const { data: channels = [], isLoading, isError } = useChannels(true);
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);

  const handleChannelClick = (channelId: string) => {
    navigate(`/videos?channel=${channelId}`);
  };

  const handleToggleVisibility = (
    channelId: string,
    currentlyHidden: boolean
  ) => {
    updateChannel.mutate({ channelId, data: { is_hidden: !currentlyHidden } });
  };

  const handleDeleteConfirm = () => {
    if (!channelToDelete) return;
    deleteChannel.mutate(channelToDelete.id, {
      onSuccess: () => setChannelToDelete(null),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="font-bold text-2xl">Alle Kanäle</h1>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div className="flex items-start gap-4 p-4" key={i}>
                <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="font-bold text-2xl">Alle Kanäle</h1>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="py-12 text-center">
            <p className="text-destructive">Fehler beim Laden der Kanäle.</p>
          </div>
        </main>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="font-bold text-2xl">Alle Kanäle</h1>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              Noch keine Kanäle vorhanden. Füge Videos hinzu, um Kanäle zu
              sehen.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="font-bold text-2xl">Alle Kanäle</h1>
          <p className="mt-1 text-muted-foreground">
            {channels.length} {channels.length === 1 ? "Kanal" : "Kanäle"}
          </p>
        </div>
      </header>

      {/* Channel List */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          {channels.map((channel) => (
            <div className="group relative flex items-start" key={channel.id}>
              <button
                className="flex w-full items-start gap-4 rounded-lg p-4 text-left transition-colors hover:bg-accent"
                onClick={() => handleChannelClick(channel.id)}
              >
                {/* Large round avatar - 80px display, optimized for Retina */}
                {channel.thumbnail_url ? (
                  <img
                    alt={channel.name}
                    className="h-20 w-20 flex-shrink-0 rounded-full object-cover"
                    height={80}
                    referrerPolicy="no-referrer"
                    src={
                      getOptimizedAvatarUrl(channel.thumbnail_url, 80) ??
                      channel.thumbnail_url
                    }
                    width={80}
                  />
                ) : (
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xl">
                    {getInitials(channel.name)}
                  </div>
                )}

                {/* Channel info */}
                <div className="min-w-0 flex-1 pt-1">
                  <h2 className="flex items-center gap-2 truncate font-semibold text-lg">
                    {channel.name}
                    {channel.is_hidden && (
                      <EyeOff className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                  </h2>
                  {channel.description ? (
                    <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                      {channel.description}
                    </p>
                  ) : (
                    <p className="mt-1 text-muted-foreground text-sm">
                      {channel.video_count}{" "}
                      {channel.video_count === 1 ? "Video" : "Videos"}
                    </p>
                  )}
                </div>
              </button>

              {/* 3-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="-translate-y-1/2 absolute top-1/2 right-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Menü öffnen</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      handleToggleVisibility(channel.id, channel.is_hidden)
                    }
                  >
                    {channel.is_hidden ? (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        In Navigation einblenden
                      </>
                    ) : (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Aus Navigation ausblenden
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setChannelToDelete(channel)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Kanal löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        onOpenChange={(open) => !open && setChannelToDelete(null)}
        open={!!channelToDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kanal löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du den Kanal „{channelToDelete?.name}" wirklich löschen?
              <br />
              <br />
              <strong>Hinweis:</strong> Die Videos dieses Kanals bleiben
              erhalten, verlieren aber ihre Kanal-Zuordnung.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteChannel.isPending}
              onClick={handleDeleteConfirm}
            >
              {deleteChannel.isPending ? "Wird gelöscht..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
