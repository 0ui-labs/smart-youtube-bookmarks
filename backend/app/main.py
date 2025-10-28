"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with CORS middleware
and provides the health check endpoint.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import lists, videos, processing, websocket
from app.core.redis import close_redis_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events for the application.
    Currently manages Redis connection lifecycle.
    """
    # Startup: nothing to do yet
    yield
    # Shutdown: close Redis connection
    await close_redis_client()


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


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
