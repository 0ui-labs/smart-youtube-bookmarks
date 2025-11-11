# AI Integration - Complete UX Design

**Datum:** 2025-11-11
**Status:** Design Complete - Ready for Implementation
**Bezieht sich auf:** `docs/plans/2025-10-30-ID-00-consumer-app-roadmap.md`

---

## Übersicht

Dieses Dokument beschreibt die vollständige User Experience für die AI-Integration in Smart YouTube Bookmarks. Die App wird von einem einfachen Video-Manager zu einer intelligenten, kontextuellen Bibliothek mit AI-gestützter Analyse und Konversations-Interface.

**Core Value Proposition:**
"Skip the Fluff - Deine YouTube-Bibliothek zeigt dir nur was wirklich relevant ist. Python Tutorials bekommen andere Analyse-Felder als Keto Rezepte."

---

## Implementierungsstrategie

**Empfohlene Reihenfolge: AI-First Approach**

1. **AI-Analyse (Phase 1):** Worker + Gemini Integration (~2-3h)
2. **Analysis-UI:** Settings Page für Template-Management (~4-6h)
3. **Chat (Phase 6):** Floating Button + Conversational UX (~10-15h)
4. **Onboarding (Phase 5):** Guided Flow mit allen Features (~8-10h)
5. **Enhanced Import (Phase 4):** Drag&Drop, Playlist/Channel (~6-8h)
6. **Custom Analyses (Phase 7):** Chat-basierte Schema Creation (~8-10h)

**Warum AI-First:**
- AI ist der USP - muss früh funktionieren
- Chat braucht AI-Daten um nützlich zu sein
- Onboarding zeigt alle Features - muss letzter Schritt sein
- Import-Verbesserungen sind Enhancement, nicht Blocker

---

## 1. Onboarding Flow

**Ziel:** User versteht das Tag-basierte Analyse-System und hat nach 2-3 Minuten eine gefüllte, analysierte Library.

### Schritt 1: Welcome Screen

```
┌──────────────────────────────────────────┐
│                                          │
│       Deine intelligente                 │
│       YouTube-Bibliothek                 │
│                                          │
│   Organisiere Videos mit AI-Unterstützung│
│                                          │
│           [Get Started]                  │
│                                          │
│           [Skip →]                       │
└──────────────────────────────────────────┘
```

**Interaktion:**
- [Get Started] → Schritt 2
- [Skip] → Leeres Grid mit [+ Video hinzufügen] Button

---

### Schritt 2: Interesse-Auswahl

```
┌──────────────────────────────────────────┐
│ AI: "Was interessiert dich?"             │
├──────────────────────────────────────────┤
│ Wähle 2-5 Themen:                        │
│                                          │
│ Vordefinierte Chips (klickbar):          │
│ [Python] [AI] [Tutorial] [Reviews]       │
│ [Gaming] [Kochen] [Fitness] [Travel]     │
│ [+ Mehr anzeigen]                        │
│                                          │
│ Oder beschreibe selbst:                  │
│ [Freitext-Input...]                      │
│                                          │
│ Ausgewählt: [Python] [AI] [Tutorial]    │
│                                          │
│           [Weiter →]                     │
└──────────────────────────────────────────┘
```

**Logik:**
- Minimum 1 Interesse, Maximum 5
- Freitext wird als Custom-Tag behandelt
- Ausgewählte Interessen bestimmen Standard-Analysen

---

### Schritt 3: Analysis Preview & Customization

```
┌──────────────────────────────────────────┐
│ AI: "Ich schlage diese Analysen vor:"   │
├──────────────────────────────────────────┤
│ 💡 Wichtig zu verstehen:                 │
│                                          │
│ Verschiedene Video-Typen brauchen        │
│ unterschiedliche Informationen!          │
│                                          │
│ Beispiel:                                │
│ [Python Tutorial]                        │
│   → Schwierigkeit, Code-Qualität         │
│                                          │
│ [Keto Rezept]                            │
│   → Kalorien, Zubereitungszeit           │
│                                          │
│ [Product Review]                         │
│   → Preis, Vor/Nachteile, Sponsored      │
│                                          │
│ Du entscheidest welche Felder für       │
│ welche Tags relevant sind! ✨            │
└──────────────────────────────────────────┘

Standard-Analysen (basierend auf Interessen):
┌──────────────────────────────────────────┐
│ ✓ Schwierigkeitsgrad                     │
│   Beginner/Intermediate/Advanced         │
│   📊 Für: Alle Videos                    │
│   [Vorschau] [Anpassen]                  │
├──────────────────────────────────────────┤
│ ✓ Tutorial-Qualität (1-5 ⭐)             │
│   Wie gut erklärt das Video?             │
│   📊 Für: [Tutorial] Tag                 │
│   [Vorschau] [Anpassen]                  │
├──────────────────────────────────────────┤
│ ✓ Code-Beispiele & Repo-Link             │
│   Hat praktische Code-Beispiele?         │
│   📊 Für: [Tutorial], [Programming]      │
│   [Vorschau] [Anpassen]                  │
├──────────────────────────────────────────┤
│ 💡 HIGHLIGHT CARD                        │
│                                          │
│ ✨ Eigene Analyse erstellen              │
│                                          │
│ "Skip the Fluff - Zeig mir nur was      │
│  wirklich wichtig ist"                   │
│                                          │
│ Die KI schaut sich Videos für dich an   │
│ und filtert nach deinen Kriterien.      │
│                                          │
│ Beispiele:                               │
│ • "Zeig nur Videos mit Timestamps"      │
│ • "Erkenne gesponserte Inhalte"         │
│ • "Hat das Video Untertitel?"           │
│                                          │
│ [✨ Eigene Analyse erstellen]           │
│ [Später im Chat]                         │
└──────────────────────────────────────────┘

[Analysen anpassen] [Los geht's →]
```

**Klick auf [✨ Eigene Analyse erstellen]:**

