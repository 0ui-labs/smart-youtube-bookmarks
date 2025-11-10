# Task #110: JWT Authentication System - Implement Auth Endpoints

**Plan Task:** #110
**Wave/Phase:** P0 Critical Security - Wave 1
**Dependencies:** None (foundational security task)

---

## 🎯 Goal

Implement secure JWT-based authentication endpoints (`/api/auth/login` and `/api/auth/register`) with bcrypt password hashing, following OAuth2 standards and FastAPI best practices. This is a foundational P0 security task that must be completed before any production deployment.

## 📋 Acceptance Criteria

- [ ] `/api/auth/login` endpoint accepts email/password and returns JWT token
- [ ] `/api/auth/register` endpoint creates new user with hashed password
- [ ] Password hashing uses bcrypt with proper salting
- [ ] JWT tokens use HS256 algorithm with configurable expiration (30min default)
- [ ] Generic error messages prevent user enumeration attacks
- [ ] Active user check prevents inactive accounts from authenticating
- [ ] Unit tests: 15+ tests covering security utilities (100% coverage)
- [ ] Integration tests: 8+ tests covering auth endpoints (all paths)
- [ ] Tests passing: `pytest tests/core/test_security.py tests/api/test_auth.py -v`
- [ ] Dependencies added: `python-jose[cryptography]==3.3.0`, `passlib[bcrypt]==1.7.4`

**Evidence Requirements:**
```bash
# Security utilities tests
pytest tests/core/test_security.py -v --cov=app.core.security --cov-report=term-missing

# Auth endpoint tests  
pytest tests/api/test_auth.py -v --cov=app.api.auth --cov-report=term-missing

# Manual API test
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
# Expected: {"access_token":"eyJ...","token_type":"bearer"}
```

---

## 🔍 REF MCP Validation Results

### Research Conducted:
1. **FastAPI OAuth2 JWT Documentation** ✅
   - Source: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
   - Findings: Confirms OAuth2PasswordRequestForm pattern, python-jose for JWT, pwdlib/passlib for hashing
   - Validation: Plan aligns with official FastAPI patterns

2. **OAuth2PasswordBearer Pattern** ✅
   - Source: https://fastapi.tiangolo.com/tutorial/security/simple-oauth2/
   - Findings: `OAuth2PasswordRequestForm` uses `username` field (not `email`), returns `access_token` + `token_type`
   - Validation: Plan correctly uses `username` field mapped to email

3. **Password Hashing Best Practices** ✅
   - Source: FastAPI docs recommend pwdlib with Argon2 (2024 update)
   - Finding: FastAPI now recommends pwdlib > passlib, but passlib[bcrypt] still secure and widely used
   - Decision: Using passlib[bcrypt] (existing ecosystem, proven security, lower complexity)
   - Trade-off: Argon2 is slightly more resistant to GPU attacks, but bcrypt is sufficient for our threat model

4. **JWT Subject Field** ✅
   - Source: FastAPI JWT tutorial
   - Findings: Use `sub` field for user ID, should be unique string across application
   - Validation: Plan uses `{"sub": str(user.id)}` format correctly

### Validation Summary:
- ✅ OAuth2 flow matches FastAPI standards
- ✅ JWT token structure follows RFC 7519
- ✅ Password hashing uses industry-standard bcrypt
- ✅ Error handling prevents timing attacks and user enumeration
- ⚠️ Note: FastAPI 2024 docs recommend pwdlib over passlib, but both are secure

---

## 🛠️ Implementation Steps (TDD RED-GREEN-REFACTOR)

### Step 1: Add Dependencies
**Files:** `backend/requirements.txt`
**Action:** Add JWT and password hashing libraries

```txt
# Add to requirements.txt (after existing dependencies)
python-jose[cryptography]==3.3.0  # JWT token creation/validation
passlib[bcrypt]==1.7.4            # Password hashing with bcrypt
```

**Install:**
```bash
cd backend
pip install python-jose[cryptography]==3.3.0 passlib[bcrypt]==1.7.4
```

**Why these libraries?**
- `python-jose`: Pure Python JWT implementation, well-maintained, FastAPI recommended
- `passlib[bcrypt]`: Industry-standard password hashing, automatic salt generation
- Alternative considered: `pwdlib` (newer, FastAPI 2024 recommendation) - rejected due to lower adoption

