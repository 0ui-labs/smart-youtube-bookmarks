# Atomic Steps: Video Player Integration

Jeder Schritt:
- 15-60 Minuten Arbeitszeit
- 1-3 Dateien ändern
- Klares Pass/Fail Kriterium
- Independently committable

---

## Backend Foundation (Schritte 1-6)

### Step 1: Alembic Migration erstellen
**Dateien:** `backend/alembic/versions/xxx_add_watch_position.py`
**Aufgabe:** Migration für watch_position und watch_position_updated_at erstellen
**Test:** `alembic upgrade head` läuft ohne Fehler
**Commit:** `feat(db): add watch_position columns to videos table`

### Step 2: Video Model erweitern
**Dateien:** `backend/app/models/video.py`
**Aufgabe:** watch_position und watch_position_updated_at Felder hinzufügen
**Test:** Python import ohne Fehler, Type Hints korrekt
**Commit:** `feat(models): add watch_position fields to Video`

### Step 3: Pydantic Response Schema erweitern
**Dateien:** `backend/app/schemas/video.py`
**Aufgabe:** watch_position zu VideoResponse hinzufügen
**Test:** Schema-Validierung mit Beispieldaten
**Commit:** `feat(schemas): add watch_position to VideoResponse`

### Step 4: Pydantic Request/Response für Progress erstellen
**Dateien:** `backend/app/schemas/video.py`
**Aufgabe:** UpdateWatchProgressRequest und UpdateWatchProgressResponse erstellen
**Test:** Schema-Validierung (position >= 0)
**Commit:** `feat(schemas): add watch progress request/response schemas`

### Step 5: PATCH Endpoint implementieren
**Dateien:** `backend/app/api/videos.py`
**Aufgabe:** PATCH /videos/{id}/progress Endpoint
**Test:** Manueller curl-Test oder Pytest
**Commit:** `feat(api): add PATCH /videos/{id}/progress endpoint`

### Step 6: Backend Tests
**Dateien:** `backend/tests/test_video_progress.py`
**Aufgabe:** Tests für neuen Endpoint
**Test:** `pytest tests/test_video_progress.py` grün
**Commit:** `test(api): add video progress endpoint tests`

---

## Frontend Foundation (Schritte 7-12)

### Step 7: Plyr installieren
**Dateien:** `frontend/package.json`, `frontend/package-lock.json`
**Aufgabe:** `npm install plyr`
**Test:** `npm ls plyr` zeigt installierte Version
**Commit:** `chore(deps): add plyr video player library`

### Step 8: Player Types erstellen
**Dateien:** `frontend/src/types/player.ts`
**Aufgabe:** PlayerSettings und WatchProgress Interfaces
**Test:** TypeScript kompiliert ohne Fehler
**Commit:** `feat(types): add player type definitions`

### Step 9: Video Types erweitern
**Dateien:** `frontend/src/types/video.ts`
**Aufgabe:** watch_position zu VideoResponseSchema hinzufügen
**Test:** Zod-Parse mit Beispieldaten
**Commit:** `feat(types): add watch_position to VideoResponseSchema`

### Step 10: Player Settings Store
**Dateien:** `frontend/src/stores/playerSettingsStore.ts`
**Aufgabe:** Zustand Store mit persist Middleware
**Test:** Store Unit Test
**Commit:** `feat(store): add playerSettingsStore with persistence`

### Step 11: useWatchProgress Hook
**Dateien:** `frontend/src/hooks/useWatchProgress.ts`
**Aufgabe:** React Query Mutation für Progress-Update
**Test:** Hook Unit Test
**Commit:** `feat(hooks): add useWatchProgress mutation hook`

### Step 12: Plyr CSS Theme
**Dateien:** `frontend/src/index.css`
**Aufgabe:** Plyr CSS Variables für App-Theme
**Test:** Visueller Check im Browser
**Commit:** `style: add Plyr CSS theme variables`

---

## Player Component (Schritte 13-17)

### Step 13: VideoPlayer Grundgerüst
**Dateien:** `frontend/src/components/VideoPlayer.tsx`
**Aufgabe:** Komponente mit Props-Interface, Plyr-Initialisierung
**Test:** Komponente rendert YouTube-Player
**Commit:** `feat(components): add VideoPlayer component skeleton`

### Step 14: VideoPlayer Settings Integration
**Dateien:** `frontend/src/components/VideoPlayer.tsx`
**Aufgabe:** Store-Integration für Volume, Speed
**Test:** Einstellungen werden aus Store geladen
**Commit:** `feat(VideoPlayer): integrate player settings store`

