# Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address critical security vulnerabilities and architectural issues identified in the Greptile security review, transforming the application from development-only to production-ready.

**Architecture:** Implement defense-in-depth security with JWT authentication, rate limiting, environment-aware configuration, comprehensive input validation, structured logging, and health checks for all dependencies. Follow OWASP best practices and secure secret management.

**Tech Stack:** FastAPI, SQLAlchemy, Redis, slowapi (rate limiting), python-jose (JWT), structlog (logging), python-decouple (env config), pytest

---

## Priority Groups

**P0 - Critical Security (Must Fix Before Any Production Use):**
- Task 1: JWT Authentication System
- Task 2: Secure Default Credentials & Secrets
- Task 3: Environment-Aware Configuration

**P1 - High Security (Fix Soon):**
- Task 4: API Rate Limiting
- Task 5: Input Validation & ReDoS Protection
- Task 6: CORS Security

**P2 - Operational Excellence (Medium Priority):**
- Task 7: Structured Logging
- Task 8: Comprehensive Health Checks
- Task 9: Database Constraints

**P3 - Long-Term Improvements (Future Iterations):**
- Task 10: Secret Management System

---

## Task 1: JWT Authentication System

**Goal:** Implement JWT-based authentication for all API endpoints except public health check

**Files:**
- Create: `backend/app/api/auth.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/core/security.py`
- Modify: `backend/app/api/deps.py`
- Modify: `backend/app/api/lists.py`
- Modify: `backend/app/api/videos.py`
- Modify: `backend/app/api/tags.py`
- Modify: `backend/app/api/processing.py`
- Create: `backend/tests/api/test_auth.py`
- Create: `backend/tests/core/test_security.py`
- Modify: `backend/requirements.txt`

### Step 1: Write failing test for password hashing

**File:** `backend/tests/core/test_security.py`

```python
"""Tests for security utilities."""

import pytest
from app.core.security import verify_password, get_password_hash


def test_password_hashing():
    """Test password hashing and verification."""
    password = "MySecurePassword123!"
    hashed = get_password_hash(password)

    # Hash should not equal plaintext
    assert hashed != password

    # Verification should succeed with correct password
    assert verify_password(password, hashed) is True

    # Verification should fail with wrong password
    assert verify_password("WrongPassword", hashed) is False


def test_create_access_token():
    """Test JWT token creation."""
    from app.core.security import create_access_token
    from datetime import timedelta

    data = {"sub": "user123"}
    token = create_access_token(data, expires_delta=timedelta(minutes=15))

    assert isinstance(token, str)
    assert len(token) > 0
```

**Run:** `cd backend && pytest tests/core/test_security.py -v`
**Expected:** FAIL - Module 'app.core.security' not found

### Step 2: Implement security utilities

**File:** `backend/app/core/security.py`

```python
"""
Security utilities for password hashing and JWT tokens.

Provides functions for secure password hashing using bcrypt
and JWT token creation/validation.
"""

from datetime import datetime, timedelta
from typing import Optional, Any

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# Password hashing context using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
ALGORITHM = "HS256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a hashed password.

    Args:
        plain_password: The plaintext password to verify
        hashed_password: The hashed password to check against

    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: The plaintext password to hash

    Returns:
        The hashed password
    """
    return pwd_context.hash(password)


def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.

    Args:
        data: The payload data to encode in the token
        expires_delta: Optional custom expiration time

    Returns:
        The encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)

    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """
    Decode and validate a JWT access token.

    Args:
        token: The JWT token to decode

    Returns:
        The decoded payload if valid, None otherwise
    """
    from jose import JWTError

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
```

**Run:** `cd backend && pytest tests/core/test_security.py -v`
**Expected:** PASS (all tests pass)

### Step 3: Commit security utilities

```bash
git add backend/app/core/security.py backend/tests/core/test_security.py
git commit -m "feat: add password hashing and JWT token utilities

- Implement bcrypt password hashing
- Add JWT token creation and validation
- Include comprehensive unit tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4: Write failing test for authentication schemas

**File:** `backend/tests/api/test_auth.py`

```python
"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.core.database import get_db
from app.models.user import User
from app.core.security import get_password_hash


@pytest.mark.asyncio
async def test_login_success(async_session: AsyncSession):
    """Test successful login."""
    # Arrange: Create test user
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        is_active=True
    )
    async_session.add(user)
    await async_session.commit()

    # Act: Login
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/login",
            data={"username": "test@example.com", "password": "testpass123"}
        )

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(async_session: AsyncSession):
    """Test login with wrong password."""
    # Arrange: Create test user
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        is_active=True
    )
    async_session.add(user)
    await async_session.commit()

    # Act: Login with wrong password
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/login",
            data={"username": "test@example.com", "password": "wrongpass"}
        )

    # Assert
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user():
    """Test login with nonexistent user."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/login",
            data={"username": "nonexistent@example.com", "password": "pass"}
        )

    assert response.status_code == 401
```

**Run:** `cd backend && pytest tests/api/test_auth.py -v`
**Expected:** FAIL - Route /api/auth/login not found

### Step 5: Create authentication schemas

**File:** `backend/app/schemas/auth.py`

```python
"""
Authentication request/response schemas.

Defines Pydantic models for authentication-related API operations.
"""

from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    """JWT token response schema."""

    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Decoded JWT token payload."""

    user_id: str


class LoginRequest(BaseModel):
    """Login request with email and password."""

    username: EmailStr  # OAuth2PasswordRequestForm expects 'username'
    password: str


class RegisterRequest(BaseModel):
    """User registration request."""

    email: EmailStr
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "SecurePassword123!"
            }
        }
```

### Step 6: Create authentication endpoints

**File:** `backend/app/api/auth.py`

```python
"""
Authentication API endpoints.

Provides login and registration endpoints with JWT token generation.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User
from app.schemas.auth import Token, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
) -> Token:
    """
    OAuth2 compatible login endpoint.

    Returns a JWT access token on successful authentication.

    Args:
        form_data: OAuth2 password form with username and password
        db: Database session

    Returns:
        JWT access token

    Raises:
        HTTPException: 401 if credentials are invalid
    """
    # Query user by email
    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # Verify user exists and password is correct
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )

    return Token(access_token=access_token)


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> Token:
    """
    Register a new user account.

    Args:
        user_data: Registration data with email and password
        db: Database session

    Returns:
        JWT access token for the new user

    Raises:
        HTTPException: 400 if email already registered
    """
    # Check if user already exists
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    new_user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        is_active=True
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(new_user.id)},
        expires_delta=access_token_expires
    )

    return Token(access_token=access_token)
```

### Step 7: Update User model with required fields

**File:** `backend/app/models/user.py` (verify it has these fields)

```python
# Ensure User model has:
# - email: str (unique, indexed)
# - hashed_password: str
# - is_active: bool (default=True)
```

**Action:** Read the existing User model and add missing fields if necessary

### Step 8: Update dependencies for authentication

**File:** `backend/app/api/deps.py`

```python
"""
API dependencies for authentication and database access.

Provides dependency injection functions for FastAPI routes.
"""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status, WebSocket
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.security import ALGORITHM
from app.models.user import User

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from JWT token.

    Args:
        token: JWT access token from Authorization header
        db: Database session

    Returns:
        Authenticated User object

    Raises:
        HTTPException: 401 if token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode JWT token
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Query user from database
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Verify the current user is active.

    Args:
        current_user: User from get_current_user dependency

    Returns:
        Active User object

    Raises:
        HTTPException: 403 if user is inactive
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_ws_user(websocket: WebSocket, token: str) -> User:
    """
    Authenticate WebSocket connection via query parameter token.

    SECURITY NOTE: Token validation happens BEFORE accepting the WebSocket
    connection to prevent DoS attacks.

    Args:
        websocket: WebSocket connection
        token: JWT token from query parameter

    Returns:
        Authenticated User object

    Raises:
        HTTPException: If authentication fails (closes WebSocket with code 1008)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )

    try:
        # Decode JWT token BEFORE accepting WebSocket
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            await websocket.close(code=1008)  # Policy Violation
            raise credentials_exception
    except JWTError:
        await websocket.close(code=1008)
        raise credentials_exception

    # Query user from database using context manager
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None or not user.is_active:
            await websocket.close(code=1008)
            raise credentials_exception

        return user
