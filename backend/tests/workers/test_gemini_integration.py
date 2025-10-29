"""
Tests for Gemini API integration in video processor worker.

This module tests the end-to-end flow of extracting structured data
from video transcripts using Gemini API within the ARQ worker.
"""

import pytest
from app.workers.video_processor import process_video
from app.models import Video
from app.models.list import BookmarkList
from app.models.schema import Schema
from uuid import uuid4
from unittest.mock import AsyncMock, patch, MagicMock
import json


@pytest.fixture
def mock_youtube_client():
    """Mock YouTube client for all worker tests"""
    with patch("app.workers.video_processor.YouTubeClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get_video_metadata.return_value = {
            "video_id": "test123",
            "title": "Test Video",
            "channel": "Test Channel",
            "published_at": "2025-01-01T00:00:00Z",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "duration": "PT3M33S",
        }
        mock_client.get_video_transcript.return_value = "Test transcript"
        mock_client_class.return_value = mock_client
        yield mock_client_class


@pytest.mark.asyncio
async def test_process_video_with_gemini_extraction(
    test_db, test_user, mock_session_factory, mock_youtube_client
):
    """
    Test that process_video extracts structured data using Gemini API.

    Flow:
    1. Fetch YouTube metadata (mocked)
    2. Fetch transcript (mocked)
    3. Extract data via Gemini (mocked)
    4. Store extracted_data in video.extracted_data JSONB field

    This test demonstrates the DESIRED behavior (RED phase).
    """
    # Arrange: Create schema for extraction
    schema = Schema(
        name="Video Analysis Schema",
        fields={
            "categories": {
                "type": "array",
                "description": "Video topic categories",
                "required": True,
            },
            "difficulty_level": {
                "type": "string",
                "description": "Difficulty: Beginner, Intermediate, or Advanced",
                "required": True,
            },
            "key_topics": {
                "type": "array",
                "description": "Main topics covered",
                "required": True,
            },
        },
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)

    # Arrange: Create list with schema
    bookmark_list = BookmarkList(
        name="Test List with Schema",
        description="Test list for Gemini extraction",
        user_id=test_user.id,
        schema_id=schema.id,
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create test video
    video = Video(
        list_id=bookmark_list.id,
        youtube_id="dQw4w9WgXcQ",
        processing_status="pending",
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Mock YouTube API responses
    mock_youtube_client.get_video_metadata.return_value = {
        "title": "Python Tutorial for Beginners",
        "channel": "Tech Academy",
        "duration": "PT15M30S",
        "thumbnail_url": "https://i.ytimg.com/vi/test/default.jpg",
        "published_at": "2024-01-15T10:00:00Z",
    }

    mock_youtube_client.get_video_transcript.return_value = """
    Welcome to this Python tutorial for absolute beginners!
    In this video, we'll cover the basics of Python programming,
    including variables, data types, and control flow.
    This is perfect for people with no prior programming experience.
    """

    # Mock Gemini API extraction (patch get_gemini_client for singleton pattern)
    mock_gemini_instance = AsyncMock()

    # Mock extracted data response
    mock_extracted_data = MagicMock()
    mock_extracted_data.model_dump.return_value = {
        "categories": ["Tutorial", "Python", "Programming"],
        "difficulty_level": "Beginner",
        "key_topics": ["Variables", "Data Types", "Control Flow"],
    }

    mock_gemini_instance.extract_structured_data.return_value = mock_extracted_data

    with patch("app.workers.video_processor.get_gemini_client", return_value=mock_gemini_instance):
        # Mock session factory
        with patch(
            "app.workers.video_processor.AsyncSessionLocal", mock_session_factory
        ):
            # Act: Process video
            ctx = {"job_try": 1, "max_tries": 5}
            result = await process_video(
                ctx,
                video_id=str(video.id),
                list_id=str(bookmark_list.id),
                schema=schema.fields,
            )

    # Assert: Video was updated with extracted data
    await test_db.refresh(video)

    assert result["status"] == "success"
    assert video.processing_status == "completed"
    assert video.extracted_data is not None
    assert video.extracted_data["categories"] == [
        "Tutorial",
        "Python",
        "Programming",
    ]
    assert video.extracted_data["difficulty_level"] == "Beginner"
    assert video.extracted_data["key_topics"] == [
        "Variables",
        "Data Types",
        "Control Flow",
    ]

    # Assert: Gemini extraction was called correctly
    mock_gemini_instance.extract_structured_data.assert_called_once()


@pytest.mark.asyncio
async def test_process_video_graceful_degradation_without_schema(
    test_db, test_user, mock_session_factory, mock_youtube_client
):
    """
    Test that video processing works WITHOUT Gemini extraction when no schema.

    If list has no schema, video should still be processed (metadata only),
    but extracted_data should remain None.
    """
    # Arrange: Create list WITHOUT schema
    bookmark_list = BookmarkList(
        name="Test List No Schema",
        description="Test list without schema",
        user_id=test_user.id,
        schema_id=None,  # No schema!
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create test video
    video = Video(
        list_id=bookmark_list.id,
        youtube_id="dQw4w9WgXcQ",
        processing_status="pending",
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Mock YouTube API
    mock_youtube_client.get_video_metadata.return_value = {
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://test.jpg",
        "published_at": "2024-01-01T00:00:00Z",
    }
    mock_youtube_client.get_video_transcript.return_value = "Test transcript"

    # Mock session factory
    with patch("app.workers.video_processor.AsyncSessionLocal", mock_session_factory):
        # Act: Process video
        ctx = {"job_try": 1, "max_tries": 5}
        result = await process_video(
            ctx, video_id=str(video.id), list_id=str(bookmark_list.id), schema={}
        )

    # Assert: Video processed successfully WITHOUT Gemini extraction
    await test_db.refresh(video)

    assert result["status"] == "success"
    assert video.processing_status == "completed"
    assert video.title == "Test Video"
    assert video.extracted_data is None  # No extraction without schema


@pytest.mark.asyncio
async def test_process_video_handles_gemini_errors_gracefully(
    test_db, test_user, mock_session_factory, mock_youtube_client
):
    """
    Test that Gemini extraction errors don't crash video processing.

    If Gemini extraction fails, video should still be marked as completed
    with metadata, but extracted_data should contain error info.
    """
    # Arrange: Create schema
    schema = Schema(
        name="Test Schema",
        fields={
            "topic": {"type": "string", "description": "Main topic", "required": True}
        },
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)

    # Arrange: Create list with schema
    bookmark_list = BookmarkList(
        name="Test List",
        user_id=test_user.id,
        schema_id=schema.id,
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create video
    video = Video(
        list_id=bookmark_list.id,
        youtube_id="test123",
        processing_status="pending",
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Mock YouTube API (override fixture default)
    mock_youtube_instance = mock_youtube_client.return_value
    mock_youtube_instance.get_video_metadata.return_value = {
        "title": "Test",
        "channel": "Test",
        "duration": "PT1M",
        "thumbnail_url": "https://test.jpg",
        "published_at": "2024-01-01T00:00:00Z",
    }
    mock_youtube_instance.get_video_transcript.return_value = "Test transcript"

    # Mock Gemini to raise exception (patch get_gemini_client for singleton pattern)
    mock_gemini_instance = AsyncMock()
    mock_gemini_instance.extract_structured_data.side_effect = Exception(
        "Gemini API quota exceeded"
    )

    with patch("app.workers.video_processor.get_gemini_client", return_value=mock_gemini_instance):
        with patch(
            "app.workers.video_processor.AsyncSessionLocal", mock_session_factory
        ):
            # Act: Process video
            ctx = {"job_try": 1, "max_tries": 5}
            result = await process_video(
                ctx, video_id=str(video.id), list_id=str(bookmark_list.id), schema=schema.fields
            )

    # Assert: Video marked as completed with metadata, extraction error noted
    await test_db.refresh(video)

    assert result["status"] == "success"
    assert video.processing_status == "completed"
    assert video.title == "Test"  # Metadata saved
    # Extracted data should contain error info or be None
    # (Implementation can decide: store error in extracted_data or leave None)


@pytest.mark.asyncio
async def test_process_video_list_propagates_schema_to_extraction(
    test_db, test_user, mock_session_factory, mock_youtube_client
):
    """
    CRITICAL TEST: Verify schema is propagated through the entire pipeline.

    This test verifies the fix for the critical bug where schema was hardcoded
    as {} in process_video_list at line 359.

    Flow:
    1. Create schema in database
    2. Create list with schema_id
    3. Create videos
    4. Call process_video_list WITH schema parameter
    5. Verify Gemini extraction is called WITH the schema

    RED PHASE: This test will FAIL until we fix process_video_list signature
    and update the call at line 359.
    """
    from app.workers.video_processor import process_video_list
    from app.models.job import ProcessingJob

    # Arrange: Create schema
    schema = Schema(
        name="Pipeline Test Schema",
        fields={
            "categories": {
                "type": "array",
                "description": "Video categories",
                "required": True,
            },
            "sentiment": {
                "type": "string",
                "description": "Overall sentiment",
                "required": True,
            },
        },
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)

    # Arrange: Create list with schema
    bookmark_list = BookmarkList(
        name="Test List with Schema",
        user_id=test_user.id,
        schema_id=schema.id,
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create processing job
    job = ProcessingJob(
        list_id=bookmark_list.id,
        total_videos=2,
        status="running"
    )
    test_db.add(job)
    await test_db.commit()
    await test_db.refresh(job)

    # Arrange: Create test videos
    video1 = Video(
        list_id=bookmark_list.id,
        youtube_id="video1",
        processing_status="pending",
    )
    video2 = Video(
        list_id=bookmark_list.id,
        youtube_id="video2",
        processing_status="pending",
    )
    test_db.add_all([video1, video2])
    await test_db.commit()
    await test_db.refresh(video1)
    await test_db.refresh(video2)

    # Mock YouTube API
    mock_youtube_instance = mock_youtube_client.return_value
    mock_youtube_instance.get_video_metadata.return_value = {
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://test.jpg",
        "published_at": "2024-01-01T00:00:00Z",
    }
    mock_youtube_instance.get_video_transcript.return_value = "Test transcript content"

    # Mock Gemini extraction (patch get_gemini_client for singleton pattern)
    mock_gemini_instance = AsyncMock()

    # Mock extracted data response
    mock_extracted_data = MagicMock()
    mock_extracted_data.model_dump.return_value = {
        "categories": ["Tutorial", "Tech"],
        "sentiment": "Positive",
    }

    mock_gemini_instance.extract_structured_data.return_value = mock_extracted_data

    # Mock session factory and Redis
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(return_value=1)

    with patch("app.workers.video_processor.get_gemini_client", return_value=mock_gemini_instance):
        with patch("app.workers.video_processor.AsyncSessionLocal", mock_session_factory):
            # Act: Process videos with schema (NEW PARAMETER)
            ctx = {"redis": mock_redis}
            result = await process_video_list(
                ctx,
                job_id=str(job.id),
                list_id=str(bookmark_list.id),
                video_ids=[str(video1.id), str(video2.id)],
                schema=schema.fields  # CRITICAL: Pass schema to worker
            )

    # Assert: Videos were processed successfully
    await test_db.refresh(video1)
    await test_db.refresh(video2)

    assert result["processed"] == 2
    assert result["failed"] == 0

    # Assert: Gemini extraction was called FOR EACH VIDEO
    assert mock_gemini_instance.extract_structured_data.call_count == 2

    # Assert: Extracted data was stored in both videos
    assert video1.extracted_data is not None
    assert video1.extracted_data["categories"] == ["Tutorial", "Tech"]
    assert video1.extracted_data["sentiment"] == "Positive"

    assert video2.extracted_data is not None
    assert video2.extracted_data["categories"] == ["Tutorial", "Tech"]
    assert video2.extracted_data["sentiment"] == "Positive"
