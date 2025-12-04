"""ARQ worker configuration with lifecycle hooks."""

import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

from arq.connections import ArqRedis, RedisSettings
from arq.cron import cron
from arq.jobs import Job
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.video import Video
from app.models.video_enrichment import EnrichmentStatus, VideoEnrichment
from app.workers.db_manager import db_session_context, sessionmanager
from app.workers.enrichment_worker import enrich_video
from app.workers.subscription_worker import process_pubsub_notification, renew_pubsub_leases
from app.workers.video_processor import process_video, process_video_list

logger = logging.getLogger(__name__)

# Maximum retry attempts for failed enrichments
MAX_ENRICHMENT_RETRIES = 3

# Threshold for considering a pending video as "stuck" (in minutes)
STUCK_VIDEO_THRESHOLD_MINUTES = 5

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
            arq_redis: ArqRedis = ctx["redis"]
            try:
                # Case 1: Recover pending enrichments (existing logic)
                result = await db.execute(
                    select(VideoEnrichment).where(
                        VideoEnrichment.status == EnrichmentStatus.pending.value
                    )
                )
                pending = result.scalars().all()

                if pending:
                    logger.info(f"Found {len(pending)} pending enrichments to recover")
                    for enrichment in pending:
                        try:
                            await arq_redis.enqueue_job(
                                "enrich_video", str(enrichment.video_id)
                            )
                            logger.info(
                                f"Recovered pending enrichment for video {enrichment.video_id}"
                            )
                        except Exception as e:
                            logger.warning(
                                f"Failed to enqueue pending enrichment {enrichment.video_id}: {e}"
                            )

                # Case 2: Find completed videos with NO enrichment record
                # This handles cases where the enrichment enqueue silently failed
                # or where the race condition caused the enrichment record to be lost
                logger.info(
                    "Checking for orphaned videos (completed but no enrichment record)..."
                )
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
                    logger.info(
                        f"Found {len(orphaned_video_ids)} completed videos without enrichment records"
                    )
                    for video_id in orphaned_video_ids:
                        try:
                            await arq_redis.enqueue_job("enrich_video", video_id)
                            logger.info(
                                f"Enqueued enrichment for orphaned video {video_id}"
                            )
                        except Exception as e:
                            logger.warning(
                                f"Failed to enqueue enrichment for orphaned video {video_id}: {e}"
                            )

            finally:
                await sessionmanager.scoped_session.remove()
                db_session_context.set(None)
        except Exception as e:
            logger.warning(f"Failed to recover enrichments: {e}")

    # Recovery: Find videos stuck in 'pending' processing status
    # These are videos whose processing jobs were lost due to worker crash/restart
    try:
        db_session_context.set("startup_stuck_videos")
        db = sessionmanager.get_session()
        arq_redis: ArqRedis = ctx["redis"]

        try:
            # Find videos stuck in pending for more than threshold
            threshold_time = datetime.now(UTC) - timedelta(
                minutes=STUCK_VIDEO_THRESHOLD_MINUTES
            )

            result = await db.execute(
                select(Video)
                .where(Video.processing_status == "pending")
                .where(Video.updated_at < threshold_time)
            )
            stuck_videos = result.scalars().all()

            if stuck_videos:
                logger.info(
                    f"Found {len(stuck_videos)} stuck videos to recover on startup"
                )
                for video in stuck_videos:
                    try:
                        await arq_redis.enqueue_job(
                            "process_video",
                            str(video.id),
                            str(video.list_id),
                            None,
                            None,
                        )
                        logger.info(
                            f"Recovered stuck video {video.id} (youtube_id={video.youtube_id})"
                        )
                    except Exception as e:
                        logger.warning(f"Failed to enqueue stuck video {video.id}: {e}")

        finally:
            await sessionmanager.scoped_session.remove()
            db_session_context.set(None)
    except Exception as e:
        logger.warning(f"Failed to recover stuck videos on startup: {e}")

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
        arq_redis: ArqRedis = ctx["redis"]

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
                            progress_message=f"Retry {enrichment.retry_count + 1}/{MAX_ENRICHMENT_RETRIES}",
                        )
                    )

                    # Enqueue the enrichment job
                    job = await arq_redis.enqueue_job(
                        "enrich_video", str(enrichment.video_id)
                    )
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


