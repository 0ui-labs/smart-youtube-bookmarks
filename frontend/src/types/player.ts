/**
 * Player type definitions for video player integration.
 */

/**
 * Player settings persisted in localStorage.
 */
export interface PlayerSettings {
  /** Volume level (0-1) */
  volume: number
  /** Whether audio is muted */
  muted: boolean
  /** Playback speed (0.5-2) */
  playbackRate: number
}

/**
 * Default player settings.
 */
export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  volume: 1,
  muted: false,
  playbackRate: 1,
}

/**
 * Watch progress data from/to backend.
 */
export interface WatchProgress {
  videoId: string
  position: number
  updatedAt: string
}

/**
 * Response from PATCH /api/videos/{id}/progress endpoint.
 */
export interface UpdateWatchProgressResponse {
  video_id: string
  watch_position: number
  updated_at: string
}

/**
 * Request body for PATCH /api/videos/{id}/progress endpoint.
 */
export interface UpdateWatchProgressRequest {
  position: number
}

/**
 * Available playback speed options.
 */
export const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

/**
 * Plyr player controls configuration.
 */
export const PLAYER_CONTROLS = [
  'play-large',
  'play',
  'progress',
  'current-time',
  'mute',
  'volume',
  'settings',
  'pip',
  'fullscreen',
] as const
