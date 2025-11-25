# Codebase Analysis: Video Player Integration

## Tech Stack

### Frontend
- **Framework:** React 18.2.0 + TypeScript
- **Build:** Vite 5.0.11
- **State:** Zustand 4.5.0 (Stores: tableSettings, tags, fieldFilter)
- **Data Fetching:** TanStack React Query v5
- **Routing:** React Router v6.21.3
- **Forms:** React Hook Form + Zod
- **Styling:** Tailwind CSS 3.4.1 mit CSS Variables

### Backend
- **Framework:** FastAPI (Python)
- **ORM:** SQLAlchemy + Alembic Migrations
- **Queue:** ARQ (async mit Redis)
- **Realtime:** WebSocket Support

## Relevante Architektur-Patterns

### Komponenten-Pattern
```typescript
// Typische Komponenten-Struktur
interface ComponentProps {
  data: DataType;
  onAction?: (params: Params) => void;
}

export const Component: React.FC<ComponentProps> = ({ data, onAction }) => {
  return <div className="tailwind-classes">...</div>;
};
```

### Custom Hooks Pattern
```typescript
// Hooks für API-Calls via React Query
export const useVideos = () => {
  return useQuery({
    queryKey: ['videos'],
    queryFn: fetchVideos,
  });
};
```

### Zustand Store Pattern
```typescript
// Store mit persist Middleware
export const useSettingsStore = create<Settings>()(
  persist(
    (set) => ({
      setting: 'value',
      setSetting: (value) => set({ setting: value }),
    }),
    { name: 'settings-storage' }
  )
);
```

## Video-bezogene Komponenten

### VideoDetailsPage (`frontend/src/pages/VideoDetailsPage.tsx`)
- Vollständige Video-Ansicht
- Großes Thumbnail (16:9, aspect-video)
- Metadata: Title, Channel, Duration
- Tags und Custom Fields

### VideoDetailsModal (`frontend/src/components/VideoDetailsModal.tsx`)
- Modal-Variante der Detail-Ansicht
- Öffnet sich aus VideosPage

### Video Data Model
```typescript
interface Video {
  id: string;           // UUID
  youtube_id: string;   // 11 chars
  title: string | null;
  channel: string | null;
  thumbnail_url: string | null;
  duration: number | null;  // Sekunden
  published_at: string | null;
  tags: Tag[];
  field_values: VideoFieldValue[];
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

## Styling-System

### CSS Variables (index.css)
```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96.1%;
  /* ... weitere Farben */
}
```

### Tailwind-Integration
- Semantic color classes (`bg-primary`, `text-muted-foreground`)
- Responsive utilities (`md:`, `lg:`)
- Custom spacing via design tokens

## Externe Libraries (bereits integriert)
- **Framer Motion:** Animationen
- **Recharts:** Charts/Analytics
- **Embla Carousel:** Slider
- **TanStack Table:** Tabellen-Logik

## Ähnliche Features als Referenz

### Custom Field System
- Dynamische Felder pro Video
- Backend-Schema + Frontend-Rendering
- Optimistic Updates via React Query

### Tag-System
- CRUD über API
- Zustand Store für lokalen State
- Multi-Select mit React Query Mutations

## Key Files für Integration

| Bereich | Datei | Relevanz |
|---------|-------|----------|
| UI | `VideoDetailsPage.tsx` | Thumbnail → Player ersetzen |
| UI | `VideoDetailsModal.tsx` | Modal mit Player |
| Types | `types/video.ts` | Video-Interface erweitern |
| API | `api/` | Fortschritt-Endpoint |
| Store | `stores/` | Player-Settings Store |
| Backend | `app/models/` | Video Model erweitern |
| Backend | `app/api/videos.py` | Fortschritt-Endpoint |

## Exit Condition

✅ Klares Bild der Codebase-Architektur:
- React + TypeScript + Tailwind Frontend
- FastAPI + SQLAlchemy Backend
- Integration folgt etablierten Patterns (Hooks, Stores, Components)
