# Task #123: Create .env.development and .env.production.example

**Plan Task:** #123
**Wave/Phase:** Task 3: Environment-Aware Configuration (P0 - Critical Security)
**Dependencies:** None (can be implemented independently)

---

## 🎯 Ziel

Erstelle zwei separate Environment-Konfigurationsdateien: `.env.development` mit sicheren Defaults für lokale Entwicklung (kann in git committed werden) und `.env.production.example` als Template für Production-Deployments (mit Platzhaltern für Secrets). Beide Dateien müssen alle erforderlichen Variablen aus `config.py` enthalten und mit umfassenden Kommentaren dokumentiert sein, die den Zweck jeder Variable und Sicherheitshinweise erklären.

## 📋 Acceptance Criteria

- [ ] `.env.development` existiert mit allen erforderlichen Variablen und sicheren Defaults für lokale Entwicklung
- [ ] `.env.development` kann sicher in git committed werden (keine sensiblen Production-Secrets)
- [ ] `.env.production.example` existiert mit allen erforderlichen Variablen und `CHANGE_ME` Platzhaltern
- [ ] Beide Dateien haben inline Kommentare für jede Variable mit Erklärung und Beispielen
- [ ] Security Checklist dokumentiert, welche Variablen zwingend geändert werden müssen
- [ ] Migration Guide dokumentiert, wie zwischen Environments gewechselt wird
- [ ] `.gitignore` patterns erlauben `.env.development` aber blockieren `.env.production`
- [ ] Alle Variablen aus `backend/app/core/config.py` sind abgedeckt
- [ ] Docker Compose Variablen sind konsistent mit .env Files
- [ ] Manual Testing durchgeführt (Syntax, Laden via Pydantic)

---

## 🛠️ Implementation Steps

### 1. Update `.gitignore` für selektive .env Files

**Files:** `.gitignore`

**Action:** Stelle sicher, dass `.env.development` committed werden kann, aber `.env.production` ignoriert wird.

**Current .gitignore entries:**
```
.env
.env.local
```

**Update to:**
```
# Environment files
.env                      # Legacy/generic env file (keep ignoring)
.env.local                # Local overrides (keep ignoring)
.env.production           # Production secrets (NEVER commit)
.env.production.local     # Production local overrides (NEVER commit)

# Development environment can be committed (safe defaults only)
# .env.development
```

**Rationale:**
- `.env.development` wird ausdrücklich NICHT ignoriert (kommentiert), damit es committed werden kann
- `.env.production` und Varianten werden weiterhin ignoriert für Production-Secrets
- Legacy `.env` bleibt ignoriert für backward compatibility

---

### 2. Create `.env.development` mit sicheren Defaults

**Files:** `backend/.env.development`

**Action:** Erstelle vollständige Development-Konfiguration mit allen Variablen aus `config.py`. Diese Datei KANN in git committed werden, da sie nur schwache Secrets für lokale Entwicklung enthält.

**Complete file contents:**

