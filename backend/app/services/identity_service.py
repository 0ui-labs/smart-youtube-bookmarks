"""Map a verified external subject without connecting accounts by email."""

import hashlib

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def resolve_local_user(db: AsyncSession, subject: str) -> User:
    email_id = hashlib.sha256(subject.encode()).hexdigest()
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
    user = (await db.execute(select(User).where(User.clerk_id == subject))).scalar_one()
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Session is not authorized")
    return user
