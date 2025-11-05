# Task #58: Create Alembic Migration for Custom Fields System

**Plan Task:** #58
**Wave/Phase:** Custom Fields System - Phase 1 MVP (Backend)
**Dependencies:** None (first task in Custom Fields implementation)

---

## 🎯 Ziel

Erstelle eine Alembic-Migrationsdatei, die 4 neue Datenbanktabellen für das Custom Fields System anlegt (`custom_fields`, `field_schemas`, `schema_fields`, `video_field_values`) und die bestehende `tags`-Tabelle um eine `schema_id`-Spalte erweitert. Die Migration muss PostgreSQL-native Features (UUID, JSONB, CHECK constraints) nutzen und Performance-Indexes für Filtering-Operationen enthalten.

**Erwartetes Ergebnis:**
- Alembic migration file erstellt und getestet
- `alembic upgrade head` läuft fehlerfrei durch
- Alle 4 Tabellen mit korrekten Constraints und Indexes angelegt
- `tags.schema_id` foreign key hinzugefügt
- `alembic downgrade -1` funktioniert (sauberes Rollback)

## 📋 Acceptance Criteria

- [ ] Migration file erstellt mit korrekter Revision ID und down_revision
- [ ] Alle 4 Tabellen (`custom_fields`, `field_schemas`, `schema_fields`, `video_field_values`) angelegt
- [ ] `tags.schema_id` Spalte hinzugefügt mit `ON DELETE SET NULL`
- [ ] CHECK constraint für `field_type` enum ('select', 'rating', 'text', 'boolean')
- [ ] UNIQUE constraints für Duplicate Prevention (`list_id` + `name`, `video_id` + `field_id`, `schema_id` + `field_id`)
- [ ] Performance indexes angelegt (6 indexes total für Filtering und Foreign Keys)
- [ ] CASCADE deletes korrekt konfiguriert (field → values, schema → schema_fields, etc.)
- [ ] Migration getestet: `alembic upgrade head` und `alembic downgrade -1` erfolgreich
- [ ] No SQL errors in PostgreSQL logs
- [ ] README/CLAUDE.md aktualisiert mit Custom Fields Migration Info

---

## 🛠️ Implementation Steps

### 1. Generate Alembic Migration Skeleton
**Files:** `backend/alembic/versions/YYYYMMDD_HHMMSS_add_custom_fields_system.py`
**Action:** Alembic migration skeleton generieren mit `alembic revision`

```bash
cd backend
alembic revision -m "add custom fields system"
```

**Expected Output:**
```
Generating /path/to/backend/alembic/versions/abc123def456_add_custom_fields_system.py ... done
```

**Why:** Alembic generiert automatisch Revision ID und setzt `down_revision` auf die letzte Migration. Manuelle File-Erstellung ist fehleranfällig (falsche Revision IDs).

---

### 2. Implement `custom_fields` Table Creation
**Files:** `backend/alembic/versions/abc123def456_add_custom_fields_system.py`
**Action:** `upgrade()` function implementieren - `custom_fields` Tabelle mit allen Spalten und Constraints

```python
def upgrade():
    # 1. Create custom_fields table
    op.create_table(
        'custom_fields',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('list_id', UUID(as_uuid=True), sa.ForeignKey('bookmarks_lists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('config', JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Unique constraint: field names unique per list (case-sensitive for now)
    op.create_unique_constraint('uq_custom_fields_list_name', 'custom_fields', ['list_id', 'name'])

    # Check constraint: field_type must be one of 4 valid types
    op.create_check_constraint(
        'ck_custom_fields_field_type',
        'custom_fields',
        "field_type IN ('select', 'rating', 'text', 'boolean')"
    )

    # Index for list_id lookups (frequently queried when fetching all fields for a list)
    op.create_index('idx_custom_fields_list_id', 'custom_fields', ['list_id'])
```

