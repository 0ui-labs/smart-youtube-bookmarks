/**
 * Import Progress Store
 *
 * Tracks video-level import progress with smooth animation and synthetic progress.
 *
 * Architecture:
 * - targetProgress: Real value from backend OR synthetic value (slowly increasing)
 * - displayProgress: Animated value shown in UI (smooth ease-out interpolation)
 * - syntheticProgress: Gradually increases between backend updates (Netflix-style)
 *
 * Synthetic Progress Pattern:
 * - When backend sends 50% (captions stage), we start slowly incrementing toward 70%
 * - This creates visual feedback that work is happening
 * - When backend sends 75% (chapters stage), we snap to real value
 * - Prevents UI from appearing "stuck"
 *
 * Stages:
 * - created: Initial state, waiting for processing
 * - metadata: Fetching video metadata
 * - captions: Fetching/generating captions
 * - chapters: Extracting chapters
 * - complete: Import finished successfully
 * - error: Import failed
 */
import { create } from "zustand";

export type ImportStage =
  | "created"
  | "metadata"
  | "captions"
  | "chapters"
  | "complete"
  | "error";

export interface ImportProgress {
  targetProgress: number; // Real progress from backend (or synthetic)
  displayProgress: number; // Animated progress for UI
  realProgress: number; // Last actual progress from backend
  stage: ImportStage;
}

// Animation configuration
const ANIMATION_SPEED = 0.08; // 8% of difference per frame (ease-out)
const ANIMATION_THRESHOLD = 0.5; // Stop animating when within 0.5%

// Synthetic progress configuration
// Target: 40% over 60 seconds = ~0.67%/sec = 0.2% every 300ms
const SYNTHETIC_INTERVAL = 300; // Increment every 300ms
const SYNTHETIC_INCREMENT = 0.2; // Slower increment for long-running stages

// Ceiling per stage (synthetic progress won't exceed these)
// Note: captions stage can take 30-90 seconds for yt-dlp calls,
// so we set a higher ceiling (90%) to keep visual progress moving
const STAGE_CEILING: Record<ImportStage, number> = {
  created: 20, // Don't exceed 20% while in created stage
  metadata: 45, // Don't exceed 45% while in metadata stage
  captions: 90, // Higher ceiling (was 72%) - captions stage takes long
  chapters: 98, // Don't exceed 98% while in chapters stage (next is 100%)
  complete: 100, // Complete = 100%
  error: 100, // Error = 100%
};

interface ImportProgressState {
  progress: Map<string, ImportProgress>;
  animationFrames: Map<string, number>; // RAF handles for animation cleanup
  syntheticTimers: Map<string, number>; // setInterval handles for synthetic progress

  // Actions
  setProgress: (videoId: string, progress: number, stage: ImportStage) => void;
  getProgress: (videoId: string) => ImportProgress | undefined;
  getDisplayProgress: (videoId: string) => number;
  clearProgress: (videoId: string) => void;
  clearAllProgress: () => void;
  isImporting: (videoId: string) => boolean;
}

