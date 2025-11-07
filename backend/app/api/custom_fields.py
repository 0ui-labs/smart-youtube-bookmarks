"""
Custom Fields CRUD API endpoints.

Implements list-scoped custom field management:
- GET /api/lists/{list_id}/custom-fields - List all fields
- POST /api/lists/{list_id}/custom-fields - Create new field
- PUT /api/lists/{list_id}/custom-fields/{field_id} - Update field
- DELETE /api/lists/{list_id}/custom-fields/{field_id} - Delete field

Includes:
- Case-insensitive duplicate name detection
- Config validation via Pydantic schemas (Task #64)
- Schema usage check on deletion (prevents orphaned references)
- List validation (404 if not found)
"""

from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.list import BookmarkList
from app.models.custom_field import CustomField
from app.models.schema_field import SchemaField
from app.schemas.custom_field import (
    CustomFieldCreate,
    CustomFieldUpdate,
    CustomFieldResponse
)

router = APIRouter(prefix="/api/lists", tags=["custom-fields"])
