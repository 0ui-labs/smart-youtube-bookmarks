from uuid import UUID
from arq import Retry
from arq.worker import func as arq_func
import httpx
import asyncpg
import logging
import time
import json
import random
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, create_model
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.models.job_progress import JobProgressEvent
from app.models.job import ProcessingJob
from app.models.video import Video
from app.core.database import AsyncSessionLocal
from app.clients.youtube import YouTubeClient
from app.clients.gemini import GeminiClient
from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)

# Error categorization
TRANSIENT_ERRORS = (
    # Network errors
    httpx.ConnectError,
    httpx.TimeoutException,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    # Database errors
    asyncpg.exceptions.PostgresConnectionError,
    asyncpg.exceptions.TooManyConnectionsError,
    asyncpg.exceptions.CannotConnectNowError,
)


def parse_iso8601_duration(duration_str: str) -> int:
    """
    Parse ISO 8601 duration (PT3M33S) to total seconds using isodate library

    Args:
        duration_str: ISO 8601 duration string (e.g., "PT3M33S", "PT1H2M3S")

    Returns:
        Total duration in seconds
    """
    from isodate import parse_duration

    try:
        duration_obj = parse_duration(duration_str)
        return int(duration_obj.total_seconds())
    except Exception:
        return 0  # Fallback


def _create_pydantic_schema_from_jsonb(schema_fields: Dict[str, Any]) -> type[BaseModel]:
    """
    Create Pydantic model dynamically from JSONB schema definition.

    Converts Schema.fields JSONB format to a Pydantic BaseModel for use
    with Gemini API structured output.

    Args:
        schema_fields: Dictionary from Schema.fields JSONB column
            Example: {
                "categories": {
                    "type": "array",
                    "description": "Video categories",
                    "required": True
                },
                "difficulty_level": {
                    "type": "string",
                    "description": "Difficulty level",
                    "required": True
                }
            }

    Returns:
        Dynamically created Pydantic BaseModel class

    Raises:
        ValueError: If schema_fields is empty or malformed
    """
    if not schema_fields:
        raise ValueError("schema_fields cannot be empty")

    # Type mapping from JSON schema to Python types
    type_mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list[str],  # Simplified - assumes array of strings
        "object": Dict[str, Any],
    }

    # Build Pydantic field definitions
    fields = {}
    for field_name, field_spec in schema_fields.items():
        # Get field type
        json_type = field_spec.get("type", "string")
        python_type = type_mapping.get(json_type, str)

        # Get description
        description = field_spec.get("description", "")

        # Determine if required
        is_required = field_spec.get("required", False)

        # Create field definition
        if is_required:
            # Required field
            fields[field_name] = (python_type, Field(description=description))
        else:
            # Optional field with default None
            fields[field_name] = (
                Optional[python_type],
                Field(default=None, description=description),
            )

    # Create dynamic Pydantic model
    schema_model = create_model("DynamicExtractionSchema", **fields)

    return schema_model


