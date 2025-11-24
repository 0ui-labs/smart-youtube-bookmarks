from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import BookmarkList, Video, User
from app.models.field_schema import FieldSchema
from app.schemas.list import ListCreate, ListUpdate, ListResponse

router = APIRouter(prefix="/api/lists", tags=["lists"])


@router.get("", response_model=List[ListResponse])
async def get_lists(db: AsyncSession = Depends(get_db)):
    # First get all lists with video counts
    result = await db.execute(
        select(
            BookmarkList.id,
            BookmarkList.name,
            BookmarkList.description,
            BookmarkList.user_id,
            BookmarkList.schema_id,
            BookmarkList.default_schema_id,
            BookmarkList.created_at,
            BookmarkList.updated_at,
            func.count(Video.id).label("video_count")
        )
        .outerjoin(Video, BookmarkList.id == Video.list_id)
        .group_by(
            BookmarkList.id,
            BookmarkList.name,
            BookmarkList.description,
            BookmarkList.user_id,
            BookmarkList.schema_id,
            BookmarkList.default_schema_id,
            BookmarkList.created_at,
            BookmarkList.updated_at
        )
    )

    lists = []
    for row in result:
        lists.append(
            ListResponse(
                id=row.id,
                name=row.name,
                description=row.description,
                user_id=row.user_id,
                schema_id=row.schema_id,
                default_schema_id=row.default_schema_id,
                video_count=row.video_count,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
        )

    return lists


@router.post("", response_model=ListResponse, status_code=201)
async def create_list(
    list_data: ListCreate,
    db: AsyncSession = Depends(get_db)
):
    # TODO: Replace with actual authenticated user once auth is implemented
    # For now, use the default test user or create one if it doesn't exist
    if not list_data.user_id:
        result = await db.execute(
            select(User).where(User.email == "test@example.com")
        )
        test_user = result.scalar_one_or_none()
        if not test_user:
            # Create default test user if it doesn't exist
            test_user = User(
                email="test@example.com",
                hashed_password="$2b$12$placeholder_hash",
                is_active=True
            )
            db.add(test_user)
            await db.flush()
            await db.refresh(test_user)
        list_data.user_id = test_user.id

    new_list = BookmarkList(**list_data.model_dump())
    db.add(new_list)
    await db.flush()
    await db.refresh(new_list)
    await db.commit()

    return ListResponse(
        id=new_list.id,
        name=new_list.name,
        description=new_list.description,
        user_id=new_list.user_id,
        schema_id=new_list.schema_id,
        default_schema_id=new_list.default_schema_id,
        video_count=0,
        created_at=new_list.created_at,
        updated_at=new_list.updated_at,
    )


@router.get("/{list_id}", response_model=ListResponse)
async def get_list(list_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            BookmarkList.id,
            BookmarkList.name,
            BookmarkList.description,
            BookmarkList.user_id,
            BookmarkList.schema_id,
            BookmarkList.default_schema_id,
            BookmarkList.created_at,
            BookmarkList.updated_at,
            func.count(Video.id).label("video_count")
        )
        .outerjoin(Video, BookmarkList.id == Video.list_id)
        .where(BookmarkList.id == list_id)
        .group_by(
            BookmarkList.id,
            BookmarkList.name,
            BookmarkList.description,
            BookmarkList.user_id,
            BookmarkList.schema_id,
            BookmarkList.default_schema_id,
            BookmarkList.created_at,
            BookmarkList.updated_at
        )
    )

    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="List not found")

    return ListResponse(
        id=row.id,
        name=row.name,
        description=row.description,
        user_id=row.user_id,
        schema_id=row.schema_id,
        default_schema_id=row.default_schema_id,
        video_count=row.video_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.put("/{list_id}", response_model=ListResponse)
async def update_list(
    list_id: UUID,
    list_update: ListUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a list (name, description, or default_schema_id)."""
    # Fetch list
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    list_obj = result.scalar_one_or_none()
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Validate default_schema_id if provided
    if list_update.default_schema_id is not None:
        schema_result = await db.execute(
            select(FieldSchema).where(
                FieldSchema.id == list_update.default_schema_id,
                FieldSchema.list_id == list_id
            )
        )
        if not schema_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Schema not found or does not belong to this list"
            )

    # Apply updates
    update_data = list_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(list_obj, field, value)

    await db.commit()
    await db.refresh(list_obj)

    # Get video count for response
    count_result = await db.execute(
        select(func.count(Video.id)).where(Video.list_id == list_id)
    )
    video_count = count_result.scalar() or 0

    return ListResponse(
        id=list_obj.id,
        name=list_obj.name,
        description=list_obj.description,
        user_id=list_obj.user_id,
        schema_id=list_obj.schema_id,
        default_schema_id=list_obj.default_schema_id,
        video_count=video_count,
        created_at=list_obj.created_at,
        updated_at=list_obj.updated_at,
    )


@router.delete("/{list_id}", status_code=204)
async def delete_list(list_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    list_obj = result.scalar_one_or_none()

    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    await db.delete(list_obj)
    await db.commit()
    return None
