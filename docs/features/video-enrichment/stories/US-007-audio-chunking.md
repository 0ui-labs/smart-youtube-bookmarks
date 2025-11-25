# US-007: Audio-Chunking für lange Videos

## User Story

**Als** System
**muss ich** Audio von langen Videos in Chunks aufteilen
**damit** auch Videos über 4 Stunden Länge transkribiert werden können (Groq 25MB Limit)

---

## Hintergrund

Groq Whisper API hat ein **25 MB Dateilimit**. Ein 2-Stunden Video hat typischerweise:
- ~115 MB Audio bei 128 kbps
- ~60 MB Audio bei 64 kbps

**Audio-Chunking ist MANDATORY**, nicht optional.

---

## Akzeptanzkriterien

| # | Kriterium | Testbar |
|---|-----------|---------|
| 1 | Audio wird in max. 10-Minuten Chunks geteilt | ✅ |
| 2 | Jeder Chunk ist unter 20 MB | ✅ |
| 3 | Chunks werden parallel verarbeitet (mit Rate-Limiting) | ✅ |
| 4 | Transkripte werden mit korrekten Timestamps zusammengeführt | ✅ |
| 5 | Temporäre Dateien werden nach Verarbeitung gelöscht | ✅ |
| 6 | 4+ Stunden Videos werden erfolgreich verarbeitet | ✅ |

---

## Technische Architektur

```
┌──────────────────────────────────────────────────────────────┐
│                    AUDIO CHUNKING PIPELINE                   │
└──────────────────────────────────────────────────────────────┘

Video (2h)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Audio Download (yt-dlp)                                  │
│    yt-dlp -x --audio-format mp3 --audio-quality 5           │
│    → Temporäre MP3 Datei (~60 MB)                           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Audio Splitting (pydub/ffmpeg)                           │
│    Split in 10-Minuten Chunks                               │
│    → 12 Chunk-Dateien (~5 MB each)                          │
└─────────────────────────────────────────────────────────────┘
    │
    ├────────────────────────────────────────────────────────┐
    │                                                        │
    ▼                                                        ▼
┌────────────┐  ┌────────────┐  ┌────────────┐      ┌────────────┐
│  Chunk 1   │  │  Chunk 2   │  │  Chunk 3   │ ...  │ Chunk 12   │
│  0-10min   │  │ 10-20min   │  │ 20-30min   │      │ 110-120min │
└────────────┘  └────────────┘  └────────────┘      └────────────┘
    │               │               │                     │
    ▼               ▼               ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Parallel Transcription (Groq Whisper)                    │
│    max_concurrent = 3, delay = 3s (Rate Limit: 20 RPM)      │
│    → 12 VTT Fragments                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Timestamp Correction & Merge                             │
│    Chunk 1: 00:00 - 10:00 (keine Korrektur)                 │
│    Chunk 2: Timestamps + 10:00                              │
│    Chunk 3: Timestamps + 20:00                              │
│    ...                                                      │
│    → Finales VTT mit korrekten Timestamps                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Cleanup                                                  │
│    Temporäre Audio-Dateien löschen                          │
│    Chunk-Dateien löschen                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementierung

### AudioChunker Klasse

```python
# services/enrichment/providers/audio_chunker.py

from pydub import AudioSegment
from pathlib import Path
import tempfile
import asyncio

@dataclass
class AudioChunk:
    path: Path
    start_time: float  # Sekunden
    end_time: float    # Sekunden
    index: int

