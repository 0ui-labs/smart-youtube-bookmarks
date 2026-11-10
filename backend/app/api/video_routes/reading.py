"""Video reading endpoints."""

import logging
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.helpers.field_union import (
    get_available_fields_for_video,
)
from app.core.database import get_db
from app.models.channel import Channel
from app.models.list import BookmarkList
from app.models.tag import Tag
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.schemas.video import (
    AvailableFieldResponse,
    VideoFilterRequest,
    VideoResponse,
)
from app.services.video_query_service import (
    query_all_videos,
    query_filtered_videos,
    query_videos_in_list,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/lists/{list_id}/videos", response_model=list[VideoResponse])
async def get_videos_in_list(
    list_id: UUID,
    tags: Annotated[list[str] | None, Query(max_length=10)] = None,
    sort_by: str | None = Query(
        None,
        description="Sort column: 'title', 'duration', 'created_at', 'channel', or 'field:<field_id>'",
    ),
    sort_order: Literal["asc", "desc"] | None = Query(
        "asc", description="Sort direction"
    ),
    db: AsyncSession = Depends(get_db),
) -> list[Video]:
    return await query_videos_in_list(
        list_id=list_id, tags=tags, sort_by=sort_by, sort_order=sort_order, db=db
    )


@router.post("/lists/{list_id}/videos/filter", response_model=list[VideoResponse])
async def filter_videos_in_list(
    list_id: UUID,
    filter_request: VideoFilterRequest,
    db: AsyncSession = Depends(get_db),
) -> list[Video]:
    return await query_filtered_videos(
        list_id=list_id, filter_request=filter_request, db=db
    )


@router.get("/videos/{video_id}", response_model=VideoResponse)
async def get_video_by_id(video_id: UUID, db: AsyncSession = Depends(get_db)) -> Video:
    """
    Get single video with complete field information (detail view).

    Returns:
    - field_values: ALL available fields with their current values (null if unfilled)
    - available_fields: Field metadata for all editable fields (name, type, config)

    Note: field_values includes ALL applicable fields (from video's tags),
    with value=None for fields that haven't been filled yet. This allows
    the frontend to render all editable fields in the detail modal.

    Use Case: Modal/Detail view where user can see and edit all fields.
    """
    # Step 1: Load video (field_values and tags loaded separately below)
    stmt = select(Video).where(Video.id == video_id)
    result = await db.execute(stmt)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    # Step 2A: Load field_values manually (workaround for SQLAlchemy relationship loading issue)
    # BUG #004 FIX: SQLAlchemy sometimes returns a single VideoFieldValue object instead of a list
    # Loading field_values explicitly with eager loading ensures we always get a proper list

    field_values_stmt = (
        select(VideoFieldValue)
        .where(VideoFieldValue.video_id == video_id)
        .options(selectinload(VideoFieldValue.field))
    )
    field_values_result = await db.execute(field_values_stmt)
    field_values_list = list(field_values_result.scalars().all())
    video.__dict__["field_values"] = field_values_list

    # Step 2B: Load tags manually (workaround for SQLAlchemy many-to-many loading issue)
    # SQLAlchemy sometimes returns a single Tag object instead of a list for many-to-many relationships
    # Loading tags explicitly ensures we always get a proper list
    from app.models.tag import video_tags as video_tags_table

    tags_stmt = (
        select(Tag)
        .join(video_tags_table, Tag.id == video_tags_table.c.tag_id)
        .where(video_tags_table.c.video_id == video_id)
    )
    tags_result = await db.execute(tags_stmt)
    tags_list = list(tags_result.scalars().all())
    video.__dict__["tags"] = tags_list

    # Step 2C: Load parent list (for Two-Layer Field System: workspace fields from list.default_schema_id)
    list_stmt = select(BookmarkList).where(BookmarkList.id == video.list_id)
    list_result = await db.execute(list_stmt)
    parent_list = list_result.scalar_one_or_none()
    video.__dict__["list"] = parent_list

    # Step 3: Get available fields using helper module
    available_fields_tuples = await get_available_fields_for_video(video, db)

    # Step 4: Convert tuples to AvailableFieldResponse objects
    available_fields = [
        AvailableFieldResponse(
            field_id=field.id,
            field_name=schema_name + ": " + field.name if schema_name else field.name,
            field_type=field.field_type,
            schema_name=schema_name,
            display_order=display_order,
            show_on_card=show_on_card,
            config=field.config or {},
        )
        for field, schema_name, display_order, show_on_card in available_fields_tuples
    ]

    # Step 5: Build field_values response (similar to list endpoint logic)
    # FIX BUG #003: Only include fields that have actual values
    # - available_fields shows ALL fields that CAN be filled
    # - field_values shows ONLY fields that HAVE been filled
    # Note: field_values_list already loaded in Step 2A above
    values_by_field_id = {fv.field_id: fv for fv in field_values_list}

    field_values_response = []
    for field, schema_name, display_order, show_on_card in available_fields_tuples:
        field_value = values_by_field_id.get(field.id)

        # Only include fields that have values (not None)
        if field_value:
            # Extract value based on field type
            value = None
            if field.field_type == "rating":
                value = field_value.value_numeric
            elif field.field_type in ("select", "text"):
                value = field_value.value_text
            elif field.field_type == "boolean":
                value = field_value.value_boolean

            field_values_response.append(
                {
                    "id": field_value.id,  # No longer needs conditional - field_value is guaranteed to exist
                    "video_id": video.id,
                    "field_id": field.id,
                    "field_name": field.name,
                    "field": field,
                    "value": value,
                    "schema_name": schema_name,
                    "show_on_card": show_on_card,
                    "display_order": display_order,
                    "updated_at": field_value.updated_at,  # No longer needs conditional
                }
            )

    # Step 6: Manually construct response dict (workaround for Pydantic ORM serialization)
    # Returning the Video ORM object directly causes ResponseValidationError during serialization
    # Constructing a dict manually with properly serialized tags avoids this issue
    tags_dicts = [
        {
            "id": tag.id,
            "name": tag.name,
            "color": tag.color,
            "user_id": tag.user_id,
            "schema_id": tag.schema_id,
            "created_at": tag.created_at,
            "updated_at": tag.updated_at,
        }
        for tag in tags_list
    ]

    # Load channel thumbnail for this video
    channel_thumbnail_url = None
    if video.channel_id:
        channel_stmt = select(Channel).where(Channel.id == video.channel_id)
        channel_result = await db.execute(channel_stmt)
        channel = channel_result.scalar_one_or_none()
        if channel:
            channel_thumbnail_url = channel.thumbnail_url
    elif video.channel:
        # Fallback: try to find channel by name
        channel_stmt = select(Channel).where(Channel.name == video.channel)
        channel_result = await db.execute(channel_stmt)
        channel = channel_result.scalar_one_or_none()
        if channel:
            channel_thumbnail_url = channel.thumbnail_url

    return {
        "id": video.id,
        "list_id": video.list_id,
        "youtube_id": video.youtube_id,
        "title": video.title,
        "channel": video.channel,
        "channel_thumbnail_url": channel_thumbnail_url,
        "duration": video.duration,
        "published_at": video.published_at,
        "thumbnail_url": video.thumbnail_url,
        "extracted_data": video.extracted_data,
        "processing_status": video.processing_status,
        "error_message": video.error_message,
        "created_at": video.created_at,
        "updated_at": video.updated_at,
        "watch_position": video.watch_position,
        "watch_position_updated_at": video.watch_position_updated_at,
        "tags": tags_dicts,
        "available_fields": available_fields,
        "field_values": field_values_response,
    }


@router.get("/videos", response_model=list[VideoResponse])
async def list_all_videos(
    tags: Annotated[list[str] | None, Query(max_length=10)] = None,
    tags_all: Annotated[list[str] | None, Query(max_length=10)] = None,
    db: AsyncSession = Depends(get_db),
) -> list[Video]:
    return await query_all_videos(tags=tags, tags_all=tags_all, db=db)