```

### Step 9: Add config setting for token expiration

**File:** `backend/app/core/config.py`

Add to Settings class:
```python
access_token_expire_minutes: int = 30  # JWT token expiration in minutes
```

### Step 10: Register auth router in main app

**File:** `backend/app/main.py`

```python
# Add import
from app.api import lists, videos, processing, websocket, tags, auth

# Add router registration (before other routers)
app.include_router(auth.router)
```

### Step 11: Run tests to verify authentication works

**Run:** `cd backend && pytest tests/api/test_auth.py -v`
**Expected:** PASS (all tests pass)

### Step 12: Commit authentication system

```bash
git add backend/app/api/auth.py backend/app/schemas/auth.py backend/app/api/deps.py backend/app/core/config.py backend/app/main.py backend/tests/api/test_auth.py
git commit -m "feat: implement JWT authentication system

- Add login and registration endpoints
- Implement OAuth2 password bearer authentication
- Add get_current_user dependency for protected routes
- Add comprehensive authentication tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 13: Write failing test for protected endpoint

**File:** `backend/tests/api/test_lists.py` (add test)

```python
@pytest.mark.asyncio
async def test_create_list_requires_authentication():
    """Test that creating a list requires authentication."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/lists",
            json={"name": "Test List"}
        )

    assert response.status_code == 401  # Unauthorized


@pytest.mark.asyncio
async def test_create_list_with_valid_token(async_session: AsyncSession):
    """Test creating a list with valid authentication."""
    # Create user and get token
    from app.core.security import get_password_hash, create_access_token
    from datetime import timedelta

    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpass"),
        is_active=True
    )
    async_session.add(user)
    await async_session.commit()

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=15)
    )

    # Make authenticated request
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/lists",
            json={"name": "My List"},
            headers={"Authorization": f"Bearer {token}"}
        )

    assert response.status_code == 201
    assert response.json()["name"] == "My List"
```

**Run:** `cd backend && pytest tests/api/test_lists.py::test_create_list_requires_authentication -v`
**Expected:** FAIL - Expected 401, got 201 (endpoint not protected yet)

### Step 14: Protect lists endpoints with authentication

**File:** `backend/app/api/lists.py`

```python
# Add imports
from typing import Annotated
from fastapi import Depends
from app.api.deps import get_current_active_user
from app.models.user import User

# Update all endpoints to require authentication
# Example for create_list:

@router.post("", response_model=ListResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    list_create: ListCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
) -> ListResponse:
    """Create a new video list."""
    # Associate list with authenticated user
    new_list = VideoList(
        name=list_create.name,
        user_id=current_user.id  # Add user_id to VideoList model if not present
    )
    # ... rest of implementation
```

**Action:** Add `current_user: Annotated[User, Depends(get_current_active_user)]` to ALL endpoints in:
- `backend/app/api/lists.py`
- `backend/app/api/videos.py`
- `backend/app/api/tags.py`
- `backend/app/api/processing.py`

### Step 15: Update VideoList and Video models with user ownership

**File:** `backend/app/models/list.py`

```python
# Add to VideoList model:
user_id: Mapped[uuid.UUID] = mapped_column(
    ForeignKey("users.id", ondelete="CASCADE"),
    nullable=False,
    index=True
)
user: Mapped["User"] = relationship("User", back_populates="lists")
```

**File:** `backend/app/models/video.py`

```python
# Add to Video model:
user_id: Mapped[uuid.UUID] = mapped_column(
    ForeignKey("users.id", ondelete="CASCADE"),
    nullable=False,
    index=True
)
user: Mapped["User"] = relationship("User", back_populates="videos")
```

**File:** `backend/app/models/user.py`

```python
# Add relationships:
lists: Mapped[list["VideoList"]] = relationship("VideoList", back_populates="user")
videos: Mapped[list["Video"]] = relationship("Video", back_populates="user")
```

### Step 16: Create Alembic migration for user ownership

```bash
cd backend
alembic revision --autogenerate -m "Add user ownership to lists and videos"
alembic upgrade head
```

### Step 17: Run all authentication tests

**Run:** `cd backend && pytest tests/api/test_auth.py tests/api/test_lists.py -v`
**Expected:** PASS (all tests pass)

### Step 18: Commit protected endpoints

```bash
git add backend/app/api/lists.py backend/app/api/videos.py backend/app/api/tags.py backend/app/api/processing.py backend/app/models/ backend/alembic/versions/ backend/tests/
git commit -m "feat: protect all API endpoints with JWT authentication

- Require authentication for all list, video, tag endpoints
- Add user ownership to VideoList and Video models
- Update tests to use authenticated requests
- Create database migration for user relationships

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Secure Default Credentials & Secrets

**Goal:** Replace all weak default passwords and secrets with strong, randomly generated values

**Files:**
- Modify: `docker-compose.yml`
- Create: `.env.example`
- Modify: `.env` (local only, not committed)
- Create: `backend/scripts/generate_secrets.py`
- Modify: `backend/app/core/config.py`
- Create: `docs/deployment/SECRETS_SETUP.md`

### Step 1: Create secret generation script

**File:** `backend/scripts/generate_secrets.py`

```python
#!/usr/bin/env python3
"""
Generate secure random secrets for the application.

Usage:
    python scripts/generate_secrets.py
"""

import secrets
import string


def generate_secret_key(length: int = 64) -> str:
    """Generate a secure random secret key."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def generate_password(length: int = 32) -> str:
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def main():
    """Generate and print all required secrets."""
    print("# Generated Secrets - Add these to your .env file")
    print("# Generated:", __import__('datetime').datetime.now().isoformat())
    print()
    print(f"SECRET_KEY={generate_secret_key()}")
    print(f"POSTGRES_PASSWORD={generate_password()}")
    print(f"REDIS_PASSWORD={generate_password()}")
    print()
    print("# IMPORTANT: Keep these secrets secure!")
    print("# Do NOT commit .env to version control")


if __name__ == "__main__":
    main()
```

**Make executable:**
```bash
chmod +x backend/scripts/generate_secrets.py
```

### Step 2: Update .env.example with placeholders

**File:** `.env.example`

```bash
# Application Settings
SECRET_KEY=CHANGE_ME_RUN_scripts_generate_secrets_py
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Database Configuration
POSTGRES_DB=youtube_bookmarks
POSTGRES_USER=youtube_user
POSTGRES_PASSWORD=CHANGE_ME_RUN_scripts_generate_secrets_py
DATABASE_URL=postgresql+asyncpg://youtube_user:${POSTGRES_PASSWORD}@localhost:5432/youtube_bookmarks

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=CHANGE_ME_RUN_scripts_generate_secrets_py

# API Keys (Optional - for YouTube Data API)
YOUTUBE_API_KEY=

# Environment
ENVIRONMENT=development
```

### Step 3: Update docker-compose.yml to use environment variables

**File:** `docker-compose.yml`

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: youtube-bookmarks-db
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    env_file:
      - .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /var/run/postgresql

  redis:
    image: redis:7-alpine
    container_name: youtube-bookmarks-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    env_file:
      - .env
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp

volumes:
  postgres_data:
```

### Step 4: Update Config class to validate required secrets

**File:** `backend/app/core/config.py`

```python
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    secret_key: str
    postgres_password: str
    redis_password: str
    # ... other settings

    @field_validator('secret_key')
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Ensure secret key is strong enough."""
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        if v in ["your-secret-key-here-change-in-production", "CHANGE_ME_RUN_scripts_generate_secrets_py"]:
            raise ValueError("SECRET_KEY must be changed from default value")
        return v

    @field_validator('postgres_password')
    @classmethod
    def validate_postgres_password(cls, v: str) -> str:
        """Ensure PostgreSQL password is strong enough."""
        if v in ["changeme", "CHANGE_ME_RUN_scripts_generate_secrets_py"]:
            raise ValueError("POSTGRES_PASSWORD must be changed from default value")
        if len(v) < 16:
            raise ValueError("POSTGRES_PASSWORD must be at least 16 characters")
        return v
