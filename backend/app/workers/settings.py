"""ARQ worker configuration with lifecycle hooks."""
from arq.connections import RedisSettings
from arq.jobs import Job
from urllib.parse import urlparse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.workers.db_manager import sessionmanager, db_session_context
from app.workers.video_processor import process_video
import logging

logger = logging.getLogger(__name__)

# Parse Redis DSN
redis_dsn = urlparse(settings.redis_url)


async def startup(ctx: dict | None) -> None:
    """Initialize worker resources on startup."""
    logger.info("ARQ worker starting up")
    await sessionmanager.connect()
    logger.info("ARQ worker startup complete")


async def shutdown(ctx: dict | None) -> None:
    """Cleanup worker resources on shutdown."""
    logger.info("ARQ worker shutting down")
    await sessionmanager.disconnect()
    logger.info("ARQ worker shutdown complete")


async def on_job_start(ctx: dict) -> None:
    """Set job-specific context before job execution."""
    job_id = ctx.get('job_id', 'unknown')
    logger.debug(f"Starting job {job_id}")

    # Set context variable for session scoping
    db_session_context.set(job_id)

    # Inject database session into job context
    ctx['db'] = sessionmanager.get_session()


async def after_job_end(ctx: dict) -> None:
    """Cleanup and commit/rollback after job completion."""
    job_id = ctx.get('job_id', 'unknown')

    try:
        # Get job info to determine success/failure
        job = Job(job_id, ctx['redis'])
        job_info = await job.info()

        db: AsyncSession = ctx['db']

        # Commit on success, rollback on failure
        if job_info and job_info.success:
            await db.commit()
            logger.debug(f"Job {job_id} succeeded - committed transaction")
        else:
            await db.rollback()
            logger.debug(f"Job {job_id} failed - rolled back transaction")

    except Exception as e:
        logger.error(f"Error in after_job_end for job {job_id}: {e}")
        # Always rollback on exception
        try:
            await ctx['db'].rollback()
        except Exception:
            pass

    finally:
        # Always remove session from scope
        await sessionmanager.scoped_session.remove()
        db_session_context.set(None)


class WorkerSettings:
    """ARQ worker configuration."""

    # Parse database number from path, handling edge cases
    db_str = redis_dsn.path.lstrip('/') if redis_dsn.path else ''
    redis_db = int(db_str) if db_str.isdigit() else 0

    redis_settings = RedisSettings(
        host=redis_dsn.hostname or 'localhost',
        port=redis_dsn.port or 6379,
        database=redis_db,
        password=redis_dsn.password,
    )

    # Worker functions
    functions = [process_video]

    # Worker configuration
    max_jobs = 10
    job_timeout = 300  # 5 minutes
    keep_result = 3600  # 1 hour

    # Lifecycle hooks
    on_startup = startup
    on_shutdown = shutdown
    on_job_start = on_job_start
    after_job_end = after_job_end
