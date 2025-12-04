import { Clock, History, Home, ListVideo, Settings, Star } from "lucide-react";
import { useCallback, useState } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { ChannelNavigation } from "@/components/ChannelNavigation";
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar";
import { TagNavigation } from "@/components/TagNavigation";
import { Button } from "@/components/ui/button";
import { useChannels, useUpdateChannel } from "@/hooks/useChannels";
import { useLists } from "@/hooks/useLists";
import { useTags } from "@/hooks/useTags";
import { useImportDropStore } from "@/stores/importDropStore";
import { useTagStore } from "@/stores/tagStore";
import { useThemeStore } from "@/stores/themeStore";
import { CreateTagDialog } from "./CreateTagDialog";

/**
 * MainLayout - Shared layout with sidebar for all pages
 */
export function MainLayout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: lists } = useLists();
  const listId = lists?.[0]?.id ?? "";

  // Tags
  const {
    data: tags = [],
    isLoading: tagsLoading,
    error: tagsError,
  } = useTags();
  const selectedTagIds = useTagStore(
    useShallow((state) => state.selectedTagIds)
  );
  const toggleTag = useTagStore((state) => state.toggleTag);
  const clearTags = useTagStore((state) => state.clearTags);
  const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);

  // Channels - URL is the single source of truth
  const { data: channels = [], isLoading: channelsLoading } = useChannels();
  const updateChannel = useUpdateChannel();
  // Read selectedChannelId directly from URL instead of maintaining separate state
  const selectedChannelId = searchParams.get("channel");

  // Store for drag & drop imports
  const setPendingImport = useImportDropStore(
    (state) => state.setPendingImport
  );

  // Theme for logo switching
  const theme = useThemeStore((state) => state.theme);

  const handleCreateTag = () => {
    setIsCreateTagDialogOpen(true);
  };

  // Handle videos dropped on a tag
  const handleVideosDropped = useCallback(
    (tagId: string, urls: string[]) => {
      // Store the pending import with preselected category
      setPendingImport(urls, tagId);
      // Navigate to videos page (the modal will open there)
      navigate("/videos");
    },
    [setPendingImport, navigate]
  );

  const handleHideChannel = (channelId: string) => {
    updateChannel.mutate({ channelId, data: { is_hidden: true } });
    // If hiding the currently selected channel, navigate to clear the filter
    if (selectedChannelId === channelId) {
      navigate("/videos");
    }
  };

  const handleHomeClick = () => {
    clearTags();
    navigate("/videos");
  };

  const handleChannelSelect = (channelId: string | null) => {
    // URL is the single source of truth - just navigate
    if (channelId) {
      navigate(`/videos?channel=${channelId}`);
    } else {
      navigate("/videos");
    }
  };

  const handleTagSelect = (tagId: string) => {
    toggleTag(tagId);
    navigate("/videos");
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <CollapsibleSidebar>
        <div className="flex min-h-full flex-col">
          {/* Logo - switches based on theme */}
          <div className="p-4">
            <img
              alt="YouTube Logo"
              className="h-6"
              height={24}
              src={
                theme === "dark"
                  ? "/youTube-logo-white.svg"
                  : "/youTube-logo-black.svg"
              }
              width={98}
            />
          </div>

          {/* Main Navigation */}
          <nav className="space-y-1 p-2">
            <button
              className="nav-btn flex w-full touch-manipulation items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors active:bg-accent"
              onClick={handleHomeClick}
            >
              <Home className="h-4 w-4" />
              Home
            </button>
            <button
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm"
              disabled
            >
              <History className="h-4 w-4" />
              History
            </button>
            <button
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm"
              disabled
            >
              <ListVideo className="h-4 w-4" />
              Playlists
            </button>
            <button
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm"
              disabled
            >
              <Clock className="h-4 w-4" />
              Watch later
            </button>
            <button
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm"
              disabled
            >
              <Star className="h-4 w-4" />
              Favorites
            </button>
          </nav>

          {/* Categories/Tags */}
          {tagsLoading ? (
            <div className="p-4 text-muted-foreground text-sm">
              Kategorien werden geladen...
            </div>
          ) : tagsError ? (
            <div className="p-4 text-red-600 text-sm">
              Fehler beim Laden der Kategorien
            </div>
          ) : (
            <TagNavigation
              onTagCreate={handleCreateTag}
              onTagSelect={handleTagSelect}
              onVideosDropped={handleVideosDropped}
              selectedTagIds={selectedTagIds}
              tags={tags}
            />
          )}

          {/* YouTube Channels Navigation */}
          <ChannelNavigation
            channels={channels}
            isLoading={channelsLoading}
            onChannelHide={handleHideChannel}
            onChannelSelect={handleChannelSelect}
            selectedChannelId={selectedChannelId}
          />

          {/* Settings Button */}
          <div className="mt-auto pt-4 pb-4">
            <Button
              className="w-full justify-start text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => navigate("/settings/schemas")}
              variant="ghost"
            >
              <Settings className="mr-2 h-4 w-4" />
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
        listId={listId}
        onOpenChange={setIsCreateTagDialogOpen}
        open={isCreateTagDialogOpen}
      />
    </div>
  );
}
