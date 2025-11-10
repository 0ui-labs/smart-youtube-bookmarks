# Task #116: Secure Default Credentials - Create Secret Generation Script

**Plan Task:** #116
**Wave/Phase:** P0 Critical Security (Pre-Production)
**Dependencies:** None

---

## 🎯 Ziel

Replace all weak default passwords and secrets with cryptographically secure random values. Create a secret generation script and validation system to prevent deployment with insecure credentials. This task addresses the critical security vulnerability of hardcoded passwords in `docker-compose.yml` (POSTGRES_PASSWORD=changeme, no Redis password).

## 📋 Acceptance Criteria

- [ ] Script generates cryptographically secure secrets using Python `secrets` module
- [ ] All secrets use alphanumeric-only alphabet for dotenv compatibility (documented trade-off)
- [ ] `.env.example` updated with `CHANGE_ME_RUN_scripts_generate_secrets_py` placeholders
- [ ] `docker-compose.yml` uses environment variables instead of hardcoded passwords
- [ ] Pydantic validators enforce minimum secret lengths and reject weak defaults
- [ ] Documentation created for secrets setup (Quick Start + Production guide)
- [ ] `.env` confirmed in `.gitignore`
- [ ] Script tested and produces valid secrets
- [ ] Validation tested with weak and strong secrets

---

## 🛠️ Implementation Steps

### 1. Create Secret Generation Script

**Files:** `backend/scripts/generate_secrets.py`
**Action:** Create script using `secrets` module with dotenv-safe alphabet

```python
#!/usr/bin/env python3
"""
Generate secure random secrets for the application.

This script generates cryptographically secure random secrets suitable for
production use. All secrets use alphanumeric characters (a-z, A-Z, 0-9) to
ensure compatibility with .env file parsers.

Security Note:
- Uses Python's secrets module (CSPRNG)
- 62-character alphabet provides 2^384 bits entropy for 64-char secrets
- Avoids special characters that break .env parsing (=, ', ", #, \, etc.)

Usage:
    python backend/scripts/generate_secrets.py > .env
    # Or append to existing .env:
    python backend/scripts/generate_secrets.py >> .env
"""

import secrets
import string
from datetime import datetime


def generate_secret_key(length: int = 64) -> str:
    """
    Generate a secure random secret key for JWT signing.
    
    Uses alphanumeric-only alphabet (62 characters: a-z, A-Z, 0-9) to ensure
    .env file compatibility. Special characters like =, ', ", #, \ can break
    dotenv parsers.
    
    Args:
        length: Secret length in characters (default: 64)
    
    Returns:
        Cryptographically secure random string
    
    Security:
        - 64 chars from 62-char alphabet = 2^384 bits entropy
        - Exceeds NIST recommendation of 2^128 bits for symmetric keys
        - Uses secrets.choice() which uses os.urandom() (CSPRNG)
    """
    alphabet = string.ascii_letters + string.digits  # a-zA-Z0-9 (62 chars)
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def generate_password(length: int = 32) -> str:
    """
    Generate a secure random password for database/Redis.
    
    Args:
        length: Password length in characters (default: 32)
    
    Returns:
        Cryptographically secure random password
    """
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def main():
    """Generate and print all required secrets in dotenv format."""
    print("# Generated Secrets - Add these to your .env file")
    print(f"# Generated: {datetime.now().isoformat()}")
    print("#")
    print("# SECURITY WARNING:")
    print("# - Keep these secrets secure!")
    print("# - Do NOT commit .env to version control")
    print("# - Use different secrets for each environment (dev/staging/prod)")
    print("# - Rotate secrets regularly in production")
    print()
    
    print("# Application Settings")
    print(f"SECRET_KEY={generate_secret_key(64)}")
    print("ACCESS_TOKEN_EXPIRE_MINUTES=30")
    print()
    
    print("# Database Configuration")
    print("POSTGRES_DB=youtube_bookmarks")
    print("POSTGRES_USER=youtube_user")
    print(f"POSTGRES_PASSWORD={generate_password(32)}")
    print("DATABASE_URL=postgresql+asyncpg://youtube_user:${POSTGRES_PASSWORD}@localhost:5432/youtube_bookmarks")
    print()
    
    print("# Redis Configuration")
    print(f"REDIS_PASSWORD={generate_password(32)}")
    print("REDIS_URL=redis://localhost:6379/0")
    print()
    
    print("# API Keys (Optional - for YouTube Data API)")
    print("YOUTUBE_API_KEY=")
    print("GEMINI_API_KEY=")
    print()
    
    print("# Environment")
    print("ENVIRONMENT=development")


if __name__ == "__main__":
    main()
```

**Make Executable:**
```bash
chmod +x backend/scripts/generate_secrets.py
```

**Validation:**
- Test script runs without errors
- Verify output is valid dotenv format
- Confirm secrets are random (run multiple times, check uniqueness)

---

### 2. Update .env.example with Security Placeholders