**Why:**
- `server_default='gen_random_uuid()'` nutzt PostgreSQL-native UUID generation (schneller als Python uuid4)
- `ondelete='CASCADE'` auf `list_id`: Wenn List gelöscht wird, alle Custom Fields auch löschen
- `config JSONB` statt `JSON`: JSONB ist indexierbar und komprimiert (PostgreSQL Best Practice 2024)
- `server_default='{}'` verhindert NULL values für JSONB column
- CHECK constraint ist **database-level validation** (robuster als nur Pydantic/Python validation)
- UNIQUE constraint `(list_id, name)` verhindert duplicate field names pro Liste

**REF MCP Validation:**
- ✅ SQLAlchemy 2.0 Docs: `ondelete='CASCADE'` auf Foreign Key für automatisches Cleanup
- ✅ PostgreSQL Docs: JSONB bevorzugt über JSON für alle neuen Columns

---

### 3. Implement `field_schemas` Table Creation
**Files:** `backend/alembic/versions/abc123def456_add_custom_fields_system.py`
**Action:** `field_schemas` Tabelle hinzufügen (nach `custom_fields` in `upgrade()`)

```python
    # 2. Create field_schemas table
    op.create_table(
        'field_schemas',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('list_id', UUID(as_uuid=True), sa.ForeignKey('bookmarks_lists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Index for list_id lookups
    op.create_index('idx_field_schemas_list_id', 'field_schemas', ['list_id'])
```

**Why:**
- Keine UNIQUE constraint auf `(list_id, name)` - User kann mehrere Schemas mit gleichem Namen haben (z.B. "Video Quality v1", "Video Quality v2")
- `description TEXT` statt `String(500)` - keine künstliche Längen-Limitierung für Freitext
- Index auf `list_id` für schnelles Fetching aller Schemas einer Liste

---

### 4. Implement `schema_fields` Join Table Creation
**Files:** `backend/alembic/versions/abc123def456_add_custom_fields_system.py`
**Action:** Many-to-Many Join-Tabelle für Schema ↔ Field Relationship

```python
    # 3. Create schema_fields join table (many-to-many)
    op.create_table(
        'schema_fields',
        sa.Column('schema_id', UUID(as_uuid=True), sa.ForeignKey('field_schemas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('field_id', UUID(as_uuid=True), sa.ForeignKey('custom_fields.id', ondelete='CASCADE'), nullable=False),
        sa.Column('display_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('show_on_card', sa.Boolean, nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('schema_id', 'field_id', name='pk_schema_fields')
    )

    # Indexes for both foreign keys (bidirectional lookups)
    op.create_index('idx_schema_fields_schema_id', 'schema_fields', ['schema_id'])
    op.create_index('idx_schema_fields_field_id', 'schema_fields', ['field_id'])
```

**Why:**
- **Composite Primary Key** (`schema_id`, `field_id`) verhindert automatisch Duplicates (ein Field kann nur einmal pro Schema sein)
- **CASCADE deletes auf beiden FKs**: Wenn Schema gelöscht → alle Verknüpfungen weg; wenn Field gelöscht → alle Verknüpfungen weg
- `display_order` für UI Sorting (User kann Fields in Schema anordnen)
- `show_on_card` boolean flag für "Show on Video Card" feature (max 3 sollten true sein, aber Validation in Python/API)
- **Bidirektionale Indexes**: Schema → Fields lookup (häufig) UND Field → Schemas lookup (für "Usage Count" Feature in Phase 2)

**Alternative Considered:** Separate `id` Primary Key + UNIQUE constraint auf (`schema_id`, `field_id`)
**Why Rejected:** Composite PK ist PostgreSQL Best Practice für Join Tables (spart Index, klarer Intent)

---

### 5. Implement `video_field_values` Table Creation
**Files:** `backend/alembic/versions/abc123def456_add_custom_fields_system.py`
**Action:** Tabelle für Video-spezifische Field Values mit typed columns

