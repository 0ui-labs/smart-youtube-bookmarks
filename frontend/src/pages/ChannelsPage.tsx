import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EyeOff, Eye, MoreHorizontal, Trash2 } from 'lucide-react'
import { useChannels, useUpdateChannel, useDeleteChannel } from '@/hooks/useChannels'
import type { Channel } from '@/types/channel'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

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
  const navigate = useNavigate()
  const { data: channels = [], isLoading, isError } = useChannels(true)
  const updateChannel = useUpdateChannel()
  const deleteChannel = useDeleteChannel()
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null)

  const handleChannelClick = (channelId: string) => {
    navigate(`/videos?channel=${channelId}`)
  }

  const handleToggleVisibility = (channelId: string, currentlyHidden: boolean) => {
    updateChannel.mutate({ channelId, data: { is_hidden: !currentlyHidden } })
  }

  const handleDeleteConfirm = () => {
    if (!channelToDelete) return
    deleteChannel.mutate(channelToDelete.id, {
      onSuccess: () => setChannelToDelete(null),
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-bold">Alle Kanäle</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4">
                <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-bold">Alle Kanäle</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-destructive">Fehler beim Laden der Kanäle.</p>
          </div>
        </main>
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-bold">Alle Kanäle</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Noch keine Kanäle vorhanden. Füge Videos hinzu, um Kanäle zu sehen.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold">Alle Kanäle</h1>
          <p className="text-muted-foreground mt-1">
            {channels.length} {channels.length === 1 ? 'Kanal' : 'Kanäle'}
          </p>
        </div>
      </header>

      {/* Channel List */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-2">
          {channels.map((channel) => (
            <div key={channel.id} className="group relative flex items-start">
              <button
                onClick={() => handleChannelClick(channel.id)}
                className="w-full flex items-start gap-4 p-4 rounded-lg hover:bg-accent transition-colors text-left"
              >
              {/* Large round avatar */}
              {channel.thumbnail_url ? (
                <img
                  src={channel.thumbnail_url}
                  alt={channel.name}
                  className="h-20 w-20 rounded-full flex-shrink-0 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-20 w-20 rounded-full flex-shrink-0 bg-muted flex items-center justify-center text-xl">
                  {getInitials(channel.name)}
                </div>
              )}

              {/* Channel info */}
              <div className="flex-1 min-w-0 pt-1">
                <h2 className="text-lg font-semibold truncate flex items-center gap-2">
                  {channel.name}
                  {channel.is_hidden && (
                    <EyeOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </h2>
                {channel.description ? (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {channel.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    {channel.video_count} {channel.video_count === 1 ? 'Video' : 'Videos'}
                  </p>
                )}
              </div>
              </button>

              {/* 3-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Menü öffnen</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleToggleVisibility(channel.id, channel.is_hidden)}>
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
      <AlertDialog open={!!channelToDelete} onOpenChange={(open) => !open && setChannelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kanal löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du den Kanal „{channelToDelete?.name}" wirklich löschen?
              <br /><br />
              <strong>Hinweis:</strong> Die Videos dieses Kanals bleiben erhalten,
              verlieren aber ihre Kanal-Zuordnung.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteChannel.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteChannel.isPending ? 'Wird gelöscht...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
