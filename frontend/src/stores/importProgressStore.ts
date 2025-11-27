/**
 * Import Progress Store
 *
 * Tracks video-level import progress received via WebSocket.
 * Each video has its own progress (0-100) and stage.
 *
 * Stages:
 * - created: Initial state, waiting for processing
 * - metadata: Fetching video metadata
 * - captions: Fetching/generating captions
 * - chapters: Extracting chapters
 * - complete: Import finished successfully
 * - error: Import failed
 */
import { create } from 'zustand';

export interface ImportProgress {
  progress: number;
  stage: 'created' | 'metadata' | 'captions' | 'chapters' | 'complete' | 'error';
}

interface ImportProgressState {
  progress: Map<string, ImportProgress>;
  setProgress: (videoId: string, progress: number, stage: ImportProgress['stage']) => void;
  clearProgress: (videoId: string) => void;
  clearAllProgress: () => void;
  getProgress: (videoId: string) => ImportProgress | undefined;
  isImporting: (videoId: string) => boolean;
}

export const useImportProgressStore = create<ImportProgressState>((set, get) => ({
  progress: new Map(),

  setProgress: (videoId, progress, stage) => {
    set((state) => {
      const newProgress = new Map(state.progress);
      newProgress.set(videoId, { progress, stage });
      return { progress: newProgress };
    });
  },

  clearProgress: (videoId) => {
    set((state) => {
      const newProgress = new Map(state.progress);
      newProgress.delete(videoId);
      return { progress: newProgress };
    });
  },

  clearAllProgress: () => {
    set({ progress: new Map() });
  },

  getProgress: (videoId) => {
    return get().progress.get(videoId);
  },

  isImporting: (videoId) => {
    const progress = get().progress.get(videoId);
    if (!progress) return false;
    // Only importing if stage is not terminal (complete or error)
    return progress.stage !== 'complete' && progress.stage !== 'error';
  },
}));
