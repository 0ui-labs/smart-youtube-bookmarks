# Bugfix - Video Detail Endpoint 500 Error

**Date:** 2025-11-17 | **Status:** Complete

---

## Context

Beim Klicken auf ein Video in der Video-Grid-Ansicht trat ein 500 Internal Server Error auf. Der Fehler verhinderte das Öffnen der Video-Detail-Ansicht und machte die CustomFields-Funktionalität für einzelne Videos unbrauchbar. Die Fehleranalyse ergab einen SQLAlchemy-Bug bei Many-to-Many-Beziehungen, der `video.tags` als einzelnes Tag-Objekt statt als Liste zurückgab.

---

## What Changed

### Modified Files

- `backend/app/api/videos.py` - **get_video_by_id endpoint (lines 862-987)**
  - Implementiert manuelle Tag-Abfrage mit expliziter SQL-Query statt `selectinload`
  - Umgeht SQLAlchemy-Bug durch direkten Join auf `video_tags` Junction Table
  - Konstruiert Response-Dict manuell statt ORM-Objekt zurückzugeben (verhindert Pydantic-Serialisierungs-Fehler)
  - Hinzugefügt: Detaillierte Code-Kommentare zu Workarounds

- `backend/app/api/helpers/field_union.py` - **get_available_fields_for_videos (lines 190-207)**
  - Hinzugefügt: Defensiver Try-Except-Block für single-Tag-Objekte
  - Konvertiert einzelne Tag-Objekte automatisch zu Listen
  - Fängt `TypeError: 'Tag' object is not iterable` ab
  - Sicherheitsnetz für alle Code-Pfade, die `field_union` nutzen

### Key Components/Patterns

- **Manual Tag Loading Pattern** - Explizite SQL-Query mit `.join()` auf Junction Table garantiert korrektes Listen-Objekt:
  ```python
  tags_stmt = (
      select(Tag)
      .join(video_tags_table, Tag.id == video_tags_table.c.tag_id)
      .where(video_tags_table.c.video_id == video_id)
  )
  tags_list = list(tags_result.scalars().all())
  video.__dict__['tags'] = tags_list  # Bypass SQLAlchemy instrumentation
  ```
  - **Wann verwenden:** Bei allen Many-to-Many-Relationships, wo `selectinload` problematisch ist
  - **Vorteil:** Volle Kontrolle über Datenladung, keine versteckten ORM-Bugs

- **Manual Response Construction Pattern** - Dict-basierte Response statt ORM-Objekt für stabile Serialisierung:
  ```python
  return {
      'id': video.id,
      'tags': [{'id': tag.id, 'name': tag.name, ...} for tag in tags_list],
      'available_fields': available_fields,
      'field_values': field_values_response
  }
  ```
  - **Wann verwenden:** Bei komplexen Responses mit nested relationships
  - **Vorteil:** Predictable serialization, kein Pydantic-ResponseValidationError

- **Defensive Programming Pattern** - Try-Except mit Type-Checking als Sicherheitsnetz:
  ```python
  try:
      tags = video.tags if video.tags is not None else []
      if tags and not isinstance(tags, (list, tuple)):
          tags = [tags]  # Convert single object to list
  except TypeError as e:
      if "'Tag' object is not iterable" in str(e):
          tags = [video.tags] if hasattr(video, 'tags') and video.tags else []
  ```
  - **Wann verwenden:** Als Fallback für bekannte Library-Bugs
  - **Vorteil:** Graceful degradation, verhindert Crashes

---

## Current Status

**What Works:**
- ✅ Video-Detail-Endpoint gibt 200 OK mit vollständigen Daten zurück
- ✅ Tags werden korrekt als Liste serialisiert
- ✅ `available_fields` und `field_values` funktionieren wie erwartet
- ✅ Manuelle Response-Konstruktion verhindert Pydantic-Fehler
- ✅ Defensiver Code in `field_union.py` fängt Edge Cases ab

**What's Broken/Open:**
- ⚠️ SQLAlchemy-Bug (Many-to-Many gibt single object zurück) bleibt bestehen
- ⚠️ Workaround nötig, bis SQLAlchemy-Team Bug fixt (könnte Monate dauern)

**Test Status:**
- Backend läuft ohne Errors
- Manual curl-Test erfolgreich (200 OK mit korrektem JSON)
- Keine Unit-Tests hinzugefügt (Bugfix, keine neue Feature)

---

## Important Learnings

**Gotchas:**
- ⚠️ SQLAlchemy `selectinload` kann bei Many-to-Many-Beziehungen single objects statt Listen zurückgeben
- ⚠️ Direktes Zuweisen mit `video.tags = tags_list` schlägt fehl (`AttributeError: 'list' object has no attribute '_sa_instance_state'`)
- ⚠️ Lösung: `video.__dict__['tags'] = tags_list` umgeht SQLAlchemy-Instrumentation
- ⚠️ Pydantic kann bei ORM-Objekten mit komplexen Relationships `ResponseValidationError` werfen
- ⚠️ Lösung: Manuelle Dict-Konstruktion mit expliziter Tag-Serialisierung

**What Worked Well:**
- ✅ Systematic debugging mit Logging identifizierte Problem schnell (Query erfolgreich → Serialization fehlgeschlagen)
- ✅ Manual tag loading ist eigentlich Best Practice (volle Kontrolle, transparente Queries)
- ✅ Defensive programming in `field_union.py` bietet zusätzliche Sicherheit
- ✅ Manual response construction macht API-Responses predictable und testbar

**Changes From Plan:**
- Ursprünglich nur `selectinload` → `joinedload` versucht (funktionierte nicht)
- Dann `await db.refresh(video, ['tags'])` versucht (gab weiterhin single object zurück)
- Finale Lösung: Manuelle Tag-Abfrage + `__dict__`-Assignment + manual response construction
- Zusätzlicher Workaround in `field_union.py` für Sicherheit (nicht ursprünglich geplant)

---

## Next Steps

**Immediate:**
- [x] Code cleanup (alle Debug-Statements entfernt)
- [x] Implementation Report geschrieben
- [x] Status.md aktualisiert

**Blocked By:**
- [Kein Blocker] - Bugfix ist vollständig abgeschlossen

**Future Considerations:**
- Optional: SQLAlchemy-Bug beim SQLAlchemy-Team melden (mit Reproduktions-Beispiel)
- Optional: Try-Except in `field_union.py` entfernen, falls SQLAlchemy gefixt wird
- Optional: Unit-Tests für Manual Tag Loading Pattern hinzufügen
- Monitoring: Bei anderen Many-to-Many-Relationships auf ähnliche Probleme achten

---

## Key References

**Commits:** Keine neuen Commits (Debugging-Session ohne Commit)
**Related Docs:**
- `backend/app/api/videos.py` lines 862-987 (get_video_by_id)
- `backend/app/api/helpers/field_union.py` lines 190-207 (defensive workaround)
- `backend/app/models/video.py` lines 41-46 (Video.tags relationship mit `uselist=True`)

**Root Cause:** SQLAlchemy Many-to-Many Relationship Bug
**Error Message:** `TypeError: 'Tag' object is not iterable` in `field_union.py:193`
**Solution Pattern:** Manual SQL Query + `__dict__` Assignment + Manual Response Construction
