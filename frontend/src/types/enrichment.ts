import { z } from "zod";

// ============================================================================
// Enrichment Status
// ============================================================================

/**
 * Status of video enrichment processing.
 * Matches backend EnrichmentStatus enum.
 */
export const EnrichmentStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "partial",
  "failed",
]);

export type EnrichmentStatus = z.infer<typeof EnrichmentStatusSchema>;

// ============================================================================
// Chapter Types
// ============================================================================

/**
 * Zod schema for a video chapter.
 * Represents a titled segment of a video with start/end times.
 */
export const ChapterSchema = z.object({
  title: z.string(),
  start: z.number(), // Start time in seconds
  end: z.number(), // End time in seconds
});

export type Chapter = z.infer<typeof ChapterSchema>;

// ============================================================================
// Enrichment Response
// ============================================================================

/**
 * Zod schema for EnrichmentResponse.
 * Matches backend app/schemas/enrichment.py EnrichmentResponse.
 *
 * Contains captions, chapters, thumbnails, and processing state.
 */
export const EnrichmentResponseSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  status: EnrichmentStatusSchema,

  // Captions
  captions_vtt: z.string().nullable().optional(),
  captions_language: z.string().nullable().optional(),
  captions_source: z.string().nullable().optional(), // 'youtube_manual', 'youtube_auto', 'groq_whisper'

  // Transcript
  transcript_text: z.string().nullable().optional(),

  // Chapters
  chapters: z.array(ChapterSchema).nullable().optional(),
  chapters_vtt: z.string().nullable().optional(),
  chapters_source: z.string().nullable().optional(), // 'youtube', 'description'

  // Thumbnails
  thumbnails_vtt_url: z.string().nullable().optional(),

  // Processing state
  error_message: z.string().nullable().optional(),
  retry_count: z.number().default(0),
  progress_message: z.string().nullable().optional(),

  // Timestamps
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  processed_at: z.string().nullable().optional(),
});

export type EnrichmentResponse = z.infer<typeof EnrichmentResponseSchema>;

// ============================================================================
// Enrichment Retry Response
// ============================================================================

/**
 * Response from POST /api/videos/{id}/enrichment/retry
 */
export const EnrichmentRetryResponseSchema = z.object({
  message: z.string(),
  enrichment: EnrichmentResponseSchema,
});

export type EnrichmentRetryResponse = z.infer<
  typeof EnrichmentRetryResponseSchema
>;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Caption source labels for display
 */
export const CAPTION_SOURCE_LABELS: Record<string, string> = {
  youtube_manual: "YouTube (Manual)",
  youtube_auto: "YouTube (Auto)",
  groq_whisper: "Groq Whisper",
};

/**
 * Chapter source labels for display
 */
export const CHAPTER_SOURCE_LABELS: Record<string, string> = {
  youtube: "YouTube",
  description: "Description",
};

/**
 * Language code to human-readable name mapping
 */
export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  de: "German",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
};