**Files:** `.env.example`
**Action:** Replace weak defaults with `CHANGE_ME_RUN_scripts_generate_secrets_py` placeholders

```bash
# SECURITY: DO NOT USE THESE DEFAULTS IN PRODUCTION!
# Run: python backend/scripts/generate_secrets.py > .env

# Application Settings
SECRET_KEY=CHANGE_ME_RUN_scripts_generate_secrets_py
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Database Configuration
POSTGRES_DB=youtube_bookmarks
POSTGRES_USER=youtube_user
POSTGRES_PASSWORD=CHANGE_ME_RUN_scripts_generate_secrets_py
DATABASE_URL=postgresql+asyncpg://youtube_user:${POSTGRES_PASSWORD}@localhost:5432/youtube_bookmarks

# Redis Configuration
REDIS_PASSWORD=CHANGE_ME_RUN_scripts_generate_secrets_py
REDIS_URL=redis://localhost:6379/0

# API Keys (Optional - for YouTube Data API)
YOUTUBE_API_KEY=
GEMINI_API_KEY=

# Environment
ENVIRONMENT=development
```

**Validation:**
- Verify placeholder string is obvious and actionable
- Ensure DATABASE_URL uses variable interpolation `${POSTGRES_PASSWORD}`
- Confirm REDIS_PASSWORD is now included

---

### 3. Update docker-compose.yml to Use Environment Variables

**Files:** `docker-compose.yml`
**Action:** Replace hardcoded passwords with environment variable references

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

**Changes:**
- Remove `:-` default value syntax (no fallbacks for security)
- Add `env_file: - .env` to both services
- Add `command: redis-server --requirepass ${REDIS_PASSWORD}` to Redis
- Update Redis healthcheck to authenticate with password

**Validation:**
- Test `docker-compose config` shows interpolated values
- Verify services start with `.env` file present
- Confirm services fail gracefully without `.env` (no weak defaults)

---

### 4. Add Pydantic Validators to Config Class

**Files:** `backend/app/core/config.py`
**Action:** Add field validators to enforce secret strength and reject weak defaults

```python
"""
Application configuration module.

This module defines the settings for the Smart YouTube Bookmarks application,
including database connection strings, API keys, and environment configuration.
Settings can be overridden via environment variables or a .env file.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str
    postgres_password: str  # Now required for validation

    # Redis
    redis_url: str
    redis_password: str  # Now required

    # External APIs
    youtube_api_key: str = ""
    gemini_api_key: str = ""

    # Authentication (JWT)
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # App
    env: str = "development"

    # Database connection pool (for ARQ workers)
    db_pool_size: int = 10
    db_max_overflow: int = 5
    db_pool_pre_ping: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        """
        Validate JWT secret key for cryptographic strength.

        Security Requirements:
        - Minimum 32 characters (NIST recommendation)
        - Must not be default/placeholder value
        - Enforced in ALL environments (dev and prod)

        Args:
            v: Secret key value
            info: Validation context

        Returns:
            Validated secret key

        Raises:
            ValueError: If secret is too short or is a known weak default
        
        References:
            - NIST SP 800-57 Part 1 Rev. 5 (Key Management)
            - OWASP ASVS v4.0 Section 6.2 (Cryptographic Algorithms)
        """
        # List of known weak/default values
        KNOWN_WEAK_SECRETS = [
            "your-secret-key-here-change-in-production",
            "CHANGE_ME_RUN_scripts_generate_secrets_py",
            "secret",
            "changeme",
            "password",
            "12345",
        ]

        # Check minimum length (32 chars = 192 bits entropy with alphanumeric)
        if len(v) < 32:
            raise ValueError(
                f"SECRET_KEY must be at least 32 characters for cryptographic security. "
                f"Current length: {len(v)}. "
                f"Run: python backend/scripts/generate_secrets.py > .env"
            )

        # Check for known weak values (case-insensitive)
        if v.lower() in [s.lower() for s in KNOWN_WEAK_SECRETS]:
            raise ValueError(
                f"SECRET_KEY cannot use default or weak value: '{v}'. "
                f"Run: python backend/scripts/generate_secrets.py > .env"
            )

        return v

    @field_validator("postgres_password")
    @classmethod
    def validate_postgres_password(cls, v: str, info) -> str:
        """
        Validate PostgreSQL password for minimum strength.

        Security Requirements:
        - Minimum 16 characters
        - Must not be default/placeholder value
        - Enforced in ALL environments

        Args:
            v: Password value
            info: Validation context

        Returns:
            Validated password

        Raises:
            ValueError: If password is too short or is a known weak default
        """
        KNOWN_WEAK_PASSWORDS = [
            "changeme",
            "CHANGE_ME_RUN_scripts_generate_secrets_py",
            "password",
            "postgres",
            "12345",
        ]

        if len(v) < 16:
            raise ValueError(
                f"POSTGRES_PASSWORD must be at least 16 characters. "
                f"Current length: {len(v)}. "
                f"Run: python backend/scripts/generate_secrets.py > .env"
            )

        if v.lower() in [p.lower() for p in KNOWN_WEAK_PASSWORDS]:
            raise ValueError(
                f"POSTGRES_PASSWORD cannot use default or weak value. "
                f"Run: python backend/scripts/generate_secrets.py > .env"
            )

        return v

    @field_validator("redis_password")
    @classmethod
    def validate_redis_password(cls, v: str, info) -> str:
        """
        Validate Redis password for minimum strength.

        Security Requirements:
        - Minimum 16 characters
        - Must not be default/placeholder value
        - Enforced in ALL environments

        Args:
            v: Password value
            info: Validation context

        Returns:
            Validated password

        Raises:
            ValueError: If password is too short or is a known weak default
        """
        KNOWN_WEAK_PASSWORDS = [
            "changeme",
            "CHANGE_ME_RUN_scripts_generate_secrets_py",
            "password",
            "redis",
            "12345",
        ]

        if len(v) < 16:
            raise ValueError(
                f"REDIS_PASSWORD must be at least 16 characters. "
                f"Current length: {len(v)}. "
                f"Run: python backend/scripts/generate_secrets.py > .env"
            )

        if v.lower() in [p.lower() for p in KNOWN_WEAK_PASSWORDS]:
            raise ValueError(
                f"REDIS_PASSWORD cannot use default or weak value. "
                f"Run: python backend/scripts/generate_secrets.py > .env"
            )

        return v

    @field_validator("gemini_api_key")
    @classmethod
    def validate_gemini_api_key(cls, v: str, info) -> str:
        """
        Validate Gemini API key at startup.

        In production, require API key to be set (non-empty).
        In development, allow empty but warn if Gemini features are used.

        Args:
            v: Gemini API key value
            info: Validation context

        Returns:
            Validated API key

        Raises:
            ValueError: If production environment has empty API key
        """
        import logging

        # Get env from values being validated
        env = info.data.get("env", "development")

        # Check if API key is empty
        is_empty = not v or not v.strip()

        # In production, reject empty API key
        if env == "production" and is_empty:
            raise ValueError(
                "Gemini API key is required in production. "
                "Set GEMINI_API_KEY environment variable."
            )

        # In development, warn if empty (features requiring Gemini will fail)
        if is_empty and env == "development":
            logging.warning(
                "Gemini API key not set. "
                "Video extraction features will not work. "
                "Set GEMINI_API_KEY environment variable to enable."
            )

        return v


settings = Settings()
```

