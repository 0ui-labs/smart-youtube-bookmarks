"""One collection selection contract with page-limited batch hydration."""

import logging
from collections.abc import Sequence
from typing import Any, Literal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import (
    InstrumentedAttribute,
    aliased,
    selectinload,
)
from sqlalchemy.sql import Select

from app.api.helpers.field_union import get_available_fields_for_videos
from app.core.orm_loading import load_committed_relationship
from app.models.channel import Channel
from app.models.custom_field import CustomField
from app.models.list import BookmarkList
from app.models.tag import Tag, video_tags
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.schemas.video import FieldFilterOperator, VideoFilterRequest, VideoResponse

logger = logging.getLogger(__name__)


async def _load_channel_thumbnails(videos: Sequence[Video], db: AsyncSession) -> None:
    """
    Load channel thumbnails for all videos and assign to channel_thumbnail_url.

    This fetches all channels for the videos in a single query and assigns
    the thumbnail_url to each video's __dict__ for serialization.

    Falls back to matching by channel name if channel_id is not set.
    """
    if not videos:
        return

    # Get all unique channel_ids from videos
    channel_ids = list(set(v.channel_id for v in videos if v.channel_id))

    # Get all unique channel names for videos without channel_id
    channel_names = list(
        set(v.channel for v in videos if not v.channel_id and v.channel)
    )

    channels_by_id: dict[UUID, Channel] = {}
    channels_by_name: dict[str, Channel] = {}

    # Fetch channels by ID
    if channel_ids:
        channels_stmt = select(Channel).where(Channel.id.in_(channel_ids))
        channels_result = await db.execute(channels_stmt)
        channels_by_id = {c.id: c for c in channels_result.scalars().all()}

    # Fetch channels by name (fallback for videos without channel_id)
    if channel_names:
        channels_name_stmt = select(Channel).where(Channel.name.in_(channel_names))
        channels_name_result = await db.execute(channels_name_stmt)
        channels_by_name = {c.name: c for c in channels_name_result.scalars().all()}

    # Assign thumbnail_url to each video
    for video in videos:
        if video.channel_id and video.channel_id in channels_by_id:
            video.__dict__["channel_thumbnail_url"] = channels_by_id[
                video.channel_id
            ].thumbnail_url
        elif video.channel and video.channel in channels_by_name:
            video.__dict__["channel_thumbnail_url"] = channels_by_name[
                video.channel
            ].thumbnail_url
        else:
            video.__dict__["channel_thumbnail_url"] = None


async def _apply_sorting(
    stmt: Select[Any], sort_by: str | None, sort_order: str, db: AsyncSession
) -> Select[Any]:
    """
    Apply sorting to a video query statement.

    Handles both standard column sorting and custom field sorting.
    Uses NULLS LAST for both ASC and DESC to ensure sorted values appear first.

    Args:
        stmt: SQLAlchemy Select statement
        sort_by: Column or field to sort by (format: "field:<uuid>" for custom fields)
        sort_order: "asc" or "desc"
        db: Database session for field lookup

    Returns:
        Modified Select statement with sorting applied

    Raises:
        HTTPException: If sort_by is invalid or field not found
    """
    stmt = stmt.order_by(None)
    if not sort_by:
        # Default sorting: created_at descending (newest first)
        return stmt.order_by(desc(Video.created_at), Video.id)

    if sort_by.startswith("field:"):
        # Field-based sorting
        field_id_str = sort_by.split(":", 1)[1]
        try:
            field_id = UUID(field_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid field_id in sort_by parameter",
            )

        # Validate field exists
        field_result = await db.execute(
            select(CustomField).where(CustomField.id == field_id)
        )
        field = field_result.scalar_one_or_none()
        if not field:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Custom field not found"
            )

        # LEFT JOIN to video_field_values and sort by typed column
        stmt = stmt.outerjoin(
            VideoFieldValue,
            and_(
                VideoFieldValue.video_id == Video.id,
                VideoFieldValue.field_id == field_id,
            ),
        )

        sort_column: InstrumentedAttribute[Any]
        # Determine sort column based on field type
        if field.field_type == "rating":
            sort_column = VideoFieldValue.value_numeric
        elif field.field_type in ("select", "text"):
            sort_column = VideoFieldValue.value_text
        elif field.field_type == "boolean":
            sort_column = VideoFieldValue.value_boolean
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported field type: {field.field_type}",
            )

        # Apply ORDER BY with explicit NULL handling
        # CRITICAL: Use .nulls_last() for BOTH asc AND desc
        # Rationale: Users always want sorted values first, empty values last
        if sort_order == "desc":
            stmt = stmt.order_by(desc(sort_column).nulls_last())
        else:
            stmt = stmt.order_by(asc(sort_column).nulls_last())

    else:
        # Standard column sorting (title, duration, created_at, channel)
        valid_columns: dict[str, InstrumentedAttribute[Any]] = {
            "title": Video.title,
            "duration": Video.duration,
            "created_at": Video.created_at,
            "channel": Video.channel,
        }

        if sort_by not in valid_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sort_by column: {sort_by}. Valid options: {', '.join(valid_columns.keys())}",
            )

        sort_column = valid_columns[sort_by]
        # Apply nulls_last for both directions on standard columns too
        if sort_order == "desc":
            stmt = stmt.order_by(desc(sort_column).nulls_last())
        else:
            stmt = stmt.order_by(asc(sort_column).nulls_last())

    return stmt.order_by(Video.id)


