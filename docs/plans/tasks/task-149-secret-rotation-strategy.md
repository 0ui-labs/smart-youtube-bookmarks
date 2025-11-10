# Task #149: Document secret rotation strategy

**Plan Task:** #149
**Wave/Phase:** Phase 2 - Secret Management System (Security Hardening)
**Dependencies:** Task #148 (Vault integration documentation), Task #110-#118 (JWT auth endpoints and config)

---

## 🎯 Ziel

Document comprehensive secret rotation strategies for all credential types (database passwords, API keys, JWT secrets) with zero-downtime requirements and compliance standards. Create actionable procedures and automation scripts that enable secure credential lifecycle management without service interruption.

## 📋 Acceptance Criteria

- [ ] Database password rotation strategy with blue/green approach documented
- [ ] JWT secret rotation strategy that preserves active token validity documented
- [ ] API key rotation with graceful transition period (dual-key acceptance) documented
- [ ] Rotation schedules defined with compliance justification (daily, weekly, monthly, quarterly)
- [ ] Compliance matrix created (GDPR, SOC2, NIST, OWASP requirements)
- [ ] Automation scripts provided for each rotation type
- [ ] Zero-downtime procedures verified with failure recovery steps
- [ ] Production rollout checklist created
- [ ] Documentation reviewed and approved

---

## 🛠️ Implementation Steps

### 1. Database Password Rotation (Blue/Green Strategy)

**Files:** 
- `docs/plans/tasks/task-149-secret-rotation-strategy.md` (this file)
- `backend/scripts/rotate_db_password.py` (to be created)
- `backend/app/core/config.py` (reference)

**Action:** Document zero-downtime database password rotation using blue/green deployment pattern with connection pool failover.

#### Strategy Overview

The blue/green approach maintains two database password states:
- **Blue (Current):** Active production password used by all connections
- **Green (New):** Next password generated and pre-configured before switchover

**Zero-Downtime Requirements:**
1. PostgreSQL allows multiple valid passwords for same user simultaneously
2. Connection pool maintains persistent connections using old password
3. New connections use new password from updated pool configuration
4. Graceful transition period allows old connections to drain naturally

#### Step-by-Step Procedure

```
Phase 1: Preparation (Pre-Rotation)
├─ Generate new secure password (32+ chars, cryptographically random)
├─ Store in secret vault with metadata (old_password, new_password, rotation_timestamp)
├─ Schedule rotation during low-traffic window (2-4 AM UTC typically)
├─ Notify ops team and prepare rollback procedure

Phase 2: Execute Rotation
├─ Create new database user role with new password (PostgreSQL):
│  └─ CREATE ROLE app_user_green WITH LOGIN PASSWORD 'new_secure_password';
│  └─ GRANT ALL PRIVILEGES ON DATABASE youtube_bookmarks TO app_user_green;
│
├─ Verify new user connectivity (test connections to database)
│
├─ Update application config with new password:
│  ├─ Point to vault secret version N+1
│  ├─ Restart connection pool (recycle existing connections gracefully)
│  └─ Monitor: 10-15 second switchover window
│
├─ Monitor connection states (PostgreSQL pg_stat_activity view)
│  ├─ New connections: Using green password (should show immediately)
│  ├─ Old connections: Using blue password (drain over 5-10 minutes)
│  └─ Alert if connections don't drain: Force close after grace period

Phase 3: Verification
├─ Health checks: All services operational
├─ Database operations: Read/write success
├─ WebSocket connections: Real-time updates working
├─ ARQ workers: Video processing continues
├─ Error logs: No auth-related errors spike

Phase 4: Cleanup
├─ After grace period (default: 15 minutes):
│  └─ DROP ROLE app_user_blue; -- Old user no longer needed
│
├─ Archive old password in audit log
├─ Document rotation completion with timestamps
└─ Update secret versioning metadata
```

#### Code Example: Database Password Rotation Script

