"""
Analytics Pydantic schemas for custom fields usage statistics.

Provides typed response models for the /api/lists/{list_id}/analytics endpoint.
Validates aggregated data from PostgreSQL queries before API serialization.
"""
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class MostUsedFieldStat(BaseModel):
    """
    Statistics for a single field's usage across videos.

    Used in "Most-Used Fields" chart to show which fields
    are most actively filled in by users.
    """
    field_id: str = Field(description="UUID of the custom field")
    field_name: str = Field(description="Display name of the field")
    field_type: str = Field(description="Field type: select, rating, text, boolean")
    usage_count: int = Field(ge=0, description="Number of VideoFieldValue records")
    total_videos: int = Field(ge=0, description="Total videos in list")
    usage_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Percentage of videos with this field set (usage_count / total_videos * 100)"
    )


class UnusedSchemaStat(BaseModel):
    """
    Statistics for schemas that are not actively used.

    A schema is "unused" if:
    - It has 0 tags assigned (not bound to any tag), OR
    - It has tags but 0 field values set (tags exist but never filled in)
    """
    schema_id: str = Field(description="UUID of the field schema")
    schema_name: str = Field(description="Display name of the schema")
    field_count: int = Field(ge=0, description="Number of fields in this schema")
    tag_count: int = Field(ge=0, description="Number of tags using this schema")
    last_used: Optional[datetime] = Field(
        None,
        description="Last time a field value was set for this schema (NULL if never used)"
    )
    reason: str = Field(
        description="Why schema is unused: 'no_tags' or 'no_values'"
    )


class FieldCoverageStat(BaseModel):
    """
    Coverage statistics for a single field.

    Shows how many videos have values set for this field,
    helping identify fields that are rarely used.
    """
    field_id: str = Field(description="UUID of the custom field")
    field_name: str = Field(description="Display name of the field")
    field_type: str = Field(description="Field type: select, rating, text, boolean")
    videos_with_values: int = Field(ge=0, description="Count of videos with values set")
    total_videos: int = Field(ge=0, description="Total videos in list")
    coverage_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Percentage coverage (videos_with_values / total_videos * 100)"
    )


class SchemaEffectivenessStat(BaseModel):
    """
    Effectiveness statistics for a schema.

    Measures how completely users fill in schema fields.
    High effectiveness = users fill most fields in the schema.
    Low effectiveness = users skip many fields.
    """
    schema_id: str = Field(description="UUID of the field schema")
    schema_name: str = Field(description="Display name of the schema")
    field_count: int = Field(ge=0, description="Number of fields in schema")
    avg_fields_filled: float = Field(
        ge=0.0,
        description="Average number of fields filled per video (across all videos with this schema's tags)"
    )
    completion_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Percentage completion (avg_fields_filled / field_count * 100)"
    )
    video_count: int = Field(
        ge=0,
        description="Number of videos with tags bound to this schema"
    )


class AnalyticsResponse(BaseModel):
    """
    Complete analytics response for a bookmark list.

    Aggregates all custom field usage statistics in a single endpoint.
    Designed for efficient rendering in AnalyticsView component.
    """
    most_used_fields: list[MostUsedFieldStat] = Field(
        description="Top 10 fields by usage count (sorted descending)"
    )
    unused_schemas: list[UnusedSchemaStat] = Field(
        description="Schemas with 0 tags or 0 field values (sorted by name)"
    )
    field_coverage: list[FieldCoverageStat] = Field(
        description="Coverage stats for all fields (sorted by coverage % ascending)"
    )
    schema_effectiveness: list[SchemaEffectivenessStat] = Field(
        description="Effectiveness stats for all schemas (sorted by completion % descending)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "most_used_fields": [
                    {
                        "field_id": "f1",
                        "field_name": "Overall Rating",
                        "field_type": "rating",
                        "usage_count": 450,
                        "total_videos": 500,
                        "usage_percentage": 90.0
                    }
                ],
                "unused_schemas": [
                    {
                        "schema_id": "s1",
                        "schema_name": "Old Quality Metrics",
                        "field_count": 5,
                        "tag_count": 0,
                        "last_used": None,
                        "reason": "no_tags"
                    }
                ],
                "field_coverage": [
                    {
                        "field_id": "f2",
                        "field_name": "Presentation Quality",
                        "field_type": "select",
                        "videos_with_values": 50,
                        "total_videos": 500,
                        "coverage_percentage": 10.0
                    }
                ],
                "schema_effectiveness": [
                    {
                        "schema_id": "s2",
                        "schema_name": "Video Quality",
                        "field_count": 3,
                        "avg_fields_filled": 2.8,
                        "completion_percentage": 93.3,
                        "video_count": 200
                    }
                ]
            }
        }