```bash
# ============================================================================
# Smart YouTube Bookmarks - Development Environment Configuration
# ============================================================================
# This file contains safe defaults for LOCAL DEVELOPMENT ONLY.
# It can be committed to git because it uses weak/placeholder secrets.
# For production deployment, use .env.production (NOT in git).
# ============================================================================

# ----------------------------------------------------------------------------
# Environment Configuration
# ----------------------------------------------------------------------------

# ENVIRONMENT: Current environment (development, staging, production)
# - Controls validation strictness, debug mode, CORS policies
# - MUST be "development" for this file
ENVIRONMENT=development

# DEBUG: Enable debug mode
# - Shows detailed error traces in API responses
# - Enables Swagger UI at /docs (disabled in production)
# - WARNING: Never enable in production (security risk)
DEBUG=true

# ----------------------------------------------------------------------------
# Security & Authentication (JWT)
# ----------------------------------------------------------------------------

# SECRET_KEY: JWT signing key
# - Used to sign and verify JWT tokens
# - Development: Weak key is OK (only for local testing)
# - Production: MUST be cryptographically secure (min 32 chars)
# - Generate production key: python scripts/generate_secrets.py
SECRET_KEY=dev-secret-key-only-for-local-development-change-for-other-envs

# ALGORITHM: JWT signing algorithm
# - HS256 recommended for symmetric key signing
# - Do not change unless you understand JWT security implications
ALGORITHM=HS256

# ACCESS_TOKEN_EXPIRE_MINUTES: JWT token expiration time
# - Development: 480 minutes (8 hours) for convenience
# - Production: 30 minutes for security
# - Users must re-authenticate after this period
ACCESS_TOKEN_EXPIRE_MINUTES=480

# ----------------------------------------------------------------------------
# Database Configuration (PostgreSQL)
# ----------------------------------------------------------------------------

# POSTGRES_DB: Database name
# - Name of the PostgreSQL database
# - Should match docker-compose.yml
POSTGRES_DB=youtube_bookmarks

# POSTGRES_USER: Database username
# - PostgreSQL user for application connections
# - Development: Simple username is OK
# - Production: Use unique, non-default username
POSTGRES_USER=youtube_user

# POSTGRES_PASSWORD: Database password
# - PostgreSQL password for application connections
# - Development: Weak password is OK (local Docker only)
# - Production: MUST use strong password (min 20 chars)
POSTGRES_PASSWORD=devpassword

# DATABASE_URL: Complete database connection string
# - Format: postgresql+asyncpg://user:password@host:port/database
# - Development: localhost connection (Docker port-forwarded)
# - Production: Use internal Docker network (host=db, not localhost)
# - asyncpg driver required for SQLAlchemy async support
DATABASE_URL=postgresql+asyncpg://youtube_user:devpassword@localhost:5432/youtube_bookmarks

# DB_POOL_SIZE: Database connection pool size
# - Number of persistent connections to maintain
# - Should match ARQ max_jobs setting (10)
# - Increase for high-traffic production deployments
DB_POOL_SIZE=10

# DB_MAX_OVERFLOW: Additional connections beyond pool size
# - Max temporary connections when pool is exhausted
# - Total max connections = pool_size + max_overflow (15)
DB_MAX_OVERFLOW=5

# DB_POOL_PRE_PING: Test connections before use
# - Prevents "connection has been closed" errors
# - Small performance overhead, but recommended
DB_POOL_PRE_PING=true

# ----------------------------------------------------------------------------
# Redis Configuration (Caching & Pub/Sub)
# ----------------------------------------------------------------------------

# REDIS_URL: Redis connection string
# - Format: redis://host:port/db
# - Used for WebSocket pub/sub and job queuing
# - Development: localhost connection (Docker port-forwarded)
# - Production: Use internal Docker network (host=redis, not localhost)
REDIS_URL=redis://localhost:6379/0

# REDIS_PASSWORD: Redis authentication password
# - Development: Empty (Redis without password)
# - Production: MUST set password for security
# - Configure in redis.conf: requirepass <password>
REDIS_PASSWORD=

# ----------------------------------------------------------------------------
# CORS Configuration
# ----------------------------------------------------------------------------

# ALLOWED_ORIGINS: Comma-separated list of allowed origins
# - Controls which domains can make API requests
# - Development: Empty string auto-allows localhost:5173, localhost:8000
# - Production: MUST explicitly list all allowed domains
# - Example: https://yourdomain.com,https://app.yourdomain.com
# - WARNING: Never use "*" in production (security risk)
ALLOWED_ORIGINS=

# ----------------------------------------------------------------------------
# External API Keys
# ----------------------------------------------------------------------------

# YOUTUBE_API_KEY: YouTube Data API v3 key
# - Required for fetching video metadata (title, description, duration)
# - Get key from: https://console.cloud.google.com/apis/credentials
# - Free tier: 10,000 quota units/day (100 video metadata requests)
# - Optional in development (video processing will fail without it)
# - Replace with your actual key for testing video uploads
YOUTUBE_API_KEY=

# GEMINI_API_KEY: Google Gemini API key
# - Required for AI-powered transcript analysis and custom field extraction
# - Get key from: https://makersuite.google.com/app/apikey
# - Optional in development (AI features will be disabled without it)
# - Production: MUST set if using AI features
GEMINI_API_KEY=

# ----------------------------------------------------------------------------
# Environment Variable Loading
# ----------------------------------------------------------------------------
# These variables are loaded by Pydantic Settings in backend/app/core/config.py
# Case-insensitive: POSTGRES_DB = postgres_db = PoStGrEs_dB
# Type conversion: "480" string → 480 int, "true" → True bool
# Validation: Pydantic validates types and constraints on startup
# ----------------------------------------------------------------------------
```

**Key Design Decisions:**
- **Detailed comments:** Jede Variable hat einen Kommentar-Block mit Zweck, Development vs Production Unterschieden, Beispielen
- **Weak secrets are OK:** `SECRET_KEY` und `POSTGRES_PASSWORD` sind schwach, da nur für lokale Entwicklung
- **Convenience over security:** Lange Token-Expiration (8h) für bequemeres lokales Testing
- **Empty API keys:** Optional, Entwickler können eigene Keys eintragen wenn sie Features testen wollen
- **Localhost connections:** Database und Redis verwenden localhost (nicht Docker-interne Namen)

---

### 3. Create `.env.production.example` als Template

**Files:** `backend/.env.production.example`

**Action:** Erstelle Production-Template mit `CHANGE_ME` Platzhaltern für alle Secrets. Diese Datei wird committed und dient als Vorlage für Deployments.

**Complete file contents:**