```python
#!/usr/bin/env python3
"""
Database password rotation with zero-downtime switchover.

Handles blue/green password rotation for PostgreSQL database user.
Maintains dual-password state during transition period.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
import secrets
import string

import asyncpg
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

logger = logging.getLogger(__name__)

class DatabasePasswordRotator:
    """Manages zero-downtime database password rotation."""
    
    def __init__(
        self,
        admin_connection_string: str,  # Connection as postgres admin
        vault_client,  # Reference to vault client
        app_user: str = "youtube_bookmarks_user",
        grace_period_seconds: int = 900  # 15 minutes
    ):
        self.admin_connection_string = admin_connection_string
        self.vault_client = vault_client
        self.app_user = app_user
        self.grace_period_seconds = grace_period_seconds
    
    def generate_secure_password(self, length: int = 32) -> str:
        """Generate cryptographically secure random password."""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    async def get_current_connections_count(self, engine) -> int:
        """Get count of active connections using current password."""
        async with engine.begin() as conn:
            result = await conn.execute(
                text("""
                    SELECT COUNT(*) as conn_count
                    FROM pg_stat_activity
                    WHERE usename = :user
                """),
                {"user": self.app_user}
            )
            row = result.first()
            return row[0] if row else 0
    
    async def rotate_password(self) -> bool:
        """
        Execute complete password rotation workflow.
        
        Returns:
            bool: True if successful, False if rotation failed (check logs for rollback)
        """
        rotation_id = datetime.utcnow().isoformat()
        logger.info(f"Starting database password rotation: {rotation_id}")
        
        try:
            # Phase 1: Generate and store new password
            new_password = self.generate_secure_password()
            vault_response = self.vault_client.create_secret_version(
                secret_id="db-password",
                metadata={
                    "rotation_id": rotation_id,
                    "rotation_timestamp": datetime.utcnow().isoformat(),
                    "old_password": "***hidden***",  # Never log actual password
                    "new_password": "***hidden***",
                    "status": "in_progress"
                }
            )
            logger.info(f"New password version created in vault: {vault_response['version']}")
            
            # Phase 2: Create admin connection and update database password
            admin_engine = create_async_engine(
                self.admin_connection_string,
                echo=False
            )
            
            try:
                async with admin_engine.begin() as conn:
                    # Update user password (PostgreSQL allows this while connections active)
                    await conn.execute(
                        text(f"ALTER ROLE {self.app_user} WITH PASSWORD :pwd"),
                        {"pwd": new_password}
                    )
                    logger.info(f"Password updated for user {self.app_user}")
                
                # Phase 3: Monitor connection drain with timeout
                grace_deadline = datetime.utcnow() + timedelta(
                    seconds=self.grace_period_seconds
                )
                app_engine = create_async_engine(
                    self.admin_connection_string.replace(
                        "postgres", self.app_user
                    )  # Switch to app user
                )
                
                while datetime.utcnow() < grace_deadline:
                    conn_count = await self.get_current_connections_count(admin_engine)
                    logger.info(f"Active connections: {conn_count}")
                    
                    if conn_count <= 1:  # Only admin connection left
                        logger.info("All app connections have drained successfully")
                        break
                    
                    await asyncio.sleep(10)  # Check every 10 seconds
                
                # Phase 4: Cleanup old connections if still present after grace period
                async with admin_engine.begin() as conn:
                    conn_count = await self.get_current_connections_count(admin_engine)
                    if conn_count > 1:
                        logger.warning(
                            f"Forcing termination of {conn_count} remaining connections"
                        )
                        await conn.execute(
                            text("""
                                SELECT pg_terminate_backend(pid)
                                FROM pg_stat_activity
                                WHERE usename = :user AND pid != pg_backend_pid()
                            """),
                            {"user": self.app_user}
                        )
                
                # Phase 5: Verify new password works
                test_engine = create_async_engine(
                    f"postgresql+asyncpg://{self.app_user}:password@localhost/youtube_bookmarks"
                )
                async with test_engine.begin() as conn:
                    await conn.execute(text("SELECT 1"))
                logger.info("Verification successful: new password works")
                
                # Phase 6: Update vault status to completed
                self.vault_client.update_secret_metadata(
                    secret_id="db-password",
                    metadata={
                        **vault_response['metadata'],
                        "status": "completed"
                    }
                )
                logger.info(f"Password rotation completed successfully: {rotation_id}")
                return True
                
            finally:
                await admin_engine.dispose()
                await app_engine.dispose()
                await test_engine.dispose()
        
        except Exception as e:
            logger.error(f"Password rotation failed: {e}")
            # Update vault status to failed for manual remediation
            try:
                self.vault_client.update_secret_metadata(
                    secret_id="db-password",
                    metadata={"status": "failed", "error": str(e)}
                )
            except:
                pass
            raise

# Example usage in scheduled rotation task
async def scheduled_database_rotation():
    """Run from scheduled job (e.g., weekly via Celery/APScheduler)."""
    rotator = DatabasePasswordRotator(
        admin_connection_string="postgresql+asyncpg://postgres:admin_pass@localhost/youtube_bookmarks",
        vault_client=VaultClient(),  # Your vault implementation
        grace_period_seconds=900
    )
    await rotator.rotate_password()
```

#### Failover & Rollback Procedure

If rotation fails mid-process:

1. **Immediate:** All connections will fail - system is down (acceptable, brief)
2. **Recovery (manual):**
   ```sql
   -- As postgres admin, revert to previous password
   ALTER ROLE youtube_bookmarks_user WITH PASSWORD 'old_password_from_vault';
   ```
3. **Prevention:** Test rotation in staging environment first
4. **Monitoring:** Alert on connection failures during rotation window

#### Performance Impact

- **Switchover window:** 10-15 seconds (application sees no queries during this window)
- **Connection drain:** 5-10 minutes (old connections naturally close)
- **Total maintenance window:** ~15-20 minutes for complete rotation
- **Recommended frequency:** Weekly or every 2 weeks (depends on risk profile)

