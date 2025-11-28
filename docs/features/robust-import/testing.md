# Testing Strategy: Robust Video Import

## Test-Pyramide

```
                    ┌───────────┐
                    │   E2E     │  3 Tests
                    │  (slow)   │
                    ├───────────┤
                    │Integration│  5 Tests
                    │ (medium)  │
                    ├───────────┤
                    │   Unit    │  12 Tests
                    │  (fast)   │
                    └───────────┘
```

## Unit Tests (Backend)

### 1. Two-Phase Import

```python
# backend/tests/test_two_phase_import.py

class TestTwoPhaseImport:

    async def test_video_created_instantly(self, db, client):
        """Video erscheint sofort mit stage='created'"""
        response = await client.post("/api/lists/123/videos", json={
            "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
        })

        assert response.status_code == 201
        video = response.json()
        assert video["import_stage"] == "created"
        assert video["import_progress"] == 0
        assert video["thumbnail_url"].startswith("https://img.youtube.com")

    async def test_enrichment_job_enqueued(self, db, client, mock_arq):
        """Background Job wird enqueued"""
        response = await client.post("/api/lists/123/videos", json={
            "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
        })

        video_id = response.json()["id"]
        mock_arq.enqueue_job.assert_called_with(
            'enrich_video_staged', video_id
        )

    async def test_duplicate_returns_409(self, db, client):
        """Duplicate Video gibt 409 zurück"""
        # First import
        await client.post("/api/lists/123/videos", json={
            "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
        })

        # Duplicate
        response = await client.post("/api/lists/123/videos", json={
            "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
        })

        assert response.status_code == 409
```

### 2. Staged Enrichment

```python
# backend/tests/test_staged_enrichment.py

class TestStagedEnrichment:

    async def test_progress_updates_published(self, worker_ctx, mock_redis):
        """Progress Updates werden zu Redis gepublisht"""
        await enrich_video_staged(worker_ctx, video_id)

        calls = mock_redis.publish.call_args_list
        stages = [json.loads(c[0][1])["stage"] for c in calls]

        assert stages == ["metadata", "captions", "chapters", "complete"]

    async def test_stage_saved_to_db(self, worker_ctx, db):
        """Stage wird in DB gespeichert"""
        await enrich_video_staged(worker_ctx, video_id)

        video = await db.get(Video, video_id)
        assert video.import_stage == "complete"
        assert video.import_progress == 100

    async def test_partial_failure_saves_progress(self, worker_ctx, db, mock_yt):
        """Bei Fehler wird letzter Stand gespeichert"""
        mock_yt.get_captions.side_effect = Exception("Rate limit")

        with pytest.raises(Exception):
            await enrich_video_staged(worker_ctx, video_id)

        video = await db.get(Video, video_id)
        assert video.import_stage == "captions"  # Stuck at captions
        assert video.import_progress == 60
```

### 3. Rate Limiter

```python
# backend/tests/test_rate_limiter.py

class TestRateLimiter:

    async def test_max_concurrent_enforced(self):
        """Maximal N gleichzeitige Anfragen"""
        limiter = AdaptiveRateLimiter(max_concurrent=3)
        concurrent = 0
        max_concurrent = 0

        async def task():
            nonlocal concurrent, max_concurrent
            async with limiter.acquire():
                concurrent += 1
                max_concurrent = max(max_concurrent, concurrent)
                await asyncio.sleep(0.1)
                concurrent -= 1

        await asyncio.gather(*[task() for _ in range(10)])
        assert max_concurrent == 3

    async def test_circuit_breaker_opens_after_failures(self):
        """Circuit Breaker öffnet nach 3 Fehlern"""
        limiter = AdaptiveRateLimiter()

        limiter.on_failure(is_rate_limit=True)
        limiter.on_failure(is_rate_limit=True)
        limiter.on_failure(is_rate_limit=True)

        assert limiter.circuit_open == True

    async def test_delay_increases_on_rate_limit(self):
        """Delay erhöht sich bei Rate Limit"""
        limiter = AdaptiveRateLimiter(base_delay=2.0)
        initial_delay = limiter.delay

        limiter.on_failure(is_rate_limit=True)

        assert limiter.delay > initial_delay
```

### 4. Groq Transcriber