```bash
# ============================================================================
# Smart YouTube Bookmarks - Production Environment Configuration (TEMPLATE)
# ============================================================================
# This is a TEMPLATE file for production deployments.
# Copy this file to .env.production and replace all CHANGE_ME placeholders.
# NEVER commit .env.production to git (contains real secrets).
# ============================================================================
#
# SETUP INSTRUCTIONS:
# 1. Copy this file: cp .env.production.example .env.production
# 2. Generate secrets: python scripts/generate_secrets.py
# 3. Replace all CHANGE_ME placeholders with actual values
# 4. Verify configuration: pytest tests/core/test_config.py
# 5. NEVER commit .env.production to git
#
# ============================================================================

# ----------------------------------------------------------------------------
# Environment Configuration
# ----------------------------------------------------------------------------

# ENVIRONMENT: Current environment (development, staging, production)
# - MUST be "production" for production deployments
# - Enables strict validation, disables debug mode, enforces CORS
# - CRITICAL: Do not set to "development" in production
ENVIRONMENT=production

# DEBUG: Enable debug mode
# - MUST be false in production (security requirement)
# - Setting to true exposes internal errors and enables /docs
# - SECURITY RISK: Never enable debug in production
DEBUG=false

# ----------------------------------------------------------------------------
# Security & Authentication (JWT)
# ----------------------------------------------------------------------------

# SECRET_KEY: JWT signing key
# - MUST be changed! Used to sign and verify JWT tokens
# - CRITICAL: If compromised, attackers can forge authentication tokens
# - Requirements: Minimum 32 characters, cryptographically random
# - Generate: python scripts/generate_secrets.py
# - NEVER use development key in production
SECRET_KEY=CHANGE_ME_RUN_scripts_generate_secrets_py

# ALGORITHM: JWT signing algorithm
# - HS256 recommended for symmetric key signing
# - Do not change unless you understand JWT security implications
ALGORITHM=HS256

# ACCESS_TOKEN_EXPIRE_MINUTES: JWT token expiration time
# - Production: 30 minutes for security (users re-auth every 30min)
# - Shorter = more secure, but less convenient
# - Longer = less secure, but more convenient
# - 30 minutes is industry standard for web applications
ACCESS_TOKEN_EXPIRE_MINUTES=30

# ----------------------------------------------------------------------------
# Database Configuration (PostgreSQL)
# ----------------------------------------------------------------------------

# POSTGRES_DB: Database name
# - Name of the PostgreSQL database
# - Should match docker-compose.yml
# - Can keep default or customize per environment
POSTGRES_DB=youtube_bookmarks

# POSTGRES_USER: Database username
# - PostgreSQL user for application connections
# - RECOMMENDED: Change from default "user" for security
# - Use environment-specific username (e.g., "ytbm_prod_user")
POSTGRES_USER=CHANGE_ME_to_unique_username

# POSTGRES_PASSWORD: Database password
# - MUST be changed! PostgreSQL password for application connections
# - CRITICAL: Default passwords are severe security vulnerability
# - Requirements: Minimum 20 characters, mix of upper/lower/digits/symbols
# - Generate: python scripts/generate_secrets.py
# - NEVER use development password in production
POSTGRES_PASSWORD=CHANGE_ME_RUN_scripts_generate_secrets_py

# DATABASE_URL: Complete database connection string
# - Format: postgresql+asyncpg://user:password@host:port/database
# - IMPORTANT: Use Docker-internal hostname "db" (not localhost)
# - Uses ${POSTGRES_PASSWORD} variable substitution
# - asyncpg driver required for SQLAlchemy async support
DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}

# DB_POOL_SIZE: Database connection pool size
# - Number of persistent connections to maintain
# - Should match ARQ max_jobs setting (10)
# - Increase for high-traffic deployments (e.g., 20 for 1000+ req/min)
# - Monitor: Adjust based on actual concurrent request volume
DB_POOL_SIZE=10

# DB_MAX_OVERFLOW: Additional connections beyond pool size
# - Max temporary connections when pool is exhausted
# - Total max connections = pool_size + max_overflow (15)
# - PostgreSQL default max_connections = 100
DB_MAX_OVERFLOW=5

# DB_POOL_PRE_PING: Test connections before use
# - Prevents "connection has been closed" errors
# - RECOMMENDED: Always true in production
# - Small performance overhead (~1ms per query)
DB_POOL_PRE_PING=true

# ----------------------------------------------------------------------------
# Redis Configuration (Caching & Pub/Sub)
# ----------------------------------------------------------------------------

# REDIS_URL: Redis connection string
# - Format: redis://host:port/db
# - IMPORTANT: Use Docker-internal hostname "redis" (not localhost)
# - Uses database 0 (default)
# - For authenticated Redis, use: redis://:password@redis:6379/0
REDIS_URL=redis://redis:6379/0

# REDIS_PASSWORD: Redis authentication password
# - MUST be changed! Redis authentication password
# - CRITICAL: Unprotected Redis can be exploited for remote code execution
# - Requirements: Minimum 20 characters, cryptographically random
# - Generate: python scripts/generate_secrets.py
# - Configure in redis.conf: requirepass <password>
# - If using password, update REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
REDIS_PASSWORD=CHANGE_ME_RUN_scripts_generate_secrets_py

# ----------------------------------------------------------------------------
# CORS Configuration
# ----------------------------------------------------------------------------

# ALLOWED_ORIGINS: Comma-separated list of allowed origins
# - MUST be changed! Controls which domains can make API requests
# - CRITICAL: Empty value or "*" allows any domain (severe security risk)
# - Format: https://domain1.com,https://domain2.com (no spaces, no trailing slash)
# - Include all frontend domains (main site, admin panel, mobile app)
# - Example: https://yourdomain.com,https://app.yourdomain.com
# - SECURITY: Never use "*", always list specific domains
# - Protocol matters: https://example.com ≠ http://example.com
ALLOWED_ORIGINS=CHANGE_ME_to_your_actual_domains

# ----------------------------------------------------------------------------
# External API Keys
# ----------------------------------------------------------------------------

# YOUTUBE_API_KEY: YouTube Data API v3 key
# - MUST be set! Required for fetching video metadata
# - Get key from: https://console.cloud.google.com/apis/credentials
# - Free tier: 10,000 quota units/day (100 video metadata requests)
# - Production: Consider paid tier for higher quota
# - Monitor usage: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
YOUTUBE_API_KEY=CHANGE_ME_to_your_youtube_api_key

# GEMINI_API_KEY: Google Gemini API key
# - MUST be set! Required for AI-powered transcript analysis
# - Get key from: https://makersuite.google.com/app/apikey
# - Production: Monitor usage and set up billing alerts
# - Free tier: Limited requests per minute
# - SECURITY: Rotate keys regularly, restrict API key usage to your IPs
GEMINI_API_KEY=CHANGE_ME_to_your_gemini_api_key

# ----------------------------------------------------------------------------
# Production Checklist (BEFORE DEPLOYING)
# ----------------------------------------------------------------------------
# [ ] SECRET_KEY: Changed to 32+ char random string (NOT default)
# [ ] POSTGRES_PASSWORD: Changed to 20+ char strong password (NOT default)
# [ ] POSTGRES_USER: Changed from default "user" to unique username
# [ ] REDIS_PASSWORD: Changed to 20+ char strong password (NOT empty)
# [ ] ALLOWED_ORIGINS: Set to actual frontend domains (NOT empty, NOT "*")
# [ ] YOUTUBE_API_KEY: Set to actual YouTube API key
# [ ] GEMINI_API_KEY: Set to actual Gemini API key
# [ ] ENVIRONMENT: Set to "production" (NOT "development")
# [ ] DEBUG: Set to false (NOT true)
# [ ] DATABASE_URL: Uses Docker-internal hostname "db" (NOT localhost)
# [ ] REDIS_URL: Uses Docker-internal hostname "redis" (NOT localhost)
# [ ] File permissions: chmod 600 .env.production (only owner can read)
# [ ] Git verification: .env.production in .gitignore (NOT committed)
# [ ] Config validation: pytest tests/core/test_config.py passes
# ----------------------------------------------------------------------------
```

