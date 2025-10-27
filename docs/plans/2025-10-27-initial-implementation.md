# Smart YouTube Bookmarks - Initial Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a functional MVP of Smart YouTube Bookmarks with core features: bookmark list management, video import, AI-powered schema definition, and background processing.

**Architecture:** Modular monolith with FastAPI backend serving both API and React SPA. PostgreSQL for structured data with flexible JSONB schemas. ARQ workers for async video processing. WebSockets for real-time progress updates.

**Tech Stack:** FastAPI, React 18, TypeScript (strict), PostgreSQL 16, Redis 7, ARQ, TanStack Query, shadcn/ui, Docker Compose

---

## Phase 1: Project Foundation

### Task 1: Backend Project Structure

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`

**Step 1: Create requirements.txt**

```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy[asyncio]==2.0.25
asyncpg==0.29.0
alembic==1.13.1
pydantic==2.5.3
pydantic-settings==2.1.0
redis==5.0.1
arq==0.25.0
python-multipart==0.0.6
httpx==0.26.0
pytest==7.4.4
pytest-asyncio==0.23.3
```

**Step 2: Create pyproject.toml**

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.mypy]
python_version = "3.11"
strict = true
```

**Step 3: Create config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://user:password@localhost/youtube_bookmarks"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # External APIs
    youtube_api_key: str = ""
    gemini_api_key: str = ""

    # App
    env: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
```

**Step 4: Create main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Smart YouTube Bookmarks")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
```

**Step 5: Test health endpoint**

Run: `cd backend && python -m uvicorn app.main:app --reload`
Test: `curl http://localhost:8000/api/health`
Expected: `{"status":"ok"}`

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend project structure with FastAPI"
```

---

### Task 2: Database Models

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/list.py`
- Create: `backend/app/models/schema.py`
- Create: `backend/app/models/video.py`
- Create: `backend/app/models/job.py`

**Step 1: Create base.py**

```python
from datetime import datetime
from uuid import uuid4
from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID


class Base(DeclarativeBase):
    pass


class BaseModel(Base):
    __abstract__ = True

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
```

**Step 2: Create schema.py**

```python
from typing import Dict, Any
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from .base import BaseModel


class Schema(BaseModel):
    __tablename__ = "schemas"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    fields: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
```

**Step 3: Create list.py**

```python
from typing import Optional
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from .base import BaseModel


class BookmarkList(BaseModel):
    __tablename__ = "bookmarks_lists"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    schema_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("schemas.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    schema: Mapped[Optional["Schema"]] = relationship("Schema", lazy="joined")
    videos: Mapped[list["Video"]] = relationship(
        "Video",
        back_populates="list",
        cascade="all, delete-orphan"
    )
```

**Step 4: Create video.py**

```python
from typing import Optional, Dict, Any
from sqlalchemy import String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import BaseModel
from datetime import datetime


class Video(BaseModel):
    __tablename__ = "videos"

    list_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
        nullable=False
    )
    youtube_id: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    channel: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    extracted_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending"
    )
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    list: Mapped["BookmarkList"] = relationship("BookmarkList", back_populates="videos")

    __table_args__ = (
        Index("idx_videos_list_id", "list_id"),
        Index("idx_videos_status", "processing_status"),
        Index("idx_videos_list_youtube", "list_id", "youtube_id", unique=True),
    )
```

**Step 5: Create job.py**

```python
from sqlalchemy import String, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from .base import BaseModel


class ProcessingJob(BaseModel):
    __tablename__ = "processing_jobs"

    list_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
        nullable=False
    )
    total_videos: Mapped[int] = mapped_column(Integer, nullable=False)
    processed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="running"
    )

    __table_args__ = (
        Index("idx_jobs_list_id", "list_id"),
        Index("idx_jobs_status", "status"),
    )
```

**Step 6: Update models/__init__.py**