**Changes:**
- Add `postgres_password: str` and `redis_password: str` as required fields
- Add three new `@field_validator` methods with `@classmethod` decorator
- Remove `database_url` default (force explicit configuration)
- Use Pydantic v2 syntax: `@field_validator("field_name")` with `info` parameter
- Include helpful error messages with remediation instructions

**Validation:**
- Test startup fails with weak secrets (verify each validator)
- Test startup succeeds with strong generated secrets
- Verify error messages include actionable instructions

---

### 5. Create Secrets Setup Documentation

**Files:** `docs/deployment/SECRETS_SETUP.md`
**Action:** Create comprehensive guide for secret generation and management

```markdown
# Secrets Setup Guide

## Overview

This guide explains how to generate and manage cryptographically secure secrets for the Smart YouTube Bookmarks application. **Never use default passwords in production.**

## Table of Contents

- [Quick Start (Development)](#quick-start-development)
- [Manual Setup](#manual-setup)
- [Production Deployment](#production-deployment)
- [Security Requirements](#security-requirements)
- [Troubleshooting](#troubleshooting)
- [Secret Rotation](#secret-rotation)

---

## Quick Start (Development)

### Step 1: Generate Secrets

Run the secret generation script to create a new `.env` file:

```bash
# From project root
python backend/scripts/generate_secrets.py > .env
```

**Output example:**
```bash
# Generated Secrets - Add these to your .env file
# Generated: 2025-11-09T14:32:01.123456
SECRET_KEY=a8Kj3mP9xQ2nV7bC4rT1yU6eW0oI5lZ8sA3hF2gD9kM7nB4vX1qW6tY2rE5uI0p
POSTGRES_PASSWORD=xY7vB3nM9kL2jH6fD4sA1qW8eR5tY0uI
REDIS_PASSWORD=pL9oK8iJ7hG6fD5sA4qW3eR2tY1uI0mN
# ...
```

### Step 2: Verify .env File

Check that all placeholder values were replaced:

```bash
cat .env | grep CHANGE_ME
# Should return no results
```

### Step 3: Restart Services

Restart Docker containers to use new secrets:

```bash
docker-compose down
docker-compose up -d
```

Verify services are healthy:

```bash
docker-compose ps
# Both postgres and redis should show "healthy"
```

### Step 4: Start Backend

The backend will validate secrets on startup:

```bash
cd backend
uvicorn app.main:app --reload
```

**Success:** Server starts without validation errors.  
**Failure:** See error message for which secret failed validation.

---

## Manual Setup

If you prefer to set secrets manually (not recommended):

### Step 1: Copy Template

```bash
cp .env.example .env
```

### Step 2: Generate Individual Secrets

Use Python to generate secure random strings:

```python
import secrets
import string

