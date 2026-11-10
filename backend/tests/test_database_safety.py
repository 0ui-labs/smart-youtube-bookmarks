import pytest

from app.core.test_database import validated_test_database_url

APP = "postgresql+asyncpg://app:secret@localhost:5432/bookmarks"


@pytest.mark.parametrize(
    "target",
    [
        None,
        APP,
        APP + "_test?host=other",
        "sqlite:///bookmarks_test",
        "postgresql+asyncpg://app:secret@localhost/bookmarks",
    ],
)
def test_rejects_unsafe_database_target(target):
    with pytest.raises(ValueError):
        validated_test_database_url(target, APP)


def test_rejects_same_database_with_different_credentials():
    with pytest.raises(ValueError):
        validated_test_database_url(APP.replace("app:secret", "test:other"), APP)


def test_accepts_explicit_isolated_postgres_database():
    target = "postgresql+asyncpg://test:secret@localhost:55438/bookmarks_test"
    assert validated_test_database_url(target, APP) == target
