"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with CORS middleware
and provides the health check endpoint.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    analytics,
    auth,
    channels,
    chat,
    custom_fields,
    enrichment,
    lists,
    processing,
    schema_fields,
    schemas,
    search,
    subscriptions,
    tags,
    videos,
    webhooks,
    websocket,
)
from app.core.database import require_api_session
from app.core.redis import close_arq_pool, close_redis_client, get_arq_pool
from app.core.ticket_redaction import TicketRedactionMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Application lifespan manager.

    Handles startup and shutdown events for the application.
    Manages Redis client and ARQ pool lifecycle.
    """
    # Startup: Initialize ARQ pool eagerly (not lazy on first request)
    # If Redis is unavailable, log warning and continue in degraded mode
    import logging

    logger = logging.getLogger(__name__)

    try:
        await get_arq_pool()
    except Exception as e:
        logger.warning(
            f"Failed to connect to Redis on startup: {e}. "
            "Background job processing will be unavailable."
        )

    yield

    # Shutdown: Close both Redis client and ARQ pool
    await close_redis_client()
    await close_arq_pool()


app = FastAPI(
    title="Smart YouTube Bookmarks API",
    description="""
API for managing YouTube video collections with custom fields, real-time processing, and video enrichment.

## Features

- **Lists** – Create and manage video collections
- **Videos** – Add, import (CSV), export, and manage videos
- **Custom Fields** – Define rating, select, text, and boolean fields
- **Field Schemas** – Create reusable field templates
- **Channels** – Auto-created from video metadata
- **Tags** – Organize videos with custom tags
- **Enrichment** – Transcripts and AI-powered metadata
- **Real-Time Progress** – WebSocket-based import tracking

## Authentication

Business routes require a verified Clerk session and enforce user ownership.
    """,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redact connection credentials before the server logs accept/reject.
app.add_middleware(TicketRedactionMiddleware)

# Register routers
app.include_router(auth.router, dependencies=[Depends(require_api_session)])
app.include_router(lists.router, dependencies=[Depends(require_api_session)])
app.include_router(videos.router, dependencies=[Depends(require_api_session)])
app.include_router(processing.router, dependencies=[Depends(require_api_session)])
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
app.include_router(tags.router, dependencies=[Depends(require_api_session)])
app.include_router(custom_fields.router, dependencies=[Depends(require_api_session)])
app.include_router(schemas.router, dependencies=[Depends(require_api_session)])
app.include_router(schema_fields.router, dependencies=[Depends(require_api_session)])
app.include_router(analytics.router, dependencies=[Depends(require_api_session)])
app.include_router(channels.router, dependencies=[Depends(require_api_session)])
app.include_router(enrichment.router, dependencies=[Depends(require_api_session)])
app.include_router(search.router, dependencies=[Depends(require_api_session)])
app.include_router(subscriptions.router, dependencies=[Depends(require_api_session)])
app.include_router(chat.router, dependencies=[Depends(require_api_session)])
app.include_router(webhooks.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/ready", response_model=dict[str, bool])
async def readiness_check(response: Response) -> dict[str, bool]:
    from app.core.readiness import readiness_status

    status = await readiness_status()
    response.status_code = 200 if all(status.values()) else 503
    return status