**Key Design Decisions:**
- **Explicit CHANGE_ME placeholders:** Macht es unmöglich, versehentlich mit unsicheren Defaults zu deployen
- **Security-first comments:** Jede Variable hat CRITICAL/MUST/RECOMMENDED Marker für Priorität
- **Production checklist:** Built-in Checkliste am Ende der Datei
- **Docker-internal hostnames:** `db` und `redis` statt localhost für Production
- **Variable substitution:** `${POSTGRES_PASSWORD}` in DATABASE_URL für DRY principle
- **Strict requirements:** Klare Längen-Requirements für Passwörter (20+ chars)

---

### 4. Create Security Checklist Document

**Files:** `docs/security-checklist-env-production.md`

**Action:** Erstelle separates Markdown-Dokument mit detaillierter Security-Checkliste für Production-Deployment.

```markdown
# Production Environment Security Checklist

**Purpose:** Verify `.env.production` is configured securely before deployment.

**Usage:** Check all items before deploying to staging/production.

---

## Critical Security Variables (P0 - Must Change)

### SECRET_KEY
- [ ] Changed from default/example value
- [ ] Minimum 32 characters long
- [ ] Generated using cryptographically secure random generator
- [ ] Different from development/staging keys
- [ ] Never logged or exposed in error messages
- [ ] Rotated every 90 days (security policy)

**How to generate:**
```bash
python scripts/generate_secrets.py
# OR
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**How to verify:**
```bash
# Check length
echo $SECRET_KEY | wc -c  # Should be 32+

# Check it's not default
grep "your-secret-key-here" .env.production  # Should return nothing
```

---

### POSTGRES_PASSWORD
- [ ] Changed from default/example value
- [ ] Minimum 20 characters long
- [ ] Mix of uppercase, lowercase, digits, symbols
- [ ] Different from development/staging passwords
- [ ] Not based on dictionary words or common patterns
- [ ] Stored securely (encrypted secrets manager in production)

**How to generate:**
```bash
python scripts/generate_secrets.py
# OR
python -c "import secrets; print(secrets.token_urlsafe(20))"
```

**How to verify:**
```bash
# Check it's not default
grep "changeme\|devpassword\|CHANGE_ME" .env.production  # Should return nothing
```

---

### REDIS_PASSWORD
- [ ] Changed from default/example value (not empty)
- [ ] Minimum 20 characters long
- [ ] Generated using cryptographically secure random generator
- [ ] Different from development/staging passwords
- [ ] Configured in Redis server (requirepass directive)

**How to configure Redis:**
1. Edit redis.conf: `requirepass YOUR_PASSWORD_HERE`
2. Update REDIS_URL: `redis://:${REDIS_PASSWORD}@redis:6379/0`
3. Restart Redis container

**How to verify:**
```bash
# Check Redis requires auth
redis-cli -h localhost -p 6379 PING  # Should return "(error) NOAUTH Authentication required"
```

---

### ALLOWED_ORIGINS
- [ ] Changed from default/example value
- [ ] NOT empty string (would allow all origins in some configs)
- [ ] NOT "*" wildcard (allows any domain - security risk)
- [ ] Lists all legitimate frontend domains
- [ ] Uses HTTPS protocol (not HTTP)
- [ ] No trailing slashes
- [ ] Verified with CORS testing tools

**Format:**
```
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**How to verify:**
```bash
# Check it's not wildcard or empty
grep "ALLOWED_ORIGINS=\*\|ALLOWED_ORIGINS=$" .env.production  # Should return nothing

# Test CORS with curl
curl -H "Origin: https://yourdomain.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS http://your-api.com/api/lists
# Should return "Access-Control-Allow-Origin: https://yourdomain.com"
```

---

## Required API Keys (P0 - Must Set)

### YOUTUBE_API_KEY
- [ ] Set to actual YouTube Data API v3 key
- [ ] Key is valid and not expired
- [ ] Quota limits are appropriate for production load
- [ ] Usage monitoring is enabled
- [ ] Billing alerts configured (if paid tier)
- [ ] API key restrictions configured (IP/referrer limits)

**How to verify:**
```bash
# Test API key with YouTube API
curl "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=$YOUTUBE_API_KEY"
# Should return video metadata, not error
```

---

### GEMINI_API_KEY
- [ ] Set to actual Gemini API key
- [ ] Key is valid and not expired
- [ ] Usage limits are appropriate for production load
- [ ] Billing alerts configured
- [ ] API key restrictions configured (IP limits)

**How to verify:**
```bash
# Test with simple Gemini API request (consult Gemini docs for exact endpoint)
# Should not return authentication error
```

---

## Environment Configuration (P0 - Must Verify)

### ENVIRONMENT
- [ ] Set to "production" (not "development" or "staging")
- [ ] Application behavior matches environment (debug off, strict validation)

**How to verify:**
```bash
grep "ENVIRONMENT=production" .env.production  # Should match exactly
```

---

### DEBUG
- [ ] Set to "false" (not "true")
- [ ] Swagger UI disabled at /docs
- [ ] Error messages don't expose stack traces

**How to verify:**
```bash
grep "DEBUG=false" .env.production  # Should match exactly