---

### 2. JWT Secret Rotation (Dual-Key Strategy)

**Files:**
- `docs/plans/tasks/task-149-secret-rotation-strategy.md` (this file)
- `backend/scripts/rotate_jwt_secret.py` (to be created)
- `backend/app/core/config.py` (modify to support key versioning)

**Action:** Document JWT secret rotation that maintains backward compatibility with active tokens using multi-key validation.

#### Strategy Overview

Unlike database passwords, JWT tokens contain embedded claims and are signed at issuance time. Simply changing the signing key would invalidate all active tokens immediately. Solution: **Dual-key strategy with key versioning.**

**Key Concept:** JWT `kid` (Key ID) header field identifies which secret was used for signing.

```
Old Implementation (Single Key):
├─ Issue token: sign with SECRET_V1
├─ Verify token: check against SECRET_V1
└─ Problem: Rotating secret invalidates all tokens immediately

New Implementation (Dual-Key):
├─ Keys: SECRET_V1 (current), SECRET_V2 (next)
├─ Issue token: sign with SECRET_V1, add "kid": "1" header
├─ Verify token: try SECRET_V1 first, fall back to SECRET_V2
├─ Rotate: Move SECRET_V2 to PRIMARY, generate SECRET_V3 as next
└─ Benefit: Active tokens remain valid during rotation
```

#### Step-by-Step Procedure

```
Phase 1: Setup (One-time)
├─ Generate initial SECRET_V1 (32+ bytes, cryptographically random)
├─ Store in vault with key_id="1" and is_active=True
└─ Update config to support multiple keys in decode

Phase 2: Rotation Cycle (Every 30 days or per policy)
├─ Phase 2a: Pre-rotation
│  ├─ Generate SECRET_V2 (same spec as V1)
│  ├─ Store in vault with key_id="2" and is_active=False
│  └─ Deploy code update if key management code changed
│
├─ Phase 2b: Switchover
│  ├─ Update config: PRIMARY_KEY_ID = "2" (without redeploying)
│  ├─ New tokens signed with SECRET_V2 (kid="2")
│  ├─ Old tokens with kid="1" still validate using SECRET_V1
│  └─ Both keys remain in vault during transition
│
├─ Phase 2c: Transition Window (48-72 hours typically)
│  ├─ Monitor token distribution
│  ├─ Track kid="1" token usage in logs
│  ├─ Ensure majority of tokens now use kid="2"
│  └─ Alert on any auth failures (indicates clients using old tokens)
│
└─ Phase 2d: Cleanup
   ├─ After transition window: Remove SECRET_V1 from vault
   ├─ Rotate SECRET_V2 → SECRET_V3 (prepare for next rotation)
   ├─ Update config: OLD_KEYS = [SECRET_V1_id]
   └─ Archive old key with decommission timestamp
```

#### Code Example: JWT Multi-Key Configuration