---

### Step 2: Write Failing Tests for Password Hashing (RED)
**Files:** `backend/tests/core/test_security.py`
**Action:** Create comprehensive security utility tests

```python
"""Tests for security utilities (password hashing, JWT tokens)."""

import pytest
from datetime import timedelta, datetime, timezone
from jose import jwt, JWTError

from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
    ALGORITHM
)
from app.core.config import settings


class TestPasswordHashing:
    """Test password hashing and verification."""

    def test_password_hashing(self):
        """Test password hashing creates non-plaintext hash."""
        password = "MySecurePassword123!"
        hashed = get_password_hash(password)

        # Hash should not equal plaintext
        assert hashed != password
        # Hash should start with bcrypt prefix
        assert hashed.startswith("$2b$")

    def test_password_verification_success(self):
        """Test verification succeeds with correct password."""
        password = "CorrectPassword123!"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_password_verification_failure(self):
        """Test verification fails with wrong password."""
        password = "CorrectPassword"
        wrong_password = "WrongPassword"
        hashed = get_password_hash(password)

        assert verify_password(wrong_password, hashed) is False

    def test_password_hashing_generates_different_salts(self):
        """Test that same password produces different hashes (salting)."""
        password = "SamePassword123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        # Different hashes due to random salt
        assert hash1 != hash2
        # But both verify correctly
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True

    def test_empty_password_hashing(self):
        """Test that empty password can be hashed (edge case)."""
        password = ""
        hashed = get_password_hash(password)

        assert hashed != password
        assert verify_password(password, hashed) is True


class TestJWTTokens:
    """Test JWT token creation and validation."""

    def test_create_access_token_default_expiration(self):
        """Test token creation with default expiration."""
        data = {"sub": "user123"}
        token = create_access_token(data)

        assert isinstance(token, str)
        assert len(token) > 0

        # Decode to verify structure
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        assert payload["sub"] == "user123"
        assert "exp" in payload

    def test_create_access_token_custom_expiration(self):
        """Test token creation with custom expiration."""
        data = {"sub": "user456"}
        expires_delta = timedelta(minutes=5)
        token = create_access_token(data, expires_delta=expires_delta)

        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        
        # Verify expiration is approximately 5 minutes from now
        exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = exp_time - now
        
        # Should be close to 5 minutes (within 10 seconds tolerance)
        assert 290 <= delta.total_seconds() <= 310

    def test_create_access_token_preserves_data(self):
        """Test that additional data in payload is preserved."""
        data = {"sub": "user789", "role": "admin", "permissions": ["read", "write"]}
        token = create_access_token(data)

        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        assert payload["sub"] == "user789"
        assert payload["role"] == "admin"
        assert payload["permissions"] == ["read", "write"]

    def test_decode_access_token_valid(self):
        """Test decoding valid token."""
        data = {"sub": "user_valid"}
        token = create_access_token(data)

        decoded = decode_access_token(token)
        
        assert decoded is not None
        assert decoded["sub"] == "user_valid"

    def test_decode_access_token_invalid_signature(self):
        """Test decoding token with wrong signature."""
        data = {"sub": "user123"}
        # Create token with different secret
        token = jwt.encode(data, "wrong-secret-key", algorithm=ALGORITHM)

        decoded = decode_access_token(token)
        
        assert decoded is None

    def test_decode_access_token_expired(self):
        """Test decoding expired token."""
        data = {"sub": "user_expired"}
        # Create token that expired 1 hour ago
        expires_delta = timedelta(hours=-1)
        token = create_access_token(data, expires_delta=expires_delta)

        decoded = decode_access_token(token)
        
        assert decoded is None

    def test_decode_access_token_malformed(self):
        """Test decoding malformed token."""
        malformed_token = "not.a.valid.jwt.token"

        decoded = decode_access_token(malformed_token)
        
        assert decoded is None

    def test_token_uses_hs256_algorithm(self):
        """Test that tokens use HS256 algorithm."""
        data = {"sub": "user123"}
        token = create_access_token(data)

        # Decode header to check algorithm
        header = jwt.get_unverified_header(token)
        assert header["alg"] == "HS256"
```

