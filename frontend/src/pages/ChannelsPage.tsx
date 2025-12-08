import { Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Minimum number of channels to show alphabetic navigation */
const ALPHABET_NAV_THRESHOLD = 50;

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
 * Group channels by their first letter (alphabetically)
 */
function groupChannelsByLetter(channels: Channel[]): Map<string, Channel[]> {
  const grouped = new Map<string, Channel[]>();

  for (const channel of channels) {
    const firstChar = channel.name.charAt(0).toUpperCase();
    // Use "#" for numbers and special characters
    const letter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";

    if (!grouped.has(letter)) {
      grouped.set(letter, []);
    }
    grouped.get(letter)?.push(channel);
  }

  // Sort the map by keys (A-Z, then #)
  return new Map(
    [...grouped.entries()].sort((a, b) => {
      if (a[0] === "#") return 1;
      if (b[0] === "#") return -1;
      return a[0].localeCompare(b[0]);
    })
  );
}

/**
 * iOS-style Alphabet Sidebar Component
 * Optimized for smooth touch scrubbing without lag
 */
function AlphabetSidebar({
  letters,
  activeLetter,
  onLetterClick,
  onLetterHover,
}: {
  letters: string[];
  activeLetter: string | null;
  onLetterClick: (letter: string, instant?: boolean) => void;
  onLetterHover: (letter: string | null) => void;
}) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  // Local state for the currently dragged letter (for immediate visual feedback)
  const [dragLetter, setDragLetter] = useState<string | null>(null);
  // Cache button positions for fast lookup
  const buttonRectsRef = useRef<
    { top: number; bottom: number; letter: string }[]
  >([]);

  // Cache button positions on mount and when letters change
  useEffect(() => {
    const updateButtonRects = () => {
      if (!sidebarRef.current) return;
      const buttons = sidebarRef.current.querySelectorAll("button");
      buttonRectsRef.current = Array.from(buttons).map((button, i) => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, letter: letters[i] };
      });
    };

    // Initial calculation after render
    requestAnimationFrame(updateButtonRects);

    // Recalculate on resize
    window.addEventListener("resize", updateButtonRects);
    return () => window.removeEventListener("resize", updateButtonRects);
  }, [letters]);

  // Get letter from position using cached rects (fast!)
  const getLetterFromY = useCallback((clientY: number): string | null => {
    const rects = buttonRectsRef.current;
    if (rects.length === 0) return null;

    // Binary search could be used here, but linear is fine for 26 items
    for (const rect of rects) {
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return rect.letter;
      }
    }

    // Clamp to first/last letter if outside bounds
    const lastRect = rects.at(-1);
    if (clientY < rects[0].top) return rects[0].letter;
    if (lastRect && clientY > lastRect.bottom) return lastRect.letter;

    return null;
  }, []);

  // Unified handler for both touch and mouse
  const handleInteraction = useCallback(
    (clientY: number, isStart = false) => {
      if (isStart) {
        isDraggingRef.current = true;
        // Recalculate button positions at drag start (in case of scroll)
        if (sidebarRef.current) {
          const buttons = sidebarRef.current.querySelectorAll("button");
          buttonRectsRef.current = Array.from(buttons).map((button, i) => {
            const rect = button.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, letter: letters[i] };
          });
        }
      }

      if (!isDraggingRef.current) return;

      const letter = getLetterFromY(clientY);
      if (letter && letter !== dragLetter) {
        setDragLetter(letter);
        onLetterClick(letter, true);
        onLetterHover(letter);
      }
    },
    [getLetterFromY, dragLetter, letters, onLetterClick, onLetterHover]
  );

  const handleEnd = useCallback(() => {
    isDraggingRef.current = false;
    setDragLetter(null);
    onLetterHover(null);
  }, [onLetterHover]);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) handleInteraction(touch.clientY, true);
    },
    [handleInteraction]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) handleInteraction(touch.clientY);
    },
    [handleInteraction]
  );

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleInteraction(e.clientY, true);
    },
    [handleInteraction]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleInteraction(e.clientY);
    },
    [handleInteraction]
  );

  // Use dragLetter during drag for immediate feedback, otherwise activeLetter
  const displayLetter = dragLetter || activeLetter;

  return (
    <nav
      aria-label="Alphabetische Navigation"
      className="-translate-y-1/2 fixed top-1/2 right-1 z-50 flex touch-none select-none flex-col items-center rounded-full bg-background/80 px-1.5 py-2 backdrop-blur-sm md:right-6"
      onMouseDown={handleMouseDown}
      onMouseLeave={handleEnd}
      onMouseMove={handleMouseMove}
      onMouseUp={handleEnd}
      onTouchEnd={handleEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      ref={sidebarRef}
    >
      {letters.map((letter) => (
        <button
          className={`flex h-5 w-5 items-center justify-center rounded-full font-medium text-xs ${
            displayLetter === letter
              ? "scale-125 bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          key={letter}
          onClick={() => onLetterClick(letter)}
          type="button"
        >
          {letter}
        </button>
      ))}
    </nav>
  );
}

/**
 * Floating letter indicator shown while scrubbing
 */
function FloatingLetterIndicator({ letter }: { letter: string }) {
  return (
    <div className="-translate-x-1/2 -translate-y-1/2 pointer-events-none fixed top-1/2 left-1/2 z-50 flex h-24 w-24 items-center justify-center rounded-2xl bg-foreground/90 font-bold text-5xl text-background">
      {letter}
    </div>
  );
}

/**
 * ChannelsPage - YouTube-style list of all channels
 *
 * Displays all channels with:
 * - Large round avatar thumbnail
 * - Channel name
 * - Channel description (truncated to 2 lines)
 * - iOS-style alphabet sidebar for quick navigation (50+ channels)
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
  const [hoveredLetter, setHoveredLetter] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Group channels alphabetically
  const groupedChannels = useMemo(
    () => groupChannelsByLetter(channels),
    [channels]
  );

  // Get list of available letters
  const availableLetters = useMemo(
    () => [...groupedChannels.keys()],
    [groupedChannels]
  );

  // Show alphabet navigation only for 50+ channels
  const showAlphabetNav = channels.length >= ALPHABET_NAV_THRESHOLD;

  // Scroll to section when letter is clicked
  // instant: true for dragging (no animation lag), false for smooth scroll on tap
  const scrollToLetter = useCallback((letter: string, instant = false) => {
    const section = sectionRefs.current.get(letter);
    if (section) {
      section.scrollIntoView({
        behavior: instant ? "instant" : "smooth",
        block: "start",
      });
    }
  }, []);

  // Track active section while scrolling
  useEffect(() => {
    if (!showAlphabetNav) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const letter = entry.target.getAttribute("data-letter");
            if (letter) {
              setActiveLetter(letter);
            }
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    sectionRefs.current.forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, [showAlphabetNav]);

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
        <header>
          <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="font-bold text-2xl">Alle Kanäle</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[100rem] px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div className="flex items-start gap-4 p-4" key={i}>
                <div className="h-20 w-20 flex-shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
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
        <header>
          <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="font-bold text-2xl">Alle Kanäle</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[100rem] px-4 py-8 sm:px-6 lg:px-8">
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
        <header>
          <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="font-bold text-2xl">Alle Kanäle</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[100rem] px-4 py-8 sm:px-6 lg:px-8">
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
      <header>
        <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="font-bold text-2xl">Alle Kanäle</h1>
          <p className="mt-1 text-muted-foreground">
            {channels.length} {channels.length === 1 ? "Kanal" : "Kanäle"}
          </p>
        </div>
      </header>

      {/* iOS-style Alphabet Sidebar */}
      {showAlphabetNav && (
        <AlphabetSidebar
          activeLetter={activeLetter}
          letters={availableLetters}
          onLetterClick={scrollToLetter}
          onLetterHover={setHoveredLetter}
        />
      )}

      {/* Floating letter indicator while scrubbing */}
      {hoveredLetter && <FloatingLetterIndicator letter={hoveredLetter} />}

      {/* Channel Grid with Alphabetic Sections */}
      <main className="mx-auto max-w-[100rem] px-4 py-8 pr-12 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {[...groupedChannels.entries()].map(([letter, letterChannels]) => (
            <section
              data-letter={letter}
              key={letter}
              ref={(el) => {
                if (el) sectionRefs.current.set(letter, el);
              }}
            >
              {/* Subtle Alphabetic Section Header - only shown with alphabet nav */}
              {showAlphabetNav && (
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-semibold text-lg text-muted-foreground">
                    {letter}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}

              {/* Channels Grid for this letter */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {letterChannels.map((channel) => (
                  <div className="group relative" key={channel.id}>
                    <button
                      className="flex w-full items-start gap-4 rounded-lg p-4 text-left transition-colors hover:bg-accent"
                      onClick={() => handleChannelClick(channel.id)}
                    >
                      {/* Round avatar - 80px display, optimized for Retina */}
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
                        <h2 className="flex items-center gap-2 truncate font-semibold">
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
                            handleToggleVisibility(
                              channel.id,
                              channel.is_hidden
                            )
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
            </section>
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
