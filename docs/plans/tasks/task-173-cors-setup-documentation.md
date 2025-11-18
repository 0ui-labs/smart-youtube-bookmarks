# Task #173: Create CORS Setup Documentation

**Plan Task:** #173
**Priority:** P1 - Important (Documentation for Production Deployment)
**Parent Plan:** Security Hardening Implementation (Task 6: CORS Security, lines 2090-2200)
**Dependencies:** Task #159 (CORS Helpers), Task #160 (Update main.py CORS)

---

## 🎯 Ziel

Create comprehensive CORS setup documentation (`docs/deployment/CORS_SETUP.md`) that guides developers and operations teams through:
1. Understanding how CORS works in this application
2. Configuring CORS for development (localhost)
3. Configuring CORS for production (explicit origins)
4. Security best practices and common pitfalls
5. Troubleshooting CORS issues

**Expected Result:**
- Complete CORS setup guide in `docs/deployment/CORS_SETUP.md`
- Quick start section for developers (< 2 minutes to read)
- Production configuration checklist for operations teams
- Troubleshooting guide with common error messages and solutions
- Security principles section explaining CORS defense-in-depth

---

## 📋 Acceptance Criteria

**Documentation Completeness:**
- [ ] Quick start section covers development setup (no configuration needed)
- [ ] Production configuration section with step-by-step instructions
- [ ] Environment variable reference table (ENVIRONMENT, ALLOWED_ORIGINS)
- [ ] Security best practices section (7+ principles)
- [ ] Troubleshooting section with 5+ common issues and solutions
- [ ] Example configurations for common deployment scenarios
- [ ] Links to FastAPI and MDN CORS documentation

**Accuracy:**
- [ ] All examples tested manually (development and production modes)
- [ ] Environment variable names match `backend/app/core/config.py`
- [ ] CORS helper function names match Task #159 implementation
- [ ] Example curl commands produce expected output

**Usability:**
- [ ] Table of contents for easy navigation
- [ ] Code blocks with syntax highlighting hints
- [ ] Clear section headings (developers can scan quickly)
- [ ] Common pitfalls highlighted with warning callouts

**Review:**
- [ ] Manual review for technical accuracy
- [ ] Peer review (if available) for clarity
- [ ] All examples verified against running application

---

## 🛠️ Implementation Steps

### Step 1: Create docs/deployment Directory

**Action:** Create directory structure for deployment documentation

**Commands:**
```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks
mkdir -p docs/deployment
```

**Verification:**
```bash
ls -la docs/deployment/
```

**Expected:** Directory exists and is empty

---

### Step 2: Create CORS_SETUP.md Skeleton

**File:** `docs/deployment/CORS_SETUP.md`

**Action:** Create file with table of contents and section headers

**Content:**
```markdown
# CORS Configuration Guide

> **Last Updated:** 2025-11-10  
> **Related Code:** `backend/app/core/config.py` (CORS helpers), `backend/app/main.py` (CORS middleware)

This guide explains how to configure Cross-Origin Resource Sharing (CORS) for the Smart YouTube Bookmarks application in development and production environments.

## Table of Contents

1. [Quick Start (Development)](#quick-start-development)
2. [Production Configuration](#production-configuration)
3. [Environment Variables Reference](#environment-variables-reference)
4. [Security Best Practices](#security-best-practices)
5. [Common Scenarios](#common-scenarios)
6. [Troubleshooting](#troubleshooting)
7. [How CORS Works](#how-cors-works)
8. [References](#references)

---

## Quick Start (Development)

## Production Configuration

## Environment Variables Reference

## Security Best Practices

## Common Scenarios

## Troubleshooting

## How CORS Works

## References
```

**Why:** Establishes structure before filling in content

---

### Step 3: Write "Quick Start (Development)" Section

**File:** `docs/deployment/CORS_SETUP.md`

**Action:** Add development setup section (based on master plan template lines 2152-2160)

**Content (append to file):**
```markdown
## Quick Start (Development)

### No Configuration Needed!

In development mode (default), CORS is automatically configured to allow requests from:

- `http://localhost:5173` - Vite frontend dev server (default port)
- `http://localhost:8000` - FastAPI backend dev server (for testing)
- `http://127.0.0.1:5173` - Alternative localhost notation
- `http://127.0.0.1:8000` - Alternative localhost notation

**Both `localhost` and `127.0.0.1` are included** because some browsers and tools treat them as different origins.

### Start Development Servers

**Backend:**
```bash
cd backend
uvicorn app.main:app --reload
# Runs on http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

**Verify CORS Works:**

1. Open browser to `http://localhost:5173`
2. Open browser DevTools Console (F12)
3. Run this test:
   ```javascript
   fetch('http://localhost:8000/api/health')
     .then(r => r.json())
     .then(console.log)
   ```
4. Expected output: `{status: "ok", environment: "development"}`
5. No CORS errors in console

### What's Allowed in Development?

| Configuration | Value | Reason |
|--------------|-------|--------|
| **Origins** | localhost:5173, localhost:8000, 127.0.0.1:5173, 127.0.0.1:8000 | Allow frontend and backend testing |
| **Methods** | `*` (all methods) | Simplify development (no preflight issues) |
| **Headers** | `*` (all headers) | Allow custom headers without configuration |
| **Credentials** | `true` | Support cookies and Authorization headers |

⚠️ **Warning:** Development settings are permissive by design. Never use these settings in production!
```

**Rationale:** 
- Answers "How do I get started?" in < 1 minute
- Includes verification step to confirm CORS works
- Explains why both localhost variants are included (common question)

---

### Step 4: Write "Production Configuration" Section

**File:** `docs/deployment/CORS_SETUP.md`

**Action:** Add production setup section with step-by-step instructions

**Content (append to file):**
```markdown
## Production Configuration

### Step 1: Set Environment Variables

