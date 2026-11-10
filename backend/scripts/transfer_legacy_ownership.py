"""Dry-run by default. Requires an explicit database, identities and backup to apply.

Run from backend: .venv/bin/python -m scripts.transfer_legacy_ownership --help
No schema migration or automatic first-user/account-by-email transfer occurs.
"""

import argparse
import asyncio
import json
import os
from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.services.legacy_ownership_service import transfer_legacy_ownership


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-user-id", type=UUID, required=True)
    parser.add_argument("--target-clerk-id", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup-file", type=Path)
    parser.add_argument("--backup-confirmed", action="store_true")
    args = parser.parse_args()
    if args.apply and (
        not args.backup_confirmed
        or args.backup_file is None
        or not args.backup_file.is_file()
        or args.backup_file.stat().st_size == 0
    ):
        parser.error("Apply requires a nonempty backup file and --backup-confirmed")
    if not os.environ.get("LEGACY_TRANSFER_DATABASE_URL"):
        parser.error(
            "Set explicit LEGACY_TRANSFER_DATABASE_URL; application defaults are never used"
        )
    return args


async def main(args: argparse.Namespace) -> None:
    engine = create_async_engine(os.environ["LEGACY_TRANSFER_DATABASE_URL"])
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as db:
            counts = await transfer_legacy_ownership(
                db, args.source_user_id, args.target_clerk_id, apply=args.apply
            )
            if args.apply:
                await db.commit()
            else:
                await db.rollback()
            print(json.dumps({"applied": args.apply, "counts": counts}, sort_keys=True))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(arguments()))
