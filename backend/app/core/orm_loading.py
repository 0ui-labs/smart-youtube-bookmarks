"""Typed boundary for SQLAlchemy 2.0.25's unannotated committed loader API."""

from collections.abc import Callable
from typing import cast

from sqlalchemy.orm.attributes import set_committed_value

from app.models.base import Base


def load_committed_relationship(instance: Base, key: str, value: object) -> None:
    """Populate a batch-loaded relationship without dirtying its unit of work.

    SQLAlchemy instruments collections here; writing an ordinary list into
    instance.__dict__ bypasses that instrumentation and breaks expire/rollback.
    """
    cast("Callable[[object, str, object], object]", set_committed_value)(
        instance, key, value
    )
