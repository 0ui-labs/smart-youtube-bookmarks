import { useRef, useEffect, useState, useCallback } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { useDebouncedCallback } from 'use-debounce'
import { usePlayerSettingsStore } from '@/stores/playerSettingsStore'
import { useUpdateWatchProgress } from '@/hooks/useWatchProgress'
import { PLAYER_CONTROLS, PLAYBACK_SPEED_OPTIONS } from '@/types/player'
import { AlertCircle, Loader2, Play } from 'lucide-react'

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface VideoPlayerProps {
  /** YouTube video ID (11 characters) */
  youtubeId: string
  /** Internal video UUID for progress tracking */
  videoId: string
  /** Initial playback position in seconds */
  initialPosition?: number | null
  /** Thumbnail URL for error fallback */
  thumbnailUrl?: string | null
  /** Callback when player is ready */
  onReady?: () => void
  /** Callback when video ends */
  onEnded?: () => void
  /** Callback on player error */
  onError?: (error: Error) => void
}

/**
 * VideoPlayer component using Plyr for YouTube playback
 *
 * Features:
 * - YouTube video playback via Plyr
 * - Persisted settings (volume, speed) via Zustand store
 * - Watch progress tracking with debounced saves
 * - Resume playback from last position
 * - Error handling with fallback UI
 * - Loading state
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
 *   initialPosition={120}
 * />
 * ```
 */
export const VideoPlayer = ({
  youtubeId,
  videoId,
  initialPosition,
  thumbnailUrl,
  onReady,
  onEnded,
  onError,
}: VideoPlayerProps) => {
  const playerRef = useRef<Plyr | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const hasInitializedRef = useRef(false)

  // Store - player settings
  const { volume, muted, playbackRate, setVolume, setMuted, setPlaybackRate } =
    usePlayerSettingsStore()

  // Progress mutation
  const updateProgress = useUpdateWatchProgress()

  // Debounced progress save (every 10 seconds during playback)
  const saveProgress = useDebouncedCallback((position: number) => {
    updateProgress.mutate({ videoId, position: Math.floor(position) })
  }, 10000)

  // Immediate progress save (on pause)
  const saveProgressImmediate = useCallback(
    (position: number) => {
      updateProgress.mutate({ videoId, position: Math.floor(position) })
    },
    [updateProgress, videoId]
  )

  // Initialize Plyr
  useEffect(() => {
    if (!containerRef.current || hasInitializedRef.current) return

    hasInitializedRef.current = true

    try {
      const player = new Plyr(containerRef.current, {
        controls: [...PLAYER_CONTROLS],
        settings: ['speed'],
        speed: {
          selected: playbackRate,
          options: [...PLAYBACK_SPEED_OPTIONS],
        },
        keyboard: { focused: true, global: false },
        youtube: {
          noCookie: true, // Privacy-enhanced mode
          rel: 0, // Don't show related videos
          showinfo: 0,
          modestbranding: 1,
        },
      })

      // Apply stored settings
      player.volume = volume
      player.muted = muted
      player.speed = playbackRate

      // Event: Player ready
      player.on('ready', () => {
        setIsLoading(false)

        // Seek to initial position if provided
        if (initialPosition && initialPosition > 0) {
          player.currentTime = initialPosition
        }

        onReady?.()
      })

      // Event: Video ended
      player.on('ended', () => {
        // Save final position
        saveProgressImmediate(player.duration)
        onEnded?.()
      })

      // Event: Error
      player.on('error', () => {
        const err = new Error('Video playback error')
        setError(err)
        setIsLoading(false)
        onError?.(err)
      })

      // Event: Time update - debounced progress save
      player.on('timeupdate', () => {
        if (player.playing) {
          saveProgress(player.currentTime)
        }
      })

      // Event: Pause - immediate progress save
      player.on('pause', () => {
        saveProgressImmediate(player.currentTime)
      })

      // Event: Volume change - persist to store
      player.on('volumechange', () => {
        setVolume(player.volume)
        setMuted(player.muted)
      })

      // Event: Rate change - persist to store
      player.on('ratechange', () => {
        setPlaybackRate(player.speed)
      })

      playerRef.current = player

      // Cleanup
      return () => {
        saveProgress.cancel()
        player.destroy()
        playerRef.current = null
        hasInitializedRef.current = false
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize player')
      setError(error)
      setIsLoading(false)
      onError?.(error)
    }
  }, [youtubeId]) // Only re-init when youtubeId changes

  // Error fallback UI
  if (error) {
    return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="absolute inset-0 w-full h-full object-cover blur-sm opacity-50"
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-white font-medium">Video nicht verfügbar</p>
          <a
            href={`https://www.youtube.com/watch?v=${youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-foreground underline hover:no-underline"
          >
            Auf YouTube ansehen →
          </a>
        </div>
      </div>
    )
  }

  // Show resume indicator if there's a saved position
  const showResumeIndicator = initialPosition && initialPosition > 0

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
      {/* Loading overlay with resume indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
          {showResumeIndicator && (
            <div className="flex items-center gap-2 text-white/90 text-sm bg-black/40 px-3 py-1.5 rounded-full">
              <Play className="h-3.5 w-3.5" />
              <span>Fortsetzen bei {formatTime(initialPosition)}</span>
            </div>
          )}
        </div>
      )}

      {/* Plyr container */}
      <div
        ref={containerRef}
        data-plyr-provider="youtube"
        data-plyr-embed-id={youtubeId}
        className="w-full h-full"
      />
    </div>
  )
}
