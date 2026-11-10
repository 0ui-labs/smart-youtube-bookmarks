"""Explicit administrative transfer; never called by authentication or HTTP."""

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BookmarkList, Channel, Subscription, Tag, User


async def transfer_legacy_ownership(
    db: AsyncSession, source_id: UUID, target_clerk_id: str, *, apply: bool = False
) -> dict[str, int]:
    source = (
        await db.execute(select(User).where(User.id == source_id).with_for_update())
    ).scalar_one_or_none()
    target = (
        await db.execute(
            select(User).where(User.clerk_id == target_clerk_id).with_for_update()
        )
    ).scalar_one_or_none()
    if source is None or target is None or source.id == target.id:
        raise ValueError("Explicit distinct source and existing Clerk target required")
    if source.clerk_id is not None:
        raise ValueError("Source must be a legacy identity without a Clerk binding")
    counts = {}
    for model in (BookmarkList, Tag, Channel, Subscription):
        counts[model.__tablename__] = (
            await db.execute(
                select(func.count())
                .select_from(model)
                .where(model.user_id == source_id)
            )
        ).scalar_one()
    if apply:
        for model in (BookmarkList, Tag, Channel, Subscription):
            await db.execute(
                update(model)
                .where(model.user_id == source_id)
                .values(user_id=target.id)
            )
        await db.flush()
    return counts
