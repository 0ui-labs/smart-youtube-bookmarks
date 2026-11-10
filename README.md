# Smart YouTube Bookmarks

A modern web application for organizing and managing YouTube video collections with custom fields, real-time processing, and video enrichment.

---

## Features

### 📚 Video Collections (Lists)
- Create and manage multiple video collections
- Each list can have its own custom fields and schemas
- User-scoped organization

### 🎬 Video Management
- **Add Videos** – Via YouTube URL or video ID
- **Bulk CSV Import** – Upload hundreds of videos with real-time progress tracking
- **CSV Export** – Export with all custom field values included
- **Metadata Extraction** – Automatic fetching of title, channel, duration, thumbnails, view counts
- **Status Tracking** – Monitor processing status (Pending → Processing → Completed/Failed)

### 🏷️ Custom Fields System
Define your own fields to annotate videos:

| Field Type | Description | Example |
|------------|-------------|---------|
| **Rating** | Star rating (1-5 or custom max) | ⭐⭐⭐⭐ |
| **Select** | Dropdown with predefined options | "Beginner", "Advanced" |
| **Text** | Free-form text notes | "Great explanation of React hooks" |
| **Boolean** | Yes/No toggle | ✅ Watched |

- **Field Schemas** – Create reusable templates combining multiple fields
- **Per-Video Values** – Each video stores its own field values
- **CSV Round-Trip** – Import/export field values via CSV

### 📺 Channels
- Auto-created from video metadata
- Filter videos by channel in sidebar
- Show/hide channels
- Channel avatars and thumbnails

### 🏷️ Tags
- Create custom tags per list
- Assign multiple tags to videos
- Bulk tag assignment

### 🔄 Real-Time Progress (WebSocket)
- Live progress bar during CSV imports
- Multi-tab synchronization
- Reconnection resilience with history recovery
- Redis pub/sub + PostgreSQL persistence

### 🎥 Video Player
- Embedded HTML5 player (Vidstack)
- Watch progress persistence
- Keyboard shortcuts
- Picture-in-picture support

### 🔍 Search & Filtering
- Full-text search across video metadata
- Filter by status, channel, tags, custom fields
- Advanced field filtering with operators
- Sortable, paginated table view (TanStack Table)

### 📊 Analytics Dashboard
- Real-time job monitoring
- Video statistics by status/channel
- WebSocket connection status

### ✨ Video Enrichment (Optional)
- Transcript extraction
- Audio transcription (Groq Whisper)
- AI-powered metadata enrichment (Google Gemini)

---

## Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **FastAPI** 0.109 | Web framework (Python 3.11) |
| **PostgreSQL** 16 | Primary database |
| **SQLAlchemy** 2.0 | Async ORM |
| **Redis** 7 | Cache, pub/sub, job queue |
| **ARQ** | Background task processing |
| **Alembic** | Database migrations |
| **Pydantic** 2.5 | Validation & serialization |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React** 18.2 | UI framework |
| **TypeScript** 5.3 | Type safety (strict mode) |
| **Vite** 5.0 | Build tool |
| **Tailwind CSS** 3.4 | Styling |
| **Zustand** | State management |
| **TanStack Query** | Server state & caching |
| **TanStack Table** | Data tables |
| **Radix UI** | Accessible UI primitives |
| **Tiptap** | Rich text editor |
| **Vidstack** | Video player |
| **React Hook Form + Zod** | Form handling & validation |

### External APIs
| Service | Purpose |
|---------|---------|
| **YouTube Data API** | Video metadata |
| **Google Gemini** | AI enrichment (optional) |
| **Groq Whisper** | Audio transcription (optional) |

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose

### 1. Clone & Start Infrastructure

```bash
git clone https://github.com/your-repo/smart-youtube-bookmarks.git
cd smart-youtube-bookmarks

# Start PostgreSQL and Redis
docker-compose up -d
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run database migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

Backend runs at **http://localhost:8000**

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:5173**

### 4. Start Background Worker

```bash
cd backend
source .venv/bin/activate
arq app.workers.settings.WorkerSettings
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Required
YOUTUBE_API_KEY=your_youtube_api_key_here

