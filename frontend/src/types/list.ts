export interface ListResponse {
  id: string;
  name: string;
  description: string | null;
  schema_id: string | null;
  default_schema_id: string | null; // Workspace-wide schema (fields for all videos)
  video_count: number;
  created_at: string;
  updated_at: string;
}

export interface ListCreate {
  name: string;
  description?: string;
  schema_id?: string;
}

export interface ListUpdate {
  name?: string;
  description?: string;
  default_schema_id?: string | null;
}