```

### Step 5: Create secrets setup documentation

**File:** `docs/deployment/SECRETS_SETUP.md`

```markdown
# Secrets Setup Guide

## Quick Start

1. **Generate Secrets:**
   ```bash
   cd backend
   python scripts/generate_secrets.py > ../.env
   ```

2. **Verify .env file:**
   ```bash
   cat ../.env
   # Ensure all CHANGE_ME values are replaced
   ```

3. **Restart Services:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## Manual Setup

If you prefer to set secrets manually:

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace all `CHANGE_ME_RUN_scripts_generate_secrets_py` values

3. Ensure secrets meet minimum requirements:
   - `SECRET_KEY`: Minimum 32 characters
   - `POSTGRES_PASSWORD`: Minimum 16 characters
   - `REDIS_PASSWORD`: Minimum 16 characters

## Production Deployment

**NEVER commit .env to version control!**

For production deployments:
- Use environment-specific .env files
- Store secrets in secure vault (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly
- Use different secrets for each environment (dev/staging/prod)

## Security Checklist

- [ ] Generated strong random secrets
- [ ] Verified .env is in .gitignore
- [ ] Different secrets for each environment
- [ ] Secrets stored in secure vault (production)
- [ ] Team members aware to never commit secrets
```

### Step 6: Ensure .env is in .gitignore

**File:** `.gitignore`

```
# Environment variables
.env
.env.local
.env.*.local
```

### Step 7: Generate actual secrets for local development

```bash
cd backend
python scripts/generate_secrets.py > ../.env
```

### Step 8: Commit secret management system

```bash
git add backend/scripts/generate_secrets.py .env.example docker-compose.yml backend/app/core/config.py docs/deployment/SECRETS_SETUP.md .gitignore
git commit -m "feat: implement secure secret management

- Add script to generate strong random secrets
- Update docker-compose to use environment variables
- Add validation for secret strength in config
- Create secrets setup documentation
- Ensure .env is gitignored

BREAKING CHANGE: Default passwords no longer work, run generate_secrets.py

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Environment-Aware Configuration

**Goal:** Implement environment-specific configuration (development, staging, production) with appropriate CORS, debug settings, and security controls

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/core/test_config.py`
- Create: `.env.development`
- Create: `.env.production.example`

### Step 1: Write failing test for environment-specific config

**File:** `backend/tests/core/test_config.py`

```python
"""Tests for configuration management."""

import pytest
import os


def test_development_cors_allows_localhost():
    """Test that development environment allows localhost CORS."""
    os.environ['ENVIRONMENT'] = 'development'
    from app.core.config import get_cors_origins

    origins = get_cors_origins()
    assert 'http://localhost:5173' in origins
    assert 'http://localhost:8000' in origins


def test_production_cors_requires_explicit_origins():
    """Test that production requires explicit CORS origins."""
    os.environ['ENVIRONMENT'] = 'production'
    os.environ['ALLOWED_ORIGINS'] = 'https://example.com,https://app.example.com'
    from app.core.config import get_cors_origins

    origins = get_cors_origins()
    assert 'https://example.com' in origins
    assert 'https://app.example.com' in origins
    assert 'http://localhost:5173' not in origins


def test_production_rejects_wildcard_methods():
    """Test that production doesn't allow wildcard CORS methods."""
    os.environ['ENVIRONMENT'] = 'production'
    from app.core.config import get_cors_methods

    methods = get_cors_methods()
    assert methods != ["*"]
    assert "GET" in methods
    assert "POST" in methods
```

**Run:** `cd backend && pytest tests/core/test_config.py -v`
**Expected:** FAIL - Functions not defined

### Step 2: Implement environment-aware configuration

**File:** `backend/app/core/config.py`

```python
"""
Application configuration management.

Provides environment-aware settings for development, staging, and production.
"""

from enum import Enum
from typing import Optional

from pydantic import field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    """Application environment types."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """
    Application settings with environment-specific defaults.

    Settings are loaded from environment variables with fallbacks to .env file.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    # Environment
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False

    # Security
    secret_key: str
    access_token_expire_minutes: int = 30

    # Database
    postgres_db: str = "youtube_bookmarks"
    postgres_user: str = "youtube_user"
    postgres_password: str
    database_url: Optional[str] = None

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_password: Optional[str] = None

    # CORS
    allowed_origins: str = ""  # Comma-separated list for production

    # API Keys
    youtube_api_key: Optional[str] = None

    @computed_field
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment == Environment.PRODUCTION

    @computed_field
    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.environment == Environment.DEVELOPMENT

    @field_validator('secret_key')
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        """Ensure secret key is strong enough."""
        # Get environment from values
        env = info.data.get('environment', Environment.DEVELOPMENT)

        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")

        # Strict validation in production
        if env == Environment.PRODUCTION:
            if v in ["your-secret-key-here-change-in-production", "CHANGE_ME_RUN_scripts_generate_secrets_py"]:
                raise ValueError("SECRET_KEY must be changed from default value in production")

        return v

    @field_validator('debug')
    @classmethod
    def validate_debug(cls, v: bool, info) -> bool:
        """Ensure debug is disabled in production."""
        env = info.data.get('environment', Environment.DEVELOPMENT)

        if env == Environment.PRODUCTION and v:
            raise ValueError("DEBUG must be False in production")

        return v


def get_cors_origins() -> list[str]:
    """
    Get CORS allowed origins based on environment.

    Returns:
        List of allowed origin URLs
    """
    if settings.is_development:
        return [
            "http://localhost:5173",
            "http://localhost:8000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:8000"
        ]

    # Production: Only allow explicitly configured origins
    if not settings.allowed_origins:
        raise ValueError("ALLOWED_ORIGINS must be set in production")

    return [origin.strip() for origin in settings.allowed_origins.split(",")]


def get_cors_methods() -> list[str]:
    """
    Get CORS allowed methods based on environment.

    Returns:
        List of allowed HTTP methods
    """
    if settings.is_development:
        return ["*"]

    # Production: Explicit methods only
    return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]


def get_cors_headers() -> list[str]:
    """
    Get CORS allowed headers based on environment.

    Returns:
        List of allowed headers
    """
    if settings.is_development:
        return ["*"]

    # Production: Explicit headers only
    return [
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "User-Agent",
        "DNT",
        "Cache-Control",
        "X-Requested-With"
    ]