```python
    # 4. Create video_field_values table
    op.create_table(
        'video_field_values',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('video_id', UUID(as_uuid=True), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('field_id', UUID(as_uuid=True), sa.ForeignKey('custom_fields.id', ondelete='CASCADE'), nullable=False),
        sa.Column('value_text', sa.Text, nullable=True),
        sa.Column('value_numeric', sa.Numeric, nullable=True),  # For ratings (1-5) and any numeric values
        sa.Column('value_boolean', sa.Boolean, nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Unique constraint: one value per field per video
    op.create_unique_constraint('uq_video_field_values_video_field', 'video_field_values', ['video_id', 'field_id'])

    # CRITICAL: Performance indexes for filtering operations
    # Index 1: Filter by field + numeric value (e.g., "Rating >= 4")
    op.create_index('idx_video_field_values_field_numeric', 'video_field_values', ['field_id', 'value_numeric'])

    # Index 2: Filter by field + text value (e.g., "Presentation = 'great'")
    op.create_index('idx_video_field_values_field_text', 'video_field_values', ['field_id', 'value_text'])

    # Index 3: Lookup all field values for a video (most common query)
    op.create_index('idx_video_field_values_video_field', 'video_field_values', ['video_id', 'field_id'])
```

**Why:**
- **Typed Columns statt JSONB**: Ermöglicht performante Filtering (`WHERE value_numeric >= 4` nutzt Index, JSONB filtering ist langsamer)
- `value_text TEXT` für 'select' und 'text' field types (keine Längenlimitierung)
- `value_numeric NUMERIC` statt `INTEGER`: Unterstützt Dezimalzahlen falls später erwünscht (Rating 4.5 Sterne, etc.)
- **3 Performance Indexes**:
  - `(field_id, value_numeric)`: Query "Show all videos with Rating >= 4" → nutzt Composite Index
  - `(field_id, value_text)`: Query "Show all videos with Presentation = 'great'" → nutzt Composite Index
  - `(video_id, field_id)`: Query "Get all field values for Video X" → häufigste Query beim Rendern von VideoCard
- UNIQUE constraint `(video_id, field_id)` verhindert mehrere Values pro Field pro Video

**REF MCP Validation:**
- ✅ PostgreSQL Performance Docs: Composite indexes `(field_id, value_*)` deutlich schneller als separate Indexes für Filtering
- ✅ SQLAlchemy 2.0 Docs: `ondelete='CASCADE'` on Foreign Key löscht automatisch alle Field Values wenn Video oder Field gelöscht wird

**Alternative Considered:** JSONB column `{"rating": 4, "presentation": "great"}`
**Why Rejected:** Kein Index-Support für Filtering, schlechtere Query Performance, keine Type Safety

---

### 6. Extend `tags` Table with `schema_id` Column
**Files:** `backend/alembic/versions/abc123def456_add_custom_fields_system.py`
**Action:** Bestehende `tags` Tabelle um `schema_id` Foreign Key erweitern

```python
    # 5. Extend tags table with schema_id
    op.add_column('tags', sa.Column('schema_id', UUID(as_uuid=True), sa.ForeignKey('field_schemas.id', ondelete='SET NULL'), nullable=True))

    # Index for schema_id lookups (for "Show all tags using this schema" feature)
    op.create_index('idx_tags_schema_id', 'tags', ['schema_id'])
```

**Why:**
- `nullable=True`: Existing tags haben kein Schema (backwards compatible)
- **`ondelete='SET NULL'` statt CASCADE**: Wenn Schema gelöscht wird, Tag bleibt bestehen aber verliert Schema-Verknüpfung (sicherer als Tag löschen)
- Index für Reverse Lookups: "Welche Tags nutzen Schema X?" (wichtig für "Schema Usage" Feature in Phase 2)