Production requires explicit CORS configuration via environment variables.

**Minimum Required Variables:**

```bash
# .env (production)
ENVIRONMENT=production
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
SECRET_KEY=<64-character-random-string>  # See Task #154
DEBUG=false
```

### Step 2: Generate ALLOWED_ORIGINS Value

**Format:** Comma-separated list of fully-qualified URLs (protocol + domain + port)

**Rules:**
- ✅ Use HTTPS only (never HTTP in production)
- ✅ Include protocol (`https://`, not just `domain.com`)
- ✅ Include port if non-standard (e.g., `https://app.example.com:8443`)
- ✅ Separate multiple origins with commas (no spaces)
- ❌ No wildcards (`*`) allowed
- ❌ No regex patterns
- ❌ No localhost/127.0.0.1 in production

**Single Origin Example:**
```bash
ALLOWED_ORIGINS=https://app.yourdomain.com
```

**Multiple Origins Example:**
```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com,https://admin.yourdomain.com
```

### Step 3: Verify Configuration

**Start server with production config:**
```bash
cd backend
export ENVIRONMENT=production
export ALLOWED_ORIGINS=https://yourdomain.com
export SECRET_KEY=<your-secret-key>
export DEBUG=false
uvicorn app.main:app
```

**Test CORS with curl:**
```bash
# Test allowed origin (should work)
curl -i -X OPTIONS http://localhost:8000/api/health \
  -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: GET"

# Expected response headers:
# Access-Control-Allow-Origin: https://yourdomain.com
# Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
# Access-Control-Allow-Credentials: true

# Test disallowed origin (should fail)
curl -i -X OPTIONS http://localhost:8000/api/health \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"

# Expected: No Access-Control-Allow-Origin header
```

### Step 4: Deploy

Deploy your application with the production environment variables set. The CORS configuration will be enforced automatically.

### What's Allowed in Production?

| Configuration | Value | Reason |
|--------------|-------|--------|
| **Origins** | Explicit list from `ALLOWED_ORIGINS` | Security: Only allow known frontend domains |
| **Methods** | `GET, POST, PUT, PATCH, DELETE, OPTIONS` | Only allow methods the API actually uses |
| **Headers** | `Authorization, Content-Type, Accept, Origin, User-Agent, DNT, Cache-Control, X-Requested-With` | Standard REST API headers only |
| **Credentials** | `true` | Support JWT authentication (future Task #1) |

### Fail-Fast Validation

If `ALLOWED_ORIGINS` is not set in production, the application will **crash at startup** with:

```
ValueError: ALLOWED_ORIGINS environment variable must be set in production.
Example: ALLOWED_ORIGINS='https://app.example.com,https://www.example.com'
```

This is intentional! It prevents accidentally deploying with insecure CORS configuration.
```

**Rationale:**
- Step-by-step instructions reduce misconfiguration risk
- Verification step catches errors before deployment
- Fail-fast explanation prevents confusion when server won't start

---

### Step 5: Write "Environment Variables Reference" Section

**File:** `docs/deployment/CORS_SETUP.md`

**Action:** Add reference table for all CORS-related environment variables

**Content (append to file):**
```markdown
## Environment Variables Reference

| Variable | Required | Default | Valid Values | Description |
|----------|----------|---------|--------------|-------------|
| `ENVIRONMENT` | No | `development` | `development`, `staging`, `production` | Application environment mode |
| `ALLOWED_ORIGINS` | Yes (production) | None | Comma-separated URLs | Allowed CORS origins in production |
| `DEBUG` | No | `true` (dev), `false` (prod) | `true`, `false` | FastAPI debug mode |

### ENVIRONMENT

Controls which CORS configuration is used:

- **`development`** (default): Permissive settings, localhost origins, wildcard methods/headers
- **`staging`**: Same as production (explicit origins required)
- **`production`**: Strict settings, explicit origins required, no wildcards

**Example:**
```bash
ENVIRONMENT=production
```

### ALLOWED_ORIGINS

Comma-separated list of allowed frontend URLs in production/staging.

**Format:** `https://domain1.com,https://domain2.com`

**Parsing Rules:**
- Split on comma (`,`)
- Whitespace is automatically stripped
- Empty strings are removed (trailing commas OK)
- Must result in at least one valid origin

**Examples:**

```bash
# Single origin
ALLOWED_ORIGINS=https://app.example.com

# Multiple origins (no spaces)
ALLOWED_ORIGINS=https://app.example.com,https://www.example.com

# Multiple origins (with spaces - OK, will be stripped)
ALLOWED_ORIGINS=https://app.example.com, https://www.example.com

# Custom port (non-standard HTTPS port)
ALLOWED_ORIGINS=https://app.example.com:8443
```

**Common Mistakes:**

```bash
# ❌ Missing protocol
ALLOWED_ORIGINS=app.example.com  # Wrong!

# ❌ Using HTTP in production
ALLOWED_ORIGINS=http://app.example.com  # Insecure!

# ❌ Using wildcards
ALLOWED_ORIGINS=https://*.example.com  # Not supported!

# ✅ Correct
ALLOWED_ORIGINS=https://app.example.com
```

### DEBUG

Controls FastAPI debug mode (verbose error messages).

- **`true`**: Detailed error responses, auto-reload on code changes
- **`false`**: Generic error responses, no auto-reload (production)

**Security Note:** Always set `DEBUG=false` in production to avoid leaking stack traces and internal details in error responses.
```

**Rationale:**
- Reference table for quick lookup
- Examples prevent common configuration mistakes
- Security notes explain why each setting matters

---

### Step 6: Write "Security Best Practices" Section

**File:** `docs/deployment/CORS_SETUP.md`

**Action:** Add security principles section (based on Task #159 lines 27-52)

**Content (append to file):**
```markdown
## Security Best Practices

### 1. CORS is Defense-in-Depth, NOT Primary Security

**What CORS Protects:**
- ✅ Prevents malicious JavaScript on other websites from reading your API responses in a browser
- ✅ Adds a browser-level check before cross-origin requests

**What CORS Does NOT Protect:**
- ❌ Direct HTTP requests (curl, Postman, Python requests library)
- ❌ Attackers who bypass the browser
- ❌ Server-side request forgery (SSRF)

**Primary Security Comes From:**
1. Authentication (JWT tokens) - Task #1
2. Authorization (user permissions)
3. Input validation (prevent injection attacks)
4. Rate limiting - Task 5
5. HTTPS/TLS encryption

**Bottom Line:** CORS is an additional security layer, not a replacement for authentication.

### 2. Never Use Wildcards in Production

**Why Wildcards Are Dangerous:**

```python
# ❌ INSECURE - Any website can make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # BAD!
    allow_methods=["*"],  # BAD!
    allow_headers=["*"],  # BAD!
)
```

**Problems:**
- Any website can embed your API and read responses
- Data exfiltration attacks become trivial
- No origin tracking for abuse detection
- Violates principle of least privilege

**Correct Production Configuration:**

```python
# ✅ SECURE - Only known origins allowed
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),  # Explicit list
    allow_methods=get_cors_methods(),  # Only used methods
    allow_headers=get_cors_headers(),  # Standard headers
    allow_credentials=True,
)
```

### 3. HTTPS-Only Origins in Production

**Always use HTTPS URLs in `ALLOWED_ORIGINS`:**

```bash
# ✅ Secure
ALLOWED_ORIGINS=https://app.example.com

# ❌ Insecure (plaintext HTTP)
ALLOWED_ORIGINS=http://app.example.com
```

**Why:** HTTP traffic can be intercepted and modified (MITM attacks). HTTPS encrypts traffic and verifies server identity.

### 4. Wildcard + Credentials = Browser Rejection

**CORS Specification Rule:**

When `allow_credentials=True`, wildcards for origins/methods/headers are **forbidden by browsers**.

```python
# ❌ Browser will reject this configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Wildcard with credentials
    allow_credentials=True,  # Not allowed!
)
```

**From MDN CORS Docs:**
> When responding to a credentialed request, the server **must not** specify the `*` wildcard for `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, or `Access-Control-Allow-Methods`.

**This application uses `allow_credentials=True`** for future JWT authentication, so explicit origins/methods/headers are required.

### 5. Fail Fast on Misconfiguration

**Production startup will crash if CORS misconfigured:**

```python
# In production, missing ALLOWED_ORIGINS raises ValueError
ValueError: ALLOWED_ORIGINS environment variable must be set in production.
```

**This is a feature, not a bug!** It prevents:
- Accidentally deploying with development CORS settings
- Silent failures where all CORS requests are blocked
- Security vulnerabilities from wildcard origins

### 6. Include Both localhost and 127.0.0.1 in Development

**Development origins include both variants:**

```python
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",  # Same host, different notation
]
```

**Why:** Some browsers/tools treat `localhost` and `127.0.0.1` as different origins. Including both prevents confusing CORS errors during development.

### 7. Monitor CORS Errors in Production

**CORS failures are silent to JavaScript** (security feature), but visible in:
- Browser DevTools Console (client-side)
- Application logs (server-side, if logged)

**Example Console Error:**
```
Access to fetch at 'https://api.example.com/videos' from origin 'https://app.example.com' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