```
┌──────────────────────────────────────────┐
│ Was möchtest du aus Videos filtern?     │
├──────────────────────────────────────────┤
│ [Beschreibe es in 1-2 Sätzen...]        │
│                                          │
│ Quick Examples (klickbar):               │
│ • 💰 Zeig ob Video Sponsoring hat        │
│ • 📝 Erkenne ob es Timestamps gibt       │
│ • 🎬 Bewerte Produktionsqualität (1-5)   │
│ • 📚 Hat das Video Untertitel?           │
│                                          │
│ [Abbrechen] [Analyse erstellen →]       │
└──────────────────────────────────────────┘

→ User tippt: "Zeig ob Video Sponsoring hat"
→ AI generiert Schema in 2-3s

┌──────────────────────────────────────────┐
│ ✅ Analyse erstellt!                     │
├──────────────────────────────────────────┤
│ Name: Sponsored Content Detection        │
│                                          │
│ Die AI wird extrahieren:                │
│ • has_sponsoring (Ja/Nein)               │
│ • sponsor_name (Text, optional)          │
│ • disclosure_present (Ja/Nein)           │
│                                          │
│ 💡 Auf welche Videos anwenden?           │
│                                          │
│ Empfehlung: Nur [Product Review] und    │
│ [Tech Review] Tags, weil Sponsoring     │
│ dort am häufigsten vorkommt.             │
│                                          │
│ ○ Alle Videos                            │
│ ● Nur mit Tags: [Product Review]        │
│                 [Tech Review]            │
│                                          │
│ [Bearbeiten] [Zur Liste hinzufügen ✓]   │
└──────────────────────────────────────────┘

→ Card erscheint in der Liste
```

---

### Schritt 4: AI Magic Moment - Auto-Import

```
┌──────────────────────────────────────────┐
│ AI: "Ich importiere passende Videos     │
│      für dich..."                        │
│                                          │
│ Skip the Fluff - Ich zeige dir nur      │
│ Videos die deinen Kriterien entsprechen.│
│ Kein Clickbait, keine Zeit-Verschwendung.│
│                                          │
│ [████████░░░░] 30 Videos gefunden       │
└──────────────────────────────────────────┘

→ Videos erscheinen SOFORT im Grid:
```

**Wichtig:** Videos erscheinen inline im Grid (nicht Modal), wie in Section 2 beschrieben:
- YouTube-Metadata kommt schnell (1-2s)
- Skeleton-Loader minimal
- AI-Analysen laufen parallel im Hintergrund
- Progress Bars + Sparkle-Animationen

**Toast-Notification:**
```
┌──────────────────────────────────────────┐
│ 🔄 Analysiere 30 Videos...          [×] │
│ ████████░░░░ 12/30                      │
│                                          │
│ Zuletzt: "Python Basics" ✓              │
│ [Details] [Im Hintergrund fortsetzen]   │
└──────────────────────────────────────────┘
```

---

### Schritt 5: Library Ready

```
Grid zeigt 30 Videos:
- Metadata sofort sichtbar (Thumbnail, Titel)
- AI-Badges erscheinen nach und nach
- Sparkle-Animation bei jedem Badge

Toast:
┌──────────────────────────────────────────┐
│ ✨ 12 Videos analysiert, 18 laufen noch  │
└──────────────────────────────────────────┘

Floating Chat Button pulsiert 1x (subtil)
Tooltip: "Frag mich etwas über deine Videos"
```

---

### Schritt 6: Feature Discovery (Tutorial Overlays)

**1. Chat Button:**
```
┌─────────────────────────────────────────┐
│ 💬 Frag mich alles über deine Videos!  │
│                                         │
│ Beispiele:                              │
│ • "Zeig mir Python Tutorials"          │
│ • "Erstelle Lernpfad für FastAPI"      │
│ • "Erkenne gesponserte Videos" ✨      │
│                                         │
│ [Verstanden]                            │
└─────────────────────────────────────────┘
```

**2. Settings Icon:**
```
┌─────────────────────────────────────────┐
│ ⚙️ Analysen verwalten                   │
│                                         │
│ Hier kannst du:                         │
│ • Standard-Analysen anpassen            │
│ • Neue Analysen manuell erstellen       │
│ • Analysen aktivieren/deaktivieren      │
│                                         │
│ Tipp: Du kannst auch die AI im Chat    │
│ bitten, Analysen für dich zu erstellen! │
│                                         │
│ [Zu den Einstellungen] [Später]        │
└─────────────────────────────────────────┘
```

**3. Video Card:**
```
┌─────────────────────────────────────────┐
│ ✨ AI-Analyse läuft                     │
│                                         │
│ Diese Badges zeigen AI-Ergebnisse.     │
│ Klick auf "..." um Video zu öffnen     │
│ und alle Details zu sehen.              │
│                                         │
│ [OK]                                    │
└─────────────────────────────────────────┘
```

**4. Tag Sidebar:**
```
┌─────────────────────────────────────────┐
│ 🏷️ Filtere mit Tags                     │
│                                         │
│ Tags organisieren deine Videos.         │
│ Klick auf einen Tag zum Filtern.       │
│                                         │
│ [OK] [Tutorial überspringen]           │
└─────────────────────────────────────────┘
```

**Skip-Option:** Jedes Overlay hat [Tutorial überspringen]

---

## 2. Tägliche Nutzung - Video Upload & AI-Analyse

### 2.1 Upload Entry Points

```
Grid View:
┌─────────────────────────────────────────┐
│ [Logo]                    [+ Add] [⚙️]  │
├─────────────────────────────────────────┤
│ [Sidebar]  [Video][Video][Video]        │
│            [Video][Video][Video]        │
│                                         │
│            [+ Drop URLs here]           │
│                                         │
│                          [💬]           │
└─────────────────────────────────────────┘

User hat 4 Optionen:
1. [+ Add] Button → Quick Add Modal
2. Drag & Drop URL ins Grid
3. Cmd+V / Paste Detection
4. Chat: "Füge dieses Video hinzu: [URL]"
```

---

### 2.2 Quick Add Modal

```
┌──────────────────────────────────────────┐
│ Video hinzufügen                    [×]  │
├──────────────────────────────────────────┤
│ YouTube-URL *                            │
│ [https://youtube.com/watch?v=...]       │
│                                          │
│ Tags (optional):                         │
│ [Python] [Tutorial] [+ Neuer Tag]       │
│  ↑ Aktuell ausgewählte Tags werden      │
│     automatisch vorgeschlagen            │
│                                          │
│ [Abbrechen] [Hinzufügen →]              │
└──────────────────────────────────────────┘
```

---

### 2.3 Progressive Enhancement - Inline im Grid

**Sofort nach Upload (optimistic update):**
```
┌──────────────────────────────────┐
│ [Thumbnail Skeleton]             │
│                                  │
│ [████░░░░░░] 40%                │
│ Lade Metadaten...                │
│                                  │
│ [Skeleton] [Skeleton]            │
└──────────────────────────────────┘
```