**Alternative Considered:** `ondelete='CASCADE'` (Tag löschen wenn Schema gelöscht)
**Why Rejected:** Zu destruktiv - User verliert Tags nur weil Schema gelöscht wird. SET NULL ist sicherer.

---

### 7. Implement `downgrade()` Function for Rollback
**Files:** `backend/alembic/versions/abc123def456_add_custom_fields_system.py`
**Action:** Sauberes Rollback aller Changes (in **umgekehrter Reihenfolge**)

```python
def downgrade():
    # Remove in REVERSE order to avoid foreign key violations

    # 5. Remove schema_id from tags
    op.drop_index('idx_tags_schema_id', table_name='tags')
    op.drop_column('tags', 'schema_id')

    # 4. Drop video_field_values table
    op.drop_index('idx_video_field_values_video_field', table_name='video_field_values')
    op.drop_index('idx_video_field_values_field_text', table_name='video_field_values')
    op.drop_index('idx_video_field_values_field_numeric', table_name='video_field_values')
    op.drop_table('video_field_values')

    # 3. Drop schema_fields join table
    op.drop_index('idx_schema_fields_field_id', table_name='schema_fields')
    op.drop_index('idx_schema_fields_schema_id', table_name='schema_fields')
    op.drop_table('schema_fields')

    # 2. Drop field_schemas table
    op.drop_index('idx_field_schemas_list_id', table_name='field_schemas')
    op.drop_table('field_schemas')

    # 1. Drop custom_fields table
    op.drop_index('idx_custom_fields_list_id', table_name='custom_fields')
    op.drop_table('custom_fields')
```

**Why:**
- **Reverse Order ist kritisch**: `tags.schema_id` FK muss zuerst weg, dann `field_schemas` Table (sonst Foreign Key violation)
- Indexes explizit droppen (manche DBs löschen sie automatisch, aber explizit ist sicherer)
- CHECK constraints werden automatisch gedroppt mit Table (kein explizites `drop_check_constraint` nötig)

---

### 8. Test Migration: Upgrade
**Files:** Terminal (PostgreSQL database)
**Action:** Migration ausführen und auf Fehler prüfen

```bash
cd backend

# Test upgrade
alembic upgrade head

# Expected output:
# INFO  [alembic.runtime.migration] Running upgrade <previous> -> abc123def456, add custom fields system

# Verify tables exist
psql -U your_user -d your_db -c "\dt"
# Should show: custom_fields, field_schemas, schema_fields, video_field_values

# Verify tags.schema_id column added
psql -U your_user -d your_db -c "\d tags"
# Should show: schema_id column with foreign key to field_schemas

# Check constraints
psql -U your_user -d your_db -c "\d custom_fields"
# Should show: ck_custom_fields_field_type CHECK constraint
```

**Success Criteria:**
- No SQL errors in output
- All 4 tables created
- All 6 indexes created (+ 1 for tags.schema_id = 7 total)
- CHECK constraint present on `custom_fields.field_type`
- UNIQUE constraints present

**Common Issues:**
- **"relation already exists"** → Run `alembic downgrade -1` first, dann `upgrade head`
- **"foreign key violation"** → Check ob `bookmarks_lists` table existiert (should from initial migration)
- **"gen_random_uuid() does not exist"** → PostgreSQL version < 13 (use `uuid_generate_v4()` instead, requires `pgcrypto` extension)

---

### 9. Test Migration: Downgrade (Rollback)
**Files:** Terminal
**Action:** Rollback testen um sicherzustellen dass Migration reversibel ist

```bash
# Test downgrade
alembic downgrade -1

# Expected output:
# INFO  [alembic.runtime.migration] Running downgrade abc123def456 -> <previous>, add custom fields system

# Verify tables removed
psql -U your_user -d your_db -c "\dt"
# Should NOT show: custom_fields, field_schemas, schema_fields, video_field_values

# Verify tags.schema_id removed
psql -U your_user -d your_db -c "\d tags"
# Should NOT show: schema_id column

# Re-upgrade to leave DB in correct state
alembic upgrade head
```

