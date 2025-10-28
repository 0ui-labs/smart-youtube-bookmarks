export interface VideoResponse {
  id: string
  list_id: string
  youtube_id: string
  title: string | null
  channel_name: string | null
  duration_seconds: number | null
  thumbnail_url: string | null
  url: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface VideoCreate {
  url: string
}

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'
