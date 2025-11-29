"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with CORS middleware
and provides the health check endpoint.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import lists, videos, processing, websocket, tags, custom_fields, schemas, schema_fields, analytics, channels, enrichment, search
from app.core.redis import close_redis_client, close_arq_pool, get_arq_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
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

Currently uses a hardcoded user_id for development. Production deployment requires proper authentication.
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

# Register routers
app.include_router(lists.router)
app.include_router(videos.router)
app.include_router(processing.router)
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
app.include_router(tags.router)
app.include_router(custom_fields.router)
app.include_router(schemas.router)
app.include_router(schema_fields.router)
app.include_router(analytics.router)
app.include_router(channels.router)
app.include_router(enrichment.router)
app.include_router(search.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