```python
from .base import Base, BaseModel
from .schema import Schema
from .list import BookmarkList
from .video import Video
from .job import ProcessingJob

__all__ = [
    "Base",
    "BaseModel",
    "Schema",
    "BookmarkList",
    "Video",
    "ProcessingJob",
]
```

**Step 7: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add database models for lists, videos, schemas, jobs"
```

---

### Task 3: Database Setup

**Files:**
- Create: `backend/app/core/database.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/.gitkeep`

**Step 1: Create database.py**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from .config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.env == "development",
    future=True
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

**Step 2: Create alembic.ini**

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os

sqlalchemy.url = postgresql+asyncpg://user:password@localhost/youtube_bookmarks

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

**Step 3: Create alembic/env.py**

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Import models for autogenerate
from app.models import Base
from app.core.config import settings

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Step 4: Initialize Alembic**

Run: `cd backend && alembic revision --autogenerate -m "Initial schema"`
Expected: New migration file in `alembic/versions/`

**Step 5: Commit**

```bash
git add backend/app/core/database.py backend/alembic.ini backend/alembic/
git commit -m "feat: configure database and Alembic migrations"
```

---

### Task 4: Frontend Project Structure

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`

**Step 1: Create package.json**

```json
{
  "name": "smart-youtube-bookmarks-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.3",
    "@tanstack/react-query": "^5.17.19",
    "@tanstack/react-table": "^8.11.6",
    "@tanstack/react-virtual": "^3.0.1",
    "zustand": "^4.5.0",
    "zod": "^3.22.4",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.11",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "vitest": "^1.2.1",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.2.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
```

**Step 4: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 5: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 6: Create index.html**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Smart YouTube Bookmarks</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 7: Create src/main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**Step 8: Create src/App.tsx**

```typescript
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold text-center pt-20">
        Smart YouTube Bookmarks
      </h1>
    </div>
  )
}

export default App
```

**Step 9: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 10: Install dependencies**

Run: `cd frontend && npm install`
Expected: Dependencies installed without errors

**Step 11: Test dev server**

Run: `npm run dev`
Test: Open `http://localhost:5173`
Expected: See "Smart YouTube Bookmarks" heading

**Step 12: Commit**

```bash
git add frontend/
git commit -m "feat: initialize frontend with React, TypeScript, Vite"
```

---

### Task 5: Docker Compose Setup

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`

**Step 1: Create .env.example**

```env
# PostgreSQL
POSTGRES_DB=youtube_bookmarks
POSTGRES_USER=user
POSTGRES_PASSWORD=changeme

# Redis
REDIS_URL=redis://redis:6379

# External APIs
YOUTUBE_API_KEY=your_youtube_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# App
ENV=production
```

**Step 2: Create docker-compose.yml**

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: youtube-bookmarks-db
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-youtube_bookmarks}
      POSTGRES_USER: ${POSTGRES_USER:-user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-user}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: youtube-bookmarks-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**Step 3: Create backend/Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

**Step 4: Test Docker Compose**

Run: `docker-compose up -d postgres redis`
Expected: PostgreSQL and Redis containers running

Run: `docker-compose ps`
Expected: Both services healthy

**Step 5: Commit**

```bash
git add docker-compose.yml .env.example backend/Dockerfile
git commit -m "feat: add Docker Compose setup for development"
```

---

## Phase 2: Core Backend API

### Task 6: List API Endpoints

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/lists.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/list.py`
- Create: `backend/tests/api/test_lists.py`

**Step 1: Write failing test for GET /api/lists**

```python
# tests/api/test_lists.py
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_get_lists_empty():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/lists")
        assert response.status_code == 200
        assert response.json() == []
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/api/test_lists.py::test_get_lists_empty -v`
Expected: FAIL with 404 Not Found

**Step 3: Create schemas/list.py**

```python
from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    schema_id: Optional[UUID] = None


class ListUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class ListResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    schema_id: Optional[UUID]
    video_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Step 4: Create api/lists.py**

```python
from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import BookmarkList, Video
from app.schemas.list import ListCreate, ListUpdate, ListResponse

