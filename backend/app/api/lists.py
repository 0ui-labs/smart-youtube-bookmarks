from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import BookmarkList, Video
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
            BookmarkList.schema_id,
            BookmarkList.created_at,
            BookmarkList.updated_at,
            func.count(Video.id).label("video_count")
        )
        .outerjoin(Video, BookmarkList.id == Video.list_id)
        .group_by(
            BookmarkList.id,
            BookmarkList.name,
            BookmarkList.description,
            BookmarkList.schema_id,
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
                schema_id=row.schema_id,
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
    new_list = BookmarkList(**list_data.model_dump())
    db.add(new_list)
    await db.flush()
    await db.refresh(new_list)

    return ListResponse(
        id=new_list.id,
        name=new_list.name,
        description=new_list.description,
        schema_id=new_list.schema_id,
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
            BookmarkList.schema_id,
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
            BookmarkList.schema_id,
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
        schema_id=row.schema_id,
        video_count=row.video_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
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
    return None