export const useImportProgressStore = create<ImportProgressState>(
  (set, get) => {
    // Start synthetic progress timer for a video
    const startSyntheticProgress = (videoId: string) => {
      const state = get();

      // Clear existing timer if any
      const existingTimer = state.syntheticTimers.get(videoId);
      if (existingTimer) {
        clearInterval(existingTimer);
      }

      const timerId = window.setInterval(() => {
        const current = get().progress.get(videoId);
        if (!current) {
          // Video removed, stop timer
          clearInterval(timerId);
          set((s) => {
            const newTimers = new Map(s.syntheticTimers);
            newTimers.delete(videoId);
            return { syntheticTimers: newTimers };
          });
          return;
        }

        // Don't increment for terminal stages
        if (current.stage === "complete" || current.stage === "error") {
          clearInterval(timerId);
          set((s) => {
            const newTimers = new Map(s.syntheticTimers);
            newTimers.delete(videoId);
            return { syntheticTimers: newTimers };
          });
          return;
        }

        // Calculate ceiling for current stage
        const ceiling = STAGE_CEILING[current.stage];

        // Only increment if below ceiling
        if (current.targetProgress < ceiling) {
          const newTarget = Math.min(
            current.targetProgress + SYNTHETIC_INCREMENT,
            ceiling
          );

          set((s) => {
            const newProgress = new Map(s.progress);
            const item = newProgress.get(videoId);
            if (item) {
              newProgress.set(videoId, {
                ...item,
                targetProgress: newTarget,
              });
            }
            return { progress: newProgress };
          });
        }
      }, SYNTHETIC_INTERVAL);

      // Store timer ID
      set((s) => {
        const newTimers = new Map(s.syntheticTimers);
        newTimers.set(videoId, timerId);
        return { syntheticTimers: newTimers };
      });
    };

    // Animation loop function
    const startAnimation = (videoId: string) => {
      const animate = () => {
        const state = get();
        const current = state.progress.get(videoId);

        if (!current) {
          // Video removed, stop animation
          state.animationFrames.delete(videoId);
          return;
        }

        const diff = current.targetProgress - current.displayProgress;

        // Check if we're close enough to target
        if (Math.abs(diff) < ANIMATION_THRESHOLD) {
          // Snap to target
          set((s) => {
            const newProgress = new Map(s.progress);
            const item = newProgress.get(videoId);
            if (item) {
              newProgress.set(videoId, {
                ...item,
                displayProgress: item.targetProgress,
              });
            }
            return { progress: newProgress };
          });

          // Continue animation if synthetic progress might still be running
          // (targetProgress could keep increasing)
          if (current.stage !== "complete" && current.stage !== "error") {
            const frameId = requestAnimationFrame(animate);
            set((s) => {
              const newFrames = new Map(s.animationFrames);
              newFrames.set(videoId, frameId);
              return { animationFrames: newFrames };
            });
          } else {
            // Terminal state, stop animation
            set((s) => {
              const newFrames = new Map(s.animationFrames);
              newFrames.delete(videoId);
              return { animationFrames: newFrames };
            });
          }
          return;
        }

        // Calculate next display value with ease-out
        const nextDisplay = current.displayProgress + diff * ANIMATION_SPEED;

        // Update display progress
        set((s) => {
          const newProgress = new Map(s.progress);
          const item = newProgress.get(videoId);
          if (item) {
            newProgress.set(videoId, {
              ...item,
              displayProgress: Math.round(nextDisplay * 10) / 10, // Round to 1 decimal
            });
          }
          return { progress: newProgress };
        });

        // Schedule next frame
        const frameId = requestAnimationFrame(animate);
        set((s) => {
          const newFrames = new Map(s.animationFrames);
          newFrames.set(videoId, frameId);
          return { animationFrames: newFrames };
        });
      };

      // Start animation
      const frameId = requestAnimationFrame(animate);
      set((s) => {
        const newFrames = new Map(s.animationFrames);
        newFrames.set(videoId, frameId);
        return { animationFrames: newFrames };
      });
    };

    return {
      progress: new Map(),
      animationFrames: new Map(),
      syntheticTimers: new Map(),

      setProgress: (videoId, progress, stage) => {
        const state = get();
        const current = state.progress.get(videoId);

        // Keep current display progress for smooth animation
        // For new videos, start at 0
        const displayProgress = current?.displayProgress ?? 0;

        // Store the real progress from backend
        const realProgress = progress;

        set((s) => {
          const newProgress = new Map(s.progress);
          newProgress.set(videoId, {
            targetProgress: progress,
            displayProgress,
            realProgress,
            stage,
          });
          return { progress: newProgress };
        });

        // Cancel existing animation if any
        const existingFrame = state.animationFrames.get(videoId);
        if (existingFrame) {
          cancelAnimationFrame(existingFrame);
        }

        // Handle terminal states (complete/error) - snap immediately and stop synthetic
        if (stage === "complete" || stage === "error") {
          // Stop synthetic timer
          const existingTimer = state.syntheticTimers.get(videoId);
          if (existingTimer) {
            clearInterval(existingTimer);
            set((s) => {
              const newTimers = new Map(s.syntheticTimers);
              newTimers.delete(videoId);
              return { syntheticTimers: newTimers };
            });
          }

          // Snap to final value
          set((s) => {
            const newProgress = new Map(s.progress);
            const item = newProgress.get(videoId);
            if (item) {
              newProgress.set(videoId, {
                ...item,
                displayProgress: progress,
              });
            }
            return { progress: newProgress };
          });
        } else {
          // Non-terminal stage: start animation and synthetic progress
          startAnimation(videoId);
          startSyntheticProgress(videoId);
        }
      },

      clearProgress: (videoId) => {
        const state = get();

        // Cancel animation
        const frameId = state.animationFrames.get(videoId);
        if (frameId) {
          cancelAnimationFrame(frameId);
        }

        // Cancel synthetic timer
        const timerId = state.syntheticTimers.get(videoId);
        if (timerId) {
          clearInterval(timerId);
        }

        set((s) => {
          const newProgress = new Map(s.progress);
          newProgress.delete(videoId);
          const newFrames = new Map(s.animationFrames);
          newFrames.delete(videoId);
          const newTimers = new Map(s.syntheticTimers);
          newTimers.delete(videoId);
          return {
            progress: newProgress,
            animationFrames: newFrames,
            syntheticTimers: newTimers,
          };
        });
      },

      clearAllProgress: () => {
        const state = get();

        // Cancel all animations
        for (const frameId of state.animationFrames.values()) {
          cancelAnimationFrame(frameId);
        }

        // Cancel all synthetic timers
        for (const timerId of state.syntheticTimers.values()) {
          clearInterval(timerId);
        }

        set({
          progress: new Map(),
          animationFrames: new Map(),
          syntheticTimers: new Map(),
        });
      },

      getProgress: (videoId) => get().progress.get(videoId),

      getDisplayProgress: (videoId) => {
        const progress = get().progress.get(videoId);
        return progress?.displayProgress ?? 0;
      },

      isImporting: (videoId) => {
        const progress = get().progress.get(videoId);
        if (!progress) return false;
        // Only importing if stage is not terminal (complete or error)
        return progress.stage !== "complete" && progress.stage !== "error";
      },
    };
  }
);