```python
# backend/tests/test_groq_transcriber.py

class TestGroqTranscriber:

    async def test_transcription_returns_text(self, mock_groq_api):
        """Transkription gibt Text zurück"""
        mock_groq_api.post.return_value.json.return_value = {
            "text": "Hello world transcription"
        }

        transcriber = GroqTranscriber()
        result = await transcriber.transcribe("dQw4w9WgXcQ")

        assert result == "Hello world transcription"

    async def test_audio_cleanup_after_transcription(self, mock_groq_api, tmp_path):
        """Audio-Datei wird nach Transkription gelöscht"""
        transcriber = GroqTranscriber()
        await transcriber.transcribe("dQw4w9WgXcQ")

        assert not list(tmp_path.glob("*.mp3"))
```

### 5. Error Classifier

```python
# backend/tests/test_error_classifier.py

class TestErrorClassifier:

    def test_403_not_retried(self):
        error = HTTPError(status=403)
        msg, should_retry = classify_error(error)

        assert msg == "Video nicht verfügbar"
        assert should_retry == False

    def test_429_silently_retried(self):
        error = HTTPError(status=429)
        msg, should_retry = classify_error(error)

        assert msg is None
        assert should_retry == True

    def test_timeout_silently_retried(self):
        error = TimeoutError()
        msg, should_retry = classify_error(error)

        assert msg is None
        assert should_retry == True
```

## Unit Tests (Frontend)

### 6. useWebSocket Hook

```typescript
// frontend/src/hooks/__tests__/useWebSocket.test.ts

describe('useWebSocket', () => {

  it('connects to WebSocket on mount', () => {
    const { result } = renderHook(() => useWebSocket())

    expect(mockWebSocket).toHaveBeenCalledWith(
      expect.stringContaining('/api/ws/progress')
    )
  })

  it('sets isConnected true on open', async () => {
    const { result } = renderHook(() => useWebSocket())

    act(() => {
      mockWebSocket.triggerOpen()
    })

    expect(result.current.isConnected).toBe(true)
  })

  it('calls subscriber on matching message', async () => {
    const { result } = renderHook(() => useWebSocket())
    const callback = jest.fn()

    act(() => {
      result.current.subscribe('video-123', callback)
    })

    act(() => {
      mockWebSocket.triggerMessage({
        type: 'import_progress',
        video_id: 'video-123',
        progress: 50
      })
    })

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      video_id: 'video-123',
      progress: 50
    }))
  })
})
```

### 7. ProgressOverlay Component

```typescript
// frontend/src/components/__tests__/ProgressOverlay.test.tsx

describe('ProgressOverlay', () => {

  it('renders progress percentage', () => {
    render(<ProgressOverlay progress={60} stage="captions" />)

    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('updates SVG dashoffset based on progress', () => {
    const { rerender } = render(<ProgressOverlay progress={0} />)

    const circle = screen.getByTestId('progress-circle')
    const initialOffset = circle.getAttribute('stroke-dashoffset')

    rerender(<ProgressOverlay progress={50} />)

    const newOffset = circle.getAttribute('stroke-dashoffset')
    expect(parseFloat(newOffset!)).toBeLessThan(parseFloat(initialOffset!))
  })

  it('has correct aria attributes', () => {
    render(<ProgressOverlay progress={75} />)

    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '75')
  })
})
```

### 8. VideoCard Importing State

```typescript
// frontend/src/components/__tests__/VideoCard.test.tsx

describe('VideoCard importing state', () => {

  it('applies grayscale when importing', () => {
    render(
      <VideoCard
        video={mockVideo}
        importProgress={{ progress: 50, stage: 'captions' }}
      />
    )

    expect(screen.getByTestId('video-card')).toHaveClass('grayscale')
  })

  it('shows ProgressOverlay when importing', () => {
    render(
      <VideoCard
        video={mockVideo}
        importProgress={{ progress: 50, stage: 'captions' }}
      />
    )

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('is not clickable when importing', () => {
    render(
      <VideoCard
        video={mockVideo}
        importProgress={{ progress: 50, stage: 'captions' }}
      />
    )

    expect(screen.getByTestId('video-card')).toHaveAttribute('aria-disabled', 'true')
  })

  it('removes overlay at 100%', () => {
    render(
      <VideoCard
        video={mockVideo}
        importProgress={{ progress: 100, stage: 'complete' }}
      />
    )

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByTestId('video-card')).not.toHaveClass('grayscale')
  })
})
```

