"""Pydantic schemas for Transcript Search API."""
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SearchResult(BaseModel):
    """Single search result with video info and matching snippet."""
    video_id: UUID = Field(..., description="Video UUID")
    list_id: UUID = Field(..., description="List UUID the video belongs to")
    youtube_id: str = Field(..., description="YouTube video ID")
    title: Optional[str] = Field(None, description="Video title")
    channel: Optional[str] = Field(None, description="Channel name")
    thumbnail_url: Optional[str] = Field(None, description="Video thumbnail URL")
    duration: Optional[int] = Field(None, description="Video duration in seconds")
    snippet: str = Field(..., description="Text snippet with search match")
    rank: float = Field(..., description="Search relevance score")

    model_config = {"from_attributes": True}


class SearchResponse(BaseModel):
    """Paginated search results."""
    results: List[SearchResult] = Field(..., description="List of search results")
    total: int = Field(..., description="Total number of matching results")
    limit: int = Field(..., description="Maximum results per page")
    offset: int = Field(..., description="Current page offset")
    query: str = Field(..., description="Original search query")
