import {
  MediaPlayer,
  type MediaPlayerInstance,
  MediaProvider,
  Poster,
  Track,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { AlertCircle, Loader2, Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useUpdateWatchProgress } from "@/hooks/useWatchProgress";
import { usePlayerSettingsStore } from "@/stores/playerSettingsStore";
import type { TextTrack as TextTrackType } from "@/types/player";

// Vidstack styles
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
};

interface VideoPlayerProps {
  /** YouTube video ID (11 characters) */
  youtubeId: string;
  /** Internal video UUID for progress tracking */
  videoId: string;
  /** Video title for accessibility */
  title?: string;
  /** Initial playback position in seconds */
  initialPosition?: number | null;
  /** Poster image URL (shown before playback) */
  poster?: string | null;
  /** Thumbnail URL for error fallback */
  thumbnailUrl?: string | null;
  /** Text tracks for subtitles, captions, and chapters */
  textTracks?: TextTrackType[];
  /** Thumbnails VTT file URL for scrubbing preview */
  thumbnailsVtt?: string | null;
  /** Callback when player is ready */
  onReady?: () => void;
  /** Callback when video ends */
  onEnded?: () => void;
  /** Callback on player error */
  onError?: (error: Error) => void;
}

/**
 * VideoPlayer component using Vidstack for YouTube playback
 *
 * Features:
 * - YouTube video playback via Vidstack
 * - Persisted settings (volume, speed) via Zustand store
 * - Watch progress tracking with debounced saves
 * - Resume playback from last position
 * - Error handling with fallback UI
 * - Loading state
 * - GDPR-compliant (no cookies by default)
 * - Performance optimized (preconnections, lazy loading)
 * - Text tracks support (subtitles, captions, chapters)
 * - Thumbnail scrubbing preview
 *
 * Keyboard Shortcuts (when player is focused):
 * - Space/K: Play/Pause
 * - ←/→: Seek -/+5 seconds
 * - ↑/↓: Volume +/-10%
 * - M: Mute/Unmute
 * - F: Fullscreen toggle
 * - C: Toggle captions
 * - 0-9: Seek to 0%-90%
 * - </> or ,/.: Decrease/Increase playback speed
 *
 * @example
 * ```tsx
 * <VideoPlayer
 *   youtubeId="dQw4w9WgXcQ"
 *   videoId="uuid-here"
 *   title="Never Gonna Give You Up"
 *   initialPosition={120}
 *   textTracks={[
 *     { src: '/subs/en.vtt', label: 'English', language: 'en', kind: 'subtitles', default: true },
 *     { src: '/chapters.vtt', language: 'en', kind: 'chapters', default: true },
 *   ]}
 *   thumbnailsVtt="/thumbnails.vtt"
 * />
 * ```
 */