```python
"""
JWT multi-key configuration supporting rotation without token invalidation.

Uses key versioning to allow old tokens to remain valid during rotation.
"""

from typing import Optional, Dict, List
from datetime import datetime, timedelta
import os
from pydantic import field_validator
from pydantic_settings import BaseSettings

class JWTKeyInfo:
    """Information about a JWT secret key."""
    
    def __init__(
        self,
        key_id: str,
        secret: str,
        created_at: datetime,
        rotated_at: Optional[datetime] = None,
        is_active: bool = False,
        algorithm: str = "HS256"
    ):
        self.key_id = key_id
        self.secret = secret
        self.created_at = created_at
        self.rotated_at = rotated_at
        self.is_active = is_active
        self.algorithm = algorithm

class JWTSettings(BaseSettings):
    """JWT configuration with multi-key rotation support."""
    
    # Current signing key (used for NEW tokens)
    jwt_primary_key_id: str = "1"
    
    # All valid keys (loaded from vault or env)
    jwt_secrets: Dict[str, str] = {
        "1": "your-secret-v1-change-in-production",
        # "2": "your-secret-v2-loaded-from-vault-during-rotation"
    }
    
    # Metadata about keys (when rotated, expiry info)
    jwt_key_metadata: Dict[str, Dict] = {
        "1": {
            "created_at": datetime.utcnow().isoformat(),
            "algorithm": "HS256",
            "status": "active"
        }
    }
    
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    
    @field_validator("jwt_primary_key_id")
    @classmethod
    def validate_primary_key_exists(cls, v, info) -> str:
        """Ensure primary key ID exists in secrets dict."""
        secrets = info.data.get("jwt_secrets", {})
        if v not in secrets:
            raise ValueError(
                f"Primary key ID '{v}' not found in jwt_secrets. "
                f"Available keys: {list(secrets.keys())}"
            )
        return v
    
    def get_signing_key(self) -> tuple[str, str]:
        """
        Get the current signing key and its ID.
        
        Returns:
            tuple: (key_id, secret_value)
        """
        key_id = self.jwt_primary_key_id
        secret = self.jwt_secrets.get(key_id)
        if not secret:
            raise ValueError(f"Signing key '{key_id}' not found in secrets")
        return key_id, secret
    
    def get_verification_keys(self) -> Dict[str, str]:
        """
        Get all keys that can verify tokens (current + old keys).
        
        Used during token verification to support rotation.
        """
        return self.jwt_secrets.copy()
    
    def rotate_key(self, new_key_id: str, new_secret: str) -> None:
        """
        Rotate JWT signing key without invalidating active tokens.
        
        Args:
            new_key_id: ID for the new key (e.g., "2", "3", etc)
            new_secret: The new secret value (32+ bytes)
        
        Process:
            1. Add new key to secrets dict
            2. Update primary key ID (for new tokens)
            3. Keep old key in dict (for token verification)
        """
        # Validate new key
        if len(new_secret) < 32:
            raise ValueError(f"New secret must be at least 32 bytes (got {len(new_secret)})")
        
        if new_key_id in self.jwt_secrets:
            raise ValueError(f"Key ID '{new_key_id}' already exists")
        
        # Add new key to available keys
        self.jwt_secrets[new_key_id] = new_secret
        
        # Update metadata
        self.jwt_key_metadata[new_key_id] = {
            "created_at": datetime.utcnow().isoformat(),
            "algorithm": self.jwt_algorithm,
            "status": "active"
        }
        
        # Switch primary key ID for new tokens
        old_key_id = self.jwt_primary_key_id
        self.jwt_primary_key_id = new_key_id
        
        # Mark old key as rotated (but keep for verification)
        self.jwt_key_metadata[old_key_id]["status"] = "rotated"
        self.jwt_key_metadata[old_key_id]["rotated_at"] = datetime.utcnow().isoformat()
        
        logger.info(
            f"JWT key rotated: {old_key_id} → {new_key_id}. "
            f"Old key still validates existing tokens."
        )
    
    def decommission_key(self, key_id: str, after_days: int = 7) -> None:
        """
        Schedule decommissioning of an old key.
        
        Args:
            key_id: Key ID to decommission
            after_days: Days to wait before actual removal
        
        This prevents sudden token validation failures if old tokens
        are still being used.
        """
        if key_id not in self.jwt_key_metadata:
            raise ValueError(f"Key ID '{key_id}' not found")
        
        self.jwt_key_metadata[key_id]["decommission_after"] = (
            datetime.utcnow() + timedelta(days=after_days)
        ).isoformat()
        self.jwt_key_metadata[key_id]["status"] = "decommissioning"
        
        logger.info(
            f"Key {key_id} scheduled for decommissioning after {after_days} days"
        )

# Token creation with key ID
def create_access_token(
    data: dict,
    settings: JWTSettings,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create JWT token with key ID header for rotation support.
    
    Args:
        data: Payload data
        settings: JWT settings with key info
        expires_delta: Token expiration time
    
    Returns:
        Encoded JWT token string
    """
    import jwt
    
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.jwt_expire_minutes
        )
    
    to_encode.update({"exp": expire})
    
    # Get current signing key
    key_id, secret = settings.get_signing_key()
    
    # Encode with key ID in header for identification during verification
    encoded_jwt = jwt.encode(
        to_encode,
        secret,
        algorithm=settings.jwt_algorithm,
        headers={"kid": key_id}  # Key ID header
    )
    
    return encoded_jwt

# Token verification with multi-key support
def verify_access_token(
    token: str,
    settings: JWTSettings
) -> dict:
    """
    Verify JWT token using any valid key (supports rotation).
    
    Args:
        token: JWT token string to verify
        settings: JWT settings with all valid keys
    
    Returns:
        Decoded token payload
    
    Raises:
        JWTError: If token cannot be verified with any key
    """
    import jwt
    
    # Try to decode without verification to get the key ID
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")
    except jwt.DecodeError as e:
        raise jwt.JWTError(f"Invalid token format: {e}")
    
    # Try primary key first (optimization)
    verification_keys = settings.get_verification_keys()
    
    errors = []
    
    # Try the key ID from token header first
    if kid and kid in verification_keys:
        try:
            payload = jwt.decode(
                token,
                verification_keys[kid],
                algorithms=[settings.jwt_algorithm]
            )
            return payload
        except jwt.JWTError as e:
            errors.append(f"Failed with key {kid}: {e}")
    
    # Fall back to trying all available keys
    for key_id, secret in verification_keys.items():
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=[settings.jwt_algorithm]
            )
            logger.debug(f"Token verified with key ID: {key_id}")
            return payload
        except jwt.JWTError as e:
            errors.append(f"Key {key_id}: {e}")
    
    # If we get here, token couldn't be verified with any key
    raise jwt.JWTError(
        f"Token could not be verified with any available key. Errors: {errors}"
    )
```

