"""
Unit tests for Analytics Pydantic schemas.

Tests cover all validation scenarios for Task #142 Step 2:
- Valid creation tests (5 tests - one per schema)
- Validator tests (8 tests - test percentage range violations, negative counts, boundary values)
- Edge cases (4 tests - total_videos=0, last_used=None, empty lists, max values)
- Response serialization (3 tests - nested lists, datetime serialization, model_dump)

Total: 20+ tests covering comprehensive validation logic
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.analytics import (
    AnalyticsResponse,
    FieldCoverageStat,
    MostUsedFieldStat,
    SchemaEffectivenessStat,
    UnusedSchemaStat,
)

# ============================================================================
# Test Group 1: Valid Creation Tests (5 tests)
# ============================================================================


def test_create_most_used_field_stat_valid():
    """Test creating a valid MostUsedFieldStat."""
    stat = MostUsedFieldStat(
        field_id=str(uuid4()),
        field_name="Overall Rating",
        field_type="rating",
        usage_count=450,
        total_videos=500,
        usage_percentage=90.0,
    )
    assert stat.field_name == "Overall Rating"
    assert stat.field_type == "rating"
    assert stat.usage_count == 450
    assert stat.total_videos == 500
    assert stat.usage_percentage == 90.0


def test_create_unused_schema_stat_valid():
    """Test creating a valid UnusedSchemaStat."""
    schema_id = str(uuid4())
    last_used_time = datetime.now(UTC)

    stat = UnusedSchemaStat(
        schema_id=schema_id,
        schema_name="Old Quality Metrics",
        field_count=5,
        tag_count=0,
        last_used=last_used_time,
        reason="no_tags",
    )
    assert stat.schema_id == schema_id
    assert stat.schema_name == "Old Quality Metrics"
    assert stat.field_count == 5
    assert stat.tag_count == 0
    assert stat.last_used == last_used_time
    assert stat.reason == "no_tags"


def test_create_field_coverage_stat_valid():
    """Test creating a valid FieldCoverageStat."""
    stat = FieldCoverageStat(
        field_id=str(uuid4()),
        field_name="Presentation Quality",
        field_type="select",
        videos_with_values=50,
        total_videos=500,
        coverage_percentage=10.0,
    )
    assert stat.field_name == "Presentation Quality"
    assert stat.field_type == "select"
    assert stat.videos_with_values == 50
    assert stat.total_videos == 500
    assert stat.coverage_percentage == 10.0


def test_create_schema_effectiveness_stat_valid():
    """Test creating a valid SchemaEffectivenessStat."""
    stat = SchemaEffectivenessStat(
        schema_id=str(uuid4()),
        schema_name="Video Quality",
        field_count=3,
        avg_fields_filled=2.8,
        completion_percentage=93.33,
        video_count=200,
    )
    assert stat.schema_name == "Video Quality"
    assert stat.field_count == 3
    assert stat.avg_fields_filled == 2.8
    assert stat.completion_percentage == 93.33
    assert stat.video_count == 200


def test_create_analytics_response_valid():
    """Test creating a valid AnalyticsResponse with all nested lists."""
    field_id = str(uuid4())
    schema_id = str(uuid4())

    response = AnalyticsResponse(
        most_used_fields=[
            MostUsedFieldStat(
                field_id=field_id,
                field_name="Rating",
                field_type="rating",
                usage_count=100,
                total_videos=100,
                usage_percentage=100.0,
            )
        ],
        unused_schemas=[
            UnusedSchemaStat(
                schema_id=schema_id,
                schema_name="Unused",
                field_count=3,
                tag_count=0,
                last_used=None,
                reason="no_tags",
            )
        ],
        field_coverage=[
            FieldCoverageStat(
                field_id=field_id,
                field_name="Coverage",
                field_type="text",
                videos_with_values=50,
                total_videos=100,
                coverage_percentage=50.0,
            )
        ],
        schema_effectiveness=[
            SchemaEffectivenessStat(
                schema_id=schema_id,
                schema_name="Effective",
                field_count=5,
                avg_fields_filled=4.0,
                completion_percentage=80.0,
                video_count=50,
            )
        ],
    )
    assert len(response.most_used_fields) == 1
    assert len(response.unused_schemas) == 1
    assert len(response.field_coverage) == 1
    assert len(response.schema_effectiveness) == 1


# ============================================================================
# Test Group 2: Validator Tests (8 tests)
# ============================================================================


def test_most_used_field_stat_usage_count_exceeds_total():
    """Test that usage_count > total_videos raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        MostUsedFieldStat(
            field_id=str(uuid4()),
            field_name="Rating",
            field_type="rating",
            usage_count=600,
            total_videos=500,
            usage_percentage=90.0,  # Valid percentage to get past Field validation
        )

    error_message = str(exc_info.value)
    assert "usage_count (600) cannot exceed total_videos (500)" in error_message


