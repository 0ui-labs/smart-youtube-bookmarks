export interface ListResponse {
  id: string
  name: string
  description: string | null
  schema_id: string | null
  video_count: number
  created_at: string
  updated_at: string
}

export interface ListCreate {
  name: string
  description?: string
  schema_id?: string
}