# Generate 64-character secret key
alphabet = string.ascii_letters + string.digits
secret_key = ''.join(secrets.choice(alphabet) for _ in range(64))
print(f"SECRET_KEY={secret_key}")

# Generate 32-character password
password = ''.join(secrets.choice(alphabet) for _ in range(32))
print(f"POSTGRES_PASSWORD={password}")
```

**Important:** Use only alphanumeric characters (a-z, A-Z, 0-9) to avoid breaking .env file parsing.

### Step 3: Edit .env File

Replace all `CHANGE_ME_RUN_scripts_generate_secrets_py` placeholders with your generated secrets.

### Step 4: Validate Requirements

Ensure secrets meet minimum requirements:
- `SECRET_KEY`: Minimum 32 characters (recommended: 64)
- `POSTGRES_PASSWORD`: Minimum 16 characters (recommended: 32)
- `REDIS_PASSWORD`: Minimum 16 characters (recommended: 32)

---

## Production Deployment

### Critical Security Practices

1. **Never commit .env to version control**
   - Verify `.env` is in `.gitignore`
   - Use `git status` to check for accidentally staged secrets

2. **Use environment-specific secrets**
   - Generate different secrets for dev, staging, and production
   - Never reuse production secrets in other environments

3. **Store secrets in secure vault**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Cloud Secret Manager

4. **Rotate secrets regularly**
   - Change secrets every 90 days minimum
   - Immediate rotation after security incidents
   - Immediate rotation when team members leave

### Docker Compose Production Configuration

For production, use Docker secrets instead of environment variables:

```yaml
services:
  postgres:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password

secrets:
  postgres_password:
    external: true
```

See [Docker Secrets documentation](https://docs.docker.com/compose/how-tos/use-secrets/) for details.

### Environment Variable Injection

In production CI/CD pipelines, inject secrets at runtime:

```bash
# GitHub Actions example
- name: Deploy
  env:
    SECRET_KEY: ${{ secrets.SECRET_KEY }}
    POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
    REDIS_PASSWORD: ${{ secrets.REDIS_PASSWORD }}
  run: |
    docker-compose up -d
```

---

## Security Requirements

### Minimum Lengths

| Secret | Minimum | Recommended | Rationale |
|--------|---------|-------------|-----------|
| `SECRET_KEY` | 32 chars | 64 chars | NIST SP 800-57 recommends 128-bit keys; 64 alphanumeric chars = 384 bits |
| `POSTGRES_PASSWORD` | 16 chars | 32 chars | Protects against brute-force attacks on encrypted backups |
| `REDIS_PASSWORD` | 16 chars | 32 chars | Redis is often exposed to internal networks |

### Entropy Calculation

**Alphanumeric alphabet (62 characters):**
- 32 characters: 62^32 ≈ 2^190 bits entropy
- 64 characters: 62^64 ≈ 2^380 bits entropy

**Why not use special characters?**

Special characters like `=`, `'`, `"`, `#`, `\`, and spaces can break `.env` file parsers:

```bash
# BROKEN - equals sign terminates value
SECRET_KEY=abc=def

# BROKEN - hash starts a comment
SECRET_KEY=abc#def

# BROKEN - quotes require escaping
SECRET_KEY=abc"def
```

Using only alphanumeric characters ensures compatibility while maintaining cryptographic strength (62^64 possible combinations is astronomically large).

### Validation Enforcement

The application validates secrets on startup using Pydantic validators in `backend/app/core/config.py`:

- ✅ Minimum length checks
- ✅ Known weak value detection
- ✅ Helpful error messages with remediation steps

**Example validation error:**

```
pydantic_core._pydantic_core.ValidationError: 1 validation error for Settings
secret_key
  Value error, SECRET_KEY must be at least 32 characters for cryptographic security. 
  Current length: 16. Run: python backend/scripts/generate_secrets.py > .env
```

---

## Troubleshooting

### Error: "SECRET_KEY must be at least 32 characters"

**Cause:** Secret is too short for cryptographic security.

**Solution:**
```bash
python backend/scripts/generate_secrets.py > .env
```

### Error: "POSTGRES_PASSWORD cannot use default or weak value"

**Cause:** Using placeholder or common password.

**Solution:** Generate new secrets with the script.

### Error: "Field required" for postgres_password or redis_password

**Cause:** Missing required environment variables.

**Solution:**
1. Verify `.env` file exists in project root
2. Check `.env` contains `POSTGRES_PASSWORD` and `REDIS_PASSWORD`
3. Restart application

### Docker Compose: "WARNING: The POSTGRES_PASSWORD variable is not set"

**Cause:** Docker Compose cannot find `.env` file.

