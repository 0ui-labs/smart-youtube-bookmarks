"""Video query construction and bounded batch hydration."""

import logging
from collections.abc import Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.api.helpers.field_union import get_available_fields_for_videos
from app.models.channel import Channel
from app.models.custom_field import CustomField
from app.models.list import BookmarkList
from app.models.tag import Tag, video_tags
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.schemas.video import FieldFilterOperator, VideoFilterRequest

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

    channels_by_id: dict = {}
    channels_by_name: dict = {}

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


async def _apply_sorting(stmt, sort_by: str | None, sort_order: str, db: AsyncSession):
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
    if not sort_by:
        # Default sorting: created_at descending (newest first)
        return stmt.order_by(desc(Video.created_at))

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
        valid_columns = {
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

    return stmt


async def query_all_videos(
    db: AsyncSession, tags: list[str] | None = None, tags_all: list[str] | None = None
) -> list[Video]:
    """
    List all videos with optional tag filtering.

    Query params:
    - tags: OR filter (any matching tag) - can be specified multiple times
    - tags_all: AND filter (all tags required) - can be specified multiple times

    Examples:
    - /api/videos - All videos
    - /api/videos?tags=Python&tags=Tutorial - Videos with Python OR Tutorial tags
    - /api/videos?tags_all=Python&tags_all=Advanced - Videos with BOTH Python AND Advanced tags
    """
    stmt = select(Video).order_by(Video.created_at)

    # Filter by tags (OR logic) - case-insensitive
    if tags and len(tags) > 0:
        # Join to tags and filter by tag names using case-insensitive ILIKE
        # or_() creates OR conditions for each tag
        stmt = (
            stmt.join(Video.tags)
            .where(or_(*[Tag.name.ilike(tag) for tag in tags]))
            .distinct()
        )

    # Filter by tags (AND logic) - case-insensitive
    if tags_all and len(tags_all) > 0:
        # Subquery: videos that have ALL specified tags (case-insensitive)
        # Count distinct tag matches - only include videos with count == number of requested tags
        subquery = (
            select(video_tags.c.video_id)
            .select_from(video_tags)
            .join(Tag, video_tags.c.tag_id == Tag.id)
            .where(or_(*[Tag.name.ilike(tag) for tag in tags_all]))
            .group_by(video_tags.c.video_id)
            .having(func.count(func.distinct(video_tags.c.tag_id)) == len(tags_all))
        )

        stmt = stmt.where(Video.id.in_(subquery))

    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

    if not videos:
        return []

    # Load all tags for all videos in a single batch query (prevents N+1)
    # Use a join query to fetch all tags at once
    video_ids = [video.id for video in videos]
    tags_stmt = (
        select(video_tags.c.video_id, Tag)
        .join(Tag, video_tags.c.tag_id == Tag.id)
        .options(
            selectinload(Tag.schema)
        )  # Eager load schema to prevent lazy='raise' error
        .where(video_tags.c.video_id.in_(video_ids))
    )
    tags_result = await db.execute(tags_stmt)

    # Group tags by video_id
    tags_by_video: dict = {}
    for video_id, tag in tags_result:
        if video_id not in tags_by_video:
            tags_by_video[video_id] = []
        tags_by_video[video_id].append(tag)

    # Assign tags to videos
    for video in videos:
        video.__dict__["tags"] = tags_by_video.get(video.id, [])

    # Assign empty field_values to all videos (this endpoint doesn't support field filtering)
    # This prevents MissingGreenlet error when VideoResponse tries to access field_values
    for video in videos:
        video.__dict__["field_values"] = []

    # Load channel thumbnails for all videos
    await _load_channel_thumbnails(videos, db)

    return list(videos)


async def query_filtered_videos(
    db: AsyncSession, list_id: UUID, filter_request: VideoFilterRequest
) -> list[Video]:
    """
    Filter videos in a bookmark list by tags and/or custom field values.

    Filtering Logic:
    - Tags: OR logic (video matches ANY selected tag)
    - Field filters: AND logic (video matches ALL field filters)
    - Tags + Field filters: Combined with AND

    Examples:
        POST /api/lists/{id}/videos/filter
        Body: {"tags": ["Python"], "field_filters": [{"field_id": "...", "operator": "gte", "value": 4}]}
        -> Videos with tag "Python" AND rating >= 4

        Body: {"field_filters": [{"field_id": "...", "operator": "contains", "value": "tutorial"}]}
        -> Videos where field contains "tutorial"

        Body: {"tags": ["Python", "JavaScript"]}
        -> Videos with Python OR JavaScript tags

    Args:
        list_id: UUID of the bookmark list
        filter_request: Filter criteria (tags and/or field filters)
        db: Database session

    Returns:
        List[VideoResponse]: Filtered videos

    Raises:
        HTTPException 404: List not found
    """
    # Step 1: Validate list exists
    result = await db.execute(select(BookmarkList).where(BookmarkList.id == list_id))
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found",
        )

    # Step 2: Build base query
    stmt = select(Video).where(Video.list_id == list_id).order_by(Video.created_at)

    # Step 3: Apply tag filtering (OR logic) - case-insensitive exact match
    if filter_request.tags and len(filter_request.tags) > 0:
        # Normalize tag names: strip whitespace and lowercase
        normalized_tags = [
            tag.strip().lower() for tag in filter_request.tags if tag and tag.strip()
        ]

        if normalized_tags:
            # Join to tags and filter by exact case-insensitive match using func.lower
            stmt = (
                stmt.join(Video.tags)
                .where(func.lower(Tag.name).in_(normalized_tags))
                .distinct()
            )

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
        stmt = stmt.distinct()

    # Step 5: Apply sorting
    stmt = await _apply_sorting(
        stmt, filter_request.sort_by, filter_request.sort_order or "asc", db
    )

    # Step 6: Execute query
    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

    if not videos:
        return []

    # Step 7: Load tags for all videos (prevent N+1)
    video_ids = [video.id for video in videos]

    # First, get video-tag associations
    associations_stmt = select(video_tags).where(video_tags.c.video_id.in_(video_ids))
    associations_result = await db.execute(associations_stmt)
    associations = associations_result.all()

    # Get all unique tag IDs
    tag_ids = list(set(assoc.tag_id for assoc in associations))

    # Load all tags with schema relationship eagerly loaded
    if tag_ids:
        tags_stmt = (
            select(Tag).options(selectinload(Tag.schema)).where(Tag.id.in_(tag_ids))
        )
        tags_result = await db.execute(tags_stmt)
        tags_by_id = {tag.id: tag for tag in tags_result.scalars().all()}
    else:
        tags_by_id = {}

    # Group tags by video_id
    tags_by_video: dict = {}
    for assoc in associations:
        video_id = assoc.video_id
        tag_id = assoc.tag_id
        if video_id not in tags_by_video:
            tags_by_video[video_id] = []
        if tag_id in tags_by_id:
            tags_by_video[video_id].append(tags_by_id[tag_id])

    # Assign tags to videos
    for video in videos:
        video.__dict__["tags"] = tags_by_video.get(video.id, [])

    # Step 8: Batch-load applicable fields for ALL videos
    applicable_fields_by_video = await get_available_fields_for_videos(videos, db)

    # Step 9: Batch load field values
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

            # Build response list: ONLY fields that have values set
            # FIX BUG #003: Only include fields that have actual values (not None)
            # available_fields shows what CAN be filled, field_values shows what HAS been filled
            field_values_response = []
            for field, schema_name, display_order, show_on_card in applicable_fields:
                field_value = values_by_field_id.get(field.id)

                # FIX BUG #003: Only append if field_value exists
                if field_value:
                    # Extract value based on field type
                    value = None
                    if field.field_type == "rating":
                        value = field_value.value_numeric  # Can be float
                    elif field.field_type in ("select", "text"):
                        value = field_value.value_text
                    elif field.field_type == "boolean":
                        value = field_value.value_boolean

                    # Create response dict (Pydantic will serialize)
                    field_values_response.append(
                        {
                            "id": field_value.id,  # Always valid UUID
                            "video_id": video.id,
                            "field_id": field.id,
                            "field_name": field.name,
                            "field": field,  # CustomField ORM object
                            "value": value,
                            "schema_name": schema_name,
                            "show_on_card": show_on_card,
                            "display_order": display_order,
                            "updated_at": field_value.updated_at,  # Always valid datetime
                        }
                    )

            # Assign to video (FastAPI will serialize via VideoResponse schema)
            video.__dict__["field_values"] = field_values_response
    else:
        # No videos -> no field values needed
        for video in videos:
            video.__dict__["field_values"] = []

    # Load channel thumbnails for all videos
    await _load_channel_thumbnails(videos, db)

    return list(videos)


