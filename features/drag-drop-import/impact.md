# Impact Assessment: Drag & Drop Video Import

## Zusammenfassung

| Bereich | Änderungsumfang | Komplexität |
|---------|-----------------|-------------|
| Frontend | Mittel | Mittel |
| Backend | Keine | - |
| Datenbank | Keine | - |
| API | Keine | - |
| Tests | Neu | Mittel |

## Frontend Änderungen

### Zu modifizierende Dateien

#### 1. VideosPage.tsx (Hauptänderung)
**Pfad:** `/frontend/src/components/VideosPage.tsx`
**Änderungsumfang:** Mittel

Erforderliche Änderungen:
- [ ] Drop Zone um den Hauptbereich (Video-Liste/Grid)
- [ ] Drag-Over State Management
- [ ] Drop Handler für verschiedene Input-Formate
- [ ] Visuelle Feedback-Komponente (Highlight)
- [ ] Integration mit bestehendem `useBulkUploadVideos` Hook
- [ ] Vorschau-Modal für mehrere Videos

#### 2. TagNavigation.tsx
**Pfad:** `/frontend/src/components/TagNavigation.tsx`
**Änderungsumfang:** Mittel

Erforderliche Änderungen:
- [ ] Jeder Tag wird Drop Target
- [ ] Drag-Over Styling pro Tag
- [ ] Drop Handler mit automatischer Kategorie-Zuweisung
- [ ] Visuelles Feedback bei Drag-Over

#### 3. MainLayout.tsx
**Pfad:** `/frontend/src/components/MainLayout.tsx`
**Änderungsumfang:** Klein

Erforderliche Änderungen:
- [ ] Globaler Drag-Listener für Browser-weites Feedback
- [ ] Eventuell Context für Drag-State Sharing

### Neue Dateien

#### 4. hooks/useDropZone.ts (Neu)
**Pfad:** `/frontend/src/hooks/useDropZone.ts`

Funktionen:
- Drag & Drop Event Handler
- File Type Validation
- URL Parsing (YouTube, .webloc)
- State Management (isDragging, isValid)

#### 5. utils/urlParser.ts (Neu)
**Pfad:** `/frontend/src/utils/urlParser.ts`

Funktionen:
- YouTube URL Parsing
- .webloc File Parsing (XML)
- Multi-URL Text Parsing
- Duplikat-Erkennung

#### 6. components/DropZoneOverlay.tsx (Neu)
**Pfad:** `/frontend/src/components/DropZoneOverlay.tsx`

Funktionen:
- Visuelles Drop-Zone Overlay
- Animiertes Feedback
- Status-Anzeige (gültig/ungültig)

#### 7. components/ImportPreviewModal.tsx (Neu)
**Pfad:** `/frontend/src/components/ImportPreviewModal.tsx`

Funktionen:
- Vorschau für mehrere zu importierende Videos
- Fehler-Anzeige für ungültige URLs
- Kategorie-Auswahl (optional)
- Import-Button

### Zu modifizierende Hooks

#### 8. useVideos.ts
**Pfad:** `/frontend/src/hooks/useVideos.ts`
**Änderungsumfang:** Klein

Mögliche Änderungen:
- [ ] Neuer Hook `useBulkImportVideos` (erweitert `useBulkUploadVideos`)
- [ ] Unterstützung für URL-Array statt nur File
- [ ] Optional: Kategorie-Parameter für automatische Zuweisung

## Backend Änderungen

### Keine Änderungen erforderlich!

Der bestehende Endpoint `POST /lists/{list_id}/videos/bulk` deckt alle Anforderungen ab:
- Akzeptiert CSV mit URLs
- Gibt detaillierte Fehler zurück
- Unterstützt Custom Fields

**Alternative für URL-Array Import:**
Der bestehende `POST /lists/{list_id}/videos` Endpoint kann für einzelne URLs verwendet werden. Bei mehreren URLs können wir:
1. Frontend: URLs zu CSV konvertieren und `bulk` Endpoint nutzen
2. Oder: Parallele Requests für jede URL (weniger effizient)

## Datenbank Änderungen

**Keine Änderungen erforderlich.**

Das bestehende Schema unterstützt bereits:
- Videos mit Tags/Kategorien
- Bulk-Import
- Alle benötigten Relationen

## API Änderungen

**Keine neuen Endpoints erforderlich.**

Bestehende Endpoints werden wiederverwendet:
| Endpoint | Verwendung |
|----------|------------|
| `POST /lists/{list_id}/videos/bulk` | CSV/Multi-URL Import |
| `POST /lists/{list_id}/videos` | Einzelnes Video |
| `PUT /videos/{video_id}/category` | Kategorie zuweisen |
| `POST /videos/{video_id}/tags` | Tags zuweisen |

## Test-Dateien

### Neue Tests

#### 1. useDropZone.test.ts
**Pfad:** `/frontend/src/__tests__/hooks/useDropZone.test.ts`

Tests für:
- Drag Events
- File Validation
- URL Parsing
- State Management

#### 2. urlParser.test.ts
**Pfad:** `/frontend/src/__tests__/utils/urlParser.test.ts`

Tests für:
- YouTube URL Formate
- .webloc Parsing
- Multi-URL Text
- Edge Cases

#### 3. DropZoneOverlay.test.tsx
**Pfad:** `/frontend/src/__tests__/components/DropZoneOverlay.test.tsx`

Tests für:
- Render States
- Accessibility
- Animations

#### 4. ImportPreviewModal.test.tsx
**Pfad:** `/frontend/src/__tests__/components/ImportPreviewModal.test.tsx`

Tests für:
- URL Anzeige
- Fehler-Handling
- Import-Aktion

## Abhängigkeiten

### Bestehende (bereits installiert)
- `@dnd-kit/core` v6.3.1 ✅ (bleibt für interne Sortierung)
- `@dnd-kit/sortable` v10.0.0 ✅
- `framer-motion` (für Animationen) ✅

### Neue Dependencies

```bash
npm install react-dropzone
```

| Package | Version | Size | Grund |
|---------|---------|------|-------|
| `react-dropzone` | ^14.x | ~10kb | Externe Drops (Desktop, URLs) |

**Hinweis:** @dnd-kit funktioniert NICHT für externe Drops (Desktop-Dateien, Browser-URLs). Es ist designed für interne DOM-Sortierung. react-dropzone ist der Standard für externe File Drops in React.

## Risiko-Bewertung

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Performance bei vielen URLs | Niedrig | Mittel | Batch-Processing, Progress-Anzeige |
| Browser-Kompatibilität | Niedrig | Niedrig | HTML5 DnD ist weit unterstützt |
| .webloc Parsing fehlerhaft | Mittel | Niedrig | Gute Error Messages, Fallback |
| Konflikte mit bestehendem DnD | Niedrig | Mittel | Klare Event-Grenzen |

## Zeitlicher Aufwand (Schätzung)

| Komponente | Aufwand |
|------------|---------|
| useDropZone Hook | 2-3h |
| URL Parser Utilities | 2h |
| DropZoneOverlay | 1-2h |
| ImportPreviewModal | 2-3h |
| VideosPage Integration | 2-3h |
| TagNavigation Integration | 2h |
| Tests | 3-4h |
| **Gesamt** | **~15-18h** |
