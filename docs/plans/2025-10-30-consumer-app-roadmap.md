# Roadmap: Smart YouTube Bookmarks - Consumer App Vision

**Datum:** 2025-10-30
**Status:** Planung
**Gesamtaufwand:** 40-60 Stunden
**Basiert auf:** `docs/pivot/product-vision-v2.md`

---

## Übersicht

Diese Roadmap beschreibt die schrittweise Transformation von der aktuellen Foundation (40% komplett) zur vollständigen Consumer-App mit AI-Integration.

**Aktuelle Foundation:**
- ✅ Backend API (Listen, Videos, WebSocket)
- ✅ PostgreSQL + Redis Infrastruktur
- ✅ Gemini Client (bereit, nicht integriert)
- ✅ YouTube API Integration
- ✅ Real-time Dashboard mit WebSocket
- ✅ Umfassende Tests (124 passing)

**Fehlende Features:**
- ❌ AI-Analyse Pipeline aktiv
- ❌ Tag-basierte Organisation
- ❌ YouTube-Grid Interface
- ❌ Moderne Import-Optionen
- ❌ Onboarding Flow
- ❌ AI Chat Interface
- ❌ Custom Analysis Creation

---

## Phase 1: AI-Analyse aktivieren (FOUNDATION)

**Ziel:** Gemini API mit Verarbeitungspipeline verbinden
**Aufwand:** 2-3 Stunden
**Priorität:** KRITISCH (Kern-Differenzierung)

### Aufgaben

- [ ] Hardcoded Analyse-Schema erstellen
  - Clickbait-Erkennung (Boolean + Confidence)
  - Schwierigkeitsgrad (Beginner/Intermediate/Advanced)
  - Haupt-Kategorie (Tutorial/Dokumentation/Review/etc.)
  - Tags-Vorschläge (Array von Strings)

- [ ] Schema-Parameter an Worker übergeben
  - Job-Endpoint erhält Schema-Definition
  - Worker ruft `process_video()` mit Schema auf
  - Validation in Service Layer

- [ ] Gemini-Analyse in Pipeline aktivieren
  - Transkript fetchen (bereits implementiert)
  - Gemini Client aufrufen mit Schema
  - `extracted_data` JSONB-Feld befüllen

- [ ] Tests für AI-Integration
  - Unit Tests für Schema-Erstellung
  - Integration Test mit Mock Gemini Client
  - E2E Test mit echtem Video

- [ ] Frontend: AI-Daten anzeigen
  - Video-Tabelle zeigt `extracted_data`
  - Status-Indikator (AI analysiert/pending)
  - Clickbait-Badge wenn detektiert

### Warum zuerst?

- **Schnellster Weg zum "Wow"-Moment** - In 2-3 Stunden sichtbarer Mehrwert
- **Validiert Kern-Konzept** - Beweist dass AI-Analyse technisch funktioniert
- **Infrastruktur existiert** - Gemini Client ist fertig, nur nicht verbunden
- **Echte Daten für Testing** - Spätere Features können mit AI-Daten entwickelt werden
- **Ohne AI = kein USP** - App wäre nur YouTube-Metadaten-Sammler

### Erfolgskriterium

✅ Video wird hochgeladen → Gemini analysiert → `extracted_data` enthält: `{is_clickbait: false, difficulty: "Beginner", category: "Tutorial", tags: ["Python", "FastAPI"]}`

---

## Phase 2: Tag-System implementieren (FLEXIBLE ORGANISATION)

**Ziel:** Von starren Listen zu flexiblen Tags wechseln
**Aufwand:** 4-6 Stunden
**Priorität:** HOCH (Foundation für UX)

### Aufgaben

- [ ] Datenbank-Schema erweitern
  - `tags` Tabelle erstellen (id, name, color, user_id)
  - `video_tags` Junction Table (video_id, tag_id)
  - Alembic Migration schreiben

