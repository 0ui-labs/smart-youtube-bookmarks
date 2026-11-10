"""Map a verified external subject without connecting accounts by email."""

import hashlib

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def resolve_local_user(db: AsyncSession, subject: str) -> User:
    email_id = hashlib.sha256(subject.encode()).hexdigest()
    statement = select(User).where(User.clerk_id == subject)
    user = await db.scalar(statement)
    if user is None:
        # Both clerk_id and the synthetic placeholder email are unique. Serialize
        # first creation before either index can race; the caller owns this lock.
        await db.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"clerk-identity:{email_id}"},
        )
        user = await db.scalar(statement)
        if user is None:
            await db.execute(
                insert(User)
                .values(
                    clerk_id=subject,
                    email=f"{email_id}@identity.invalid",
                    hashed_password="!clerk",
                    is_active=True,
                )
                .on_conflict_do_nothing(index_elements=[User.clerk_id])
            )
            user = (await db.execute(statement)).scalar_one()
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Session is not authorized")
    return user