class AudioChunker:
    CHUNK_DURATION_MS = 10 * 60 * 1000  # 10 Minuten in Millisekunden
    MAX_CHUNK_SIZE_MB = 20              # Sicherheitspuffer unter 25 MB
    AUDIO_BITRATE = '64k'               # Niedrigere Bitrate für kleinere Chunks

    def __init__(self, temp_dir: Path | None = None):
        self.temp_dir = temp_dir or Path(tempfile.mkdtemp(prefix='enrichment_'))

    async def download_audio(self, youtube_id: str) -> Path:
        """
        Lädt Audio von YouTube mit yt-dlp.
        """
        output_path = self.temp_dir / f"{youtube_id}.mp3"

        proc = await asyncio.create_subprocess_exec(
            'yt-dlp',
            '-x',                          # Nur Audio
            '--audio-format', 'mp3',
            '--audio-quality', '5',        # Mittlere Qualität (kleinere Datei)
            '-o', str(output_path),
            f'https://youtube.com/watch?v={youtube_id}',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise AudioDownloadError(f"yt-dlp failed: {stderr.decode()}")

        return output_path

    def split_audio(self, audio_path: Path) -> list[AudioChunk]:
        """
        Teilt Audio in Chunks mit max. 10 Minuten Länge.
        """
        audio = AudioSegment.from_mp3(audio_path)
        chunks = []

        for i, start_ms in enumerate(range(0, len(audio), self.CHUNK_DURATION_MS)):
            end_ms = min(start_ms + self.CHUNK_DURATION_MS, len(audio))
            chunk_audio = audio[start_ms:end_ms]

            chunk_path = self.temp_dir / f"chunk_{i:03d}.mp3"
            chunk_audio.export(
                chunk_path,
                format='mp3',
                bitrate=self.AUDIO_BITRATE
            )

            chunks.append(AudioChunk(
                path=chunk_path,
                start_time=start_ms / 1000,
                end_time=end_ms / 1000,
                index=i
            ))

        return chunks

    def cleanup(self):
        """Löscht alle temporären Dateien."""
        import shutil
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
```

---

### Parallele Transkription mit Rate-Limiting

```python
# services/enrichment/providers/groq_transcriber.py

class GroqTranscriber:
    MAX_CONCURRENT = 3    # Konservativ unter 20 RPM
    DELAY_BETWEEN = 3.0   # Sekunden zwischen Requests

    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        self.semaphore = asyncio.Semaphore(self.MAX_CONCURRENT)

    async def transcribe_chunks(
        self,
        chunks: list[AudioChunk],
        progress_callback: Callable[[int, int], None] | None = None
    ) -> list[TranscriptChunk]:
        """
        Transkribiert alle Chunks parallel mit Rate-Limiting.
        """
        async def transcribe_with_limit(chunk: AudioChunk) -> TranscriptChunk:
            async with self.semaphore:
                result = await self._transcribe_single(chunk)
                await asyncio.sleep(self.DELAY_BETWEEN)
                return result

        tasks = [transcribe_with_limit(chunk) for chunk in chunks]

        results = []
        for i, coro in enumerate(asyncio.as_completed(tasks)):
            result = await coro
            results.append(result)
            if progress_callback:
                progress_callback(i + 1, len(chunks))

        # Sortieren nach Index für korrekte Reihenfolge
        results.sort(key=lambda r: r.chunk_index)
        return results

    async def _transcribe_single(self, chunk: AudioChunk) -> TranscriptChunk:
        """
        Transkribiert einen einzelnen Chunk.
        """
        with open(chunk.path, 'rb') as audio_file:
            response = await asyncio.to_thread(
                self.client.audio.transcriptions.create,
                file=audio_file,
                model='whisper-large-v3',
                response_format='verbose_json',
                language='de'  # oder 'auto'
            )

        return TranscriptChunk(
            chunk_index=chunk.index,
            start_offset=chunk.start_time,
            segments=response.segments,
            text=response.text
        )
```

---

### Timestamp-Korrektur und Merge

```python
# services/enrichment/utils/vtt_merger.py

@dataclass
class TranscriptChunk:
    chunk_index: int
    start_offset: float  # Offset in Sekunden
    segments: list[dict] # Groq Whisper Segments
    text: str

def merge_transcripts(chunks: list[TranscriptChunk]) -> str:
    """
    Merged alle Chunks zu einem VTT mit korrekten Timestamps.
    """
    vtt_lines = ['WEBVTT', '']
    cue_number = 1

    for chunk in sorted(chunks, key=lambda c: c.chunk_index):
        offset = chunk.start_offset

        for segment in chunk.segments:
            # Timestamps korrigieren
            start = segment['start'] + offset
            end = segment['end'] + offset
            text = segment['text'].strip()

            if text:  # Leere Segmente überspringen
                vtt_lines.append(str(cue_number))
                vtt_lines.append(f"{format_vtt_time(start)} --> {format_vtt_time(end)}")
                vtt_lines.append(text)
                vtt_lines.append('')
                cue_number += 1

    return '\n'.join(vtt_lines)


def format_vtt_time(seconds: float) -> str:
    """Konvertiert Sekunden zu VTT Timestamp (HH:MM:SS.mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"
```

---

## Progress Tracking

```python
# Während der Verarbeitung Progress speichern

async def enrich_video(ctx, video_id: str):
    enrichment = await get_enrichment(video_id)

    # Download-Phase
    enrichment.progress_message = "Audio wird heruntergeladen..."
    await ctx['db'].commit()

    audio_path = await chunker.download_audio(youtube_id)

    # Split-Phase
    enrichment.progress_message = "Audio wird aufgeteilt..."
    await ctx['db'].commit()

    chunks = chunker.split_audio(audio_path)

    # Transcription-Phase mit Progress
    def on_progress(current: int, total: int):
        enrichment.progress_message = f"Transkribiere Chunk {current}/{total}..."
        # Note: In echtem Code async commit nötig

    transcripts = await transcriber.transcribe_chunks(chunks, on_progress)

    # Merge-Phase
    enrichment.progress_message = "Transkripte werden zusammengeführt..."
    final_vtt = merge_transcripts(transcripts)

    enrichment.captions_vtt = final_vtt
    enrichment.status = 'completed'
    await ctx['db'].commit()
```

---

## Edge Cases

| # | Szenario | Erwartetes Verhalten |
|---|----------|----------------------|
| 1 | Audio Download fehlschlägt | Retry mit Backoff |
| 2 | Ein Chunk-Transcription fehlschlägt | Retry nur dieses Chunks |
| 3 | Chunk größer als 25 MB | Kleinere Chunk-Duration verwenden |
| 4 | Video ohne Audio-Track | PermanentError: "Kein Audio" |
| 5 | Disk Space voll | Cleanup, dann Error |
| 6 | Worker-Crash während Processing | Cleanup beim nächsten Start |

---

## Ressourcen-Management

```python
# Context Manager für sauberes Cleanup

class AudioProcessor:
    async def __aenter__(self):
        self.temp_dir = Path(tempfile.mkdtemp(prefix='enrichment_'))
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Immer aufräumen, auch bei Fehlern
        await asyncio.to_thread(shutil.rmtree, self.temp_dir, ignore_errors=True)

# Verwendung
async with AudioProcessor() as processor:
    chunks = await processor.process(youtube_id)
    # temp_dir wird automatisch gelöscht
```

---

## Definition of Done

- [ ] AudioChunker implementiert mit yt-dlp + pydub
- [ ] Chunks unter 20 MB garantiert
- [ ] Parallele Transcription mit Rate-Limiting
- [ ] Timestamp-Korrektur bei Merge
- [ ] Progress-Tracking für UI
- [ ] Cleanup von temp files (auch bei Fehlern)
- [ ] Test: 4+ Stunden Video erfolgreich verarbeitet
- [ ] Test: Korrekte Timestamps nach Merge

---

**Story Points:** 13
**Priorität:** Must Have
**Abhängigkeiten:** Keine (Kern-Funktionalität)
