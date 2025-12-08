# Backward Compatibility: Data Migration & User Transition

## Overview

**Risiko-Level:** Niedrig (nur Entwicklungsdaten)

Da nur Test-Daten existieren, ist die Migration unkompliziert. Trotzdem dokumentieren wir einen robusten Prozess, der auch für Produktionsdaten funktionieren würde.

---

## Existing Data Inventory

### Current Test User

```sql
-- Existierender User (aus Migration)
SELECT * FROM users WHERE email = 'test@example.com';

-- Ergebnis:
-- id: <uuid>
-- email: test@example.com
-- hashed_password: $2b$12$placeholder_hash
-- is_active: true
-- created_at: <timestamp>
```

### Related Data

| Table | Records | Owner |
|-------|---------|-------|
| `bookmark_lists` | X Listen | test@example.com |
| `videos` | Y Videos | via bookmark_lists |
| `tags` | Z Tags | test@example.com |
| `channels` | N Channels | test@example.com |
| `custom_fields` | via lists | indirect |
| `field_schemas` | via lists | indirect |

---

## Migration Scenarios

### Scenario 1: Fresh Start (Empfohlen für Dev)

**Wann:** Keine wichtigen Testdaten vorhanden

```sql
-- Option A: Truncate all data
TRUNCATE users CASCADE;

-- Oder Option B: Reset nur user-owned data
DELETE FROM users WHERE email = 'test@example.com';
-- CASCADE löscht alle abhängigen Daten
```

**Pro:** Sauberer Start
**Con:** Alle Testdaten weg

### Scenario 2: Test User Migration (Daten behalten)

**Wann:** Testdaten sollen erhalten bleiben

**Prozess:**
1. User registriert sich bei Clerk mit `test@example.com`
2. Backend erkennt existierende Email
3. Existierender User wird mit `clerk_id` verknüpft
4. Alle Daten bleiben erhalten

```python
# In get_or_create_user()
async def get_or_create_user(claims: dict, db: AsyncSession) -> User:
    clerk_id = claims["sub"]
    email = claims.get("email")

    # Check if email already exists
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # Migration: Link existing user to Clerk
        existing_user.clerk_id = clerk_id
        existing_user.hashed_password = None  # Optional: Clear old password
        await db.commit()
        logger.info(f"Migrated user {email} to Clerk ID {clerk_id}")
        return existing_user

    # ... create new user
```

### Scenario 3: Different Email Registration

**Wann:** Neuer Clerk-User hat andere Email als test@example.com

**Problem:** Test-Daten bleiben beim alten User, neuer User startet leer

**Lösung A:** Manueller Datenübertrag (Admin-Script)

```sql
-- Transfer all data from old to new user
UPDATE bookmark_lists SET user_id = '<new_user_id>'
WHERE user_id = '<old_user_id>';

UPDATE tags SET user_id = '<new_user_id>'
WHERE user_id = '<old_user_id>';

UPDATE channels SET user_id = '<new_user_id>'
WHERE user_id = '<old_user_id>';

-- Delete old user
DELETE FROM users WHERE id = '<old_user_id>';
```

**Lösung B:** Einfach ignorieren (Test-Daten sind nicht wichtig)

---

## Database Migration Script

### Step 1: Schema Migration (Non-Breaking)

```python
# alembic/versions/xxxx_add_clerk_id.py
"""Add clerk_id to users table"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add clerk_id column (nullable initially for existing users)
    op.add_column('users',
        sa.Column('clerk_id', sa.String(255), nullable=True)
    )

    # Create unique index
    op.create_index('ix_users_clerk_id', 'users', ['clerk_id'], unique=True)

    # Make hashed_password nullable (Clerk manages passwords)
    op.alter_column('users', 'hashed_password',
        existing_type=sa.String(),
        nullable=True
    )


def downgrade():
    op.drop_index('ix_users_clerk_id', 'users')
    op.drop_column('users', 'clerk_id')
    op.alter_column('users', 'hashed_password',
        existing_type=sa.String(),
        nullable=False
    )
```

### Step 2: Data Migration (Optional)