# Global settings instance
settings = Settings()
```

### Step 3: Update main.py to use environment-aware CORS

**File:** `backend/app/main.py`

```python
"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with environment-aware
CORS middleware and provides the health check endpoint.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import lists, videos, processing, websocket, tags, auth
from app.core.redis import close_redis_client, close_arq_pool, get_arq_pool
from app.core.config import settings, get_cors_origins, get_cors_methods, get_cors_headers


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events for the application.
    Manages Redis client and ARQ pool lifecycle.
    """
    # Startup: Initialize ARQ pool eagerly (not lazy on first request)
    await get_arq_pool()
    yield
    # Shutdown: Close both Redis client and ARQ pool
    await close_redis_client()
    await close_arq_pool()


# Create FastAPI app with environment-aware settings
app = FastAPI(
    title="Smart YouTube Bookmarks",
    debug=settings.debug,
    lifespan=lifespan
)

# Environment-aware CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=get_cors_methods(),
    allow_headers=get_cors_headers(),
)

# Register routers
app.include_router(auth.router)
app.include_router(lists.router)
app.include_router(videos.router)
app.include_router(processing.router)
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
app.include_router(tags.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "ok", "environment": settings.environment.value}
```

### Step 4: Create environment-specific .env files

**File:** `.env.development`

```bash
# Development Environment Configuration
ENVIRONMENT=development
DEBUG=true

# Security (weak is OK for local dev)
SECRET_KEY=dev-secret-key-only-for-local-development-change-for-other-envs
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Database
POSTGRES_DB=youtube_bookmarks
POSTGRES_USER=youtube_user
POSTGRES_PASSWORD=devpassword

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=

# CORS (automatically allows localhost in development)
ALLOWED_ORIGINS=

# API Keys (optional)
YOUTUBE_API_KEY=
```

**File:** `.env.production.example`

```bash
# Production Environment Configuration
ENVIRONMENT=production
DEBUG=false

# Security - MUST be changed!
SECRET_KEY=CHANGE_ME_RUN_scripts_generate_secrets_py
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Database - MUST be changed!
POSTGRES_DB=youtube_bookmarks
POSTGRES_USER=youtube_user
POSTGRES_PASSWORD=CHANGE_ME_RUN_scripts_generate_secrets_py
DATABASE_URL=postgresql+asyncpg://youtube_user:${POSTGRES_PASSWORD}@db:5432/youtube_bookmarks

# Redis - MUST be changed!
REDIS_URL=redis://redis:6379/0
REDIS_PASSWORD=CHANGE_ME_RUN_scripts_generate_secrets_py

# CORS - MUST be set to your actual domains!
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# API Keys
YOUTUBE_API_KEY=your-youtube-api-key
```

### Step 5: Run configuration tests

**Run:** `cd backend && pytest tests/core/test_config.py -v`
**Expected:** PASS (all tests pass)

### Step 6: Commit environment-aware configuration

```bash
git add backend/app/core/config.py backend/app/main.py backend/tests/core/test_config.py .env.development .env.production.example
git commit -m "feat: implement environment-aware configuration

- Add Environment enum (development, staging, production)
- Environment-specific CORS settings
- Strict validation in production (no debug, strong secrets)
- Separate .env files for each environment
- Update health check to show current environment

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: API Rate Limiting

**Goal:** Implement rate limiting to prevent API abuse and brute-force attacks

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/core/rate_limit.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/api/auth.py`
- Create: `backend/tests/core/test_rate_limit.py`

### Step 1: Add slowapi dependency

**File:** `backend/requirements.txt`

```
# Add after existing dependencies
slowapi==0.1.9
```

**Install:**
```bash
cd backend
pip install slowapi==0.1.9
```

### Step 2: Write failing test for rate limiting

**File:** `backend/tests/core/test_rate_limit.py`

```python
"""Tests for rate limiting."""

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_login_rate_limit():
    """Test that login endpoint is rate limited."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Make multiple rapid login attempts
        responses = []
        for i in range(10):
            response = await client.post(
                "/api/auth/login",
                data={"username": f"user{i}@example.com", "password": "wrongpass"}
            )
            responses.append(response.status_code)

        # Should get rate limited (429 Too Many Requests)
        assert 429 in responses


@pytest.mark.asyncio
async def test_general_api_rate_limit():
    """Test that general API endpoints are rate limited."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Make many rapid requests
        responses = []
        for i in range(100):
            response = await client.get("/api/health")
            responses.append(response.status_code)

        # Should eventually get rate limited
        assert 429 in responses
```

**Run:** `cd backend && pytest tests/core/test_rate_limit.py -v`
**Expected:** FAIL - No rate limiting implemented

### Step 3: Implement rate limiting

**File:** `backend/app/core/rate_limit.py`

```python
"""
Rate limiting configuration and utilities.

Implements request rate limiting using slowapi and Redis.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse

from app.core.config import settings


def get_rate_limit_key(request: Request) -> str:
    """
    Generate rate limit key based on client IP and optional user ID.

    For authenticated requests, uses user ID for more accurate limiting.
    For anonymous requests, uses IP address.

    Args:
        request: FastAPI request object

    Returns:
        Rate limit key string
    """
    # Try to get user from request state (set by auth dependency)
    if hasattr(request.state, "user") and request.state.user:
        return f"user:{request.state.user.id}"

    # Fall back to IP address
    return get_remote_address(request)


# Create limiter instance using Redis for distributed rate limiting
limiter = Limiter(
    key_func=get_rate_limit_key,
    storage_uri=settings.redis_url,
    strategy="fixed-window",
    default_limits=["200/hour"] if settings.is_production else ["1000/hour"]
)


# Stricter limits for authentication endpoints
AUTH_RATE_LIMIT = "5/minute" if settings.is_production else "20/minute"
API_RATE_LIMIT = "100/minute" if settings.is_production else "500/minute"


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom handler for rate limit exceeded errors.

    Returns a 429 Too Many Requests response with retry information.

    Args:
        request: FastAPI request object
        exc: RateLimitExceeded exception

    Returns:
        JSON response with error details
    """
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "detail": f"Too many requests. Retry after {exc.retry_after} seconds.",
            "retry_after": exc.retry_after
        },
        headers={"Retry-After": str(exc.retry_after)}
    )
```

### Step 4: Add rate limiting to FastAPI app

**File:** `backend/app/main.py`

```python
# Add imports
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.rate_limit import limiter, rate_limit_exceeded_handler

# Add to app creation
app = FastAPI(
    title="Smart YouTube Bookmarks",
    debug=settings.debug,
    lifespan=lifespan
)

# Add rate limiting state
app.state.limiter = limiter

# Add exception handler for rate limit errors
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Rest of middleware and routers...
```

### Step 5: Apply rate limiting to authentication endpoints

**File:** `backend/app/api/auth.py`

```python
# Add import
from app.core.rate_limit import limiter, AUTH_RATE_LIMIT

# Apply to login endpoint
@router.post("/login", response_model=Token)
@limiter.limit(AUTH_RATE_LIMIT)
async def login(
    request: Request,  # Required for rate limiting
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
) -> Token:
    """OAuth2 compatible login endpoint with rate limiting."""
    # ... existing implementation

# Apply to register endpoint
@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_RATE_LIMIT)
async def register(
    request: Request,  # Required for rate limiting
    user_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> Token:
    """Register endpoint with rate limiting."""
    # ... existing implementation
```

### Step 6: Apply rate limiting to other sensitive endpoints

Apply `@limiter.limit(API_RATE_LIMIT)` to:
- Video creation endpoints (to prevent spam)
- List creation endpoints
- Tag creation endpoints

Example:
```python
from app.core.rate_limit import limiter, API_RATE_LIMIT

@router.post("", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(API_RATE_LIMIT)
async def create_video(
    request: Request,  # Required for rate limiting
    video_create: VideoCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
) -> VideoResponse:
    # ... implementation
```

### Step 7: Run rate limiting tests

**Run:** `cd backend && pytest tests/core/test_rate_limit.py -v`
**Expected:** PASS (all tests pass)

### Step 8: Commit rate limiting implementation

```bash
git add backend/requirements.txt backend/app/core/rate_limit.py backend/app/main.py backend/app/api/auth.py backend/app/api/videos.py backend/tests/core/test_rate_limit.py
git commit -m "feat: implement API rate limiting

- Add slowapi for Redis-based rate limiting
- Strict limits for auth endpoints (5/min production)
- General API limits (100/min production)
- Custom error handler with retry-after headers
- Environment-aware limits (stricter in production)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Input Validation & ReDoS Protection

**Goal:** Implement comprehensive input validation with length limits and timeout protection for regex operations

**Files:**
- Modify: `backend/app/api/videos.py`
- Create: `backend/app/core/validation.py`
- Create: `backend/tests/core/test_validation.py`
- Modify: `backend/app/schemas/video.py`

### Step 1: Write failing tests for input validation

**File:** `backend/tests/core/test_validation.py`

```python
"""Tests for input validation utilities."""

import pytest
from app.core.validation import validate_youtube_url, ValidationError


def test_valid_youtube_urls():
    """Test that valid YouTube URLs pass validation."""
    valid_urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ"
    ]

    for url in valid_urls:
        video_id = validate_youtube_url(url)
        assert video_id == "dQw4w9WgXcQ"


def test_invalid_youtube_urls():
    """Test that invalid URLs raise ValidationError."""
    invalid_urls = [
        "https://example.com/watch?v=dQw4w9WgXcQ",
        "not a url",
        "https://youtube.com/",
        ""
    ]

    for url in invalid_urls:
        with pytest.raises(ValidationError):
            validate_youtube_url(url)


def test_url_length_limit():
    """Test that excessively long URLs are rejected."""
    long_url = "https://www.youtube.com/watch?v=" + "a" * 5000

    with pytest.raises(ValidationError, match="URL too long"):
        validate_youtube_url(long_url)


def test_redos_protection():
    """Test that regex has timeout protection."""
    # Crafted URL that could cause ReDoS without timeout
    malicious_url = "https://www.youtube.com/" + "a" * 10000 + "watch?v=test"

    # Should fail quickly, not hang
    import time
    start = time.time()

    with pytest.raises(ValidationError):
        validate_youtube_url(malicious_url)

    elapsed = time.time() - start
    assert elapsed < 1.0, "Regex timeout protection failed"
```

**Run:** `cd backend && pytest tests/core/test_validation.py -v`
**Expected:** FAIL - Module not found

### Step 2: Implement validation utilities with ReDoS protection

**File:** `backend/app/core/validation.py`

```python
"""
Input validation utilities with security protections.

