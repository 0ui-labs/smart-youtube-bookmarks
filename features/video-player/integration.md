# Integration Strategy: Video Player

## Grundprinzip: Minimale Disruption

Die Integration folgt dem bestehenden Architektur-Pattern der Codebase:
- React-Komponenten mit Props-Interface
- Custom Hooks für Logik
- Zustand Stores für persistenten State
- Tailwind CSS für Styling

---

## Frontend-Integrationsstrategie

### 1. VideoPlayer-Komponente (Wrapper)

**Entkoppeltes Design:**
```
┌─────────────────────────────────────────┐
│           VideoPlayer.tsx               │
│  ┌───────────────────────────────────┐  │
│  │    Plyr Instance (intern)         │  │
│  │    - YouTube Provider             │  │
│  │    - Event Handlers               │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Props:                                 │
│  - youtubeId: string                    │
│  - initialPosition?: number             │
│  - onTimeUpdate?: (seconds) => void     │
│  - onEnded?: () => void                 │
└─────────────────────────────────────────┘
```

**Interface-Boundary:**
- VideoPlayer kapselt Plyr vollständig
- Eltern-Komponenten kennen Plyr nicht
- Austauschbar gegen anderen Player (z.B. React-Player)

### 2. Hook-basierte Logik-Trennung

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  useVideoPlayer  │───▶│ useWatchProgress │───▶│    Backend API   │
│  (UI-Logik)      │    │  (Sync-Logik)    │    │                  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
         │
         ▼
┌──────────────────┐
│ playerSettings   │
│    Store         │
│  (Zustand)       │
└──────────────────┘
```

**useVideoPlayer:**
- Verwaltet Plyr-Ref und Lifecycle
- Debounced Progress-Updates
- Keyboard Shortcut Handling

**useWatchProgress:**
- GET watch_position beim Laden
- PATCH watch_position bei Updates
- Debouncing (alle 10 Sekunden oder bei Pause)

**playerSettingsStore:**
- Volume (localStorage persist)
- Playback Rate (localStorage persist)
- Preferred Quality (wenn unterstützt)

### 3. Erweiterungspunkte in bestehenden Komponenten

**VideoDetailsPage.tsx (Zeile 180-194):**
```tsx
// VORHER
{video.thumbnail_url && (
  <div className="relative w-full aspect-video ...">
    <img src={video.thumbnail_url} ... />
  </div>
)}

// NACHHER
<VideoPlayer
  youtubeId={video.youtube_id}
  initialPosition={video.watch_position}
  onTimeUpdate={handleTimeUpdate}
/>
```

**VideoDetailsModal.tsx (Zeile 124-130):**
```tsx
// Gleiche Änderung, aber mit Modal-spezifischem Cleanup
<VideoPlayer
  youtubeId={displayVideo.youtube_id}
  initialPosition={displayVideo.watch_position}
  onTimeUpdate={handleTimeUpdate}
  // Cleanup wenn Modal schließt
/>
```

---

## Backend-Integrationsstrategie

### 1. Additive Schema-Erweiterung

**Video Model erweitern (keine Breaking Changes):**
```python
# Neue nullable Felder - existierende Queries unberührt
watch_position: Mapped[Optional[int]] = mapped_column(
    Integer, nullable=True, default=None
)
watch_position_updated_at: Mapped[Optional[datetime]] = mapped_column(
    DateTime(timezone=True), nullable=True
)
```

### 2. Neuer Endpoint (nicht existierende Endpoints ändern)

```python
# Neuer Endpoint - keine Änderung an GET /videos/{id}
@router.patch("/videos/{video_id}/progress")
async def update_watch_progress(
    video_id: UUID,
    request: UpdateWatchProgressRequest,
    db: AsyncSession = Depends(get_db)
) -> UpdateWatchProgressResponse:
    ...
```

**Warum PATCH statt PUT?**
- Partial update (nur watch_position)
- Semantisch korrekt
- Konfliktfrei mit existierendem PUT /videos/{id}/fields

### 3. Response-Schema erweitern

```python
# VideoResponse erweitern
class VideoResponse(BaseModel):
    # ... existing fields ...
    watch_position: Optional[int] = None
    watch_position_updated_at: Optional[datetime] = None
```

---

## CSS-Integrationsstrategie

### 1. Plyr CSS einbinden

```tsx
// Option A: Import in VideoPlayer.tsx (scoped)
import 'plyr/dist/plyr.css'

// Option B: Import in main.tsx (global)
import 'plyr/dist/plyr.css'
```

**Empfehlung: Option A** - CSS nur laden wenn Player verwendet wird.

### 2. Theme-Anpassung via CSS Variables

```css
/* index.css - Plyr Theme Variables */
:root {
  --plyr-color-main: hsl(var(--primary));
  --plyr-video-control-color: hsl(var(--foreground));
  --plyr-video-control-color-hover: hsl(var(--primary));
  --plyr-font-family: var(--font-sans);
  --plyr-badge-background: hsl(var(--secondary));
  --plyr-badge-text-color: hsl(var(--secondary-foreground));
}

.dark {
  --plyr-color-main: hsl(var(--primary));
  /* Dark mode overrides if needed */
}
```

---

## Feature Flag Option

Falls Rollback nötig:

```typescript
// config/featureFlags.ts
export const FEATURE_FLAGS = {
  VIDEO_PLAYER_ENABLED: true,  // Toggle für Player
}
```

```tsx
// Verwendung
{FEATURE_FLAGS.VIDEO_PLAYER_ENABLED ? (
  <VideoPlayer youtubeId={video.youtube_id} />
) : (
  <img src={video.thumbnail_url} ... />
)}
```

**Empfehlung:** Feature Flag initial einbauen, später entfernen wenn stabil.

---

## Datenmigrations-Strategie

**Keine Datenmigration nötig:**
- `watch_position` ist nullable
- Default ist `null` (nicht geschaut)
- Bestandsdaten bleiben unverändert

**Alembic Migration:**
```python
def upgrade():
    op.add_column('videos', sa.Column('watch_position', sa.Integer(), nullable=True))
    op.add_column('videos', sa.Column('watch_position_updated_at', sa.DateTime(timezone=True), nullable=True))

def downgrade():
    op.drop_column('videos', 'watch_position_updated_at')
    op.drop_column('videos', 'watch_position')
```

---

## Zusammenfassung

| Aspekt | Strategie |
|--------|-----------|
| **Komponenten** | Wrapper-Pattern, Props-Interface |
| **Logik** | Custom Hooks (useVideoPlayer, useWatchProgress) |
| **State** | Zustand Store mit persist Middleware |
| **Backend** | Additive Änderungen, neuer PATCH Endpoint |
| **DB** | Nullable Felder, keine Datenmigration |
| **CSS** | CSS Variables für Theme-Integration |
| **Rollback** | Feature Flag ready |

## Exit Condition

✅ Klare Integrationsstrategie:
- Wrapper-Pattern für Plyr (austauschbar)
- Hooks für Logik-Trennung
- Additive Backend-Änderungen (keine Breaking Changes)
- Feature Flag für sicheren Rollout