```python
# alembic/versions/xxxx_migrate_test_user.py
"""Prepare test user for Clerk migration"""

from alembic import op

def upgrade():
    # Clear placeholder password (security)
    op.execute("""
        UPDATE users
        SET hashed_password = NULL
        WHERE email = 'test@example.com'
        AND hashed_password LIKE '%placeholder%'
    """)


def downgrade():
    pass  # No rollback needed
```

---

## Compatibility Checklist

### Database ✅

- [x] New column `clerk_id` is nullable → existing users unaffected
- [x] `hashed_password` becomes nullable → existing data valid
- [x] No FK changes → all relationships intact
- [x] Indexes preserved → performance unchanged

### API Contracts ✅

- [x] Response models unchanged → frontend compatible
- [x] Request models unchanged → no client changes needed
- [x] New header `Authorization` is optional during migration

### Frontend ✅

- [x] Routes unchanged → bookmarks work
- [x] Components unchanged → UI works
- [x] New provider wraps existing → no internal changes

### WebSocket ✅

- [x] Current token auth still works → gradual migration
- [x] New Clerk token compatible with same endpoint

---

## Rollback Plan

### If Clerk Integration Fails

1. **Feature Flag:** Set `ENABLE_AUTH=false`
2. **Database:** `clerk_id` column stays but is ignored
3. **Frontend:** Remove ClerkProvider, SignedIn/SignedOut
4. **Backend:** Remove auth dependency from endpoints

### Database Rollback

```sql
-- Only if absolutely necessary
ALTER TABLE users DROP COLUMN clerk_id;
ALTER TABLE users ALTER COLUMN hashed_password SET NOT NULL;

-- DANGER: This requires re-setting passwords!
UPDATE users SET hashed_password = 'temp_hash' WHERE hashed_password IS NULL;
```

---

## Graceful Degradation

### During Migration Period

```python
async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Optional auth for gradual migration.

    Returns:
        - User if valid token provided
        - None if no token (legacy behavior)
        - Raises 401 only if invalid token
    """
    if not authorization:
        return None  # Allow unauthenticated

    if not settings.enable_auth:
        return None  # Feature disabled

    try:
        claims = await verify_clerk_jwt(authorization)
        return await get_or_create_user(claims, db)
    except InvalidTokenError:
        raise HTTPException(401, "Invalid token")
```

### Endpoint Pattern During Migration

```python
@router.get("/lists")
async def get_lists(
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    stmt = select(BookmarkList)

    if user:
        # Authenticated: Filter by user
        stmt = stmt.where(BookmarkList.user_id == user.id)
    # Unauthenticated: Return all (legacy)
    # Remove this branch once auth is mandatory!

    result = await db.execute(stmt)
    return result.scalars().all()
```

---

## Testing Compatibility

### Pre-Migration Tests

```python
def test_existing_endpoints_still_work():
    """Ensure no breaking changes to existing API."""
    # All existing tests should pass without modification

def test_database_schema_valid():
    """Ensure migration doesn't break existing data."""
    # Check all FKs still valid
    # Check all existing queries still work
```

### Post-Migration Tests

```python
def test_legacy_user_can_login():
    """Test user with existing email can login via Clerk."""

def test_legacy_data_preserved():
    """Test that lists, videos, tags still exist after login."""

def test_new_user_starts_empty():
    """Test new user has no data."""
```

---

## Versioning Strategy

### API Versioning: NOT NEEDED

- No breaking changes to response models
- No breaking changes to request models
- New `Authorization` header is additive

### Database Versioning: Alembic

```
alembic/versions/
├── xxxx_initial.py
├── xxxx_add_users.py
├── xxxx_add_clerk_id.py      ← New migration
└── xxxx_make_password_nullable.py  ← New migration
```

---

## Summary: Compatibility Guarantees

| Aspect | Guarantee |
|--------|-----------|
| Existing API calls | ✅ Work during migration (feature flag off) |
| Existing database records | ✅ Preserved, linked to Clerk on first login |
| Existing frontend routes | ✅ Work after adding ClerkProvider |
| Existing WebSocket | ✅ Works with both old and new tokens |
| Rollback | ✅ Possible via feature flag |

**Exit Condition:** ✅ Bestehende User/Daten werden nicht beeinträchtigt
