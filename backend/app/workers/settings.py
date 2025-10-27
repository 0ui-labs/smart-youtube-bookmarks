from arq.connections import RedisSettings
from app.core.config import settings
from .video_processor import process_video


class WorkerSettings:
    """ARQ Worker configuration with 2025 best practices."""

    # Redis connection with pooling
    redis_settings = RedisSettings(
        host=settings.redis_url.split("://")[1].split(":")[0] if "://" in settings.redis_url else "localhost",
        port=int(settings.redis_url.split(":")[-1]) if ":" in settings.redis_url.split("://")[1] else 6379,
        max_connections=20,  # Connection pool limit (2x max_jobs)
        conn_retries=5,
        conn_retry_delay=1
    )

    # Task registration
    functions = [process_video]

    # Worker performance
    max_jobs = 10  # Process up to 10 videos in parallel
    job_timeout = 600  # 10 minutes (increased from plan's 5min for long videos)
    keep_result = 3600  # Keep results for 1 hour
    poll_delay = 0.5

    # Retry configuration
    max_tries = 5
    retry_jobs = True

    # Health monitoring
    health_check_interval = 60  # Check every minute (not default 1 hour)
    health_check_key = "arq:youtube:health"

    # Graceful shutdown
    allow_abort_jobs = True