# Test API error response doesn't include traceback
curl http://your-api.com/api/invalid-endpoint
# Should return generic error, NOT Python traceback
```

---

## Database Configuration (P1 - Recommended)

### POSTGRES_USER
- [ ] Changed from default "user" to unique username
- [ ] Follows naming convention (e.g., "ytbm_prod_user")
- [ ] Different from development/staging users

---

### DATABASE_URL
- [ ] Uses Docker-internal hostname "db" (not "localhost")
- [ ] Password matches POSTGRES_PASSWORD variable
- [ ] Database name matches POSTGRES_DB
- [ ] Uses asyncpg driver (postgresql+asyncpg://)

**How to verify:**
```bash
# Check format
echo $DATABASE_URL
# Should be: postgresql+asyncpg://USER:PASSWORD@db:5432/DATABASE

# Test connection
python -c "from app.core.config import settings; print(settings.database_url)"
```

---

### REDIS_URL
- [ ] Uses Docker-internal hostname "redis" (not "localhost")
- [ ] Includes password if REDIS_PASSWORD is set
- [ ] Database number is correct (default: 0)

**How to verify:**
```bash
# If password is set, should be: redis://:PASSWORD@redis:6379/0
# If no password, should be: redis://redis:6379/0
echo $REDIS_URL
```

---

## File Security (P0 - Critical)

### File Permissions
- [ ] `.env.production` has restricted permissions (600 or 400)
- [ ] Only owner can read the file
- [ ] File is NOT world-readable

**How to set:**
```bash
chmod 600 .env.production
```

**How to verify:**
```bash
ls -l .env.production
# Should show: -rw------- (600) or -r-------- (400)
```

---

### Git Security
- [ ] `.env.production` is in `.gitignore`
- [ ] `.env.production` is NOT in git history
- [ ] No secrets committed to repository

**How to verify:**
```bash
# Check .gitignore
grep ".env.production" .gitignore  # Should be present

# Check git status
git status | grep ".env.production"  # Should return nothing

# Check git history (nuclear option)
git log --all --full-history --source --pretty=format:"" -- .env.production
# Should return nothing
```

---

## Validation Tests (P0 - Must Pass)

### Configuration Validation
- [ ] Pydantic settings load without errors
- [ ] All required variables are set
- [ ] Type conversions succeed
- [ ] Validators pass (SECRET_KEY length, GEMINI_API_KEY presence, etc.)

**How to verify:**
```bash
cd backend
pytest tests/core/test_config.py -v
# All tests should PASS
```

---

### Application Startup
- [ ] FastAPI starts without errors
- [ ] Database connection succeeds
- [ ] Redis connection succeeds
- [ ] Health check endpoint returns 200 OK

**How to verify:**
```bash
# Start application
uvicorn app.main:app --env-file .env.production

# Test health check
curl http://localhost:8000/api/health
# Should return: {"status": "healthy", "database": "connected", "redis": "connected"}
```

---

## Post-Deployment Monitoring

### Security Monitoring
- [ ] Set up alerts for failed authentication attempts
- [ ] Monitor API key usage and quota
- [ ] Log access to sensitive endpoints
- [ ] Regular security scans (OWASP ZAP, etc.)

### Secret Rotation Schedule
- [ ] SECRET_KEY: Rotate every 90 days
- [ ] POSTGRES_PASSWORD: Rotate every 180 days
- [ ] REDIS_PASSWORD: Rotate every 180 days
- [ ] API keys: Rotate annually or when compromised

---

## Rollback Plan

If deployment fails:
1. Revert to previous .env.production (keep backups)
2. Check application logs for config-related errors
3. Verify environment variable loading: `python -c "from app.core.config import settings; print(settings)"`
4. Test each variable individually
5. Restore from backup if corruption suspected

**Backup command:**
```bash
cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)
```

---

## Sign-Off

**Deployment Date:** _______________

**Reviewed By:** _______________

**Checklist Completed:** [ ] YES [ ] NO

**Notes:**
_______________________________________________
_______________________________________________

---

**CRITICAL REMINDER:** If any checklist item is unchecked, DO NOT DEPLOY to production. Security vulnerabilities can lead to data breaches, unauthorized access, and system compromise.
```

---

### 5. Create Migration Guide Document

**Files:** `docs/environment-migration-guide.md`

**Action:** Erstelle Anleitung für Entwickler, wie zwischen Environments gewechselt wird.

```markdown
# Environment Migration Guide

**Purpose:** Guide for switching between development and production configurations.

---

## Quick Start

### Development Setup (First Time)
```bash
cd backend

# Option 1: Use committed .env.development (recommended)
cp .env.development .env

# Option 2: Already have custom .env? Keep it (make sure it has all variables)

# Start services
docker-compose up -d postgres redis

# Start backend
uvicorn app.main:app --reload
```

---

### Production Setup (First Time)
```bash
cd backend

# 1. Copy production template
cp .env.production.example .env.production

# 2. Generate secrets
python scripts/generate_secrets.py

# 3. Edit .env.production and replace CHANGE_ME placeholders
nano .env.production  # or vim, code, etc.

# 4. Verify configuration
pytest tests/core/test_config.py -v

# 5. Set file permissions
chmod 600 .env.production

# 6. CRITICAL: Verify .env.production is NOT in git
git status | grep .env.production  # Should return nothing
```

---

## Switching Between Environments

### Method 1: Symlink .env (Recommended)

**Setup:**
```bash
cd backend

# Switch to development
ln -sf .env.development .env

# Switch to production
ln -sf .env.production .env

# Check current environment
readlink .env  # Shows which file .env points to
```

**Pros:**
- Fast switching (single command)
- Clear which environment is active
- Hard to accidentally commit wrong config

**Cons:**
- Symlinks can be confusing for some developers
- Doesn't work well on Windows (requires admin privileges)

---

### Method 2: Copy Files

**Setup:**
```bash
cd backend

# Switch to development
cp .env.development .env

# Switch to production
cp .env.production .env