**Nach 1-2s (YouTube API):**
```
┌──────────────────────────────────┐
│ [Thumbnail ✓]                    │
│                15:34              │
│                                  │
│ FastAPI Tutorial Part 1          │
│ Code With Antonio               │
│                                  │
│ [Python] [Tutorial]              │
│                                  │
│ [████████░░] 80%                │
│ 🤖 AI analysiert...              │
│                                  │
│ [Skeleton] [Skeleton]            │
└──────────────────────────────────┘
```

**Nach 5-10s (Gemini fertig):**
```
┌──────────────────────────────────┐
│ [Thumbnail]                      │
│                15:34              │
│                                  │
│ FastAPI Tutorial Part 1          │
│ Code With Antonio               │
│                                  │
│ [Python] [Tutorial]              │
│                                  │
│ ✨ Sparkle-Animation             │
│                                  │
│ [Beginner] [⭐⭐⭐⭐⭐] [✓ Code] │
│ [+2 more]                        │
└──────────────────────────────────┘
```

---

### 2.4 Bulk Upload (5+ Videos)

**Toast Notification:**
```
┌──────────────────────────────────────────┐
│ 🔄 Analysiere 20 Videos...          [×] │
│ ████████░░░░░░ 12/20                    │
│                                          │
│ Zuletzt: "Python Basics" ✓              │
│ Aktuell: "FastAPI Advanced..." 80%      │
│                                          │
│ [Details anzeigen]                       │
└──────────────────────────────────────────┘
```

**Klick auf [Details]:**
```
┌──────────────────────────────────────────┐
│ Bulk Upload Progress               [×]  │
├──────────────────────────────────────────┤
│ 12 von 20 Videos analysiert             │
│                                          │
│ ✅ Python Basics                         │
│ ✅ FastAPI Tutorial Part 1               │
│ 🔄 FastAPI Advanced (80%)               │
│ ⏳ Database Design (in queue)           │
│ ... 16 weitere                           │
│                                          │
│ [Im Hintergrund fortsetzen]             │
└──────────────────────────────────────────┘
```

**User kann:**
- Modal offen lassen (Live-Progress)
- [×] klicken (läuft im Hintergrund)
- Grid weiter nutzen (Videos clickbar sobald Metadata da ist)

---

### 2.5 Scope-basierte Analyse-Ausführung

**Wichtig:** Nur relevante Analysen laufen!

**Beispiel - User fügt Video mit Tags [Product Review] hinzu:**

```
Toast:
┌──────────────────────────────────────────┐
│ 🤖 Analysiere Video... (2 Analysen) [×] │
│                                          │
│ Aktive Analysen für [Product Review]:   │
│ ✓ Schwierigkeitsgrad (alle Videos)      │
│ 🔄 Sponsored Content (80%)               │
│                                          │
│ Nicht angewendet:                        │
│ • Tutorial-Qualität (nur [Tutorial])     │
│ • Code-Beispiele (nur [Tutorial])        │
└──────────────────────────────────────────┘
```

**Video-Card zeigt nur relevante Badges:**
```
┌──────────────────────────────────┐
│ [Thumbnail]                      │
│ iPhone 15 Review                 │
│                                  │
│ [Product Review] [Tech]          │
│                                  │
│ [Intermediate]                   │ ← Schwierigkeitsgrad (alle)
│ 💰 [Sponsored]                   │ ← Sponsored (scopped)
│                                  │
│ NO Tutorial-Qualität Badge       │ ← Nicht scopped!
└──────────────────────────────────┘
```

---

### 2.6 VideoDetailsModal während Analyse

```
User klickt auf Video während AI läuft:

┌──────────────────────────────────────────┐
│ FastAPI Tutorial Part 1            [×]  │
├──────────────────────────────────────────┤
│ [YouTube Player Embed]                   │
│                                          │
│ Code With Antonio • 15:34 • 123k Views  │
│                                          │
│ Beschreibung: [...]                      │
│                                          │
│ 🤖 AI-Analyse (läuft gerade...)         │
│ ████████░░░░░░ 60%                      │
│                                          │
│ Schwierigkeit: [Shimmer Skeleton]        │
│ Qualität: [Shimmer Skeleton]             │
│ Code-Beispiele: [Shimmer Skeleton]       │
└──────────────────────────────────────────┘

Nach 5s - Live Update (WebSocket):

│ ✨ AI-Analyse abgeschlossen              │
│                                          │
│ Schwierigkeit: Beginner                  │
│ Qualität: ⭐⭐⭐⭐⭐                      │
│ Code-Beispiele: ✓ Ja                     │
│ Timestamps: ✓ Vorhanden                  │
```

---

## 3. Chat Interface - Conversational Discovery

### 3.1 Chat Placement

**Floating Button (rechts unten):**

```
Initial State (nach Onboarding):
┌─────────────────────────────────────────┐
│  [Video Grid]                           │
│                                         │
│                          ┌────────────┐ │
│                          │ 💬  1      │ │ ← Badge, pulsiert 1x
│                          │ ✨         │ │
│                          └────────────┘ │
└─────────────────────────────────────────┘

Tooltip: "Frag mich etwas über deine Videos"

Nach 5 Interaktionen (subtil):
┌────────────┐
│ 💬         │ ← Kein Badge, kein Pulsieren
└────────────┘

User Settings - Hide Chat:
→ Nur noch Cmd+K Shortcut
```

---

### 3.2 Chat Panel - Expanded (Desktop)

```
Grid View (70%) | Chat Panel (30%, min 400px)
┌────────────────────┬──────────────────────┐
│ [Video][Video]     │ Chat mit AI     [−] │
│ [Video][Video]     ├──────────────────────┤
│                    │ 💡 Ich kann:        │
│                    │ • Videos finden     │
│                    │ • Lernpfade         │
│                    │   erstellen         │
│                    │ • Analysen          │
│                    │   erstellen         │
│                    │                     │
│                    │ Probiere:           │
│                    │ [Zeig Python]       │
│                    │ [Erstelle Lernpfad] │
│                    │                     │
│                    ├──────────────────────┤
│                    │ [Frage eingeben...] │
│                    │            [Send →] │
└────────────────────┴──────────────────────┘
```