async def query_videos_in_list(
    db: AsyncSession,
    list_id: UUID,
    tags: list[str] | None = None,
    sort_by: str | None = None,
    sort_order: str | None = "asc",
) -> list[Video]:
    """
    Get all videos in a bookmark list with optional tag filtering and sorting.

    Args:
        list_id: UUID of the bookmark list
        tags: Optional list of tag names for OR filtering (case-insensitive)
        sort_by: Sort column (standard column or 'field:<field_id>')
        sort_order: Sort direction ('asc' or 'desc')
        db: Database session

    Returns:
        List[VideoResponse]: List of videos in the bookmark list

    Raises:
        HTTPException 404: List not found or custom field not found
        HTTPException 400: Invalid sort_by parameter

    Examples:
        - /api/lists/{id}/videos - All videos in list (default: created_at DESC)
        - /api/lists/{id}/videos?tags=Python&tags=Tutorial - Videos with Python OR Tutorial tags
        - /api/lists/{id}/videos?sort_by=title&sort_order=asc - Videos sorted by title A-Z
        - /api/lists/{id}/videos?sort_by=field:uuid-rating-field&sort_order=desc - Videos sorted by rating field
    """
    # Validate list exists
    result = await db.execute(select(BookmarkList).where(BookmarkList.id == list_id))
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found",
        )

    # Build query for videos in list
    stmt = select(Video).where(Video.list_id == list_id)

    # Apply tag filtering (OR logic) - case-insensitive exact match
    if tags and len(tags) > 0:
        # Normalize tag names: strip whitespace and lowercase
        normalized_tags = [tag.strip().lower() for tag in tags if tag and tag.strip()]

        if normalized_tags:
            # Join to tags and filter by exact case-insensitive match using func.lower
            # This is more robust than ILIKE (no wildcard interpretation) and index-friendly
            stmt = (
                stmt.join(Video.tags)
                .where(func.lower(Tag.name).in_(normalized_tags))
                .distinct()  # DISTINCT must come before ORDER BY for PostgreSQL
            )

    # Apply sorting
    stmt = await _apply_sorting(stmt, sort_by, sort_order, db)

    # Execute query
    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

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
    tags_by_video: dict = {}
    for assoc in associations:
        video_id = assoc.video_id
        tag_id = assoc.tag_id
        if video_id not in tags_by_video:
            tags_by_video[video_id] = []
        if tag_id in tags_by_id:
            tags_by_video[video_id].append(tags_by_id[tag_id])

    # Assign tags to videos
    for video in videos:
        video.__dict__["tags"] = tags_by_video.get(video.id, [])

    # Load parent list once (for Two-Layer Field System: workspace fields from list.default_schema_id)
    # All videos in this endpoint share the same list_id
    parent_list_stmt = select(BookmarkList).where(BookmarkList.id == list_id)
    parent_list_result = await db.execute(parent_list_stmt)
    parent_list = parent_list_result.scalar_one_or_none()

    # Assign list to all videos
    for video in videos:
        video.__dict__["list"] = parent_list

    # === NEW: Batch-load applicable fields for ALL videos ===
    # ✅ REF #1: Single query for all videos
    applicable_fields_by_video = await get_available_fields_for_videos(videos, db)

    # === NEW: Batch load field values ===
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
                    value = None
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
            video.__dict__["field_values"] = field_values_response
    else:
        # No videos → no field values needed
        for video in videos:
            video.__dict__["field_values"] = []

    # Load channel thumbnails for all videos
    await _load_channel_thumbnails(videos, db)

    return list(videos)