#### Rotation Script

```python
#!/usr/bin/env python3
"""
JWT secret key rotation without token invalidation.

Maintains dual-key state allowing old tokens to remain valid.
"""

import secrets
import logging
from app.core.config import JWTSettings
from app.clients.vault import VaultClient

logger = logging.getLogger(__name__)

class JWTSecretRotator:
    """Manages JWT secret rotation with zero token invalidation."""
    
    def __init__(self, settings: JWTSettings, vault_client: VaultClient):
        self.settings = settings
        self.vault_client = vault_client
    
    def generate_new_key(self) -> str:
        """Generate new JWT secret (32 bytes = 256 bits for HS256)."""
        return secrets.token_urlsafe(32)
    
    def get_next_key_id(self) -> str:
        """Get next key ID (increment numeric ID)."""
        current_id = int(self.settings.jwt_primary_key_id)
        return str(current_id + 1)
    
    async def rotate_jwt_secret(self) -> bool:
        """
        Execute JWT secret rotation.
        
        Process:
        1. Generate new secret
        2. Store in vault
        3. Update config to accept new key
        4. After transition period: remove old key
        """
        try:
            # Phase 1: Generate new secret
            new_secret = self.generate_new_key()
            new_key_id = self.get_next_key_id()
            
            logger.info(f"Rotating JWT secret: new key ID = {new_key_id}")
            
            # Phase 2: Store in vault
            vault_response = self.vault_client.store_jwt_secret(
                key_id=new_key_id,
                secret=new_secret,
                metadata={
                    "created_at": datetime.utcnow().isoformat(),
                    "rotation_cycle": "weekly",
                    "algorithm": "HS256"
                }
            )
            
            logger.info(f"New JWT secret stored in vault: {vault_response}")
            
            # Phase 3: Update configuration (in-memory, no restart needed)
            self.settings.rotate_key(new_key_id, new_secret)
            
            logger.info(
                f"JWT key rotation complete. "
                f"Old key ID {self.settings.jwt_primary_key_id - 1} "
                f"still validates existing tokens."
            )
            
            return True
        
        except Exception as e:
            logger.error(f"JWT rotation failed: {e}")
            raise

# Schedule rotation
async def scheduled_jwt_rotation():
    """Run from scheduled job (e.g., weekly via APScheduler)."""
    rotator = JWTSecretRotator(
        settings=settings,
        vault_client=VaultClient()
    )
    await rotator.rotate_jwt_secret()
```

#### Key Decommissioning

After transition window (typically 48-72 hours):

```python
async def cleanup_old_jwt_keys():
    """Remove old JWT keys after transition period."""
    rotator = JWTSecretRotator(settings=settings, vault_client=vault)
    
    for key_id, metadata in settings.jwt_key_metadata.items():
        if metadata.get("status") != "decommissioning":
            continue
        
        decommission_date = datetime.fromisoformat(
            metadata.get("decommission_after")
        )
        if datetime.utcnow() > decommission_date:
            # Safe to remove old key
            del settings.jwt_secrets[key_id]
            vault.delete_secret(f"jwt-key-{key_id}")
            logger.info(f"Decommissioned JWT key {key_id}")
```

#### Token Migration Monitoring

Monitor during rotation to ensure clients are getting new tokens:

```python
# Log token key IDs during verification (add to verify_access_token)
logger.info(f"Token verified with key_id: {kid}, current_primary_key_id: {settings.jwt_primary_key_id}")

# Metrics to track:
# - Percentage of tokens with old key ID (should decrease over time)
# - Auth failures per minute (should remain stable)
# - Average token age (verify migration is working)
```

---

### 3. API Key Rotation (Graceful Deprecation)

**Files:**
- `docs/plans/tasks/task-149-secret-rotation-strategy.md` (this file)
- `backend/scripts/rotate_api_keys.py` (to be created)
- `backend/app/api/keys.py` (modify to support key versioning)

**Action:** Document API key rotation with dual-key acceptance and graceful deprecation timeline.

#### Strategy Overview

API keys are used by external services (YouTube API, Gemini API) to authenticate requests. Unlike JWT tokens, we control both sides of the equation, so we can implement a simple versioning strategy:

**Dual-Key Acceptance Pattern:**
1. Issue new key to external service
2. Accept BOTH old and new keys during transition period
3. After transition: only accept new key

**Timeline:**
- Day 1: Issue new key, service starts using it
- Days 1-7: Accept both keys, monitor old key usage
- Day 7: Monitor logs, verify old key no longer in use
- Day 8: Disable old key (or delete if retention complete)

#### Step-by-Step Procedure

