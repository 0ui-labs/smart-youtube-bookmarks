from typing import Dict, Any
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from .base import BaseModel


class Schema(BaseModel):
    """
    Represents a data extraction schema defining what fields to extract from videos.

    Schemas can be reused across multiple bookmark lists to standardize
    the data extraction process.
    """
    __tablename__ = "schemas"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    fields: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # Relationships
    lists: Mapped[list["BookmarkList"]] = relationship("BookmarkList", back_populates="schema")

    def __repr__(self) -> str:
        return f"<Schema(id={self.id}, name={self.name!r})>"