async def build_video_selection(
    db: AsyncSession, list_id: UUID, filter_request: VideoFilterRequest
) -> Select[Any]:
    if (
        await db.execute(select(BookmarkList.id).where(BookmarkList.id == list_id))
    ).scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Resource not found")
    field_ids = {item.field_id for item in filter_request.field_filters or []}
    if filter_request.sort_by and filter_request.sort_by.startswith("field:"):
        try:
            field_ids.add(UUID(filter_request.sort_by.removeprefix("field:")))
        except ValueError as error:
            raise HTTPException(
                status_code=400, detail="Invalid field_id in sort_by parameter"
            ) from error
    if field_ids:
        owned = set(
            (
                await db.execute(
                    select(CustomField.id).where(
                        CustomField.id.in_(field_ids), CustomField.list_id == list_id
                    )
                )
            )
            .scalars()
            .all()
        )
        if owned != field_ids:
            raise HTTPException(status_code=404, detail="Resource not found")
    # Step 2: Build base query
    stmt = select(Video).where(Video.list_id == list_id)

    # Step 3: Apply tag filtering (OR logic) - case-insensitive exact match
    if filter_request.tags and len(filter_request.tags) > 0:
        # Normalize tag names: strip whitespace and lowercase
        normalized_tags = [
            tag.strip().lower() for tag in filter_request.tags if tag and tag.strip()
        ]

        if normalized_tags:
            # Join to tags and filter by exact case-insensitive match using func.lower
            stmt = stmt.where(Video.tags.any(func.lower(Tag.name).in_(normalized_tags)))

    # Step 3.5: Apply channel filtering (YouTube Channels feature)
    if filter_request.channel_id:
        try:
            channel_uuid = UUID(filter_request.channel_id)
            stmt = stmt.where(Video.channel_id == channel_uuid)
        except ValueError as err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid channel_id format: {filter_request.channel_id}",
            ) from err

    # Step 4: Apply field filtering (AND logic)
    if filter_request.field_filters and len(filter_request.field_filters) > 0:
        # IMPORTANT: Use aliased() for multiple field filters to avoid JOIN conflicts
        for field_filter in filter_request.field_filters:
            # Create unique alias for this field filter
            vfv_alias = aliased(VideoFieldValue)

            # Join to video_field_values with field_id constraint
            stmt = stmt.join(
                vfv_alias,
                and_(
                    vfv_alias.video_id == Video.id,
                    vfv_alias.field_id == field_filter.field_id,
                ),
            )

            # Apply operator-specific filtering
            operator = field_filter.operator

            if operator == FieldFilterOperator.EQ:
                # Equal to (numeric)
                stmt = stmt.where(vfv_alias.value_numeric == field_filter.value)

            elif operator == FieldFilterOperator.GT:
                # Greater than (numeric)
                stmt = stmt.where(vfv_alias.value_numeric > field_filter.value)

            elif operator == FieldFilterOperator.GTE:
                # Greater than or equal (numeric)
                stmt = stmt.where(vfv_alias.value_numeric >= field_filter.value)

            elif operator == FieldFilterOperator.LT:
                # Less than (numeric)
                stmt = stmt.where(vfv_alias.value_numeric < field_filter.value)

            elif operator == FieldFilterOperator.LTE:
                # Less than or equal (numeric)
                stmt = stmt.where(vfv_alias.value_numeric <= field_filter.value)

            elif operator == FieldFilterOperator.BETWEEN:
                # Between min and max (numeric)
                stmt = stmt.where(
                    and_(
                        vfv_alias.value_numeric >= field_filter.value_min,
                        vfv_alias.value_numeric <= field_filter.value_max,
                    )
                )

            elif operator == FieldFilterOperator.CONTAINS:
                # Text contains (case-insensitive) - Uses GIN index!
                # Escape special ILIKE characters (%, _, \) to prevent SQL injection
                escaped_value = (
                    str(field_filter.value)
                    .replace("\\", "\\\\")
                    .replace("%", "\\%")
                    .replace("_", "\\_")
                )
                stmt = stmt.where(vfv_alias.value_text.ilike(f"%{escaped_value}%"))

            elif operator == FieldFilterOperator.EXACT:
                # Exact match (case-sensitive)
                stmt = stmt.where(vfv_alias.value_text == field_filter.value)

            elif operator == FieldFilterOperator.IN:
                # One of (comma-separated values)
                # Validate value is string before calling split()
                if not isinstance(field_filter.value, str):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="IN operator requires comma-separated string value",
                    )
                # Parse comma-separated string into list
                values = [v.strip() for v in field_filter.value.split(",") if v.strip()]
                stmt = stmt.where(vfv_alias.value_text.in_(values))

            elif operator == FieldFilterOperator.IS:
                # Boolean is True/False
                stmt = stmt.where(vfv_alias.value_boolean == field_filter.value)

        # Use distinct() to prevent duplicates from multiple JOINs

    # Step 5: Apply sorting
    stmt = await _apply_sorting(
        stmt, filter_request.sort_by, filter_request.sort_order or "asc", db
    )

    return stmt