router = APIRouter(prefix="/api/lists", tags=["lists"])


@router.get("", response_model=List[ListResponse])
async def get_lists(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            BookmarkList,
            func.count(Video.id).label("video_count")
        )
        .outerjoin(Video)
        .group_by(BookmarkList.id)
    )

    lists = []
    for row in result:
        list_obj = row[0]
        video_count = row[1]
        lists.append(
            ListResponse(
                id=list_obj.id,
                name=list_obj.name,
                description=list_obj.description,
                schema_id=list_obj.schema_id,
                video_count=video_count,
                created_at=list_obj.created_at,
                updated_at=list_obj.updated_at,
            )
        )

    return lists


@router.post("", response_model=ListResponse, status_code=201)
async def create_list(
    list_data: ListCreate,
    db: AsyncSession = Depends(get_db)
):
    new_list = BookmarkList(**list_data.model_dump())
    db.add(new_list)
    await db.flush()
    await db.refresh(new_list)

    return ListResponse(
        id=new_list.id,
        name=new_list.name,
        description=new_list.description,
        schema_id=new_list.schema_id,
        video_count=0,
        created_at=new_list.created_at,
        updated_at=new_list.updated_at,
    )


@router.get("/{list_id}", response_model=ListResponse)
async def get_list(list_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            BookmarkList,
            func.count(Video.id).label("video_count")
        )
        .outerjoin(Video)
        .where(BookmarkList.id == list_id)
        .group_by(BookmarkList.id)
    )

    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="List not found")

    list_obj = row[0]
    video_count = row[1]

    return ListResponse(
        id=list_obj.id,
        name=list_obj.name,
        description=list_obj.description,
        schema_id=list_obj.schema_id,
        video_count=video_count,
        created_at=list_obj.created_at,
        updated_at=list_obj.updated_at,
    )