def test_most_used_field_stat_percentage_mismatch():
    """Test that incorrect percentage calculation raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        MostUsedFieldStat(
            field_id=str(uuid4()),
            field_name="Rating",
            field_type="rating",
            usage_count=450,
            total_videos=500,
            usage_percentage=95.0,  # Should be 90.0
        )

    error_message = str(exc_info.value)
    assert (
        "usage_percentage (95.00) does not match calculated value (90.00)"
        in error_message
    )


def test_field_coverage_stat_videos_with_values_exceeds_total():
    """Test that videos_with_values > total_videos raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        FieldCoverageStat(
            field_id=str(uuid4()),
            field_name="Coverage",
            field_type="select",
            videos_with_values=600,
            total_videos=500,
            coverage_percentage=80.0,  # Valid percentage to get past Field validation
        )

    error_message = str(exc_info.value)
    assert "videos_with_values (600) cannot exceed total_videos (500)" in error_message


def test_field_coverage_stat_percentage_mismatch():
    """Test that incorrect coverage percentage calculation raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        FieldCoverageStat(
            field_id=str(uuid4()),
            field_name="Coverage",
            field_type="text",
            videos_with_values=50,
            total_videos=500,
            coverage_percentage=20.0,  # Should be 10.0
        )

    error_message = str(exc_info.value)
    assert (
        "coverage_percentage (20.00) does not match calculated value (10.00)"
        in error_message
    )


def test_schema_effectiveness_stat_avg_fields_exceeds_field_count():
    """Test that avg_fields_filled > field_count raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        SchemaEffectivenessStat(
            schema_id=str(uuid4()),
            schema_name="Invalid",
            field_count=3,
            avg_fields_filled=4.5,
            completion_percentage=90.0,  # Valid percentage to get past Field validation
            video_count=100,
        )

    error_message = str(exc_info.value)
    assert "avg_fields_filled (4.50) cannot exceed field_count (3)" in error_message