**Success Criteria:**
- No errors during downgrade
- All 4 tables removed
- `tags.schema_id` column removed
- Re-upgrade works without errors

**Common Issues:**
- **"foreign key violation"** → Check downgrade order (must be reverse of upgrade)
- **"index does not exist"** → Index names müssen exakt matchen zwischen upgrade/downgrade

---

### 10. Update Documentation
**Files:** `README.md` oder `CLAUDE.md`
**Action:** Custom Fields Migration Info hinzufügen

```markdown
## Database Migrations

### Custom Fields System (2025-11-05)

Added support for custom rating fields:
- 4 new tables: `custom_fields`, `field_schemas`, `schema_fields`, `video_field_values`
- Extended `tags` table with `schema_id` foreign key
- Performance indexes for field value filtering

To apply:
\`\`\`bash
cd backend
alembic upgrade head
\`\`\`

To rollback:
\`\`\`bash
alembic downgrade -1
\`\`\`
```

**Why:** Dokumentiert Breaking Change für andere Entwickler und Production Deployment

---

## 🧪 Testing Strategy

### Manual Testing (Primary)

**Test 1: Upgrade Success**
```bash
cd backend
alembic upgrade head
```
- ✅ No SQL errors
- ✅ 4 tables created (`\dt` in psql)
- ✅ All constraints/indexes created

**Test 2: Downgrade Success**
```bash
alembic downgrade -1
```
- ✅ No errors
- ✅ All 4 tables removed
- ✅ `tags.schema_id` removed

**Test 3: Re-Upgrade (Idempotency Check)**
```bash
alembic upgrade head
```
- ✅ Migration runs again successfully after downgrade

**Test 4: Constraint Validation (INSERT Tests)**
```sql
-- Test CHECK constraint on field_type
INSERT INTO custom_fields (list_id, name, field_type, config)
VALUES ('some-uuid', 'Test Field', 'invalid_type', '{}');
-- Expected: ERROR violates check constraint "ck_custom_fields_field_type"

-- Test UNIQUE constraint on (list_id, name)
INSERT INTO custom_fields (list_id, name, field_type, config)
VALUES ('list-uuid', 'Rating', 'rating', '{"max_rating": 5}');
INSERT INTO custom_fields (list_id, name, field_type, config)
VALUES ('list-uuid', 'Rating', 'select', '{}');
-- Expected: ERROR duplicate key violates unique constraint "uq_custom_fields_list_name"

-- Test CASCADE delete (field_id -> video_field_values)
INSERT INTO custom_fields (...) VALUES (...);  -- Get field_id
INSERT INTO video_field_values (video_id, field_id, value_numeric) VALUES ('video-uuid', 'field-uuid', 4);
DELETE FROM custom_fields WHERE id = 'field-uuid';
SELECT * FROM video_field_values WHERE field_id = 'field-uuid';
-- Expected: 0 rows (CASCADE delete worked)
```

**Test 5: Index Usage (EXPLAIN ANALYZE)**
```sql
-- Test numeric index usage
EXPLAIN ANALYZE
SELECT v.* FROM videos v
JOIN video_field_values vfv ON v.id = vfv.video_id
WHERE vfv.field_id = 'rating-field-uuid' AND vfv.value_numeric >= 4;
-- Expected: "Index Scan using idx_video_field_values_field_numeric"

-- Test text index usage
EXPLAIN ANALYZE
SELECT v.* FROM videos v
JOIN video_field_values vfv ON v.id = vfv.video_id
WHERE vfv.field_id = 'presentation-field-uuid' AND vfv.value_text = 'great';
-- Expected: "Index Scan using idx_video_field_values_field_text"
```

### Integration Testing (Later Tasks)