@router.delete("/{list_id}", status_code=204)
async def delete_list(list_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    list_obj = result.scalar_one_or_none()

    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    await db.delete(list_obj)
    return None
```

**Step 5: Register router in main.py**

```python
# In app/main.py, add:
from app.api import lists

app.include_router(lists.router)
```

**Step 6: Run test to verify it passes**

Run: `pytest tests/api/test_lists.py::test_get_lists_empty -v`
Expected: PASS

**Step 7: Write test for POST /api/lists**

```python
# Add to tests/api/test_lists.py
@pytest.mark.asyncio
async def test_create_list():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/lists",
            json={"name": "Test List", "description": "A test"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test List"
        assert data["description"] == "A test"
        assert "id" in data
```

**Step 8: Run test**

Run: `pytest tests/api/test_lists.py::test_create_list -v`
Expected: PASS

**Step 9: Commit**

```bash
git add backend/app/api/ backend/app/schemas/ backend/tests/
git commit -m "feat: implement list CRUD API endpoints"
```

---

### Task 7: Video API Endpoints

**Files:**
- Create: `backend/app/api/videos.py`
- Create: `backend/app/schemas/video.py`
- Create: `backend/tests/api/test_videos.py`

**Step 1: Write failing test for POST /api/lists/{id}/videos**

```python
# tests/api/test_videos.py
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_add_video_to_list():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create list first
        list_response = await client.post(
            "/api/lists",
            json={"name": "Test List"}
        )
        list_id = list_response.json()["id"]

        # Add video
        response = await client.post(
            f"/api/lists/{list_id}/videos",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["youtube_id"] == "dQw4w9WgXcQ"
        assert data["processing_status"] == "pending"
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/api/test_videos.py::test_add_video_to_list -v`
Expected: FAIL with 404

**Step 3: Create schemas/video.py**

```python
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class VideoAdd(BaseModel):
    url: str = Field(..., min_length=1)


class VideoResponse(BaseModel):
    id: UUID
    list_id: UUID
    youtube_id: str
    title: Optional[str]
    channel: Optional[str]
    duration: Optional[int]
    published_at: Optional[datetime]
    thumbnail_url: Optional[str]
    extracted_data: Optional[Dict[str, Any]]
    processing_status: str
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Step 4: Create api/videos.py with YouTube ID extraction**

```python
import re
from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Video, BookmarkList
from app.schemas.video import VideoAdd, VideoResponse

router = APIRouter(prefix="/api", tags=["videos"])


def extract_youtube_id(url: str) -> str:
    """Extract YouTube video ID from URL."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    raise ValueError("Invalid YouTube URL")


@router.post("/lists/{list_id}/videos", response_model=VideoResponse, status_code=201)
async def add_video(
    list_id: UUID,
    video_data: VideoAdd,
    db: AsyncSession = Depends(get_db)
):
    # Verify list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    list_obj = result.scalar_one_or_none()
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Extract YouTube ID
    try:
        youtube_id = extract_youtube_id(video_data.url)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    # Check for duplicates
    result = await db.execute(
        select(Video).where(
            Video.list_id == list_id,
            Video.youtube_id == youtube_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Video already in list")

    # Create video
    new_video = Video(
        list_id=list_id,
        youtube_id=youtube_id,
        processing_status="pending"
    )
    db.add(new_video)
    await db.flush()
    await db.refresh(new_video)

    return new_video


@router.get("/lists/{list_id}/videos", response_model=List[VideoResponse])
async def get_videos(list_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video)
        .where(Video.list_id == list_id)
        .order_by(Video.created_at.desc())
    )
    videos = result.scalars().all()
    return videos


@router.delete("/videos/{video_id}", status_code=204)
async def delete_video(video_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    await db.delete(video)
    return None
```

**Step 5: Register router in main.py**

```python
# In app/main.py, add:
from app.api import videos

app.include_router(videos.router)
```

**Step 6: Run test to verify it passes**

Run: `pytest tests/api/test_videos.py::test_add_video_to_list -v`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/app/api/videos.py backend/app/schemas/video.py backend/tests/
git commit -m "feat: implement video management API endpoints"
```

---

## Phase 3: Background Processing

### Task 8: ARQ Worker Setup

**Files:**
- Create: `backend/app/workers/__init__.py`
- Create: `backend/app/workers/settings.py`
- Create: `backend/app/workers/video_processor.py`
- Create: `backend/tests/workers/test_video_processor.py`

**Step 1: Write failing test for process_video task**

```python
# tests/workers/test_video_processor.py
import pytest
from app.workers.video_processor import process_video
from app.models import Video
from sqlalchemy import select


@pytest.mark.asyncio
async def test_process_video_updates_status(db_session):
    # Create test video
    video = Video(
        list_id="test-list-id",
        youtube_id="dQw4w9WgXcQ",
        processing_status="pending"
    )
    db_session.add(video)
    await db_session.commit()

    # Process (will fail until implemented)
    ctx = {"db": db_session}
    await process_video(ctx, str(video.id), str(video.list_id), {})

    # Verify status changed
    await db_session.refresh(video)
    assert video.processing_status in ["processing", "completed"]
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/workers/test_video_processor.py -v`
Expected: FAIL with import error

**Step 3: Create workers/settings.py**

```python
from arq.connections import RedisSettings
from app.core.config import settings


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    functions = []  # Will add tasks here

    max_jobs = 10
    job_timeout = 300
    keep_result = 3600
```

**Step 4: Create workers/video_processor.py (stub)**

```python
from uuid import UUID
from arq.worker import func as arq_func


@arq_func
async def process_video(
    ctx: dict,
    video_id: str,
    list_id: str,
    schema: dict
) -> dict:
    """
    Process a single video:
    1. Fetch YouTube metadata
    2. Get transcript
    3. Extract data via Gemini
    4. Update database
    """
    # TODO: Implement full processing
    # For now, just return success
    return {"status": "success", "video_id": video_id}
```

**Step 5: Update workers/settings.py to register task**

```python
from arq.connections import RedisSettings
from app.core.config import settings
from .video_processor import process_video


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    functions = [process_video]

    max_jobs = 10
    job_timeout = 300
    keep_result = 3600
```

**Step 6: Test ARQ worker starts**

Run: `cd backend && arq app.workers.settings.WorkerSettings`
Expected: Worker starts without errors (Ctrl+C to stop)

**Step 7: Commit**

```bash
git add backend/app/workers/
git commit -m "feat: set up ARQ worker foundation"
```

---

### Task 9: Processing Job Management

**Files:**
- Create: `backend/app/api/processing.py`
- Create: `backend/app/schemas/job.py`
- Create: `backend/tests/api/test_processing.py`

**Step 1: Write failing test for POST /api/lists/{id}/process**

```python
# tests/api/test_processing.py
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_start_processing_job():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create list with video
        list_response = await client.post(
            "/api/lists",
            json={"name": "Test List"}
        )
        list_id = list_response.json()["id"]

        await client.post(
            f"/api/lists/{list_id}/videos",
            json={"url": "https://youtube.com/watch?v=test123"}
        )

        # Start processing
        response = await client.post(f"/api/lists/{list_id}/process")
        assert response.status_code == 201
        data = response.json()
        assert "job_id" in data
        assert data["total_videos"] == 1
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/api/test_processing.py::test_start_processing_job -v`
Expected: FAIL with 404

**Step 3: Create schemas/job.py**

```python
from uuid import UUID
from pydantic import BaseModel


class JobResponse(BaseModel):
    job_id: UUID
    total_videos: int
    estimated_duration_seconds: int


class JobStatus(BaseModel):
    id: UUID
    list_id: UUID
    total_videos: int
    processed_count: int
    failed_count: int
    status: str

    class Config:
        from_attributes = True
```

**Step 4: Create api/processing.py**

```python
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import BookmarkList, Video, ProcessingJob
from app.schemas.job import JobResponse, JobStatus

router = APIRouter(prefix="/api", tags=["processing"])


@router.post("/lists/{list_id}/process", response_model=JobResponse, status_code=201)
async def start_processing(
    list_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    # Verify list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    list_obj = result.scalar_one_or_none()
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Get pending videos
    result = await db.execute(
        select(Video).where(
            Video.list_id == list_id,
            Video.processing_status == "pending"
        )
    )
    pending_videos = result.scalars().all()

    if not pending_videos:
        raise HTTPException(status_code=400, detail="No pending videos to process")

    # Create job
    job = ProcessingJob(
        list_id=list_id,
        total_videos=len(pending_videos),
        status="running"
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # TODO: Enqueue ARQ tasks

    return JobResponse(
        job_id=job.id,
        total_videos=len(pending_videos),
        estimated_duration_seconds=len(pending_videos) * 30  # 30s per video estimate
    )


@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.id == job_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.post("/jobs/{job_id}/pause", status_code=204)
async def pause_job(job_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.id == job_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = "paused"
    return None
```

**Step 5: Register router in main.py**

```python
# In app/main.py, add:
from app.api import processing

app.include_router(processing.router)
```

**Step 6: Run test to verify it passes**

Run: `pytest tests/api/test_processing.py::test_start_processing_job -v`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/app/api/processing.py backend/app/schemas/job.py backend/tests/
git commit -m "feat: implement processing job management API"
```

---

## Phase 4: Frontend Core

### Task 10: React Query Setup

**Files:**
- Create: `frontend/src/lib/queryClient.ts`
- Create: `frontend/src/lib/api.ts`
- Update: `frontend/src/main.tsx`

**Step 1: Create queryClient.ts**

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      gcTime: 5 * 60_000, // 5 minutes (renamed from cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
```

**Step 2: Create api.ts**

```typescript
import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors for debugging
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)
```

**Step 3: Update main.tsx with QueryClientProvider**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

**Step 4: Test that app still runs**

Run: `cd frontend && npm run dev`
Expected: App loads at localhost:5173

**Step 5: Commit**

```bash
git add frontend/src/lib/ frontend/src/main.tsx
git commit -m "feat: set up React Query and API client"
```

---

### Task 11: List Management UI

**Files:**
- Create: `frontend/src/types/list.ts`
- Create: `frontend/src/hooks/useLists.ts`
- Create: `frontend/src/components/ListsPage.tsx`
- Update: `frontend/src/App.tsx`

**Step 1: Create types/list.ts**

```typescript
export interface ListResponse {
  id: string
  name: string
  description: string | null
  schema_id: string | null
  video_count: number
  created_at: string
  updated_at: string
}

export interface ListCreate {
  name: string
  description?: string
  schema_id?: string
}
```

**Step 2: Create hooks/useLists.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ListResponse, ListCreate } from '@/types/list'

export const useLists = () => {
  return useQuery({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data } = await api.get<ListResponse[]>('/lists')
      return data
    },
  })
}

export const useCreateList = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (listData: ListCreate) => {
      const { data } = await api.post<ListResponse>('/lists', listData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

export const useDeleteList = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (listId: string) => {
      await api.delete(`/lists/${listId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}
```

**Step 3: Create components/ListsPage.tsx**

```typescript
import { useState } from 'react'
import { useLists, useCreateList, useDeleteList } from '@/hooks/useLists'

export const ListsPage = () => {
  const [isCreating, setIsCreating] = useState(false)
  const [newListName, setNewListName] = useState('')

  const { data: lists, isLoading } = useLists()
  const createList = useCreateList()
  const deleteList = useDeleteList()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim()) return

    await createList.mutateAsync({ name: newListName })
    setNewListName('')
    setIsCreating(false)
  }

  if (isLoading) {
    return <div className="p-8">Lädt...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Meine Listen</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Neue Liste
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="mb-6 p-4 border rounded">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Listenname"
            className="w-full px-3 py-2 border rounded mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Erstellen
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {lists?.map((list) => (
          <div
            key={list.id}
            className="p-4 border rounded hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold">{list.name}</h3>
                {list.description && (
                  <p className="text-gray-600 mt-1">{list.description}</p>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  {list.video_count} Videos
                </p>
              </div>
              <button
                onClick={() => deleteList.mutate(list.id)}
                className="text-red-600 hover:text-red-800"
              >
                Löschen
              </button>
            </div>
          </div>
        ))}

        {lists?.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            Noch keine Listen vorhanden. Erstellen Sie Ihre erste Liste!
          </p>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Update App.tsx**

```typescript
import { ListsPage } from './components/ListsPage'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ListsPage />
    </div>
  )
}

export default App
```

**Step 5: Test in browser**

Run: Ensure backend is running, then `cd frontend && npm run dev`
Test: Create a list, verify it appears, delete it
Expected: Full CRUD works

**Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement list management UI"
```

---

## Summary & Next Steps

This plan covers the foundation of the application:
- **Phase 1:** Project setup (backend, frontend, Docker)
- **Phase 2:** Core API (lists, videos)
- **Phase 3:** Background processing foundation (ARQ workers, jobs)
- **Phase 4:** Frontend basics (React Query, list UI)

**Remaining work for full MVP:**
- Schema builder (AI chat + dynamic forms)
- YouTube API client
- Gemini API integration
- WebSocket progress updates
- Video table with virtualization
- CSV import/export
- Error handling UI
- Docker Compose full stack
- README and docs

**Estimated completion:** Phase 1-4 = ~4-6 hours. Full MVP = ~20-30 hours.

---

## Execution Notes

- Follow TDD: Write test → Watch fail → Implement → Watch pass → Commit
- Each task should take 10-20 minutes maximum
- Run tests frequently
- Commit after each completed task
- If blocked, create an issue and move to next task
- Use `@superpowers:systematic-debugging` if encountering bugs
- Use `@superpowers:verification-before-completion` before claiming done