```
Phase 1: Pre-Rotation (1 week before)
├─ Review API key usage in logs (which services use which keys)
├─ Identify rotation window (typically Friday afternoon → Monday morning)
├─ Notify external service operators (if applicable)
└─ Test rotation procedure in staging environment

Phase 2: Generate & Distribute New Key
├─ Generate new key (random, 32+ bytes, URL-safe base64)
├─ Store in vault with status=pending_activation
├─ Send new key to service operator via secure channel
├─ Request confirmation of receipt
└─ Set activation date (typically next day)

Phase 3: Activate New Key (Dual-Key Window)
├─ Deploy code update: Accept both keys in validation logic
├─ Monitor logs for both old and new key usage
│  └─ Alert if ONLY old key still used after 24 hours
├─ Dashboard: Show which keys are active, usage stats
├─ Duration: 7 days (default, adjustable per service)
└─ Target: See 100% traffic using new key

Phase 4: Deprecate Old Key
├─ Monitor: Confirm new key in full use (>99% traffic)
├─ Option A: Log-only deprecation (log warnings but still accept)
├─ Option B: Hard deprecation (reject old key)
├─ Send notification to service operator
├─ Keep old key disabled for 30 days (emergency rollback window)
└─ Archive old key in vault with decommission timestamp

Phase 5: Final Cleanup
├─ After 30-day emergency window:
│  ├─ Delete old key from active rotation list
│  ├─ Archive in cold storage (for audit trail)
│  └─ Update documentation
└─ Metrics: Document rotation duration, issues encountered
```

#### Code Example: Dual-Key API Key Validation

```python
"""
API key validation with dual-key support for rotation.

Accepts multiple API keys during rotation to prevent service disruption.
"""

from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta
import secrets
import base64
from enum import Enum

class KeyStatus(str, Enum):
    """Status of an API key during its lifecycle."""
    ACTIVE = "active"
    ROTATING = "rotating"  # Old key, being phased out
    DISABLED = "disabled"
    ARCHIVED = "archived"

class APIKeyMetadata:
    """Metadata about an API key."""
    
    def __init__(
        self,
        key_id: str,
        service_name: str,  # "youtube_api", "gemini_api", etc.
        created_at: datetime,
        status: KeyStatus = KeyStatus.ACTIVE,
        expires_at: Optional[datetime] = None,
        rotated_from: Optional[str] = None,  # Previous key ID
        deprecation_date: Optional[datetime] = None
    ):
        self.key_id = key_id
        self.service_name = service_name
        self.created_at = created_at
        self.status = status
        self.expires_at = expires_at
        self.rotated_from = rotated_from
        self.deprecation_date = deprecation_date
    
    def is_valid(self) -> bool:
        """Check if key is valid for use."""
        if self.status == KeyStatus.DISABLED:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True
    
    def is_deprecated(self) -> bool:
        """Check if key is in deprecation period."""
        return self.status == KeyStatus.ROTATING

class APIKeyValidator:
    """Validates API keys with multi-version support."""
    
    def __init__(self, vault_client):
        self.vault_client = vault_client
        self.key_cache: Dict[str, Tuple[bytes, APIKeyMetadata]] = {}
    
    def validate_youtube_api_key(self, provided_key: str) -> bool:
        """
        Validate YouTube API key (internal use only).
        
        Returns True if:
        - Key matches ACTIVE youtube API key, OR
        - Key matches old key in ROTATING status
        """
        return self._validate_api_key(provided_key, "youtube_api")
    
    def validate_gemini_api_key(self, provided_key: str) -> bool:
        """
        Validate Gemini API key (internal use only).
        
        Similar to YouTube validation but for Gemini service.
        """
        return self._validate_api_key(provided_key, "gemini_api")
    
    def _validate_api_key(self, provided_key: str, service_name: str) -> bool:
        """
        Internal validation logic for any service API key.
        
        Accepts both ACTIVE and ROTATING keys to support rotation.
        """
        try:
            # Get all valid keys for this service from vault
            keys_data = self.vault_client.get_service_keys(service_name)
            
            for key_entry in keys_data:
                key_value = key_entry['key']
                metadata = APIKeyMetadata(**key_entry['metadata'])
                
                # Check if key is valid for verification
                if not metadata.is_valid():
                    continue  # Skip expired or disabled keys
                
                # Constant-time comparison (prevent timing attacks)
                if self._constant_time_compare(provided_key, key_value):
                    # Log usage of deprecated keys
                    if metadata.is_deprecated():
                        logger.warning(
                            f"Request using deprecated API key "
                            f"(service={service_name}, key_id={metadata.key_id}). "
                            f"Deprecation date: {metadata.deprecation_date}. "
                            f"Please rotate to new key."
                        )
                    
                    return True
            
            return False
        
        except Exception as e:
            logger.error(f"API key validation error: {e}")
            return False
    
    @staticmethod
    def _constant_time_compare(a: str, b: str) -> bool:
        """
        Compare two strings in constant time to prevent timing attacks.
        """
        import hmac
        return hmac.compare_digest(a.encode(), b.encode())
    
    def rotate_api_key(
        self,
        service_name: str,
        new_key: Optional[str] = None,
        grace_period_days: int = 7
    ) -> Dict:
        """
        Rotate API key for a service.
        
        Args:
            service_name: Name of the service (e.g., "youtube_api")
            new_key: New key value. If None, generates one.
            grace_period_days: Days to accept both old and new keys
        
        Returns:
            Dictionary with rotation details
        """
        # Generate new key if not provided
        if not new_key:
            new_key = self._generate_api_key()
        
        # Get current active key
        current_key_data = self.vault_client.get_active_service_key(service_name)
        current_key_id = current_key_data['metadata']['key_id']
        
        # Generate new key ID
        new_key_id = f"{service_name}_v{self._get_next_version(service_name)}"
        
        # Store new key in vault as ACTIVE
        self.vault_client.store_service_key(
            service_name=service_name,
            key_id=new_key_id,
            key_value=new_key,
            metadata={
                "created_at": datetime.utcnow().isoformat(),
                "status": KeyStatus.ACTIVE,
                "rotated_from": current_key_id
            }
        )
        
        # Mark current key as ROTATING (transitional period)
        deprecation_date = datetime.utcnow() + timedelta(days=grace_period_days)
        current_metadata = current_key_data['metadata']
        current_metadata['status'] = KeyStatus.ROTATING
        current_metadata['deprecation_date'] = deprecation_date.isoformat()
        
        self.vault_client.update_service_key_metadata(
            service_name=service_name,
            key_id=current_key_id,
            metadata=current_metadata
        )
        
        logger.info(
            f"API key rotation initiated for {service_name}: "
            f"{current_key_id} → {new_key_id}. "
            f"Grace period: {grace_period_days} days. "
            f"Old key will be disabled on {deprecation_date.isoformat()}"
        )
        
        return {
            "service": service_name,
            "old_key_id": current_key_id,
            "new_key_id": new_key_id,
            "grace_period_days": grace_period_days,
            "deprecation_date": deprecation_date.isoformat(),
            "new_key": new_key  # Return for distribution to service
        }
    
    @staticmethod
    def _generate_api_key(length: int = 32) -> str:
        """Generate cryptographically secure random API key."""
        return base64.urlsafe_b64encode(secrets.token_bytes(length)).decode('utf-8')
    
    @staticmethod
    def _get_next_version(service_name: str) -> int:
        """Get next version number for API key."""
        # In real implementation, query vault for current version
        # This is simplified version
        return 1

# Rotation script
async def rotate_all_api_keys():
    """Rotate all external API keys (scheduled task)."""
    validator = APIKeyValidator(vault_client=VaultClient())
    
    services = ["youtube_api", "gemini_api"]
    for service in services:
        try:
            result = validator.rotate_api_key(
                service_name=service,
                grace_period_days=7
            )
            logger.info(f"Rotated {service}: {result['new_key_id']}")
        except Exception as e:
            logger.error(f"Failed to rotate {service}: {e}")
            # Continue with next service instead of failing completely
            continue

# Monitoring: Track deprecated key usage
async def monitor_key_deprecation():
    """Monitor usage of deprecated keys and alert if not migrated."""
    # Parse logs for API key usage
    # If deprecated key usage > 1% after grace_period - 1 day, alert ops team
    pass
```

