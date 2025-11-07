"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with CORS middleware
and provides the health check endpoint.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import lists, videos, processing, websocket, tags, custom_fields
from app.core.redis import close_redis_client, close_arq_pool, get_arq_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events for the application.
    Manages Redis client and ARQ pool lifecycle.
    """
    # Startup: Initialize ARQ pool eagerly (not lazy on first request)
    await get_arq_pool()
    yield
    # Shutdown: Close both Redis client and ARQ pool
    await close_redis_client()
    await close_arq_pool()


app = FastAPI(title="Smart YouTube Bookmarks", lifespan=lifespan)

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


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