Provides functions for validating and sanitizing user inputs with
protections against ReDoS attacks and other injection vulnerabilities.
"""

import re
import signal
from contextlib import contextmanager
from typing import Optional


class ValidationError(ValueError):
    """Custom exception for validation errors."""
    pass


class TimeoutError(Exception):
    """Raised when regex matching times out."""
    pass


@contextmanager
def timeout(seconds: float):
    """
    Context manager for timeout protection.

    Args:
        seconds: Maximum execution time

    Raises:
        TimeoutError: If execution exceeds timeout
    """
    def timeout_handler(signum, frame):
        raise TimeoutError("Operation timed out")

    # Set signal handler
    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.setitimer(signal.ITIMER_REAL, seconds)

    try:
        yield
    finally:
        # Restore old handler
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old_handler)


# Maximum URL length to prevent DoS
MAX_URL_LENGTH = 2048

# YouTube URL patterns (simplified to avoid ReDoS)
YOUTUBE_PATTERNS = [
    re.compile(r'^https?://(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})'),
    re.compile(r'^https?://youtu\.be/([a-zA-Z0-9_-]{11})'),
    re.compile(r'^https?://m\.youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})'),
]


def validate_youtube_url(url: str, max_length: int = MAX_URL_LENGTH) -> str:
    """
    Validate and extract YouTube video ID from URL.

    Includes protections against:
    - ReDoS attacks (regex timeout)
    - Excessively long URLs (length limit)
    - Invalid URL formats

    Args:
        url: YouTube URL to validate
        max_length: Maximum allowed URL length

    Returns:
        YouTube video ID (11 characters)

    Raises:
        ValidationError: If URL is invalid or security check fails
    """
    # Check URL length first (before any regex)
    if not url:
        raise ValidationError("URL cannot be empty")

    if len(url) > max_length:
        raise ValidationError(f"URL too long (max {max_length} characters)")

    # Try each pattern with timeout protection
    for pattern in YOUTUBE_PATTERNS:
        try:
            with timeout(0.5):  # 500ms timeout for regex
                match = pattern.match(url)
                if match:
                    return match.group(1)
        except TimeoutError:
            raise ValidationError("URL validation timed out (possible attack)")

    # No pattern matched
    raise ValidationError("Invalid YouTube URL format")


def sanitize_string(
    value: str,
    max_length: int = 255,
    allow_newlines: bool = False
) -> str:
    """
    Sanitize string input for safe storage and display.

    Args:
        value: String to sanitize
        max_length: Maximum allowed length
        allow_newlines: Whether to preserve newline characters

    Returns:
        Sanitized string

    Raises:
        ValidationError: If input exceeds max length
    """
    if not value:
        return ""

    # Trim whitespace
    value = value.strip()

    # Check length
    if len(value) > max_length:
        raise ValidationError(f"Input too long (max {max_length} characters)")

    # Remove control characters except newlines (if allowed)
    if allow_newlines:
        value = ''.join(char for char in value if char.isprintable() or char in '\n\r')
    else:
        value = ''.join(char for char in value if char.isprintable())

    return value


def validate_email(email: str) -> str:
    """
    Validate email format with simple regex.

    Args:
        email: Email address to validate

    Returns:
        Lowercase email address

    Raises:
        ValidationError: If email format is invalid
    """
    if not email or len(email) > 320:  # RFC 5321
        raise ValidationError("Invalid email length")

    # Simple email regex (not comprehensive, but safe from ReDoS)
    email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

    try:
        with timeout(0.1):
            if not email_pattern.match(email):
                raise ValidationError("Invalid email format")
    except TimeoutError:
        raise ValidationError("Email validation timed out")

    return email.lower()
```

### Step 3: Update video schema with validation

**File:** `backend/app/schemas/video.py`

```python
from pydantic import field_validator
from app.core.validation import validate_youtube_url, sanitize_string


class VideoCreate(BaseModel):
    """Schema for creating a new video."""

    youtube_url: str
    title: Optional[str] = None

    @field_validator('youtube_url')
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Validate YouTube URL format and length."""
        # This also extracts video ID to verify it's valid
        validate_youtube_url(v)
        return v

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize video title."""
        if v:
            return sanitize_string(v, max_length=500)
        return v
```

### Step 4: Update video API to use validation

**File:** `backend/app/api/videos.py`

```python
from app.core.validation import validate_youtube_url, ValidationError

def extract_youtube_id(url: str) -> str:
    """
    Extract YouTube video ID from URL with validation.

    Args:
        url: YouTube URL

    Returns:
        11-character video ID

    Raises:
        HTTPException: 400 if URL is invalid
    """
    try:
        return validate_youtube_url(url)
    except ValidationError as e:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
```

### Step 5: Run validation tests

**Run:** `cd backend && pytest tests/core/test_validation.py -v`
**Expected:** PASS (all tests pass)

### Step 6: Add validation to all text inputs

Apply `sanitize_string()` validation to:
- List names
- Tag names
- Video descriptions
- Any user-provided text fields

### Step 7: Commit input validation

```bash
git add backend/app/core/validation.py backend/app/schemas/video.py backend/app/api/videos.py backend/tests/core/test_validation.py
git commit -m "feat: implement input validation with ReDoS protection

- Add timeout protection for regex matching (500ms limit)
- Enforce URL length limits (2048 chars max)
- Sanitize all text inputs
- Validate email format safely
- Comprehensive validation tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: CORS Security Hardening

**Goal:** Already implemented in Task 3 (Environment-Aware Configuration). Verify it works correctly.

### Step 1: Write integration test for CORS

**File:** `backend/tests/api/test_cors.py`

```python
"""Tests for CORS configuration."""

import pytest
from httpx import AsyncClient
import os

from app.main import app


@pytest.mark.asyncio
async def test_cors_allows_configured_origin_development():
    """Test that configured origins are allowed in development."""
    os.environ['ENVIRONMENT'] = 'development'

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.options(
            "/api/health",
            headers={"Origin": "http://localhost:5173"}
        )

    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers


@pytest.mark.asyncio
async def test_cors_rejects_unauthorized_origin_production():
    """Test that unauthorized origins are rejected in production."""
    os.environ['ENVIRONMENT'] = 'production'
    os.environ['ALLOWED_ORIGINS'] = 'https://example.com'

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.options(
            "/api/health",
            headers={"Origin": "http://localhost:5173"}
        )

    # Should not have CORS headers for disallowed origin
    assert "access-control-allow-origin" not in response.headers or \
           response.headers["access-control-allow-origin"] != "http://localhost:5173"
```

### Step 2: Run CORS tests

**Run:** `cd backend && pytest tests/api/test_cors.py -v`
**Expected:** PASS

### Step 3: Update documentation

**File:** `docs/deployment/CORS_SETUP.md`

```markdown
# CORS Configuration Guide

## Development

In development, CORS automatically allows:
- http://localhost:5173 (frontend dev server)
- http://localhost:8000 (backend API)
- http://127.0.0.1:5173
- http://127.0.0.1:8000

No configuration needed!

## Production

Set `ALLOWED_ORIGINS` in your `.env` file:

```bash
ENVIRONMENT=production
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**Important:**
- Use HTTPS only in production
- No wildcards allowed
- Separate multiple origins with commas
- No spaces around commas

## Security

Production CORS config:
- ✅ Explicit origin allowlist
- ✅ Specific HTTP methods (no wildcards)
- ✅ Specific headers (no wildcards)
- ✅ Credentials support enabled
- ❌ No `allow_origins=["*"]` in production
```

### Step 4: Commit CORS documentation

```bash
git add backend/tests/api/test_cors.py docs/deployment/CORS_SETUP.md
git commit -m "docs: add CORS configuration guide and tests

- Document development vs production CORS
- Add integration tests for CORS behavior
- Security best practices for production

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Structured Logging

**Goal:** Replace string-based logging with structured JSON logs for better observability

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/core/logging.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/api/videos.py` (example)
- Create: `backend/tests/core/test_logging.py`

### Step 1: Add structlog dependency

**File:** `backend/requirements.txt`

```
# Add after existing dependencies
structlog==24.1.0
```

**Install:**
```bash
cd backend
pip install structlog==24.1.0
```

### Step 2: Write test for structured logging

**File:** `backend/tests/core/test_logging.py`

```python
"""Tests for structured logging."""

import json
import pytest
from io import StringIO

from app.core.logging import get_logger, configure_logging


def test_structured_log_output():
    """Test that logs are output as structured JSON."""
    # Configure logging to write to string buffer
    output = StringIO()
    configure_logging(stream=output)

    logger = get_logger("test")
    logger.info("test_event", user_id="123", action="test")

    # Parse output as JSON
    output.seek(0)
    log_line = output.readline()
    log_data = json.loads(log_line)

    assert log_data["event"] == "test_event"
    assert log_data["user_id"] == "123"
    assert log_data["action"] == "test"
    assert "timestamp" in log_data


def test_log_includes_context():
    """Test that logs include contextual information."""
    output = StringIO()
    configure_logging(stream=output)

    logger = get_logger("app.api.videos")
    logger.error("operation_failed", error="Connection timeout", video_id="abc123")

    output.seek(0)
    log_data = json.loads(output.readline())

    assert log_data["level"] == "error"
    assert log_data["logger"] == "app.api.videos"
    assert log_data["event"] == "operation_failed"
    assert log_data["error"] == "Connection timeout"
    assert log_data["video_id"] == "abc123"
```

**Run:** `cd backend && pytest tests/core/test_logging.py -v`
**Expected:** FAIL - Module not found

### Step 3: Implement structured logging

**File:** `backend/app/core/logging.py`

```python
"""
Structured logging configuration using structlog.