**Solution:**
1. Verify `.env` exists in same directory as `docker-compose.yml`
2. Check file permissions: `ls -la .env`
3. Test interpolation: `docker-compose config | grep PASSWORD`

### Redis Connection Error: "NOAUTH Authentication required"

**Cause:** Application connecting to Redis without password.

**Solution:**
1. Update `REDIS_URL` in `.env`:
   ```bash
   REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379/0
   ```
2. Restart services

---

## Secret Rotation

### When to Rotate

- **Scheduled:** Every 90 days
- **Immediately:** 
  - Security incident or breach
  - Team member with access leaves
  - Secret accidentally committed to git
  - Compliance requirement

### Rotation Procedure

#### Development/Staging

```bash
# 1. Generate new secrets
python backend/scripts/generate_secrets.py > .env.new

# 2. Stop services
docker-compose down

# 3. Backup old secrets (for rollback)
cp .env .env.backup

# 4. Apply new secrets
mv .env.new .env

# 5. Restart services
docker-compose up -d

# 6. Verify application starts successfully
curl http://localhost:8000/api/health

# 7. Delete backup if successful
rm .env.backup
```

#### Production

1. **Generate new secrets** using the script
2. **Update secrets in vault** (AWS Secrets Manager, etc.)
3. **Deploy with zero-downtime strategy:**
   - Blue-green deployment: Start new instances with new secrets
   - Rolling deployment: Update instances one at a time
4. **Verify health checks** pass on all instances
5. **Remove old secrets** from vault after 24-hour grace period

### Rollback Plan

If rotation causes issues:

```bash
# Restore backup
cp .env.backup .env

# Restart services
docker-compose restart
```

---

## Security Checklist

Before deploying to production:

- [ ] Generated strong random secrets using `generate_secrets.py`
- [ ] Verified `.env` is in `.gitignore`
- [ ] Confirmed no secrets in git history (`git log -p | grep -i password`)
- [ ] Different secrets for each environment (dev/staging/prod)
- [ ] Secrets stored in secure vault (production only)
- [ ] Team members trained to never commit secrets
- [ ] Secret rotation schedule established (90 days)
- [ ] Monitoring alerts configured for failed authentication
- [ ] Incident response plan documented

---

## Additional Resources