- [ ] Backend: Tag-API Endpoints
  - `GET /api/tags` - Alle Tags auflisten
  - `POST /api/tags` - Tag erstellen
  - `PUT /api/tags/{id}` - Tag umbenennen/Farbe ändern
  - `DELETE /api/tags/{id}` - Tag löschen
  - `POST /api/videos/{id}/tags` - Tags zu Video hinzufügen
  - `DELETE /api/videos/{id}/tags/{tag_id}` - Tag entfernen

- [ ] Videos nach Tags filtern
  - `GET /api/videos?tags=python,tutorial` - AND Verknüpfung
  - `GET /api/videos?tags_any=python,tutorial` - OR Verknüpfung
  - Query-Optimierung mit SQLAlchemy

- [ ] AI-basiertes Auto-Tagging (optional)
  - Gemini-Analyse schlägt Tags vor
  - User kann Vorschläge akzeptieren/ablehnen
  - Tags werden automatisch erstellt falls neu

- [ ] Tests für Tag-System
  - CRUD Operations für Tags
  - Many-to-Many Beziehungen
  - Filter-Queries
  - Tag-Suggestions

- [ ] Listen beibehalten (Optional)
  - Listen als "gespeicherte Tag-Filter"
  - Migration: Existierende Listen → Tag-Kombinationen
  - Backwards-Kompatibilität

### Warum jetzt?

- **Datenmodell-Änderung vor UX** - Einfacher jetzt als nach Grid-Implementierung
- **YouTube-Grid braucht Tags** - Sidebar-Filter basieren auf Tags
- **Ein Video, viele Kontexte** - Python-Tutorial kann [Python, Tutorial, Favoriten] sein
- **AI kann Tags vorschlagen** - Phase 1 Analyse kann bereits Tag-Liste ausgeben

### Erfolgskriterium

✅ Video hat Tags [Python, Tutorial] → Filter nach "Python" zeigt Video → Filter nach "JavaScript" zeigt es nicht

---

## Phase 3: YouTube-Grid Interface (MODERNE UX)

**Ziel:** Von Tabelle zu YouTube-artiger Grid-Ansicht wechseln
**Aufwand:** 5-7 Stunden
**Priorität:** HOCH (User-facing Verbesserung)

### Aufgaben

- [ ] Grid-Layout Component
  - Responsive Grid (3-6 Spalten je nach Breite)
  - Thumbnail als primäres visuelles Element
  - Video-Dauer Overlay
  - Hover-Effekte

- [ ] Video-Karte Component
  - Thumbnail mit Play-Overlay
  - Titel (max 2 Zeilen)
  - Kanal-Name
  - AI-Status Badge (analysiert/pending/error)
  - Clickbait-Warning falls detektiert
  - Tags als Chips unter Titel

- [ ] Tag-Filter Sidebar
  - Hierarchische Tag-Liste
  - Count-Badges (Python: 23)
  - Multi-Select Filter
  - "Clear All" Button

- [ ] Progressive Enhancement sichtbar machen
  - Skeleton-Loader während YouTube-Fetch
  - Sparkle-Animation wenn AI-Analyse fertig
  - Live-Update der Karte ohne Page-Refresh

- [ ] Search Bar
  - Einfache Titel-Suche
  - Debouncing (300ms)
  - Clear-Button

- [ ] View Toggle
  - Grid vs List View
  - User Preference speichern (LocalStorage)

### Warum jetzt?

- **YouTube-Nutzer erwarten YouTube-UX** - Thumbnails > Tabellen
- **AI-Status muss sichtbar sein** - Progressive Enhancement zeigen
- **Tags brauchen UI** - Sidebar-Filter für Tag-System aus Phase 2
- **Vor Onboarding** - Onboarding muss diese UI demonstrieren

### Erfolgskriterium

✅ Grid zeigt Videos mit Thumbnails → Hover zeigt Preview → Click auf Tag filtert Grid → AI-Badge erscheint live nach Analyse

---

## Phase 4: Video-Import vereinfachen (EINSTIEGSHÜRDE SENKEN)

**Ziel:** Mehrere Import-Methoden neben CSV
**Aufwand:** 3-4 Stunden
**Priorität:** MITTEL (Adoption-Verbesserung)

### Aufgaben