#### Integration into FastAPI

```python
from fastapi import FastAPI, Header, HTTPException, status
from app.api.api_key_validator import APIKeyValidator

app = FastAPI()
validator = APIKeyValidator(vault_client=VaultClient())

@app.post("/api/process-video")
async def process_video(
    x_api_key: str = Header(..., description="API Key for YouTube processing")
):
    """
    Process video (requires valid API key).
    
    Accepts both current and deprecated API keys during rotation.
    """
    if not validator.validate_youtube_api_key(x_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key"
        )
    
    # Process video...
    return {"status": "processing"}
```

---

## 4. Rotation Schedules & Compliance Matrix

**Files:**
- `docs/plans/tasks/task-149-secret-rotation-strategy.md` (this file)
- `backend/scripts/rotation_scheduler.py` (to be created)

**Action:** Define rotation frequencies based on compliance requirements and risk assessment.

### Rotation Schedule

| Secret Type | Default Frequency | Justification | Compliance | Alert on Overdue |
|-------------|-------------------|---------------|-----------|-----------------|
| **DB Password** | Weekly | Database contains all user data; high-value target | GDPR, SOC2, ISO27001 | 8 days |
| **JWT Secret** | Monthly | Tokens self-contain claims; lower compromise impact | OWASP, NIST SP 800-57 | 35 days |
| **YouTube API Key** | Monthly | External service; moderate impact if compromised | SOC2, OWASP | 35 days |
| **Gemini API Key** | Monthly | External service; moderate impact if compromised | SOC2, OWASP | 35 days |
| **Redis Password** | Quarterly | Cache only; no persistent data; lower priority | GDPR | 100 days |

### Compliance Requirements Matrix

