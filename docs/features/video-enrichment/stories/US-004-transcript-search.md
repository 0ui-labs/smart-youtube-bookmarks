# US-004: Volltextsuche über Video-Transkripte

## User Story

**Als** Benutzer der Smart YouTube Bookmarks App
**möchte ich** alle meine Videos nach Textinhalten durchsuchen können
**damit** ich Videos zu bestimmten Themen schnell wiederfinde

---

## Akzeptanzkriterien

| # | Kriterium | Testbar |
|---|-----------|---------|
| 1 | Suchfeld durchsucht Transkript-Inhalte | ✅ |
| 2 | Suchergebnisse zeigen Video + relevante Textstelle | ✅ |
| 3 | Klick auf Ergebnis öffnet Video an richtiger Stelle | ✅ |
| 4 | Suche ist schnell (< 500ms für 100 Videos) | ✅ |
| 5 | Suche funktioniert auch wenn nicht alle Videos enriched | ✅ |

---

## UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SEARCH RESULTS                            │
└─────────────────────────────────────────────────────────────┘

  🔍 "machine learning"                         [Suchen]

  ─────────────────────────────────────────────────────────

  📹 3 Videos gefunden mit "machine learning"

  ┌─────────────────────────────────────────────────────────┐
  │ 🎬 Introduction to Machine Learning                     │
  │ ─────────────────────────────────────────────────────── │
  │ ...and that's what <mark>machine learning</mark> is     │
  │ all about. We use algorithms to...                      │
  │                                                         │
  │ 📍 3 Treffer: 02:15, 15:30, 45:22          [Video →]   │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │ 🎬 Deep Learning Tutorial Part 1                        │
  │ ─────────────────────────────────────────────────────── │
  │ ...this is based on <mark>machine learning</mark>       │
  │ techniques that we discussed earlier...                 │
  │                                                         │
  │ 📍 1 Treffer: 08:45                        [Video →]   │
  └─────────────────────────────────────────────────────────┘
```

---

## Such-Architektur

### Option A: PostgreSQL Full-Text Search (empfohlen für Start)

```python
# Neues Feld in VideoEnrichment
transcript_text: str  # Plain text ohne Timestamps

# Suche mit ts_vector
from sqlalchemy import func

query = (
    select(VideoEnrichment)
    .where(
        func.to_tsvector('german', VideoEnrichment.transcript_text)
        .match(func.plainto_tsquery('german', search_term))
    )
    .order_by(
        func.ts_rank(
            func.to_tsvector('german', VideoEnrichment.transcript_text),
            func.plainto_tsquery('german', search_term)
        ).desc()
    )
)
```

### Option B: Meilisearch/Elasticsearch (für Skalierung)

```python
# Später bei Bedarf
class SearchService:
    async def index_transcript(self, video_id: str, transcript: str):
        await self.meilisearch.index('transcripts').add_documents([{
            'id': video_id,
            'transcript': transcript,
        }])

    async def search(self, query: str) -> list[SearchResult]:
        return await self.meilisearch.index('transcripts').search(query)
```

---

## Daten-Struktur

### Transcript mit Timestamps (für Suche)

```python
# VTT → Transcript mit Position-Mapping
class TranscriptSegment:
    start: float      # Sekunden
    end: float        # Sekunden
    text: str         # Segment-Text

# Beispiel
segments = [
    TranscriptSegment(start=0, end=5, text="Hallo und willkommen"),
    TranscriptSegment(start=5, end=12, text="zum Tutorial über Machine Learning"),
    ...
]
```

### Such-Ergebnis

```python
class SearchResult:
    video: Video
    matches: list[TranscriptMatch]
    relevance_score: float

class TranscriptMatch:
    timestamp: float      # Position im Video
    context: str          # Text um den Treffer
    highlight: str        # Text mit <mark>Treffer</mark>
```

---

## API Endpoint

```python
# app/api/search.py

@router.get("/api/search")
async def search_transcripts(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[SearchResult]:
    """
    Durchsucht alle Video-Transkripte nach dem Suchbegriff.
    Gibt Videos mit Treffern und deren Positionen zurück.
    """
    results = await search_service.search(q, limit=limit)
    return results
```

---

## Edge Cases

| # | Szenario | Erwartetes Verhalten |
|---|----------|----------------------|
| 1 | Keine Treffer | "Keine Videos gefunden" Meldung |
| 2 | Video ohne Enrichment | Video nicht in Suche enthalten |
| 3 | Sehr kurzer Suchbegriff (1 Zeichen) | Mindestlänge 2 Zeichen |
| 4 | Sonderzeichen in Suche | Escaping, keine SQL Injection |
| 5 | Suche in anderer Sprache | Mehrsprachige Tokenisierung |
| 6 | Sehr viele Treffer in einem Video | Top 5 Positionen anzeigen |

---

## VTT zu Transcript Konvertierung

```python
# services/enrichment/utils/vtt_parser.py

import webvtt

def vtt_to_transcript(vtt_content: str) -> tuple[str, list[TranscriptSegment]]:
    """
    Konvertiert VTT zu Plain Text und Segment-Liste.

    Returns:
        - plain_text: Volltext für Suche
        - segments: Liste mit Timestamps für Position-Mapping
    """
    captions = webvtt.read_buffer(StringIO(vtt_content))
    segments = []
    text_parts = []

    for caption in captions:
        segments.append(TranscriptSegment(
            start=caption.start_in_seconds,
            end=caption.end_in_seconds,
            text=caption.text
        ))
        text_parts.append(caption.text)

    return ' '.join(text_parts), segments


def find_timestamp_for_text(segments: list[TranscriptSegment], search_text: str) -> float:
    """
    Findet den Timestamp für einen Suchbegriff im Transkript.
    """
    for segment in segments:
        if search_text.lower() in segment.text.lower():
            return segment.start
    return 0.0
```

---

## Definition of Done

- [ ] `transcript_text` Feld in VideoEnrichment
- [ ] VTT zu Plain Text Konvertierung
- [ ] PostgreSQL Full-Text Search implementiert
- [ ] `/api/search` Endpoint
- [ ] Suchergebnisse mit Timestamps
- [ ] Frontend Search-Komponente
- [ ] Klick öffnet Video an Position
- [ ] Performance < 500ms bei 100 Videos

---

**Story Points:** 8
**Priorität:** Must Have
**Abhängigkeiten:** US-001 (Enrichment mit Transcript)