Migration wird indirekt getestet durch:
- **Task #59-62**: SQLAlchemy Models nutzen diese Tables
- **Task #66-72**: API Endpoints führen CRUD Operations aus
- **Task #76-77**: Backend Tests validieren komplette Flows

---

## 📚 Reference

### Related Docs

**Master Design:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Section "Database Schema" (Lines 59-159)
- Migration SQL bereits vollständig definiert im Design Doc (Lines 743-840)

**External Docs:**
- [Alembic Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html) - Migration basics
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html) - JSONB vs JSON
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes-types.html) - Composite index performance

### Related Code

**Similar Migration Patterns:**
- `backend/alembic/versions/a1b2c3d4e5f6_add_tags_system.py` - Tags system migration (similar structure)
- Lines 17-47: Table creation with UUID, UNIQUE constraints, indexes

**Existing Models (will reference these tables in Task #59-62):**
- `backend/app/models/tag.py` - Will extend with `schema` relationship
- `backend/app/models/video.py` - Will extend with `field_values` relationship
- `backend/app/models/list.py` - Custom fields will reference `list_id`

**IMPORTANT for Task #59-62 (Model Creation):**
- When defining SQLAlchemy relationships for CASCADE foreign keys, use `passive_deletes=True`
- Example for CustomField model:
  ```python
  video_field_values = relationship(
      'VideoFieldValue',
      back_populates='field',
      cascade='all, delete',      # ORM-level cascade
      passive_deletes=True         # Trust DB CASCADE (REF MCP validated)
  )
  ```
- **Why:** Prevents unnecessary SELECT queries when deleting (database CASCADE handles it)
- **REF MCP Source:** SQLAlchemy 2.0 Docs - "Using foreign key ON DELETE cascade with ORM relationships"
- **Performance Benefit:** Database CASCADE is significantly faster than ORM-level deletion for large collections

### Design Decisions

#### Decision 1: Typed Columns vs JSONB for Field Values
**Alternatives:**
- A) Typed columns (`value_text`, `value_numeric`, `value_boolean`) ← **CHOSEN**
- B) Single JSONB column `value: {"rating": 4, "text": "great"}`

**Rationale:**
- Performance: Composite indexes `(field_id, value_numeric)` ermöglichen effiziente Filtering Queries
- JSONB Filtering ist 3-10x langsamer (benötigt GIN indexes, keine direkte Equality Checks)
- Type Safety: Database enforces numeric types (kein "4" als String statt Integer)
- Query Planner: PostgreSQL kann typed columns besser optimieren

**Trade-offs:**
- ✅ Pro: Bessere Performance für Filtering (Hauptanwendungsfall)
- ✅ Pro: Indexes funktionieren out-of-the-box
- ❌ Con: 3 columns statt 1 (mehr Speicher) → Akzeptabel, Speicher ist billig vs. Query Performance

**Validation:**
- ✅ REF MCP (PostgreSQL Performance Docs): Typed columns bevorzugt für Filtering
- ✅ Custom Fields Design Doc (Line 132): "Performance indexes for filtering" erfordern typed columns

---

#### Decision 2: CASCADE vs SET NULL on Foreign Keys
**Alternatives:**
- A) `tags.schema_id` → `ON DELETE CASCADE` (Tag löschen wenn Schema gelöscht)
- B) `tags.schema_id` → `ON DELETE SET NULL` (Tag behalten, Schema-Link entfernen) ← **CHOSEN**

**Rationale:**
- SET NULL ist weniger destruktiv: User verliert nicht ganze Tags nur weil Schema gelöscht wird
- Tags sind wichtiger als Schema-Verknüpfung (Tags haben Videos, Schemas sind nur Metadata)
- User kann Schema löschen und später neues Schema zum Tag hinzufügen

**Other Foreign Keys:**
- `custom_fields.list_id` → CASCADE (Wenn Liste gelöscht, alle Fields weg)
- `video_field_values.field_id` → CASCADE (Wenn Field gelöscht, alle Values weg)
- `video_field_values.video_id` → CASCADE (Wenn Video gelöscht, alle Values weg)