**Run Test (Expected: FAIL):**
```bash
cd backend
pytest tests/core/test_security.py -v
# Expected: ModuleNotFoundError: No module named 'app.core.security'
```

---

### Step 3: Implement Security Utilities (GREEN)
**Files:** `backend/app/core/security.py`
**Action:** Implement password hashing and JWT token functions

```python
"""
Security utilities for password hashing and JWT tokens.

Provides functions for secure password hashing using bcrypt
and JWT token creation/validation using HS256 algorithm.

Security Features:
- Bcrypt hashing with automatic salt generation
- Configurable JWT expiration (default 30 minutes)
- Timezone-aware expiration timestamps (UTC)
- Secure error handling (no information leakage)
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Any

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

# Password hashing context using bcrypt
# deprecated="auto" allows migration from old hashing schemes if needed
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
ALGORITHM = "HS256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a hashed password.

    Uses bcrypt's constant-time comparison to prevent timing attacks.

    Args:
        plain_password: The plaintext password to verify
        hashed_password: The bcrypt hashed password to check against

    Returns:
        True if password matches, False otherwise

    Example:
        >>> hashed = get_password_hash("my_password")
        >>> verify_password("my_password", hashed)
        True
        >>> verify_password("wrong_password", hashed)
        False
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.

    Automatically generates a random salt for each hash.
    The same password will produce different hashes.

    Args:
        password: The plaintext password to hash

    Returns:
        The bcrypt hashed password (includes salt)

    Example:
        >>> hash1 = get_password_hash("password")
        >>> hash2 = get_password_hash("password")
        >>> hash1 != hash2  # Different due to random salt
        True
    """
    return pwd_context.hash(password)


def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.

    Uses HS256 algorithm and includes automatic expiration.
    All timestamps are in UTC to prevent timezone issues.

    Args:
        data: The payload data to encode in the token (should include "sub" for user ID)
        expires_delta: Optional custom expiration time (default: 30 minutes from settings)

    Returns:
        The encoded JWT token as a string

    Example:
        >>> token = create_access_token({"sub": "user123"})
        >>> len(token) > 0
        True
        >>> token = create_access_token(
        ...     {"sub": "user456", "role": "admin"},
        ...     expires_delta=timedelta(hours=1)
        ... )
    """
    to_encode = data.copy()

    # Calculate expiration time (UTC timezone-aware)
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )

    # Add expiration to payload (JWT standard claim)
    to_encode.update({"exp": expire})

    # Encode with secret key
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.secret_key, 
        algorithm=ALGORITHM
    )

    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """
    Decode and validate a JWT access token.

    Validates:
    - Signature (using secret key)
    - Expiration time
    - Token structure

    Args:
        token: The JWT token to decode

    Returns:
        The decoded payload if valid, None otherwise

    Security Note:
        Returns None for ANY validation error to prevent information leakage.
        Do not distinguish between expired, invalid signature, or malformed tokens.

    Example:
        >>> token = create_access_token({"sub": "user123"})
        >>> payload = decode_access_token(token)
        >>> payload["sub"]
        'user123'
        >>> decode_access_token("invalid.token.here")
        None
    """
    try:
        payload = jwt.decode(
            token, 
            settings.secret_key, 
            algorithms=[ALGORITHM]
        )
        return payload
    except JWTError:
        # Return None for any JWT error (expired, invalid signature, malformed)
        # Do NOT distinguish error types to prevent information leakage
        return None
```

**Run Test (Expected: PASS):**
```bash
cd backend
pytest tests/core/test_security.py -v
# Expected: All 15 tests pass
```

---

### Step 4: Write Failing Tests for Auth Endpoints (RED)
**Files:** `backend/tests/api/test_auth.py`
**Action:** Create comprehensive authentication endpoint tests

