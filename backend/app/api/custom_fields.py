"""
Custom Fields CRUD API endpoints.

Implements list-scoped custom field management:
- GET /api/lists/{list_id}/custom-fields - List all fields
- POST /api/lists/{list_id}/custom-fields - Create new field
- PUT /api/lists/{list_id}/custom-fields/{field_id} - Update field
- DELETE /api/lists/{list_id}/custom-fields/{field_id} - Delete field
- POST /api/lists/{list_id}/custom-fields/check-duplicate - Check for duplicate field names

Includes:
- Case-insensitive duplicate name detection
- Config validation via Pydantic schemas (Task #64)
- Schema usage check on deletion (prevents orphaned references)
- List validation (404 if not found)
- Real-time duplicate checking for UI validation
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
    CustomFieldResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse
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
) -> CustomFieldResponse:
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


@router.put(
    "/{list_id}/custom-fields/{field_id}",
    response_model=CustomFieldResponse,
    status_code=status.HTTP_200_OK
)
async def update_custom_field(
    list_id: UUID,
    field_id: UUID,
    field_update: CustomFieldUpdate,
    db: AsyncSession = Depends(get_db)
) -> CustomFieldResponse:
    """
    Update an existing custom field.

    Supports partial updates (all fields optional). When updating name,
    performs case-insensitive duplicate check. Config validation is
    delegated to Pydantic schema (Task #64).

    Args:
        list_id: UUID of the bookmark list
        field_id: UUID of the field to update
        field_update: CustomFieldUpdate schema (all fields optional)
        db: Database session

    Returns:
        CustomFieldResponse: Updated field with new timestamps

    Raises:
        HTTPException 404: List or field not found
        HTTPException 409: New field name already exists (case-insensitive)
        HTTPException 422: Pydantic validation errors (auto-generated)

    Example Request (partial update):
        PUT /api/lists/{list_id}/custom-fields/{field_id}
        {"name": "Updated Field Name"}

    Example Request (full update):
        PUT /api/lists/{list_id}/custom-fields/{field_id}
        {
            "name": "Overall Rating",
            "field_type": "rating",
            "config": {"max_rating": 10}
        }

    Note: Changing field_type on fields with existing values may cause
    data inconsistencies. Frontend should warn users before allowing this.
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

    # Validate field exists and belongs to this list
    stmt = select(CustomField).where(
        CustomField.id == field_id,
        CustomField.list_id == list_id
    )
    result = await db.execute(stmt)
    field = result.scalar_one_or_none()

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field with id {field_id} not found in list {list_id}"
        )

    # Check for duplicate name if name is being updated (case-insensitive)
    if field_update.name is not None and field_update.name.lower() != field.name.lower():
        duplicate_check = select(CustomField).where(
            CustomField.list_id == list_id,
            func.lower(CustomField.name) == field_update.name.lower(),
            CustomField.id != field_id  # Exclude current field
        )
        duplicate_result = await db.execute(duplicate_check)
        existing = duplicate_result.scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Field '{field_update.name}' already exists in this list"
            )

    # Update fields using Pydantic's exclude_unset (only updates provided fields)
    # REF MCP: model_dump(exclude_unset=True) returns only fields explicitly set in request
    # This is more compact and maintainable than manual if-chains
    update_data = field_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(field, key, value)

    await db.commit()
    await db.refresh(field)

    return field


@router.delete(
    "/{list_id}/custom-fields/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_custom_field(
    list_id: UUID,
    field_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    Delete a custom field from a bookmark list.

    Validates that field is not used in any schema before deletion.
    If field is used in schemas, returns 409 Conflict with usage count.

    Cascade behavior:
    - Deletes all VideoFieldValue records (CASCADE via ORM)
    - Does NOT delete SchemaField associations (must be removed first)

    Args:
        list_id: UUID of the bookmark list
        field_id: UUID of the field to delete
        db: Database session

    Returns:
        None (204 No Content on success)

    Raises:
        HTTPException 404: List or field not found
        HTTPException 409: Field is used in one or more schemas

    Example Success:
        DELETE /api/lists/{list_id}/custom-fields/{field_id}
        Response: 204 No Content

    Example Failure (field in use):
        DELETE /api/lists/{list_id}/custom-fields/{field_id}
        Response: 409 Conflict
        {
            "detail": "Cannot delete field 'Overall Rating' - used in 2 schema(s). Remove field from schemas first."
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

    # Validate field exists and belongs to this list
    stmt = select(CustomField).where(
        CustomField.id == field_id,
        CustomField.list_id == list_id
    )
    result = await db.execute(stmt)
    field = result.scalar_one_or_none()

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field with id {field_id} not found in list {list_id}"
        )

    # Check if field is used in any schema (via SchemaField join table)
    usage_stmt = select(func.count()).select_from(SchemaField).where(
        SchemaField.field_id == field_id
    )
    usage_count = await db.scalar(usage_stmt)

    if usage_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete field '{field.name}' - used in {usage_count} schema(s). Remove field from schemas first."
        )

    # Delete field (CASCADE will delete VideoFieldValue records)
    await db.delete(field)
    await db.commit()

    return None


@router.post(
    "/{list_id}/custom-fields/check-duplicate",
    response_model=DuplicateCheckResponse,
    status_code=status.HTTP_200_OK
)
async def check_duplicate_field(
    list_id: UUID,
    request: DuplicateCheckRequest,
    db: AsyncSession = Depends(get_db)
) -> DuplicateCheckResponse:
    """
    Check if a custom field with the given name already exists (case-insensitive).

    This endpoint is used for real-time duplicate validation in the UI.
    Returns 200 OK regardless of whether the field exists - this is a check,
    not an error condition.

    The check is case-insensitive: "Overall Rating", "overall rating", and
    "OVERALL RATING" are all considered duplicates.

    Args:
        list_id: UUID of the list to check within
        request: Request body containing the field name to check
        db: Database session

    Returns:
        DuplicateCheckResponse with exists=True and field details if found,
        or exists=False if not found.

    Raises:
        HTTPException 404: List not found
        HTTPException 422: Pydantic validation errors (auto-generated)

    Example Response (exists):
        {
            "exists": true,
            "field": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {"options": ["bad", "good", "great"]},
                "created_at": "2025-11-06T10:30:00Z",
                "updated_at": "2025-11-06T10:30:00Z"
            }
        }

    Example Response (not exists):
        {
            "exists": false,
            "field": null
        }
    """
    # Verify list exists
    list_stmt = select(BookmarkList).where(BookmarkList.id == list_id)
    list_result = await db.execute(list_stmt)
    bookmark_list = list_result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Case-insensitive query for existing field
    # Uses func.lower() for PostgreSQL compatibility and database-level atomic operation
    stmt = select(CustomField).where(
        CustomField.list_id == list_id,
        func.lower(CustomField.name) == request.name.lower()
    )
    result = await db.execute(stmt)
    existing_field = result.scalar_one_or_none()

    if existing_field:
        # Field exists - return full details for rich UI feedback
        return DuplicateCheckResponse(
            exists=True,
            field=CustomFieldResponse.model_validate(existing_field)
        )
    else:
        # Field does not exist
        return DuplicateCheckResponse(
            exists=False,
            field=None
        )
