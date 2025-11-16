import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload  # ADD THIS
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.core.config import settings
from app.core.database import get_db
from app.models.tag import Tag
from app.models.user import User
from app.models.field_schema import FieldSchema  # ADD THIS
from app.schemas.tag import TagCreate, TagUpdate, TagResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tags", tags=["tags"])


# ============================================================================
# SECURITY WARNING: Temporary User Access Helper
# ============================================================================
#
# This function provides a TEMPORARY solution for user authentication.
# It allows specifying a user_id via query parameter for testing purposes.
#
# CRITICAL SECURITY ISSUE:
# - Without this parameter, endpoints default to the first user in the database
# - This allows ANY caller to access/modify data of the first user
# - This is ONLY acceptable for local development/testing
#
# TODO: Replace with proper JWT-based authentication:
# - Implement get_current_user() dependency
# - Use JWT tokens for user identification
# - Remove user_id query parameter
# - See: https://fastapi.tiangolo.com/tutorial/security/
# ============================================================================
async def get_user_for_testing(
    db: AsyncSession,
    user_id: Optional[UUID] = Query(
        None,
        description="[TESTING ONLY] User ID - defaults to first user if not provided"
    )
) -> User:
    """
    Get user for testing purposes.

    SECURITY WARNING: This is a temporary solution for local development.
    Production deployments MUST implement proper JWT authentication.

    Args:
        db: Database session
        user_id: Optional user ID (defaults to first user)

    Returns:
        User object

    Raises:
        HTTPException: If no user found or if called in production
    """
    # PRODUCTION GUARD: Block this testing helper in production environments
    if settings.env == "production":
        logger.error(
            "get_user_for_testing() called in PRODUCTION environment - this is a security risk!"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Testing helper not available in production environment"
        )

    # Log usage in development/testing (for visibility)
    logger.warning(
        f"get_user_for_testing() called with user_id={user_id or 'None (defaulting to first user)'}"
    )

    if user_id:
        # Use specified user ID
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User with ID {user_id} not found"
            )
    else:
        # Default to first user (backwards compatibility)
        result = await db.execute(select(User))
        user = result.scalars().first()
        if not user:
            raise HTTPException(
                status_code=400,
                detail="No user found in database"
            )

    return user


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag: TagCreate,
    db: AsyncSession = Depends(get_db),
    user_id: Optional[UUID] = Query(None, description="[TESTING ONLY] User ID")
):
    """Create a new tag."""
    current_user = await get_user_for_testing(db, user_id)

    # Check if tag name already exists for this user (case-insensitive)
    # This prevents case-sensitive duplicates (e.g., "Python" and "python")
    # which would break the AND filter logic with ilike() queries
    stmt = select(Tag).where(
        Tag.user_id == current_user.id,
        func.lower(Tag.name) == tag.name.lower()
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

    # Eager load schema relationship to avoid lazy loading issues in response serialization
    # Re-query with selectinload to ensure schema is loaded
    stmt = (
        select(Tag)
        .options(selectinload(Tag.schema))
        .where(Tag.id == new_tag.id)
    )
    new_tag = (await db.execute(stmt)).scalar_one()

    return new_tag


@router.get("", response_model=list[TagResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    user_id: Optional[UUID] = Query(None, description="[TESTING ONLY] User ID")
):
    """List all tags for current user."""
    current_user = await get_user_for_testing(db, user_id)

    # Eager load schema relationships (including nested schema_fields)
    stmt = (
        select(Tag)
        .options(
            selectinload(Tag.schema).selectinload(FieldSchema.schema_fields)
        )
        .where(Tag.user_id == current_user.id)
        .order_by(Tag.name)
    )
    result = await db.execute(stmt)
    tags = result.scalars().all()
    return list(tags)


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: Optional[UUID] = Query(None, description="[TESTING ONLY] User ID")
):
    """Get a specific tag by ID."""
    current_user = await get_user_for_testing(db, user_id)

    # Eager load schema relationship (including nested schema_fields)
    stmt = (
        select(Tag)
        .options(
            selectinload(Tag.schema).selectinload(FieldSchema.schema_fields)
        )
        .where(Tag.id == tag_id, Tag.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    return tag


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID,
    tag_update: TagUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: Optional[UUID] = Query(None, description="[TESTING ONLY] User ID")
):
    """Update a tag (rename, change color, or bind/unbind schema)."""
    current_user = await get_user_for_testing(db, user_id)

    # Fetch tag with eager loaded schema (for response)
    stmt = select(Tag).options(selectinload(Tag.schema)).where(
        Tag.id == tag_id,
        Tag.user_id == current_user.id
    )
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check for duplicate name if name is being updated (case-insensitive)
    if tag_update.name is not None and tag_update.name.lower() != tag.name.lower():
        duplicate_check = select(Tag).where(
            Tag.user_id == current_user.id,
            func.lower(Tag.name) == tag_update.name.lower()
        )
        duplicate_result = await db.execute(duplicate_check)
        existing = duplicate_result.scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tag '{tag_update.name}' already exists"
            )

    # Validate schema_id if provided (check field exists in update)
    # Note: tag_update.model_dump(exclude_unset=True) distinguishes null from missing
    update_data = tag_update.model_dump(exclude_unset=True)

    if "schema_id" in update_data:
        schema_id_value = update_data["schema_id"]

        if schema_id_value is not None:
            # REF MCP Improvement #3: Validate schema exists AND belongs to user's list in ONE query
            from app.models.list import BookmarkList

            schema_stmt = (
                select(FieldSchema)
                .join(BookmarkList, FieldSchema.list_id == BookmarkList.id)
                .where(
                    FieldSchema.id == schema_id_value,
                    BookmarkList.user_id == current_user.id
                )
            )
            schema = (await db.execute(schema_stmt)).scalar_one_or_none()

            if not schema:
                # Combined error: schema not found OR doesn't belong to user's list
                raise HTTPException(
                    status_code=404,
                    detail=f"Schema mit ID '{str(schema_id_value)[:8]}...' nicht gefunden oder gehört zu anderer Liste"
                )
        # If schema_id_value is None, we're unbinding (allow this)

    # Update fields
    if tag_update.name is not None:
        tag.name = tag_update.name
    if tag_update.color is not None:
        tag.color = tag_update.color
    if "schema_id" in update_data:
        # Set to new value (could be UUID or None for unbinding)
        tag.schema_id = update_data["schema_id"]

    await db.commit()

    # Expire the tag to clear cached relationships
    # This ensures re-query loads fresh data even with expire_on_commit=False
    db.expire(tag)

    # REF MCP Improvement #4: Re-query with selectinload (no refresh needed)
    # Load nested schema_fields to avoid lazy loading issues
    stmt = (
        select(Tag)
        .options(
            selectinload(Tag.schema).selectinload(FieldSchema.schema_fields)
        )
        .where(Tag.id == tag_id)
    )
    tag = (await db.execute(stmt)).scalar_one_or_none()

    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: Optional[UUID] = Query(None, description="[TESTING ONLY] User ID")
):
    """Delete a tag."""
    current_user = await get_user_for_testing(db, user_id)

    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    await db.delete(tag)
    await db.commit()
    return None
