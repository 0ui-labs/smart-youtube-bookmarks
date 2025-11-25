# Video Enrichment System Design

## Overview

API-agnostic system for enriching videos with captions, chapters, and thumbnails. Proactively processes videos when imported, with fallback to AI transcription when YouTube auto-captions are unavailable.

## Problem

The VideoPlayer supports text tracks (captions, chapters) and thumbnail scrubbing, but we need a flexible way to:
1. Fetch captions from YouTube (free via yt-dlp)
2. Fall back to AI transcription when unavailable (Groq Whisper ~2¢/video)
3. Extract chapters from YouTube metadata or video descriptions
4. Provide storyboard thumbnails for scrubbing preview

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │ VideoDetailsPage │───▶│ useVideoEnrichment (React Query) │   │
│  └─────────────────┘    └──────────────────────────────────┘   │
│                                      │                          │
│                                      ▼                          │
│                          GET /api/videos/{id}/enrichment        │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FASTAPI BACKEND                            │
│                                                                 │
│  ┌──────────────┐     ┌─────────────────┐     ┌─────────────┐  │
│  │ Video Import │────▶│ Enrichment Task │────▶│  PostgreSQL │  │
│  │   Endpoint   │     │    (Background)  │     │             │  │
│  └──────────────┘     └─────────────────┘     └─────────────┘  │
│                              │                                  │
│                    ┌─────────┴─────────┐                       │
│                    ▼                   ▼                       │
│            ┌─────────────┐     ┌─────────────┐                 │
│            │   yt-dlp    │     │  Groq API   │                 │
│            │ (kostenlos) │     │  (~2¢/Video)│                 │
│            └─────────────┘     └─────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Video wird importiert
       │
       ▼
2. POST /api/videos → Video in DB erstellen
       │
       ▼
3. Background Task gequeued: enrich_video(video_id)
       │
       ▼
4. Task startet:
   a) yt-dlp: Auto-Captions holen (3 Retries)
   b) yt-dlp: Chapters holen (oder Description parsen)
   c) yt-dlp: Storyboard Thumbnail URL
       │
       ▼
5. Captions vorhanden?
   ├── JA → Speichern in DB → FERTIG
   └── NEIN → Groq Whisper Transkription (3 Retries)
                    │
                    ▼
6. Ergebnis in DB speichern (captions_vtt, transcript_text, etc.)
       │
       ▼
7. Status = 'completed' oder 'failed'
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Architecture** | Backend + Background Tasks | Simple, one deployment, direct DB access |
| **Sync Method** | Polling (3s) with React Query | Simple, no WS infrastructure needed |
| **Trigger** | Proactive on video import | Captions ready when user opens video |
| **Error Handling** | 3x Retry + Fallback chain | yt-dlp → Groq Whisper |
| **Chapters** | yt-dlp → Description parsing | Maximum coverage |
| **Storage** | PostgreSQL (DB-centric) | Enables FTS, pgvector for AI features |

## Database Schema

```sql
CREATE TABLE video_enrichments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,

    -- Status Tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'processing' | 'completed' | 'failed'

    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Captions (für Player - VTT Format)
    captions_vtt TEXT,
    captions_language VARCHAR(10),  -- 'de', 'en', etc.
    captions_source VARCHAR(30),    -- 'youtube_auto', 'groq_whisper'

    -- Transcript (für AI/Search - Plain Text)
    transcript_text TEXT,

    -- Chapters
    chapters_vtt TEXT,              -- VTT für Player
    chapters_json JSONB,            -- Structured für API
    chapters_source VARCHAR(30),    -- 'youtube', 'description_parsed'

    -- Thumbnails
    thumbnails_vtt_url TEXT,        -- Storyboard URL

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,

    CONSTRAINT unique_video_enrichment UNIQUE (video_id)
);

-- Full-Text Search Index
CREATE INDEX idx_enrichment_transcript_fts
ON video_enrichments
USING GIN(to_tsvector('german', transcript_text));

-- Status Index (für Polling/Queue)
CREATE INDEX idx_enrichment_status
ON video_enrichments(status)
WHERE status IN ('pending', 'processing');
```

## API Endpoints

### GET /api/videos/{video_id}/enrichment

Returns enrichment data or processing status.

**Response:**

```typescript
interface EnrichmentResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed'

  // Only when status === 'completed'
  captions?: {
    vtt: string           // VTT content for player
    language: string
    source: 'youtube_auto' | 'groq_whisper'
  }

  chapters?: {
    vtt: string           // VTT for player
    items: Chapter[]      // Structured for UI
    source: 'youtube' | 'description_parsed'
  }

  thumbnails?: {
    vttUrl: string        // Storyboard VTT URL
  }

  // Only when status === 'failed'
  error?: string
}

interface Chapter {
  start: number    // Seconds
  end: number
  title: string
}
```

### POST /api/videos/{video_id}/enrichment/retry

Manual retry for failed enrichments.

## Backend Implementation

### Enrichment Service