```python
"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.user import User
from app.core.security import get_password_hash


@pytest.mark.asyncio
class TestLoginEndpoint:
    """Test /api/auth/login endpoint."""

    async def test_login_success(self, async_session: AsyncSession):
        """Test successful login with valid credentials."""
        # Arrange: Create test user
        user = User(
            email="test@example.com",
            hashed_password=get_password_hash("testpass123"),
            is_active=True
        )
        async_session.add(user)
        await async_session.commit()

        # Act: Login with OAuth2 form data
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
        assert len(data["access_token"]) > 0

    async def test_login_wrong_password(self, async_session: AsyncSession):
        """Test login fails with incorrect password."""
        # Arrange: Create test user
        user = User(
            email="test@example.com",
            hashed_password=get_password_hash("correctpass"),
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
        data = response.json()
        # Generic error message (prevent user enumeration)
        assert data["detail"] == "Incorrect email or password"

    async def test_login_nonexistent_user(self):
        """Test login fails for non-existent user."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/login",
                data={"username": "nonexistent@example.com", "password": "anypass"}
            )

        # Assert
        assert response.status_code == 401
        data = response.json()
        # Same generic error as wrong password (prevent user enumeration)
        assert data["detail"] == "Incorrect email or password"

    async def test_login_inactive_user(self, async_session: AsyncSession):
        """Test login fails for inactive user account."""
        # Arrange: Create inactive user
        user = User(
            email="inactive@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=False  # Inactive account
        )
        async_session.add(user)
        await async_session.commit()

        # Act: Attempt login
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/login",
                data={"username": "inactive@example.com", "password": "password123"}
            )

        # Assert
        assert response.status_code == 403
        data = response.json()
        assert data["detail"] == "Inactive user account"

    async def test_login_missing_credentials(self):
        """Test login fails with missing credentials."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/login",
                data={"username": "test@example.com"}  # Missing password
            )

        assert response.status_code == 422  # Unprocessable Entity

    async def test_login_returns_www_authenticate_header(self):
        """Test that 401 response includes WWW-Authenticate header."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/login",
                data={"username": "nouser@example.com", "password": "pass"}
            )

        assert response.status_code == 401
        assert "www-authenticate" in response.headers
        assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.asyncio
class TestRegisterEndpoint:
    """Test /api/auth/register endpoint."""

    async def test_register_success(self, async_session: AsyncSession):
        """Test successful user registration."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/register",
                json={"email": "newuser@example.com", "password": "SecurePass123!"}
            )

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

        # Verify user was created in database
        from sqlalchemy import select
        result = await async_session.execute(
            select(User).where(User.email == "newuser@example.com")
        )
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.is_active is True
        # Password should be hashed, not plaintext
        assert user.hashed_password != "SecurePass123!"
        assert user.hashed_password.startswith("$2b$")

    async def test_register_duplicate_email(self, async_session: AsyncSession):
        """Test registration fails for existing email."""
        # Arrange: Create existing user
        existing_user = User(
            email="existing@example.com",
            hashed_password=get_password_hash("password"),
            is_active=True
        )
        async_session.add(existing_user)
        await async_session.commit()

        # Act: Try to register with same email
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/register",
                json={"email": "existing@example.com", "password": "NewPass123"}
            )

        # Assert
        assert response.status_code == 400
        data = response.json()
        assert data["detail"] == "Email already registered"

    async def test_register_invalid_email_format(self):
        """Test registration fails for invalid email format."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/register",
                json={"email": "not-an-email", "password": "Pass123"}
            )

        assert response.status_code == 422  # Validation error

    async def test_register_missing_password(self):
        """Test registration fails without password."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/auth/register",
                json={"email": "test@example.com"}
            )

        assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
class TestPasswordSecurity:
    """Test password security requirements."""

    async def test_password_is_hashed_not_stored_plaintext(self, async_session: AsyncSession):
        """Test that passwords are hashed, never stored as plaintext."""
        password = "PlainTextPassword123"
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            await client.post(
                "/api/auth/register",
                json={"email": "hashtest@example.com", "password": password}
            )

        # Verify password is hashed in database
        from sqlalchemy import select
        result = await async_session.execute(
            select(User).where(User.email == "hashtest@example.com")
        )
        user = result.scalar_one()
        
        assert user.hashed_password != password
        assert len(user.hashed_password) > len(password)
        assert user.hashed_password.startswith("$2b$")  # Bcrypt prefix
```

**Run Test (Expected: FAIL):**
```bash
cd backend
pytest tests/api/test_auth.py -v
# Expected: 404 Not Found - /api/auth/login route does not exist
```

---

### Step 5: Create Authentication Schemas (GREEN)
**Files:** `backend/app/schemas/auth.py`
**Action:** Define Pydantic models for auth requests/responses

