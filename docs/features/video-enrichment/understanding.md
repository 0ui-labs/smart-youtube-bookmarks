# Video Enrichment Feature - Understanding

## Feature Summary

**In 2-3 Sätzen:**
Das Video Enrichment Feature reichert YouTube Videos automatisch mit Untertiteln (Captions), Kapiteln (Chapters) und durchsuchbaren Transkripten an. Primär werden YouTube's eigene Captions verwendet; fehlen diese, wird Audio extrahiert und via Groq Whisper transkribiert. Das Feature ermöglicht sowohl Volltextsuche über alle Videos als auch bessere Navigation innerhalb einzelner Videos.

---

## Anforderungen

### Funktionale Anforderungen

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F1 | Automatische Anreicherung aller neuen Videos im Hintergrund | Must |
| F2 | Captions/Untertitel im Video-Player anzeigen | Must |
| F3 | Chapters/Kapitel zur Navigation anzeigen | Must |
| F4 | Volltextsuche über Transkript-Inhalte aller Videos | Must |
| F5 | Status-Anzeige während Verarbeitung (pending/processing/completed/failed) | Must |
| F6 | Retry-Möglichkeit bei fehlgeschlagener Anreicherung | Should |
| F7 | Thumbnail-Sprites für Video-Vorschau (Hover) | Nice-to-have |

### Nicht-Funktionale Anforderungen

| ID | Anforderung | Ziel |
|----|-------------|------|
| NF1 | Unterstützung für Videos bis 4+ Stunden | Must |
| NF2 | Verarbeitung im Hintergrund ohne UI-Blockierung | Must |
| NF3 | Graceful degradation bei API-Fehlern | Should |
| NF4 | Caching von bereits verarbeiteten Videos | Must |

---

## Benutzer & Use Cases

### Primärer User
- Einzelner Benutzer der App (persönliche YouTube Bookmark Sammlung)
- Speichert Videos aus verschiedenen Bereichen (Tutorials, Vorträge, Podcasts)
- Will Videos später wiederfinden und schnell navigieren

### Haupt-Use-Cases

**UC1: Video mit Untertiteln ansehen**
1. User öffnet Video-Details-Seite
2. Video wird mit Untertiteln angezeigt (wenn verfügbar)
3. User kann Untertitel ein/ausschalten

**UC2: In Video per Kapitel navigieren**
1. User öffnet Video mit Kapiteln
2. Kapitel-Liste wird angezeigt
3. User klickt auf Kapitel → Video springt zu Timestamp

**UC3: Videos nach Inhalt durchsuchen**
1. User gibt Suchbegriff ein
2. Suche durchsucht Transkripte aller Videos
3. Ergebnisse zeigen Videos + relevante Stellen mit Timestamps

**UC4: Anreicherungs-Status prüfen**
1. User sieht bei neuem Video "Wird verarbeitet..."
2. Nach Abschluss: Captions/Chapters erscheinen
3. Bei Fehler: Fehlermeldung + Retry-Button

---

## Datenquellen & Fallback-Strategie

### Captions (Untertitel)

**Hierarchie (in Prioritätsreihenfolge):**
1. **YouTube Manual Subtitles** - Vom Creator hochgeladen, höchste Qualität
2. **YouTube Auto-Generated** - Automatisch generiert, meist verfügbar
3. **Groq Whisper Transcription** - Eigene Transkription wenn YouTube nichts hat

### Chapters (Kapitel)

**Hierarchie:**
1. **YouTube Native Chapters** - In Video-Metadaten definiert
2. **Description-Parsed Chapters** - Aus Video-Beschreibung extrahiert (Timestamp + Titel)
3. **Keine Chapters** - Video funktioniert trotzdem

### Thumbnails (Nice-to-have)

**Quelle:**
- YouTube Storyboard Sprites (wenn verfügbar)

---

## Technische Constraints

### Groq Whisper API Limits

| Limit | Wert | Auswirkung |
|-------|------|------------|
| Max File Size | 25 MB (Free) / 100 MB (Dev) | **Erfordert Audio-Chunking für lange Videos** |
| Rate Limit | 20 Requests/Minute | Queue mit Rate-Limiting nötig |
| Audio Seconds | 7.200/Stunde (Free) | ~2h Audio pro Stunde möglich |

### Audio-Chunking-Anforderung

**Problem:** Ein 2-Stunden Video hat ~100-150 MB Audio
**Lösung:** Audio in Chunks splitten (z.B. 10-15 Minuten), einzeln transkribieren, mit korrekten Timestamps zusammenfügen

### Video-Längen

- Typische Videos: 10 min - 2 Stunden
- Maximale Länge: 4+ Stunden (Livestreams, Konferenzen)
- **Audio-Chunking ist mandatory**, nicht optional

---

## Scope-Abgrenzung

### In Scope
- Automatische Enrichment-Pipeline für alle Videos
- YouTube Captions + Chapters extraction
- Groq Whisper Transcription mit Audio-Chunking
- VTT-Format für Player-Integration
- Volltextsuche über Transkripte
- Status-Tracking & Retry-Mechanismus

### Out of Scope (für später)
- Mehrsprachige Untertitel (nur Deutsch/Englisch zunächst)
- AI-generierte Zusammenfassungen
- Keyword-Extraktion / Auto-Tagging
- Thumbnail-Sprite-Generation

---

## Erfolgs-Kriterien

| Kriterium | Messung |
|-----------|---------|
| Zuverlässigkeit | 95%+ der Videos werden erfolgreich angereichert |
| Performance | Enrichment startet innerhalb 5s nach Video-Import |
| Korrektheit | Timestamps in Transkripten sind ±2s genau |
| Verfügbarkeit | Feature funktioniert auch wenn einzelne APIs down sind |

---

## Offene Fragen (für Phase 2)

1. Wie genau ist der bestehende Video-Import-Flow? (Wo hook für Enrichment einhängen?)
2. Gibt es bereits eine Background-Job-Queue? (Redis/Celery/ARQ?)
3. Wie ist die Datenbank-Struktur für Videos?
4. Gibt es bereits einen Search-Index (Elasticsearch, Meilisearch)?

---

**Exit Condition:** ✅ Feature kann in 2-3 Sätzen erklärt werden
**Nächste Phase:** Codebase Analysis