- [ ] Drag & Drop URLs
  - Drop-Zone über Grid
  - URL-Extraktion aus Drop-Event
  - Batch-Upload von mehreren URLs
  - Visual Feedback während Upload

- [ ] Paste-Erkennung
  - Global Keyboard Listener (Cmd+V / Ctrl+V)
  - YouTube-URL Regex-Erkennung
  - Confirmation Modal bei Paste
  - Bulk-Paste Support (mehrere URLs)

- [ ] Playlist-Import
  - Input-Field für Playlist-URL
  - YouTube API: Liste alle Videos in Playlist
  - Vorschau mit Video-Anzahl
  - Bulk-Import auslösen

- [ ] Channel-Import
  - Input-Field für Channel-URL
  - YouTube API: Liste Kanal-Videos
  - Filter-Optionen (nur neueste X, nur Playlists)
  - Bulk-Import auslösen

- [ ] Backend: Bulk-Import Endpoint
  - `POST /api/lists/{id}/videos/bulk-urls` - Array von URLs
  - YouTube ID Extraktion aus verschiedenen Formaten
  - Duplikat-Erkennung
  - Background Job für große Imports

### Warum jetzt?

- **CSV ist zu technisch** - Consumer erwarten Drag & Drop
- **Schneller Bulk-Import** - Playlist/Channel = 50+ Videos auf einmal
- **Grid bietet Drop-Ziel** - Phase 3 Grid ist perfektes Drag-Target
- **Vor Onboarding** - Onboarding kann diese Features nutzen

### Erfolgskriterium

✅ User zieht YouTube-URL ins Grid → Video erscheint sofort → Paste von 10 URLs → Alle importiert → Playlist-URL → 42 Videos importiert

---

## Phase 5: Onboarding-Flow (ERSTE EINDRUCK)

**Ziel:** Geführter Start mit AI-Assistent
**Aufwand:** 8-12 Stunden
**Priorität:** KRITISCH (Adoption)

### Aufgaben

- [ ] Step 1: Welcome Screen
  - Begrüßung mit App-Erklärung
  - "Get Started" Button
  - Skip für returning users

- [ ] Step 2: Interesse-Auswahl
  - AI fragt: "Was interessiert dich?"
  - Vordefinierte Chips (AI, Programming, Travel, etc.)
  - Freitext-Input
  - "Weiter" Button

- [ ] Step 3: Ziel-Definition
  - AI fragt: "Was möchtest du lernen/erreichen?"
  - Freitext Input
  - Beispiele als Suggestions

- [ ] Step 4: AI Magic Moment
  - "Ich baue deine Library auf..." Message
  - AI importiert 30-50 Videos aus curated sources
  - Live-Progress mit WebSocket
  - AI analysiert Videos parallel
  - Status: "Analysiere Video 15/47..."

- [ ] Step 5: Library Ready
  - "Fertig! 47 Videos gefunden" Message
  - Kurze Zusammenfassung der AI-Analysen
  - "Zur Library" Button
  - Grid zeigt bereits gefüllte Library

- [ ] Step 6: Tutorial Overlays
  - Tooltips über wichtigen UI-Elementen
  - "Drag URLs hier" über Grid
  - "Filter nach Tags" über Sidebar
  - "Chat mit mir" über Chat-Button (wenn Phase 6 fertig)
  - Skip-Option

- [ ] Backend: Curated Video Sources
  - Datenbank mit "Starter Videos" pro Thema
  - API: `GET /api/onboarding/videos?interests=python,ai`
  - Hochwertiger Content (kein Clickbait)
  - Regelmäßig aktualisiert

- [ ] Onboarding State Management
  - LocalStorage: Onboarding completed?
  - Database: User.onboarding_completed
  - Skip-Option persistent speichern

### Warum jetzt?

- **Erste 60 Sekunden entscheiden** - Leere App = User verlässt sofort
- **Braucht alle vorherigen Phasen** - Grid (3), Import (4), AI (1), Tags (2)
- **Zeigt alle Features in Aktion** - User sieht sofort den Wert
- **Letzter Schritt vor Beta** - Danach kann echtes User-Testing beginnen

### Erfolgskriterium