**Mobile (<768px) - Full-Screen Overlay:**
```
┌──────────────────────────────────────────┐
│ [←] Chat mit AI                     [×] │
├──────────────────────────────────────────┤
│ AI: Hi! Was kann ich für dich tun?      │
│                                          │
│ [Zeig Python]                            │
│ [Erstelle Lernpfad]                      │
│                                          │
├──────────────────────────────────────────┤
│ [Frage eingeben...]            [Send →] │
└──────────────────────────────────────────┘
```

---

### 3.3 Chat Use Cases

#### Use Case 1: Video-Suche & Discovery

```
User: "Zeig mir Python Tutorials für Anfänger"

Chat:
┌──────────────────────────────────────────┐
│ User: Zeig mir Python Tutorials für     │
│       Anfänger                           │
│                                          │
│ AI: Ich habe 8 Videos gefunden die      │
│     passen. Filtere das Grid jetzt...   │
│     ✓ Fertig                             │
│                                          │
│ [Lernpfad erstellen?] [Mehr Videos]     │
└──────────────────────────────────────────┘

Grid (automatisch gefiltert):
┌──────────────────────────────────────────┐
│ 🔍 Gefiltert durch AI Chat          [×] │
│ 8 Videos gefunden                        │
├──────────────────────────────────────────┤
│ [Video: Python Basics]    [Beginner]    │
│ [Video: Variables]        [Beginner]    │
│ ...                                      │
└──────────────────────────────────────────┘
```

---

#### Use Case 2: Lernpfad-Generierung

```
User: "Erstelle Lernpfad für FastAPI"

Chat:
┌──────────────────────────────────────────┐
│ AI: Ich analysiere deine Videos...      │
│     [████████░░] 80%                    │
│                                          │
│ ✓ Lernpfad erstellt mit 12 Videos       │
│                                          │
│ Soll ich eine Playlist erstellen?       │
│                                          │
│ Name: "FastAPI Lernpfad"                │
│ [Playlist erstellen] [Nur filtern]      │
└──────────────────────────────────────────┘

User klickt [Playlist erstellen]:

Chat:
┌──────────────────────────────────────────┐
│ AI: ✓ Playlist "FastAPI Lernpfad"       │
│     wurde erstellt!                      │
│                                          │
│ Du findest sie in der Sidebar unter     │
│ Tags. Videos sind in Lernreihenfolge    │
│ sortiert.                                │
└──────────────────────────────────────────┘

Sidebar (automatisch erweitert):
┌──────────────────────────────────────────┐
│ Tags                                     │
├──────────────────────────────────────────┤
│ [Python]                            23   │
│ [Tutorial]                          45   │
│ ✨ [FastAPI Lernpfad] ← NEU         12  │ ← Pulsiert 1x
│    (Playlist)                            │
└──────────────────────────────────────────┘

Grid (gefiltert, nach Position sortiert):
┌──────────────────────────────────────────┐
│ 📚 Playlist: FastAPI Lernpfad       [×] │
│ 12 Videos • Sortiert nach Lernfortschritt│
├──────────────────────────────────────────┤
│ 1. [FastAPI Basics]       [Beginner]    │
│ 2. [Installation]         [Beginner]    │
│ 3. [First API]            [Beginner]    │
│ 4. [Routing]              [Intermediate] │
│ ...                                      │
└──────────────────────────────────────────┘
```

**Technische Note:** Playlist = Tag mit `position` Metadata in `video_tags` Junction Table

---

#### Use Case 3: Analyse erstellen via Chat

```
User: "Erkenne ob Videos Sponsored Content enthalten"

Chat:
┌──────────────────────────────────────────┐
│ AI: Gute Idee! Für welche Videos?       │
│                                          │
│ Ich empfehle:                            │
│ Nur für Tags: [Product Review], [Tech]  │
│                                          │
│ Warum? Sponsored Content ist nur für    │
│ Reviews relevant, nicht für [Tutorial]  │
│ oder [Rezept] 😊                         │
│                                          │
│ ○ Alle Videos                            │
│ ● Nur: [Product Review] (12),           │
│        [Tech Review] (8)                 │
│   → 20 Videos                            │
│                                          │
│ [Scope ändern] [Analyse erstellen]       │
└──────────────────────────────────────────┘

User klickt [Analyse erstellen]:

Chat:
┌──────────────────────────────────────────┐
│ AI: ✓ Analyse aktiviert!                 │
│                                          │
│     Analysiere 20 Videos...              │
│     [████████░░░░] 12/20                │
│                                          │
│ Zuletzt: "Product Review XYZ" ✓         │
│          → has_sponsoring: Ja            │
│                                          │
│ [Details] [Im Hintergrund fortsetzen]   │
└──────────────────────────────────────────┘

Video-Cards im Grid (live updates):
┌──────────────────────────────────┐
│ [Thumbnail]                      │
│ Product Review: iPhone 15        │
│                                  │
│ [Review] [Tech]                  │
│ [Beginner] [⭐⭐⭐⭐]            │
│ 💰 [Sponsored] ← NEU erscheint  │ ← Sparkle-Animation
└──────────────────────────────────┘
```

---

#### Use Case 4: Analyse-Erklärung (Context-Aware)

```
User klickt auf Video mit [⚠️ Clickbait] Badge
→ Video Details Modal öffnet sich

User im Chat: "Warum ist das als Clickbait markiert?"

Chat (weiß welches Video offen ist):
┌──────────────────────────────────────────┐
│ User: Warum ist das als Clickbait       │
│       markiert?                          │
│                                          │
│ AI: Für "10X Your Coding Speed!!!":     │
│                                          │
│ Gründe:                                  │
│ • Titel enthält übertriebene Claims     │
│   ("10X", "!!!")                         │
│ • Thumbnail mit shocked face            │
│ • Video-Inhalt erfüllt Versprechen      │
│   nur teilweise                          │
│                                          │
│ Möchtest du die Clickbait-Erkennung     │
│ anpassen?                                │
│                                          │
│ [Analyse bearbeiten] [Nein, passt]      │
└──────────────────────────────────────────┘
```

---

#### Use Case 5: Kontextuelle Empfehlungen (Mixed Content)

