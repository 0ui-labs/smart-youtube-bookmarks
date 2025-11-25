# Impact Assessment: Video Player Integration

## Komplexitäts-Einschätzung: **Mittel-Hoch**

Begründung:
- Neue externe Library (Plyr)
- Datenbank-Schema-Änderung (watch_position)
- Backend API-Erweiterung
- Frontend-Komponenten (2 Stellen)
- State Management (Player Settings)

---

## Frontend-Änderungen

### Neue Dateien (Erstellen)

| Datei | Beschreibung |
|-------|--------------|
| `components/VideoPlayer.tsx` | Plyr-Wrapper-Komponente |
| `hooks/useVideoPlayer.ts` | Player-Logik und Fortschritt-Sync |
| `hooks/useWatchProgress.ts` | API-Hook für Fortschritt speichern/laden |
| `stores/playerSettingsStore.ts` | Zustand Store für Volume, Speed etc. |
| `types/player.ts` | TypeScript-Interfaces für Player |

### Bestehende Dateien (Ändern)

| Datei | Zeilen | Änderung |
|-------|--------|----------|
| `pages/VideoDetailsPage.tsx` | 180-194 | Thumbnail → VideoPlayer ersetzen |
| `components/VideoDetailsModal.tsx` | 124-130 | Thumbnail → VideoPlayer ersetzen |
| `types/video.ts` | ~275-290 | `watch_position` zu VideoResponseSchema hinzufügen |
| `index.css` | Ende | Plyr CSS Variables für Theming |

### Package Dependencies (Hinzufügen)

```json
{
  "plyr": "^3.8.3"
}
```

---

## Backend-Änderungen

### Datenbank (Migration)

**Neues Feld in `videos` Tabelle:**
```python
# watch_position - Wiedergabe-Fortschritt in Sekunden
watch_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=None)
watch_position_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
```

**Migration erforderlich:** `alembic revision --autogenerate -m "add_watch_position_to_videos"`

### API-Endpoints (Neu/Ändern)

| Endpoint | Methode | Änderung |
|----------|---------|----------|
| `GET /videos/{id}` | Bestehend | `watch_position` in Response hinzufügen |
| `PATCH /videos/{id}/progress` | **NEU** | Fortschritt speichern |

**Neuer Endpoint Schema:**
```python
# PATCH /videos/{id}/progress
class UpdateWatchProgressRequest(BaseModel):
    position: int  # Sekunden

class UpdateWatchProgressResponse(BaseModel):
    video_id: str
    watch_position: int
    updated_at: datetime
```

### Model-Änderungen

| Datei | Änderung |
|-------|----------|
| `models/video.py` | `watch_position`, `watch_position_updated_at` Felder |
| `schemas/video.py` | Response-Schema erweitern |
| `api/videos.py` | Neuer PATCH-Endpoint |

---

## Betroffene Tests

### Frontend
- `VideoDetailsPage.test.tsx` (wenn vorhanden)
- `VideoDetailsModal.test.tsx` (wenn vorhanden)
- Neue Tests für `VideoPlayer.test.tsx`

### Backend
- `test_videos.py` - Erweitern um watch_position Tests
- Neue Tests für PATCH /videos/{id}/progress

---

## Visuelle Änderungen

### VideoDetailsPage
```
VORHER:                          NACHHER:
┌─────────────────────┐         ┌─────────────────────┐
│                     │         │  ▶ Plyr Player      │
│   [Thumbnail]       │   →     │  ┌─────────────────┐│
│                     │         │  │   Video         ││
│      Duration Badge │         │  │   Controls      ││
└─────────────────────┘         │  └─────────────────┘│
                                └─────────────────────┘
```

### VideoDetailsModal
Gleiche Änderung wie VideoDetailsPage, aber im Modal-Kontext.

---

## Zusammenfassung der Auswirkungen

| Bereich | Dateien | Komplexität |
|---------|---------|-------------|
| **Frontend - Neu** | 5 | Mittel |
| **Frontend - Ändern** | 4 | Niedrig |
| **Backend - Model** | 1 | Niedrig |
| **Backend - Schema** | 1 | Niedrig |
| **Backend - API** | 1 | Niedrig |
| **Database** | 1 Migration | Niedrig |
| **Tests** | 3-5 | Mittel |

**Gesamt: ~15-17 Dateien betroffen**

---

## Risiken

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| Plyr-YouTube-Inkompatibilität | Niedrig | Vorab testen, Fallback auf Thumbnail |
| CORS-Issues bei YouTube Embed | Niedrig | YouTube IFrame ist standardmäßig erlaubt |
| Performance bei vielen Videos | Mittel | Player lazy-loaden, nur bei Sichtbarkeit initialisieren |
| Backend-Migration schlägt fehl | Niedrig | Nullable Feld, kein Default-Wert nötig |

## Exit Condition

✅ Vollständige Liste aller betroffenen Bereiche:
- Frontend: 5 neue + 4 geänderte Dateien
- Backend: 3 geänderte Dateien + 1 Migration
- Tests: 3-5 Dateien
- Dependency: 1 npm Package
