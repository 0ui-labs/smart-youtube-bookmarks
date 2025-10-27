from typing import Dict, Any
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from .base import BaseModel


class Schema(BaseModel):
    __tablename__ = "schemas"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    fields: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