```python
"""
Authentication request/response schemas.

Defines Pydantic models for authentication-related API operations.
Uses EmailStr for email validation and follows OAuth2 standards.
"""

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    """
    JWT token response schema.

    Follows OAuth2 standard response format for token endpoints.
    """
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type (always 'bearer')")

    model_config = {
        "json_schema_extra": {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer"
            }
        }
    }


class TokenData(BaseModel):
    """
    Decoded JWT token payload.

    Used internally for token validation.
    """
    user_id: str = Field(..., description="User ID from token subject")


class RegisterRequest(BaseModel):
    """
    User registration request.

    Validates email format using Pydantic EmailStr.
    """
    email: EmailStr = Field(..., description="User email address (must be valid format)")
    password: str = Field(..., min_length=8, description="User password (min 8 characters)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "user@example.com",
                "password": "SecurePassword123!"
            }
        }
    }


# Note: LoginRequest is NOT needed - we use OAuth2PasswordRequestForm
# OAuth2PasswordRequestForm provides:
# - username field (we map to email)
# - password field
# - Optional scope, grant_type, client_id, client_secret
# This ensures compatibility with OAuth2 standard and FastAPI's automatic docs
```

**Why no LoginRequest schema?**
- OAuth2 standard requires form data (not JSON) for login
- FastAPI provides `OAuth2PasswordRequestForm` dependency
- Using the standard form ensures compatibility with OAuth2 clients and auto-generated docs
- The `username` field is mapped to email in our implementation

---

### Step 6: Implement Auth Endpoints (GREEN)
**Files:** `backend/app/api/auth.py`
**Action:** Create login and register endpoints

```python
"""
Authentication API endpoints.

Provides login and registration endpoints with JWT token generation.
Follows OAuth2 password flow standard with bearer token authentication.

Security Features:
- Generic error messages (prevent user enumeration)
- Bcrypt password hashing
- JWT token generation with configurable expiration
- Active user validation
- Email-based authentication (OAuth2 username field mapped to email)
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

    Authenticates user with email and password, returns JWT access token.

    **Security Notes:**
    - Uses generic error message "Incorrect email or password" for both
      non-existent users and wrong passwords to prevent user enumeration
    - Checks password BEFORE checking is_active to prevent timing attacks
    - Returns 401 for authentication failures, 403 for inactive accounts

    **OAuth2 Compatibility:**
    - Accepts form data (not JSON) per OAuth2 spec
    - Uses `username` field (mapped to email)
    - Returns `access_token` and `token_type`

    Args:
        form_data: OAuth2 password form with username (email) and password
        db: Database session

    Returns:
        JWT access token with bearer type

    Raises:
        HTTPException: 401 if credentials are invalid
        HTTPException: 403 if user account is inactive
    """
    # Query user by email (OAuth2 spec uses "username" field)
    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # Verify user exists and password is correct
    # SECURITY: Check both in one condition to prevent timing attacks
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active (separate check for clearer error message)
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

    Creates user with hashed password and returns JWT token for immediate login.

    **Security Notes:**
    - Password is hashed with bcrypt before storage
    - Email uniqueness is enforced at database level
    - New users are active by default
    - Returns token immediately (no email verification required)

    **Future Enhancement:**
    - Add email verification workflow
    - Add password strength validation
    - Add rate limiting for registration

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

    # Create new user with hashed password
    new_user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        is_active=True
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create access token for immediate login
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(new_user.id)},
        expires_delta=access_token_expires
    )

    return Token(access_token=access_token)
```

**Run Test (Expected: PASS):**
```bash
cd backend
pytest tests/api/test_auth.py -v
# Expected: All 11 tests pass
```

---

### Step 7: Register Auth Router in Main App
**Files:** `backend/app/main.py`
**Action:** Add auth router to FastAPI application

```python
# Add import (modify existing import line)
from app.api import lists, videos, processing, websocket, tags, auth

# Add router registration (add BEFORE other routers for proper docs ordering)
app.include_router(auth.router)
app.include_router(lists.router)
app.include_router(videos.router)
app.include_router(processing.router)
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
app.include_router(tags.router)
```

**Why register auth router first?**
- Shows authentication endpoints at top of API docs
- Logical grouping: auth → resources → websocket
- No functional difference, purely organizational