**Documentation:**
- [Python secrets module](https://docs.python.org/3/library/secrets.html)
- [Docker Compose environment variables](https://docs.docker.com/compose/how-tos/environment-variables/best-practices/)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

**Standards:**
- [NIST SP 800-57 Part 1 Rev. 5](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final) - Key Management
- [OWASP ASVS v4.0 Section 6.2](https://owasp.org/www-project-application-security-verification-standard/) - Cryptographic Algorithms

**Related Tasks:**
- Task #117: Rate Limiting Implementation
- Task #118: JWT Authentication System
```

**Validation:**
- Verify all code examples are executable
- Check all internal links work
- Ensure troubleshooting covers common errors
- Test Quick Start procedure end-to-end

---

### 6. Verify .env in .gitignore

**Files:** `.gitignore`
**Action:** Confirm `.env` is ignored and add variants

Current `.gitignore` already contains:
```
# Environment variables
.env
.env.local
```

**Additional patterns to add:**
```
# Environment variables
.env
.env.local
.env.*.local
.env.backup
.env.new
```

**Validation:**
```bash
# Test gitignore patterns
echo "test" > .env
echo "test" > .env.backup
git status
# Should NOT show .env or .env.backup as untracked
```

---

### 7. Test Script and Validation

**Action:** End-to-end testing of secret generation and validation

**Test Cases:**

1. **Script Output Test:**
   ```bash
   python backend/scripts/generate_secrets.py > test.env
   cat test.env | grep CHANGE_ME
   # Should return no results
   ```

2. **Dotenv Parsing Test:**
   ```bash
   python -c "
   from dotenv import dotenv_values
   config = dotenv_values('test.env')
   assert len(config['SECRET_KEY']) == 64
   assert len(config['POSTGRES_PASSWORD']) == 32
   assert len(config['REDIS_PASSWORD']) == 32
   print('✓ All secrets have correct length')
   "
   ```

3. **Validation Success Test:**
   ```bash
   # Copy generated secrets to .env
   cp test.env .env
   
   # Start backend (should succeed)
   cd backend
   python -c "from app.core.config import settings; print('✓ Validation passed')"
   ```

4. **Validation Failure Test - Short Secret:**
   ```bash
   echo "SECRET_KEY=tooshort" > .env
   echo "POSTGRES_PASSWORD=short" >> .env
   echo "REDIS_PASSWORD=short" >> .env
   echo "DATABASE_URL=postgresql+asyncpg://user:pass@localhost/db" >> .env
   echo "REDIS_URL=redis://localhost:6379" >> .env
   echo "ENVIRONMENT=development" >> .env
   
   cd backend
   python -c "from app.core.config import settings" 2>&1 | grep "must be at least"
   # Should show validation error
   ```

5. **Validation Failure Test - Weak Default:**
   ```bash
   cat > .env << 'TESTEOF'
   SECRET_KEY=CHANGE_ME_RUN_scripts_generate_secrets_py
   POSTGRES_PASSWORD=changeme
   REDIS_PASSWORD=changeme
   DATABASE_URL=postgresql+asyncpg://user:pass@localhost/db
   REDIS_URL=redis://localhost:6379
   ENVIRONMENT=development
   TESTEOF
   
   cd backend
   python -c "from app.core.config import settings" 2>&1 | grep "cannot use default"
   # Should show validation error
   ```

6. **Docker Compose Integration Test:**
   ```bash
   # Generate real secrets
   python backend/scripts/generate_secrets.py > .env
   
   # Test config interpolation
   docker-compose config | grep POSTGRES_PASSWORD
   # Should show interpolated value (not placeholder)
   
   # Start services
   docker-compose up -d
   
   # Wait for health checks
   sleep 10
   
   # Verify healthy
   docker-compose ps | grep healthy
   # Should show both postgres and redis as healthy
   ```

7. **Uniqueness Test:**
   ```bash
   # Generate multiple times and verify uniqueness
   python backend/scripts/generate_secrets.py | grep SECRET_KEY > secret1.txt
   python backend/scripts/generate_secrets.py | grep SECRET_KEY > secret2.txt
   diff secret1.txt secret2.txt
   # Should show differences (secrets are unique)
   ```

**Cleanup:**
```bash
rm -f test.env secret1.txt secret2.txt
```

---

## 🧪 Testing Strategy

### Unit Tests

**File:** `backend/tests/core/test_config_validators.py` (new file)

```python
"""
Unit tests for Settings validators.

Tests validation logic for secret_key, postgres_password, and redis_password
fields to ensure weak defaults are rejected and minimum lengths are enforced.
"""

import pytest
from pydantic import ValidationError
from app.core.config import Settings


def test_secret_key_minimum_length():
    """SECRET_KEY must be at least 32 characters."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            secret_key="short",
            postgres_password="a" * 32,
            redis_password="a" * 32,
            database_url="postgresql+asyncpg://user:pass@localhost/db",
            redis_url="redis://localhost:6379",
        )
    
    assert "must be at least 32 characters" in str(exc_info.value)


def test_secret_key_weak_default():
    """SECRET_KEY cannot use known weak defaults."""
    weak_defaults = [
        "your-secret-key-here-change-in-production",
        "CHANGE_ME_RUN_scripts_generate_secrets_py",
        "changeme",
    ]
    
    for weak_secret in weak_defaults:
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                secret_key=weak_secret,
                postgres_password="a" * 32,
                redis_password="a" * 32,
                database_url="postgresql+asyncpg://user:pass@localhost/db",
                redis_url="redis://localhost:6379",
            )
        
        assert "cannot use default or weak value" in str(exc_info.value)


def test_postgres_password_minimum_length():
    """POSTGRES_PASSWORD must be at least 16 characters."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            secret_key="a" * 32,
            postgres_password="short",
            redis_password="a" * 32,
            database_url="postgresql+asyncpg://user:pass@localhost/db",
            redis_url="redis://localhost:6379",
        )
    
    assert "must be at least 16 characters" in str(exc_info.value)


def test_postgres_password_weak_default():
    """POSTGRES_PASSWORD cannot use known weak defaults."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            secret_key="a" * 32,
            postgres_password="changeme",
            redis_password="a" * 32,
            database_url="postgresql+asyncpg://user:pass@localhost/db",
            redis_url="redis://localhost:6379",
        )
    
    assert "cannot use default or weak value" in str(exc_info.value)


def test_redis_password_minimum_length():
    """REDIS_PASSWORD must be at least 16 characters."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            secret_key="a" * 32,
            postgres_password="a" * 32,
            redis_password="short",
            database_url="postgresql+asyncpg://user:pass@localhost/db",
            redis_url="redis://localhost:6379",
        )
    
    assert "must be at least 16 characters" in str(exc_info.value)


def test_redis_password_weak_default():
    """REDIS_PASSWORD cannot use known weak defaults."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            secret_key="a" * 32,
            postgres_password="a" * 32,
            redis_password="CHANGE_ME_RUN_scripts_generate_secrets_py",
            database_url="postgresql+asyncpg://user:pass@localhost/db",
            redis_url="redis://localhost:6379",
        )
    
    assert "cannot use default or weak value" in str(exc_info.value)


def test_strong_secrets_pass_validation():
    """Strong secrets should pass validation."""
    settings = Settings(
        secret_key="a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6",
        postgres_password="aB3dE6gH9jK2mN5pQ8rT1uV4wX7yZ0",
        redis_password="zA9yX8wV7uT6sR5qP4oN3mL2kJ1iH0",
        database_url="postgresql+asyncpg://user:pass@localhost/db",
        redis_url="redis://localhost:6379",
    )
    
    assert len(settings.secret_key) == 64
    assert len(settings.postgres_password) == 32
    assert len(settings.redis_password) == 32
```

**Run tests:**
```bash
cd backend
pytest tests/core/test_config_validators.py -v
```

---

### Integration Tests

**Manual Testing Procedure:**

1. **Test Secret Generation:**
   ```bash
   python backend/scripts/generate_secrets.py > test_output.env
   cat test_output.env
   # Verify: All placeholders replaced, correct format, comments present
   ```

2. **Test Docker Compose Integration:**
   ```bash
   # Use generated secrets
   python backend/scripts/generate_secrets.py > .env
   
   # Start containers
   docker-compose up -d
   
   # Check health
   docker-compose ps
   # Expected: Both postgres and redis show "healthy" status
   
   # Test PostgreSQL connection with password
   docker exec youtube-bookmarks-db psql -U youtube_user -d youtube_bookmarks -c "SELECT 1"
   # Expected: Connection successful
   
   # Test Redis connection with password
   docker exec youtube-bookmarks-redis redis-cli -a $(grep REDIS_PASSWORD .env | cut -d= -f2) PING
   # Expected: PONG
   ```

3. **Test Backend Validation:**
   ```bash
   # Test with valid secrets (from generate_secrets.py output)
   cd backend
   uvicorn app.main:app --reload
   # Expected: Server starts successfully
   
   # Test with invalid secrets
   echo "SECRET_KEY=weak" > ../.env
   uvicorn app.main:app --reload
   # Expected: ValidationError on startup
   ```

4. **Test .gitignore Protection:**
   ```bash
   echo "test" > .env
   git status
   # Expected: .env NOT listed as untracked file
   
   git add .env 2>&1
   # Expected: Warning or file ignored
   ```

---

### Security Testing

**Entropy Analysis:**

```python
# Test script entropy
import math
from collections import Counter

# Generate 1000 secrets
secrets = []
for _ in range(1000):
    secret = subprocess.check_output(['python', 'backend/scripts/generate_secrets.py']).decode()
    secret_key = [line for line in secret.split('\n') if line.startswith('SECRET_KEY=')][0]
    secrets.append(secret_key.split('=')[1])

# Check for duplicates
assert len(secrets) == len(set(secrets)), "Found duplicate secrets!"

# Check character distribution
all_chars = ''.join(secrets)
char_freq = Counter(all_chars)

# Calculate entropy
total = len(all_chars)
entropy = -sum((count/total) * math.log2(count/total) for count in char_freq.values())

print(f"Entropy: {entropy:.2f} bits per character")
# Expected: ~5.95 bits (log2(62) ≈ 5.95 for uniform distribution)
```

**Validation Bypass Test:**

Try to bypass validators with edge cases:
```python
# Test case-insensitive detection
Settings(secret_key="CHANGEME" * 4)  # Should fail

# Test whitespace padding
Settings(secret_key="weak" + " " * 100)  # Should fail (after strip)

# Test empty string
Settings(secret_key="")  # Should fail
```

---

## 📚 Reference

### Related Documentation

- **Master Plan:** `docs/plans/2025-11-02-security-hardening-implementation.md` - Task 2 (lines 816-1098)
- **Template:** `docs/templates/task-plan-template.md`

### External Resources

**Python Standards:**
- [PEP 506 - Adding secrets module](https://peps.python.org/pep-0506/)
- [Python secrets documentation](https://docs.python.org/3/library/secrets.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

**Dotenv Specifications:**
- [python-dotenv file format](https://github.com/theskumar/python-dotenv#file-format)
- [Docker Compose environment variables](https://docs.docker.com/compose/how-tos/environment-variables/best-practices/)

**Pydantic Documentation:**
- [Pydantic v2 Field Validators](https://docs.pydantic.dev/latest/concepts/validators/#field-validators)
- [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)

**Security Standards:**
- [NIST SP 800-57 Part 1 Rev. 5](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final) - Key Management Recommendations
- [OWASP ASVS v4.0 Section 6.2](https://owasp.org/www-project-application-security-verification-standard/) - Cryptographic Algorithms

### Related Code Patterns

**Similar Implementations:**
- `backend/app/core/config.py` - Existing `validate_secret_key` and `validate_gemini_api_key` validators (lines 42-132)
- Pattern to follow: Use `@field_validator` decorator with `@classmethod`

**Validation Pattern (Pydantic v2):**
```python
@field_validator("field_name")
@classmethod
def validate_field_name(cls, v: str, info) -> str:
    # Access other fields via info.data
    env = info.data.get("env", "development")
    
    # Validation logic
    if len(v) < minimum:
        raise ValueError("Error message with remediation")
    
    # Return validated value
    return v
```

### Design Decisions

#### 1. Alphanumeric-Only Alphabet

**Decision:** Use only `string.ascii_letters + string.digits` (62 characters)

**Rationale:**
- **Problem:** Special characters break .env parsing
  - `=` terminates key-value pairs
  - `#` starts comments
  - `'`, `"` require complex escaping
  - Spaces cause parsing errors
  - `\` requires escape sequences

- **Solution:** Alphanumeric-only alphabet
  - 62^64 = 2^380 bits entropy (exceeds NIST 2^128 recommendation)
  - 100% dotenv compatibility
  - Works across all platforms (no encoding issues)
  - Simpler copy-paste (no escaping needed)

- **Trade-off:** Slightly reduced character space
  - Full ASCII printable: 94 characters
  - Alphanumeric only: 62 characters
  - Entropy reduction: log2(94) - log2(62) = 0.60 bits per character
  - For 64-char secrets: 0.60 * 64 = 38 bits total reduction
  - Still exceeds security requirements by orders of magnitude

**References:**
- [python-dotenv parsing rules](https://github.com/theskumar/python-dotenv#file-format)
- [Docker Compose special character issues](https://docs.docker.com/compose/how-tos/environment-variables/best-practices/)

#### 2. Validation in ALL Environments

**Decision:** Enforce secret validation in development AND production

**Rationale:**
- Prevents accidental deployment with weak secrets
- "Shift-left" security: Catch issues early
- Developers use production-like security practices
- No surprises when deploying to production

**Alternative Rejected:** Only validate in production
- Risk: Weak secrets work in dev, break in prod deployment
- Risk: Developers never test with real secrets
- Risk: Last-minute scramble to fix validation errors

#### 3. Required Fields (No Defaults)

**Decision:** Make `postgres_password` and `redis_password` required fields with no defaults

**Rationale:**
- Forces explicit configuration
- "Secure by default" philosophy
- Prevents accidental use of empty passwords
- Aligns with principle of least privilege

**Alternative Rejected:** Optional fields with empty string defaults
- Risk: Services start without authentication
- Risk: Silent security failures

#### 4. Script Outputs Complete .env File

**Decision:** Script generates complete `.env` file (not just secrets)

**Rationale:**
- Single command setup: `python script.py > .env`
- Reduces human error (no manual copying)
- Ensures correct dotenv format
- Includes helpful comments and warnings

**Alternative Rejected:** Output only secret values
- Requires manual .env construction
- Higher error rate (typos, formatting)
- Poor developer experience

---

## ⚠️ Security Warnings

### Critical Reminders

1. **NEVER commit .env to git:**
   ```bash
   # Check before committing
   git status
   git diff --cached
   
   # Search history for accidents
   git log -p | grep -i "SECRET_KEY\|POSTGRES_PASSWORD"
   ```

2. **Rotate secrets after team changes:**
   - Immediate rotation when developer leaves
   - Rotation after contractor engagement ends
   - Rotation after security incident

3. **Different secrets per environment:**
   - Development secrets ≠ Staging secrets ≠ Production secrets
   - Compromise of dev secrets doesn't affect production

4. **Monitor for exposure:**
   - Use tools like [git-secrets](https://github.com/awslabs/git-secrets)
   - Enable GitHub secret scanning
   - Set up alerts for authentication failures

---

## 📝 Commit Message

After completing all steps:

```bash
git add backend/scripts/generate_secrets.py .env.example docker-compose.yml backend/app/core/config.py docs/deployment/SECRETS_SETUP.md .gitignore

git commit -m "feat(security): implement secure secret generation system

- Add generate_secrets.py script using Python secrets module
- Update .env.example with security placeholders
- Migrate docker-compose.yml to use environment variables
- Add Pydantic validators for secret strength enforcement
- Create comprehensive secrets setup documentation
- Ensure .env patterns in .gitignore

Security improvements:
- Cryptographically secure random generation (CSPRNG)
- Alphanumeric-only alphabet for dotenv compatibility
- Minimum length validation (SECRET_KEY: 32, passwords: 16)
- Weak default detection and rejection
- Environment-agnostic validation (dev + prod)

BREAKING CHANGE: Default passwords no longer work. 
Run: python backend/scripts/generate_secrets.py > .env

Implements Task #116 from Security Hardening Plan
Ref: docs/plans/2025-11-02-security-hardening-implementation.md (Task 2)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Completion Checklist

- [ ] `backend/scripts/generate_secrets.py` created and executable
- [ ] `.env.example` updated with security placeholders
- [ ] `docker-compose.yml` uses environment variables (no hardcoded passwords)
- [ ] `backend/app/core/config.py` has validators for all secrets
- [ ] `docs/deployment/SECRETS_SETUP.md` created with comprehensive guide
- [ ] `.gitignore` includes all .env patterns
- [ ] Unit tests written and passing (test_config_validators.py)
- [ ] Script tested: generates valid secrets
- [ ] Docker Compose tested: services start with generated secrets
- [ ] Validation tested: rejects weak secrets
- [ ] Documentation reviewed: all examples executable
- [ ] Security checklist completed
- [ ] Commit created with breaking change notice
