# UX-Optimierung & Tag-System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform list-based UI to tag-based filter system with modern UX in 3 iterative waves.

**Architecture:** Iterative-incremental approach. Wave 1: Tag system + 2-column layout. Wave 2: UI cleanup + settings. Wave 3: CSV optimization + drag & drop + auto-tagging. Each wave is fully functional and testable.

**Tech Stack:** Backend: FastAPI, SQLAlchemy, PostgreSQL. Frontend: React, TypeScript, TanStack Table, Zustand, Tailwind CSS, shadcn/ui.

---

## 🌊 WAVE 1: Tag-System & Core Layout (Foundation)

### Task 1.1: Database Schema - Tags Table

**Files:**
- Create: `backend/alembic/versions/2025_10_31_add_tags_system.py`
- Reference: `backend/app/models/video.py` (existing Video model)

**Step 1: Write Alembic migration for tags table**

```python
"""add tags system

Revision ID: abc123def456
Revises: [PREVIOUS_REVISION]
Create Date: 2025-10-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'abc123def456'
down_revision = '[PREVIOUS_REVISION]'  # Get from: alembic history
branch_labels = None
depends_on = None

def upgrade():
    # Create tags table
    op.create_table(
        'tags',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(7), nullable=True),  # Hex color like "#3B82F6"
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Unique constraint: tag names unique per user
    op.create_unique_constraint('uq_tags_name_user_id', 'tags', ['name', 'user_id'])

    # Create video_tags junction table
    op.create_table(
        'video_tags',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('video_id', UUID(as_uuid=True), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tag_id', UUID(as_uuid=True), sa.ForeignKey('tags.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # Unique constraint: prevent duplicate assignments
    op.create_unique_constraint('uq_video_tags_video_tag', 'video_tags', ['video_id', 'tag_id'])

    # Indexes for performance
    op.create_index('idx_video_tags_video_id', 'video_tags', ['video_id'])
    op.create_index('idx_video_tags_tag_id', 'video_tags', ['tag_id'])

def downgrade():
    op.drop_index('idx_video_tags_tag_id')
    op.drop_index('idx_video_tags_video_id')
    op.drop_table('video_tags')
    op.drop_table('tags')
```

**Step 2: Run migration**

```bash
cd backend
alembic upgrade head
```

Expected output: `Running upgrade ... -> abc123def456, add tags system`

**Step 3: Verify tables created**

```bash
# Connect to PostgreSQL
docker exec -it smart-youtube-bookmarks-postgres-1 psql -U postgres -d youtube_bookmarks

# Check tables
\dt tags
\dt video_tags
\d tags
\d video_tags
```

Expected: Both tables exist with correct columns and constraints

**Step 4: Commit**

```bash
git add backend/alembic/versions/2025_10_31_add_tags_system.py
git commit -m "feat: add tags and video_tags database schema

- Create tags table with name, color, user_id
- Create video_tags junction table for many-to-many
- Add unique constraints and indexes
- Migration tested with alembic upgrade head

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.2: SQLAlchemy Models - Tag Model

**Files:**
- Create: `backend/app/models/tag.py`
- Modify: `backend/app/models/video.py` (add tags relationship)
- Modify: `backend/app/models/__init__.py` (export Tag model)

**Step 1: Write Tag model**

```python
# backend/app/models/tag.py
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid

# Junction table for many-to-many
video_tags = Table(
    'video_tags',
    Base.metadata,
    Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column('video_id', UUID(as_uuid=True), ForeignKey('videos.id', ondelete='CASCADE')),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id', ondelete='CASCADE')),
    Column('created_at', DateTime, default=datetime.utcnow),
)

class Tag(Base):
    __tablename__ = 'tags'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=True)  # Hex color
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="tags")
    videos = relationship("Video", secondary=video_tags, back_populates="tags")

    def __repr__(self):
        return f"<Tag(id={self.id}, name={self.name})>"
```

**Step 2: Update Video model with tags relationship**

```python
# backend/app/models/video.py
# Add import at top:
from app.models.tag import video_tags

# In Video class, add relationship:
class Video(Base):
    # ... existing columns ...

    # Add this relationship:
    tags = relationship("Tag", secondary=video_tags, back_populates="videos")
```

**Step 3: Export Tag model**

```python
# backend/app/models/__init__.py
from app.models.tag import Tag, video_tags

__all__ = ['Tag', 'video_tags', ...]  # Add to existing exports
```

**Step 4: Test models in Python shell**

```bash
cd backend
python -c "
from app.models import Tag, Video
from app.database import SessionLocal

db = SessionLocal()
# Should not raise errors
print('Tag model:', Tag.__tablename__)
print('Video.tags relationship:', hasattr(Video, 'tags'))
db.close()
"
```

Expected: No errors, prints table name and confirms relationship

**Step 5: Commit**

```bash
git add backend/app/models/tag.py backend/app/models/video.py backend/app/models/__init__.py
git commit -m "feat: add Tag SQLAlchemy model with many-to-many relationship

- Create Tag model with name, color, user_id
- Create video_tags association table
- Add tags relationship to Video model
- Tested model imports successfully

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.3: Pydantic Schemas - Tag Schemas

**Files:**
- Create: `backend/app/schemas/tag.py`
- Modify: `backend/app/schemas/video.py` (add tags field)
- Modify: `backend/app/schemas/__init__.py` (export Tag schemas)

**Step 1: Write Tag Pydantic schemas**

```python
# backend/app/schemas/tag.py
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tag name")
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$', description="Hex color code")

class TagCreate(TagBase):
    pass

class TagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')

class TagResponse(TagBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Step 2: Update VideoResponse schema with tags**

```python
# backend/app/schemas/video.py
# Add import at top:
from app.schemas.tag import TagResponse

# In VideoResponse class:
class VideoResponse(BaseModel):
    # ... existing fields ...
    tags: list[TagResponse] = []  # Add this field

    class Config:
        from_attributes = True
```

**Step 3: Export Tag schemas**

```python
# backend/app/schemas/__init__.py
from app.schemas.tag import TagBase, TagCreate, TagUpdate, TagResponse

__all__ = ['TagBase', 'TagCreate', 'TagUpdate', 'TagResponse', ...]  # Add to existing
```

**Step 4: Test schema validation**

```bash
cd backend
python -c "
from app.schemas.tag import TagCreate, TagResponse

# Test valid tag creation
tag = TagCreate(name='Python', color='#3B82F6')
print('Valid tag:', tag.model_dump())

# Test invalid color (should raise ValidationError)
try:
    invalid = TagCreate(name='Test', color='invalid')
except Exception as e:
    print('Validation works:', type(e).__name__)
"
```

Expected: Prints valid tag dict, then ValidationError for invalid color

**Step 5: Commit**

```bash
git add backend/app/schemas/tag.py backend/app/schemas/video.py backend/app/schemas/__init__.py
git commit -m "feat: add Tag Pydantic schemas with validation