async def recover_stuck_videos(ctx: dict) -> dict:
    """
    Periodic job to recover videos stuck in 'pending' processing status.

    Finds videos that have processing_status='pending' but haven't been updated
    in STUCK_VIDEO_THRESHOLD_MINUTES, indicating their processing job was lost
    (e.g., worker crash/restart).

    Re-enqueues them as process_video jobs for retry.

    Runs every 5 minutes via cron.
    """
    try:
        db_session_context.set("recover_stuck_videos")
        db = sessionmanager.get_session()
        arq_redis: ArqRedis = ctx["redis"]

        try:
            # Find videos stuck in pending status older than threshold
            threshold_time = datetime.now(UTC) - timedelta(
                minutes=STUCK_VIDEO_THRESHOLD_MINUTES
            )

            result = await db.execute(
                select(Video)
                .where(Video.processing_status == "pending")
                .where(Video.updated_at < threshold_time)
            )
            stuck_videos = result.scalars().all()

            if not stuck_videos:
                logger.debug("No stuck videos to recover")
                return {"status": "ok", "recovered": 0}

            logger.info(f"Found {len(stuck_videos)} stuck videos to recover")

            recovered = 0
            for video in stuck_videos:
                try:
                    # Re-enqueue as process_video job
                    # Pass None for schema and job_id since recovery doesn't need parent job
                    job = await arq_redis.enqueue_job(
                        "process_video",
                        str(video.id),
                        str(video.list_id),
                        None,  # schema - not needed for basic processing
                        None,  # job_id - no parent processing job
                    )

                    if job:
                        logger.info(
                            f"Recovered stuck video {video.id} "
                            f"(youtube_id={video.youtube_id}, stuck since {video.updated_at})"
                        )
                        recovered += 1
                    else:
                        logger.warning(
                            f"Failed to enqueue recovery for video {video.id} - "
                            f"job may already exist"
                        )
                except Exception as e:
                    logger.warning(f"Failed to recover video {video.id}: {e}")

            logger.info(f"Recovered {recovered} stuck videos")
            return {"status": "ok", "recovered": recovered}

        finally:
            await sessionmanager.scoped_session.remove()
            db_session_context.set(None)

    except Exception as e:
        logger.error(f"Failed to recover stuck videos: {e}")
        return {"status": "error", "message": str(e)}


async def shutdown(ctx: dict | None) -> None:
    """Cleanup worker resources on shutdown."""
    logger.info("ARQ worker shutting down")
    await sessionmanager.disconnect()
    logger.info("ARQ worker shutdown complete")


async def on_job_start(ctx: dict) -> None:
    """Set job-specific context before job execution."""
    job_id = ctx.get("job_id", "unknown")
    logger.debug(f"Starting job {job_id}")

    # Set context variable for session scoping
    db_session_context.set(job_id)

    # Inject database session into job context
    ctx["db"] = sessionmanager.get_session()


async def after_job_end(ctx: dict) -> None:
    """Cleanup and commit/rollback after job completion."""
    job_id = ctx.get("job_id", "unknown")

    try:
        # Get job info to determine success/failure
        job = Job(job_id, ctx["redis"])
        job_info = await job.info()

        db: AsyncSession = ctx["db"]

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
            await ctx["db"].rollback()
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
    if query_params.get("db"):
        redis_db = int(query_params["db"][0])
    else:
        # Fall back to path (e.g., /5)
        db_str = redis_dsn.path.lstrip("/") if redis_dsn.path else ""
        redis_db = int(db_str) if db_str.isdigit() else 0

    redis_settings = RedisSettings(
        host=redis_dsn.hostname or "localhost",
        port=redis_dsn.port or 6379,
        database=redis_db,
        password=redis_dsn.password,
    )

    # Worker functions
    functions = [
        process_video,
        process_video_list,
        enrich_video,
        recover_failed_enrichments,
        recover_stuck_videos,
        process_pubsub_notification,
        renew_pubsub_leases,
    ]

    # Cron jobs - periodic tasks
    # Retry failed enrichments every 5 minutes
    # Recover stuck videos every 5 minutes (offset by 2 min to avoid collision)
    # Renew PubSubHubbub leases every 12 hours (00:00 and 12:00)
    cron_jobs = [
        cron(
            recover_failed_enrichments,
            minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55},
        ),
        cron(
            recover_stuck_videos, minute={2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57}
        ),
        cron(
            renew_pubsub_leases, hour={0, 12}, minute=0
        ),
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