def test_schema_effectiveness_stat_completion_percentage_mismatch():
    """Test that incorrect completion percentage calculation raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        SchemaEffectivenessStat(
            schema_id=str(uuid4()),
            schema_name="Mismatch",
            field_count=3,
            avg_fields_filled=2.8,
            completion_percentage=90.0,  # Should be ~93.33
            video_count=100,
        )

    error_message = str(exc_info.value)
    assert (
        "completion_percentage (90.00) does not match calculated value (93.33)"
        in error_message
    )


def test_unused_schema_stat_invalid_reason():
    """Test that invalid reason value raises ValidationError (Literal type enforcement)."""
    with pytest.raises(ValidationError) as exc_info:
        UnusedSchemaStat(
            schema_id=str(uuid4()),
            schema_name="Invalid Reason",
            field_count=5,
            tag_count=0,
            last_used=None,
            reason="invalid_reason",  # Must be "no_tags" or "no_values"
        )

    error_message = str(exc_info.value)
    assert "Input should be 'no_tags' or 'no_values'" in error_message


def test_negative_counts_rejected():
    """Test that negative counts in Field constraints are rejected."""
    with pytest.raises(ValidationError) as exc_info:
        MostUsedFieldStat(
            field_id=str(uuid4()),
            field_name="Negative Test",
            field_type="rating",
            usage_count=-10,
            total_videos=100,
            usage_percentage=0.0,
        )

    error_message = str(exc_info.value)
    assert "greater than or equal to 0" in error_message


# ============================================================================
# Test Group 3: Edge Cases (4 tests)
# ============================================================================


def test_most_used_field_stat_zero_total_videos():
    """Test that total_videos=0 requires percentage=0.0."""
    with pytest.raises(ValidationError) as exc_info:
        MostUsedFieldStat(
            field_id=str(uuid4()),
            field_name="Zero Total",
            field_type="rating",
            usage_count=0,
            total_videos=0,
            usage_percentage=50.0,  # Should be 0.0
        )

    error_message = str(exc_info.value)
    assert (
        "usage_percentage must be 0.0 when total_videos is 0, got 50.0" in error_message
    )


def test_field_coverage_stat_zero_total_videos():
    """Test that total_videos=0 requires coverage_percentage=0.0."""
    with pytest.raises(ValidationError) as exc_info:
        FieldCoverageStat(
            field_id=str(uuid4()),
            field_name="Zero Total",
            field_type="text",
            videos_with_values=0,
            total_videos=0,
            coverage_percentage=25.0,  # Should be 0.0
        )

    error_message = str(exc_info.value)
    assert (
        "coverage_percentage must be 0.0 when total_videos is 0, got 25.0"
        in error_message
    )


def test_schema_effectiveness_stat_zero_field_count():
    """Test that field_count=0 requires completion_percentage=0.0."""
    with pytest.raises(ValidationError) as exc_info:
        SchemaEffectivenessStat(
            schema_id=str(uuid4()),
            schema_name="Zero Fields",
            field_count=0,
            avg_fields_filled=0.0,
            completion_percentage=10.0,  # Should be 0.0
            video_count=50,
        )

    error_message = str(exc_info.value)
    assert (
        "completion_percentage must be 0.0 when field_count is 0, got 10.0"
        in error_message
    )


def test_unused_schema_stat_with_none_last_used():
    """Test that UnusedSchemaStat works correctly with last_used=None."""
    stat = UnusedSchemaStat(
        schema_id=str(uuid4()),
        schema_name="Never Used",
        field_count=3,
        tag_count=0,
        last_used=None,
        reason="no_tags",
    )
    assert stat.last_used is None
    assert stat.reason == "no_tags"


# ============================================================================
# Test Group 4: Response Serialization (3 tests)
# ============================================================================


def test_analytics_response_with_empty_lists():
    """Test that AnalyticsResponse accepts empty lists for all fields."""
    response = AnalyticsResponse(
        most_used_fields=[],
        unused_schemas=[],
        field_coverage=[],
        schema_effectiveness=[],
    )
    assert response.most_used_fields == []
    assert response.unused_schemas == []
    assert response.field_coverage == []
    assert response.schema_effectiveness == []


def test_analytics_response_serialization_with_datetime():
    """Test that AnalyticsResponse correctly serializes datetime fields."""
    schema_id = str(uuid4())
    last_used_time = datetime(2025, 11, 14, 12, 0, 0, tzinfo=UTC)

    response = AnalyticsResponse(
        most_used_fields=[],
        unused_schemas=[
            UnusedSchemaStat(
                schema_id=schema_id,
                schema_name="Old Schema",
                field_count=5,
                tag_count=2,
                last_used=last_used_time,
                reason="no_values",
            )
        ],
        field_coverage=[],
        schema_effectiveness=[],
    )

    # Test model_dump serialization
    data = response.model_dump()
    assert len(data["unused_schemas"]) == 1
    assert data["unused_schemas"][0]["last_used"] == last_used_time
    assert data["unused_schemas"][0]["reason"] == "no_values"


def test_analytics_response_model_dump_excludes_none():
    """Test that model_dump can exclude None values."""
    schema_id = str(uuid4())

    response = AnalyticsResponse(
        most_used_fields=[],
        unused_schemas=[
            UnusedSchemaStat(
                schema_id=schema_id,
                schema_name="Never Used",
                field_count=3,
                tag_count=0,
                last_used=None,
                reason="no_tags",
            )
        ],
        field_coverage=[],
        schema_effectiveness=[],
    )

    # Test with exclude_none=True
    data = response.model_dump(exclude_none=True)
    assert "last_used" not in data["unused_schemas"][0]

    # Test without exclude_none (default)
    data_with_none = response.model_dump()
    assert "last_used" in data_with_none["unused_schemas"][0]
    assert data_with_none["unused_schemas"][0]["last_used"] is None


# ============================================================================
# Test Group 5: Boundary Value Tests (3 tests)
# ============================================================================


def test_most_used_field_stat_boundary_100_percent():
    """Test MostUsedFieldStat with 100% usage (boundary value)."""
    stat = MostUsedFieldStat(
        field_id=str(uuid4()),
        field_name="Fully Used",
        field_type="rating",
        usage_count=500,
        total_videos=500,
        usage_percentage=100.0,
    )
    assert stat.usage_percentage == 100.0


def test_field_coverage_stat_boundary_0_percent():
    """Test FieldCoverageStat with 0% coverage (boundary value)."""
    stat = FieldCoverageStat(
        field_id=str(uuid4()),
        field_name="Never Used",
        field_type="text",
        videos_with_values=0,
        total_videos=500,
        coverage_percentage=0.0,
    )
    assert stat.coverage_percentage == 0.0


def test_schema_effectiveness_stat_boundary_perfect_completion():
    """Test SchemaEffectivenessStat with 100% completion (all fields always filled)."""
    stat = SchemaEffectivenessStat(
        schema_id=str(uuid4()),
        schema_name="Perfect Schema",
        field_count=5,
        avg_fields_filled=5.0,
        completion_percentage=100.0,
        video_count=100,
    )
    assert stat.completion_percentage == 100.0
    assert stat.avg_fields_filled == 5.0


# ============================================================================
# Test Group 6: Percentage Out of Range (2 tests)
# ============================================================================


def test_most_used_field_stat_percentage_above_100():
    """Test that percentage > 100.0 is rejected by Field constraint."""
    with pytest.raises(ValidationError) as exc_info:
        MostUsedFieldStat(
            field_id=str(uuid4()),
            field_name="Invalid",
            field_type="rating",
            usage_count=500,
            total_videos=500,
            usage_percentage=101.0,
        )

    error_message = str(exc_info.value)
    assert "less than or equal to 100" in error_message


def test_field_coverage_stat_percentage_negative():
    """Test that negative percentage is rejected by Field constraint."""
    with pytest.raises(ValidationError) as exc_info:
        FieldCoverageStat(
            field_id=str(uuid4()),
            field_name="Negative",
            field_type="select",
            videos_with_values=0,
            total_videos=100,
            coverage_percentage=-5.0,  # Typo was 'usage_percentage'
        )

    error_message = str(exc_info.value)
    assert "greater than or equal to 0" in error_message
