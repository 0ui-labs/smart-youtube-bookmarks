"""Fail closed before opening a connection used by destructive test fixtures."""

from sqlalchemy.engine import URL, make_url


def validated_test_database_url(target: str | None, application_url: str) -> str:
    if not target:
        raise ValueError(
            "TEST_DATABASE_URL must explicitly name a dedicated test database"
        )
    test = make_url(target)
    application = make_url(application_url)
    if test.drivername != "postgresql+asyncpg" or not (test.database or "").endswith(
        "_test"
    ):
        raise ValueError("Tests require a PostgreSQL database ending in _test")
    if test.query:
        raise ValueError("Test database URL query overrides are forbidden")

    def identity(url: URL) -> tuple[str, int, str | None]:
        return (url.host or "localhost", url.port or 5432, url.database)

    if test.database == application.database or identity(test) == identity(application):
        raise ValueError("Test database must differ from the application database")
    return target


def isolated_test_connect_args(target: str) -> dict[str, bool]:
    """The loopback-only Compose test service on 55438 has SSL disabled.

    Avoid negotiating an unsupported upgrade for every NullPool connection.
    Never override transport security on application or remote database targets.
    Call after validated_test_database_url and before constructing a test engine.
    """
    url = make_url(target)
    if (
        url.host in {"localhost", "127.0.0.1", "::1"}
        and url.port == 55438
        and (url.database or "").endswith("_test")
    ):
        return {"ssl": False}
    return {}
