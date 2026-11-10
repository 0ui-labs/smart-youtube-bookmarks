"""Video tagging endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.orm_loading import load_committed_relationship
from app.models.tag import Tag, video_tags
from app.models.video import Video
from app.schemas.tag import TagResponse
from app.schemas.video_tagging import (
    AssignTagsRequest,
    BulkAssignTagsRequest,
    SetCategoryRequest,
    SetCategoryResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/videos/bulk/tags", response_model=dict)
async def bulk_assign_tags_to_videos(
    request: BulkAssignTagsRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, int]:
    """
    Bulk assign tags to multiple videos (cartesian product).

    Creates all possible video-tag associations for the given video_ids and tag_ids.
    Duplicates are ignored (idempotent).

    Args:
        request: BulkAssignTagsRequest with video_ids and tag_ids
        db: Database session

    Returns:
        dict: {"assigned": int, "total_requested": int}
        - assigned: number of new associations created
        - total_requested: total number of assignments requested

    Raises:
        HTTPException 400: Batch exceeds 10,000 assignments
        HTTPException 404: Some videos or tags not found
    """
    # Handle empty arrays
    if not request.video_ids or not request.tag_ids:
        return {"assigned": 0, "total_requested": 0}

    # Batch size limit
    total = len(request.video_ids) * len(request.tag_ids)
    if total > 10000:
        raise HTTPException(status_code=400, detail="Batch exceeds 10,000 assignments")

    # Pre-validate videos exist
    video_count = await db.scalar(
        select(func.count()).select_from(Video).where(Video.id.in_(request.video_ids))
    )
    if video_count != len(request.video_ids):
        raise HTTPException(status_code=404, detail="Some videos not found")

    # Pre-validate tags exist
    tag_count = await db.scalar(
        select(func.count()).select_from(Tag).where(Tag.id.in_(request.tag_ids))
    )
    if tag_count != len(request.tag_ids):
        raise HTTPException(status_code=404, detail="Some tags not found")

    # Cartesian product
    assignments = [
        {"video_id": vid, "tag_id": tag}
        for vid in request.video_ids
        for tag in request.tag_ids
    ]

    # Bulk insert with ON CONFLICT DO NOTHING
    # Use constraint_name instead of index_elements for named constraints
    stmt = pg_insert(video_tags).values(assignments)
    stmt = stmt.on_conflict_do_nothing(constraint="uq_video_tags_video_tag")

    result = await db.execute(stmt)
    await db.commit()

    return {"assigned": result.rowcount, "total_requested": len(assignments)}


@router.post("/videos/{video_id}/tags", response_model=list[TagResponse])
async def assign_tags_to_video(
    video_id: UUID, request: AssignTagsRequest, db: AsyncSession = Depends(get_db)
) -> list[Tag]:
    """Assign tags to a video (many-to-many). Returns the updated list of tags."""
    from app.services.category_validation import (
        CategoryValidationError,
        validate_category_assignment,
    )

    # Verify video exists
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Verify all tags exist
    tags_stmt = select(Tag).where(Tag.id.in_(request.tag_ids))
    tags_result = await db.execute(tags_stmt)
    tags = list(tags_result.scalars().all())

    if len(tags) != len(request.tag_ids):
        raise HTTPException(status_code=400, detail="One or more tags not found")

    # Load video's existing tags for category validation
    existing_tags_stmt = (
        select(Tag).join(video_tags).where(video_tags.c.video_id == video_id)
    )
    existing_tags_result = await db.execute(existing_tags_stmt)
    load_committed_relationship(
        video, "tags", list(existing_tags_result.scalars().all())
    )

    # Validate category assignment (only one category per video)
    try:
        validate_category_assignment(video, tags)
    except CategoryValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": str(e),
                "existing_category_id": str(e.existing_category_id)
                if e.existing_category_id
                else None,
                "existing_category_name": e.existing_category_name,
                "new_category_name": e.new_category_name,
            },
        ) from e

    # Get existing tag associations for this video
    existing_stmt = select(video_tags.c.tag_id).where(video_tags.c.video_id == video_id)
    existing_result = await db.execute(existing_stmt)
    existing_tag_ids = {row[0] for row in existing_result.all()}

    # Insert only new associations (idempotent)
    for tag_id in request.tag_ids:
        if tag_id not in existing_tag_ids:
            await db.execute(
                video_tags.insert().values(video_id=video_id, tag_id=tag_id)
            )

    await db.commit()

    # Return all tags for this video
    final_tags_stmt = (
        select(Tag)
        .options(
            selectinload(Tag.schema)
        )  # Eager load schema to prevent lazy='raise' error
        .join(video_tags)
        .where(video_tags.c.video_id == video_id)
    )
    final_tags_result = await db.execute(final_tags_stmt)
    return list(final_tags_result.scalars().all())


@router.delete(
    "/videos/{video_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_tag_from_video(
    video_id: UUID, tag_id: UUID, db: AsyncSession = Depends(get_db)
) -> None:
    """Remove a tag from a video."""
    # Verify video exists
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Check if tag is assigned to video
    check_stmt = select(video_tags).where(
        video_tags.c.video_id == video_id, video_tags.c.tag_id == tag_id
    )
    check_result = await db.execute(check_stmt)
    association = check_result.first()

    if not association:
        raise HTTPException(status_code=404, detail="Tag not assigned to this video")

    # Delete association
    delete_stmt = video_tags.delete().where(
        video_tags.c.video_id == video_id, video_tags.c.tag_id == tag_id
    )
    await db.execute(delete_stmt)
    await db.commit()
    return None


@router.get("/videos/{video_id}/tags", response_model=list[TagResponse])
async def get_video_tags(
    video_id: UUID, db: AsyncSession = Depends(get_db)
) -> list[Tag]:
    """Get all tags for a video."""
    # Verify video exists
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Get tags via junction table
    tags_stmt = (
        select(Tag)
        .options(
            selectinload(Tag.schema)
        )  # Eager load schema to prevent lazy='raise' error
        .join(video_tags)
        .where(video_tags.c.video_id == video_id)
    )
    tags_result = await db.execute(tags_stmt)
    return list(tags_result.scalars().all())


@router.put("/videos/{video_id}/category", response_model=SetCategoryResponse)
async def set_video_category(
    video_id: UUID,
    request: SetCategoryRequest,
    restore_backup: bool = Query(
        False, description="Restore backup if available for new category"
    ),
    db: AsyncSession = Depends(get_db),
) -> SetCategoryResponse:
    """
    Set video's category (replaces existing).

    This endpoint handles category changes with backup/restore functionality:
    - If video has existing category with field values, creates backup before removal
    - If new category has existing backup and restore_backup=true, restores values

    Args:
        video_id: UUID of video to update
        request: SetCategoryRequest with new category_id (null to remove)
        restore_backup: If true and backup exists for new category, restore values
        db: Database session

    Returns:
        SetCategoryResponse with backup_created, backup_available, restored_count

    Raises:
        HTTPException 404: Video not found
        HTTPException 400: Tag is not a category (is_video_type=false)
    """
    from app.services.field_value_backup import (
        backup_field_values,
        list_backups,
        restore_field_values,
    )

    # Step 2.18: Get video with tags
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id {video_id} not found",
        )

    # Load video's existing tags to find current category
    existing_tags_stmt = (
        select(Tag).join(video_tags).where(video_tags.c.video_id == video_id)
    )
    existing_tags_result = await db.execute(existing_tags_stmt)
    existing_tags = list(existing_tags_result.scalars().all())

    # Get current category
    current_category = next((t for t in existing_tags if t.is_video_type), None)

    # Get new category (if not None)
    new_category = None
    if request.category_id:
        new_category_stmt = select(Tag).where(Tag.id == request.category_id)
        new_category_result = await db.execute(new_category_stmt)
        new_category = new_category_result.scalar_one_or_none()

        if not new_category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tag with id {request.category_id} not found",
            )

        if not new_category.is_video_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tag '{new_category.name}' is not a category (is_video_type=false). "
                f"Use POST /videos/{video_id}/tags for labels.",
            )

    # Early exit if same category (no-op)
    if current_category and new_category and current_category.id == new_category.id:
        return SetCategoryResponse(
            backup_created=False, backup_available=False, restored_count=0
        )

    # Step 2.19: Create backup if removing category with values
    backup_created = False
    if current_category:
        backup_path = await backup_field_values(video_id, current_category.id, db)
        backup_created = backup_path is not None

        # Remove old category
        delete_stmt = video_tags.delete().where(
            video_tags.c.video_id == video_id,
            video_tags.c.tag_id == current_category.id,
        )
        await db.execute(delete_stmt)

    # Step 2.20: Add new category (if not None)
    restored_count = 0
    backup_available = False

    if new_category:
        # Check for existing backup
        backups = list_backups(video_id)
        backup_available = any(b.category_id == new_category.id for b in backups)

        # Add new category association
        insert_stmt = video_tags.insert().values(
            video_id=video_id, tag_id=new_category.id
        )
        await db.execute(insert_stmt)

        # Restore backup if requested and available
        if restore_backup and backup_available:
            restored_count = await restore_field_values(video_id, new_category.id, db)

    await db.commit()

    return SetCategoryResponse(
        backup_created=backup_created,
        backup_available=backup_available,
        restored_count=restored_count,
    )
