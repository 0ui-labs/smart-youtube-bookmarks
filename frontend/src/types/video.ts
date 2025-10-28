export interface VideoResponse {
  id: string
  list_id: string
  youtube_id: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface VideoCreate {
  url: string
}

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'
