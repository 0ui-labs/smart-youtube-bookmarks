# Task #59: Create CustomField SQLAlchemy Model

**Plan Task:** #59
**Wave/Phase:** Phase 1: MVP - Backend (Custom Fields System)
**Dependencies:** Task #58 (Custom Fields Migration - ✅ Complete)

---

## 🎯 Ziel

Das `CustomField` SQLAlchemy ORM Model erstellen, das:
- Auf die `custom_fields` Tabelle mappt (erstellt in Task #58 Migration `1a6e18578c31`)
- SQLAlchemy 2.0 async Patterns folgt (wie bestehende `Tag`, `Video`, `BookmarkList` Models)
- `passive_deletes=True` für CASCADE Foreign Key Relationships nutzt (REF MCP validiert)
- 4 Field Types unterstützt: `'select'`, `'rating'`, `'text'`, `'boolean'`
- Field-Wiederverwendung über Schemas und korrekte Cascade-Deletion von Field Values ermöglicht

## 📋 Acceptance Criteria

- [ ] `CustomField` Model erstellt in `backend/app/models/custom_field.py`
- [ ] Model nutzt SQLAlchemy 2.0 `Mapped[]` Type Hints und `mapped_column()`
- [ ] Relationships zu `BookmarkList`, `SchemaField`, und `VideoFieldValue` definiert mit korrekten Cascades
- [ ] `passive_deletes=True` bei allen CASCADE Foreign Key Relationships (Performance-Optimierung)
- [ ] Model folgt bestehenden Codebase-Patterns (`Tag.py`, `Video.py` als Referenz)
- [ ] JSONB `config` Field korrekt typisiert mit `Dict[str, Any]` und default `{}`
- [ ] Model exportiert in `backend/app/models/__init__.py`
- [ ] TypeScript Type Check erfolgreich (`npx tsc --noEmit` in frontend)
- [ ] Python Imports funktionieren (keine zirkulären Import-Fehler)
- [ ] Dokumentation: Umfassender Docstring mit Field Type Beispielen

---

## 🛠️ Implementation Steps

### 1. CustomField Model File erstellen
**Files:** `backend/app/models/custom_field.py`
**Action:** Neue Datei mit SQLAlchemy 2.0 Model Definition erstellen

**Code:**
```python
from typing import Optional, Dict, Any
from uuid import UUID as PyUUID

from sqlalchemy import String, Text, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .base import BaseModel


class CustomField(BaseModel):
    """
    Represents a reusable custom field definition for video rating/evaluation.

    Custom fields allow users to define evaluation criteria that can be applied
    to videos through field schemas. Fields are list-scoped and globally reusable
    within that list.

    Field Types:
        - 'select': Dropdown with predefined options
          Example config: {"options": ["bad", "good", "great"]}

        - 'rating': Numeric rating scale (e.g., 1-5 stars)
          Example config: {"max_rating": 5}

        - 'text': Free-form text input
          Example config: {"max_length": 500}  # optional

        - 'boolean': Yes/No checkbox
          Example config: {}  # no config needed

    Examples:
        >>> # Create a rating field
        >>> field = CustomField(
        ...     list_id=list_uuid,
        ...     name="Overall Quality",
        ...     field_type="rating",
        ...     config={"max_rating": 5}
        ... )

        >>> # Create a select field
        >>> field = CustomField(
        ...     list_id=list_uuid,
        ...     name="Presentation Style",
        ...     field_type="select",
        ...     config={"options": ["bad", "confusing", "great"]}
        ... )

    Database Constraints:
        - Unique: (list_id, name) - Field names must be unique per list
        - Check: field_type IN ('select', 'rating', 'text', 'boolean')

    Cascade Behavior:
        - ON DELETE CASCADE from bookmarks_lists (field deleted when list deleted)
        - ON DELETE CASCADE to video_field_values (values deleted when field deleted)
        - Uses passive_deletes=True for performance (trusts DB CASCADE)
    """
    __tablename__ = "custom_fields"

    # Columns
    list_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True  # Performance: frequent lookups by list_id
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="One of: 'select', 'rating', 'text', 'boolean'"
    )
    config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict  # Python-side default for ORM objects
        # Note: server_default='{}' already set in migration
    )

    # Relationships
    list: Mapped["BookmarkList"] = relationship(
        "BookmarkList",
        back_populates="custom_fields"
    )

    schema_fields: Mapped[list["SchemaField"]] = relationship(
        "SchemaField",
        back_populates="field",
        cascade="all, delete-orphan",  # Deleting field removes from all schemas
        passive_deletes=True  # Trust DB CASCADE (REF MCP 2025-11-05: also optimal for join tables)
    )

    video_field_values: Mapped[list["VideoFieldValue"]] = relationship(
        "VideoFieldValue",
        back_populates="field",
        cascade="all, delete",  # Deleting field deletes all video values
        passive_deletes=True  # Trust DB CASCADE for performance (REF MCP)
    )

    def __repr__(self) -> str:
        return f"<CustomField(id={self.id}, name={self.name!r}, type={self.field_type!r})>"
```

**Why:**
- **`passive_deletes=True` auf `video_field_values` UND `schema_fields`**: REF MCP 2025-11-05 bestätigt dass dies Best Practice für ALLE CASCADE Foreign Keys ist, inklusive Join Tables. Database CASCADE ist signifikant schneller als ORM-Level Deletion (vermeidet SELECT Queries vor DELETE). Kein Grund, Join Table Rows in Speicher zu laden wenn DB CASCADE bereits konfiguriert ist.
- **`default=dict` für `config`**: Python-side Default stellt sicher dass neue Objekte `{}` haben auch vor INSERT. Ergänzt `server_default='{}'` aus Migration.
- **`index=True` auf `list_id`**: Migration erstellt bereits diesen Index, aber explizit hier für Klarheit (SQLAlchemy dupliziert nicht).
- **Comment auf `field_type`**: Hilft zukünftigen Entwicklern die Constraint zu verstehen ohne Migration zu checken.

**Alternativen erwogen:**
- **String ENUM vs VARCHAR + CHECK**: VARCHAR gewählt (bereits in Migration) für Flexibilität. CHECK Constraint handhabt Validierung auf DB-Ebene.
- **JSONB Validierung im Model**: Dagegen entschieden (Validierung wird in Pydantic Schemas sein, Task #64).
- **Eager Loading Strategien**: Nutzt default `select` Loading. Kann später optimiert werden falls N+1 Queries zum Problem werden.

---

### 2. BookmarkList Model mit Relationship erweitern
**Files:** `backend/app/models/list.py`
**Action:** `custom_fields` Relationship zum `BookmarkList` Model hinzufügen

**Code:**
```python
# In BookmarkList class, add to relationships section:

custom_fields: Mapped[list["CustomField"]] = relationship(
    "CustomField",
    back_populates="list",
    cascade="all, delete-orphan",  # Deleting list deletes all custom fields
    passive_deletes=True  # Trust DB CASCADE (REF MCP)
)
```

**Location:** Nach `videos` Relationship einfügen (ca. Zeile 40)

**Why:**
- **`cascade="all, delete-orphan"`**: Wenn List gelöscht wird, sollten alle Custom Fields gelöscht werden (Clean Up).
- **`passive_deletes=True`**: Gleiche Rationale wie CustomField Model - vertraue DB CASCADE für Performance.
- **`back_populates`**: Bidirektionale Relationship erlaubt Navigation in beide Richtungen.

---

### 3. Platzhalter-Models für Forward References erstellen
**Files:**
- `backend/app/models/schema_field.py` (Platzhalter für Task #61)
- `backend/app/models/video_field_value.py` (Platzhalter für Task #62)

**Action:** Minimale Platzhalter-Klassen erstellen um Forward References aufzulösen

**Code für `schema_field.py`:**
```python
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, Boolean, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from uuid import UUID as PyUUID

from .base import Base  # ← Use Base, not BaseModel (REF MCP 2025-11-05)

if TYPE_CHECKING:
    from .custom_field import CustomField
    from .field_schema import FieldSchema


class SchemaField(Base):
    """
    Join table for many-to-many relationship between FieldSchema and CustomField.

    Uses composite primary key (schema_id, field_id) without separate id column.
    This is the standard pattern for join tables and matches the migration schema.

    NOTE: This is a placeholder for Task #61. Full implementation coming soon.
    """
    __tablename__ = "schema_fields"

    # Composite primary key (defined in migration)
    schema_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("field_schemas.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False
    )
    field_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_fields.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text('0')  # ← Match migration (REF MCP 2025-11-05)
    )
    show_on_card: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text('false')  # ← Match migration (REF MCP 2025-11-05)
    )

    # Relationships (placeholder)
    schema: Mapped["FieldSchema"] = relationship("FieldSchema", back_populates="schema_fields")
    field: Mapped["CustomField"] = relationship("CustomField", back_populates="schema_fields")

    def __repr__(self) -> str:
        return f"<SchemaField(schema_id={self.schema_id}, field_id={self.field_id})>"
```

**Code für `video_field_value.py`:**
```python
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Numeric, Boolean, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from uuid import UUID as PyUUID

from .base import BaseModel

if TYPE_CHECKING:
    from .custom_field import CustomField
    from .video import Video


class VideoFieldValue(BaseModel):
    """
    Stores the actual field values for videos.

    NOTE: This is a placeholder for Task #62. Full implementation coming soon.
    """
    __tablename__ = "video_field_values"

    video_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False
    )
    field_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_fields.id", ondelete="CASCADE"),
        nullable=False
    )

    # Typed value columns (one will be populated based on field_type)
    value_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    value_numeric: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    value_boolean: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Relationships (placeholder)
    video: Mapped["Video"] = relationship("Video", back_populates="field_values")
    field: Mapped["CustomField"] = relationship("CustomField", back_populates="video_field_values")

    __table_args__ = (
        UniqueConstraint('video_id', 'field_id', name='uq_video_field_values_video_field'),
    )

    def __repr__(self) -> str:
        return f"<VideoFieldValue(video_id={self.video_id}, field_id={self.field_id})>"
```

**Warum Platzhalter:**
- **Zirkuläre Imports auflösen**: `CustomField` referenziert `SchemaField` und `VideoFieldValue`, die zurück zu `CustomField` referenzieren.
- **Testing ermöglichen**: Kann `CustomField` Model Creation testen ohne volle Implementierung der anderen Models.
- **Task-Isolierung**: Tasks #60-62 werden diese Models voll implementieren, aber Task #59 braucht Basis-Struktur.
- **`TYPE_CHECKING`**: Forward References werden nur von Type Checkern evaluiert, nicht zur Laufzeit.

**Alternative erwogen:**
- **Nur String-basierte Forward References**: Würde funktionieren aber macht IDE Autocomplete schlechter. Platzhalter-Klassen bieten bessere DX.

**REF MCP 2025-11-05 Updates:**
- **`SchemaField` erbt von `Base` nicht `BaseModel`**: Join Tables haben composite primary key, kein separates `id`/`created_at`/`updated_at`. Matcht Migration Schema exakt.
- **`server_default` statt `default`**: Nutzt `server_default=text('0')` und `text('false')` für Konsistenz mit Migration, funktioniert auch bei direkten SQL INSERTs.

---

### 4. Model Exports aktualisieren
**Files:** `backend/app/models/__init__.py`
**Action:** `CustomField`, `SchemaField`, `VideoFieldValue` zu Exports hinzufügen

**Code:**
```python
# Add to existing imports:
from .custom_field import CustomField
from .schema_field import SchemaField
from .video_field_value import VideoFieldValue

# Update __all__ list:
__all__ = [
    "Base",
    "BaseModel",
    "BookmarkList",
    "Video",
    "Tag",
    "User",
    "ProcessingJob",
    "JobProgress",
    "CustomField",      # NEW
    "SchemaField",      # NEW
    "VideoFieldValue",  # NEW
    "video_tags"
]
```

**Why:**
- Saubere Imports: `from app.models import CustomField` statt `from app.models.custom_field import CustomField`
- Explizite Exports: `__all__` verhindert versehentliche Imports

---

### 5. Keine zirkulären Import-Fehler verifizieren
**Files:** `backend/app/models/*.py`
**Action:** Testen dass Imports korrekt funktionieren

**Commands:**
```bash
cd backend
python -c "from app.models import CustomField, SchemaField, VideoFieldValue; print('✓ Imports successful')"
```

**Erwarteter Output:**
```
✓ Imports successful
```

**Falls Import Error:**
- `TYPE_CHECKING` Verwendung in Forward References prüfen
- Verifizieren dass `relationship()` String-Namen nutzt, nicht direkte Klassen-Referenzen
- Auf zirkuläre Abhängigkeiten in Import-Reihenfolge prüfen

---

### 6. Manuelle Tests - CustomField Instanz erstellen
**Files:** `backend/test_custom_field_manual.py` (temporäre Test-Datei)
**Action:** Verifizieren dass Model instantiiert und mit async Session genutzt werden kann

**Code:**
```python
import asyncio
from uuid import uuid4
from app.database import AsyncSessionLocal
from app.models import CustomField, BookmarkList

async def test_custom_field_creation():
    async with AsyncSessionLocal() as session:
        # Create a test list
        test_list = BookmarkList(
            id=uuid4(),
            name="Test List",
            user_id=uuid4()  # Mock user
        )
        session.add(test_list)
        await session.commit()

        # Create a custom field
        field = CustomField(
            list_id=test_list.id,
            name="Overall Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        session.add(field)
        await session.commit()

        print(f"✓ Created field: {field}")
        print(f"  ID: {field.id}")
        print(f"  Name: {field.name}")
        print(f"  Type: {field.field_type}")
        print(f"  Config: {field.config}")
        print(f"  List: {field.list.name}")

        # Cleanup
        await session.delete(test_list)  # CASCADE will delete field too
        await session.commit()
        print("✓ Cleanup successful (CASCADE verified)")

if __name__ == "__main__":
    asyncio.run(test_custom_field_creation())
```

**Ausführen:**
```bash
cd backend
python test_custom_field_manual.py
```

**Erwarteter Output:**
```
✓ Created field: <CustomField(id=..., name='Overall Rating', type='rating')>
  ID: <uuid>
  Name: Overall Rating
  Type: rating
  Config: {'max_rating': 5}
  List: Test List
✓ Cleanup successful (CASCADE verified)
```

**Test-Datei nach Verifizierung löschen:**
```bash
rm test_custom_field_manual.py
```

---

### 7. TypeScript Types verifizieren (Sanity Check)
**Files:** `frontend/src/**/*.ts`
**Action:** Sicherstellen dass keine TypeScript Fehler (CustomField Model betrifft Frontend nicht direkt, aber Breakage verifizieren)

**Command:**
```bash
cd frontend
npx tsc --noEmit
```

**Erwartet:** 0 neue Fehler (pre-existing Fehler von anderen Tasks sind akzeptabel)

---

### 8. Dokumentation - CLAUDE.md aktualisieren
**Files:** `CLAUDE.md`
**Action:** CustomField Model zur "Database Models" Section hinzufügen

**Code:**
```markdown
**Database Models (SQLAlchemy 2.0 async):**
- `app/models/list.py` - VideoList
- `app/models/video.py` - Video
- `app/models/tag.py` - Tag, VideoTag (many-to-many)
- `app/models/job.py` - ProcessingJob
- `app/models/job_progress.py` - JobProgress (for history)
- `app/models/user.py` - User (not yet implemented)
- `app/models/custom_field.py` - CustomField (Task #59) ✨
- `app/models/schema_field.py` - SchemaField (Task #61, placeholder)
- `app/models/video_field_value.py` - VideoFieldValue (Task #62, placeholder)
```

**Location:** "Backend Structure" Section aktualisieren (ca. Zeile 160)

---

### 9. Änderungen committen
**Action:** Alle Änderungen mit beschreibendem Message committen

**Commands:**
```bash
git add backend/app/models/custom_field.py
git add backend/app/models/schema_field.py
git add backend/app/models/video_field_value.py
git add backend/app/models/list.py
git add backend/app/models/__init__.py
git add CLAUDE.md

git commit -m "feat(models): add CustomField SQLAlchemy model with placeholders

- Created CustomField model following SQLAlchemy 2.0 async patterns
- Added passive_deletes=True for CASCADE FKs (REF MCP validated)
- Created SchemaField placeholder for Task #61
- Created VideoFieldValue placeholder for Task #62
- Extended BookmarkList with custom_fields relationship
- Updated model exports in __init__.py
- Verified imports work (no circular dependencies)
- Updated CLAUDE.md documentation

Task: #59
REF MCP: passive_deletes=True for performance (trusts DB CASCADE)
Pattern: Follows existing Tag/Video model patterns

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Manuelle Tests (Schritt 6)
- **Test 1:** `CustomField` Instanz mit allen 4 Field Types erstellen
  - Verifizieren `rating` Type: `{"max_rating": 5}`
  - Verifizieren `select` Type: `{"options": ["bad", "good", "great"]}`
  - Verifizieren `text` Type: `{"max_length": 500}`
  - Verifizieren `boolean` Type: `{}`

- **Test 2:** CASCADE Deletion verifizieren
  - `BookmarkList` erstellen → `CustomField` erstellen → `BookmarkList` löschen
  - Verifizieren dass `CustomField` automatisch gelöscht wird (keine verwaisten Zeilen)

- **Test 3:** Relationships funktionieren
  - `field.list` sollte `BookmarkList` Instanz zurückgeben
  - `list.custom_fields` sollte Liste von `CustomField` Instanzen zurückgeben

### Import Testing (Schritt 5)
- **Test 1:** `CustomField` direkt importieren
  - `from app.models.custom_field import CustomField`
  - Sollte ohne Fehler funktionieren

- **Test 2:** Import via `__init__.py`
  - `from app.models import CustomField`
  - Sollte ohne Fehler funktionieren

- **Test 3:** Alle neuen Models zusammen importieren
  - `from app.models import CustomField, SchemaField, VideoFieldValue`
  - Sollte ohne zirkuläre Import-Fehler funktionieren

### TypeScript Verifizierung (Schritt 7)
- **Test:** `npx tsc --noEmit` in frontend ausführen
  - Verifizieren 0 neue Fehler
  - Pre-existing Fehler akzeptabel (dokumentiert in Handoff)

### Unit Tests (Task #76 - Später)
Volle Unit Tests werden in Task #76 (Backend Unit Tests) geschrieben, inklusive:
- Field Type Validierung
- Config Validierung für jeden Field Type
- Duplicate Field Name Prevention (case-insensitive)
- CASCADE Deletion Behavior
- Relationship Loading

---

## 📚 Reference

### Related Docs
- **Design Doc:** `docs/plans/2025-11-05-custom-fields-system-design.md` (Zeilen 998-1025: SQLAlchemy Model Preview)
- **Migration:** `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` (Zeilen 24-46: Table Schema)
- **Handoff:** `docs/handoffs/2025-11-05-log-058-custom-fields-migration.md` (Zeilen 120-145: Wichtige Notizen für Task #59)
- **Task #58 Report:** `docs/reports/2025-11-05-task-058-report.md` (Migration Implementierungs-Details)

### Related Code
- **Pattern Referenz:** `backend/app/models/tag.py` (Zeilen 1-46: SQLAlchemy 2.0 Pattern)
- **Pattern Referenz:** `backend/app/models/video.py` (Zeilen 1-55: JSONB Verwendung, Relationships)
- **Pattern Referenz:** `backend/app/models/list.py` (Zeilen 1-48: UUID Foreign Keys)
- **Base Model:** `backend/app/models/base.py` (Zeilen 1-31: `BaseModel` mit `id`, `created_at`, `updated_at`)

### REF MCP Validierungs-Ergebnisse (2025-11-05)

✅ **Finding 1: `passive_deletes=True` für CASCADE Foreign Keys (inklusive Join Tables)**
- **Quelle:** SQLAlchemy 2.0 Docs - [Using Passive Deletes](https://docs.sqlalchemy.org/en/20/orm/large_collections.html#using-passive-deletes)
- **Empfehlung:** Nutze `passive_deletes=True` wenn Datenbank `ON DELETE CASCADE` hat, **unabhängig davon ob es ein Join Table ist**. SQLAlchemy vertraut der DB für Deletion-Handling, vermeidet unnötige SELECT Queries.
- **Angewendet:** `video_field_values` UND `schema_fields` Relationships nutzen beide `passive_deletes=True`
- **Performance Impact:** Signifikant für große Collections (1000+ Field Values pro Field, 100+ Schema-Field Mappings)

✅ **Finding 2: CHECK Constraints nicht Auto-Erstellt (SQLAlchemy 1.4+)**
- **Quelle:** SQLAlchemy 1.4 Changelog - [Enum and Boolean datatypes no longer default to create constraint](https://docs.sqlalchemy.org/en/20/changelog/migration_14.html#enum-and-boolean-datatypes-no-longer-default-to-create-constraint)
- **Empfehlung:** CHECK Constraints müssen explizit in Migrations erstellt werden
- **Bereits Angewendet:** Task #58 Migration enthält `ck_custom_fields_field_type` Constraint
- **Keine Action Nötig:** Model muss keine CHECK Constraint definieren

✅ **Finding 3: JSONB Default Handling**
- **Quelle:** SQLAlchemy PostgreSQL Dialect Docs
- **Empfehlung:** Nutze `server_default='{}'` in Migration + `default=dict` in Model
- **Bereits Angewendet:** Migration hat `server_default='{}'` (Zeile 30 der Migration-Datei)
- **Angewendet:** Model nutzt `default=dict` für Python-side Default

✅ **Finding 4: Relationship `back_populates` Pattern**
- **Quelle:** Bestehende Codebase (`Tag.py`, `Video.py`)
- **Pattern:** Immer `back_populates` für bidirektionale Relationships nutzen
- **Angewendet:** Alle Relationships nutzen `back_populates` (nicht `backref`)

✅ **Finding 5: TYPE_CHECKING für Forward References**
- **Quelle:** Python Typing Best Practices
- **Pattern:** Nutze `if TYPE_CHECKING:` für Imports die nur vom Type Checker benötigt werden
- **Angewendet:** Platzhalter-Models nutzen `TYPE_CHECKING` um zirkuläre Imports zu vermeiden

✅ **Finding 6: Join Tables sollten von `Base` erben, nicht `BaseModel` (REF MCP 2025-11-05)**
- **Quelle:** Migration Task #58, SQLAlchemy Join Table Best Practices
- **Problem:** `SchemaField` hat composite primary key (schema_id, field_id) ohne separates `id` Field
- **Lösung:** `SchemaField` erbt von `Base` statt `BaseModel` → keine auto-generierten `id`/`created_at`/`updated_at` Columns
- **Angewendet:** Platzhalter `SchemaField` nutzt `Base` und matcht Migration Schema exakt

✅ **Finding 7: `server_default` statt `default` für DB-Ebene Defaults (REF MCP 2025-11-05)**
- **Quelle:** Migration Task #58 Zeilen 89-90, SQLAlchemy Column API
- **Pattern:** Nutze `server_default=text('0')` für Konsistenz mit Migration, funktioniert auch bei direkten SQL INSERTs
- **Angewendet:** `display_order` und `show_on_card` in `SchemaField` Platzhalter nutzen `server_default`

### Design-Entscheidungen

**Entscheidung 1: Platzhalter-Models vs Nur-String Forward References**
- **Gewählt:** Minimale Platzhalter-Models für `SchemaField` und `VideoFieldValue` erstellen
- **Alternativen:**
  - Nur String-Referenzen: `Mapped["SchemaField"]` ohne Import
  - Auf Task #61/62 warten: Würde Task #59 Testing blockieren
- **Rationale:**
  - Besseres IDE Autocomplete und Type Safety
  - Ermöglicht manuelles Testen von `CustomField` isoliert
  - Klare TODO-Marker für Task #61 und #62
- **Trade-off:** Etwas mehr Upfront-Arbeit, aber bessere DX

**Entscheidung 2: `passive_deletes=True` auf BEIDEN `video_field_values` UND `schema_fields`**
- **Gewählt:** `passive_deletes=True` für beide Relationships
- **Rationale:**
  - Beide haben DB `ON DELETE CASCADE` (Migration Task #58)
  - Kein Grund, Rows in Speicher zu laden wenn DB CASCADE bereits vorhanden
  - Auch Join Tables profitieren von Performance-Optimierung
- **REF MCP 2025-11-05 Update:** Ursprünglicher Plan hatte `passive_deletes=False` für `schema_fields` mit Begründung "ORM should handle join table". Nach REF Docs Review korrigiert: passive_deletes ist Best Practice für ALLE CASCADE FKs, inklusive Join Tables.
- **Performance:** Signifikant für beide (vermeidet SELECT vor DELETE)

**Entscheidung 3: Keine Field Type Validierung im Model**
- **Gewählt:** Auf DB CHECK Constraint + Pydantic Schemas vertrauen (Task #64)
- **Alternativen:**
  - SQLAlchemy Enum Type: Zu starr, Migration-Komplexität
  - Python Validierung im Model: Redundant mit Pydantic
- **Rationale:**
  - Defense in Depth: DB Constraint fängt ungültige Daten, Pydantic validiert API Input
  - Flexibilität: Einfach neue Field Types hinzuzufügen (nur CHECK Constraint updaten)

**Entscheidung 4: `index=True` auf `list_id` (Explizit)**
- **Gewählt:** `index=True` im Model markieren obwohl Migration Index erstellt
- **Rationale:**
  - Dokumentation: Zukünftige Entwickler sehen intendierten Index
  - SQLAlchemy dupliziert nicht: Prüft bestehende Indexes vor Erstellung
  - Alembic Autogenerate: Wird erkennen falls Index versehentlich entfernt wurde

**Entscheidung 5: Config JSONB Type Hint `Dict[str, Any]`**
- **Gewählt:** `Mapped[Dict[str, Any]]` für `config` Column
- **Alternativen:**
  - `Mapped[dict]`: Weniger spezifisch
  - Type-spezifische Unions: Zu komplex für Model Layer
- **Rationale:**
  - Flexibilität: Config Struktur variiert nach Field Type
  - Pydantic handled Validierung: Verschiedene Schemas pro Field Type (Task #64)
  - `Any` akzeptabel hier: Type Safety passiert an API-Grenze

---

## ⚠️ Bekannte Issues & Risiken

### Issue 1: Pre-existing Test Failures (Nicht Related zu Task #59)
- **Status:** 39 fehlgeschlagene Backend Tests auf main Branch (pre-existing vor Task #58)
- **Root Cause:** `processing_jobs.status VARCHAR(20)` zu kurz für `'completed_with_errors'` (21 chars)
- **Impact auf Task #59:** Keiner (Migrations und Custom Fields Tables sind isoliert)
- **Mitigation:** Dokumentieren dass Task #59 KEINE NEUEN Test Failures einführen sollte
- **Fix:** Separater Task nötig (nicht Teil des Custom Fields Systems)

### Risiko 1: Zirkuläre Imports zwischen Custom Field Models
- **Wahrscheinlichkeit:** Mittel (3 Models referenzieren einander)
- **Impact:** Hoch (würde alle 3 Tasks #59-61 blockieren)
- **Mitigation Angewendet:**
  - `TYPE_CHECKING` für Type Hints nutzen
  - String-basierte Relationship References: `relationship("SchemaField")`
  - Platzhalter-Models bieten Basis-Struktur
- **Verifizierung:** Schritt 5 testet Imports explizit

### Risiko 2: Platzhalter-Models Unvollständig für Integration Tests
- **Wahrscheinlichkeit:** Niedrig (Platzhalter haben essentielle Fields)
- **Impact:** Mittel (Integration Tests könnten fehlschlagen bis Task #61/62 komplett)
- **Mitigation:**
  - Platzhalter-Models haben alle Foreign Keys und Primary Keys
  - Relationships definiert (auch wenn minimal)
  - Task #76 (Backend Unit Tests) passiert nach Tasks #60-62 komplett
- **Akzeptanz:** Integration Tests werden in Task #77 geschrieben nachdem alle Models existieren

### Risiko 3: Migration-Model Mismatch
- **Wahrscheinlichkeit:** Niedrig (strikte Referenz zu Migration Schema)
- **Impact:** Hoch (Runtime Errors bei Queries)
- **Mitigation:**
  - Implementation Steps referenzieren direkt Migration File Zeilen
  - Manuelle Tests (Schritt 6) verifizieren CREATE/DELETE funktioniert
  - Column Namen matchen exakt (list_id, field_type, config)
- **Verifizierung:** Manueller Test erstellt und queryt echte Datenbank

---

## 🎯 Erfolgskriterien

**Task #59 ist komplett wenn:**

1. ✅ `CustomField` Model erstellt mit allen Columns matching Migration Schema
2. ✅ Relationships definiert: `list`, `schema_fields`, `video_field_values`
3. ✅ `passive_deletes=True` angewendet auf `video_field_values` (REF MCP validiert)
4. ✅ Platzhalter-Models erstellt für `SchemaField` und `VideoFieldValue`
5. ✅ `BookmarkList` erweitert mit `custom_fields` Relationship
6. ✅ Model Exports aktualisiert in `__init__.py`
7. ✅ Manueller Test erfolgreich: Field erstellen → Field querien → List löschen (CASCADE verifiziert)
8. ✅ Python Imports funktionieren: `from app.models import CustomField`
9. ✅ TypeScript Check erfolgreich: 0 neue Fehler
10. ✅ Dokumentation aktualisiert: CLAUDE.md listet neue Models
11. ✅ Committed mit beschreibendem Message
12. ✅ Keine zirkulären Import-Fehler

**Bereit für Task #60:** FieldSchema Model kann `CustomField` referenzieren und Platzhalter `SchemaField` nutzen

---

## 📝 Notizen für nächsten Task (#60)

**Task #60 wird `FieldSchema` Model erstellen. Wichtiger Kontext:**

1. **Referenziere `custom_field.py`** für Pattern-Konsistenz
2. **Nutze Platzhalter `SchemaField`** aus diesem Task (wird voll implementiert in Task #61)
3. **Erweitere `Tag` Model** mit `schema_id` Foreign Key (Migration hat bereits Column hinzugefügt in Task #58, Zeile 102)
4. **Wende gleiche REF MCP Patterns an:**
   - `passive_deletes=True` für CASCADE Relationships zu großen Collections
   - `passive_deletes=False` für Join Table Relationships

5. **Schema-Field Relationship:**
   ```python
   # In FieldSchema model
   schema_fields: Mapped[list["SchemaField"]] = relationship(
       "SchemaField",
       back_populates="schema",
       cascade="all, delete-orphan",
       passive_deletes=False  # Join table, ORM handles
   )
   ```

6. **Teste CASCADE Behavior:**
   - `FieldSchema` löschen → `SchemaField` Join Entries gelöscht
   - `CustomField` löschen → `SchemaField` Join Entries gelöscht
   - Beide Seiten CASCADE korrekt

---

**Geschätzte Dauer:** 1,5-2 Stunden (Implementierung + Testing + Dokumentation)

**Confidence Level:** Hoch (klares Pattern von bestehenden Models, Migration bereits angewendet, REF MCP validiert)
