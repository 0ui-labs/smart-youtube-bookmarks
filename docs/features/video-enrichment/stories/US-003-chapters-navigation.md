# US-003: Kapitel-Navigation im Video-Player

## User Story

**Als** Benutzer der Smart YouTube Bookmarks App
**möchte ich** Kapitel im Video sehen und zu ihnen springen können
**damit** ich schnell zu relevanten Stellen navigieren kann

---

## Akzeptanzkriterien

| # | Kriterium | Testbar |
|---|-----------|---------|
| 1 | Kapitel werden als Liste angezeigt | ✅ |
| 2 | Klick auf Kapitel springt zur Position | ✅ |
| 3 | Aktuelles Kapitel wird hervorgehoben | ✅ |
| 4 | Kapitel-Marker auf der Timeline sichtbar | ✅ |
| 5 | Video funktioniert auch ohne Kapitel | ✅ |

---

## UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  VIDEO DETAILS PAGE                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │                   VIDEO PLAYER                        │  │
│  │                                                       │  │
│  │  ▶ ━━|━━━━━|━━━━━━━━●━━|━━━━━━|━━━  12:34 / 45:00    │  │
│  │     ↑     ↑         ↑       ↑                        │  │
│  │   Intro  Setup   Demo    Summary   ← Chapter Markers │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  📑 Chapters                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 00:00  Intro                                        │   │
│  │ 02:30  Setup & Installation                         │   │
│  │ ▶10:15 Demo (aktuell)  ◀─── Hervorgehoben          │   │
│  │ 25:00  Summary                                      │   │
│  │ 40:00  Q&A                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Video Title                                                │
│  ───────────────────────────────────────────────────────    │
└─────────────────────────────────────────────────────────────┘
```

---

## Daten-Struktur

### API Response

```json
{
  "status": "completed",
  "chapters": {
    "vtt": "WEBVTT\n\nchapter-1\n00:00:00.000 --> 00:02:30.000\nIntro\n\n...",
    "items": [
      { "start": 0, "end": 150, "title": "Intro" },
      { "start": 150, "end": 615, "title": "Setup & Installation" },
      { "start": 615, "end": 1500, "title": "Demo" },
      { "start": 1500, "end": 2400, "title": "Summary" },
      { "start": 2400, "end": 2700, "title": "Q&A" }
    ],
    "source": "youtube"
  }
}
```

### Chapter Interface

```typescript
interface Chapter {
  start: number   // Sekunden
  end: number     // Sekunden
  title: string
}

interface ChaptersData {
  vtt: string
  items: Chapter[]
  source: 'youtube' | 'description_parsed'
}
```

---

## Komponenten

### ChapterList Komponente

```tsx
// components/ChapterList.tsx

interface ChapterListProps {
  chapters: Chapter[]
  currentTime: number
  onSeek: (time: number) => void
}

export function ChapterList({ chapters, currentTime, onSeek }: ChapterListProps) {
  const currentChapter = useMemo(() => {
    return chapters.find(ch =>
      currentTime >= ch.start && currentTime < ch.end
    )
  }, [chapters, currentTime])

  return (
    <div className="chapter-list">
      <h3>📑 Chapters</h3>
      <ul>
        {chapters.map((chapter, index) => (
          <li
            key={index}
            className={chapter === currentChapter ? 'active' : ''}
            onClick={() => onSeek(chapter.start)}
          >
            <span className="time">{formatTime(chapter.start)}</span>
            <span className="title">{chapter.title}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Vidstack Chapter Integration

```tsx
// Chapters als VTT Track
<VideoPlayer
  youtubeId={video.youtubeId}
  textTracks={[
    // Captions...
    {
      src: `data:text/vtt;base64,${btoa(enrichment.chapters.vtt)}`,
      kind: 'chapters',
      language: 'de',
      label: 'Chapters',
      default: true,
    }
  ]}
/>
```

---

## Edge Cases

| # | Szenario | Erwartetes Verhalten |
|---|----------|----------------------|
| 1 | Video ohne Kapitel | Chapter-Section nicht anzeigen |
| 2 | Nur 1 Kapitel | Chapter-Section nicht anzeigen |
| 3 | Kapitel aus Description | Badge "Aus Beschreibung" |
| 4 | Überlappende Kapitel | Erstes Kapitel gewinnt |
| 5 | Kapitel mit leerem Titel | Titel "Kapitel X" generieren |
| 6 | Sehr viele Kapitel (20+) | Scrollbare Liste |

---

## Chapter Extraction

### YouTube Native Chapters

```python
# Via yt-dlp
video_info = yt_dlp.extract_info(url, download=False)
chapters = video_info.get('chapters', [])

# Format:
# [{'start_time': 0, 'end_time': 150, 'title': 'Intro'}, ...]
```

### Description Parsing (Fallback)

```python
# Regex Pattern für Timestamps in Beschreibung
CHAPTER_PATTERN = r'(?:^|\n)(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+?)(?=\n|$)'

def parse_chapters_from_description(description: str, duration: int) -> list[Chapter]:
    matches = re.findall(CHAPTER_PATTERN, description)
    chapters = []

    for i, (timestamp, title) in enumerate(matches):
        start = parse_timestamp(timestamp)
        # End ist Start des nächsten Kapitels oder Video-Ende
        end = matches[i+1][0] if i+1 < len(matches) else duration

        chapters.append(Chapter(start=start, end=end, title=title.strip()))

    return chapters
```

---

## Definition of Done

- [ ] Chapters aus YouTube extrahiert
- [ ] Description-Parsing als Fallback
- [ ] ChapterList Komponente implementiert
- [ ] Aktives Kapitel wird hervorgehoben
- [ ] Klick springt zu Position
- [ ] Chapter-Marker auf Timeline (Vidstack)
- [ ] Graceful handling ohne Kapitel

---

**Story Points:** 5
**Priorität:** Must Have
**Abhängigkeiten:** US-001, US-002
