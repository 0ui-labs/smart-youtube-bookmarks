/**
 * TypeScript types for analytics API responses.
 *
 * Matches backend Pydantic schemas (app/schemas/analytics.py).
 */

export interface MostUsedFieldStat {
  field_id: string;
  field_name: string;
  field_type: "select" | "rating" | "text" | "boolean";
  usage_count: number;
  total_videos: number;
  usage_percentage: number;
}

export interface UnusedSchemaStat {
  schema_id: string;
  schema_name: string;
  field_count: number;
  tag_count: number;
  last_used: string | null; // ISO 8601 datetime or null
  reason: "no_tags" | "no_values";
}

export interface FieldCoverageStat {
  field_id: string;
  field_name: string;
  field_type: "select" | "rating" | "text" | "boolean";
  videos_with_values: number;
  total_videos: number;
  coverage_percentage: number;
}

export interface SchemaEffectivenessStat {
  schema_id: string;
  schema_name: string;
  field_count: number;
  avg_fields_filled: number;
  completion_percentage: number;
  video_count: number;
}

export interface AnalyticsResponse {
  most_used_fields: MostUsedFieldStat[];
  unused_schemas: UnusedSchemaStat[];
  field_coverage: FieldCoverageStat[];
  schema_effectiveness: SchemaEffectivenessStat[];
}