```
User: "Erstelle Analyse"

AI erkennt gemischte Content-Typen:

Chat:
┌──────────────────────────────────────────┐
│ AI: Ich sehe du hast verschiedene       │
│     Content-Typen:                       │
│                                          │
│ • 23 Videos mit [Tutorial]               │
│ • 8 Videos mit [Rezept]                  │
│ • 12 Videos mit [Product Review]         │
│                                          │
│ Was möchtest du analysieren?             │
│                                          │
│ Quick-Vorschläge:                        │
│ [Tutorial: Code-Qualität bewerten]       │
│ [Rezept: Zubereitungszeit schätzen]      │
│ [Review: Preis extrahieren]              │
│ [Eigene Idee beschreiben...]             │
└──────────────────────────────────────────┘

User klickt [Rezept: Zubereitungszeit]:

Chat:
┌──────────────────────────────────────────┐
│ AI: ✓ Analyse erstellt!                  │
│                                          │
│ Name: Zubereitungszeit                   │
│ Feld: prep_time (Zahl in Minuten)       │
│                                          │
│ 📊 Wird angewendet auf:                  │
│ [Rezept] Tag → 8 Videos                  │
│                                          │
│ Deine anderen Videos ([Tutorial],        │
│ [Product Review]) bleiben unberührt.     │
│                                          │
│ [Aktivieren] [Scope anpassen]            │
└──────────────────────────────────────────┘
```

---

## 4. Settings Page - Analysis Management

### 4.1 Navigation & Entry Points

```
Main UI Header:
┌─────────────────────────────────────────┐
│ [Logo] Smart YT Bookmarks    [⚙️] [👤] │
└─────────────────────────────────────────┘
                                  ↑
                            Click → Settings

Settings Navigation:
┌──────────────────────────────────────────┐
│ [←] Einstellungen                        │
├──────────────────────────────────────────┤
│ [📊 Analysen]              ← AKTIV       │
│ [🏷️ Tags]                                │
│ [⚙️ Allgemein]                            │
│ [👤 Account]                              │
└──────────────────────────────────────────┘
```

---

### 4.2 Analyse-Übersicht

```
┌──────────────────────────────────────────┐
│ Analysen                            [×]  │
├──────────────────────────────────────────┤
│ [+ Neue Analyse erstellen]               │
│                                          │
│ Aktive Analysen: 6 • Felder gesamt: 12  │
│                                          │
│ 💡 Verschiedene Video-Typen brauchen     │
│    unterschiedliche Informationen!       │
│                                          │
│ Ordne Analysen zu Tags zu, um deine     │
│ Bibliothek sauber und relevant zu        │
│ halten.                                  │
│                                          │
│ Beispiel:                                │
│ • "Kalorien" nur für [Rezept]           │
│ • "Code-Qualität" nur für [Tutorial]    │
│ • "Preis" nur für [Product Review]      │
│                                          │
│ [Wie funktioniert das?]                  │
└──────────────────────────────────────────┘

Filter & Sortierung:
┌──────────────────────────────────────────┐
│ Filtern: [Alle] [Aktiv] [Inaktiv]       │
│ Gruppieren: [Nach Scope] [Nach Datum]   │
└──────────────────────────────────────────┘

Analyse-Liste (gruppiert nach Scope):
┌──────────────────────────────────────────┐
│ 🌐 Globale Analysen (für alle Videos)   │
├──────────────────────────────────────────┤
│ ✅ Schwierigkeitsgrad                    │
│    1 Feld • Zuletzt: vor 2h              │
│    📊 47 Videos analysiert               │
│    [Details] [Bearbeiten] [Deaktivieren] │
├──────────────────────────────────────────┤
│                                          │
│ 🏷️ Tutorial-spezifisch                  │
├──────────────────────────────────────────┤
│ ✅ Tutorial-Qualität                     │
│    2 Felder • Zuletzt: vor 3h            │
│    📊 Für: [Tutorial] → 23 Videos        │
│    [Details] [Bearbeiten] [Deaktivieren] │
├──────────────────────────────────────────┤
│ ✅ Code-Beispiele & Repo                 │
│    2 Felder • Zuletzt: vor 1h            │
│    📊 Für: [Tutorial], [Programming]     │
│       → 35 Videos                        │
│    [Details] [Bearbeiten] [Deaktivieren] │
├──────────────────────────────────────────┤
│                                          │
│ 🏷️ Rezept-spezifisch                    │
├──────────────────────────────────────────┤
│ ✅ Kalorien & Nährwerte                  │
│    3 Felder • Zuletzt: vor 5h            │
│    📊 Für: [Rezept], [Kochen]            │
│       → 15 Videos                        │
│    [Details] [Bearbeiten] [Deaktivieren] │
├──────────────────────────────────────────┤
│ ⚪ Zubereitungszeit (Deaktiviert)        │
│    1 Feld • Nie ausgeführt               │
│    📊 Für: [Rezept] → 8 Videos           │
│    [Details] [Bearbeiten] [Aktivieren]   │
└──────────────────────────────────────────┘
```

---

### 4.3 Neue Analyse erstellen (3-Step Wizard)

**Schritt 1/3: Grundinformationen:**

```
┌──────────────────────────────────────────┐
│ Neue Analyse erstellen             [×]  │
├──────────────────────────────────────────┤
│ Schritt 1/3: Grundinformationen          │
│                                          │
│ Name der Analyse *                       │
│ [z.B. "Sponsored Content Detection"]    │
│                                          │
│ Beschreibung (optional)                  │
│ [Was soll diese Analyse erkennen?...]   │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ 📊 Auf welche Videos anwenden? *         │
│                                          │
│ ○ Alle Videos (47)                       │
│ ● Videos mit bestimmten Tags:           │
│                                          │
│   Verfügbare Tags:                       │
│   □ Python              (18)             │
│   □ Tutorial            (23)             │
│   ✓ Product Review      (12)             │
│   ✓ Tech Review         (8)              │
│   □ Rezept              (8)              │
│   [+ Mehr anzeigen]                      │
│                                          │
│   Tag-Logik:                             │
│   ● Mindestens ein Tag (OR)              │
│   ○ Alle Tags zusammen (AND)             │
│                                          │
│   Vorschau: 20 Videos werden analysiert  │
│                                          │
│ [Abbrechen] [Weiter: Felder definieren →]│
└──────────────────────────────────────────┘
```

**Schritt 2/3: Felder definieren:**