async def hydrate_videos(
    db: AsyncSession, videos: Sequence[Video]
) -> list[VideoResponse]:
    if not videos:
        return []
    # Load all tags for all videos in two queries (prevents N+1)
    # First, get video-tag associations
    video_ids = [video.id for video in videos]
    associations_stmt = select(video_tags).where(video_tags.c.video_id.in_(video_ids))
    associations_result = await db.execute(associations_stmt)
    associations = associations_result.all()

    # Get all unique tag IDs
    tag_ids = list(set(assoc.tag_id for assoc in associations))

    # Load all tags with schema relationship eagerly loaded
    if tag_ids:
        tags_stmt = (
            select(Tag)
            .options(
                selectinload(Tag.schema)
            )  # Eager load schema for FieldSchema relationship
            .where(Tag.id.in_(tag_ids))
        )
        tags_result = await db.execute(tags_stmt)
        tags_by_id = {tag.id: tag for tag in tags_result.scalars().all()}
    else:
        tags_by_id = {}

    # Group tags by video_id
    tags_by_video: dict[UUID, list[Tag]] = {}
    for assoc in associations:
        video_id = assoc.video_id
        tag_id = assoc.tag_id
        if video_id not in tags_by_video:
            tags_by_video[video_id] = []
        if tag_id in tags_by_id:
            tags_by_video[video_id].append(tags_by_id[tag_id])

    # Assign tags to videos
    for video in videos:
        load_committed_relationship(video, "tags", tags_by_video.get(video.id, []))

    parent_lists = (
        (
            await db.execute(
                select(BookmarkList).where(
                    BookmarkList.id.in_({video.list_id for video in videos})
                )
            )
        )
        .scalars()
        .all()
    )
    parents = {parent.id: parent for parent in parent_lists}
    for video in videos:
        load_committed_relationship(video, "list", parents.get(video.list_id))

    # === NEW: Batch-load applicable fields for ALL videos ===
    # ✅ REF #1: Single query for all videos
    applicable_fields_by_video = await get_available_fields_for_videos(videos, db)

    response_values: dict[UUID, list[dict[str, Any]]] = {}
    # Batch-load field values without replacing mapped relationships with DTOs.
    if video_ids:
        # Fetch all field values for all videos in one query
        field_values_stmt = (
            select(VideoFieldValue)
            .options(
                selectinload(VideoFieldValue.field)  # Eager load CustomField
            )
            .where(VideoFieldValue.video_id.in_(video_ids))
        )
        field_values_result = await db.execute(field_values_stmt)
        all_field_values = field_values_result.scalars().all()

        # Group field values by video_id
        field_values_by_video: dict[UUID, list[VideoFieldValue]] = {}
        for fv in all_field_values:
            if fv.video_id not in field_values_by_video:
                field_values_by_video[fv.video_id] = []
            field_values_by_video[fv.video_id].append(fv)

        # Build field_values response for each video
        for video in videos:
            # Get applicable fields (from batch-loaded data)
            applicable_fields = applicable_fields_by_video.get(video.id, [])

            # Get actual field values for this video
            video_field_values = field_values_by_video.get(video.id, [])
            values_by_field_id = {fv.field_id: fv for fv in video_field_values}

            # Build response list: applicable fields + their values (if set)
            # FIX BUG #003: Only include fields that have actual values (same as detail endpoint)
            # - available_fields shows ALL fields that CAN be filled
            # - field_values shows ONLY fields that HAVE been filled
            field_values_response = []
            for field, schema_name, display_order, show_on_card in applicable_fields:
                field_value = values_by_field_id.get(field.id)

                # Only include fields that have values (not None)
                if field_value:
                    # ✅ REF #3: Extract value based on field type (float not int)
                    value: float | str | bool | None = None
                    if field.field_type == "rating":
                        value = field_value.value_numeric  # Can be float
                    elif field.field_type in ("select", "text"):
                        value = field_value.value_text
                    elif field.field_type == "boolean":
                        value = field_value.value_boolean

                    # Create response dict (Pydantic will serialize)
                    field_values_response.append(
                        {
                            "id": field_value.id,  # No longer needs conditional - field_value is guaranteed to exist
                            "video_id": video.id,
                            "field_id": field.id,
                            "field_name": field.name,
                            "field": field,  # CustomField ORM object
                            "value": value,
                            "schema_name": schema_name,
                            "show_on_card": show_on_card,
                            "display_order": display_order,
                            "updated_at": field_value.updated_at,  # No longer needs conditional
                        }
                    )

            # Assign to video (FastAPI will serialize via VideoResponse schema)
            response_values[video.id] = field_values_response
    # Load channel thumbnails for all videos
    await _load_channel_thumbnails(videos, db)

    return [
        VideoResponse.model_validate(
            {
                **{
                    column.key: getattr(video, column.key)
                    for column in Video.__table__.columns
                },
                "tags": video.tags,
                "field_values": response_values.get(video.id, []),
                "channel_thumbnail_url": getattr(video, "channel_thumbnail_url", None),
            }
        )
        for video in videos
    ]