## Integration Tests

### 9. WebSocket Progress Flow

```python
# backend/tests/integration/test_websocket_progress.py

class TestWebSocketProgress:

    async def test_full_progress_flow(self, client, websocket_client):
        """Kompletter Progress Flow via WebSocket"""
        # Connect WebSocket
        async with websocket_client.connect("/api/ws/progress") as ws:
            # Trigger import
            response = await client.post("/api/lists/123/videos", json={
                "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
            })
            video_id = response.json()["id"]

            # Collect progress messages
            messages = []
            for _ in range(4):  # metadata, captions, chapters, complete
                msg = await asyncio.wait_for(ws.recv(), timeout=30)
                messages.append(json.loads(msg))

            # Verify stages
            stages = [m["stage"] for m in messages]
            assert stages == ["metadata", "captions", "chapters", "complete"]

            # Verify progress increases
            progress = [m["progress"] for m in messages]
            assert progress == [25, 60, 90, 100]
```

### 10. Batch Import with Rate Limiting

```python
# backend/tests/integration/test_batch_import.py

class TestBatchImport:

    async def test_batch_50_videos_success(self, client, mock_youtube):
        """50 Videos importieren ohne Fehler"""
        urls = [f"https://youtube.com/watch?v={i}" for i in range(50)]

        response = await client.post("/api/lists/123/videos/batch", json={
            "urls": urls
        })

        assert response.status_code == 201
        result = response.json()
        assert result["created"] == 50
        assert result["duplicates"] == 0

    async def test_batch_handles_rate_limit(self, client, mock_youtube):
        """Batch überlebt Rate Limiting"""
        # Simulate rate limit after 10 videos
        call_count = 0
        async def rate_limited_fetch(*args):
            nonlocal call_count
            call_count += 1
            if call_count > 10 and call_count < 15:
                raise HTTPError(status=429)
            return mock_video_data

        mock_youtube.fetch.side_effect = rate_limited_fetch

        urls = [f"https://youtube.com/watch?v={i}" for i in range(20)]
        response = await client.post("/api/lists/123/videos/batch", json={
            "urls": urls
        })

        # Should still succeed (with retries)
        assert response.status_code == 201
```

### 11. Caption Fallback Flow

```python
# backend/tests/integration/test_caption_fallback.py

class TestCaptionFallback:

    async def test_fallback_to_groq_on_youtube_failure(
        self, worker_ctx, mock_youtube, mock_groq
    ):
        """Groq Fallback wenn YouTube Captions fehlschlagen"""
        mock_youtube.get_captions.side_effect = Exception("No captions")
        mock_groq.transcribe.return_value = "Whisper transcript"

        await enrich_video_staged(worker_ctx, video_id)

        video = await db.get(Video, video_id)
        assert video.enrichment.captions_source == "whisper"
        assert "Whisper transcript" in video.enrichment.transcript_text
```

### 12. Frontend WebSocket Integration

```typescript
// frontend/src/__tests__/integration/websocket-integration.test.tsx

describe('WebSocket Integration', () => {

  it('updates VideoCard progress in real-time', async () => {
    render(
      <WebSocketProvider>
        <VideosPage />
      </WebSocketProvider>
    )

    // Simulate import
    await userEvent.drop(dropZone, { dataTransfer: createDataTransfer(urls) })

    // Initial state
    expect(screen.getByTestId('video-card-0')).toHaveClass('grayscale')

    // Simulate WebSocket progress
    act(() => {
      mockWebSocket.triggerMessage({
        type: 'import_progress',
        video_id: 'new-video-id',
        progress: 100,
        stage: 'complete'
      })
    })

    // Final state
    await waitFor(() => {
      expect(screen.getByTestId('video-card-0')).not.toHaveClass('grayscale')
    })
  })
})
```

## E2E Tests

### 13. Single Video Import

