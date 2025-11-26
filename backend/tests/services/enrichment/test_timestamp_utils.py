"""Tests for timestamp utility functions."""
import pytest

from app.services.enrichment.utils.timestamp_utils import (
    seconds_to_vtt_time,
    vtt_time_to_seconds,
    offset_timestamps,
    parse_description_timestamp,
    format_display_time,
)


class TestSecondsToVttTime:
    """Tests for seconds to VTT timestamp conversion."""

    def test_zero_seconds(self):
        """Zero seconds produces 00:00:00.000."""
        assert seconds_to_vtt_time(0) == "00:00:00.000"

    def test_simple_seconds(self):
        """Simple seconds conversion."""
        assert seconds_to_vtt_time(5.0) == "00:00:05.000"

    def test_minutes_and_seconds(self):
        """Minutes and seconds conversion."""
        assert seconds_to_vtt_time(65.5) == "00:01:05.500"

    def test_hours_minutes_seconds(self):
        """Full hours, minutes, seconds conversion."""
        assert seconds_to_vtt_time(3661.123) == "01:01:01.123"

    def test_large_hours(self):
        """Large number of hours."""
        assert seconds_to_vtt_time(36000) == "10:00:00.000"

    def test_millisecond_precision(self):
        """Milliseconds are preserved."""
        assert seconds_to_vtt_time(1.5) == "00:00:01.500"
        assert seconds_to_vtt_time(1.123) == "00:00:01.123"
        assert seconds_to_vtt_time(1.1234) == "00:00:01.123"  # Truncated


class TestVttTimeToSeconds:
    """Tests for VTT timestamp to seconds conversion."""

    def test_zero_time(self):
        """Zero timestamp."""
        assert vtt_time_to_seconds("00:00:00.000") == 0.0

    def test_simple_seconds(self):
        """Simple seconds timestamp."""
        assert vtt_time_to_seconds("00:00:05.000") == 5.0

    def test_minutes_and_seconds(self):
        """Minutes and seconds timestamp."""
        assert vtt_time_to_seconds("00:01:05.500") == 65.5

    def test_hours_minutes_seconds(self):
        """Full timestamp."""
        assert vtt_time_to_seconds("01:01:01.123") == 3661.123

    def test_short_format_mm_ss(self):
        """Short format without hours (MM:SS.mmm)."""
        assert vtt_time_to_seconds("01:30.500") == 90.5

    def test_roundtrip(self):
        """Conversion roundtrip."""
        original = 3661.123
        vtt_time = seconds_to_vtt_time(original)
        result = vtt_time_to_seconds(vtt_time)
        assert abs(result - original) < 0.001


class TestOffsetTimestamps:
    """Tests for timestamp offset functionality."""

    def test_offset_positive(self):
        """Positive offset adds time."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
Hello world"""
        result = offset_timestamps(vtt, 10.0)

        assert "00:00:10.000 --> 00:00:15.000" in result
        assert "Hello world" in result

    def test_offset_large(self):
        """Large offset (10 minutes)."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
Hello"""
        result = offset_timestamps(vtt, 600.0)

        assert "00:10:00.000 --> 00:10:05.000" in result

    def test_offset_preserves_text(self):
        """Offset preserves all text content."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
Line one

00:00:05.000 --> 00:00:10.000
Line two"""
        result = offset_timestamps(vtt, 60.0)

        assert "Line one" in result
        assert "Line two" in result

    def test_offset_zero(self):
        """Zero offset doesn't change anything."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
Hello"""
        result = offset_timestamps(vtt, 0.0)

        assert "00:00:00.000 --> 00:00:05.000" in result


class TestParseDescriptionTimestamp:
    """Tests for parsing timestamps from video descriptions."""

    def test_simple_mm_ss(self):
        """Parse simple MM:SS format."""
        assert parse_description_timestamp("2:30") == 150.0

    def test_padded_mm_ss(self):
        """Parse padded MM:SS format."""
        assert parse_description_timestamp("02:30") == 150.0

    def test_hh_mm_ss(self):
        """Parse HH:MM:SS format."""
        assert parse_description_timestamp("1:30:00") == 5400.0

    def test_padded_hh_mm_ss(self):
        """Parse padded HH:MM:SS format."""
        assert parse_description_timestamp("01:30:00") == 5400.0

    def test_zero_timestamp(self):
        """Parse zero timestamp."""
        assert parse_description_timestamp("0:00") == 0.0

    def test_short_format(self):
        """Parse short format (M:SS)."""
        assert parse_description_timestamp("5:00") == 300.0

    def test_invalid_timestamp_returns_none(self):
        """Invalid timestamp returns None."""
        assert parse_description_timestamp("invalid") is None
        assert parse_description_timestamp("") is None
        assert parse_description_timestamp("abc:def") is None

    def test_timestamp_with_surrounding_text(self):
        """Timestamp extraction handles surrounding text."""
        assert parse_description_timestamp("0:00 Intro") == 0.0


class TestFormatDisplayTime:
    """Tests for human-readable time formatting."""

    def test_zero_seconds(self):
        """Zero seconds displays as 0:00."""
        assert format_display_time(0) == "0:00"

    def test_simple_seconds(self):
        """Simple seconds display."""
        assert format_display_time(45) == "0:45"

    def test_minutes_and_seconds(self):
        """Minutes and seconds display."""
        assert format_display_time(125) == "2:05"

    def test_hours(self):
        """Hours display."""
        assert format_display_time(3661) == "1:01:01"

    def test_large_hours(self):
        """Large hours display."""
        assert format_display_time(36000) == "10:00:00"
