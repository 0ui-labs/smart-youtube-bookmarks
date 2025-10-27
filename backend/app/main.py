"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with CORS middleware
and provides the health check endpoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import lists, videos, processing

app = FastAPI(title="Smart YouTube Bookmarks")

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


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
