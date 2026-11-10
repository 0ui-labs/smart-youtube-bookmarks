"""A handled DB failure must not create a second fixture failure at teardown."""

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError

from app.models import User


async def test_handled_database_error_can_leave_transaction_for_fixture_cleanup(
    test_db,
):
    test_db.add_all(
        [
            User(email="cleanup@test.invalid", hashed_password="!test"),
            User(email="cleanup@test.invalid", hashed_password="!test"),
        ]
    )
    with pytest.raises(DBAPIError):
        await test_db.flush()
    # Intentionally leave the failed transaction to the fixture finalizer.


async def test_next_test_receives_a_clean_database(test_db):
    assert await test_db.scalar(select(func.count(User.id))) == 0
