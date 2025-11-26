"""Transcript Search API endpoints.

Implements full-text search across video transcripts using PostgreSQL.
"""
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.video import Video
from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus
from app.schemas.search import SearchResponse, SearchResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=SearchResponse)
async def search_transcripts(
    q: str = Query(..., min_length=1, description="Search query"),
    list_id: Optional[UUID] = Query(None, description="Filter by list ID"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    """
    Search video transcripts using full-text search.

    Uses PostgreSQL's full-text search capabilities (plainto_tsquery).
    Returns videos with matching transcript text, sorted by relevance.

    Args:
        q: Search query string
        list_id: Optional list filter
        limit: Max results per page (1-100)
        offset: Pagination offset

    Returns:
        SearchResponse with paginated results and total count
    """
    # Build the search query using PostgreSQL full-text search
    # plainto_tsquery handles phrase search better than to_tsquery
    search_query = func.plainto_tsquery('english', q)

    # Create a tsvector from transcript_text
    ts_vector = func.to_tsvector('english', VideoEnrichment.transcript_text)

    # Headline for snippet with search term highlighting
    headline = func.ts_headline(
        'english',
        VideoEnrichment.transcript_text,
        search_query,
        'MaxWords=35, MinWords=15, HighlightAll=false'
    )

    # Relevance rank
    rank = func.ts_rank(ts_vector, search_query)

    # Base query - join video with completed enrichment
    base_query = (
        select(
            Video.id.label('video_id'),
            Video.list_id,
            Video.youtube_id,
            Video.title,
            Video.channel,
            Video.thumbnail_url,
            Video.duration,
            headline.label('snippet'),
            rank.label('rank'),
        )
        .join(VideoEnrichment, VideoEnrichment.video_id == Video.id)
        .where(
            VideoEnrichment.status == EnrichmentStatus.completed.value,
            VideoEnrichment.transcript_text.isnot(None),
            ts_vector.op('@@')(search_query),
        )
    )

    # Apply list filter if provided
    if list_id:
        base_query = base_query.where(Video.list_id == list_id)

    # Count total results
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply ordering, limit, and offset
    results_query = (
        base_query
        .order_by(rank.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(results_query)
    rows = result.all()

    # Convert to response
    results = [
        SearchResult(
            video_id=row.video_id,
            list_id=row.list_id,
            youtube_id=row.youtube_id,
            title=row.title,
            channel=row.channel,
            thumbnail_url=row.thumbnail_url,
            duration=row.duration,
            snippet=row.snippet or "",
            rank=float(row.rank) if row.rank else 0.0,
        )
        for row in rows
    ]

    return SearchResponse(
        results=results,
        total=total,
        limit=limit,
        offset=offset,
        query=q,
    )
