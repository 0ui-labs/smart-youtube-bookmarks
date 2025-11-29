"""
Unit tests for field value validation logic.

These tests verify the EXTRACTED validation logic from Task #72.
Tests are independent of the endpoint and database.
"""

import time

import pytest

from app.api.field_validation import FieldValidationError, validate_field_value


class TestRatingValidation:
    """Tests for rating field validation."""

    def test_valid_rating_integer(self):
        """Test valid integer rating within range."""
        validate_field_value(5, "rating", {"max_rating": 5})
        validate_field_value(0, "rating", {"max_rating": 5})
        validate_field_value(3, "rating", {"max_rating": 5})
        # Should not raise

    def test_valid_rating_float(self):
        """Test valid float rating (e.g., 3.5 stars)."""
        validate_field_value(3.5, "rating", {"max_rating": 5})
        validate_field_value(0.5, "rating", {"max_rating": 5})
        # Should not raise

    def test_invalid_rating_exceeds_max(self):
        """Test rating value exceeds max_rating."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(6, "rating", {"max_rating": 5})

        assert "between 0 and 5" in str(exc_info.value)

    def test_invalid_rating_negative(self):
        """Test negative rating value."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(-1, "rating", {"max_rating": 5})

        assert "between 0 and" in str(exc_info.value)

    def test_invalid_rating_wrong_type(self):
        """Test rating value with wrong type (string)."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value("5", "rating", {"max_rating": 5})

        assert "must be numeric" in str(exc_info.value)

    def test_rating_default_max(self):
        """Test rating uses default max_rating=5 if not in config."""
        validate_field_value(5, "rating", {})  # No max_rating in config

        with pytest.raises(FieldValidationError):
            validate_field_value(6, "rating", {})


class TestSelectValidation:
    """Tests for select field validation."""

    def test_valid_select_value(self):
        """Test valid select value in options list."""
        config = {"options": ["bad", "good", "great"]}
        validate_field_value("good", "select", config)
        validate_field_value("bad", "select", config)
        validate_field_value("great", "select", config)
        # Should not raise

    def test_invalid_select_value_not_in_options(self):
        """Test select value not in options list."""
        config = {"options": ["bad", "good", "great"]}
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value("invalid", "select", config)

        error_msg = str(exc_info.value)
        assert "'invalid'" in error_msg
        assert "Valid options:" in error_msg

    def test_invalid_select_case_sensitive(self):
        """Test select validation is case-sensitive."""
        config = {"options": ["bad", "good", "great"]}
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value("Good", "select", config)  # Capital G

        assert "'Good'" in str(exc_info.value)

    def test_invalid_select_wrong_type(self):
        """Test select value with wrong type (integer)."""
        config = {"options": ["bad", "good", "great"]}
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(123, "select", config)

        assert "must be string" in str(exc_info.value)

    def test_select_empty_options_list(self):
        """Test select with empty options list still validates type."""
        config = {"options": []}
        with pytest.raises(FieldValidationError):
            validate_field_value("anything", "select", config)


class TestTextValidation:
    """Tests for text field validation."""

    def test_valid_text_without_max_length(self):
        """Test valid text value with no max_length constraint."""
        validate_field_value("Hello world", "text", {})
        validate_field_value("A" * 10000, "text", {})  # Very long text
        # Should not raise

    def test_valid_text_within_max_length(self):
        """Test valid text value within max_length."""
        validate_field_value("Hello", "text", {"max_length": 10})
        validate_field_value("Hello", "text", {"max_length": 5})  # Exactly at limit
        # Should not raise

    def test_invalid_text_exceeds_max_length(self):
        """Test text value exceeds max_length."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value("Hello world", "text", {"max_length": 5})

        error_msg = str(exc_info.value)
        assert "exceeds max length 5" in error_msg
        assert "11 chars" in error_msg

    def test_invalid_text_wrong_type(self):
        """Test text value with wrong type (integer)."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(123, "text", {"max_length": 10})

        assert "must be string" in str(exc_info.value)

    def test_valid_text_empty_string(self):
        """Test empty string is valid text."""
        validate_field_value("", "text", {"max_length": 10})
        validate_field_value("", "text", {})
        # Should not raise


class TestBooleanValidation:
    """Tests for boolean field validation."""

    def test_valid_boolean_true(self):
        """Test valid boolean True value."""
        validate_field_value(True, "boolean", {})
        # Should not raise

    def test_valid_boolean_false(self):
        """Test valid boolean False value."""
        validate_field_value(False, "boolean", {})
        # Should not raise

    def test_invalid_boolean_integer_1(self):
        """Test integer 1 is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(1, "boolean", {})

        assert "must be true/false" in str(exc_info.value)

    def test_invalid_boolean_integer_0(self):
        """Test integer 0 is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(0, "boolean", {})

        assert "must be true/false" in str(exc_info.value)

    def test_invalid_boolean_string(self):
        """Test string 'true' is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value("true", "boolean", {})

        assert "must be true/false" in str(exc_info.value)


class TestUnknownFieldType:
    """Tests for unknown field_type handling."""

    def test_unknown_field_type_raises_valueerror(self):
        """Test unknown field_type raises ValueError (not FieldValidationError)."""
        with pytest.raises(ValueError) as exc_info:
            validate_field_value(5, "unknown_type", {})

        assert "Unknown field_type" in str(exc_info.value)
        assert "'unknown_type'" in str(exc_info.value)


class TestFieldNameInErrors:
    """Tests for field_name parameter in error messages."""

    def test_field_name_included_in_error(self):
        """Test field_name parameter is used for context (optional)."""
        # Note: field_name is parameter but not stored in exception
        # Just verify validation still works with field_name
        with pytest.raises(FieldValidationError):
            validate_field_value(
                10, "rating", {"max_rating": 5}, field_name="Overall Rating"
            )


class TestPerformance:
    """Performance tests for validation logic."""

    def test_validation_performance_batch_50_fields(self):
        """
        Test realistic batch scenario: 50 field validations.

        This simulates the max batch size from Task #72 endpoint.
        Target: < 50ms total (< 1ms average per field)
        """
        # Simulate 50 field updates (max batch size)
        fields_config = [
            ("rating", {"max_rating": 5}, 4),
            ("select", {"options": ["a", "b", "c"]}, "b"),
            ("text", {"max_length": 100}, "Hello"),
            ("boolean", {}, True),
        ]

        # Create 50 validations (cycling through 4 types)
        validations = []
        for i in range(50):
            field_type, config, value = fields_config[i % 4]
            validations.append((value, field_type, config))

        # Benchmark
        start = time.perf_counter()
        for value, field_type, config in validations:
            validate_field_value(value, field_type, config)
        end = time.perf_counter()

        total_time_ms = (end - start) * 1000
        avg_time_ms = total_time_ms / 50

        assert total_time_ms < 50.0, (
            f"Batch validation {total_time_ms:.3f}ms exceeds 50ms target"
        )
        assert avg_time_ms < 1.0, (
            f"Avg validation {avg_time_ms:.3f}ms exceeds 1ms target"
        )

    def test_validation_performance_single_field(self):
        """Test single field validation completes in < 1ms."""
        iterations = 1000

        start = time.perf_counter()
        for _ in range(iterations):
            validate_field_value(3, "rating", {"max_rating": 5})
        end = time.perf_counter()

        avg_time_ms = ((end - start) / iterations) * 1000
        assert avg_time_ms < 1.0, (
            f"Avg validation time {avg_time_ms:.3f}ms exceeds 1ms target"
        )
