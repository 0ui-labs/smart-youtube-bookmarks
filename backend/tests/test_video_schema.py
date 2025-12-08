"""
Test for VideoResponse schema import fields.
"""

from datetime import UTC, datetime
from uuid import uuid4


def test_video_response_has_import_fields():
    """Test that VideoResponse includes import_progress and import_stage fields."""
    from app.schemas.video import VideoResponse

    # Create a minimal VideoResponse
    response = VideoResponse(
        id=uuid4(),
        list_id=uuid4(),
        youtube_id="test123abc",
        processing_status="pending",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        import_progress=25,
        import_stage="metadata",
    )

    assert response.import_progress == 25
    assert response.import_stage == "metadata"


def test_video_response_import_field_defaults():
    """Test that import fields have correct defaults."""
    from app.schemas.video import VideoResponse

    # Create VideoResponse without explicit import values
    response = VideoResponse(
        id=uuid4(),
        list_id=uuid4(),
        youtube_id="test123abc",
        processing_status="pending",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    assert response.import_progress == 0, "Default import_progress should be 0"
    assert response.import_stage == "created", (
        "Default import_stage should be 'created'"
    )