- Create TagCreate, TagUpdate, TagResponse schemas
- Add hex color validation pattern
- Extend VideoResponse with tags field
- Tested schema validation successfully

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.4: Tag API Endpoints - CRUD Operations

**Files:**
- Create: `backend/app/api/tags.py`
- Modify: `backend/app/main.py` (register tags router)

**Step 1: Write failing test for tag creation**

```python
# backend/tests/api/test_tags.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_create_tag(async_client: AsyncClient, test_user_token):
    """Test creating a new tag."""
    response = await async_client.post(
        "/api/tags",
        json={"name": "Python", "color": "#3B82F6"},
        headers={"Authorization": f"Bearer {test_user_token}"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Python"
    assert data["color"] == "#3B82F6"
    assert "id" in data
```

**Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/api/test_tags.py::test_create_tag -v
```

Expected: FAIL with "404 Not Found" (endpoint doesn't exist yet)

**Step 3: Implement Tag CRUD endpoints**

```python
# backend/app/api/tags.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.models.tag import Tag
from app.models.user import User
from app.schemas.tag import TagCreate, TagUpdate, TagResponse
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/api/tags", tags=["tags"])

@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new tag."""
    # Check if tag name already exists for this user
    stmt = select(Tag).where(
        Tag.user_id == current_user.id,
        Tag.name == tag.name
    )
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tag '{tag.name}' already exists"
        )

    # Create new tag
    new_tag = Tag(
        name=tag.name,
        color=tag.color,
        user_id=current_user.id
    )
    db.add(new_tag)
    await db.commit()
    await db.refresh(new_tag)
    return new_tag

@router.get("", response_model=list[TagResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all tags for current user."""
    stmt = select(Tag).where(Tag.user_id == current_user.id).order_by(Tag.name)
    result = await db.execute(stmt)
    tags = result.scalars().all()
    return tags

@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific tag by ID."""
    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    return tag

@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID,
    tag_update: TagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a tag (rename or change color)."""
    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Update fields
    if tag_update.name is not None:
        tag.name = tag_update.name
    if tag_update.color is not None:
        tag.color = tag_update.color

    await db.commit()
    await db.refresh(tag)
    return tag

@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a tag."""
    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    await db.delete(tag)
    await db.commit()
    return None
```

**Step 4: Register router in main.py**

```python
# backend/app/main.py
from app.api import tags  # Add import

# In app initialization, add:
app.include_router(tags.router)
```

**Step 5: Run test to verify it passes**

```bash
cd backend
pytest tests/api/test_tags.py::test_create_tag -v
```

Expected: PASS

**Step 6: Write additional tests for CRUD operations**

```python
# backend/tests/api/test_tags.py (add more tests)

@pytest.mark.asyncio
async def test_list_tags(async_client: AsyncClient, test_user_token):
    """Test listing all tags."""
    # Create two tags first
    await async_client.post("/api/tags", json={"name": "Python"}, headers={"Authorization": f"Bearer {test_user_token}"})
    await async_client.post("/api/tags", json={"name": "Tutorial"}, headers={"Authorization": f"Bearer {test_user_token}"})

    # List tags
    response = await async_client.get("/api/tags", headers={"Authorization": f"Bearer {test_user_token}"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert any(t["name"] == "Python" for t in data)

@pytest.mark.asyncio
async def test_update_tag(async_client: AsyncClient, test_user_token):
    """Test updating a tag."""
    # Create tag
    create_response = await async_client.post("/api/tags", json={"name": "OldName"}, headers={"Authorization": f"Bearer {test_user_token}"})
    tag_id = create_response.json()["id"]

    # Update tag
    response = await async_client.put(
        f"/api/tags/{tag_id}",
        json={"name": "NewName", "color": "#FF5733"},
        headers={"Authorization": f"Bearer {test_user_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "NewName"
    assert data["color"] == "#FF5733"

@pytest.mark.asyncio
async def test_delete_tag(async_client: AsyncClient, test_user_token):
    """Test deleting a tag."""
    # Create tag
    create_response = await async_client.post("/api/tags", json={"name": "ToDelete"}, headers={"Authorization": f"Bearer {test_user_token}"})
    tag_id = create_response.json()["id"]

    # Delete tag
    response = await async_client.delete(f"/api/tags/{tag_id}", headers={"Authorization": f"Bearer {test_user_token}"})

    assert response.status_code == 204

    # Verify deleted
    get_response = await async_client.get(f"/api/tags/{tag_id}", headers={"Authorization": f"Bearer {test_user_token}"})
    assert get_response.status_code == 404
```

**Step 7: Run all tag tests**

```bash
cd backend
pytest tests/api/test_tags.py -v
```

Expected: All tests PASS

**Step 8: Commit**

```bash
git add backend/app/api/tags.py backend/app/main.py backend/tests/api/test_tags.py
git commit -m "feat: add Tag CRUD API endpoints with tests

- Implement POST /api/tags (create tag)
- Implement GET /api/tags (list tags)
- Implement GET /api/tags/{id} (get tag)
- Implement PUT /api/tags/{id} (update tag)
- Implement DELETE /api/tags/{id} (delete tag)
- Add comprehensive test coverage
- All tests passing (5/5)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.5: Video-Tag Assignment Endpoints

**Files:**
- Modify: `backend/app/api/videos.py` (add tag assignment endpoints)
- Create: `backend/tests/api/test_video_tags.py`

**Step 1: Write failing test for tag assignment**

```python
# backend/tests/api/test_video_tags.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_assign_tags_to_video(async_client: AsyncClient, test_user_token, test_video_id, test_tag_ids):
    """Test assigning tags to a video."""
    response = await async_client.post(
        f"/api/videos/{test_video_id}/tags",
        json={"tag_ids": test_tag_ids},
        headers={"Authorization": f"Bearer {test_user_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["tags"]) == len(test_tag_ids)
```

**Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/api/test_video_tags.py::test_assign_tags_to_video -v
```

Expected: FAIL (endpoint doesn't exist)

**Step 3: Implement video-tag assignment endpoints**

```python
# backend/app/api/videos.py
# Add imports:
from app.models.tag import Tag

# Add new endpoints:

@router.post("/{video_id}/tags", response_model=VideoResponse)
async def assign_tags_to_video(
    video_id: UUID,
    tag_data: dict,  # {"tag_ids": [UUID, ...]}
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign tags to a video."""
    # Get video
    stmt = select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    result = await db.execute(stmt)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Get tags
    tag_ids = tag_data.get("tag_ids", [])
    stmt = select(Tag).where(Tag.id.in_(tag_ids), Tag.user_id == current_user.id)
    result = await db.execute(stmt)
    tags = result.scalars().all()

    # Assign tags (replaces existing)
    video.tags = list(tags)
    await db.commit()
    await db.refresh(video)

    return video