```
┌──────────────────────────────────────────┐
│ Neue Analyse erstellen             [×]  │
├──────────────────────────────────────────┤
│ [←] Schritt 2/3: Felder definieren       │
│                                          │
│ Name: Sponsored Content Detection        │
│ Scope: [Product Review], [Tech Review]   │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ Welche Informationen soll die AI         │
│ extrahieren?                             │
│                                          │
│ Feld 1:                                  │
│ Name: [has_sponsoring]                   │
│ Typ: [Boolean ▼] (Ja/Nein)              │
│ Beschreibung:                            │
│ [Ist das Video gesponsert?]             │
│ [Feld entfernen]                         │
│                                          │
│ Feld 2:                                  │
│ Name: [sponsor_name]                     │
│ Typ: [Text ▼]                            │
│ Optional: ✓ (nur wenn sponsoring = Ja)  │
│ Beschreibung:                            │
│ [Name des Sponsors]                      │
│ [Feld entfernen]                         │
│                                          │
│ Feld 3:                                  │
│ Name: [disclosure_present]               │
│ Typ: [Boolean ▼]                         │
│ Beschreibung:                            │
│ [Wird Sponsoring transparent offengelegt?]│
│ [Feld entfernen]                         │
│                                          │
│ [+ Weiteres Feld hinzufügen]            │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ 💡 Tipp: Einfache Felder funktionieren   │
│    besser. Die AI versteht:              │
│    • Boolean (Ja/Nein)                   │
│    • Text (kurze Antworten)              │
│    • Zahlen (Ratings, Dauer)             │
│    • Select (vordefinierte Optionen)     │
│                                          │
│ [← Zurück] [Weiter: Vorschau →]         │
└──────────────────────────────────────────┘
```

**Schritt 3/3: Vorschau & Aktivierung:**

```
┌──────────────────────────────────────────┐
│ Neue Analyse erstellen             [×]  │
├──────────────────────────────────────────┤
│ [←] Schritt 3/3: Vorschau & Aktivierung  │
│                                          │
│ ✓ Analyse fertig konfiguriert           │
│                                          │
│ Name: Sponsored Content Detection        │
│                                          │
│ Felder (3):                              │
│ • has_sponsoring (Boolean)               │
│ • sponsor_name (Text, optional)          │
│ • disclosure_present (Boolean)           │
│                                          │
│ Scope:                                   │
│ [Product Review] OR [Tech Review]        │
│ → 20 Videos werden analysiert            │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ Was möchtest du tun?                     │
│                                          │
│ ● Jetzt aktivieren & analysieren         │
│   (20 Videos, ~5-10 Min)                 │
│                                          │
│ ○ Speichern ohne zu analysieren          │
│   (kannst später manuell starten)        │
│                                          │
│ [← Zurück] [Analyse erstellen]          │
└──────────────────────────────────────────┘

User klickt [Analyse erstellen]:

Toast:
┌──────────────────────────────────────────┐
│ ✓ Analyse erstellt!                      │
│ Analysiere 20 Videos...                  │
│ [Fortschritt anzeigen]                   │
└──────────────────────────────────────────┘
```

---

### 4.4 Analyse bearbeiten

```
┌──────────────────────────────────────────┐
│ Analyse bearbeiten                 [×]  │
├──────────────────────────────────────────┤
│ Tutorial-Qualität                        │
│                                          │
│ [Tab: Einstellungen] [Tab: Verlauf]     │
│                                          │
│ Name:                                    │
│ [Tutorial-Qualität]                      │
│                                          │
│ Beschreibung:                            │
│ [Bewertet die Qualität von Tutorials]   │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ Felder:                                  │
│                                          │
│ 1. quality_rating (Rating 1-5)           │
│    "Wie gut ist das Tutorial?"           │
│    [Bearbeiten] [Entfernen]              │
│                                          │
│ 2. has_code_examples (Boolean)           │
│    "Hat praktische Code-Beispiele?"      │
│    [Bearbeiten] [Entfernen]              │
│                                          │
│ [+ Feld hinzufügen]                      │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ 📊 Scope:                                │
│ ● Videos mit Tags: [Tutorial] (23)       │
│ [Scope ändern]                           │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ ⚠️ Änderungen wirken sich auf 23 Videos │
│    aus. Möchtest du Videos neu          │
│    analysieren?                          │
│                                          │
│ [Neu analysieren] [Nur speichern]       │
│                                          │
│ [Analyse löschen] [Abbrechen] [Speichern]│
└──────────────────────────────────────────┘

Tab: Verlauf
┌──────────────────────────────────────────┐
│ Analyse-Verlauf                          │
├──────────────────────────────────────────┤
│ Letzte Ausführungen:                     │
│                                          │
│ ✓ 05.11.2025 14:30                       │
│   23 Videos analysiert                   │
│   0 Fehler                               │
│   [Details]                              │
│                                          │
│ ✓ 04.11.2025 09:15                       │
│   18 Videos analysiert                   │
│   1 Fehler (Video nicht verfügbar)       │
│   [Details]                              │
│                                          │
│ [Mehr laden]                             │
└──────────────────────────────────────────┘
```

---

### 4.5 Bulk-Aktionen

```
Multi-Select Mode:

┌──────────────────────────────────────────┐
│ [✓ 3 ausgewählt] [Alle auswählen]       │
│                                          │
│ Aktionen:                                │
│ [Neu analysieren] [Deaktivieren] [Löschen]│
└──────────────────────────────────────────┘

Ausgewählte Analysen:
┌──────────────────────────────────────────┐
│ ✓ ✅ Tutorial-Qualität                   │
│ ✓ ✅ Code-Beispiele                      │
│ ✓ ✅ Schwierigkeitsgrad                  │
│   ✅ Kalorien & Nährwerte                │
└──────────────────────────────────────────┘

Klick auf [Neu analysieren]:

┌──────────────────────────────────────────┐
│ 3 Analysen neu ausführen?                │
├──────────────────────────────────────────┤
│ Folgende Analysen werden neu ausgeführt: │
│                                          │
│ • Tutorial-Qualität (23 Videos)          │
│ • Code-Beispiele (35 Videos)             │
│ • Schwierigkeitsgrad (47 Videos)         │
│                                          │
│ Gesamt: 105 Videos werden analysiert     │
│ Geschätzte Dauer: 15-20 Minuten          │
│                                          │
│ [Abbrechen] [Jetzt analysieren]          │
└──────────────────────────────────────────┘
```

---

## 5. Enhanced Import (Phase 4)

### 5.1 Drag & Drop URLs

