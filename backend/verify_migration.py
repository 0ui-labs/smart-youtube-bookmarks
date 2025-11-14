#!/usr/bin/env python3
"""Verification script for pg_trgm migration."""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.core.database import async_session_maker


async def verify_migration():
    """Verify pg_trgm extension and GIN index exist."""
    print("=== Verifying pg_trgm Migration ===\n")

    async with async_session_maker() as session:
        try:
            # Check pg_trgm extension
            result = await session.execute(
                text("SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';")
            )
            ext_row = result.fetchone()

            if ext_row:
                print(f"✓ pg_trgm extension exists (version: {ext_row[1]})")
            else:
                print("✗ pg_trgm extension NOT found")
                return False

            # Check GIN index
            result = await session.execute(
                text("""
                    SELECT indexname, indexdef
                    FROM pg_indexes
                    WHERE tablename = 'video_field_values'
                      AND indexname = 'idx_vfv_text_trgm';
                """)
            )
            idx_row = result.fetchone()

            if idx_row:
                print(f"✓ GIN index 'idx_vfv_text_trgm' exists")
                print(f"  Index definition: {idx_row[1]}")
            else:
                print("✗ GIN index 'idx_vfv_text_trgm' NOT found")
                return False

            # List all indexes on video_field_values
            print("\n=== All indexes on video_field_values ===")
            result = await session.execute(
                text("""
                    SELECT indexname, indexdef
                    FROM pg_indexes
                    WHERE tablename = 'video_field_values'
                    ORDER BY indexname;
                """)
            )
            for row in result.fetchall():
                print(f"  - {row[0]}")

            print("\n✓ Migration verification successful!")
            return True

        except Exception as e:
            print(f"✗ Error during verification: {e}")
            return False


if __name__ == "__main__":
    success = asyncio.run(verify_migration())
    sys.exit(0 if success else 1)
