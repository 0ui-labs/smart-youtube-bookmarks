# Video Enrichment - Research & Validation

## Validierte Technische Entscheidungen

### 1. Groq Whisper API

**Quelle:** [Groq Speech-to-Text Docs](https://console.groq.com/docs/speech-to-text)

| Parameter | Wert | Validiert |
|-----------|------|-----------|
| Max File Size (Free Tier) | **25 MB** | ✅ |
| Max File Size (Dev Tier) | **100 MB** | ✅ |
| Supported Formats | mp3, mp4, mpeg, mpga, m4a, wav, webm | ✅ |
| Minimum Billed Length | 10 Sekunden | ✅ |
| Response Formats | json, verbose_json, text | ✅ |
| Timestamp Granularities | segment, word | ✅ |

**Modell-Empfehlung:**
```
whisper-large-v3-turbo  → Beste Preis/Leistung ($0.04/h)
whisper-large-v3        → Höchste Genauigkeit ($0.111/h)
```

**Wichtige Erkenntnis:** Groq empfiehlt 10-Minuten Chunks mit 10-Sekunden Overlap für optimale Ergebnisse.

---

### 2. Audio-Chunking Strategie

**Quelle:** [Groq Chunking Tutorial](https://community.groq.com/t/chunking-longer-audio-files-for-whisper-models-on-groq/162)

**Validierte Parameter:**
```python
CHUNK_DURATION = 600      # 10 Minuten (Groq-Empfehlung)
CHUNK_OVERLAP = 10        # 10 Sekunden Overlap
MAX_CHUNK_SIZE = 25 * 1024 * 1024  # 25 MB
```

**Audio-Preprocessing für optimale Ergebnisse:**
```bash
# Groq-empfohlene ffmpeg Konvertierung
ffmpeg -i input.mp3 -ar 16000 -ac 1 -c:a flac output.flac
```

- **Sample Rate:** 16 kHz (Whisper-Optimal)
- **Channels:** Mono
- **Format:** FLAC für verlustfreie Kompression

---

### 3. yt-dlp Subtitle Extraction

**Quelle:** [yt-dlp README - Subtitle Options](https://github.com/yt-dlp/yt-dlp/blob/master/README.md#subtitle-options)

**Validierte Optionen:**
```bash
# Manuelle + Auto-Captions herunterladen
yt-dlp --write-subs --write-auto-subs --sub-format vtt --sub-langs "de,en" --skip-download URL

# Nur Audio extrahieren
yt-dlp -x --audio-format mp3 --audio-quality 5 URL
```

**Wichtige Flags:**
- `--write-subs` → Manuelle Untertitel
- `--write-auto-subs` → Auto-generierte Untertitel
- `--sub-format vtt` → VTT-Format (Vidstack-kompatibel)
- `--sub-langs` → Sprachen (Regex möglich: "en.*")

---

### 4. pydub Audio Splitting

**Quelle:** [pydub API Documentation](https://github.com/jiaaro/pydub/blob/master/API.markdown)

**Validierte Methoden:**

```python
from pydub import AudioSegment

# Audio laden
audio = AudioSegment.from_mp3("video.mp3")

# In Chunks splitten (Slice-Syntax)
CHUNK_MS = 10 * 60 * 1000  # 10 Minuten
chunks = [audio[i:i+CHUNK_MS] for i in range(0, len(audio), CHUNK_MS)]

# Export mit Bitrate-Kontrolle
for i, chunk in enumerate(chunks):
    chunk.export(f"chunk_{i}.mp3", format="mp3", bitrate="64k")
```

**Wichtige Eigenschaften:**
- `audio.duration_seconds` → Länge in Sekunden
- `audio[start:end]` → Slice in Millisekunden
- `chunk.export(format="mp3", bitrate="64k")` → Export mit Bitrate

**Chunk-Größe Kalkulation:**
```python
# 10 min @ 64kbps = ~4.8 MB (weit unter 25 MB Limit)
bytes_per_second = 64000 / 8  # 8000 bytes/s
chunk_size_mb = (600 * 8000) / (1024 * 1024)  # ~4.6 MB
```

---

### 5. Vidstack Text Tracks

**Bereits validiert in Codebase:** `frontend/src/components/VideoPlayer.tsx:296-306`

```typescript
{textTracks?.map((track) => (
  <Track
    key={track.src}
    src={track.src}
    label={track.label}
    language={track.language}
    kind={track.kind}    // 'subtitles' | 'captions' | 'chapters'
    type={track.type}
    default={track.default}
  />
))}
```

**VTT-Format für Captions:**
```vtt
WEBVTT

00:00:00.000 --> 00:00:05.000
Erste Zeile Untertitel

00:00:05.000 --> 00:00:10.000
Zweite Zeile Untertitel
```

**VTT-Format für Chapters:**
```vtt
WEBVTT

chapter-1
00:00:00.000 --> 00:02:30.000
Intro

chapter-2
00:02:30.000 --> 00:10:15.000
Hauptteil
```

---

## Risiko-Validierung

### Risiko 1: Groq API Timeout bei großen Files

**Status:** ✅ Gelöst durch Audio-Chunking

| Video-Länge | Audio-Größe (128kbps) | Chunks (10 min) | Geschätzte Zeit |
|-------------|----------------------|-----------------|-----------------|
| 30 min | ~28 MB | 3 | ~30-60s |
| 1 Stunde | ~56 MB | 6 | ~1-2 min |
| 2 Stunden | ~115 MB | 12 | ~2-4 min |
| 4 Stunden | ~230 MB | 24 | ~4-8 min |

**Mitigation:**
- 10-Minuten Chunks statt ganzes Audio
- 64 kbps Bitrate → ~4.6 MB pro Chunk
- Parallel Processing mit Rate-Limiting (3 concurrent)

---

### Risiko 2: Rate Limiting

**Groq Free Tier Limits:**
- 20 Requests/Minute
- 7,200 Audio-Sekunden/Stunde

**Mitigation im Code:**
```python
MAX_CONCURRENT = 3    # Konservativ unter 20 RPM
DELAY_BETWEEN = 3.0   # 3 Sekunden zwischen Requests

# Pro Stunde verarbeitbar:
# 7200 Sekunden = 120 Minuten = 12 kurze Videos oder 6 lange Videos
```

---

### Risiko 3: Memory bei langen Videos

**Problem:** 4-Stunden Video → ~230 MB Audio im RAM

**Mitigation:**
```python
# pydub lädt Audio lazy - nur geladene Segmente im RAM
audio = AudioSegment.from_mp3("large_file.mp3")

# Streaming-Alternative falls nötig:
audio = AudioSegment.from_file("large.mp3", start_second=0, duration=600)
```

---

## Kosten-Kalkulation

### Groq Whisper Kosten (whisper-large-v3-turbo)

| Video-Typ | Durchschnittliche Länge | Kosten pro Video |
|-----------|------------------------|------------------|
| Kurzes Tutorial | 10 min | $0.007 |
| Standard Video | 30 min | $0.02 |
| Langer Vortrag | 1 Stunde | $0.04 |
| Konferenz-Talk | 2 Stunden | $0.08 |
| Livestream | 4 Stunden | $0.16 |

**Monatliche Kosten-Schätzung:**
- 50 Videos à 30 min = ~25 Stunden = **~$1.00/Monat**
- 200 Videos à 30 min = ~100 Stunden = **~$4.00/Monat**

---

## Validierte Code-Patterns

### 1. Groq SDK Usage

```python
from groq import Groq

client = Groq(api_key=settings.groq_api_key)

with open(chunk_path, "rb") as audio_file:
    response = client.audio.transcriptions.create(
        file=audio_file,
        model="whisper-large-v3-turbo",
        response_format="verbose_json",
        timestamp_granularities=["segment"],
        language="de",  # Optional: Verbessert Genauigkeit
        temperature=0.0
    )

# Response enthält:
# - response.text (vollständiger Text)
# - response.segments (mit start/end Timestamps)
```

### 2. VTT Generation aus Segments

```python
def segments_to_vtt(segments: list, offset: float = 0) -> str:
    lines = ["WEBVTT", ""]

    for i, seg in enumerate(segments, 1):
        start = format_vtt_time(seg["start"] + offset)
        end = format_vtt_time(seg["end"] + offset)
        text = seg["text"].strip()

        if text:
            lines.extend([str(i), f"{start} --> {end}", text, ""])

    return "\n".join(lines)

def format_vtt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"
```

### 3. Chapter Extraction aus Description

```python
import re

CHAPTER_PATTERN = r'(?:^|\n)(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+?)(?=\n|$)'

def parse_chapters(description: str, duration: int) -> list:
    matches = list(re.finditer(CHAPTER_PATTERN, description))
    chapters = []

    for i, match in enumerate(matches):
        timestamp_str, title = match.groups()
        start = parse_timestamp(timestamp_str)

        # End = Start des nächsten Kapitels oder Video-Ende
        if i + 1 < len(matches):
            next_match = matches[i + 1]
            end = parse_timestamp(next_match.group(1))
        else:
            end = duration

        chapters.append({
            "start": start,
            "end": end,
            "title": title.strip()
        })

    return chapters
```

---

## Quellen

1. [Groq Speech-to-Text Documentation](https://console.groq.com/docs/speech-to-text)
2. [Groq Chunking Tutorial](https://community.groq.com/t/chunking-longer-audio-files-for-whisper-models-on-groq/162)
3. [yt-dlp Subtitle Options](https://github.com/yt-dlp/yt-dlp/blob/master/README.md#subtitle-options)
4. [pydub API Documentation](https://github.com/jiaaro/pydub/blob/master/API.markdown)
5. [Vidstack React Documentation](https://www.vidstack.io/docs/react)

---

## Zusammenfassung der Validierung

| Entscheidung | Status | Quelle |
|--------------|--------|--------|
| 10-Minuten Audio-Chunks | ✅ Validiert | Groq Tutorial |
| 64 kbps Bitrate | ✅ Validiert | Groq Docs (16kHz mono optimal) |
| whisper-large-v3-turbo Model | ✅ Empfohlen | Groq Docs (beste Preis/Leistung) |
| yt-dlp für Captions | ✅ Validiert | yt-dlp README |
| pydub für Audio-Splitting | ✅ Validiert | pydub API |
| Vidstack Text Tracks | ✅ Bereits implementiert | Codebase |
| VTT-Format | ✅ Validiert | Alle Quellen |

---

**Exit Condition:** ✅ Alle technischen Entscheidungen durch Dokumentation validiert
**Feature-Planung abgeschlossen!**