# Check current environment
grep "ENVIRONMENT=" .env
```

**Pros:**
- Simple, works on all operating systems
- No symlink knowledge needed

**Cons:**
- Slower (copy operation)
- Risk of overwriting local changes
- No clear indicator of active environment

---

### Method 3: Environment-Specific .env.local (Advanced)

**Setup:**
```bash
cd backend

# Keep .env.development as default committed file
# Create local override (git-ignored)
cp .env.production.example .env.local

# Edit .env.local with your specific settings
nano .env.local

# Pydantic will load .env.development first, then .env.local overrides
```

**Update `backend/app/core/config.py`:**
```python
model_config = SettingsConfigDict(
    env_file=[".env.development", ".env.local"],  # Load in order
    env_file_encoding="utf-8"
)
```

**Pros:**
- Keep development defaults, override only what's needed
- Each developer can have custom .env.local
- No risk of committing production secrets

**Cons:**
- More complex mental model
- Harder to debug (which file sets which variable?)
- Requires code change in config.py

---

## Environment Variable Precedence

Pydantic loads settings in this order (last one wins):

1. Default values in `Settings` class
2. `.env` file (or `.env.development` if using symlink)
3. Environment variables (OS-level)
4. Explicit overrides in code

**Example:**
```bash
# .env file has: SECRET_KEY=dev-key
# Terminal: export SECRET_KEY=override-key

# Result: Application uses "override-key" (env var wins)
```

**Tip:** Use OS environment variables for temporary overrides without editing files.

---

## Docker Compose Integration

### Development (docker-compose.yml)
```yaml
services:
  backend:
    env_file:
      - .env.development  # Explicitly load development config
    # OR use .env symlink
```

### Production (docker-compose.prod.yml)
```yaml
services:
  backend:
    env_file:
      - .env.production  # Load production config
    environment:
      # Override specific variables if needed
      - ENVIRONMENT=production
```

**Run production compose:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## Verification Commands

### Check Current Environment
```bash
# Method 1: Read .env file
grep "ENVIRONMENT=" backend/.env

# Method 2: Python check
python -c "from app.core.config import settings; print(f'Environment: {settings.env}')"

# Method 3: API endpoint (requires running server)
curl http://localhost:8000/api/health | jq '.environment'
```

---

### Verify All Variables Loaded
```bash
cd backend

# Print all settings (CAUTION: Exposes secrets in terminal!)
python -c "from app.core.config import settings; print(settings.model_dump())"

# Check specific variable
python -c "from app.core.config import settings; print(settings.database_url)"
```

---

### Test Configuration
```bash
cd backend

# Run config validation tests
pytest tests/core/test_config.py -v

# Test database connection
python -c "
from app.core.database import engine
from sqlalchemy import text
import asyncio

async def test_db():
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT 1'))
        print('Database connected!' if result else 'Database connection failed')

asyncio.run(test_db())
"

# Test Redis connection
python -c "
from app.core.redis import get_redis_client
import asyncio

async def test_redis():
    redis = await get_redis_client()
    await redis.ping()
    print('Redis connected!')

asyncio.run(test_redis())
"
```

---

## Common Issues & Troubleshooting

### Issue: "SECRET_KEY validation error"
**Cause:** Production environment with default/short secret key

**Solution:**
```bash
# Regenerate secret
python scripts/generate_secrets.py

# Verify SECRET_KEY length
python -c "from app.core.config import settings; print(len(settings.secret_key))"
# Should be 32+
```

---

### Issue: "Database connection refused"
**Cause:** DATABASE_URL uses wrong hostname for environment

**Solution:**
```bash
# Development: Should use "localhost"
grep "DATABASE_URL=.*localhost" .env.development

# Production: Should use "db" (Docker internal)
grep "DATABASE_URL=.*@db:" .env.production
```

---

### Issue: "CORS error in browser console"
**Cause:** ALLOWED_ORIGINS doesn't include frontend domain

**Solution:**
```bash
# Development: Can be empty (auto-allows localhost)
grep "ALLOWED_ORIGINS=$" .env.development

# Production: Must list all domains
grep "ALLOWED_ORIGINS=https://" .env.production
```

---

### Issue: ".env.production accidentally committed to git"
**Cause:** File not in .gitignore or added with `git add -f`

**Solution:**
```bash
# Remove from staging
git reset HEAD .env.production

# Remove from history (if already committed)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env.production" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DANGEROUS - coordinate with team)
git push origin --force --all

# Rotate all secrets immediately (assume compromised)
python scripts/generate_secrets.py
```

---

## Best Practices

### For Development:
- ✅ Use `.env.development` committed to repo
- ✅ Keep secrets weak (it's OK, local only)
- ✅ Create `.env.local` for personal overrides
- ❌ Don't commit `.env` with production secrets
- ❌ Don't use production API keys in development

### For Production:
- ✅ Copy `.env.production.example` to `.env.production`
- ✅ Generate strong secrets with `scripts/generate_secrets.py`
- ✅ Set file permissions: `chmod 600 .env.production`
- ✅ Verify `.env.production` is in `.gitignore`
- ✅ Use environment-specific Docker Compose files
- ❌ Never commit `.env.production` to git
- ❌ Never use development secrets in production
- ❌ Never set DEBUG=true in production

### For CI/CD:
- ✅ Store production secrets in CI/CD secrets manager (GitHub Secrets, GitLab CI/CD Variables, etc.)
- ✅ Inject secrets as environment variables at deploy time
- ✅ Never store secrets in CI/CD config files
- ✅ Rotate secrets after any suspected compromise

---

## Environment Comparison Table

| Variable | Development | Production |
|----------|-------------|------------|
| `ENVIRONMENT` | `development` | `production` |
| `DEBUG` | `true` | `false` |
| `SECRET_KEY` | Weak (OK) | Strong (32+ chars) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` (8h) | `30` (30min) |
| `POSTGRES_PASSWORD` | `devpassword` | Strong (20+ chars) |
| `DATABASE_URL` | `localhost:5432` | `db:5432` (Docker) |
| `REDIS_URL` | `localhost:6379` | `redis:6379` (Docker) |
| `REDIS_PASSWORD` | Empty | Strong (20+ chars) |
| `ALLOWED_ORIGINS` | Empty (auto-localhost) | Explicit domains |
| `YOUTUBE_API_KEY` | Optional | Required |
| `GEMINI_API_KEY` | Optional | Required |

