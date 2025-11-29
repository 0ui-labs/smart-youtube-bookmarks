/**
 * Player Settings Store - Zustand state management for video player preferences
 *
 * Manages volume, mute state, and playback rate with localStorage persistence.
 * Settings persist across videos and page reloads.
 *
 * @example
 * ```tsx
 * const { volume, muted, playbackRate, setVolume, setMuted, setPlaybackRate } = usePlayerSettingsStore();
 * ```
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_PLAYER_SETTINGS,
  PLAYBACK_SPEED_OPTIONS,
  type PlayerSettings,
} from "@/types/player";

/**
 * Player settings store state and actions
 */
interface PlayerSettingsStore extends PlayerSettings {
  /** Update volume level (0-1) */
  setVolume: (volume: number) => void;
  /** Update mute state */
  setMuted: (muted: boolean) => void;
  /** Update playback rate (0.5-2) */
  setPlaybackRate: (rate: number) => void;
  /** Reset to default settings */
  reset: () => void;
}

/**
 * Player settings store hook with localStorage persistence
 *
 * WHY persist middleware:
 * - User preferences should survive page reloads and across videos
 * - Better UX: Volume/speed settings "stick" like YouTube's player
 * - Standard pattern for media player settings
 *
 * Storage key: 'player-settings'
 *
 * @example
 * ```tsx
 * // Get current settings
 * const { volume, muted, playbackRate } = usePlayerSettingsStore();
 *
 * // Update volume
 * const { setVolume } = usePlayerSettingsStore();
 * setVolume(0.8);
 *
 * // Toggle mute
 * const { muted, setMuted } = usePlayerSettingsStore();
 * setMuted(!muted);
 *
 * // Change playback speed
 * const { setPlaybackRate } = usePlayerSettingsStore();
 * setPlaybackRate(1.5);
 * ```
 */
export const usePlayerSettingsStore = create<PlayerSettingsStore>()(
  persist(
    (set) => ({
      // State (from DEFAULT_PLAYER_SETTINGS)
      volume: DEFAULT_PLAYER_SETTINGS.volume,
      muted: DEFAULT_PLAYER_SETTINGS.muted,
      playbackRate: DEFAULT_PLAYER_SETTINGS.playbackRate,

      // Actions
      setVolume: (volume) => {
        // Clamp volume to 0-1 range
        const clampedVolume = Math.max(0, Math.min(1, volume));
        set({ volume: clampedVolume });
      },

      setMuted: (muted) => set({ muted }),

      setPlaybackRate: (rate) => {
        // Validate rate is in allowed options, otherwise default to 1
        const validRate = PLAYBACK_SPEED_OPTIONS.includes(
          rate as (typeof PLAYBACK_SPEED_OPTIONS)[number]
        )
          ? rate
          : 1;
        set({ playbackRate: validRate });
      },

      reset: () => set(DEFAULT_PLAYER_SETTINGS),
    }),
    {
      name: "player-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
