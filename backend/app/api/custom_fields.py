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


@router.get(
    "/{list_id}/custom-fields",
    response_model=List[CustomFieldResponse],
    status_code=status.HTTP_200_OK
)
async def list_custom_fields(
    list_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> list[CustomFieldResponse]:
    """
    List all custom fields for a bookmark list.

    Returns all field definitions ordered by creation date (newest first).
    Fields are list-scoped and can be reused across multiple schemas.

    Args:
        list_id: UUID of the bookmark list
        db: Database session

    Returns:
        List[CustomFieldResponse]: All custom fields in the list

    Raises:
        HTTPException 404: List not found

    Example Response:
        [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "list_id": "987fcdeb-51a2-43d1-9012-345678901234",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {
                    "options": ["bad", "all over the place", "confusing", "great"]
                },
                "created_at": "2025-11-06T10:30:00Z",
                "updated_at": "2025-11-06T10:30:00Z"
            },
            {
                "id": "234e5678-e89b-12d3-a456-426614174001",
                "list_id": "987fcdeb-51a2-43d1-9012-345678901234",
                "name": "Overall Rating",
                "field_type": "rating",
                "config": {"max_rating": 5},
                "created_at": "2025-11-06T10:25:00Z",
                "updated_at": "2025-11-06T10:25:00Z"
            }
        ]
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Query all fields for this list (ordered by created_at DESC)
    stmt = (
        select(CustomField)
        .where(CustomField.list_id == list_id)
        .order_by(CustomField.created_at.desc())
    )
    result = await db.execute(stmt)
    fields = result.scalars().all()

    return list(fields)


@router.post(
    "/{list_id}/custom-fields",
    response_model=CustomFieldResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_custom_field(
    list_id: UUID,
    field_data: CustomFieldCreate,
    db: AsyncSession = Depends(get_db)
) -> CustomField:
    """
    Create a new custom field in a bookmark list.

    Validates that:
    - List exists (404 if not found)
    - Field name is unique within list (case-insensitive, 409 if duplicate)
    - Config matches field_type requirements (delegated to Pydantic schema)

    Args:
        list_id: UUID of the bookmark list
        field_data: CustomFieldCreate schema with name, field_type, config
        db: Database session

    Returns:
        CustomFieldResponse: Created field with generated ID and timestamps

    Raises:
        HTTPException 404: List not found
        HTTPException 409: Field name already exists (case-insensitive)
        HTTPException 422: Pydantic validation errors (auto-generated)

    Example Request:
        POST /api/lists/{list_id}/custom-fields
        {
            "name": "Presentation Quality",
            "field_type": "select",
            "config": {
                "options": ["bad", "all over the place", "confusing", "great"]
            }
        }
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Check for duplicate name (case-insensitive)
    # Uses SQL LOWER() for proper case-insensitive comparison
    stmt = select(CustomField).where(
        CustomField.list_id == list_id,
        func.lower(CustomField.name) == field_data.name.lower()
    )
    result = await db.execute(stmt)
    existing_field = result.scalar_one_or_none()

    if existing_field:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Field '{field_data.name}' already exists in this list"
        )

    # Create new field
    # Note: Pydantic schema (Task #64) already validated config matches field_type
    new_field = CustomField(
        list_id=list_id,
        name=field_data.name,
        field_type=field_data.field_type,
        config=field_data.config
    )
    db.add(new_field)
    await db.commit()
    await db.refresh(new_field)

    return new_field