**Action Items:**
- Monitor browser console for CORS errors during QA
- Log CORS preflight failures on server (future improvement)
- Set up alerts for increased CORS errors (indicates misconfiguration)

### 8. Understand Preflight Requests

**Browsers send OPTIONS requests before "complex" requests:**

**Triggers Preflight:**
- Non-simple methods: `PUT`, `PATCH`, `DELETE`
- Custom headers: `Authorization`, `X-Custom-Header`
- Content-Type: `application/json` (for POST)

**Example Preflight:**
```http
OPTIONS /api/videos HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization, Content-Type
```

**Server Response:**
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Accept
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 600
```

**FastAPI's CORSMiddleware handles preflight automatically** - no custom code needed.
```

**Rationale:**
- Explains common misconceptions about CORS security
- Highlights 8 security principles from Task #159 and master plan
- Includes examples of insecure vs secure configurations
- References MDN CORS spec for authoritative guidance

---

### Step 7: Write "Common Scenarios" Section

**File:** `docs/deployment/CORS_SETUP.md`

**Action:** Add example configurations for typical deployment scenarios

**Content (append to file):**
```markdown
## Common Scenarios

### Scenario 1: Single Production Domain

**Setup:** One frontend domain, one API domain

```bash
# .env
ENVIRONMENT=production
ALLOWED_ORIGINS=https://app.yourdomain.com
SECRET_KEY=<64-char-random-string>
DEBUG=false
```

**Use Case:** Simple deployment, single-page application (SPA) on one domain

---

### Scenario 2: Multiple Frontend Domains

**Setup:** Multiple subdomains serving the same frontend

```bash
# .env
ENVIRONMENT=production
ALLOWED_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com,https://admin.yourdomain.com
SECRET_KEY=<64-char-random-string>
DEBUG=false
```

**Use Case:** 
- Public website: `www.yourdomain.com`
- App interface: `app.yourdomain.com`
- Admin panel: `admin.yourdomain.com`

**All share the same API backend.**

---

### Scenario 3: Staging + Production Environments

**Staging:**
```bash
# .env.staging
ENVIRONMENT=staging
ALLOWED_ORIGINS=https://staging.yourdomain.com
SECRET_KEY=<staging-secret-key>
DEBUG=false
```

**Production:**
```bash
# .env.production
ENVIRONMENT=production
ALLOWED_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com
SECRET_KEY=<production-secret-key>
DEBUG=false
```

**Use Case:** Separate staging environment for testing before production deployment

---

### Scenario 4: Custom Port (Non-Standard HTTPS)

**Setup:** Frontend on non-standard port

```bash
# .env
ENVIRONMENT=production
ALLOWED_ORIGINS=https://app.yourdomain.com:8443
SECRET_KEY=<64-char-random-string>
DEBUG=false
```

**Use Case:** Custom HTTPS port (not 443)

**Important:** Port must be explicitly included in `ALLOWED_ORIGINS` if non-standard.

---

### Scenario 5: Docker Compose with Traefik Reverse Proxy

**Setup:** Frontend, backend, and Traefik reverse proxy

**docker-compose.yml:**
```yaml
services:
  backend:
    environment:
      - ENVIRONMENT=production
      - ALLOWED_ORIGINS=https://app.yourdomain.com
      - SECRET_KEY=${SECRET_KEY}
      - DEBUG=false
    labels:
      - "traefik.http.routers.backend.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.backend.tls=true"

  frontend:
    labels:
      - "traefik.http.routers.frontend.rule=Host(`app.yourdomain.com`)"
      - "traefik.http.routers.frontend.tls=true"
