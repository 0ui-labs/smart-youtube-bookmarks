export interface UseVideosOptions {
  continuous?: boolean;
  offset?: number;
  limit?: number;
  enabled?: boolean;
  /** Array of tag names for OR filtering (videos with ANY of the specified tags) */
  tags?: string[];
  /** Field to sort by: "title" | "duration" | "created_at" | "field:<field_id>" */
  sortBy?: string;
  /** Sort order: "asc" (default) | "desc" */
  sortOrder?: "asc" | "desc";
  /** Custom refetch interval in milliseconds */
  refetchInterval?: number;
  /** Whether to refetch in background */
  refetchIntervalInBackground?: boolean;
}

export interface BulkUploadFailure {
  /** The row number in the CSV file where the error occurred (1-based) */
  row: number;
  /** The YouTube URL that failed to be added */
  url: string;
  /** Human-readable error message explaining why the upload failed */
  error: string;
}

export interface BulkUploadResponse {
  /** Number of videos successfully created */
  created_count: number;
  /** Number of videos that failed to be created */
  failed_count: number;
  /** Array of detailed failure information for each failed upload */
  failures: BulkUploadFailure[];
  /** UUIDs of successfully created videos */
  created_video_ids: string[];
}

export interface FieldValueUpdate {
  field_id: string;
  value: number | string | boolean | null;
}

export interface BatchUpdateFieldValuesRequest {
  field_values: FieldValueUpdate[];
}

export interface VideoFieldValueResponse {
  id: string;
  video_id: string;
  field_id: string;
  value: number | string | boolean | null;
  updated_at: string;
  field: {
    id: string;
    name: string;
    field_type: "select" | "rating" | "text" | "boolean";
    config: Record<string, any>;
  };
}

export interface BatchUpdateFieldValuesResponse {
  updated_count: number;
  field_values: VideoFieldValueResponse[];
}

export interface SetCategoryParams {
  videoId: string;
  categoryId: string | null;
  restoreBackup?: boolean;
}

export interface SetCategoryResponse {
  backup_created: boolean;
  backup_available: boolean;
  restored_count?: number;
}
