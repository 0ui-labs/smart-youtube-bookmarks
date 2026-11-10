"""Concurrent synthetic identities on the guarded PostgreSQL test database."""

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.user import User
from app.services.identity_service import resolve_local_user


async def test_parallel_first_login_has_one_local_identity(
    test_db, test_engine, test_user
):
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)
    legacy_id = test_user.id

    async def login():
        async with sessions() as db:
            user = await resolve_local_user(db, "user_synthetic_a")
            await db.commit()
            return user.id

    ids = await asyncio.gather(login(), login(), login())
    assert len(set(ids)) == 1
    assert ids[0] != legacy_id
    assert len((await test_db.execute(select(User))).scalars().all()) == 2
    await test_db.refresh(test_user)
    assert test_user.clerk_id is None


async def test_disabled_identity_is_not_reactivated(test_db):
    user = await resolve_local_user(test_db, "user_synthetic_a")
    user.is_active = False
    await test_db.commit()
    with pytest.raises(HTTPException) as error:
        await resolve_local_user(test_db, "user_synthetic_a")
    assert error.value.status_code == 401
