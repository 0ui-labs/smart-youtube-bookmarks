"""
Analytics API endpoint for custom fields usage statistics.

Provides aggregated insights for field management:
- Most-used fields (top 10 by usage count)
- Unused schemas (0 tags or 0 field values)
- Field coverage (% of videos with values set)
- Schema effectiveness (average completion rate)

Performance:
- Uses PostgreSQL aggregate functions (COUNT, AVG, GROUP BY)
- Leverages composite indexes (idx_video_field_values_field_numeric, etc.)
- Single query per metric (4 queries total, parallelizable)
- Target: <1s for 1000 videos, 50 fields, 20 schemas
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.list import BookmarkList
from app.models.schema_field import SchemaField
from app.models.tag import Tag, video_tags
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.schemas.analytics import (
    AnalyticsResponse,
    FieldCoverageStat,
    MostUsedFieldStat,
    SchemaEffectivenessStat,
    UnusedSchemaStat,
)

router = APIRouter(prefix="/api/lists", tags=["analytics"])


@router.get(
    "/{list_id}/analytics",
    response_model=AnalyticsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_analytics(
    list_id: UUID, db: AsyncSession = Depends(get_db)
) -> AnalyticsResponse:
    """
    Get custom fields usage analytics for a bookmark list.

    Returns aggregated statistics for:
    1. Most-used fields (top 10 by usage count)
    2. Unused schemas (0 tags or 0 field values)
    3. Field coverage (% of videos with values)
    4. Schema effectiveness (avg completion rate)

    Args:
        list_id: UUID of the bookmark list
        db: Database session

    Returns:
        AnalyticsResponse with all analytics metrics

    Raises:
        HTTPException 404: List not found

    Performance:
        - Uses indexed columns for fast aggregation
        - 4 SQL queries (executed in sequence, could be parallelized)
        - Target: <1s for 1000 videos, 50 fields, 20 schemas

    Example Response:
        {
            "most_used_fields": [
                {
                    "field_id": "uuid",
                    "field_name": "Overall Rating",
                    "field_type": "rating",
                    "usage_count": 450,
                    "total_videos": 500,
                    "usage_percentage": 90.0
                }
            ],
            "unused_schemas": [...],
            "field_coverage": [...],
            "schema_effectiveness": [...]
        }
    """
    # Verify list exists
    list_result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = list_result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found",
        )

    # Get total video count for percentage calculations
    total_videos_stmt = select(func.count(Video.id)).where(Video.list_id == list_id)
    total_videos_result = await db.execute(total_videos_stmt)
    total_videos = total_videos_result.scalar() or 0

    # Query 1: Most-Used Fields (Top 10)
    most_used_fields = await _get_most_used_fields(db, list_id, total_videos)

    # Query 2: Unused Schemas
    unused_schemas = await _get_unused_schemas(db, list_id)

    # Query 3: Field Coverage
    field_coverage = await _get_field_coverage(db, list_id, total_videos)

    # Query 4: Schema Effectiveness
    schema_effectiveness = await _get_schema_effectiveness(db, list_id)

    return AnalyticsResponse(
        most_used_fields=most_used_fields,
        unused_schemas=unused_schemas,
        field_coverage=field_coverage,
        schema_effectiveness=schema_effectiveness,
    )


async def _get_most_used_fields(
    db: AsyncSession, list_id: UUID, total_videos: int
) -> list[MostUsedFieldStat]:
    """
    Get top 10 most-used fields by VideoFieldValue count.

    SQL Query:
        SELECT
            cf.id, cf.name, cf.field_type,
            COUNT(vfv.id) as usage_count
        FROM custom_fields cf
        LEFT JOIN video_field_values vfv ON cf.id = vfv.field_id
        WHERE cf.list_id = ?
        GROUP BY cf.id
        ORDER BY usage_count DESC
        LIMIT 10
    """
    stmt = (
        select(
            CustomField.id,
            CustomField.name,
            CustomField.field_type,
            func.count(VideoFieldValue.id).label("usage_count"),
        )
        .outerjoin(VideoFieldValue, CustomField.id == VideoFieldValue.field_id)
        .where(CustomField.list_id == list_id)
        .group_by(CustomField.id)
        .order_by(func.count(VideoFieldValue.id).desc())
        .limit(10)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        MostUsedFieldStat(
            field_id=str(row.id),
            field_name=row.name,
            field_type=row.field_type,
            usage_count=row.usage_count,
            total_videos=total_videos,
            usage_percentage=round((row.usage_count / total_videos * 100), 2)
            if total_videos > 0
            else 0.0,
        )
        for row in rows
    ]


async def _get_unused_schemas(
    db: AsyncSession, list_id: UUID
) -> list[UnusedSchemaStat]:
    """
    Get schemas that are unused (no tags OR no field values).

    Two types of unused:
    1. No tags: schema_id not in tags table (no binding)
    2. No values: schema has tags but 0 VideoFieldValue records

    SQL Query (simplified):
        SELECT fs.id, fs.name,
               COUNT(DISTINCT sf.field_id) as field_count,
               COUNT(DISTINCT t.id) as tag_count,
               MAX(vfv.updated_at) as last_used
        FROM field_schemas fs
        LEFT JOIN schema_fields sf ON fs.id = sf.schema_id
        LEFT JOIN tags t ON fs.id = t.schema_id
        LEFT JOIN video_field_values vfv ON sf.field_id = vfv.field_id
        WHERE fs.list_id = ?
        GROUP BY fs.id
        HAVING tag_count = 0 OR COUNT(vfv.id) = 0
        ORDER BY fs.name
    """
    # Main query
    stmt = (
        select(
            FieldSchema.id,
            FieldSchema.name,
            func.count(func.distinct(SchemaField.field_id)).label("field_count"),
            func.count(func.distinct(Tag.id)).label("tag_count"),
            func.count(VideoFieldValue.id).label("value_count"),
            func.max(VideoFieldValue.updated_at).label("last_used"),
        )
        .outerjoin(SchemaField, FieldSchema.id == SchemaField.schema_id)
        .outerjoin(Tag, FieldSchema.id == Tag.schema_id)
        .outerjoin(VideoFieldValue, SchemaField.field_id == VideoFieldValue.field_id)
        .where(FieldSchema.list_id == list_id)
        .group_by(FieldSchema.id)
        .order_by(FieldSchema.name)
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Filter unused: tag_count = 0 OR no values
    unused = []
    for row in rows:
        if row.tag_count == 0:
            unused.append(
                UnusedSchemaStat(
                    schema_id=str(row.id),
                    schema_name=row.name,
                    field_count=row.field_count,
                    tag_count=row.tag_count,
                    last_used=row.last_used,
                    reason="no_tags",
                )
            )
        elif row.value_count == 0:
            unused.append(
                UnusedSchemaStat(
                    schema_id=str(row.id),
                    schema_name=row.name,
                    field_count=row.field_count,
                    tag_count=row.tag_count,
                    last_used=row.last_used,
                    reason="no_values",
                )
            )

    return unused


async def _get_field_coverage(
    db: AsyncSession, list_id: UUID, total_videos: int
) -> list[FieldCoverageStat]:
    """
    Get coverage statistics for all fields.

    Coverage = % of videos with values set for this field.

    SQL Query:
        SELECT
            cf.id, cf.name, cf.field_type,
            COUNT(DISTINCT vfv.video_id) as videos_with_values
        FROM custom_fields cf
        LEFT JOIN video_field_values vfv ON cf.id = vfv.field_id
        WHERE cf.list_id = ?
        GROUP BY cf.id
        ORDER BY coverage_percentage ASC
    """
    stmt = (
        select(
            CustomField.id,
            CustomField.name,
            CustomField.field_type,
            func.count(func.distinct(VideoFieldValue.video_id)).label(
                "videos_with_values"
            ),
        )
        .outerjoin(VideoFieldValue, CustomField.id == VideoFieldValue.field_id)
        .where(CustomField.list_id == list_id)
        .group_by(CustomField.id)
    )

    result = await db.execute(stmt)
    rows = result.all()

    stats = [
        FieldCoverageStat(
            field_id=str(row.id),
            field_name=row.name,
            field_type=row.field_type,
            videos_with_values=row.videos_with_values,
            total_videos=total_videos,
            coverage_percentage=round((row.videos_with_values / total_videos * 100), 2)
            if total_videos > 0
            else 0.0,
        )
        for row in rows
    ]

    # Sort by coverage % ascending (lowest coverage first - needs attention)
    return sorted(stats, key=lambda s: s.coverage_percentage)


async def _get_schema_effectiveness(
    db: AsyncSession, list_id: UUID
) -> list[SchemaEffectivenessStat]:
    """
    Get effectiveness statistics for all schemas.

    Effectiveness = average # of fields filled per video (for videos with this schema's tags).
    Completion % = (avg_fields_filled / field_count) * 100

    Algorithm:
    1. For each schema:
       a. Get all videos with tags bound to this schema
       b. Count how many fields are filled per video
       c. Calculate average across all videos
    2. Calculate completion % = avg / field_count * 100

    SQL Query (conceptual):
        SELECT fs.id, fs.name,
               COUNT(DISTINCT sf.field_id) as field_count,
               AVG(fields_filled_per_video) as avg_fields_filled,
               COUNT(DISTINCT v.id) as video_count
        FROM field_schemas fs
        JOIN schema_fields sf ON fs.id = sf.schema_id
        JOIN tags t ON fs.id = t.schema_id
        JOIN video_tags vt ON t.id = vt.tag_id
        JOIN videos v ON vt.video_id = v.id
        LEFT JOIN video_field_values vfv ON v.id = vfv.video_id AND sf.field_id = vfv.field_id
        WHERE fs.list_id = ?
        GROUP BY fs.id, v.id
        ORDER BY completion_percentage DESC
    """
    # Get all schemas
    schemas_stmt = (
        select(FieldSchema)
        .where(FieldSchema.list_id == list_id)
        .options(selectinload(FieldSchema.schema_fields))
    )
    schemas_result = await db.execute(schemas_stmt)
    schemas = schemas_result.scalars().all()

    stats = []

    for schema in schemas:
        field_count = len(schema.schema_fields)
        if field_count == 0:
            continue  # Skip schemas with no fields

        field_ids = [sf.field_id for sf in schema.schema_fields]

        # Get videos with tags bound to this schema
        videos_stmt = (
            select(func.distinct(Video.id))
            .join(video_tags, Video.id == video_tags.c.video_id)
            .join(Tag, video_tags.c.tag_id == Tag.id)
            .where(and_(Tag.schema_id == schema.id, Video.list_id == list_id))
        )
        videos_result = await db.execute(videos_stmt)
        video_ids = [row[0] for row in videos_result.all()]

        if not video_ids:
            continue  # Skip schemas with no videos

        # Count filled fields per video (optimized with GROUP BY)
        # Fixed N+1 query pattern: single grouped query instead of 1 query per video
        filled_stmt = (
            select(
                VideoFieldValue.video_id,
                func.count(VideoFieldValue.id).label("filled_count"),
            )
            .where(
                and_(
                    VideoFieldValue.video_id.in_(video_ids),
                    VideoFieldValue.field_id.in_(field_ids),
                )
            )
            .group_by(VideoFieldValue.video_id)
        )
        filled_result = await db.execute(filled_stmt)
        filled_counts = {row.video_id: row.filled_count for row in filled_result}

        # Sum filled counts across all videos
        total_filled = sum(filled_counts.values())

        avg_fields_filled = total_filled / len(video_ids) if video_ids else 0.0
        # Round avg first, then compute completion from rounded value to satisfy validator
        rounded_avg = round(avg_fields_filled, 2)
        completion_percentage = (
            (rounded_avg / field_count * 100) if field_count > 0 else 0.0
        )

        stats.append(
            SchemaEffectivenessStat(
                schema_id=str(schema.id),
                schema_name=schema.name,
                field_count=field_count,
                avg_fields_filled=rounded_avg,
                completion_percentage=round(completion_percentage, 2),
                video_count=len(video_ids),
            )
        )

    # Sort by completion % descending (most effective first)
    return sorted(stats, key=lambda s: s.completion_percentage, reverse=True)
