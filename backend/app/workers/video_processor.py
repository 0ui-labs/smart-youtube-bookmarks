from uuid import UUID
from arq import Retry
from arq.worker import func as arq_func
import httpx
import asyncpg
import logging
import time
import json
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.models.job_progress import JobProgressEvent
from app.models.job import ProcessingJob
from app.core.database import AsyncSessionLocal

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
        # TODO: Implement full processing pipeline
        # 1. Fetch YouTube metadata
        # 2. Get transcript
        # 3. Extract data via Gemini
        # 4. Update database

        # For now, just mark as success (stub implementation)
        return {"status": "success", "video_id": video_id}

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
        logger.debug(f"Published progress to {channel}: {progress_data.get('progress')}%")
    except Exception as e:
        logger.warning(f"Redis publish failed (non-fatal): {e}", exc_info=True)
        # Don't raise - best-effort

    # 2. PostgreSQL (best-effort)
    try:
        async with AsyncSessionLocal() as session:
            event = JobProgressEvent(
                job_id=job_id,
                progress_data=progress_data
            )
            session.add(event)

            try:
                await session.commit()
                logger.debug(f"Persisted progress to DB: {progress_data.get('progress')}%")
            except Exception as commit_error:
                await session.rollback()
                raise commit_error
    except Exception as e:
        logger.warning(f"DB persist failed (non-fatal): {e}", exc_info=True)
        # Don't raise - best-effort


async def process_video_list(
    ctx: dict,
    job_id: str,
    list_id: str,
    video_ids: list[str]
) -> dict:
    """Process multiple videos with throttled progress updates"""

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
            # Process single video (existing function)
            result = await process_video(ctx, video_id, list_id, {})
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