async def query_video_page(
    db: AsyncSession,
    list_id: UUID,
    filters: VideoFilterRequest,
    offset: int = 0,
    limit: int = 50,
) -> dict[str, Any]:
    if offset < 0 or not 1 <= limit <= 100:
        raise ValueError("Invalid page bounds")
    selection = await build_video_selection(db, list_id, filters)
    total = (
        await db.execute(
            select(func.count()).select_from(selection.order_by(None).subquery())
        )
    ).scalar_one()
    videos = (await db.execute(selection.offset(offset).limit(limit))).scalars().all()
    return {
        "items": await hydrate_videos(db, videos),
        "total": total,
        "offset": offset,
        "limit": limit,
    }


async def query_videos_in_list(
    db: AsyncSession,
    list_id: UUID,
    tags: list[str] | None = None,
    sort_by: str | None = None,
    sort_order: Literal["asc", "desc"] | None = "asc",
    offset: int = 0,
    limit: int = 100,
) -> list[VideoResponse]:
    selection = await build_video_selection(
        db,
        list_id,
        VideoFilterRequest.model_validate(
            {"tags": tags, "sort_by": sort_by, "sort_order": sort_order}
        ),
    )
    return await hydrate_videos(
        db, (await db.execute(selection.offset(offset).limit(limit))).scalars().all()
    )


async def query_filtered_videos(
    db: AsyncSession,
    list_id: UUID,
    filter_request: VideoFilterRequest,
    offset: int = 0,
    limit: int = 100,
) -> list[VideoResponse]:
    selection = await build_video_selection(db, list_id, filter_request)
    return await hydrate_videos(
        db, (await db.execute(selection.offset(offset).limit(limit))).scalars().all()
    )


async def query_all_videos(
    db: AsyncSession,
    tags: list[str] | None = None,
    tags_all: list[str] | None = None,
    offset: int = 0,
    limit: int = 100,
) -> list[VideoResponse]:
    selection = select(Video).order_by(Video.created_at, Video.id)
    names = [name.strip().lower() for name in tags or [] if name.strip()]
    if names:
        selection = selection.where(Video.tags.any(func.lower(Tag.name).in_(names)))
    for name in {name.strip().lower() for name in tags_all or [] if name.strip()}:
        selection = selection.where(Video.tags.any(func.lower(Tag.name) == name))
    return await hydrate_videos(
        db, (await db.execute(selection.offset(offset).limit(limit))).scalars().all()
    )
