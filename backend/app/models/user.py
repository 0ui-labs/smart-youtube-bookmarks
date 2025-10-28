"""
User model for authentication.

This is a minimal implementation to support WebSocket authentication.
Can be expanded later with full user management features.
"""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel


class User(BaseModel):
    """
    User model for authentication.

    Minimal implementation for WebSocket auth.
    """
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"