---

## Security Reminders

1. **Never commit `.env.production`** - Use `.env.production.example` as template
2. **Rotate secrets regularly** - Every 90 days for JWT, 180 days for database
3. **Use different secrets per environment** - Never reuse production secrets in staging/dev
4. **Restrict file permissions** - `chmod 600` for all .env files containing secrets
5. **Monitor access logs** - Alert on suspicious authentication patterns
6. **Have a rollback plan** - Keep backups of working `.env.production` files

---

**For questions or issues, consult:**
- Security Checklist: `docs/security-checklist-env-production.md`
- Config Module: `backend/app/core/config.py`
- Security Hardening Plan: `docs/plans/2025-11-02-security-hardening-implementation.md`
```

---

### 6. Update Documentation References

**Files:** `CLAUDE.md`

**Action:** Ergänze Abschnitt über Environment Configuration.

**Add after "## Security Notes" section:**

```markdown
## Environment Configuration

**Files:**
- `backend/.env.development` - Development config (committed to git)
- `backend/.env.production.example` - Production template (committed to git)
- `backend/.env.production` - Actual production config (git-ignored, created from template)

**Development:**
```bash
# Use committed development config
cp backend/.env.development backend/.env

# Or create symlink for easy switching
ln -sf .env.development .env
```

**Production:**
```bash
# Create production config from template
cp backend/.env.production.example backend/.env.production

# Generate secrets
python backend/scripts/generate_secrets.py

# Edit and replace CHANGE_ME placeholders
nano backend/.env.production

# Verify configuration
pytest backend/tests/core/test_config.py -v
```

**Switching Environments:**
See `docs/environment-migration-guide.md` for detailed instructions.

**Security Checklist:**
Before production deployment, complete all items in `docs/security-checklist-env-production.md`.
```

---

## 🧪 Testing Strategy

**Manual Testing:**

### 1. Verify .gitignore Patterns
```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks

# Test .env.development is NOT ignored (can be committed)
git check-ignore backend/.env.development
# Expected: No output (file is tracked)

# Test .env.production IS ignored
git check-ignore backend/.env.production
# Expected: backend/.env.production (file is ignored)

# Test .env is still ignored (legacy)
git check-ignore backend/.env
# Expected: backend/.env (file is ignored)
```

### 2. Verify .env.development Loads Successfully
```bash
cd backend

# Copy to .env for testing
cp .env.development .env

# Test Pydantic can load all variables
python -c "
from app.core.config import settings
print(f'Environment: {settings.env}')
print(f'Database URL: {settings.database_url}')
print(f'Secret Key Length: {len(settings.secret_key)}')
print(f'Debug Mode: {settings.debug if hasattr(settings, \"debug\") else \"N/A\"}')
print('✅ All settings loaded successfully')
"
# Expected: No errors, prints all values

# Test development-specific validation passes
pytest tests/core/test_config.py -v -k development
# Expected: PASS (if test exists, otherwise skip)
```

### 3. Verify .env.production.example Syntax
```bash
cd backend

# Copy template to test location
cp .env.production.example .env.test

# Test syntax is valid (no parsing errors)
python -c "
import os
from dotenv import dotenv_values
values = dotenv_values('.env.test')
print(f'Loaded {len(values)} variables')
for key in values:
    print(f'  - {key}')
print('✅ Syntax is valid')
"
# Expected: Lists all variables without errors

# Clean up
rm .env.test
```

### 4. Test Variable Completeness
```bash
cd backend

# Extract all variables from config.py
python -c "
from app.core.config import Settings
import inspect

# Get all fields from Settings class
fields = Settings.model_fields.keys()
print('Required variables from config.py:')
for field in sorted(fields):
    print(f'  - {field.upper()}')
" > /tmp/required_vars.txt

# Check .env.development has all variables
echo "Checking .env.development..."
for var in $(cat /tmp/required_vars.txt | grep -E '^\s*-' | sed 's/^\s*-\s*//'); do
  if grep -q "^${var}=" .env.development; then
    echo "  ✅ $var"
  else
    echo "  ❌ MISSING: $var"
  fi
done

# Check .env.production.example has all variables
echo "Checking .env.production.example..."
for var in $(cat /tmp/required_vars.txt | grep -E '^\s*-' | sed 's/^\s*-\s*//'); do
  if grep -q "^${var}=" .env.production.example; then
    echo "  ✅ $var"
  else
    echo "  ❌ MISSING: $var"
  fi
done

# Expected: All ✅ for both files
```

### 5. Test Environment Switching
```bash
cd backend

# Test symlink method
ln -sf .env.development .env
readlink .env
# Expected: .env.development

python -c "from app.core.config import settings; assert settings.env == 'development'"
echo "✅ Development environment works"

# Switch to production (with example file)
ln -sf .env.production.example .env

# This should FAIL validation (CHANGE_ME placeholders)
python -c "from app.core.config import settings; print(settings.env)" 2>&1 | grep -i error
# Expected: Some validation error about CHANGE_ME or missing values

echo "✅ Production template correctly requires customization"

# Clean up
rm .env
```

### 6. Verify Documentation Completeness
```bash
# Check all documentation files exist
ls -l docs/security-checklist-env-production.md
ls -l docs/environment-migration-guide.md