| Regulation | Requirements | Implementation |
|-----------|--------------|-----------------|
| **GDPR** | "Maintain detailed inventory of all processing activities"; "Implement security measures to protect personal data" | ✅ Vault audit logs; Quarterly key rotation review; Encrypted storage |
| **SOC2** | "Regular rotation of security credentials"; "Monitoring and alerting for unauthorized access" | ✅ Weekly DB password rotation; Real-time monitoring of failed auth; Alert on rotation failures |
| **ISO 27001** | "Change management procedures"; "Cryptographic key management"; "Physical/logical access controls" | ✅ Rotation scripts with change tracking; Vault versioning; RBAC for key access |
| **OWASP** | "Secrets should have limited lifetime"; "Automatic rotation recommended"; "Key compromise procedures" | ✅ Automated rotation; Monitoring; Rollback procedures documented |
| **NIST SP 800-57** | "Cryptographic keys should be retired when no longer needed"; "Key replacement recommended before exhaustion" | ✅ Key decommissioning procedures; Proactive rotation before key-age limits |
| **HIPAA** | "Encryption and key management required if handling health data" | ✅ Applicable if expanding to health-related data; Use same patterns |
| **PCI DSS** | "Change default security parameters"; "Restrict access to cryptographic keys"; "Rotate keys annually at minimum" | ✅ Vault-based access control; Annual minimum > our weekly/monthly schedule |

---

## 🧪 Testing Strategy

**Unit Tests:**
- Database password rotation: Test password generation, validation, and connection fallover
- JWT rotation: Test multi-key validation, token verification with old/new keys
- API key rotation: Test graceful deprecation, dual-key acceptance, key versioning
- Vault integration: Test secret storage, retrieval, versioning

**Integration Tests:**
- End-to-end password rotation: Rotate DB password while active connections exist
- JWT token verification: Create tokens with old key, verify after rotation
- API endpoint validation: Call endpoints with deprecated API keys during grace period
- Failure scenarios: Vault unavailable, rotation fails mid-process, key corrupted

**Manual Testing:**
1. Rotate database password in staging; verify zero connection loss
2. Rotate JWT secret; verify old tokens still validate; verify new tokens issued with new key ID
3. Rotate API key; verify both old and new accepted during grace period; verify metrics show migration
4. Simulate vault outage during rotation; verify graceful failure with documented recovery
5. Test rollback procedures; verify system recovers to previous key state

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` - Phase 2 overview
- `docs/plans/tasks/task-148-vault-integration-documentation.md` - Vault setup (prerequisite)

**Related Code:**
- `backend/app/core/config.py` - Settings management
- `backend/app/api/deps.py` - JWT token dependency
- `backend/app/clients/vault.py` - Vault client (to be created in Task #148)

**Design Decisions:**

1. **Why Dual-Key Pattern for JWT?**
   - JWT tokens are immutable once issued
   - Simply rotating key would invalidate all active tokens
   - Multi-key support allows graceful transitions without user disruption
   - Standard pattern used by major auth providers (Auth0, Okta, etc.)

2. **Why Blue/Green for Database?**
   - PostgreSQL allows multiple valid passwords per user
   - Enables atomic switchover with minimal downtime
   - Connection pools can be updated without closing connections
   - Aligns with infrastructure best practices for zero-downtime deployments

3. **Why Grace Period for API Keys?**
   - External services may cache keys in memory
   - Grace period prevents sudden rejection of valid requests
   - Allows monitoring of migration before hard cutoff
   - Reduces risk of cascading failures in dependent services

4. **Rotation Frequencies - Why Not More Often?**
   - Weekly DB rotation: Good balance between security and operational complexity
   - Monthly JWT/API key rotation: Sufficient; most compromises detected within days anyway
   - Quarterly Redis rotation: Cache-only, lower risk; less operational burden
   - Industry benchmarks: Most companies rotate weekly-quarterly based on risk level

5. **Why Vault-Centric Approach?**
   - Single source of truth for all secrets
   - Automatic audit logging of access
   - Version history for rollback
   - Policy-based access control
   - Enables rotation without code changes (config-driven)

---

## 📋 Production Rollout Checklist

- [ ] Vault infrastructure deployed and tested (Task #148)
- [ ] Rotation scripts written and tested in staging environment
- [ ] Monitoring and alerting configured for rotation events
- [ ] Team trained on rotation procedures and rollback steps
- [ ] Run full rotation cycle in staging (all 3 secret types)
- [ ] Document any issues encountered and update procedures
- [ ] Establish baseline metrics (rotation duration, success rate)
- [ ] Deploy rotation automation to production
- [ ] Execute first production rotation under supervision
- [ ] Monitor logs and metrics during first rotation
- [ ] Adjust grace periods/schedules based on observed behavior
- [ ] Document lessons learned and update playbooks
- [ ] Schedule recurring rotations in calendar/monitoring system
- [ ] Create audit report of rotation activity
