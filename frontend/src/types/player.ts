/**
 * Player type definitions for video player integration.
 */

/**
 * Player settings persisted in localStorage.
 */
export interface PlayerSettings {
  /** Volume level (0-1) */
  volume: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Playback speed (0.5-2) */
  playbackRate: number;
}

/**
 * Default player settings.
 */
export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  volume: 1,
  muted: false,
  playbackRate: 1,
};

/**
 * Watch progress data from/to backend.
 */
export interface WatchProgress {
  videoId: string;
  position: number;
  updatedAt: string;
}

/**
 * Response from PATCH /api/videos/{id}/progress endpoint.
 */
export interface UpdateWatchProgressResponse {
  video_id: string;
  watch_position: number;
  updated_at: string;
}

/**
 * Request body for PATCH /api/videos/{id}/progress endpoint.
 */
export interface UpdateWatchProgressRequest {
  position: number;
}

/**
 * Available playback speed options.
 */
export const PLAYBACK_SPEED_OPTIONS = [
  0.5, 0.75, 1, 1.25, 1.5, 1.75, 2,
] as const;

/**
 * Text track kind for Vidstack player.
 * - subtitles: Transcription or translation of dialogue
 * - captions: Transcription with sound effects for deaf/hard of hearing
 * - chapters: Chapter titles for navigation
 * - descriptions: Audio descriptions for blind users
 * - metadata: Machine-readable data
 */
export type TextTrackKind =
  | "subtitles"
  | "captions"
  | "chapters"
  | "descriptions"
  | "metadata";

/**
 * Text track format type.
 */
export type TextTrackType = "vtt" | "srt" | "ssa" | "ass";

/**
 * Text track definition for video player.
 * Used for subtitles, captions, and chapters.
 *
 * @example
 * ```ts
 * const englishSubtitles: TextTrack = {
 *   src: 'https://example.com/subs/english.vtt',
 *   label: 'English',
 *   language: 'en-US',
 *   kind: 'subtitles',
 *   type: 'vtt',
 *   default: true,
 * }
 *
 * const chapters: TextTrack = {
 *   src: 'https://example.com/chapters.vtt',
 *   language: 'en-US',
 *   kind: 'chapters',
 *   type: 'vtt',
 *   default: true,
 * }
 * ```
 */
export interface TextTrack {
  /** URL to the text track file (VTT, SRT, SSA) */
  src: string;
  /** Human-readable label (e.g., "English", "Deutsch") */
  label?: string;
  /** BCP 47 language code (e.g., "en-US", "de-DE") */
  language: string;
  /** Type of text track */
  kind: TextTrackKind;
  /** File format */
  type?: TextTrackType;
  /** Whether this track should be active by default */
  default?: boolean;
}