```python
# services/enrichment/service.py

class EnrichmentService:
    """Orchestrates video enrichment"""

    async def enrich_video(self, video_id: UUID) -> None:
        """Main process - runs as background task"""

        enrichment = await self.get_or_create(video_id)
        enrichment.status = 'processing'
        await self.save(enrichment)

        try:
            # 1. Use yt-dlp for everything
            yt_data = await self.fetch_with_ytdlp(video_id)

            # 2. Process captions
            if yt_data.captions:
                enrichment.captions_vtt = yt_data.captions
                enrichment.captions_source = 'youtube_auto'
            else:
                # Fallback: Groq Whisper
                enrichment.captions_vtt = await self.transcribe_with_groq(video_id)
                enrichment.captions_source = 'groq_whisper'

            # 3. Process chapters
            if yt_data.chapters:
                enrichment.chapters_json = yt_data.chapters
                enrichment.chapters_source = 'youtube'
            else:
                # Fallback: Parse description
                enrichment.chapters_json = self.parse_chapters_from_description(
                    yt_data.description
                )
                enrichment.chapters_source = 'description_parsed'

            # 4. Generate VTT & extract plain text
            enrichment.chapters_vtt = self.chapters_to_vtt(enrichment.chapters_json)
            enrichment.transcript_text = self.vtt_to_plain_text(enrichment.captions_vtt)
            enrichment.thumbnails_vtt_url = yt_data.storyboard_url

            enrichment.status = 'completed'

        except Exception as e:
            enrichment.status = 'failed'
            enrichment.error_message = str(e)

        enrichment.processed_at = datetime.now()
        await self.save(enrichment)
```

### yt-dlp Integration

```python
# services/enrichment/ytdlp.py

class YtdlpClient:
    """yt-dlp wrapper for video metadata"""

    async def fetch_video_data(self, youtube_id: str) -> YtdlpResult:
        """Fetches captions, chapters, thumbnails in one request"""

        ydl_opts = {
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['de', 'en'],
            'quiet': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f'https://youtube.com/watch?v={youtube_id}',
                download=False
            )

        return YtdlpResult(
            captions=self._extract_best_caption(info),
            chapters=info.get('chapters', []),
            description=info.get('description', ''),
            storyboard_url=self._extract_storyboard(info),
        )
```

### Groq Whisper Fallback

```python
# services/enrichment/groq.py

class GroqTranscriber:
    """Groq Whisper API for videos without auto-captions"""

    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)

    async def transcribe(self, youtube_id: str) -> str:
        """Extract audio and transcribe"""

        # 1. Extract audio with yt-dlp
        audio_path = await self._extract_audio(youtube_id)

        try:
            # 2. Groq Whisper API
            with open(audio_path, 'rb') as audio_file:
                result = self.client.audio.transcriptions.create(
                    file=audio_file,
                    model='whisper-large-v3',
                    response_format='verbose_json',
                    language='de',
                )

            # 3. Convert to VTT format
            return self._to_vtt(result.segments)

        finally:
            os.remove(audio_path)
```

## Frontend Implementation

### useVideoEnrichment Hook

```typescript
// hooks/useVideoEnrichment.ts

export function useVideoEnrichment(videoId: string | undefined) {
  const query = useQuery({
    queryKey: ['video-enrichment', videoId],
    queryFn: () => api.get(`/videos/${videoId}/enrichment`).then(r => r.data),
    enabled: !!videoId,

    // Poll only while processing
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') return false
      return 3000  // 3 seconds
    },

    staleTime: 1000 * 60 * 60,  // 1 hour when completed
  })

  const data = query.data

  return {
    status: data?.status ?? 'pending',
    captionsVtt: data?.captions?.vtt ?? null,
    chaptersVtt: data?.chapters?.vtt ?? null,
    thumbnailsVttUrl: data?.thumbnails?.vttUrl ?? null,
    chapters: data?.chapters?.items ?? [],
    captionsSource: data?.captions?.source,
    isLoading: query.isLoading,
    isProcessing: data?.status === 'processing',
    isFailed: data?.status === 'failed',
    error: data?.error,
  }
}
```

## Implementation Phases

### Phase 1: Backend Foundation
- DB Migration (video_enrichments table)
- Enrichment API Endpoints
- Background Task Infrastructure
- Tests

### Phase 2: yt-dlp Integration
- YtdlpClient Service
- Caption Extraction (Auto + Manual)
- Chapter Extraction
- Storyboard URL Extraction
- Description Parser for Chapters
- Tests

### Phase 3: Groq Whisper Fallback
- Audio Extraction with yt-dlp
- Groq API Integration
- VTT Conversion
- Retry Logic
- Tests

### Phase 4: Frontend Integration
- Update useVideoEnrichment Hook
- API Client for new endpoints
- Polling Logic
- Update VideoPlayer Props
- Loading/Error States
- Tests

### Phase 5: Trigger on Video Import
- Update Video Import Endpoint
- Auto-queue Enrichment Task
- Status Tracking
- Integration Tests

### Optional: Phase 6
- ChapterList UI Component
- Transcript Search
- Manual Retry Button

## Dependencies

### Backend
- `yt-dlp` - YouTube data extraction
- `groq` - Whisper API client
- `arq` or similar - Background task queue
- `ffmpeg` - System dependency for audio extraction

### Frontend
- No new dependencies

## Cost Analysis

| Source | Cost | Usage |
|--------|------|-------|
| yt-dlp Auto-Captions | Free | ~80% of videos |
| Groq Whisper | ~$0.02/video | ~20% fallback |

**Estimated monthly cost for 1000 videos without captions: ~$18.50**

## Future Considerations

- **Vector Embeddings**: Add pgvector column for semantic search
- **Multi-language**: Support for multiple caption languages
- **Speaker Diarization**: Identify speakers in transcripts
- **AI Summary**: Generate video summaries from transcripts
