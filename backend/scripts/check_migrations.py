"""Migration proof on an explicitly configured, initially empty test database."""

import asyncio
import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import settings
from app.core.test_database import (
    isolated_test_connect_args,
    validated_test_database_url,
)

url = validated_test_database_url(
    os.environ.get("TEST_MIGRATION_DATABASE_URL"), settings.database_url
)


async def verify_empty():
    engine = create_async_engine(url, connect_args=isolated_test_connect_args(url))
    try:
        async with engine.connect() as connection:
            count = await connection.scalar(
                text(
                    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
                )
            )
            if count:
                raise RuntimeError(
                    "Migration proof requires a new empty test database; no tables are dropped"
                )
    finally:
        await engine.dispose()


async def add_synthetic_data(user_id, list_id):
    engine = create_async_engine(url, connect_args=isolated_test_connect_args(url))
    try:
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "INSERT INTO users (id,email,hashed_password,is_active) VALUES (:id,'migration-proof@example.test','!invalid',true)"
                ),
                {"id": user_id},
            )
            await connection.execute(
                text(
                    "INSERT INTO bookmarks_lists (id,name,user_id) VALUES (:id,'Synthetic migration proof',:user_id)"
                ),
                {"id": list_id, "user_id": user_id},
            )
    finally:
        await engine.dispose()


async def verify_preserved(list_id):
    engine = create_async_engine(url, connect_args=isolated_test_connect_args(url))
    try:
        async with engine.connect() as connection:
            assert (
                await connection.scalar(
                    text("SELECT count(*) FROM bookmarks_lists WHERE id=:id"),
                    {"id": list_id},
                )
                == 1
            )
            assert (
                await connection.scalar(
                    text(
                        "SELECT count(*) FROM information_schema.tables WHERE table_name='job_outbox'"
                    )
                )
                == 1
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(verify_empty())
    command = [sys.executable, "-m", "alembic", "upgrade"]
    subprocess.run([*command, "898750768ddd"], check=True)
    user_id, list_id = uuid4(), uuid4()
    asyncio.run(add_synthetic_data(user_id, list_id))
    subprocess.run([*command, "head"], check=True)
    asyncio.run(verify_preserved(list_id))
    print("Migration chain and synthetic-data upgrade passed")