**Validation:**
- ✅ SQLAlchemy Docs: "SET NULL is safer for optional relationships"
- ✅ Custom Fields Design Doc (Line 529): "Tag deletion with schema → schema remains available"

---

#### Decision 3: Composite Primary Key vs Separate ID for `schema_fields`
**Alternatives:**
- A) Composite PK `(schema_id, field_id)` ← **CHOSEN**
- B) Separate `id` column + UNIQUE constraint on `(schema_id, field_id)`

**Rationale:**
- Composite PK ist PostgreSQL Best Practice für Join Tables (spart einen Index)
- Klarer Intent: (Schema, Field) Pair ist die natürliche Identity
- Spart Speicher: Kein extra UUID column nötig

**Trade-offs:**
- ✅ Pro: Effizienterer Speicher (keine extra UUID)
- ✅ Pro: Automatic Duplicate Prevention (kein separate UNIQUE constraint nötig)
- ❌ Con: Komplexere Foreign Keys falls andere Tabellen auf `schema_fields` referenzieren (aber keiner tut das)

**Validation:**
- ✅ PostgreSQL Best Practices: Composite PKs für Many-to-Many Join Tables

---

#### Decision 4: `gen_random_uuid()` vs `uuid_generate_v4()`
**Alternatives:**
- A) `server_default=sa.text('gen_random_uuid()')` ← **CHOSEN**
- B) `server_default=sa.text('uuid_generate_v4()')` (requires `CREATE EXTENSION pgcrypto`)

**Rationale:**
- `gen_random_uuid()` ist native in PostgreSQL 13+ (kein Extension nötig)
- Projekt nutzt bereits `gen_random_uuid()` in bestehenden Migrations (siehe `a1b2c3d4e5f6_add_tags_system.py` Line 21)
- Konsistenz mit bestehendem Code

**Fallback:** Wenn PostgreSQL < 13, muss Migration angepasst werden (aber sehr unwahrscheinlich 2025)

---

#### Decision 5: Index Order (field_id, value_*) vs (value_*, field_id)
**Alternatives:**
- A) `CREATE INDEX idx ON video_field_values(field_id, value_numeric)` ← **CHOSEN**
- B) `CREATE INDEX idx ON video_field_values(value_numeric, field_id)`

**Rationale:**
- Query Pattern ist **immer** "Filter by specific field_id AND value range/equality"
- Index `(field_id, value_numeric)` ermöglicht:
  - Effiziente Lookup für `field_id = 'uuid'` (nutzt linken Teil des Index)
  - Dann Range Scan auf `value_numeric >= 4` (nutzt rechten Teil)
- Index `(value_numeric, field_id)` wäre nutzlos für unsere Queries (wir filtern nie "alle Fields mit Rating >= 4 egal welches Field")

**Validation:**
- ✅ PostgreSQL Index Docs: "Index column order matters - put most selective column first"
- ✅ `field_id` ist selektiver (100 fields) als `value_numeric` (5 mögliche Werte bei Rating)

---

## 🎯 Estimated Effort

**Time Estimate:** 1.5 - 2 hours

**Breakdown:**
- Migration file creation: 30 min (copy from design doc, adapt syntax)
- Testing (upgrade/downgrade/constraints): 45 min
- Documentation update: 15 min
- Contingency (SQL errors, debugging): 30 min

**Confidence:** High (Design doc hat bereits komplettes SQL, nur Alembic Syntax Conversion nötig)

---

## ⚠️ Risks & Mitigation

### Risk 1: Foreign Key to `bookmarks_lists` table name mismatch
**Issue:** Design doc says `lists` but actual table is `bookmarks_lists`
**Mitigation:** Verify table name with `\dt` in psql BEFORE running migration
**Impact:** High (migration fails immediately)

