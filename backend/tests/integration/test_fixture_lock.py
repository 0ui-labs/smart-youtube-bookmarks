from sqlalchemy import text


async def test_suite_holds_exclusive_database_lock(test_engine):
    async with test_engine.connect() as competitor:
        acquired = await competitor.scalar(
            text("SELECT pg_try_advisory_lock(hashtextextended(current_database(), 1))")
        )
        assert acquired is False