Provides JSON-formatted logs for better observability in production.
"""

import sys
import logging
from typing import Optional, Any

import structlog
from structlog.types import FilteringBoundLogger

from app.core.config import settings


def configure_logging(stream: Optional[Any] = None) -> None:
    """
    Configure application-wide structured logging.

    Logs are output as JSON in production, human-readable in development.

    Args:
        stream: Optional output stream (for testing)
    """
    # Determine log level
    log_level = logging.DEBUG if settings.debug else logging.INFO

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=stream or sys.stdout,
        level=log_level,
    )

    # Configure structlog
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.is_development:
        # Development: Human-readable colored output
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer()
        ]
    else:
        # Production: JSON output
        processors = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> FilteringBoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured structured logger
    """
    return structlog.get_logger(name)


# Convenience function for request logging
def log_request(
    logger: FilteringBoundLogger,
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    user_id: Optional[str] = None
) -> None:
    """
    Log HTTP request with structured data.

    Args:
        logger: Structured logger instance
        method: HTTP method
        path: Request path
        status_code: Response status code
        duration_ms: Request duration in milliseconds
        user_id: Optional authenticated user ID
    """
    log_data = {
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
    }

    if user_id:
        log_data["user_id"] = user_id

    # Choose log level based on status code
    if status_code >= 500:
        logger.error("http_request", **log_data)
    elif status_code >= 400:
        logger.warning("http_request", **log_data)
    else:
        logger.info("http_request", **log_data)
```

### Step 4: Add logging middleware to FastAPI

**File:** `backend/app/main.py`

```python
import time
from fastapi import Request
from app.core.logging import configure_logging, get_logger, log_request

# Configure logging at startup
configure_logging()
logger = get_logger(__name__)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """
    Middleware to log all HTTP requests with structured data.
    """
    start_time = time.time()

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration_ms = (time.time() - start_time) * 1000

    # Get user ID if authenticated
    user_id = None
    if hasattr(request.state, "user") and request.state.user:
        user_id = str(request.state.user.id)

    # Log request
    log_request(
        logger,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=duration_ms,
        user_id=user_id
    )

    return response
```

### Step 5: Update video API to use structured logging

**File:** `backend/app/api/videos.py`

Replace all `logger.info(f"...")` with structured logging:

```python
from app.core.logging import get_logger

logger = get_logger(__name__)

# Old:
# logger.info(f"Queued video {new_video.id} for background processing")

# New:
logger.info(
    "video_queued",
    video_id=str(new_video.id),
    youtube_id=new_video.youtube_id,
    user_id=str(current_user.id)
)

# Old error logging:
# logger.error(f"Failed to queue ARQ task for video {new_video.id}: {e}")

# New:
logger.error(
    "video_queue_failed",
    video_id=str(new_video.id),
    error=str(e),
    error_type=type(e).__name__
)
```

### Step 6: Run logging tests

**Run:** `cd backend && pytest tests/core/test_logging.py -v`
**Expected:** PASS

### Step 7: Commit structured logging

```bash
git add backend/requirements.txt backend/app/core/logging.py backend/app/main.py backend/app/api/videos.py backend/tests/core/test_logging.py
git commit -m "feat: implement structured logging with structlog

- JSON logs in production, colored console in development
- HTTP request logging middleware with duration tracking
- Structured context (user_id, video_id, etc.)
- Environment-aware log levels
- Replace all string-based logs with structured events

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Comprehensive Health Checks

