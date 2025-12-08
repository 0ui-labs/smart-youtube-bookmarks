/**
 * Utility functions for video enrichment data.
 */

import {
  CAPTION_SOURCE_LABELS,
  CHAPTER_SOURCE_LABELS,
  type EnrichmentStatus,
  LANGUAGE_LABELS,
} from "@/types/enrichment";

/**
 * Get human-readable language label.
 *
 * @param languageCode - ISO language code (e.g., 'en', 'de')
 * @param source - Caption source (e.g., 'youtube_auto', 'youtube_manual')
 * @returns Formatted label like "English (Auto)" or "German"
 *
 * @example
 * getLanguageLabel('de', 'youtube_auto') // "German (Auto)"
 * getLanguageLabel('en', 'youtube_manual') // "English"
 * getLanguageLabel('en', 'groq_whisper') // "English (Whisper)"
 */
export function getLanguageLabel(
  languageCode: string | null | undefined,
  source?: string | null
): string {
  if (!languageCode) return "Unknown";

  // Get base language name
  const baseName = LANGUAGE_LABELS[languageCode] || languageCode.toUpperCase();

  // Add source suffix if auto-generated
  if (source === "youtube_auto") {
    return `${baseName} (Auto)`;
  }
  if (source === "groq_whisper") {
    return `${baseName} (Whisper)`;
  }

  return baseName;
}

/**
 * Get human-readable caption source label.
 *
 * @param source - Caption source identifier
 * @returns Human-readable source name
 *
 * @example
 * getCaptionSourceLabel('youtube_manual') // "YouTube (Manual)"
 * getCaptionSourceLabel('groq_whisper') // "Groq Whisper"
 */
export function getCaptionSourceLabel(
  source: string | null | undefined
): string {
  if (!source) return "Unknown";
  return CAPTION_SOURCE_LABELS[source] || source;
}

/**
 * Get human-readable chapter source label.
 *
 * @param source - Chapter source identifier
 * @returns Human-readable source name
 *
 * @example
 * getChapterSourceLabel('youtube') // "YouTube"
 * getChapterSourceLabel('description') // "Description"
 */
export function getChapterSourceLabel(
  source: string | null | undefined
): string {
  if (!source) return "Unknown";
  return CHAPTER_SOURCE_LABELS[source] || source;
}

/**
 * Format seconds to chapter time display.
 *
 * @param seconds - Time in seconds
 * @returns Formatted time string (HH:MM:SS or MM:SS)
 *
 * @example
 * formatChapterTime(65) // "1:05"
 * formatChapterTime(3661) // "1:01:01"
 * formatChapterTime(0) // "0:00"
 */
export function formatChapterTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format chapter time range for display.
 *
 * @param start - Start time in seconds
 * @param end - End time in seconds
 * @returns Formatted time range string
 *
 * @example
 * formatChapterTimeRange(0, 120) // "0:00 - 2:00"
 * formatChapterTimeRange(3600, 3720) // "1:00:00 - 1:02:00"
 */
export function formatChapterTimeRange(start: number, end: number): string {
  return `${formatChapterTime(start)} - ${formatChapterTime(end)}`;
}

/**
 * Get status display configuration for enrichment status.
 *
 * @param status - Enrichment status
 * @returns Object with label, color, and icon info
 */
export function getStatusDisplay(status: EnrichmentStatus): {
  label: string;
  color: "gray" | "blue" | "green" | "yellow" | "red";
  isLoading: boolean;
} {
  switch (status) {
    case "pending":
      return { label: "Pending", color: "gray", isLoading: false };
    case "processing":
      return { label: "Processing", color: "blue", isLoading: true };
    case "completed":
      return { label: "Completed", color: "green", isLoading: false };
    case "partial":
      return { label: "Partial", color: "yellow", isLoading: false };
    case "failed":
      return { label: "Failed", color: "red", isLoading: false };
    default:
      return { label: "Unknown", color: "gray", isLoading: false };
  }
}

/**
 * Check if enrichment has captions available.
 */
export function hasCaptions(
  enrichment: { captions_vtt?: string | null } | null | undefined
): boolean {
  return !!enrichment?.captions_vtt;
}

/**
 * Check if enrichment has chapters available.
 */
export function hasChapters(
  enrichment: { chapters?: unknown[] | null } | null | undefined
): boolean {
  return Array.isArray(enrichment?.chapters) && enrichment.chapters.length > 0;
}

/**
 * Find the active chapter based on current playback time.
 *
 * @param chapters - List of chapters
 * @param currentTime - Current playback time in seconds
 * @returns The active chapter or null
 */
export function findActiveChapter<T extends { start: number; end: number }>(
  chapters: T[] | null | undefined,
  currentTime: number
): T | null {
  if (!chapters || chapters.length === 0) return null;

  return (
    chapters.find(
      (chapter) => currentTime >= chapter.start && currentTime < chapter.end
    ) || null
  );
}