### Risk 2: PostgreSQL version < 13 (gen_random_uuid missing)
**Issue:** Older PostgreSQL doesn't have `gen_random_uuid()`
**Mitigation:** Check PostgreSQL version with `SELECT version();` - if < 13, use `uuid_generate_v4()` and add `CREATE EXTENSION IF NOT EXISTS pgcrypto` in migration
**Impact:** Medium (migration fails but easy fix)

### Risk 3: Existing data in `tags` table without schema_id
**Issue:** Adding `schema_id` column to existing tags → alle NULL
**Mitigation:** Column is `nullable=True` → kein Problem, existing tags haben kein Schema
**Impact:** Low (by design)

### Risk 4: Index creation slow on large tables
**Issue:** Wenn bereits 100k+ Videos existieren, Index-Erstellung dauert Minuten
**Mitigation:** Kommuniziere mit User wenn Production Deployment, plane Downtime ein
**Impact:** Low (Entwicklung hat kleine Datenmenge, Production wird später behandelt)

---

## 📝 Notes

### PostgreSQL Version Check
```bash
psql -U your_user -d your_db -c "SELECT version();"
# Expected: PostgreSQL 13+ (for gen_random_uuid support)
```

### Alembic Revision ID Format
- Alembic generiert automatisch short hash IDs (z.B. `abc123def456`)
- **NICHT** manuell editieren - Alembic nutzt diese für Dependency Graph

### Migration Naming Convention
- Format: `<revision>_<description>.py`
- Description: snake_case, keine Spaces
- Beispiel: `abc123def456_add_custom_fields_system.py`

### Constraint Naming Conventions (REF MCP Validated)

**Project Standard** (analysiert aus `a1b2c3d4e5f6_add_tags_system.py`):

- **UNIQUE Constraints:** `uq_<table>_<col1>_<col2>` oder `uq_<table>_<description>`
  - Beispiel bestehend: `uq_tags_name_user_id`, `uq_video_tags_video_tag`
  - Beispiel dieser Plan: `uq_custom_fields_list_name` ✅

- **Indexes:** `idx_<table>_<column(s)>`
  - Beispiel bestehend: `idx_video_tags_video_id`, `idx_video_tags_tag_id`
  - Beispiel dieser Plan: `idx_custom_fields_list_id`, `idx_video_field_values_field_numeric` ✅

- **CHECK Constraints:** `ck_<table>_<column>` oder `ck_<table>_<description>` (neu, keine bestehenden)
  - Beispiel dieser Plan: `ck_custom_fields_field_type` ✅

- **Composite Primary Keys:** `pk_<table>` (nur wenn explizite Benennung nötig)
  - Beispiel dieser Plan: `pk_schema_fields` ✅

**Validation Status:** Alle Constraint-Namen in diesem Plan sind konsistent mit Project-Standard.

### Testing with Fresh Database
```bash
# Option 1: Drop and recreate DB
dropdb your_db && createdb your_db
alembic upgrade head

# Option 2: Downgrade to base and re-upgrade
alembic downgrade base
alembic upgrade head
```

### Import Statements for Migration File
```python
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '<generated-by-alembic>'
down_revision = '<previous-revision>'
branch_labels = None
depends_on = None
```

---

**Plan Created:** 2025-11-05
**REF MCP Validated:** 2025-11-05 15:10 CET
**Author:** Claude Code (Task Planning Agent)
**Status:** Ready for Implementation - REF MCP Approved ✅

**Validation Results:**
- ✅ SQLAlchemy 2.0 Foreign Key CASCADE patterns verified
- ✅ PostgreSQL JSONB vs JSON usage confirmed optimal
- ✅ Composite index column order validated for query patterns
- ✅ Constraint naming conventions checked against existing migrations
- ✅ `passive_deletes=True` best practice documented for future tasks
- ✅ No hallucinated APIs or libraries detected
