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


def test_rejects_application_database_under_a_host_alias():
    app = "postgresql+asyncpg://app:secret@localhost:5432/bookmarks_test"
    target = "postgresql+asyncpg://test:secret@127.0.0.1:5432/bookmarks_test"
    with pytest.raises(ValueError):
        validated_test_database_url(target, app)


@pytest.mark.parametrize(
    "target,expected",
    [
        (
            "postgresql+asyncpg://test:test@localhost:55438/bookmarks_test",
            {"ssl": False},
        ),
        (
            "postgresql+asyncpg://test:test@127.0.0.1:55438/bookmarks_test",
            {"ssl": False},
        ),
        ("postgresql+asyncpg://test:test@remote.example:55438/bookmarks_test", {}),
        ("postgresql+asyncpg://test:test@localhost:5432/bookmarks_test", {}),
        ("postgresql+asyncpg://test:test@localhost:55438/bookmarks", {}),
    ],
)
def test_ssl_override_only_matches_local_ephemeral_test_service(target, expected):
    from app.core.test_database import isolated_test_connect_args

    assert isolated_test_connect_args(target) == expected