export const VideoPlayer = ({
  youtubeId,
  videoId,
  title,
  initialPosition,
  poster,
  thumbnailUrl,
  textTracks,
  thumbnailsVtt,
  onReady,
  onEnded,
  onError,
}: VideoPlayerProps) => {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasSeenPositionRef = useRef(false);

  // Store - player settings
  const { volume, muted, playbackRate, setVolume, setMuted, setPlaybackRate } =
    usePlayerSettingsStore();

  // Progress mutation
  const updateProgress = useUpdateWatchProgress();

  // Debounced progress save (every 10 seconds during playback)
  const saveProgress = useDebouncedCallback((position: number) => {
    updateProgress.mutate({ videoId, position: Math.floor(position) });
  }, 10_000);

  // Immediate progress save (on pause)
  const saveProgressImmediate = useCallback(
    (position: number) => {
      updateProgress.mutate({ videoId, position: Math.floor(position) });
    },
    [updateProgress, videoId]
  );

  // Event: Player can play (ready)
  const handleCanPlay = useCallback(() => {
    setIsLoading(false);

    // Seek to initial position if provided and not already seeked
    if (initialPosition && initialPosition > 0 && !hasSeenPositionRef.current) {
      const player = playerRef.current;
      if (player) {
        player.currentTime = initialPosition;
        hasSeenPositionRef.current = true;
      }
    }

    onReady?.();
  }, [initialPosition, onReady]);

  // Event: Video ended
  const handleEnd = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      saveProgressImmediate(player.duration);
    }
    onEnded?.();
  }, [saveProgressImmediate, onEnded]);

  // Event: Error
  const handleError = useCallback(() => {
    const err = new Error("Video playback error");
    setError(err);
    setIsLoading(false);
    onError?.(err);
  }, [onError]);

  // Event: Time update - debounced progress save
  const handleTimeUpdate = useCallback(() => {
    const player = playerRef.current;
    if (player && !player.paused) {
      saveProgress(player.currentTime);
    }
  }, [saveProgress]);

  // Event: Pause - immediate progress save
  const handlePause = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      saveProgressImmediate(player.currentTime);
    }
  }, [saveProgressImmediate]);

  // Event: Seeked - save after user seeks with scrubber
  const handleSeeked = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      saveProgressImmediate(player.currentTime);
    }
  }, [saveProgressImmediate]);

  // Event: Playing - seek to initial position (YouTube may require video to start first)
  const handlePlay = useCallback(() => {
    if (initialPosition && initialPosition > 0 && !hasSeenPositionRef.current) {
      const player = playerRef.current;
      if (player) {
        player.currentTime = initialPosition;
        hasSeenPositionRef.current = true;
      }
    }
  }, [initialPosition]);

  // Event: Volume change - persist to store
  const handleVolumeChange = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      setVolume(player.volume);
      setMuted(player.muted);
    }
  }, [setVolume, setMuted]);

  // Event: Rate change - persist to store
  const handleRateChange = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      setPlaybackRate(player.playbackRate);
    }
  }, [setPlaybackRate]);

  // Error fallback UI
  if (error) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
        {(thumbnailUrl || poster) && (
          <img
            alt="Video thumbnail"
            className="absolute inset-0 h-full w-full object-cover opacity-50 blur-sm"
            src={thumbnailUrl || poster || ""}
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="font-medium text-sm text-white">
            Video nicht verfügbar
          </p>
          <a
            className="text-primary-foreground text-sm underline hover:no-underline"
            href={`https://www.youtube.com/watch?v=${youtubeId}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            Auf YouTube ansehen →
          </a>
        </div>
      </div>
    );
  }

  // Show resume indicator if there's a saved position
  const showResumeIndicator = initialPosition && initialPosition > 0;

  // Use poster if provided, otherwise fall back to thumbnailUrl
  const posterSrc = poster || thumbnailUrl;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      {/* Loading overlay with resume indicator */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
          {showResumeIndicator && (
            <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-sm text-white/90">
              <Play className="h-3.5 w-3.5" />
              <span>Fortsetzen bei {formatTime(initialPosition)}</span>
            </div>
          )}
        </div>
      )}

      {/* Vidstack Player */}
      <MediaPlayer
        className="video-player h-full w-full"
        crossOrigin
        muted={muted}
        onCanPlay={handleCanPlay}
        onEnd={handleEnd}
        onError={handleError}
        onPause={handlePause}
        onPlay={handlePlay}
        onRateChange={handleRateChange}
        onSeeked={handleSeeked}
        onTimeUpdate={handleTimeUpdate}
        onVolumeChange={handleVolumeChange}
        playbackRate={playbackRate}
        playsInline
        poster={posterSrc || undefined}
        ref={playerRef}
        src={`youtube/${youtubeId}`}
        streamType="on-demand"
        title={title}
        viewType="video"
        volume={volume}
      >
        <MediaProvider>
          {posterSrc && (
            <Poster
              alt={title || "Video poster"}
              className="vds-poster"
              src={posterSrc}
            />
          )}
          {textTracks?.map((track) => (
            <Track
              default={track.default}
              key={track.src}
              kind={track.kind}
              label={track.label}
              language={track.language}
              src={track.src}
              type={track.type}
            />
          ))}
        </MediaProvider>
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          thumbnails={thumbnailsVtt || undefined}
        />
      </MediaPlayer>
    </div>
  );
};