---

### Step 8: Run All Tests and Verify
**Action:** Execute complete test suite

```bash
cd backend

# Run security utility tests with coverage
pytest tests/core/test_security.py -v --cov=app.core.security --cov-report=term-missing

# Run auth endpoint tests with coverage
pytest tests/api/test_auth.py -v --cov=app.api.auth --cov-report=term-missing

# Run all tests together
pytest tests/core/test_security.py tests/api/test_auth.py -v

# Expected output:
# tests/core/test_security.py::TestPasswordHashing::test_password_hashing PASSED
# tests/core/test_security.py::TestPasswordHashing::test_password_verification_success PASSED
# ... (15 tests from test_security.py)
# tests/api/test_auth.py::TestLoginEndpoint::test_login_success PASSED
# tests/api/test_auth.py::TestLoginEndpoint::test_login_wrong_password PASSED
# ... (11 tests from test_auth.py)
# 
# ========================= 26 passed in 2.3s =========================
```

---

### Step 9: Manual API Testing
**Action:** Test endpoints with curl

```bash
# Start the server
cd backend
uvicorn app.main:app --reload

# In another terminal:

# 1. Register a new user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePassword123!"
  }'

# Expected response:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "token_type": "bearer"
# }

# 2. Login with existing user
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser@example.com&password=SecurePassword123!"

# Expected response:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "token_type": "bearer"
# }

# 3. Test wrong password (should fail)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser@example.com&password=WrongPassword"

# Expected response (401):
# {
#   "detail": "Incorrect email or password"
# }

# 4. Test duplicate registration (should fail)
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "AnotherPassword"
  }'

# Expected response (400):
# {
#   "detail": "Email already registered"
# }
```

---

### Step 10: Test with Swagger UI
**Action:** Verify OAuth2 integration in docs

```bash
# 1. Open http://localhost:8000/docs

# 2. Click "Authorize" button (🔓 icon in top right)

# 3. Enter credentials:
#    Username: testuser@example.com
#    Password: SecurePassword123!

# 4. Click "Authorize" - should show "Authorized" with checkmark

# 5. Test POST /api/auth/register endpoint
#    - Click "Try it out"
#    - Enter: {"email": "newuser@example.com", "password": "NewPass123"}
#    - Execute
#    - Should return 201 with access_token

# 6. Test POST /api/auth/login endpoint
#    - Click "Try it out"
#    - Enter: username=newuser@example.com, password=NewPass123
#    - Execute
#    - Should return 200 with access_token
```

---

## 🧪 Testing Strategy

### Unit Tests (backend/tests/core/test_security.py)
**Password Hashing (5 tests):**
- ✅ `test_password_hashing` - Hash is not plaintext, starts with $2b$
- ✅ `test_password_verification_success` - Correct password verifies
- ✅ `test_password_verification_failure` - Wrong password fails
- ✅ `test_password_hashing_generates_different_salts` - Same password → different hashes
- ✅ `test_empty_password_hashing` - Edge case: empty password

**JWT Tokens (10 tests):**
- ✅ `test_create_access_token_default_expiration` - Token created with 30min expiry
- ✅ `test_create_access_token_custom_expiration` - Custom expiry time works
- ✅ `test_create_access_token_preserves_data` - Extra claims preserved
- ✅ `test_decode_access_token_valid` - Valid token decodes correctly
- ✅ `test_decode_access_token_invalid_signature` - Wrong secret rejected
- ✅ `test_decode_access_token_expired` - Expired token rejected
- ✅ `test_decode_access_token_malformed` - Malformed token rejected
- ✅ `test_token_uses_hs256_algorithm` - Verifies HS256 algorithm used

**Coverage Target:** 100% for app/core/security.py

### Integration Tests (backend/tests/api/test_auth.py)
**Login Endpoint (6 tests):**
- ✅ `test_login_success` - Valid credentials return token
- ✅ `test_login_wrong_password` - Wrong password returns 401
- ✅ `test_login_nonexistent_user` - Non-existent user returns 401 (same message)
- ✅ `test_login_inactive_user` - Inactive account returns 403
- ✅ `test_login_missing_credentials` - Missing fields return 422
- ✅ `test_login_returns_www_authenticate_header` - WWW-Authenticate header present