```
Grid View - Drop-Zone:

User zieht URL von Browser:

┌─────────────────────────────────────────┐
│ ╔═══════════════════════════════════╗   │
│ ║  📎 Drop URL to add video         ║   │
│ ║  You can drop multiple URLs       ║   │
│ ╚═══════════════════════════════════╝   │
└─────────────────────────────────────────┘

User dropped 1 URL:
→ Video erscheint sofort im Grid (wie Section 2)

User dropped 5 URLs:
→ Toast mit Bulk-Progress (wie Section 2)
```

---

### 5.2 Paste Detection (Cmd+V / Ctrl+V)

```
User kopiert YouTube-URL, macht Cmd+V im Grid:

Modal:
┌──────────────────────────────────────────┐
│ YouTube-URL erkannt                 [×] │
├──────────────────────────────────────────┤
│ Möchtest du dieses Video hinzufügen?    │
│                                          │
│ URL: https://youtube.com/watch?v=abc123  │
│                                          │
│ Tags (optional):                         │
│ [Python] [Tutorial] [+ Neuer Tag]       │
│                                          │
│ [Abbrechen] [Hinzufügen]                │
└──────────────────────────────────────────┘

User kopiert 10 URLs (multi-line):

Modal:
┌──────────────────────────────────────────┐
│ 10 YouTube-URLs erkannt            [×] │
├──────────────────────────────────────────┤
│ Möchtest du diese Videos hinzufügen?    │
│                                          │
│ Gefundene URLs:                          │
│ • https://youtube.com/watch?v=abc123     │
│ • https://youtube.com/watch?v=def456     │
│ ... 8 weitere                            │
│                                          │
│ Tags (optional):                         │
│ [Python] [Tutorial]                      │
│                                          │
│ [Vorschau anzeigen] [Alle hinzufügen]   │
└──────────────────────────────────────────┘
```

---

### 5.3 Playlist-Import

```
User klickt [+ Add] → Dropdown:
[Playlist importieren] ← NEU

Modal:
┌──────────────────────────────────────────┐
│ Playlist importieren               [×]  │
├──────────────────────────────────────────┤
│ YouTube Playlist-URL *                   │
│ [https://youtube.com/playlist?list=...]  │
│                                          │
│ [Playlist laden]                         │
└──────────────────────────────────────────┘

Nach Laden - Preview:
┌──────────────────────────────────────────┐
│ ✓ Playlist gefunden                      │
│                                          │
│ Name: "FastAPI Complete Course"          │
│ Kanal: Code With Antonio                │
│ Videos: 42                               │
│                                          │
│ Import-Optionen:                         │
│ ● Alle Videos (42)                       │
│ ○ Nur erste N Videos: [10]              │
│ ○ Bestimmte Videos auswählen...         │
│                                          │
│ Tags zuweisen (optional):                │
│ [FastAPI] [Tutorial] [+ Tag]            │
│                                          │
│ 💡 Tipp: Ich kann einen Lernpfad mit    │
│    Reihenfolge erstellen!                │
│ ☐ Als Playlist speichern (sortiert)     │
│                                          │
│ [Abbrechen] [42 Videos importieren]     │
└──────────────────────────────────────────┘

User klickt [42 Videos importieren]:
→ Toast mit Bulk-Progress (wie Section 2)
→ Videos erscheinen live im Grid
```

---

### 5.4 Kanal-Import

```
Modal ähnlich wie Playlist:

┌──────────────────────────────────────────┐
│ Kanal importieren                  [×]  │
├──────────────────────────────────────────┤
│ YouTube Kanal-URL *                      │
│ [https://youtube.com/@ChannelName]       │
│                                          │
│ [Kanal laden]                            │
└──────────────────────────────────────────┘

Preview:
┌──────────────────────────────────────────┐
│ ✓ Kanal gefunden                         │
│                                          │
│ Name: Code With Antonio                  │
│ Videos: 234                              │
│                                          │
│ Import-Filter:                           │
│ □ Nur neueste N Videos: [50]            │
│ □ Nur Videos mit Keyword: [FastAPI]     │
│ □ Nur Videos neuer als: [01.01.2024]    │
│                                          │
│ Vorschau: ~50 Videos werden importiert   │
│                                          │
│ Tags zuweisen: [Tutorial]                │
│                                          │
│ [Abbrechen] [Videos importieren]        │
└──────────────────────────────────────────┘

⚠️ Warnung bei zu vielen Videos (>100):

┌──────────────────────────────────────────┐
│ ⚠️ Großer Import                         │
├──────────────────────────────────────────┤
│ Du möchtest 234 Videos importieren.      │
│                                          │
│ Das wird einige Zeit dauern und          │
│ AI-Analysen verursachen.                 │
│                                          │
│ Empfehlung: Nutze Filter um Import       │
│ einzuschränken (z.B. nur neueste 50).    │
│                                          │
│ [Zurück & filtern] [Trotzdem importieren]│
└──────────────────────────────────────────┘
```

---

## 6. Key UX Principles

### Progressive Enhancement
✅ Videos erscheinen sofort (Metadata) → AI-Badges kommen nach
✅ User kann sofort interagieren, muss nicht warten
✅ Sparkle-Animationen zeigen AI-Progress

### Context-Aware Intelligence
✅ Analysen nur auf relevante Videos anwenden (Scope-System)
✅ Chat kennt aktuellen Grid-Filter und geöffnetes Video
✅ AI empfiehlt sinnvolle Scopes basierend auf Content-Typ

### Non-Blocking Operations
✅ Alle Analysen laufen im Hintergrund
✅ User kann Grid weiter nutzen während Import/Analyse läuft
✅ Toast-Notifications + Modal-Details für Transparency

### Visual Feedback
✅ Progress Bars für lange Operations
✅ Skeleton-Loader für Loading States
✅ Sparkle-Animationen für "AI fertig"
✅ Status-Text erklärt was passiert

### Flexibility & Relevance
✅ "Python Tutorials" haben andere Felder als "Keto Rezepte"
✅ User entscheidet welche Analysen auf welche Tags
✅ Chat + Settings = 2 Wege zum gleichen Ziel (beginner vs. power-user)

---

## 7. Technische Hinweise für Implementierung

### 7.1 Tag-basiertes Scope-System

