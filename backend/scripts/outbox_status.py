"""Explicit operator diagnostics. No default application connection or mutations.

OUTBOX_DATABASE_URL=... python scripts/outbox_status.py
Append --retry UUID or --prune-completed and --apply for an intentional write.
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.services.outbox_operations import (
    inspect_operations,
    prune_completed_operations,
    retry_failed_operation,
)


async def run() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--retry", type=UUID)
    action.add_argument("--prune-completed", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url = os.environ.get("OUTBOX_DATABASE_URL")
    if not url:
        parser.error("OUTBOX_DATABASE_URL must explicitly name the operator target")
    if (args.retry or args.prune_completed) and not args.apply:
        parser.error(
            "Mutation requires --apply; omit action flags for read-only diagnostics"
        )
    engine = create_async_engine(url)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            if args.retry:
                operation = await retry_failed_operation(db, args.retry)
                await db.commit()
                print(json.dumps({"retry_operation_id": str(operation.id)}))
            elif args.prune_completed:
                count = await prune_completed_operations(db)
                await db.commit()
                print(json.dumps({"pruned": count}))
            else:
                print(json.dumps(await inspect_operations(db)))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
