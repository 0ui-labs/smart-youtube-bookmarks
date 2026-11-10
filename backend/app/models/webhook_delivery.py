"""Credential-free digest of accepted WebSub deliveries for replay suppression."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class WebhookDelivery(BaseModel):
    __tablename__ = "webhook_deliveries"
    digest: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