async def process_video(
    ctx: dict,
    video_id: str,
    list_id: str,
    schema: dict
) -> dict:
    """
    Process a single video with exponential backoff retry.

    Args:
        ctx: ARQ context with job metadata
        video_id: UUID of video to process
        list_id: UUID of parent list
        schema: Schema definition for extraction

    Returns:
        dict: {"status": "success", "video_id": str}

    Raises:
        Retry: For transient errors with exponential backoff
    """
    job_try = ctx.get("job_try", 1)
    max_tries = ctx.get("max_tries", 5)

    logger.info(f"Processing video {video_id} (attempt {job_try}/{max_tries})")

    try:
        # Fetch video from database to get YouTube ID
        async with AsyncSessionLocal() as db:
            video = await db.get(Video, UUID(video_id))
            if not video:
                raise ValueError(f"Video not found in database: {video_id}")
            youtube_id = video.youtube_id

        # Initialize YouTube client with Redis caching
        redis = await get_redis_client()
        youtube_client = YouTubeClient(
            api_key=settings.youtube_api_key,
            redis_client=redis
        )

        # Fetch video metadata
        metadata = await youtube_client.get_video_metadata(youtube_id)

        # Fetch transcript (optional - graceful degradation)
        transcript = await youtube_client.get_video_transcript(youtube_id)

        # Extract structured data using Gemini (if schema and transcript available)
        extracted_data = None
        if schema and transcript:
            try:
                # Create Pydantic schema from JSONB schema definition
                schema_model = _create_pydantic_schema_from_jsonb(schema)

                # Initialize Gemini client
                gemini_client = GeminiClient(api_key=settings.gemini_api_key)

                # Extract structured data
                logger.info(f"Extracting structured data for video {video_id} with Gemini")
                result = await gemini_client.extract_structured_data(
                    transcript=transcript,
                    schema_model=schema_model
                )

                # Convert to dict for JSONB storage
                extracted_data = result.model_dump()
                logger.info(f"Gemini extraction completed for video {video_id}")

            except Exception as e:
                # Graceful degradation - log error but don't fail video processing
                logger.warning(
                    f"Gemini extraction failed for video {video_id}: {e}. "
                    f"Continuing with metadata only.",
                    exc_info=True
                )
                # extracted_data remains None

        # Parse published_at timestamp
        published_at = None
        if metadata.get("published_at"):
            try:
                published_at = datetime.fromisoformat(metadata["published_at"].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                logger.warning(f"Failed to parse published_at: {metadata.get('published_at')}")

        # Parse duration from ISO 8601 to seconds
        duration_seconds = parse_iso8601_duration(metadata.get("duration", ""))

        # Update video in database with metadata AND extracted data
        async with AsyncSessionLocal() as db:
            video = await db.get(Video, UUID(video_id))
            if video:
                video.title = metadata["title"]
                video.channel = metadata["channel"]
                video.duration = duration_seconds
                video.thumbnail_url = metadata["thumbnail_url"]
                video.published_at = published_at
                video.extracted_data = extracted_data  # NEW: Store Gemini extraction
                video.processing_status = "completed"
                await db.commit()

        return {"status": "success", "video_id": video_id}

    except ValueError as e:
        # Video not found (404)
        logger.warning(f"Video not found: {video_id} - {e}")
        async with AsyncSessionLocal() as db:
            video = await db.get(Video, UUID(video_id))
            if video:
                video.processing_status = "failed"
                await db.commit()
        return {"status": "failed", "error": str(e)}

    except TRANSIENT_ERRORS as e:
        # Transient errors: retry with exponential backoff
        if job_try < max_tries:
            defer_seconds = min(2 ** job_try, 300)  # Cap at 5 minutes
            logger.warning(f"Transient error processing video {video_id}, retrying in {defer_seconds}s: {e}")
            raise Retry(defer=defer_seconds) from e

        # Final attempt failed
        logger.error(f"Failed to process video {video_id} after {max_tries} attempts: {e}")
        raise

    except Exception as e:
        # Non-retryable errors: fail immediately
        logger.error(f"Fatal error processing video {video_id}: {e}")
        raise


# Configure max_tries via arq_func decorator-style usage
process_video.max_tries = 5


async def publish_progress(ctx: dict, progress_data: dict) -> None:
    """
    Dual-write pattern: Publish to Redis (best-effort) and PostgreSQL (best-effort).
    Both are non-critical. Clients fall back to GET /api/jobs/{job_id}/progress-history.
    """
    job_id = ctx.get("job_id")
    user_id = ctx.get("job_user_id")

    if not job_id or not user_id:
        logger.error("publish_progress: missing context (job_id or user_id)")
        return

    # Add job_id to progress_data
    progress_data["job_id"] = job_id

    # 1. Redis Pub/Sub (best-effort)
    try:
        redis = ctx["redis"]
        channel = f"progress:user:{user_id}"
        await redis.publish(channel, json.dumps(progress_data))
        logger.info(f"Published progress to {channel}: {progress_data.get('progress')}%")
    except Exception as e:
        logger.warning(f"Redis publish failed (non-fatal): {e}", exc_info=True)
        # Don't raise - best-effort

    # 2. PostgreSQL (best-effort)
    try:
        async with AsyncSessionLocal() as session:
            try:
                event = JobProgressEvent(
                    job_id=job_id,
                    progress_data=progress_data
                )
                session.add(event)
                await session.commit()
                logger.info(f"Persisted progress to DB: {progress_data.get('progress')}%")
            except Exception:
                await session.rollback()
                raise
    except Exception as e:
        logger.warning(f"DB persist failed (non-fatal): {e}", exc_info=True)
        # Don't raise - best-effort


async def process_video_list(
    ctx: dict,
    job_id: str,
    list_id: str,
    video_ids: list[str],
    schema: dict = None
) -> dict:
    """
    Process multiple videos with throttled progress updates.

    Args:
        ctx: ARQ context
        job_id: Processing job UUID
        list_id: Bookmark list UUID
        video_ids: List of video UUIDs to process
        schema: Optional schema fields for Gemini extraction (JSONB format)

    Returns:
        dict: Processing results with counts
    """

    # OPTIMIZATION: Lookup user_id ONCE at start, cache in context
    async with AsyncSessionLocal() as session:
        stmt = (
            select(ProcessingJob)
            .options(joinedload(ProcessingJob.list))
            .where(ProcessingJob.id == job_id)
        )
        result = await session.execute(stmt)
        job = result.scalar_one_or_none()

        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Cache user_id in context
        ctx["job_user_id"] = str(job.list.user_id)
        ctx["job_id"] = str(job_id)

    total = len(video_ids)
    processed = 0
    failed = 0

    # Throttling configuration
    THROTTLE_INTERVAL = 2.0  # seconds
    THROTTLE_PERCENTAGE_STEP = 5  # percent
    last_progress_time = 0.0
    last_progress_percentage = 0

    # Initial event (always publish)
    await publish_progress(ctx, {
        "status": "pending",
        "progress": 0,
        "current_video": 0,
        "total_videos": total,
        "message": "Starting processing..."
    })
    last_progress_time = time.monotonic()

    for idx, video_id in enumerate(video_ids, start=1):
        is_error = False
        error_msg = None
        try:
            # Process single video with schema
            result = await process_video(ctx, video_id, list_id, schema or {})
            processed += 1
        except Exception as e:
            failed += 1
            is_error = True
            error_msg = str(e)
            logger.error(f"Failed to process video {video_id}: {e}")

        current_percentage = int((idx / total) * 100)
        current_time = time.monotonic()

        # Throttle logic
        should_publish = (
            (current_time - last_progress_time) >= THROTTLE_INTERVAL
            or (current_percentage - last_progress_percentage) >= THROTTLE_PERCENTAGE_STEP
            or is_error
            or idx == total
        )

        if should_publish:
            progress_update = {
                "status": "processing",
                "progress": current_percentage,
                "current_video": idx,
                "total_videos": total,
                "message": f"Processing video {idx}/{total}",
                "video_id": str(video_id)
            }
            if is_error:
                progress_update["error"] = error_msg

            await publish_progress(ctx, progress_update)
            last_progress_time = current_time
            last_progress_percentage = current_percentage

    # Final event (always publish)
    final_status = "completed" if failed == 0 else "completed_with_errors"
    await publish_progress(ctx, {
        "status": final_status,
        "progress": 100,
        "current_video": total,
        "total_videos": total,
        "message": f"Completed: {processed} succeeded, {failed} failed"
    })

    return {
        "job_id": job_id,
        "processed": processed,
        "failed": failed
    }