# Verify CLAUDE.md has environment section
grep -A 10 "## Environment Configuration" CLAUDE.md

# Expected: All files exist and CLAUDE.md has new section
echo "✅ Documentation complete"
```

### 7. Test Docker Compose Integration
```bash
# Verify docker-compose.yml uses environment variables correctly
grep -A 5 "POSTGRES_" docker-compose.yml

# Test starting services with .env.development
cd backend
cp .env.development .env
cd ..
docker-compose up -d postgres redis

# Wait for services to start
sleep 10

# Test connection with development credentials
docker exec youtube-bookmarks-db psql -U youtube_user -d youtube_bookmarks -c "SELECT 1;"
# Expected: Returns "(1 row)"

# Clean up
docker-compose down
```

---

**Unit Tests (Future Enhancement):**

After Task #118 (Config Secret Validation) is implemented, these tests should be added to `backend/tests/core/test_config.py`:

```python
def test_development_env_allows_weak_secrets():
    """Development environment should allow weak secrets for convenience."""
    os.environ["ENVIRONMENT"] = "development"
    os.environ["SECRET_KEY"] = "weak-dev-key"
    settings = Settings()
    assert settings.env == "development"
    assert settings.secret_key == "weak-dev-key"

def test_production_env_rejects_weak_secrets():
    """Production environment should reject default/weak secrets."""
    os.environ["ENVIRONMENT"] = "production"
    os.environ["SECRET_KEY"] = "your-secret-key-here-change-in-production"

    with pytest.raises(ValueError, match="Cannot use default secret_key in production"):
        settings = Settings()

def test_production_env_requires_strong_secret_key():
    """Production environment should require min 32 char secret key."""
    os.environ["ENVIRONMENT"] = "production"
    os.environ["SECRET_KEY"] = "short"

    with pytest.raises(ValueError, match="at least 32 characters"):
        settings = Settings()

def test_all_required_variables_in_env_development():
    """Ensure .env.development has all required variables."""
    from dotenv import dotenv_values
    env_vars = dotenv_values(".env.development")

    required = Settings.model_fields.keys()
    for field in required:
        assert field.upper() in env_vars, f"Missing {field.upper()} in .env.development"

def test_all_required_variables_in_env_production_example():
    """Ensure .env.production.example has all required variables."""
    from dotenv import dotenv_values
    env_vars = dotenv_values(".env.production.example")

    required = Settings.model_fields.keys()
    for field in required:
        assert field.upper() in env_vars, f"Missing {field.upper()} in .env.production.example"
```

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` - Task 3: Environment-Aware Configuration
- FastAPI Settings Documentation: https://fastapi.tiangolo.com/advanced/settings/
- Microsoft Security Best Practices: https://learn.microsoft.com/en-us/azure/security/fundamentals/secrets-best-practices
- Pydantic Settings: https://docs.pydantic.dev/latest/concepts/pydantic_settings/

**Related Code:**
- `backend/app/core/config.py` - Settings class with Pydantic validation
- `docker-compose.yml` - Docker service configuration with environment variables
- `.gitignore` - Git ignore patterns for environment files

**Design Decisions:**

### Why Two Separate Files?
- **`.env.development`** committed to git for developer onboarding (no secret hunting, works out of the box)
- **`.env.production.example`** as template to prevent accidental deployment with weak secrets
- **`.env.production`** git-ignored for actual production secrets

### Why Inline Comments vs Separate Docs?
- Inline comments keep documentation next to values (less context switching)
- Developers can read file directly without opening multiple documents
- Comments survive copy-paste operations
- Separation Principle: Security checklist and migration guide in separate docs (different audiences)

### Why CHANGE_ME Placeholder Convention?
- Makes it impossible to deploy without customization (fails validation)
- Easy to grep for: `grep CHANGE_ME .env.production`
- Industry standard (used by many open-source projects)
- Better than empty values (which might be valid for some variables)

### Why Docker-Internal Hostnames in Production?
- **localhost** = host machine (wrong when app runs in container)
- **db/redis** = Docker Compose service names (internal network)
- Production should use container-to-container networking (faster, more secure)
- Development can use localhost (Docker port-forwarding for convenience)

### Why Long Comments?
- Security is critical, detailed explanations prevent mistakes
- New developers need context (why 32 chars? why rotate secrets?)
- Production deployment is infrequent (better to over-document than under-document)
- Follows "Principle of Least Surprise" (explicit is better than implicit)

---

## 🔄 Dependencies for Future Tasks

This task is a **prerequisite** for:
- **Task #116**: Secret Generation Script (uses these .env templates)
- **Task #117**: Docker Compose Environment Variables (references these files)
- **Task #118**: Config Secret Validation (validates these configurations)
- **Task #119**: Secrets Setup Documentation (links to these guides)
- **Task #120**: Environment Enum Settings (extends ENVIRONMENT variable)

This task **depends on:** None (can be implemented independently)

---

## 📊 Estimated Effort

- File creation: 1 hour
- Documentation writing: 2 hours
- Testing and verification: 1 hour
- **Total: 4 hours**

---

## ✅ Definition of Done

- [ ] `.env.development` created with all variables and safe defaults
- [ ] `.env.production.example` created with all variables and CHANGE_ME placeholders
- [ ] Both files have comprehensive inline comments
- [ ] `.gitignore` updated to allow `.env.development` but block `.env.production`
- [ ] Security checklist document created
- [ ] Migration guide document created
- [ ] CLAUDE.md updated with environment configuration section
- [ ] All manual tests pass
- [ ] Files can be loaded by Pydantic without errors
- [ ] Variable completeness verified (all config.py fields present)
- [ ] Docker Compose integration tested
- [ ] Documentation reviewed for accuracy and completeness