**Datenbank:**
```sql
-- Analysis Task
CREATE TABLE analysis_tasks (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  scope_type TEXT NOT NULL, -- 'all' | 'tags'
  scope_tag_ids UUID[], -- Array von Tag-IDs (OR logic)
  scope_tag_logic TEXT, -- 'OR' | 'AND'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Analysis Fields (Custom Fields)
-- Bereits vorhanden in custom_fields Tabelle
-- Zusätzlich: Link zu analysis_task_id

-- Playlist-Funktion via video_tags
ALTER TABLE video_tags
ADD COLUMN position INTEGER DEFAULT NULL;
-- Position ist NULL für normale Tags
-- Position ist 1, 2, 3... für Playlist-Tags
```

**Backend-Logik (Video Upload):**
```python
async def on_video_created(video: Video):
    # Hole alle Video-Tags
    video_tag_ids = [tag.id for tag in video.tags]

    # Finde relevante Analysen
    relevant_analyses = get_analyses_for_tags(video_tag_ids)

    # Starte nur relevante Analysen
    for analysis in relevant_analyses:
        enqueue_analysis_job(video.id, analysis.id)
```

---

### 7.2 Chat Context Management

**Frontend:**
```typescript
interface ChatContext {
  currentView: 'grid' | 'modal'
  visibleVideoIds: string[] // Top 20 im Viewport
  selectedTagIds: string[]
  activeFilterType: 'tag' | 'search' | 'ai-chat' | null
  openVideoId: string | null // Wenn VideoDetailsModal offen
}

// Bei Chat-Message:
const sendMessage = (message: string) => {
  api.post('/api/chat', {
    message,
    context: chatContext // Schicke aktuellen Context mit
  })
}
```

**Backend:**
```python
@router.post("/api/chat")
async def chat(request: ChatRequest):
    context = request.context

    # AI kann auf Context zugreifen
    if "warum clickbait" in request.message.lower():
        video_id = context.open_video_id
        # Hole Video + Analyse-Ergebnisse
        # Erkläre AI-Reasoning
```

---

### 7.3 WebSocket Live Updates

**Bereits implementiert:**
- `backend/app/api/websocket.py` - WebSocket Endpoint
- `frontend/src/hooks/useWebSocket.ts` - React Hook

**Erweitern für AI-Analysen:**
```python
# In video_processor.py nach Gemini-Analyse:
await redis_client.publish(
    f"progress:user:{user_id}",
    json.dumps({
        "type": "analysis_complete",
        "video_id": str(video.id),
        "analysis_id": str(analysis.id),
        "results": extracted_data, # AI-Ergebnisse
        "badges": compute_badges(extracted_data) # Frontend-ready
    })
)
```

**Frontend:**
```typescript
useWebSocket((message) => {
  if (message.type === 'analysis_complete') {
    // Update Video in React Query Cache
    queryClient.setQueryData(['video', message.video_id], (old) => ({
      ...old,
      field_values: [...old.field_values, message.results]
    }))

    // Trigger Sparkle-Animation
    animateCard(message.video_id)
  }
})
```

---

### 7.4 Gemini Integration (Phase 1 TODO)

**In video_processor.py Line 101:**
```python
# Current: TODO Comment
# Replace with:

# Get transcript
transcript = await youtube_client.get_transcript(video.youtube_id)

if transcript:
    # Find relevant analyses for this video's tags
    relevant_analyses = await get_analyses_for_video_tags(
        db, video.id
    )

    for analysis in relevant_analyses:
        # Build Pydantic schema from analysis fields
        schema_model = build_pydantic_model(analysis)

        # Extract via Gemini
        gemini_client = GeminiClient(api_key=settings.gemini_api_key)
        result = await gemini_client.extract_structured_data(
            transcript=transcript,
            schema_model=schema_model
        )

        # Store in video_field_values (already exists in DB)
        for field_name, value in result.dict().items():
            await create_field_value(
                db,
                video_id=video.id,
                field_id=analysis.get_field_by_name(field_name).id,
                value=value
            )
```

---

### 7.5 Chat LLM Integration (Phase 6)

**Backend Route:**
```python
@router.post("/api/chat")
async def chat_with_ai(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    # Build context from user's library
    context = await build_chat_context(db, request.user_id, request.context)

    # Function calling tools
    tools = [
        {
            "name": "filter_videos",
            "description": "Filter videos by criteria",
            "parameters": {
                "tags": ["tutorial"],
                "difficulty": "beginner"
            }
        },
        {
            "name": "create_playlist",
            "description": "Create ordered playlist/learning path",
            "parameters": {
                "name": "FastAPI Learning Path",
                "video_ids": ["uuid1", "uuid2"],
                "order": [1, 2, 3]
            }
        },
        {
            "name": "create_analysis",
            "description": "Create new analysis task",
            "parameters": {
                "name": "Sponsored Content",
                "fields": [...],
                "scope_tags": ["product-review"]
            }
        }
    ]

    # Call Gemini with function calling
    client = genai.Client(api_key=settings.gemini_api_key)
    response = await client.models.generate_content(
        model='gemini-2.0-flash-exp',
        contents=[
            {"role": "system", "parts": [{"text": SYSTEM_PROMPT}]},
            {"role": "user", "parts": [{"text": request.message}]}
        ],
        config=types.GenerateContentConfig(
            tools=tools
        )
    )

    # Execute function calls
    if response.candidates[0].function_calls:
        results = await execute_function_calls(
            db, response.candidates[0].function_calls
        )
        return {"type": "action", "results": results}
    else:
        return {"type": "text", "message": response.text}
```

---

## 8. Erfolgs-Metriken

**User versteht das System:**
- ✅ 80%+ User erstellen im Onboarding eigene Analyse
- ✅ 70%+ User nutzen Scope-Feature (nicht "Alle Videos")
- ✅ User haben durchschnittlich 2+ Content-Typen mit unterschiedlichen Analysen

**System wird genutzt:**
- ✅ 60%+ Videos werden mit AI analysiert (nicht manuell übersprungen)
- ✅ Chat wird mindestens 1x pro Session genutzt
- ✅ 50%+ Custom Analysen entstehen via Chat (nicht Settings)

**Progressive Enhancement funktioniert:**
- ✅ Videos erscheinen <2s nach Upload (YouTube API)
- ✅ AI-Analysen <15s für 80% der Videos
- ✅ WebSocket-Updates <100ms Latenz

---

## Dokumentstatus

- **Version:** 1.0
- **Erstellt:** 2025-11-11
- **Status:** Design Complete - Ready for Implementation
- **Nächster Schritt:** Phase 1 Implementation (Worker + Gemini Integration)

---

**Ende des Dokuments**
