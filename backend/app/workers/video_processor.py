from uuid import UUID
from arq import Retry
from arq.worker import func as arq_func
import httpx
import asyncpg
import logging

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
