from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.models.tag import Tag
from app.models.user import User
from app.schemas.tag import TagCreate, TagUpdate, TagResponse

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag: TagCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new tag."""
    # Get first user (for testing - in production, use get_current_user dependency)
    result = await db.execute(select(User))
    current_user = result.scalars().first()

    if not current_user:
        raise HTTPException(status_code=400, detail="No user found")

    # Check if tag name already exists for this user
    stmt = select(Tag).where(
        Tag.user_id == current_user.id,
        Tag.name == tag.name
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tag '{tag.name}' already exists"
        )

    # Create new tag
    new_tag = Tag(
        name=tag.name,
        color=tag.color,
        user_id=current_user.id
    )
    db.add(new_tag)
    await db.commit()
    await db.refresh(new_tag)
    return new_tag


@router.get("", response_model=list[TagResponse])
async def list_tags(db: AsyncSession = Depends(get_db)):
    """List all tags for current user."""
    # Get first user (for testing - in production, use get_current_user dependency)
    user_result = await db.execute(select(User))
    current_user = user_result.scalars().first()

    if not current_user:
        raise HTTPException(status_code=400, detail="No user found")

    stmt = select(Tag).where(Tag.user_id == current_user.id).order_by(Tag.name)
    result = await db.execute(stmt)
    tags = result.scalars().all()
    return list(tags)


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(tag_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a specific tag by ID."""
    # Get first user (for testing - in production, use get_current_user dependency)
    user_result = await db.execute(select(User))
    current_user = user_result.scalars().first()

    if not current_user:
        raise HTTPException(status_code=400, detail="No user found")

    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    return tag


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID,
    tag_update: TagUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a tag (rename or change color)."""
    # Get first user (for testing - in production, use get_current_user dependency)
    user_result = await db.execute(select(User))
    current_user = user_result.scalars().first()

    if not current_user:
        raise HTTPException(status_code=400, detail="No user found")

    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check for duplicate name if name is being updated
    if tag_update.name is not None and tag_update.name != tag.name:
        duplicate_check = select(Tag).where(
            Tag.user_id == current_user.id,
            Tag.name == tag_update.name
        )
        duplicate_result = await db.execute(duplicate_check)
        existing = duplicate_result.scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tag '{tag_update.name}' already exists"
            )

    # Update fields
    if tag_update.name is not None:
        tag.name = tag_update.name
    if tag_update.color is not None:
        tag.color = tag_update.color

    await db.commit()
    await db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a tag."""
    # Get first user (for testing - in production, use get_current_user dependency)
    user_result = await db.execute(select(User))
    current_user = user_result.scalars().first()

    if not current_user:
        raise HTTPException(status_code=400, detail="No user found")

    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    await db.delete(tag)
    await db.commit()
    return None