```

**Use Case:** Docker deployment with Traefik handling TLS termination

---

### Scenario 6: Development with Custom Frontend Port

**Setup:** Frontend running on non-default port (e.g., 3000 instead of 5173)

**Problem:** Development CORS hardcoded to port 5173

**Solution:** 

**Option A (Recommended):** Use default Vite port
```bash
cd frontend
npm run dev  # Uses port 5173 by default
```

**Option B:** Modify CORS helpers temporarily

Edit `backend/app/core/config.py`:
```python
def get_cors_origins() -> list[str]:
    if settings.is_development:
        return [
            "http://localhost:5173",
            "http://localhost:3000",  # Add custom port
            "http://localhost:8000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",  # Add custom port
            "http://127.0.0.1:8000"
        ]
```

**Option C:** Use environment variable (future improvement)
```bash
# Not yet implemented, but could add:
DEVELOPMENT_ORIGINS=http://localhost:3000
```

---

### Scenario 7: Mobile App + Web App

**Setup:** React Native mobile app + React web app

```bash
# .env
ENVIRONMENT=production
ALLOWED_ORIGINS=https://app.yourdomain.com,https://mobile.yourdomain.com
SECRET_KEY=<64-char-random-string>
DEBUG=false
```

**Note:** Mobile apps using WebView may need different CORS handling. Native mobile apps (not WebView) make direct HTTP requests and are not subject to CORS restrictions.

**Use Case:** Web app for desktop, mobile WebView for app

---
```

**Rationale:**
- Covers 7 common deployment scenarios
- Includes docker-compose example (common in production)
- Addresses development customization (custom ports)
- Explains mobile app CORS behavior (WebView vs native)

---

### Step 8: Write "Troubleshooting" Section

**File:** `docs/deployment/CORS_SETUP.md`

**Action:** Add troubleshooting guide with common errors and solutions

**Content (append to file):**
```markdown
## Troubleshooting

### Issue 1: CORS Error in Browser Console

**Error Message:**
```
Access to fetch at 'http://localhost:8000/api/health' from origin 'http://localhost:5173' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

**Diagnosis:**
- Server is not sending CORS headers
- Origin not in allowed list
- CORS middleware not configured

**Solutions:**

1. **Check backend is running:**
   ```bash
   curl http://localhost:8000/api/health
   # Should return: {"status":"ok","environment":"development"}
   ```

2. **Check CORS middleware configured:**
   ```bash
   # Verify CORSMiddleware in backend/app/main.py
   grep -A5 "CORSMiddleware" backend/app/main.py
   ```

3. **Check environment mode:**
   ```bash
   # In backend directory
   python -c "from app.core.config import settings; print(settings.environment.value)"
   # Should print: development
   ```

4. **Test CORS preflight:**
   ```bash
   curl -i -X OPTIONS http://localhost:8000/api/health \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET"
   # Should return Access-Control-Allow-Origin header
   ```

---

### Issue 2: Server Crashes on Startup (Production)

**Error Message:**
```
ValueError: ALLOWED_ORIGINS environment variable must be set in production.
Example: ALLOWED_ORIGINS='https://app.example.com,https://www.example.com'
```

**Diagnosis:**
- `ENVIRONMENT=production` but `ALLOWED_ORIGINS` not set
- Fail-fast validation caught misconfiguration

**Solution:**

Set `ALLOWED_ORIGINS` environment variable:

```bash
# Option 1: Export before starting
export ALLOWED_ORIGINS=https://yourdomain.com
uvicorn app.main:app

# Option 2: Add to .env file
echo "ALLOWED_ORIGINS=https://yourdomain.com" >> .env

# Option 3: Inline with command
ALLOWED_ORIGINS=https://yourdomain.com uvicorn app.main:app
```

---

### Issue 3: localhost Works but 127.0.0.1 Doesn't (or vice versa)

**Error Message:**
```
Access to fetch at 'http://localhost:8000/api/health' from origin 'http://127.0.0.1:5173' 
has been blocked by CORS policy
```

**Diagnosis:**
- Browser treats `localhost` and `127.0.0.1` as different origins
- Only one variant in CORS allowed origins

**Solution:**

Development mode includes both by default. If issue persists:

1. **Check browser is using correct URL:**
   - Navigate to `http://localhost:5173` (not `http://127.0.0.1:5173`)

2. **Verify CORS origins include both:**
   ```python
   # backend/app/core/config.py
   def get_cors_origins():
       if settings.is_development:
           return [
               "http://localhost:5173",
               "http://127.0.0.1:5173",  # Both variants
               ...
           ]
   ```

---