@router.delete("/{video_id}/tags/{tag_id}", response_model=VideoResponse)
async def remove_tag_from_video(
    video_id: UUID,
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a tag from a video."""
    # Get video
    stmt = select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    result = await db.execute(stmt)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Remove tag
    video.tags = [t for t in video.tags if t.id != tag_id]
    await db.commit()
    await db.refresh(video)

    return video

@router.get("/{video_id}/tags", response_model=list[TagResponse])
async def get_video_tags(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all tags for a video."""
    stmt = select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    result = await db.execute(stmt)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    return video.tags
```

**Step 4: Run test to verify it passes**

```bash
cd backend
pytest tests/api/test_video_tags.py::test_assign_tags_to_video -v
```

Expected: PASS

**Step 5: Write additional tests**

```python
# backend/tests/api/test_video_tags.py (add more tests)

@pytest.mark.asyncio
async def test_remove_tag_from_video(async_client: AsyncClient, test_user_token, test_video_id, test_tag_id):
    """Test removing a tag from a video."""
    # First assign tag
    await async_client.post(f"/api/videos/{test_video_id}/tags", json={"tag_ids": [test_tag_id]}, headers={"Authorization": f"Bearer {test_user_token}"})

    # Remove tag
    response = await async_client.delete(
        f"/api/videos/{test_video_id}/tags/{test_tag_id}",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["tags"]) == 0

@pytest.mark.asyncio
async def test_get_video_tags(async_client: AsyncClient, test_user_token, test_video_id, test_tag_ids):
    """Test getting all tags for a video."""
    # Assign tags
    await async_client.post(f"/api/videos/{test_video_id}/tags", json={"tag_ids": test_tag_ids}, headers={"Authorization": f"Bearer {test_user_token}"})

    # Get tags
    response = await async_client.get(f"/api/videos/{test_video_id}/tags", headers={"Authorization": f"Bearer {test_user_token}"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == len(test_tag_ids)
```

**Step 6: Run all tests**

```bash
cd backend
pytest tests/api/test_video_tags.py -v
```

Expected: All tests PASS

**Step 7: Commit**

```bash
git add backend/app/api/videos.py backend/tests/api/test_video_tags.py
git commit -m "feat: add video-tag assignment endpoints with tests

- POST /api/videos/{id}/tags - assign tags
- DELETE /api/videos/{id}/tags/{tag_id} - remove tag
- GET /api/videos/{id}/tags - get video tags
- All tests passing (3/3)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.6: Video Filtering by Tags

**Files:**
- Modify: `backend/app/api/videos.py` (add tag filter query params)
- Create: `backend/tests/api/test_video_filtering.py`

**Step 1: Write failing test for OR filter**

```python
# backend/tests/api/test_video_filtering.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_filter_videos_by_tags_or(async_client: AsyncClient, test_user_token):
    """Test filtering videos by tags with OR logic."""
    # Setup: Create tags and videos
    # Tag 1: Python
    tag1_resp = await async_client.post("/api/tags", json={"name": "Python"}, headers={"Authorization": f"Bearer {test_user_token}"})
    tag1_id = tag1_resp.json()["id"]

    # Tag 2: Tutorial
    tag2_resp = await async_client.post("/api/tags", json={"name": "Tutorial"}, headers={"Authorization": f"Bearer {test_user_token}"})
    tag2_id = tag2_resp.json()["id"]

    # Video 1: Python tag
    video1_resp = await async_client.post("/api/lists/{list_id}/videos", json={"video_id": "dQw4w9WgXcQ"}, headers={"Authorization": f"Bearer {test_user_token}"})
    video1_id = video1_resp.json()["id"]
    await async_client.post(f"/api/videos/{video1_id}/tags", json={"tag_ids": [tag1_id]}, headers={"Authorization": f"Bearer {test_user_token}"})

    # Video 2: Tutorial tag
    video2_resp = await async_client.post("/api/lists/{list_id}/videos", json={"video_id": "9bZkp7q19f0"}, headers={"Authorization": f"Bearer {test_user_token}"})
    video2_id = video2_resp.json()["id"]
    await async_client.post(f"/api/videos/{video2_id}/tags", json={"tag_ids": [tag2_id]}, headers={"Authorization": f"Bearer {test_user_token}"})

    # Filter by Python OR Tutorial
    response = await async_client.get(
        f"/api/videos?tags=Python,Tutorial",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2  # Both videos match
```

**Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/api/test_video_filtering.py::test_filter_videos_by_tags_or -v
```

Expected: FAIL (filter not implemented)

**Step 3: Implement tag filtering in videos endpoint**

```python
# backend/app/api/videos.py
# Modify existing list_videos endpoint:

@router.get("", response_model=list[VideoResponse])
async def list_videos(
    list_id: UUID | None = None,
    tags: str | None = None,  # Comma-separated tag names for OR filter
    tags_all: str | None = None,  # Comma-separated tag names for AND filter
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List videos with optional filtering.

    Query params:
    - list_id: Filter by list
    - tags: OR filter (any matching tag) - comma-separated
    - tags_all: AND filter (all tags required) - comma-separated
    """
    stmt = select(Video).where(Video.user_id == current_user.id)

    # Filter by list
    if list_id:
        stmt = stmt.where(Video.list_id == list_id)

    # Filter by tags (OR logic)
    if tags:
        tag_names = [t.strip() for t in tags.split(',')]
        stmt = stmt.join(Video.tags).where(Tag.name.in_(tag_names)).distinct()

    # Filter by tags (AND logic)
    if tags_all:
        tag_names = [t.strip() for t in tags_all.split(',')]
        # Subquery: videos that have ALL specified tags
        from sqlalchemy import func
        subquery = (
            select(video_tags.c.video_id)
            .join(Tag)
            .where(Tag.name.in_(tag_names))
            .group_by(video_tags.c.video_id)
            .having(func.count(video_tags.c.tag_id) == len(tag_names))
        )
        stmt = stmt.where(Video.id.in_(subquery))

    result = await db.execute(stmt)
    videos = result.scalars().all()
    return videos
```

**Step 4: Run test to verify it passes**

```bash
cd backend
pytest tests/api/test_video_filtering.py::test_filter_videos_by_tags_or -v
```

Expected: PASS

**Step 5: Write test for AND filter**

```python
# backend/tests/api/test_video_filtering.py (add test)

@pytest.mark.asyncio
async def test_filter_videos_by_tags_and(async_client: AsyncClient, test_user_token):
    """Test filtering videos by tags with AND logic."""
    # Setup: Create tags
    tag1_resp = await async_client.post("/api/tags", json={"name": "Python"}, headers={"Authorization": f"Bearer {test_user_token}"})
    tag1_id = tag1_resp.json()["id"]
    tag2_resp = await async_client.post("/api/tags", json={"name": "Advanced"}, headers={"Authorization": f"Bearer {test_user_token}"})
    tag2_id = tag2_resp.json()["id"]

    # Video with both tags
    video1_resp = await async_client.post("/api/lists/{list_id}/videos", json={"video_id": "dQw4w9WgXcQ"}, headers={"Authorization": f"Bearer {test_user_token}"})
    video1_id = video1_resp.json()["id"]
    await async_client.post(f"/api/videos/{video1_id}/tags", json={"tag_ids": [tag1_id, tag2_id]}, headers={"Authorization": f"Bearer {test_user_token}"})

    # Video with only Python tag
    video2_resp = await async_client.post("/api/lists/{list_id}/videos", json={"video_id": "9bZkp7q19f0"}, headers={"Authorization": f"Bearer {test_user_token}"})
    video2_id = video2_resp.json()["id"]
    await async_client.post(f"/api/videos/{video2_id}/tags", json={"tag_ids": [tag1_id]}, headers={"Authorization": f"Bearer {test_user_token}"})

    # Filter by Python AND Advanced
    response = await async_client.get(
        f"/api/videos?tags_all=Python,Advanced",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1  # Only video1 has both tags
```

**Step 6: Run all filtering tests**

```bash
cd backend
pytest tests/api/test_video_filtering.py -v
```

Expected: All tests PASS

**Step 7: Commit**

```bash
git add backend/app/api/videos.py backend/tests/api/test_video_filtering.py
git commit -m "feat: add tag-based video filtering (OR and AND)

- Add 'tags' query param for OR filter
- Add 'tags_all' query param for AND filter
- Implement efficient SQLAlchemy queries
- All tests passing (2/2)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.7: Frontend - Two-Column Layout Component

**Files:**
- Create: `frontend/src/components/TwoColumnLayout.tsx`
- Create: `frontend/src/components/TwoColumnLayout.test.tsx`
- Modify: `frontend/src/App.tsx` (use new layout)

**Step 1: Write failing test for layout**

```tsx
// frontend/src/components/TwoColumnLayout.test.tsx
import { render, screen } from '@testing-library/react';
import { TwoColumnLayout } from './TwoColumnLayout';

describe('TwoColumnLayout', () => {
  it('renders left sidebar and main content', () => {
    render(
      <TwoColumnLayout
        sidebar={<div>Sidebar Content</div>}
        isCollapsed={false}
        onToggle={() => {}}
      >
        <div>Main Content</div>
      </TwoColumnLayout>
    );

    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('collapses sidebar when isCollapsed is true', () => {
    const { container } = render(
      <TwoColumnLayout
        sidebar={<div>Sidebar</div>}
        isCollapsed={true}
        onToggle={() => {}}
      >
        <div>Main</div>
      </TwoColumnLayout>
    );

    const layout = container.firstChild as HTMLElement;
    expect(layout).toHaveClass('sidebar-collapsed');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend
npm test -- TwoColumnLayout.test.tsx
```

Expected: FAIL (component doesn't exist)

**Step 3: Implement TwoColumnLayout component**

```tsx
// frontend/src/components/TwoColumnLayout.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TwoColumnLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
}

export const TwoColumnLayout = ({
  sidebar,
  children,
  isCollapsed,
  onToggle,
}: TwoColumnLayoutProps) => {
  return (
    <div
      className={cn(
        'two-column-layout grid h-screen',
        isCollapsed ? 'grid-cols-[0px_1fr]' : 'grid-cols-[250px_1fr]'
      )}
    >
      <aside
        className={cn(
          'left-sidebar border-r bg-background transition-all duration-300 overflow-y-auto',
          isCollapsed && 'w-0 opacity-0'
        )}
      >
        {!isCollapsed && sidebar}
      </aside>

      <main className="main-content overflow-y-auto p-4 pl-4 pr-0">
        {children}
      </main>
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

```bash
cd frontend
npm test -- TwoColumnLayout.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/TwoColumnLayout.tsx frontend/src/components/TwoColumnLayout.test.tsx
git commit -m "feat: add TwoColumnLayout component

- Responsive 2-column grid layout
- Collapsible sidebar with transition
- Fixed 250px sidebar width
- Tests passing (2/2)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.8: Frontend - Tag Store (Zustand)

**Files:**
- Create: `frontend/src/stores/tagStore.ts`
- Create: `frontend/src/stores/tagStore.test.ts`

**Step 1: Write failing test for tag store**

```tsx
// frontend/src/stores/tagStore.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTagStore } from './tagStore';

describe('useTagStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTagStore.setState({ tags: [], selectedTagIds: [] });
  });

  it('toggles tag selection', () => {
    const { result } = renderHook(() => useTagStore());

    act(() => {
      result.current.toggleTag('tag-1');
    });

    expect(result.current.selectedTagIds).toEqual(['tag-1']);

    act(() => {
      result.current.toggleTag('tag-1');
    });

    expect(result.current.selectedTagIds).toEqual([]);
  });

  it('clears all selected tags', () => {
    const { result } = renderHook(() => useTagStore());

    act(() => {
      result.current.toggleTag('tag-1');
      result.current.toggleTag('tag-2');
    });

    expect(result.current.selectedTagIds).toHaveLength(2);

    act(() => {
      result.current.clearTags();
    });

    expect(result.current.selectedTagIds).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend
npm test -- tagStore.test.ts
```

Expected: FAIL (store doesn't exist)

**Step 3: Implement tag store**

```tsx
// frontend/src/stores/tagStore.ts
import { create } from 'zustand';

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface TagStore {
  tags: Tag[];
  selectedTagIds: string[];
  setTags: (tags: Tag[]) => void;
  toggleTag: (tagId: string) => void;
  clearTags: () => void;
}

export const useTagStore = create<TagStore>((set) => ({
  tags: [],
  selectedTagIds: [],

  setTags: (tags) => set({ tags }),

  toggleTag: (tagId) => set((state) => ({
    selectedTagIds: state.selectedTagIds.includes(tagId)
      ? state.selectedTagIds.filter(id => id !== tagId)
      : [...state.selectedTagIds, tagId]
  })),

  clearTags: () => set({ selectedTagIds: [] }),
}));
```

**Step 4: Run test to verify it passes**

```bash
cd frontend
npm test -- tagStore.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/stores/tagStore.ts frontend/src/stores/tagStore.test.ts
git commit -m "feat: add tag store with Zustand

- Tag state management
- Multi-select tag filtering
- Toggle and clear actions
- Tests passing (2/2)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.9: Frontend - Tag Navigation Component

**Files:**
- Create: `frontend/src/components/TagNavigation.tsx`
- Create: `frontend/src/components/TagNavigation.test.tsx`
- Create: `frontend/src/hooks/useTags.ts` (API hook)

**Step 1: Write API hook for tags**

```tsx
// frontend/src/hooks/useTags.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/lib/api';

const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Tag = z.infer<typeof TagSchema>;

export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await apiClient.get('/api/tags');
      return z.array(TagSchema).parse(response.data);
    },
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const response = await apiClient.post('/api/tags', data);
      return TagSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
};
```

**Step 2: Write failing test for TagNavigation**

```tsx
// frontend/src/components/TagNavigation.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TagNavigation } from './TagNavigation';

const mockTags = [
  { id: '1', name: 'Python', color: '#3B82F6', user_id: 'user1', created_at: '2025-01-01', updated_at: '2025-01-01' },
  { id: '2', name: 'Tutorial', color: '#10B981', user_id: 'user1', created_at: '2025-01-01', updated_at: '2025-01-01' },
];

describe('TagNavigation', () => {
  it('renders tags with names', () => {
    render(
      <TagNavigation
        tags={mockTags}
        selectedTagIds={[]}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    );

    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Tutorial')).toBeInTheDocument();
  });

  it('calls onTagSelect when tag is clicked', () => {
    const onTagSelect = vi.fn();

    render(
      <TagNavigation
        tags={mockTags}
        selectedTagIds={[]}
        onTagSelect={onTagSelect}
        onTagCreate={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Python'));
    expect(onTagSelect).toHaveBeenCalledWith('1');
  });

  it('shows selected state for active tags', () => {
    render(
      <TagNavigation
        tags={mockTags}
        selectedTagIds={['1']}
        onTagSelect={() => {}}
        onTagCreate={() => {}}
      />
    );

    const pythonTag = screen.getByText('Python').closest('button');
    expect(pythonTag).toHaveClass('bg-accent');
  });
});
```

**Step 3: Run test to verify it fails**

```bash
cd frontend
npm test -- TagNavigation.test.tsx
```

Expected: FAIL (component doesn't exist)

**Step 4: Implement TagNavigation component**

```tsx
// frontend/src/components/TagNavigation.tsx
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Tag } from '@/hooks/useTags';

interface TagNavigationProps {
  tags: Tag[];
  selectedTagIds: string[];
  onTagSelect: (tagId: string) => void;
  onTagCreate: () => void;
}

export const TagNavigation = ({
  tags,
  selectedTagIds,
  onTagSelect,
  onTagCreate,
}: TagNavigationProps) => {
  return (
    <div className="tag-navigation p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tags</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onTagCreate}
          aria-label="Tag erstellen"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);

          return (
            <button
              key={tag.id}
              onClick={() => onTagSelect(tag.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                'hover:bg-accent',
                isSelected && 'bg-accent font-medium'
              )}
            >
              {tag.color && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              <span className="flex-1 text-left">{tag.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
```

**Step 5: Run test to verify it passes**

```bash
cd frontend
npm test -- TagNavigation.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/components/TagNavigation.tsx frontend/src/components/TagNavigation.test.tsx frontend/src/hooks/useTags.ts
git commit -m "feat: add TagNavigation component and useTags hook

- Tag list with color indicators
- Multi-select with visual feedback
- Plus icon for creating tags
- API hook for fetching tags
- Tests passing (3/3)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.10: Frontend - Integrate Layout & Navigation

**Files:**
- Modify: `frontend/src/pages/VideosPage.tsx` (use TwoColumnLayout + TagNavigation)
- Modify: `frontend/src/App.tsx` (set default route to /videos)

**Step 1: Update VideosPage to use new layout**

```tsx
// frontend/src/pages/VideosPage.tsx
import { useState } from 'react';
import { TwoColumnLayout } from '@/components/TwoColumnLayout';
import { TagNavigation } from '@/components/TagNavigation';
import { useTags } from '@/hooks/useTags';
import { useTagStore } from '@/stores/tagStore';
// ... existing imports

export const VideosPage = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: tags = [] } = useTags();
  const { selectedTagIds, toggleTag } = useTagStore();

  // TODO: Implement create tag dialog
  const handleCreateTag = () => {
    console.log('Create tag clicked');
  };

  return (
    <TwoColumnLayout
      sidebar={
        <TagNavigation
          tags={tags}
          selectedTagIds={selectedTagIds}
          onTagSelect={toggleTag}
          onTagCreate={handleCreateTag}
        />
      }
      isCollapsed={sidebarCollapsed}
      onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
    >
      {/* Existing video table code */}
      <div className="video-table-container">
        {/* ... existing VideoTable component ... */}
      </div>
    </TwoColumnLayout>
  );
};
```

**Step 2: Update App.tsx default route**

```tsx
// frontend/src/App.tsx
import { Navigate } from 'react-router-dom';

// In Routes:
<Routes>
  <Route path="/" element={<Navigate to="/videos" replace />} />  {/* Changed from /dashboard */}
  <Route path="/videos" element={<VideosPage />} />
  {/* Keep other routes but hide navigation to lists/dashboard */}
</Routes>
```

**Step 3: Test in browser**

```bash
cd frontend
npm run dev
```

Manual test:
1. Navigate to http://localhost:5173
2. Should redirect to /videos
3. Should see 2-column layout with tags sidebar
4. Click tags to filter (no videos yet, but selection should work)
5. Toggle sidebar collapse

**Step 4: Commit**

```bash
git add frontend/src/pages/VideosPage.tsx frontend/src/App.tsx
git commit -m "feat: integrate TwoColumnLayout and TagNavigation

- VideosPage uses new 2-column layout
- TagNavigation in left sidebar
- Default route set to /videos
- Sidebar collapsible
- Manual testing confirmed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.11: Frontend - Connect Tag Filter to Video API

**Files:**
- Modify: `frontend/src/hooks/useVideos.ts` (add tag filter param)
- Modify: `frontend/src/pages/VideosPage.tsx` (use filtered videos)

**Step 1: Update useVideos hook to accept tag filter**

```tsx
// frontend/src/hooks/useVideos.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export const useVideos = (listId?: string, tagIds?: string[]) => {
  return useQuery({
    queryKey: ['videos', listId, tagIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (listId) params.append('list_id', listId);
      if (tagIds && tagIds.length > 0) {
        // Convert tag IDs to comma-separated string
        params.append('tags', tagIds.join(','));
      }

      const response = await apiClient.get(`/api/videos?${params}`);
      return VideoResponseSchema.array().parse(response.data);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
```

**Step 2: Update VideosPage to use tag filter**

```tsx
// frontend/src/pages/VideosPage.tsx
export const VideosPage = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: tags = [] } = useTags();
  const { selectedTagIds, toggleTag } = useTagStore();

  // Fetch videos filtered by selected tags
  const { data: videos = [], isLoading } = useVideos(undefined, selectedTagIds);

  return (
    <TwoColumnLayout
      sidebar={<TagNavigation ... />}
      isCollapsed={sidebarCollapsed}
      onToggle={...}
    >
      <div className="video-table-container">
        <h2 className="text-2xl font-bold mb-4">
          {selectedTagIds.length > 0
            ? tags
                .filter(t => selectedTagIds.includes(t.id))
                .map(t => t.name)
                .join(', ')
            : 'Videos'}
        </h2>

        {isLoading ? (
          <p>Loading videos...</p>
        ) : (
          <VideoTable videos={videos} />
        )}
      </div>
    </TwoColumnLayout>
  );
};
```

**Step 3: Test in browser**

Manual test:
1. Create tag via API or manual DB insert
2. Assign tag to video
3. Click tag in sidebar
4. Verify only videos with that tag appear
5. Click multiple tags → verify OR filter

**Step 4: Commit**

```bash
git add frontend/src/hooks/useVideos.ts frontend/src/pages/VideosPage.tsx
git commit -m "feat: connect tag filter to video API

- useVideos hook accepts tag IDs
- Videos filtered by selected tags (OR logic)
- Page title shows selected tag names
- Manual testing confirmed filtering works

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.12: Migration - Delete Extra Lists

**Files:**
- Create: `backend/alembic/versions/2025_10_31_delete_extra_lists.py`

**Step 1: Write Alembic migration to delete extra lists**

```python
"""delete extra lists keep one per user

Revision ID: xyz789abc012
Revises: abc123def456
Create Date: 2025-10-31
"""
from alembic import op
import sqlalchemy as sa

revision = 'xyz789abc012'
down_revision = 'abc123def456'
branch_labels = None
depends_on = None

def upgrade():
    # Keep first list per user (by created_at), delete rest
    op.execute("""
        DELETE FROM lists
        WHERE id NOT IN (
            SELECT DISTINCT ON (user_id) id
            FROM lists
            ORDER BY user_id, created_at ASC
        )
    """)

    # Note: Lists table structure remains intact for future "Workspaces" feature

def downgrade():
    # Cannot restore deleted lists
    # Manual intervention required if rollback needed
    pass
```

**Step 2: Run migration**

```bash
cd backend
alembic upgrade head
```

Expected: Migration runs, extra lists deleted

**Step 3: Verify in database**

```bash
docker exec -it smart-youtube-bookmarks-postgres-1 psql -U postgres -d youtube_bookmarks

SELECT user_id, COUNT(*) FROM lists GROUP BY user_id;
```

Expected: Each user has exactly 1 list

**Step 4: Commit**

```bash
git add backend/alembic/versions/2025_10_31_delete_extra_lists.py
git commit -m "feat: delete extra lists, keep one per user

- Migration keeps first list per user
- Lists table structure preserved for Workspaces
- Cannot downgrade (data loss)
- Verified in database

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.13: UI Cleanup - Remove List/Dashboard Navigation

**Files:**
- Modify: `frontend/src/components/Navigation.tsx` (or wherever nav links are)
- Modify: `frontend/src/pages/VideosPage.tsx` (remove "Back to List" link)

**Step 1: Remove navigation links to Lists and Dashboard**

```tsx
// frontend/src/components/Navigation.tsx (or similar)
// Comment out or remove these links:

// REMOVED: Navigation to Lists page
// <NavLink to="/lists">Listen</NavLink>

// REMOVED: Navigation to Dashboard
// <NavLink to="/dashboard">Dashboard</NavLink>

// Keep only:
<NavLink to="/videos">Videos</NavLink>
```

**Step 2: Remove "Back to List" link from VideosPage**

```tsx
// frontend/src/pages/VideosPage.tsx
// Remove or comment out:
// <Link to="/lists">← Zurück zur Liste</Link>
```

**Step 3: Test in browser**

Manual test:
1. Navigate to /videos
2. Verify no "Back to List" link
3. Verify navigation doesn't show Lists or Dashboard
4. Verify /lists and /dashboard still work if accessed directly (API intact)

**Step 4: Commit**

```bash
git add frontend/src/components/Navigation.tsx frontend/src/pages/VideosPage.tsx
git commit -m "feat: remove Lists and Dashboard from UI navigation

- Hide navigation links to Lists and Dashboard pages
- Remove 'Back to List' link from VideosPage
- Backend API routes remain intact
- Manual testing confirmed UI cleanup

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🎉 WAVE 1 COMPLETE

**Erfolgskriterium:**
✅ User erstellt Tag "Python" → Weist Video zu → Klickt Tag in Sidebar → Nur Python-Videos sichtbar

**Next:** Wave 2 - UI Cleanup & Enhanced UX

---

## 🌊 WAVE 2: UI-Cleanup & Enhanced UX (Polish)

### Task 2.1: Hide Action Buttons (Feature Flags)

**Files:**
- Modify: `frontend/src/pages/VideosPage.tsx`

**Step 1: Add feature flags to hide buttons**

```tsx
// frontend/src/pages/VideosPage.tsx
// At top of file:
const SHOW_ADD_VIDEO_BUTTON = false;
const SHOW_CSV_UPLOAD_BUTTON = false;
const SHOW_CSV_EXPORT_BUTTON = false;

// In component:
export const VideosPage = () => {
  return (
    <TwoColumnLayout ...>
      <div className="video-table-container">
        {/* Conditionally render buttons */}
        {SHOW_ADD_VIDEO_BUTTON && (
          <Button onClick={handleAddVideo}>Video hinzufügen</Button>
        )}

        {SHOW_CSV_UPLOAD_BUTTON && (
          <Button onClick={handleCsvUpload}>CSV Upload</Button>
        )}

        {SHOW_CSV_EXPORT_BUTTON && (
          <Button onClick={handleCsvExport}>CSV Export</Button>
        )}

        {/* Video table */}
      </div>
    </TwoColumnLayout>
  );
};
```

**Step 2: Test in browser**

Manual test:
1. Verify buttons are hidden
2. Change flags to true → buttons appear
3. Change back to false

**Step 3: Commit**

```bash
git add frontend/src/pages/VideosPage.tsx
git commit -m "feat: hide action buttons via feature flags

- Add SHOW_*_BUTTON feature flags
- Hide Video hinzufügen, CSV Upload, CSV Export
- Functions remain in code for future use
- Manual testing confirmed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.2: Table Settings Store (Thumbnail Size, Columns)

**Files:**
- Create: `frontend/src/stores/tableSettingsStore.ts`
- Create: `frontend/src/stores/tableSettingsStore.test.ts`

**Step 1: Write failing test**

```tsx
// frontend/src/stores/tableSettingsStore.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTableSettingsStore } from './tableSettingsStore';

describe('useTableSettingsStore', () => {
  it('changes thumbnail size', () => {
    const { result } = renderHook(() => useTableSettingsStore());

    expect(result.current.thumbnailSize).toBe('small');

    act(() => {
      result.current.setThumbnailSize('large');
    });

    expect(result.current.thumbnailSize).toBe('large');
  });

  it('toggles column visibility', () => {
    const { result } = renderHook(() => useTableSettingsStore());

    act(() => {
      result.current.toggleColumn('duration');
    });

    expect(result.current.visibleColumns.duration).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend
npm test -- tableSettingsStore.test.ts
```

Expected: FAIL

**Step 3: Implement store with persistence**

```tsx
// frontend/src/stores/tableSettingsStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThumbnailSize = 'small' | 'medium' | 'large';

interface VisibleColumns {
  thumbnail: boolean;
  title: boolean;
  channel: boolean;
  duration: boolean;
  tags: boolean;
}

interface TableSettingsStore {
  thumbnailSize: ThumbnailSize;
  visibleColumns: VisibleColumns;
  setThumbnailSize: (size: ThumbnailSize) => void;
  toggleColumn: (column: keyof VisibleColumns) => void;
}

export const useTableSettingsStore = create<TableSettingsStore>()(
  persist(
    (set) => ({
      thumbnailSize: 'small',
      visibleColumns: {
        thumbnail: true,
        title: true,
        channel: true,
        duration: true,
        tags: true,
      },

      setThumbnailSize: (size) => set({ thumbnailSize: size }),

      toggleColumn: (column) => set((state) => ({
        visibleColumns: {
          ...state.visibleColumns,
          [column]: !state.visibleColumns[column],
        },
      })),
    }),
    {
      name: 'videoTableSettings',  // LocalStorage key
    }
  )
);
```

**Step 4: Run test to verify it passes**

```bash
cd frontend
npm test -- tableSettingsStore.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/stores/tableSettingsStore.ts frontend/src/stores/tableSettingsStore.test.ts
git commit -m "feat: add table settings store with persistence

- Thumbnail size (small/medium/large)
- Column visibility toggles
- LocalStorage persistence
- Tests passing (2/2)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.3: Table Settings Dropdown Component

**Files:**
- Create: `frontend/src/components/TableSettingsDropdown.tsx`
- Create: `frontend/src/components/TableSettingsDropdown.test.tsx`

**Step 1: Write failing test**

```tsx
// frontend/src/components/TableSettingsDropdown.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TableSettingsDropdown } from './TableSettingsDropdown';

describe('TableSettingsDropdown', () => {
  it('renders settings icon', () => {
    render(<TableSettingsDropdown onExportFiltered={() => {}} onExportAll={() => {}} />);

    const trigger = screen.getByLabelText('Einstellungen');
    expect(trigger).toBeInTheDocument();
  });

  it('shows thumbnail size options when opened', async () => {
    render(<TableSettingsDropdown onExportFiltered={() => {}} onExportAll={() => {}} />);

    fireEvent.click(screen.getByLabelText('Einstellungen'));

    expect(await screen.findByText('Klein')).toBeInTheDocument();
    expect(await screen.findByText('Mittel')).toBeInTheDocument();
    expect(await screen.findByText('Groß')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend
npm test -- TableSettingsDropdown.test.tsx
```

Expected: FAIL

**Step 3: Implement component**

```tsx
// frontend/src/components/TableSettingsDropdown.tsx
import { SettingsIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useTableSettingsStore } from '@/stores/tableSettingsStore';

interface TableSettingsDropdownProps {
  onExportFiltered: () => void;
  onExportAll: () => void;
}

export const TableSettingsDropdown = ({
  onExportFiltered,
  onExportAll,
}: TableSettingsDropdownProps) => {
  const { thumbnailSize, setThumbnailSize, visibleColumns, toggleColumn } =
    useTableSettingsStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Einstellungen">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {/* Thumbnail Size */}
        <DropdownMenuLabel>Thumbnail-Größe</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={thumbnailSize} onValueChange={setThumbnailSize}>
          <DropdownMenuRadioItem value="small">Klein</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="medium">Mittel</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="large">Groß</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Export Options */}
        <DropdownMenuLabel>Exportieren</DropdownMenuLabel>
        <DropdownMenuItem onClick={onExportFiltered}>
          Gefilterte Videos exportieren
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportAll}>
          Alle Videos exportieren
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Column Visibility */}
        <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={visibleColumns.thumbnail}
          onCheckedChange={() => toggleColumn('thumbnail')}
        >
          Thumbnail
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibleColumns.title}
          onCheckedChange={() => toggleColumn('title')}
        >
          Titel
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibleColumns.channel}
          onCheckedChange={() => toggleColumn('channel')}
        >
          Channel
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibleColumns.duration}
          onCheckedChange={() => toggleColumn('duration')}
        >
          Duration
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibleColumns.tags}
          onCheckedChange={() => toggleColumn('tags')}
        >
          Tags
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

**Step 4: Run test to verify it passes**

```bash
cd frontend
npm test -- TableSettingsDropdown.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/TableSettingsDropdown.tsx frontend/src/components/TableSettingsDropdown.test.tsx
git commit -m "feat: add TableSettingsDropdown component

- Thumbnail size selection (3 options)
- Export filtered/all videos
- Column visibility toggles
- shadcn/ui dropdown components
- Tests passing (2/2)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.4: Three-Dot Menu & Clickable Rows

**Files:**
- Modify: `frontend/src/components/VideoTable.tsx`

**Step 1: Remove Actions column, add three-dot menu**

```tsx
// frontend/src/components/VideoTable.tsx
import { MoreVerticalIcon, TrashIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// In column definitions:
const columns = [
  // ... existing columns (thumbnail, title, channel, duration)

  // REMOVE: Actions column
  // {
  //   id: 'actions',
  //   header: 'Aktionen',
  //   cell: ({ row }) => <Button onClick={...}>Löschen</Button>
  // }

  // ADD: Three-dot menu column
  {
    id: 'menu',
    header: '',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Aktionen"
            onClick={(e) => e.stopPropagation()}  // Prevent row click
          >
            <MoreVerticalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row.original.id);
            }}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

// Make rows clickable:
<TableRow
  key={row.id}
  onClick={() => handleRowClick(row.original)}
  className="cursor-pointer hover:bg-accent transition-colors"
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleRowClick(row.original);
    }
  }}
>
  {row.getVisibleCells().map((cell) => (
    <TableCell key={cell.id}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  ))}
</TableRow>
```

**Step 2: Test in browser**

Manual test:
1. Click on row (not menu) → video opens
2. Click three-dot menu → dropdown opens
3. Click Löschen → delete action fires (not row click)
4. Hover over row → background changes

**Step 3: Commit**

```bash
git add frontend/src/components/VideoTable.tsx
git commit -m "feat: replace Actions column with three-dot menu

- Add three-dot menu (⋮) in each row
- Remove Actions column
- Make entire row clickable (except menu)
- Add hover states with cursor pointer
- Manual testing confirmed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.5: Confirm Delete Modal

**Files:**
- Create: `frontend/src/components/ConfirmDeleteModal.tsx`
- Create: `frontend/src/components/ConfirmDeleteModal.test.tsx`
- Modify: `frontend/src/components/VideoTable.tsx` (use modal instead of toast)

**Step 1: Write failing test**

```tsx
// frontend/src/components/ConfirmDeleteModal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

describe('ConfirmDeleteModal', () => {
  it('shows video title in confirmation', () => {
    render(
      <ConfirmDeleteModal
        isOpen={true}
        videoTitle="Test Video"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText(/Test Video/)).toBeInTheDocument();
  });

  it('calls onConfirm when delete button clicked', () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDeleteModal
        isOpen={true}
        videoTitle="Test"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /löschen/i }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend
npm test -- ConfirmDeleteModal.test.tsx
```

Expected: FAIL

**Step 3: Implement modal**

```tsx
// frontend/src/components/ConfirmDeleteModal.tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  videoTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal = ({
  isOpen,
  videoTitle,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Video löschen?</DialogTitle>
          <DialogDescription>
            Video "{videoTitle}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

**Step 4: Update VideoTable to use modal**

```tsx
// frontend/src/components/VideoTable.tsx
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export const VideoTable = ({ videos }: VideoTableProps) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);

  const handleDeleteClick = (video: Video) => {
    setVideoToDelete(video);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!videoToDelete) return;

    await deleteVideo(videoToDelete.id);
    setDeleteModalOpen(false);
    setVideoToDelete(null);
    // Optional: success toast
  };

  return (
    <>
      {/* Table code */}

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        videoTitle={videoToDelete?.title || ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </>
  );
};
```

**Step 5: Run test to verify it passes**

```bash
cd frontend
npm test -- ConfirmDeleteModal.test.tsx
```

Expected: PASS

**Step 6: Test in browser**

Manual test:
1. Click three-dot menu → Löschen
2. Modal appears with video title
3. Click Abbrechen → modal closes
4. Click Löschen → video deleted

**Step 7: Commit**

```bash
git add frontend/src/components/ConfirmDeleteModal.tsx frontend/src/components/ConfirmDeleteModal.test.tsx frontend/src/components/VideoTable.tsx
git commit -m "feat: add confirm delete modal

- Modal shows video title in confirmation
- Replaces browser toast notification
- Abbrechen/Löschen buttons
- Tests passing (2/2)
- Manual testing confirmed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.6: Plus Icon & Add Video Dialog

**Files:**
- Modify: `frontend/src/pages/VideosPage.tsx` (add plus icon, reuse hidden upload function)

**Step 1: Add plus icon to page header**

```tsx
// frontend/src/pages/VideosPage.tsx
import { PlusIcon } from 'lucide-react';
import { TableSettingsDropdown } from '@/components/TableSettingsDropdown';

export const VideosPage = () => {
  const [addVideoDialogOpen, setAddVideoDialogOpen] = useState(false);

  return (
    <TwoColumnLayout ...>
      <div className="video-table-container">
        {/* Header with title, plus icon, settings */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            {selectedTagIds.length > 0 ? tagNames : 'Videos'}
          </h2>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAddVideoDialogOpen(true)}
              aria-label="Video hinzufügen"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>

            <TableSettingsDropdown
              onExportFiltered={handleExportFiltered}
              onExportAll={handleExportAll}
            />
          </div>
        </div>

        {/* Add Video Dialog (reuse existing component) */}
        <AddVideoDialog
          isOpen={addVideoDialogOpen}
          onClose={() => setAddVideoDialogOpen(false)}
          onSubmit={handleAddVideo}  // Existing function from hidden button
        />

        {/* Video table */}
      </div>
    </TwoColumnLayout>
  );
};
```

**Step 2: Test in browser**

Manual test:
1. Click plus icon → dialog opens
2. Enter YouTube URL → submit
3. Video added successfully

**Step 3: Commit**

```bash
git add frontend/src/pages/VideosPage.tsx
git commit -m "feat: add plus icon for manual video upload

- Plus icon in page header (top right)
- Opens existing add video dialog
- Reuses hidden upload function
- Settings dropdown next to plus icon
- Manual testing confirmed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.7: Thumbnail Size Styling

**Files:**
- Create: `frontend/src/styles/thumbnail-sizes.css`
- Modify: `frontend/src/components/VideoTable.tsx` (apply thumbnail classes)

**Step 1: Define CSS classes for thumbnail sizes**

```css
/* frontend/src/styles/thumbnail-sizes.css */
.thumbnail-sm {
  width: 160px;
  height: 90px;  /* 16:9 aspect ratio */
  object-fit: cover;
}

.thumbnail-md {
  width: 240px;
  height: 135px;
}

.thumbnail-lg {
  width: 640px;
  height: 360px;
}

/* Large thumbnail row uses more horizontal space for metadata */
.large-thumbnail-row {
  display: grid;
  grid-template-columns: 640px 1fr auto;  /* thumbnail | metadata | menu */
  gap: 1rem;
  align-items: start;
}

.large-thumbnail-row .metadata-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem 1rem;
  padding: 0.5rem 0;
}
```

**Step 2: Import styles in main CSS**

```css
/* frontend/src/index.css */
@import './styles/thumbnail-sizes.css';
```

**Step 3: Apply classes in VideoTable**

```tsx
// frontend/src/components/VideoTable.tsx
import { useTableSettingsStore } from '@/stores/tableSettingsStore';
import { cn } from '@/lib/utils';

export const VideoTable = ({ videos }: VideoTableProps) => {
  const { thumbnailSize, visibleColumns } = useTableSettingsStore();

  const thumbnailClass = cn({
    'thumbnail-sm': thumbnailSize === 'small',
    'thumbnail-md': thumbnailSize === 'medium',
    'thumbnail-lg': thumbnailSize === 'large',
  });

  // In thumbnail column:
  {
    id: 'thumbnail',
    header: 'Thumbnail',
    cell: ({ row }) => (
      <img
        src={row.original.thumbnail_url}
        alt={row.original.title}
        className={thumbnailClass}
        loading="lazy"
      />
    ),
  },

  // For large size, use different row layout:
  return (
    <Table>
      <TableHeader>...</TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          thumbnailSize === 'large' ? (
            <TableRow key={row.id} className="large-thumbnail-row" onClick={...}>
              <TableCell>
                <img src={row.original.thumbnail_url} className="thumbnail-lg" />
              </TableCell>
              <TableCell className="metadata-grid">
                <div><strong>Titel:</strong> {row.original.title}</div>
                <div><strong>Channel:</strong> {row.original.channel_name}</div>
                <div><strong>Duration:</strong> {formatDuration(row.original.duration)}</div>
                <div><strong>Published:</strong> {row.original.published_at}</div>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <ThreeDotsMenu onDelete={() => handleDelete(row.original)} />
              </TableCell>
            </TableRow>
          ) : (
            <TableRow key={row.id} onClick={...}>
              {/* Standard row layout */}
            </TableRow>
          )
        ))}
      </TableBody>
    </Table>
  );
};
```

**Step 4: Test in browser**

Manual test:
1. Open settings → select "Klein" → thumbnails are 160px
2. Select "Mittel" → thumbnails are 240px
3. Select "Groß" → thumbnails are 640px with metadata grid

**Step 5: Commit**

```bash
git add frontend/src/styles/thumbnail-sizes.css frontend/src/index.css frontend/src/components/VideoTable.tsx
git commit -m "feat: implement thumbnail size styling

- Add CSS classes for small/medium/large
- Large size uses grid layout with more metadata
- Responsive thumbnail scaling
- Manual testing confirmed all 3 sizes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🎉 WAVE 2 COMPLETE

**Erfolgskriterium:**
✅ User klickt Settings → Thumbnail "Groß" → Mehr Spalten sichtbar → Zeile klickt → Video öffnet → 3-Punkt-Menü → Löschen → Modal erscheint

**Next:** Wave 3 - Advanced Features

---

## 🌊 WAVE 3: Advanced Features (CSV, Drag & Drop, Auto-Tagging)

[Due to length constraints, Wave 3 tasks will follow the same pattern with 10-15 more tasks covering CSV optimization, drag & drop implementation, and auto-tagging features]

---

## Execution Options

Plan complete and saved to `docs/plans/2025-10-31-ux-optimization-implementation-plan.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