✅ Neuer User → Onboarding in 2-3 Minuten → Library hat 47 analysierte Videos → User versteht Features → Kann sofort loslegen

---

## Phase 6: AI Chat-Interface (CONVERSATIONAL DISCOVERY)

**Ziel:** Chat mit AI über die Video-Library
**Aufwand:** 10-15 Stunden
**Priorität:** MITTEL (Differenzierung)

### Aufgaben

- [ ] Chat-Widget UI
  - Floating Chat Button (rechts unten)
  - Expandable Chat Panel
  - Message History
  - Input Field mit Auto-Resize
  - Typing Indicator

- [ ] Backend: Chat API
  - `POST /api/chat` - User Message senden
  - Streaming Response (Server-Sent Events)
  - Context: User's Video Library
  - LLM Integration (Gemini oder OpenAI)

- [ ] Chat Prompts & Tools
  - System Prompt: "Du bist AI Assistant für YouTube Library"
  - Context: Videos mit extracted_data
  - Functions: search_videos(), recommend_learning_path(), create_analysis()

- [ ] Conversational Discovery
  - "Zeig mir Videos über FastAPI"
  - AI durchsucht Library
  - Zeigt relevante Videos als Karten

- [ ] Lernpfad-Generierung
  - "Ich will Python lernen"
  - AI analysiert Library
  - Erstellt Schritt-für-Schritt Plan
  - Sortiert Videos nach Schwierigkeit

- [ ] Video-Empfehlungen
  - "Was soll ich als nächstes schauen?"
  - AI berücksichtigt: watched status, difficulty, interests
  - Personalisierte Vorschläge

- [ ] Message Persistence
  - Chat-History in Database
  - Per User und Session
  - Clear History Option

### Warum später?

- **Braucht gefüllte Library** - Onboarding (Phase 5) liefert initiale Videos
- **Braucht AI-Analysen** - Phase 1 muss funktionieren
- **Komplex: LLM-Integration** - Context-Management, Tool-Calling, Streaming
- **Nice-to-have, nicht MVP** - App funktioniert ohne Chat

### Erfolgskriterium

✅ User chattet: "Zeig mir Python Tutorials für Anfänger" → AI findet 8 Videos → "Erstelle Lernpfad" → AI sortiert Videos nach Progression

---

## Phase 7: Custom Analyses (USER-DEFINED FILTERS)

**Ziel:** Nutzer können eigene Analyse-Aufgaben erstellen
**Aufwand:** 8-12 Stunden
**Priorität:** NIEDRIG (Power-User Feature)

### Aufgaben

- [ ] Analysis Creation via Chat
  - User: "Erkenne ob Videos sponsored content enthalten"
  - AI versteht Intent
  - Erstellt Pydantic Schema automatisch
  - Zeigt Preview mit Beispiel-Feld

- [ ] Schema Builder UI (Alternative zu Chat)
  - Manual Mode für Power-Users
  - Field-Type Auswahl (String, Boolean, Array)
  - Description Input
  - Preview mit Schema-JSON

- [ ] Analysis Application
  - User wählt: Auf alle Videos oder nur Tags [Python, Tutorial]
  - Background Job startet
  - Progress-Bar zeigt Status
  - Ergebnisse in `extracted_data` JSONB

- [ ] Backend: Analysis Tasks Table
  - Schema aus Product Vision: `analysis_tasks` table
  - CRUD für User-defined Analyses
  - `analysis_results` table für Results

- [ ] Results Display
  - Neue Felder erscheinen in Video-Karten
  - Filter nach Analysis Results
  - "Zeige nur sponsored content" Toggle

- [ ] Analysis Management
  - Liste aller eigenen Analyses
  - Enable/Disable Toggle
  - Re-run auf neue Videos
  - Delete Analysis (behält Results)

### Warum ganz zum Schluss?

- **Braucht Chat (Phase 6)** - UX ohne Chat zu komplex
- **Braucht stabile AI-Pipeline** - Phase 1 muss fehlerfrei laufen
- **Braucht Tag-System** - Analyses auf Tag-Subsets anwenden
- **Fortgeschrittenes Feature** - 90% der User brauchen es nicht initial
- **Komplexe Validierung** - Schema-Erstellung, Fehlerbehandlung