### Issue 4: Preflight Request Fails (OPTIONS Method)

**Error Message:**
```
Access to fetch at 'https://api.example.com/videos' from origin 'https://app.example.com' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check
```

**Diagnosis:**
- Preflight OPTIONS request not handled correctly
- Methods or headers not in allowed lists

**Solutions:**

1. **Check browser Network tab:**
   - Look for OPTIONS request before actual request
   - Check response headers include:
     - `Access-Control-Allow-Origin`
     - `Access-Control-Allow-Methods`
     - `Access-Control-Allow-Headers`

2. **Verify OPTIONS in allowed methods:**
   ```python
   # backend/app/core/config.py
   def get_cors_methods():
       if settings.is_production:
           return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]  # OPTIONS required!
   ```

3. **Check custom headers are allowed:**
   ```python
   # If using custom header X-Custom-Token, add to allowed headers:
   def get_cors_headers():
       if settings.is_production:
           return [
               "Authorization",
               "Content-Type",
               "X-Custom-Token",  # Add custom header
               ...
           ]
   ```

---

### Issue 5: Production Works Locally but Fails in Deployment

**Error Message:**
```
Access to fetch at 'https://api.example.com/health' from origin 'https://app.example.com' 
has been blocked by CORS policy
```

**Diagnosis:**
- Environment variables not set in deployment environment
- ALLOWED_ORIGINS doesn't match actual frontend URL
- Protocol mismatch (HTTP vs HTTPS)

**Solutions:**

1. **Verify environment variables in deployment:**
   ```bash
   # SSH into server or check container env
   env | grep ALLOWED_ORIGINS
   env | grep ENVIRONMENT
   ```

2. **Check exact frontend URL:**
   - Open browser DevTools Network tab
   - Look at OPTIONS request Origin header
   - Ensure this exact URL is in ALLOWED_ORIGINS

3. **Check protocol matches:**
   ```bash
   # ❌ Wrong - Protocol mismatch
   ALLOWED_ORIGINS=http://app.example.com  # Frontend uses HTTPS!

   # ✅ Correct
   ALLOWED_ORIGINS=https://app.example.com
   ```

4. **Check reverse proxy configuration:**
   - Nginx/Traefik might modify Origin header
   - Check proxy passes Origin header correctly

---

### Issue 6: Wildcard Origins Not Working in Production

**Error Message:**
```
ValueError: ALLOWED_ORIGINS environment variable must be set in production.
```

**Diagnosis:**
- Tried to use `ALLOWED_ORIGINS=*`
- Wildcards not supported (security requirement)

**Solution:**

Use explicit origins instead of wildcards:

```bash
# ❌ Not supported
ALLOWED_ORIGINS=*
ALLOWED_ORIGINS=https://*.example.com

# ✅ Correct - List each origin explicitly
ALLOWED_ORIGINS=https://app.example.com,https://www.example.com,https://admin.example.com
```

