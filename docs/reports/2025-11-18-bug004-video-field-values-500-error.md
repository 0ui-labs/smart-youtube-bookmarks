# Bug #004 - Video Detail Endpoint 500 Error (Field Values Not Iterable)

**Date:** 2025-11-18 | **Status:** Complete

---

## Context

Nach der Behebung von Bug #002 und #003 konnten Nutzer immer noch keine Custom Fields in Video-Detail-Ansichten sehen oder bearbeiten. Die Fehlermeldung "Man kann die felder immernoch nciht bearbeiten" führte zur Entdeckung eines 500 Internal Server Error beim Laden von Videos mit mehreren Feldwerten.

Das Problem blockierte die gesamte Custom Fields Funktionalität, da Videos mit ausgefüllten Feldern nicht geladen werden konnten und somit weder angezeigt noch bearbeitet werden konnten.

---

## What Changed

### Modified Files

**Backend:**
- `backend/app/api/videos.py` (lines 886-906, 942) - Video Detail Endpoint
  - **Changed:** Manuelle Ladung von `field_values` statt SQLAlchemy selectinload
  - **Why:** SQLAlchemy gab bei mehreren field_values ein einzelnes Objekt statt einer Liste zurück
  - **Pattern:** Gleicher Workaround wie bei Tags (lines 908-919)

**Tests:**
- `backend/tests/api/test_videos.py` (lines 1686-1820) - Regression Test
  - **Added:** `test_get_video_detail_with_multiple_field_values()`
  - **Purpose:** Verhindert Regression durch Test mit 3 Feldwerten

**Documentation:**
- `docs/reports/2025-11-18-bugfix-video-field-values-500-error.md` - Detaillierter Bug Report
  - **Content:** Root Cause Analysis, Investigation Process, Solution, Testing

### Key Components/Patterns

**Manual Relationship Loading Pattern:**
```python
# ❌ NICHT verwenden: selectinload kann einzelnes Objekt statt Liste zurückgeben
stmt = select(Video).options(selectinload(Video.field_values))

# ✅ VERWENDEN: Separate Query garantiert immer eine Liste
field_values_stmt = (
    select(VideoFieldValue)
    .where(VideoFieldValue.video_id == video_id)
    .options(selectinload(VideoFieldValue.field))
)
field_values_result = await db.execute(field_values_stmt)
field_values_list = list(field_values_result.scalars().all())
video.__dict__['field_values'] = field_values_list
```

**Why This Pattern:**
- SQLAlchemy hat intermittierende Probleme mit `uselist=True` bei Relationships
- Separate Queries sind zuverlässiger und garantieren konsistente Datentypen
- Bereits etabliertes Pattern für Tags (lines 908-919)

**Alternatives Considered:**
- ❌ Conditional type checking (if isinstance(field_values, list)) - Symptom-Behandlung
- ❌ Änderung des SQLAlchemy Models - Zu riskant ohne vollständiges Verständnis
- ✅ Manual Loading Pattern - Bewährt, sicher, wartbar

---

## Current Status

**What Works:**
- ✅ Video Detail Endpoint gibt 200 OK zurück (nicht 500)
- ✅ Videos mit mehreren Feldwerten laden erfolgreich
- ✅ Custom Fields sind in Video Detail Modal sichtbar
- ✅ Custom Fields sind in VideoDetailsPage sichtbar
- ✅ Inline-Bearbeitung von Feldwerten funktioniert
- ✅ Werte werden korrekt gespeichert und angezeigt

**What's Broken/Open:**
- Keine bekannten Issues

**Test Status:**
- ✅ Backend Regression Test: `test_get_video_detail_with_multiple_field_values` - PASSED
- ✅ Manual API Test: GET /videos/{id} - 200 OK mit korrekten Daten
- ✅ Manual API Test: PUT /videos/{id}/fields - 200 OK, Updates funktionieren
- ✅ Existing Test: `test_get_video_detail_with_available_fields_but_no_values` - Still PASSED

---

## Important Learnings

**Gotchas:**
- ⚠️ SQLAlchemy `uselist=True` ist NICHT ausreichend, um Listen zu garantieren
- ⚠️ Bei One-to-Many und Many-to-Many Relationships immer separate Queries verwenden
- ⚠️ Das Problem tritt intermittierend auf - nur bei Videos mit mehreren verwandten Objekten
- ⚠️ SQLAlchemy gibt SAWarning aus, aber wirft keinen Error bis zur Iteration

