import { Outlet, useNavigate } from 'react-router-dom'
import { Home, History, ListVideo, Clock, Star, Settings } from 'lucide-react'
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar'
import { TagNavigation } from '@/components/TagNavigation'
import { ChannelNavigation } from '@/components/ChannelNavigation'
import { Button } from '@/components/ui/button'
import { useTags } from '@/hooks/useTags'
import { useChannels, useUpdateChannel } from '@/hooks/useChannels'
import { useTagStore } from '@/stores/tagStore'
import { useShallow } from 'zustand/react/shallow'
import { useState } from 'react'
import { CreateTagDialog } from './CreateTagDialog'
import { useLists } from '@/hooks/useLists'

/**
 * MainLayout - Shared layout with sidebar for all pages
 */
export function MainLayout() {
  const navigate = useNavigate()
  const { data: lists } = useLists()
  const listId = lists?.[0]?.id ?? ''

  // Tags
  const { data: tags = [], isLoading: tagsLoading, error: tagsError } = useTags()
  const selectedTagIds = useTagStore(useShallow((state) => state.selectedTagIds))
  const toggleTag = useTagStore((state) => state.toggleTag)
  const clearTags = useTagStore((state) => state.clearTags)
  const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false)

  // Channels
  const { data: channels = [], isLoading: channelsLoading } = useChannels()
  const updateChannel = useUpdateChannel()
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)

  const handleCreateTag = () => {
    setIsCreateTagDialogOpen(true)
  }

  const handleHideChannel = (channelId: string) => {
    updateChannel.mutate({ channelId, data: { is_hidden: true } })
    if (selectedChannelId === channelId) {
      setSelectedChannelId(null)
    }
  }

  const handleHomeClick = () => {
    setSelectedChannelId(null)
    clearTags()
    navigate('/videos')
  }

  const handleChannelSelect = (channelId: string | null) => {
    setSelectedChannelId(channelId)
    if (channelId) {
      navigate(`/videos?channel=${channelId}`)
    } else {
      navigate('/videos')
    }
  }

  const handleTagSelect = (tagId: string) => {
    toggleTag(tagId)
    navigate('/videos')
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <CollapsibleSidebar>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/d/dd/YouTube_Premium_logo.svg"
              alt="Logo"
              className="h-6"
            />
          </div>

          {/* Main Navigation */}
          <nav className="p-2 space-y-1">
            <button
              onClick={handleHomeClick}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <Home className="h-4 w-4" />
              Home
            </button>
            <button
              disabled
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground cursor-not-allowed"
            >
              <History className="h-4 w-4" />
              History
            </button>
            <button
              disabled
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground cursor-not-allowed"
            >
              <ListVideo className="h-4 w-4" />
              Playlists
            </button>
            <button
              disabled
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground cursor-not-allowed"
            >
              <Clock className="h-4 w-4" />
              Watch later
            </button>
            <button
              disabled
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground cursor-not-allowed"
            >
              <Star className="h-4 w-4" />
              Favorites
            </button>
          </nav>

          {/* Categories/Tags */}
          {tagsLoading ? (
            <div className="p-4 text-sm text-gray-500">Kategorien werden geladen...</div>
          ) : tagsError ? (
            <div className="p-4 text-sm text-red-600">Fehler beim Laden der Kategorien</div>
          ) : (
            <TagNavigation
              tags={tags}
              selectedTagIds={selectedTagIds}
              onTagSelect={handleTagSelect}
              onTagCreate={handleCreateTag}
            />
          )}

          {/* YouTube Channels Navigation */}
          <ChannelNavigation
            channels={channels}
            selectedChannelId={selectedChannelId}
            onChannelSelect={handleChannelSelect}
            onChannelHide={handleHideChannel}
            isLoading={channelsLoading}
          />

          {/* Settings Button */}
          <div className="mt-auto pt-4 border-t border-gray-200">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100"
              onClick={() => navigate('/settings/schemas')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Einstellungen
            </Button>
          </div>
        </div>
      </CollapsibleSidebar>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <Outlet />
      </div>

      {/* Create Tag Dialog */}
      <CreateTagDialog
        open={isCreateTagDialogOpen}
        onOpenChange={setIsCreateTagDialogOpen}
        listId={listId}
      />
    </div>
  )
}