```typescript
// e2e/single-video-import.spec.ts

test.describe('Single Video Import', () => {

  test('video appears instantly and completes', async ({ page }) => {
    await page.goto('/lists/test-list')

    // Drag & Drop simulieren
    await page.evaluate(() => {
      const event = new DragEvent('drop', {
        dataTransfer: new DataTransfer()
      })
      event.dataTransfer.setData('text/plain', 'https://youtube.com/watch?v=dQw4w9WgXcQ')
      document.querySelector('.video-grid').dispatchEvent(event)
    })

    // Video erscheint sofort (grau)
    const videoCard = page.locator('[data-testid="video-card"]').first()
    await expect(videoCard).toBeVisible({ timeout: 1000 })
    await expect(videoCard).toHaveClass(/grayscale/)

    // Progress Overlay sichtbar
    await expect(videoCard.locator('[role="progressbar"]')).toBeVisible()

    // Warte auf Completion (max 30s)
    await expect(videoCard).not.toHaveClass(/grayscale/, { timeout: 30000 })

    // Overlay verschwunden
    await expect(videoCard.locator('[role="progressbar"]')).not.toBeVisible()

    // Video ist klickbar
    await videoCard.click()
    await expect(page.locator('.video-detail-modal')).toBeVisible()
  })
})
```

### 14. Batch Import

```typescript
// e2e/batch-import.spec.ts

test.describe('Batch Import', () => {

  test('imports 20 videos with progress', async ({ page }) => {
    await page.goto('/lists/test-list')

    // CSV Upload simulieren
    const csvContent = Array.from({ length: 20 }, (_, i) =>
      `https://youtube.com/watch?v=video${i}`
    ).join('\n')

    await page.setInputFiles('input[type="file"]', {
      name: 'videos.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })

    // Alle Videos erscheinen
    await expect(page.locator('[data-testid="video-card"]')).toHaveCount(20, {
      timeout: 5000
    })

    // Progress Banner sichtbar
    await expect(page.locator('.batch-progress-banner')).toBeVisible()

    // Warte auf alle fertig (max 3 Minuten)
    await expect(page.locator('.batch-progress-banner')).toContainText('100%', {
      timeout: 180000
    })

    // Alle Videos farbig
    const grayCards = await page.locator('[data-testid="video-card"].grayscale').count()
    expect(grayCards).toBe(0)
  })
})
```

### 15. Error Handling

```typescript
// e2e/error-handling.spec.ts

test.describe('Error Handling', () => {

  test('shows user-friendly error for unavailable video', async ({ page }) => {
    // Mock: Video ist privat
    await page.route('**/api/lists/*/videos', (route) => {
      route.fulfill({
        status: 201,
        body: JSON.stringify({ id: 'test', import_stage: 'created' })
      })
    })

    await page.route('**/api/ws/progress', (route) => {
      // Simulate error after metadata
      route.fulfill({
        body: JSON.stringify({
          type: 'import_progress',
          video_id: 'test',
          progress: 25,
          stage: 'error',
          message: 'Video nicht verfügbar'
        })
      })
    })

    await page.goto('/lists/test-list')

    // Import starten
    await page.evaluate(() => {
      // Trigger drop...
    })

    // Error State
    const videoCard = page.locator('[data-testid="video-card"]').first()
    await expect(videoCard.locator('.warning-icon')).toBeVisible()

    // Hover zeigt verständliche Message
    await videoCard.hover()
    await expect(page.locator('.tooltip')).toContainText('Video nicht verfügbar')

    // NICHT sichtbar: technische Details
    await expect(page.locator('.tooltip')).not.toContainText('403')
    await expect(page.locator('.tooltip')).not.toContainText('Error')
  })
})
```

## Test-Daten

### Fixtures

```python
# backend/tests/fixtures.py

@pytest.fixture
def mock_video_data():
    return {
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": 300,
        "thumbnail_url": "https://img.youtube.com/vi/test/mqdefault.jpg",
        "captions": "Test transcript...",
        "chapters": []
    }

@pytest.fixture
def mock_youtube(mock_video_data):
    with patch('app.services.youtube.YouTubeClient') as mock:
        mock.return_value.fetch.return_value = mock_video_data
        yield mock.return_value
```

## Coverage Ziele

| Bereich | Ziel | Aktuell |
|---------|------|---------|
| Backend Unit | > 90% | - |
| Frontend Unit | > 80% | - |
| Integration | > 70% | - |
| E2E Critical Paths | 100% | - |

## Exit Condition ✅

**Comprehensive Test Strategy?**

> - 12 Unit Tests (Backend + Frontend)
> - 5 Integration Tests
> - 3 E2E Tests für Critical Paths
> - Coverage Ziele definiert
> - Test-Daten/Fixtures geplant

✅ Testing Strategy fertig, bereit für Phase 10.