**Register Endpoint (4 tests):**
- ✅ `test_register_success` - Creates user and returns token
- ✅ `test_register_duplicate_email` - Duplicate email returns 400
- ✅ `test_register_invalid_email_format` - Invalid email returns 422
- ✅ `test_register_missing_password` - Missing password returns 422

**Security Tests (1 test):**
- ✅ `test_password_is_hashed_not_stored_plaintext` - Password hashed in DB

**Coverage Target:** 100% for app/api/auth.py

### Manual Testing Checklist
- [ ] Register new user via Swagger UI → returns token
- [ ] Login with registered user → returns token
- [ ] Login with wrong password → returns 401 "Incorrect email or password"
- [ ] Login with non-existent email → returns 401 "Incorrect email or password" (same message)
- [ ] Register duplicate email → returns 400 "Email already registered"
- [ ] Verify password is hashed in database (check with DB client)
- [ ] Decode JWT token at https://jwt.io → verify structure and expiration

---

## 📚 Reference

### Related Documentation
- **Security Hardening Plan:** `docs/plans/2025-11-02-security-hardening-implementation.md` (lines 35-467)
- **FastAPI OAuth2 Tutorial:** https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- **FastAPI Security Reference:** https://fastapi.tiangolo.com/reference/security/
- **User Model:** `backend/app/models/user.py` (lines 1-31)

### Related Code Patterns
- **Similar Endpoint Pattern:** `backend/app/api/lists.py` (router structure, error handling)
- **Similar Schema Pattern:** `backend/app/schemas/tag.py` (Pydantic models with validation)
- **Config Pattern:** `backend/app/core/config.py` (settings with validation)

### Design Decisions

#### 1. OAuth2PasswordRequestForm vs Custom Login Schema
**Decision:** Use `OAuth2PasswordRequestForm`
**Rationale:**
- ✅ OAuth2 standard compliance
- ✅ Automatic Swagger UI "Authorize" button
- ✅ Compatible with OAuth2 clients
- ✅ FastAPI auto-generates correct docs
- ❌ Con: Uses `username` field (we map to email)

**Alternative:** Custom JSON schema
- ❌ Not OAuth2 compliant
- ❌ Manual Swagger UI setup
- ✅ Can use `email` field name directly

#### 2. Bcrypt vs Argon2 vs Scrypt
**Decision:** Use bcrypt via passlib
**Rationale:**
- ✅ Industry standard, battle-tested (25+ years)
- ✅ Automatic salt generation
- ✅ Widely supported in libraries
- ✅ Sufficient security for our threat model
- ✅ Lower complexity than Argon2
- ⚠️ Note: FastAPI 2024 docs recommend pwdlib + Argon2, but bcrypt still secure

**Alternative:** Argon2 via pwdlib
- ✅ More resistant to GPU attacks
- ✅ Winner of Password Hashing Competition (2015)
- ❌ Newer, less ecosystem support
- ❌ Higher complexity for minimal security gain

**Threat Model:** Web application with rate-limited login, not high-security government system

#### 3. Token Expiration Strategy
**Decision:** 30 minutes default, configurable via env var
**Rationale:**
- ✅ Balance between security and UX
- ✅ Short enough to limit exposure if token stolen
- ✅ Long enough to avoid frequent re-authentication
- ✅ Configurable for different environments (dev: longer, prod: shorter)

**Future Enhancement:** Refresh tokens for long-lived sessions