# Optional (for enrichment features)
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### Docker (`/.env` – for docker-compose)

```env
POSTGRES_DB=youtube_bookmarks
POSTGRES_USER=user
POSTGRES_PASSWORD=changeme
REDIS_URL=redis://redis:6379
```

---

## Usage

### Creating a Video List

1. Open **http://localhost:5173**
2. Click **"Neue Liste"**
3. Enter name and optional schema
4. Click **"Erstellen"**

### Importing Videos via CSV

```csv
youtube_id
dQw4w9WgXcQ
jNQXAC9IVRw
```

Or with custom fields:

```csv
url,field_Rating,field_Category
https://youtube.com/watch?v=dQw4w9WgXcQ,5,Music
https://youtu.be/jNQXAC9IVRw,3,Tutorial
```

1. Open a list → Click **"CSV hochladen"**
2. Select your CSV file
3. Watch real-time progress bar
4. Videos appear as they're processed

### Exporting Videos

`GET /api/lists/{list_id}/export/csv` exports all videos with custom field values.

---

## API Documentation

Interactive docs available when backend is running:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/lists` | GET/POST | List collections |
| `/api/lists/{id}/videos` | GET/POST | Videos in a list |
| `/api/lists/{id}/videos/bulk` | POST | CSV bulk import |
| `/api/lists/{id}/export/csv` | GET | CSV export |
| `/api/videos/{id}` | GET/PATCH/DELETE | Single video |
| `/api/videos/{id}/fields` | PUT | Update field values |
| `/api/custom_fields` | GET/POST | Custom field definitions |
| `/api/field_schemas` | GET/POST | Field schema templates |
| `/api/channels` | GET | User's channels |
| `/api/tags` | GET/POST | Tag management |
| `/api/ws/progress` | WebSocket | Real-time progress |

---

## Development

### Running Tests

**Backend:**
```bash
cd backend && source .venv/bin/activate
pytest                    # All tests
pytest -v -k "test_name"  # Specific test
```

**Frontend:**
```bash
cd frontend
npm test                  # All tests
npm run test:coverage     # With coverage
```

### Code Quality

**Backend:**
```bash
mypy app/          # Type checking
black app/         # Formatting
```

**Frontend:**
```bash
npx tsc --noEmit   # Type checking
npm run lint       # ESLint
```

### Database Migrations

```bash
cd backend && source .venv/bin/activate

# Create migration
alembic revision --autogenerate -m "description"

# Apply
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    FastAPI      │────▶│   PostgreSQL    │
│  React + Vite   │     │    Backend      │     │    Database     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │ WebSocket             │ Pub/Sub
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Real-time      │◀────│     Redis       │◀────│   ARQ Worker    │
│  Progress UI    │     │   Pub/Sub       │     │  (Background)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Project Structure

```
smart-youtube-bookmarks/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routers
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   ├── workers/       # ARQ background jobs
│   │   └── core/          # Config, database
│   ├── tests/
│   ├── alembic/           # Migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/         # Route components
│   │   ├── components/    # Reusable UI
│   │   ├── hooks/         # Custom hooks
│   │   ├── stores/        # Zustand state
│   │   ├── types/         # TypeScript types
│   │   └── api/           # API client
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## Known Limitations

- **Authentication:** Currently uses hardcoded user_id for development
- **Large Imports:** 1000+ videos may take significant time
- **Enrichment:** Requires optional API keys (Gemini, Groq)

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

**Commit Convention:** [Conventional Commits](https://www.conventionalcommits.org/)

---

## License

MIT License – see LICENSE file for details.

---

**Built with ❤️ using FastAPI, React, and TypeScript**


Der Zwischenstand der Codebase-Stabilisierung und die noch offenen Pflichtnachweise stehen
in [der Abnahmeübersicht](documentation/reports/codebase-stabilisierung-abnahme.md).
Für isolierte Tests gilt [Tooling Setup](documentation/TOOLING_SETUP.md#isolierte-stabilisierungsprüfungen).
HTTP-Benutzerisolation und Clerk-Sessions sind weiterhin nicht implementiert; keine öffentliche Freigabe.
