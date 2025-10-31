export interface VideoResponse {
  id: string
  list_id: string
  youtube_id: string

  // YouTube Metadata (from Backend Tasks 1-2)
  title: string | null
  channel: string | null
  thumbnail_url: string | null
  duration: number | null  // Seconds
  published_at: string | null  // ISO 8601

  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface VideoCreate {
  url: string
}

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'