### Step 15: VideoPlayer Progress Tracking
**Dateien:** `frontend/src/components/VideoPlayer.tsx`
**Aufgabe:** timeupdate Event + debounced Progress-Save
**Test:** Progress wird im Network-Tab gesendet
**Commit:** `feat(VideoPlayer): add progress tracking`

### Step 16: VideoPlayer Initial Position
**Dateien:** `frontend/src/components/VideoPlayer.tsx`
**Aufgabe:** Seek zu initialPosition bei ready Event
**Test:** Player startet an korrekter Position
**Commit:** `feat(VideoPlayer): support initial position seek`

### Step 17: VideoPlayer Error Handling
**Dateien:** `frontend/src/components/VideoPlayer.tsx`
**Aufgabe:** Error State mit Fallback-UI
**Test:** Bei Fehler wird Fallback gezeigt
**Commit:** `feat(VideoPlayer): add error handling with fallback`

---

## Page Integration (Schritte 18-21)

### Step 18: VideoDetailsPage Integration
**Dateien:** `frontend/src/pages/VideoDetailsPage.tsx`
**Aufgabe:** Thumbnail durch VideoPlayer ersetzen
**Test:** Player erscheint auf Detail-Seite
**Commit:** `feat(VideoDetailsPage): replace thumbnail with VideoPlayer`

### Step 19: VideoDetailsModal Integration
**Dateien:** `frontend/src/components/VideoDetailsModal.tsx`
**Aufgabe:** Thumbnail durch VideoPlayer ersetzen
**Test:** Player erscheint im Modal
**Commit:** `feat(VideoDetailsModal): replace thumbnail with VideoPlayer`

### Step 20: VideoPlayer Tests
**Dateien:** `frontend/src/components/__tests__/VideoPlayer.test.tsx`
**Aufgabe:** Component Tests mit Mock Plyr
**Test:** `npm test VideoPlayer` grün
**Commit:** `test(VideoPlayer): add component tests`

### Step 21: Integration Tests
**Dateien:** `frontend/src/pages/__tests__/VideoDetailsPage.test.tsx`
**Aufgabe:** Page-Level Tests mit Player
**Test:** `npm test VideoDetailsPage` grün
**Commit:** `test(VideoDetailsPage): add player integration tests`

---

## Polish (Schritte 22-24)

### Step 22: Loading State
**Dateien:** `frontend/src/components/VideoPlayer.tsx`
**Aufgabe:** Loading Spinner während Player lädt
**Test:** Spinner sichtbar vor ready Event
**Commit:** `feat(VideoPlayer): add loading state`

### Step 23: Accessibility Verbesserungen
**Dateien:** `frontend/src/components/VideoPlayer.tsx`, `frontend/src/index.css`
**Aufgabe:** Focus-Ring, ARIA-Labels prüfen
**Test:** Keyboard-Navigation funktioniert
**Commit:** `a11y(VideoPlayer): improve keyboard navigation and focus styles`

### Step 24: Final Cleanup & Documentation
**Dateien:** Div.
**Aufgabe:** Code-Review, Kommentare, README-Update (falls nötig)
**Test:** Linting, Type-Check, alle Tests grün
**Commit:** `chore: final cleanup for video player feature`

---

## Zusammenfassung

| Phase | Schritte | Dateien |
|-------|----------|---------|
| Backend Foundation | 1-6 | 5 |
| Frontend Foundation | 7-12 | 6 |
| Player Component | 13-17 | 1 (+Tests) |
| Page Integration | 18-21 | 2 (+Tests) |
| Polish | 22-24 | 2 |

**Gesamt: 24 atomare Schritte**

---

## Execution Order

```
Backend:     [1] → [2] → [3] → [4] → [5] → [6]
                                         ↓
Frontend:    [7] → [8] → [9] → [10] → [11] → [12]
                                              ↓
Component:   [13] → [14] → [15] → [16] → [17]
                                          ↓
Integration: [18] → [19] → [20] → [21]
                                   ↓
Polish:      [22] → [23] → [24]
```

**Parallelisierbar:**
- Backend (1-6) kann parallel zu Frontend Foundation (7-12) laufen
- Benötigt: Step 5 (API) muss vor Step 11 (Hook) fertig sein

---

## Exit Condition

✅ Atomare Schritte definiert:
- 24 Schritte, jeder 15-60 min
- 1-3 Dateien pro Schritt
- Klare Pass/Fail Kriterien
- Commit Message Templates