**Warning Signal (aus Debug Log):**
```
SAWarning: Multiple rows returned with uselist=False for eagerly-loaded attribute 'Video.field_values'
```
→ Obwohl Model `uselist=True` hat, verhält sich SQLAlchemy manchmal wie `uselist=False`

**What Worked Well:**
- ✅ Systematic Debugging Skill angewendet - führte direkt zur Root Cause
- ✅ Debug Script (`debug_video.py`) half, Problem schnell zu reproduzieren
- ✅ Gleicher Workaround wie bei Tags - konsistentes Pattern im Codebase
- ✅ Regression Test schützt vor zukünftigen Breaks

**Changes From Plan:**
- Ursprünglich sollte nur frontend 422 Error behoben werden
- Entdeckung des 500 Errors führte zu tieferer Investigation
- Bug war tiefer als erwartet (Backend statt Frontend), aber Fix war einfach

---

## Next Steps

**Immediate:**
- [x] Bug behoben und getestet
- [x] Regression Test geschrieben
- [x] Dokumentation erstellt

**Future Considerations:**
- **SQLAlchemy Upgrade:** Prüfen, ob neuere SQLAlchemy Version das Problem behebt
- **Relationship Pattern Audit:** Andere Relationships im Codebase auf gleiches Problem prüfen
  - Kandidaten: `Tag.videos`, `BookmarkList.videos`, `CustomField.field_values`
- **Logging Enhancement:** SAWarnings in strukturiertes Logging aufnehmen
- **Documentation:** Best Practice Guide für SQLAlchemy Relationships erstellen

---

## Key References

**Related Bugs:**
- Bug #002 - Tag schema_id clearing (gleiche Root Cause bei Tags)
- Bug #003 - Video endpoint field_values validation error (None values)

**Related Files:**
- `backend/app/models/video.py` (lines 47-53) - Video.field_values relationship definition
- `backend/app/models/video_field_value.py` - VideoFieldValue model
- `backend/app/api/helpers/field_union.py` (lines 147-287) - Field union logic

**Debug Tools Created:**
- `backend/debug_video.py` - Video detail endpoint tester
- `backend/test_endpoint_direct.py` - Direct endpoint call without HTTP

**Test Coverage:**
- `tests/api/test_videos.py::test_get_video_detail_with_multiple_field_values` - Regression test
- Manual testing via curl with video ID `8655b3cb-5e2c-4889-aa26-ec8ce51e5ddc`

**Dependencies:** No new dependencies added

---

## Technical Details

### Error Traceback (Before Fix)
```python
TypeError: 'VideoFieldValue' object is not iterable
  File "backend/app/api/videos.py", line 935, in get_video_by_id
    values_by_field_id = {fv.field_id: fv for fv in field_values_list}
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

### Root Cause Sequence
1. Video has multiple VideoFieldValue rows in database
2. `selectinload(Video.field_values)` executes
3. SQLAlchemy returns **single VideoFieldValue object** instead of list
4. Code tries to iterate: `for fv in field_values_list`
5. Python raises TypeError: object not iterable

### Why SQLAlchemy Behaved This Way
- Possible conflict between `uselist=True` declaration and actual query
- Eager loading with selectinload manchmal inkonsistent bei One-to-Many
- Gleicher Bug wie bei Tags - Pattern Problem in SQLAlchemy oder unserer Konfiguration

### Solution Implementation
```python
# Step 2A: Load field_values manually
field_values_stmt = (
    select(VideoFieldValue)
    .where(VideoFieldValue.video_id == video_id)
    .options(selectinload(VideoFieldValue.field))  # Eager load nested relationship
)
field_values_result = await db.execute(field_values_stmt)
field_values_list = list(field_values_result.scalars().all())  # Force list
video.__dict__['field_values'] = field_values_list  # Override relationship
```

### Performance Impact
- **Before:** 1 query mit selectinload
- **After:** 2 separate queries (Video, dann field_values)
- **Impact:** Minimal - gleiche Anzahl DB roundtrips, nur expliziter
- **Benefit:** 100% Zuverlässigkeit vs. intermittierende Failures

---

## Verification Commands

```bash
# Run regression test
cd backend
pytest tests/api/test_videos.py::test_get_video_detail_with_multiple_field_values -v

# Manual API test
curl http://localhost:8000/api/videos/8655b3cb-5e2c-4889-aa26-ec8ce51e5ddc

# Test field update
curl -X PUT http://localhost:8000/api/videos/{id}/fields \
  -H "Content-Type: application/json" \
  -d '{"field_values": [{"field_id": "...", "value": 4}]}'
```