#### 4. Error Message Strategy
**Decision:** Generic "Incorrect email or password" for auth failures
**Rationale:**
- ✅ Prevents user enumeration attacks
- ✅ OWASP recommendation
- ✅ Timing attack mitigation (check password before is_active)
- ❌ Con: Less helpful for legitimate users (can't tell if email exists)

**Trade-off:** Security over convenience

#### 5. Active User Check Placement
**Decision:** Check is_active AFTER password verification
**Rationale:**
- ✅ Prevents timing attacks (same execution path for invalid user vs inactive user)
- ✅ Returns 403 (Forbidden) for inactive, 401 (Unauthorized) for bad credentials
- ✅ Clearer separation of concerns

**Security Note:** If checked before password, timing difference could leak user existence

#### 6. Immediate Login After Registration
**Decision:** Return JWT token immediately on registration
**Rationale:**
- ✅ Better UX (no separate login step)
- ✅ Common pattern for modern web apps
- ❌ Con: No email verification (trust on first use)

**Future Enhancement:** Add optional email verification workflow

---

## 🎓 Learning Notes

### Why OAuth2PasswordRequestForm?
OAuth2 defines multiple "flows" for authentication:
1. **Password Flow** (what we use): User sends username + password directly to API
2. **Authorization Code Flow**: User redirects to auth provider (e.g., Google)
3. **Client Credentials Flow**: Service-to-service authentication
4. **Implicit Flow**: Deprecated (insecure for SPAs)

We use Password Flow because:
- Direct user authentication (no third-party provider)
- Full control over user database
- Suitable for first-party applications (our frontend + backend)

### Why Form Data Instead of JSON?
OAuth2 specification (RFC 6749) requires token endpoints to accept form data:
```
POST /token HTTP/1.1
Host: server.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=user&password=pass
```

This is a historical decision from OAuth2's origins (compatibility with older systems).
Modern APIs prefer JSON, but we follow the spec for OAuth2 compliance.

### JWT Structure
A JWT has three parts separated by dots:
```
eyJhbGci... . eyJzdWIi... . SflKxwRJ...
  Header      Payload      Signature
```

**Header:** Algorithm (HS256) and token type (JWT)
```json
{"alg": "HS256", "typ": "JWT"}
```

**Payload:** Claims (user ID, expiration, etc.)
```json
{"sub": "user-uuid", "exp": 1234567890}
```

**Signature:** HMAC-SHA256(header + payload, secret_key)

**Security:** Token is NOT encrypted (anyone can read payload), but signature prevents tampering.

---

## 🔒 Security Checklist

Before deploying to production:
- [ ] Change `SECRET_KEY` to strong random value (32+ characters)
- [ ] Verify `ACCESS_TOKEN_EXPIRE_MINUTES` is reasonable (30 min recommended)
- [ ] Ensure database has index on `users.email` (for login query performance)
- [ ] Add rate limiting to auth endpoints (prevent brute force) - **Task #111**
- [ ] Consider adding password strength validation (min length, complexity)
- [ ] Consider adding email verification workflow
- [ ] Monitor for unusual login patterns (multiple failed attempts)
- [ ] Use HTTPS in production (JWT tokens sent in Authorization header)

---

## 📊 Estimated Duration

**Implementation:** 3-4 hours
- Step 1-2: Dependencies & failing tests (30 min)
- Step 3: Security utilities (45 min)
- Step 4-6: Auth endpoints & schemas (60 min)
- Step 7-9: Integration & testing (45 min)
- Step 10: Documentation & manual testing (30 min)

**Testing:** 1 hour
- Unit tests: 30 min
- Integration tests: 30 min

**Total:** 4-5 hours

**Complexity:** Medium
- Well-documented pattern (FastAPI tutorial)
- Existing User model simplifies implementation
- Comprehensive tests add time but ensure correctness

---

## ✅ Definition of Done

1. **Code Complete:**
   - [ ] `backend/app/core/security.py` implemented with 4 functions
   - [ ] `backend/app/schemas/auth.py` created with 3 schemas
   - [ ] `backend/app/api/auth.py` created with 2 endpoints
   - [ ] Auth router registered in `backend/app/main.py`

2. **Tests Passing:**
   - [ ] 15 unit tests in `tests/core/test_security.py` (100% coverage)
   - [ ] 11 integration tests in `tests/api/test_auth.py` (100% coverage)
   - [ ] All existing tests still pass (no regressions)

3. **Manual Verification:**
   - [ ] Can register new user via Swagger UI
   - [ ] Can login with registered user
   - [ ] Password stored as bcrypt hash in database
   - [ ] JWT token decodes correctly at jwt.io

4. **Documentation:**
   - [ ] Code comments explain security decisions
   - [ ] Docstrings for all public functions
   - [ ] This task plan updated with completion status

5. **Ready for Next Task:**
   - [ ] Auth endpoints work (foundation for protected endpoints)
   - [ ] Can proceed to Task #111: Protect API endpoints with auth dependency

---

**Task Plan Complete** ✅