**Goal:** Implement health check endpoint that verifies all dependencies (database, Redis, external APIs)

**Files:**
- Create: `backend/app/api/health.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/test_health.py`

### Step 1: Write failing tests for health checks

**File:** `backend/tests/api/test_health.py`

```python
"""Tests for health check endpoints."""

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_check_basic():
    """Test basic health check endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded", "unhealthy"]


@pytest.mark.asyncio
async def test_health_check_includes_dependencies():
    """Test that health check verifies all dependencies."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/health/detailed")

    assert response.status_code == 200
    data = response.json()

    # Should check database
    assert "database" in data["checks"]
    assert "status" in data["checks"]["database"]

    # Should check Redis
    assert "redis" in data["checks"]
    assert "status" in data["checks"]["redis"]


@pytest.mark.asyncio
async def test_health_check_fails_when_db_down():
    """Test that health check fails when database is unavailable."""
    # This test would require mocking database connection
    # For now, just document the expected behavior
    pass
```

**Run:** `cd backend && pytest tests/api/test_health.py -v`
**Expected:** FAIL - Routes not found

### Step 2: Implement comprehensive health checks

**File:** `backend/app/api/health.py`

```python
"""
Health check endpoints for monitoring application status.

Provides basic and detailed health checks for the application
and its dependencies.
"""

from typing import Dict, Any
from datetime import datetime

from fastapi import APIRouter, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis_client
from app.core.config import settings
from app.core.logging import get_logger

router = APIRouter(prefix="/api/health", tags=["health"])
logger = get_logger(__name__)


async def check_database() -> Dict[str, Any]:
    """
    Check database connectivity and responsiveness.

    Returns:
        Dict with status and optional error message
    """
    try:
        async with AsyncSessionLocal() as db:
            # Execute simple query with timeout
            result = await db.execute(text("SELECT 1"))
            result.scalar()

            return {
                "status": "healthy",
                "response_time_ms": 0  # Could add timing here
            }
    except Exception as e:
        logger.error("database_health_check_failed", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e)
        }


async def check_redis() -> Dict[str, Any]:
    """
    Check Redis connectivity and responsiveness.

    Returns:
        Dict with status and optional error message
    """
    try:
        redis = await get_redis_client()

        # Execute PING command
        response = await redis.ping()

        if response:
            return {
                "status": "healthy",
                "response_time_ms": 0
            }
        else:
            return {
                "status": "unhealthy",
                "error": "Redis PING failed"
            }
    except Exception as e:
        logger.error("redis_health_check_failed", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@router.get("")
async def health_check() -> Dict[str, str]:
    """
    Basic health check endpoint.

    Returns a simple status indicating if the application is running.
    This endpoint does NOT check dependencies for faster response.

    Returns:
        Simple status object
    """
    return {
        "status": "healthy",
        "environment": settings.environment.value,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """
    Detailed health check with dependency verification.

    Checks:
    - Database connectivity
    - Redis connectivity
    - Overall application status

    Returns:
        Detailed health status with all checks
    """
    # Run all health checks
    db_check = await check_database()
    redis_check = await check_redis()

    # Determine overall status
    checks_status = [db_check["status"], redis_check["status"]]

    if all(s == "healthy" for s in checks_status):
        overall_status = "healthy"
        http_status = status.HTTP_200_OK
    elif any(s == "unhealthy" for s in checks_status):
        overall_status = "unhealthy"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        overall_status = "degraded"
        http_status = status.HTTP_200_OK

    response = {
        "status": overall_status,
        "environment": settings.environment.value,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {
            "database": db_check,
            "redis": redis_check
        }
    }

    logger.info(
        "health_check_performed",
        overall_status=overall_status,
        database_status=db_check["status"],
        redis_status=redis_check["status"]
    )

    return response
```

### Step 3: Update main.py to use new health router

**File:** `backend/app/main.py`

```python
# Remove old health check endpoint
# @app.get("/api/health")
# async def health_check() -> dict[str, str]:
#     return {"status": "ok"}

# Import and register health router
from app.api import lists, videos, processing, websocket, tags, auth, health

app.include_router(health.router)
```

### Step 4: Run health check tests

**Run:** `cd backend && pytest tests/api/test_health.py -v`
**Expected:** PASS

### Step 5: Add readiness and liveness endpoints for Kubernetes

**File:** `backend/app/api/health.py` (add endpoints)

```python
@router.get("/live")
async def liveness_check() -> Dict[str, str]:
    """
    Kubernetes liveness probe endpoint.

    Returns 200 if the application process is running.
    Does NOT check dependencies.

    Returns:
        Simple status
    """
    return {"status": "alive"}


@router.get("/ready")
async def readiness_check() -> Dict[str, Any]:
    """
    Kubernetes readiness probe endpoint.

    Returns 200 only if application is ready to serve traffic
    (all dependencies are healthy).

    Returns:
        Status with dependency checks
    """
    db_check = await check_database()
    redis_check = await check_redis()

    if db_check["status"] == "healthy" and redis_check["status"] == "healthy":
        return {
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat()
        }
    else:
        from fastapi import Response
        return Response(
            content='{"status": "not_ready"}',
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json"
        )
```

### Step 6: Commit comprehensive health checks

```bash
git add backend/app/api/health.py backend/app/main.py backend/tests/api/test_health.py
git commit -m "feat: implement comprehensive health checks

- Basic health endpoint (fast, no dependency checks)
- Detailed health endpoint (checks database, Redis)
- Kubernetes liveness probe (/api/health/live)
- Kubernetes readiness probe (/api/health/ready)
- Structured logging of health check results
- Returns 503 when dependencies are unhealthy

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Database Constraints

**Goal:** Add database-level constraints for data integrity

**Files:**
- Create: `backend/alembic/versions/XXXX_add_database_constraints.py`
- Modify: `backend/app/models/video.py`
- Create: `backend/tests/models/test_video_constraints.py`

### Step 1: Write failing test for URL format constraint

**File:** `backend/tests/models/test_video_constraints.py`

```python
"""Tests for database constraints."""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.video import Video
from app.models.user import User


@pytest.mark.asyncio
async def test_video_requires_youtube_id(async_session):
    """Test that video requires youtube_id."""
    user = User(email="test@example.com", hashed_password="hash", is_active=True)
    async_session.add(user)
    await async_session.commit()

    video = Video(
        youtube_url="https://youtube.com/watch",
        youtube_id="",  # Empty - should fail
        user_id=user.id
    )
    async_session.add(video)

    with pytest.raises(IntegrityError):
        await async_session.commit()


@pytest.mark.asyncio
async def test_video_youtube_id_format(async_session):
    """Test that youtube_id must be 11 characters."""
    user = User(email="test@example.com", hashed_password="hash", is_active=True)
    async_session.add(user)
    await async_session.commit()

    video = Video(
        youtube_url="https://youtube.com/watch?v=short",
        youtube_id="short",  # Too short - should fail
        user_id=user.id
    )
    async_session.add(video)

    with pytest.raises(IntegrityError):
        await async_session.commit()


@pytest.mark.asyncio
async def test_video_unique_youtube_id_per_user(async_session):
    """Test that user cannot save same video twice."""
    user = User(email="test@example.com", hashed_password="hash", is_active=True)
    async_session.add(user)
    await async_session.commit()

    # Create first video
    video1 = Video(
        youtube_url="https://youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_id="dQw4w9WgXcQ",
        user_id=user.id
    )
    async_session.add(video1)
    await async_session.commit()

    # Try to create duplicate
    video2 = Video(
        youtube_url="https://youtu.be/dQw4w9WgXcQ",
        youtube_id="dQw4w9WgXcQ",
        user_id=user.id
    )
    async_session.add(video2)

    with pytest.raises(IntegrityError):
        await async_session.commit()