**Rationale:** Wildcards in production are a security vulnerability. See [Security Best Practices](#security-best-practices).

---

### Issue 7: Credentials Not Sent with Request

**Error Message:**
```
Access to fetch at 'https://api.example.com/videos' from origin 'https://app.example.com' 
has been blocked by CORS policy: The value of the 'Access-Control-Allow-Credentials' header 
in the response is '' which must be 'true' when the request's credentials mode is 'include'.
```

**Diagnosis:**
- Frontend sending credentials but backend not allowing
- `allow_credentials=True` not set in CORS middleware

**Solution:**

1. **Verify credentials enabled in backend:**
   ```python
   # backend/app/main.py
   app.add_middleware(
       CORSMiddleware,
       allow_credentials=True,  # Must be True for cookies/auth headers
       ...
   )
   ```

2. **Verify frontend sending credentials:**
   ```javascript
   // Frontend fetch call
   fetch('https://api.example.com/videos', {
       credentials: 'include',  // Required for cookies/auth headers
   })
   ```

---

### Debug Checklist

When troubleshooting CORS issues, check these in order:

- [ ] Backend server is running and reachable
- [ ] Frontend origin matches exactly (protocol, domain, port)
- [ ] `ENVIRONMENT` variable set correctly (`development`, `staging`, or `production`)
- [ ] `ALLOWED_ORIGINS` set in production (comma-separated, no spaces around commas)
- [ ] Origins use HTTPS in production (not HTTP)
- [ ] Browser DevTools Console shows detailed error message
- [ ] Browser DevTools Network tab shows OPTIONS preflight request
- [ ] OPTIONS response includes `Access-Control-Allow-Origin` header
- [ ] OPTIONS response includes `Access-Control-Allow-Methods: OPTIONS`
- [ ] Credentials enabled if using cookies/auth headers (`allow_credentials=true`)
- [ ] No wildcards in production CORS configuration

### Still Having Issues?

1. **Enable verbose logging:** Add debug logging to CORS middleware (future improvement)
2. **Check browser compatibility:** Test in multiple browsers (Chrome, Firefox, Safari)
3. **Test with curl:** Eliminate browser caching/extension issues
4. **Review FastAPI docs:** https://fastapi.tiangolo.com/tutorial/cors/
5. **Review MDN CORS docs:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
6. **Check GitHub issues:** Search fastapi/fastapi and encode/starlette for similar issues
```

**Rationale:**
- Covers 7 common CORS errors with solutions
- Includes debug checklist for systematic troubleshooting
- Provides curl commands for testing outside browser
- Explains why each error occurs (educational)

---

### Step 9: Write "How CORS Works" Section

**File:** `docs/deployment/CORS_SETUP.md`

**Action:** Add educational section explaining CORS mechanism

**Content (append to file):**
```markdown
## How CORS Works

### What is CORS?

**Cross-Origin Resource Sharing (CORS)** is a browser security feature that controls which websites can make requests to your API.

**The Problem CORS Solves:**

Without CORS, any website could make requests to your API and read the responses. This would allow:
- Evil.com to read data from YourAPI.com while you're logged in
- Data exfiltration from malicious JavaScript injected into ads
- Cross-site request forgery (CSRF) attacks

**CORS Prevents:**
- Malicious JavaScript on other websites from reading your API responses **in a browser**

**CORS Does NOT Prevent:**
- Direct HTTP requests from curl, Postman, Python, etc. (server-to-server)
- Attacks that bypass the browser entirely

### The CORS Flow

#### Simple Request (GET, No Custom Headers)

```
1. Browser: "I want to GET /api/health from localhost:5173"
   → Sends: GET /api/health
   → Includes: Origin: http://localhost:5173

2. Server: "localhost:5173 is allowed"
   → Returns: 200 OK
   → Includes: Access-Control-Allow-Origin: http://localhost:5173

3. Browser: "Origin is allowed, here's the response"
   → JavaScript can read the response
```

#### Preflight Request (POST with JSON, Custom Headers, Non-GET)

```
1. Browser: "I want to POST /api/videos with JSON from localhost:5173"
   → Sends: OPTIONS /api/videos (preflight)
   → Includes: Origin: http://localhost:5173
   → Includes: Access-Control-Request-Method: POST
   → Includes: Access-Control-Request-Headers: Content-Type, Authorization

2. Server: "localhost:5173 is allowed, POST is OK, those headers are OK"
   → Returns: 200 OK
   → Includes: Access-Control-Allow-Origin: http://localhost:5173
   → Includes: Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
   → Includes: Access-Control-Allow-Headers: Content-Type, Authorization, ...
   → Includes: Access-Control-Max-Age: 600 (cache preflight for 10 minutes)

3. Browser: "Preflight passed, now send actual request"
   → Sends: POST /api/videos
   → Includes: Origin: http://localhost:5173

4. Server: "localhost:5173 is allowed"
   → Returns: 201 Created
   → Includes: Access-Control-Allow-Origin: http://localhost:5173

5. Browser: "Origin is allowed, here's the response"
   → JavaScript can read the response
```

### Key CORS Concepts

#### Origins

An **origin** is the combination of protocol + domain + port:

| URL | Origin |
|-----|--------|
| `http://localhost:5173` | `http://localhost:5173` |
| `https://app.example.com` | `https://app.example.com` |
| `https://app.example.com:8443` | `https://app.example.com:8443` |
| `http://localhost` | `http://localhost` (port 80 implied) |

**Different origins:**
- `http://localhost:5173` ≠ `http://localhost:8000` (different port)
- `http://localhost:5173` ≠ `https://localhost:5173` (different protocol)
- `http://localhost:5173` ≠ `http://127.0.0.1:5173` (different domain, even though same IP)

#### Preflight Requests

**Simple Requests (No Preflight):**
- Methods: `GET`, `HEAD`, `POST`
- Headers: `Accept`, `Accept-Language`, `Content-Language`, `Content-Type` (only `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`)

**Complex Requests (Require Preflight):**
- Methods: `PUT`, `PATCH`, `DELETE`, or any custom method
- Headers: `Authorization`, `Content-Type: application/json`, any custom header
- Credentials: cookies or Authorization header

**Why Preflight?**
- Server can reject request before processing (security)
- Reduces server load (no need to process invalid requests)
- Caches response for 10 minutes (reduces OPTIONS requests)

#### Credentials

**Credentials include:**
- Cookies (session cookies, auth cookies)
- HTTP Authentication headers (`Authorization: Bearer <token>`)

**Without credentials:**
```javascript
fetch('https://api.example.com/health')
// Server can respond with Access-Control-Allow-Origin: *
```

**With credentials:**
```javascript
fetch('https://api.example.com/health', {
    credentials: 'include'  // Send cookies/auth headers
})
// Server MUST respond with explicit origin (no wildcards)
// Server MUST set Access-Control-Allow-Credentials: true
```

**This application uses `credentials: true`** for future JWT authentication, so wildcards are not allowed.

### CORS Headers Reference

| Header | Direction | Purpose | Example |
|--------|-----------|---------|---------|
| `Origin` | Request | Browser sends origin of requesting page | `Origin: https://app.example.com` |
| `Access-Control-Request-Method` | Request (preflight) | Browser asks which method is allowed | `Access-Control-Request-Method: POST` |
| `Access-Control-Request-Headers` | Request (preflight) | Browser asks which headers are allowed | `Access-Control-Request-Headers: Authorization, Content-Type` |
| `Access-Control-Allow-Origin` | Response | Server tells browser which origin is allowed | `Access-Control-Allow-Origin: https://app.example.com` |
| `Access-Control-Allow-Methods` | Response | Server tells browser which methods are allowed | `Access-Control-Allow-Methods: GET, POST, PUT, DELETE` |
| `Access-Control-Allow-Headers` | Response | Server tells browser which headers are allowed | `Access-Control-Allow-Headers: Authorization, Content-Type` |
| `Access-Control-Allow-Credentials` | Response | Server tells browser credentials are allowed | `Access-Control-Allow-Credentials: true` |
| `Access-Control-Max-Age` | Response | Server tells browser how long to cache preflight | `Access-Control-Max-Age: 600` (10 minutes) |

### Why CORS Errors Are Cryptic

**JavaScript cannot see CORS error details** (by design):

```javascript
fetch('https://api.example.com/health')
    .catch(err => {
        console.log(err.message);
        // Just says: "Failed to fetch"
        // Doesn't reveal why (security feature)
    });
```

**Why?**
- Prevents websites from probing your network (port scanning)
- Prevents leaking information about internal services
- Forces developers to check browser console for details

**Always check Browser DevTools Console for actual CORS error messages.**

### CORS in This Application

**Development Mode:**
```python
# backend/app/core/config.py
def get_cors_origins():
    if settings.is_development:
        return [
            "http://localhost:5173",  # Vite dev server
            "http://localhost:8000",  # FastAPI dev server
            "http://127.0.0.1:5173",  # Alternative localhost
            "http://127.0.0.1:8000",
        ]
```

**Production Mode:**
```python
def get_cors_origins():
    if settings.is_production:
        # Must set ALLOWED_ORIGINS environment variable
        origins = os.getenv("ALLOWED_ORIGINS").split(",")
        return [origin.strip() for origin in origins]
```

**Middleware Configuration:**
```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),  # Dynamic based on environment
    allow_credentials=True,             # Allow cookies/auth headers
    allow_methods=get_cors_methods(),   # ["*"] in dev, explicit in prod
    allow_headers=get_cors_headers(),   # ["*"] in dev, explicit in prod
)
```
```

**Rationale:**
- Educational section for developers unfamiliar with CORS
- Explains preflight request flow (common confusion point)
- Clarifies same-origin policy (protocol + domain + port)
- Shows how this app implements CORS (connects theory to code)

---

### Step 10: Write "References" Section

**File:** `docs/deployment/CORS_SETUP.md`

**Action:** Add references to external documentation and related code

**Content (append to file):**
```markdown
## References

### External Documentation

**CORS Specification & Guides:**
- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) - Comprehensive CORS guide
- [MDN: CORS Preflighted Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflighted_requests) - How preflight works
- [MDN: CORS and Credentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#credentialed_requests_and_wildcards) - Why wildcards fail with credentials

**FastAPI Documentation:**
- [FastAPI: CORS (Cross-Origin Resource Sharing)](https://fastapi.tiangolo.com/tutorial/cors/) - FastAPI CORS middleware guide
- [FastAPI: Settings and Environment Variables](https://fastapi.tiangolo.com/advanced/settings/) - How to use Pydantic settings

**Security Resources:**
- [OWASP: CORS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#cross-origin-resource-sharing) - Security best practices
- [PortSwigger: CORS Vulnerabilities](https://portswigger.net/web-security/cors) - Common CORS vulnerabilities

### Internal Documentation

**Related Code Files:**
- `backend/app/core/config.py` - CORS helper functions (`get_cors_origins()`, `get_cors_methods()`, `get_cors_headers()`)
- `backend/app/main.py` - CORS middleware configuration
- `backend/tests/core/test_config.py` - CORS helper tests
- `backend/tests/integration/test_cors.py` - CORS integration tests (if exists)

**Related Plans:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` - Security hardening master plan (Task 6: CORS Security, lines 2090-2200)
- `docs/plans/tasks/task-159-cors-helpers.md` - CORS helper functions implementation plan
- `docs/plans/tasks/task-160-update-main-cors.md` - main.py CORS middleware update plan

**Related Tasks:**
- Task #158: Environment-aware settings (ENVIRONMENT enum)
- Task #159: CORS helper functions
- Task #160: Update main.py with environment-aware CORS
- Task #171: CORS development mode tests (if exists)
- Task #172: CORS production mode tests (if exists)

### Tools for Testing CORS

**Browser DevTools:**
- Chrome DevTools: F12 → Console + Network tabs
- Firefox DevTools: F12 → Console + Network tabs
- Safari DevTools: Develop menu → Show Web Inspector

**Command-Line Tools:**
- `curl` - Test CORS preflight requests
- `httpie` - User-friendly HTTP client

**Online Tools:**
- [CORS Tester](https://www.test-cors.org/) - Test CORS configuration
- [ReqBin CORS Test](https://reqbin.com/req/c-dwjszac0/curl-test-cors) - Online CORS checker

### Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-10 | 1.0 | Initial documentation (Task #173) |

---

**Last Updated:** 2025-11-10  
**Maintainer:** Smart YouTube Bookmarks Team  
**Questions?** File an issue or check FastAPI/MDN docs above.
```

**Rationale:**
- Links to authoritative CORS documentation (MDN, FastAPI)
- References related code files for developers
- Links to security resources (OWASP)
- Includes changelog for version tracking

---

### Step 11: Manual Testing of Examples

**Action:** Test all curl examples and code snippets in documentation

**Test Plan:**

1. **Development Mode Test:**
   ```bash
   cd backend
   export ENVIRONMENT=development
   uvicorn app.main:app --reload
   
   # In another terminal:
   curl -i -X OPTIONS http://localhost:8000/api/health \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET"
   
   # Expected: Access-Control-Allow-Origin: http://localhost:5173
   ```

2. **Production Mode Test:**
   ```bash
   cd backend
   export ENVIRONMENT=production
   export ALLOWED_ORIGINS=https://example.com
   export SECRET_KEY=test-secret-key-at-least-32-characters-long
   export DEBUG=false
   uvicorn app.main:app
   
   # In another terminal:
   curl -i -X OPTIONS http://localhost:8000/api/health \
     -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET"
   
   # Expected: Access-Control-Allow-Origin: https://example.com
   ```

3. **Verify Health Check Returns Environment:**
   ```bash
   curl http://localhost:8000/api/health
   # Expected: {"status":"ok","environment":"development"}
   ```

4. **Test Browser Fetch (Development):**
   - Open http://localhost:5173
   - Open DevTools Console (F12)
   - Run: `fetch('http://localhost:8000/api/health').then(r => r.json()).then(console.log)`
   - Expected: `{status: "ok", environment: "development"}`
   - Expected: No CORS errors in console

**Record Results:**
- [ ] All curl commands produce expected output
- [ ] Browser fetch works without CORS errors
- [ ] Health check returns environment field
- [ ] Production mode rejects localhost origin
- [ ] Development mode accepts localhost origin

---

### Step 12: Peer Review (Optional)

**Action:** If another developer is available, request review for:

1. **Clarity:** Is the documentation easy to understand?
2. **Completeness:** Are common scenarios covered?
3. **Accuracy:** Do examples work as described?
4. **Troubleshooting:** Are error messages and solutions helpful?

**Review Checklist:**
- [ ] Quick start is < 2 minutes to read
- [ ] Production steps are clear and actionable
- [ ] Troubleshooting section covers common issues
- [ ] Security section explains risks clearly
- [ ] Examples are tested and work

**Feedback:** Record feedback and update documentation accordingly

---

### Step 13: Final Review and Commit

**Action:** Final review of documentation quality

**Checklist:**
- [ ] Table of contents links work (if using GitHub/GitLab)
- [ ] Code blocks have syntax highlighting hints (```bash, ```python, etc.)
- [ ] No typos or grammatical errors
- [ ] All section headings follow consistent format
- [ ] References section includes all external links
- [ ] Changelog updated with creation date

**Commit:**
```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks
git add docs/deployment/CORS_SETUP.md
git commit -m "docs: add comprehensive CORS configuration guide (Task #173)

- Quick start for development (no config needed)
- Production setup with step-by-step instructions
- Security best practices (8 principles)
- Common scenarios (7 deployment setups)
- Troubleshooting guide (7 common issues)
- Educational section explaining CORS mechanism
- Environment variables reference table

Addresses Task #173 from security hardening plan.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Manual Testing

**Test 1: Verify All Examples Work**
- Run all curl commands in development mode
- Run all curl commands in production mode
- Test browser fetch examples
- Verify expected output matches documentation

**Test 2: Follow Quick Start Guide**
- Start with fresh terminal session
- Follow "Quick Start (Development)" section exactly
- Verify CORS works without configuration

**Test 3: Follow Production Configuration**
- Follow "Production Configuration" section step-by-step
- Verify CORS works with explicit origins
- Verify localhost is rejected in production

**Test 4: Test Troubleshooting Solutions**
- Deliberately create each error scenario
- Follow troubleshooting steps
- Verify solutions resolve issues

### Peer Review (Optional)

**Ask reviewer to:**
1. Read documentation cold (no prior context)
2. Identify confusing sections
3. Test examples and verify they work
4. Suggest improvements

### Accuracy Verification

**Checklist:**
- [ ] Environment variable names match `backend/app/core/config.py`
- [ ] CORS helper function names match Task #159 implementation
- [ ] Example origins match development defaults
- [ ] Security principles match master plan (lines 2177-2185)
- [ ] All curl commands tested and verified

---

## 📚 Reference

### Master Plan Template

The documentation template from master plan (lines 2147-2185) provides:
- Basic development section
- Basic production section
- Security checklist

This implementation plan **expands** the template with:
- Comprehensive troubleshooting (7 issues)
- Common deployment scenarios (7 scenarios)
- Educational CORS explanation
- Security best practices (8 principles)
- Environment variables reference table

### Related Documentation

- **FastAPI CORS Tutorial:** https://fastapi.tiangolo.com/tutorial/cors/
- **MDN CORS Guide:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **OWASP CORS Security:** https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#cross-origin-resource-sharing

### Related Code

- **CORS Helpers:** `backend/app/core/config.py` (Task #159)
- **CORS Middleware:** `backend/app/main.py` (Task #160)
- **Settings Class:** `backend/app/core/config.py` (Task #158)

### Common Pitfalls (Documented)

1. **localhost vs 127.0.0.1** - Treated as different origins by some browsers
2. **HTTP vs HTTPS** - Protocol mismatch causes CORS failure
3. **Missing port** - `localhost:5173` ≠ `localhost` (port 80 implied)
4. **Wildcards with credentials** - Forbidden by CORS spec, browsers reject
5. **Missing OPTIONS method** - Preflight requests fail without OPTIONS
6. **Trailing commas** - OK in ALLOWED_ORIGINS (whitespace stripped)
7. **Custom headers** - Require explicit listing in production

---

## 🎯 Success Criteria

**Documentation is complete when:**
- [ ] All sections filled out (8 major sections)
- [ ] Quick start takes < 2 minutes to read
- [ ] Production setup is step-by-step
- [ ] Troubleshooting covers 5+ common issues
- [ ] Security principles explain risks
- [ ] All examples tested and verified
- [ ] References section links to external docs
- [ ] File created at `docs/deployment/CORS_SETUP.md`
- [ ] Committed to git with descriptive message

---

## 📈 Metrics

**Documentation Quality:**
- Word count: ~5,000-6,000 words
- Sections: 8 major sections
- Code examples: 30+ code blocks
- Scenarios: 7 common deployment setups
- Troubleshooting: 7 issues with solutions
- Security principles: 8 best practices

**Time Estimate:**
- Writing: 3-4 hours
- Testing examples: 1-2 hours
- Review and polish: 1 hour
- **Total: 5-7 hours**

---

## ✅ Definition of Done

- [ ] `docs/deployment/` directory created
- [ ] `docs/deployment/CORS_SETUP.md` created
- [ ] Table of contents with 8 sections
- [ ] Quick start section (development)
- [ ] Production configuration section
- [ ] Environment variables reference table
- [ ] Security best practices section (8+ principles)
- [ ] Common scenarios section (7+ scenarios)
- [ ] Troubleshooting section (7+ issues)
- [ ] How CORS Works section (educational)
- [ ] References section with external links
- [ ] All curl examples tested
- [ ] All code snippets verified
- [ ] Manual review completed
- [ ] Peer review completed (if available)
- [ ] Committed to git

---

**Estimated Time:** 5-7 hours (including testing and review)

**Priority:** P1 - Important (Production deployment documentation)

**Next Tasks:**
- Task #174: Integration tests for CORS configuration (if not yet completed)
- Task #175: Commit CORS documentation and tests together
