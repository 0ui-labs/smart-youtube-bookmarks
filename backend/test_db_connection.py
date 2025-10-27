"""
Simple test script to verify database connection works.

This script attempts to connect to the database and execute a simple query.
Run this after starting the database to verify the connection is working.

Usage:
    python test_db_connection.py
"""

import asyncio
from app.core.database import engine
from sqlalchemy import text


async def test_connection():
    """Test database connection by executing a simple query."""
    print("Testing database connection...")
    print(f"Database URL: {engine.url}")

    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            row = result.scalar()
            print(f"Connection successful! Query result: {row}")
            return True
    except Exception as e:
        print(f"Connection failed: {e}")
        return False
    finally:
        await engine.dispose()


async def test_migration_table():
    """Check if alembic_version table exists (indicates migrations were run)."""
    print("\nChecking for migration table...")

    try:
        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables "
                    "WHERE table_name = 'alembic_version')"
                )
            )
            exists = result.scalar()
            if exists:
                print("Migration table exists - migrations have been applied")
                # Get current version
                result = await conn.execute(text("SELECT version_num FROM alembic_version"))
                version = result.scalar()
                print(f"Current migration version: {version}")
            else:
                print("Migration table does not exist - run 'alembic upgrade head' to apply migrations")
            return exists
    except Exception as e:
        print(f"Error checking migration table: {e}")
        return False
    finally:
        await engine.dispose()


async def main():
    """Run all database tests."""
    print("=" * 60)
    print("Database Connection Test")
    print("=" * 60)

    # Test basic connection
    connection_ok = await test_connection()

    if connection_ok:
        # Test migration status
        await test_migration_table()

    print("=" * 60)
    print("Test complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