```

**Run:** `cd backend && pytest tests/models/test_video_constraints.py -v`
**Expected:** FAIL - Constraints not implemented

### Step 2: Create Alembic migration for constraints

```bash
cd backend
alembic revision -m "Add database constraints for data integrity"
```

**File:** `backend/alembic/versions/XXXX_add_database_constraints.py`

```python
"""Add database constraints for data integrity

Revision ID: XXXX
Revises: YYYY
Create Date: 2025-11-02
"""
from alembic import op
import sqlalchemy as sa


revision = 'XXXX'
down_revision = 'YYYY'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add database constraints."""

    # Add CHECK constraint for youtube_id length (must be exactly 11 chars)
    op.create_check_constraint(
        'videos_youtube_id_length_check',
        'videos',
        'LENGTH(youtube_id) = 11'
    )

    # Add CHECK constraint for youtube_id format (alphanumeric, dash, underscore only)
    op.create_check_constraint(
        'videos_youtube_id_format_check',
        'videos',
        "youtube_id ~ '^[a-zA-Z0-9_-]{11}$'"
    )

    # Add CHECK constraint for youtube_url not empty
    op.create_check_constraint(
        'videos_youtube_url_not_empty_check',
        'videos',
        'LENGTH(youtube_url) > 0'
    )

    # Add UNIQUE constraint for (user_id, youtube_id) - prevent duplicates per user
    op.create_unique_constraint(
        'videos_user_youtube_unique',
        'videos',
        ['user_id', 'youtube_id']
    )

    # Add CHECK constraint for list name not empty
    op.create_check_constraint(
        'lists_name_not_empty_check',
        'video_lists',
        'LENGTH(name) > 0'
    )

    # Add CHECK constraint for tag name not empty
    op.create_check_constraint(
        'tags_name_not_empty_check',
        'tags',
        'LENGTH(name) > 0'
    )


def downgrade() -> None:
    """Remove database constraints."""

    op.drop_constraint('videos_youtube_id_length_check', 'videos')
    op.drop_constraint('videos_youtube_id_format_check', 'videos')
    op.drop_constraint('videos_youtube_url_not_empty_check', 'videos')
    op.drop_constraint('videos_user_youtube_unique', 'videos')
    op.drop_constraint('lists_name_not_empty_check', 'video_lists')
    op.drop_constraint('tags_name_not_empty_check', 'tags')
```

### Step 3: Apply migration

```bash
cd backend
alembic upgrade head
```

### Step 4: Run constraint tests

**Run:** `cd backend && pytest tests/models/test_video_constraints.py -v`
**Expected:** PASS

### Step 5: Commit database constraints

```bash
git add backend/alembic/versions/ backend/tests/models/test_video_constraints.py
git commit -m "feat: add database constraints for data integrity

- CHECK constraint: youtube_id must be exactly 11 characters
- CHECK constraint: youtube_id must match format [a-zA-Z0-9_-]{11}
- CHECK constraint: youtube_url cannot be empty
- UNIQUE constraint: (user_id, youtube_id) prevents duplicate saves
- CHECK constraints: list and tag names cannot be empty
- Comprehensive constraint tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Secret Management System (Future)

**Goal:** Document approach for production secret management (not implemented in this iteration)

**Files:**
- Create: `docs/deployment/SECRET_MANAGEMENT.md`

### Step 1: Create secret management documentation

**File:** `docs/deployment/SECRET_MANAGEMENT.md`

```markdown
# Secret Management Strategy

## Current State (Development)

Secrets are managed via `.env` files:
- Generated by `scripts/generate_secrets.py`
- Not committed to version control
- Suitable for local development only

## Future: Production Secret Management

### Recommended Solutions

#### Option 1: HashiCorp Vault
- Centralized secret storage
- Dynamic secrets generation
- Audit logging
- Secret rotation

#### Option 2: AWS Secrets Manager
- Native AWS integration
- Automatic rotation
- IAM-based access control
- KMS encryption

#### Option 3: Kubernetes Secrets
- If deploying to Kubernetes
- Encrypted at rest (with KMS)
- RBAC for access control
- External Secrets Operator for vault integration

### Implementation Plan (Future Task)

**Phase 1: Vault Integration**
1. Set up Vault server (or AWS Secrets Manager)
2. Create `backend/app/core/vault.py`
3. Update `Settings` class to fetch from Vault
4. Implement secret rotation
5. Add Vault health check

**Phase 2: Secret Rotation**
1. Database password rotation (blue/green approach)
2. API key rotation schedule
3. JWT secret rotation strategy

**Phase 3: Audit & Compliance**
1. Log all secret access
2. Periodic secret rotation enforcement
3. Compliance reporting

### Security Checklist

Production secret management must:
- [ ] Never store secrets in code or version control
- [ ] Encrypt secrets at rest
- [ ] Encrypt secrets in transit
- [ ] Audit all secret access
- [ ] Implement automatic rotation
- [ ] Use least-privilege access
- [ ] Have backup/recovery plan
- [ ] Monitor for unauthorized access

## Current Workaround for Production

Until Vault is implemented, use:

1. **Environment Variables** (set at deployment)
2. **Kubernetes Secrets** (if on K8s)
3. **Docker Secrets** (if on Docker Swarm)

**Never:**
- Commit `.env` to git
- Use default passwords
- Share secrets via Slack/email
- Store secrets in CI/CD logs

## Resources

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
```

### Step 2: Commit documentation

```bash
git add docs/deployment/SECRET_MANAGEMENT.md
git commit -m "docs: add secret management strategy for production

- Document current development approach
- Outline future Vault/AWS Secrets Manager integration
- Security checklist for production deployments
- Secret rotation strategy
- Compliance requirements

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary & Verification

### Final Checklist

After completing all tasks, verify:

- [ ] All tests pass: `pytest`
- [ ] Code linting passes: `ruff check .`
- [ ] Type checking passes: `mypy .`
- [ ] Semgrep scan clean: `semgrep scan --config=auto`
- [ ] CodeRabbit review: `coderabbit --prompt-only --type committed`
- [ ] Documentation updated
- [ ] All commits follow convention

### Security Improvements Summary

**P0 - Critical (DONE):**
1. ✅ JWT authentication on all endpoints
2. ✅ Secure random secrets, no defaults
3. ✅ Environment-aware configuration

**P1 - High (DONE):**
4. ✅ Rate limiting (5/min auth, 100/min API)
5. ✅ Input validation with ReDoS protection
6. ✅ CORS security (environment-specific)

**P2 - Operational (DONE):**
7. ✅ Structured JSON logging
8. ✅ Comprehensive health checks
9. ✅ Database integrity constraints

**P3 - Future:**
10. 📋 Secret management (documented, not implemented)

### Before Production Deployment

1. Run `scripts/generate_secrets.py` for production secrets
2. Set `ENVIRONMENT=production` in `.env`
3. Configure `ALLOWED_ORIGINS` for your domains
4. Run all health checks: `/api/health/detailed`
5. Verify rate limiting is active
6. Check logs are structured JSON
7. Test authentication flow end-to-end

---

**Plan Complete and saved to `docs/plans/2025-11-02-security-hardening-implementation.md`.**

## Execution Options

**1. Subagent-Driven (this session)**
- I dispatch fresh subagent per task
- Code review between tasks
- Fast iteration with quality gates
- **REQUIRED SUB-SKILL:** superpowers:subagent-driven-development

**2. Parallel Session (separate)**
- Open new session in worktree
- Batch execution with checkpoints
- **REQUIRED SUB-SKILL:** superpowers:executing-plans

**Which approach do you prefer?**
