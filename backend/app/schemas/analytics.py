"""
Analytics Pydantic schemas for custom fields usage statistics.

Provides typed response models for the /api/lists/{list_id}/analytics endpoint.
Validates aggregated data from PostgreSQL queries before API serialization.
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field, model_validator
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

    @model_validator(mode='after')
    def validate_usage_count_and_percentage(self) -> 'MostUsedFieldStat':
        """Ensure usage_count <= total_videos and percentage matches ratio."""
        if self.usage_count > self.total_videos:
            raise ValueError(
                f"usage_count ({self.usage_count}) cannot exceed total_videos ({self.total_videos})"
            )

        # Validate percentage calculation (allow small floating point error)
        if self.total_videos > 0:
            expected_percentage = (self.usage_count / self.total_videos) * 100
            if abs(self.usage_percentage - expected_percentage) > 0.01:
                raise ValueError(
                    f"usage_percentage ({self.usage_percentage:.2f}) does not match calculated value "
                    f"({expected_percentage:.2f}) from usage_count/total_videos"
                )
        else:
            # When total_videos is 0, percentage should be 0
            if self.usage_percentage != 0.0:
                raise ValueError(
                    f"usage_percentage must be 0.0 when total_videos is 0, got {self.usage_percentage}"
                )

        return self


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
    reason: Literal["no_tags", "no_values"] = Field(
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

    @model_validator(mode='after')
    def validate_coverage_count_and_percentage(self) -> 'FieldCoverageStat':
        """Ensure videos_with_values <= total_videos and percentage matches ratio."""
        if self.videos_with_values > self.total_videos:
            raise ValueError(
                f"videos_with_values ({self.videos_with_values}) cannot exceed total_videos ({self.total_videos})"
            )

        # Validate percentage calculation (allow small floating point error)
        if self.total_videos > 0:
            expected_percentage = (self.videos_with_values / self.total_videos) * 100
            if abs(self.coverage_percentage - expected_percentage) > 0.01:
                raise ValueError(
                    f"coverage_percentage ({self.coverage_percentage:.2f}) does not match calculated value "
                    f"({expected_percentage:.2f}) from videos_with_values/total_videos"
                )
        else:
            # When total_videos is 0, percentage should be 0
            if self.coverage_percentage != 0.0:
                raise ValueError(
                    f"coverage_percentage must be 0.0 when total_videos is 0, got {self.coverage_percentage}"
                )

        return self


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

    @model_validator(mode='after')
    def validate_effectiveness_and_percentage(self) -> 'SchemaEffectivenessStat':
        """Ensure avg_fields_filled <= field_count and percentage matches ratio."""
        if self.avg_fields_filled > self.field_count:
            raise ValueError(
                f"avg_fields_filled ({self.avg_fields_filled:.2f}) cannot exceed field_count ({self.field_count})"
            )

        # Validate percentage calculation (allow rounding error up to 0.005 for 2-decimal precision)
        if self.field_count > 0:
            expected_percentage = (self.avg_fields_filled / self.field_count) * 100
            if abs(self.completion_percentage - expected_percentage) > 0.005:
                raise ValueError(
                    f"completion_percentage ({self.completion_percentage:.2f}) does not match calculated value "
                    f"({expected_percentage:.2f}) from avg_fields_filled/field_count"
                )
        else:
            # When field_count is 0, percentage should be 0
            if self.completion_percentage != 0.0:
                raise ValueError(
                    f"completion_percentage must be 0.0 when field_count is 0, got {self.completion_percentage}"
                )

        return self


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
