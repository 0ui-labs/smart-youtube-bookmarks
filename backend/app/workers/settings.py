"""ARQ worker configuration with lifecycle hooks."""
from arq.connections import RedisSettings, ArqRedis
from arq.jobs import Job
from arq.cron import cron
from urllib.parse import urlparse, parse_qs
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, update
from app.core.config import settings
from app.workers.db_manager import sessionmanager, db_session_context
from app.workers.video_processor import process_video, process_video_list, enrich_video_staged
from app.workers.enrichment_worker import enrich_video
from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus
from app.models.video import Video
import logging

logger = logging.getLogger(__name__)

# Maximum retry attempts for failed enrichments
MAX_ENRICHMENT_RETRIES = 3

# Parse Redis DSN (same logic as redis.py for consistency)
redis_dsn = urlparse(settings.redis_url)


async def startup(ctx: dict) -> None:
    """Initialize worker resources on startup and recover pending enrichments."""
    logger.info("ARQ worker starting up")
    await sessionmanager.connect()

    # Recovery: enqueue enrichments for videos that need them
    # Handles two cases:
    # 1. Videos with pending enrichment records (enqueue was lost)
    # 2. Videos with completed processing but NO enrichment record at all
    if settings.enrichment_enabled and settings.enrichment_auto_trigger:
        try:
            # Set a temporary context for the session
            db_session_context.set("startup_recovery")
            db = sessionmanager.get_session()
            arq_redis: ArqRedis = ctx['redis']
            try:
                # Case 1: Recover pending enrichments (existing logic)
                result = await db.execute(
                    select(VideoEnrichment)
                    .where(VideoEnrichment.status == EnrichmentStatus.pending.value)
                )
                pending = result.scalars().all()

                if pending:
                    logger.info(f"Found {len(pending)} pending enrichments to recover")
                    for enrichment in pending:
                        try:
                            await arq_redis.enqueue_job(
                                "enrich_video",
                                str(enrichment.video_id)
                            )
                            logger.info(f"Recovered pending enrichment for video {enrichment.video_id}")
                        except Exception as e:
                            logger.warning(f"Failed to enqueue pending enrichment {enrichment.video_id}: {e}")

                # Case 2: Find completed videos with NO enrichment record
                # This handles cases where the enrichment enqueue silently failed
                # or where the race condition caused the enrichment record to be lost
                logger.info("Checking for orphaned videos (completed but no enrichment record)...")
                orphaned_result = await db.execute(
                    text("""
                        SELECT v.id FROM videos v
                        LEFT JOIN video_enrichments e ON e.video_id = v.id
                        WHERE v.processing_status = 'completed' AND e.id IS NULL
                    """)
                )
                rows = orphaned_result.fetchall()
                logger.info(f"Orphan query returned {len(rows)} rows")
                orphaned_video_ids = [str(row[0]) for row in rows]

                if orphaned_video_ids:
                    logger.info(f"Found {len(orphaned_video_ids)} completed videos without enrichment records")
                    for video_id in orphaned_video_ids:
                        try:
                            await arq_redis.enqueue_job("enrich_video", video_id)
                            logger.info(f"Enqueued enrichment for orphaned video {video_id}")
                        except Exception as e:
                            logger.warning(f"Failed to enqueue enrichment for orphaned video {video_id}: {e}")

            finally:
                await sessionmanager.scoped_session.remove()
                db_session_context.set(None)
        except Exception as e:
            logger.warning(f"Failed to recover enrichments: {e}")

    logger.info("ARQ worker startup complete")


async def recover_failed_enrichments(ctx: dict) -> dict:
    """
    Periodic job to retry failed enrichments.

    Finds enrichments that failed due to transient errors (e.g., YouTube API issues)
    and re-enqueues them for retry, up to MAX_ENRICHMENT_RETRIES attempts.

    Runs every 5 minutes via cron.
    """
    if not settings.enrichment_enabled:
        return {"status": "skipped", "reason": "enrichment disabled"}

    try:
        db_session_context.set("recover_failed_enrichments")
        db = sessionmanager.get_session()
        arq_redis: ArqRedis = ctx['redis']

        try:
            # Find failed enrichments that haven't exceeded retry limit
            result = await db.execute(
                select(VideoEnrichment)
                .where(VideoEnrichment.status == EnrichmentStatus.failed.value)
                .where(VideoEnrichment.retry_count < MAX_ENRICHMENT_RETRIES)
            )
            failed_enrichments = result.scalars().all()

            if not failed_enrichments:
                logger.debug("No failed enrichments to retry")
                return {"status": "ok", "retried": 0}

            logger.info(f"Found {len(failed_enrichments)} failed enrichments to retry")

            retried = 0
            for enrichment in failed_enrichments:
                try:
                    # Reset status to pending and increment retry count
                    await db.execute(
                        update(VideoEnrichment)
                        .where(VideoEnrichment.id == enrichment.id)
                        .values(
                            status=EnrichmentStatus.pending.value,
                            retry_count=enrichment.retry_count + 1,
                            error_message=None,
                            progress_message=f"Retry {enrichment.retry_count + 1}/{MAX_ENRICHMENT_RETRIES}"
                        )
                    )

                    # Enqueue the enrichment job
                    job = await arq_redis.enqueue_job("enrich_video", str(enrichment.video_id))
                    if job:
                        logger.info(
                            f"Retrying enrichment for video {enrichment.video_id} "
                            f"(attempt {enrichment.retry_count + 1}/{MAX_ENRICHMENT_RETRIES})"
                        )
                        retried += 1
                    else:
                        logger.warning(
                            f"Failed to enqueue retry for video {enrichment.video_id} - "
                            f"job may already exist"
                        )
                except Exception as e:
                    logger.warning(f"Failed to retry enrichment {enrichment.id}: {e}")

            await db.commit()
            logger.info(f"Retried {retried} failed enrichments")
            return {"status": "ok", "retried": retried}

        finally:
            await sessionmanager.scoped_session.remove()
            db_session_context.set(None)

    except Exception as e:
        logger.error(f"Failed to recover failed enrichments: {e}")
        return {"status": "error", "message": str(e)}


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
            try:
                await db.rollback()
                logger.debug(f"Job {job_id} failed - rolled back transaction")
            except Exception:
                # Transaction may have already been rolled back or not started
                pass

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

    # Parse database number with same logic as redis.py (check query params first, then path)
    query_params = parse_qs(redis_dsn.query)
    if 'db' in query_params and query_params['db']:
        redis_db = int(query_params['db'][0])
    else:
        # Fall back to path (e.g., /5)
        db_str = redis_dsn.path.lstrip('/') if redis_dsn.path else ''
        redis_db = int(db_str) if db_str.isdigit() else 0

    redis_settings = RedisSettings(
        host=redis_dsn.hostname or 'localhost',
        port=redis_dsn.port or 6379,
        database=redis_db,
        password=redis_dsn.password,
    )

    # Worker functions
    functions = [process_video, process_video_list, enrich_video, enrich_video_staged, recover_failed_enrichments]

    # Cron jobs - periodic tasks
    # Retry failed enrichments every 5 minutes
    cron_jobs = [
        cron(recover_failed_enrichments, minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55})
    ]

    # Worker configuration
    # Allows concurrent processing for video imports while enrichment uses
    # internal rate limiting (see EnrichmentService._youtube_semaphore)
    max_jobs = 10
    job_timeout = 300  # 5 minutes
    keep_result = 3600  # 1 hour

    # Lifecycle hooks
    on_startup = startup
    on_shutdown = shutdown
    on_job_start = on_job_start
    after_job_end = after_job_end