### Erfolgskriterium

✅ User erstellt Analysis "Sponsored Content Detection" → Wendet auf Tag "Review" an → 15 Videos analysiert → Filter zeigt 3 Videos mit "is_sponsored: true"

---

## Erfolgskriterien pro Phase

### Phase 1: AI-Analyse
- [ ] Video wird hochgeladen
- [ ] Gemini analysiert Transkript
- [ ] `extracted_data` enthält: Clickbait, Difficulty, Category, Tags
- [ ] Frontend zeigt AI-Daten an

### Phase 2: Tag-System
- [ ] Video hat mehrere Tags
- [ ] Filter nach Tag funktioniert
- [ ] Tags werden erstellt/bearbeitet/gelöscht
- [ ] AI schlägt Tags vor (optional)

### Phase 3: YouTube-Grid
- [ ] Grid zeigt Videos mit Thumbnails
- [ ] Tag-Filter in Sidebar funktioniert
- [ ] AI-Status ist sichtbar
- [ ] Progressive Enhancement zeigt Live-Updates

### Phase 4: Import
- [ ] Drag & Drop von URLs funktioniert
- [ ] Paste-Erkennung importiert URLs
- [ ] Playlist-Import lädt alle Videos
- [ ] Channel-Import funktioniert

### Phase 5: Onboarding
- [ ] Neuer User durchläuft 6 Steps
- [ ] AI importiert initiale Videos
- [ ] Library ist nach 2-3 Minuten gefüllt
- [ ] User versteht grundlegende Features

### Phase 6: AI Chat
- [ ] User kann mit AI chatten
- [ ] AI durchsucht Library
- [ ] Lernpfad-Generierung funktioniert
- [ ] Empfehlungen sind relevant

### Phase 7: Custom Analyses
- [ ] User erstellt eigene Analysis
- [ ] Schema wird an Gemini gesendet
- [ ] Ergebnisse werden gespeichert
- [ ] Filter nach Analysis Results funktioniert

---

## Technischer Stack - Übersicht

### Bereits vorhanden:
- **Backend:** FastAPI, SQLAlchemy 2.0 async, PostgreSQL 16
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **State:** Zustand, TanStack Query, react-use-websocket
- **AI:** Google Gemini 2.0 Flash Client (bereit)
- **APIs:** YouTube Data API v3 (integriert)
- **Infrastruktur:** Redis, ARQ Workers, WebSocket

### Neu hinzuzufügen:
- **Phase 2:** SQLAlchemy Many-to-Many für Tags
- **Phase 3:** TanStack Table (optional), Framer Motion für Animationen
- **Phase 6:** Server-Sent Events oder WebSocket für Chat Streaming
- **Phase 7:** Dynamic Pydantic Schema Creation (teilweise vorhanden)

---

## Zeitplan (Schätzung)

| Phase | Aufwand | Kumulative Zeit |
|-------|---------|----------------|
| Phase 1: AI-Analyse | 2-3h | 3h |
| Phase 2: Tag-System | 4-6h | 9h |
| Phase 3: YouTube-Grid | 5-7h | 16h |
| Phase 4: Import | 3-4h | 20h |
| Phase 5: Onboarding | 8-12h | 32h |
| Phase 6: AI Chat | 10-15h | 47h |
| Phase 7: Custom Analyses | 8-12h | 59h |

**Total:** 40-60 Stunden für vollständige Vision

---

## Nächster Schritt

**Empfehlung:** Mit Phase 1 starten

**Grund:**
- Schnellster Weg zum sichtbaren Mehrwert
- Validiert Kern-Technologie
- Foundation für alle späteren Features
- 2-3 Stunden = sofort machbar

**Alternative:** Wenn User-Testing Priorität hat, Phase 3 (Grid) vor Phase 1 für bessere Optik.

---

**Dokument-Version:** 1.0
**Erstellt:** 2025-10-30
**Status:** Planung - Bereit zur Umsetzung
