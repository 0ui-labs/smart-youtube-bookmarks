# Smart YouTube Bookmarks

A modern web application for organizing and managing YouTube video collections with advanced metadata extraction and real-time processing capabilities.

---

## Features

### Real-Time Progress Updates 🔄

WebSocket-based progress tracking for CSV video imports with resilient reconnection and history synchronization.

**Key Capabilities:**

- **Live Progress Bar** - Real-time updates during video processing with visual feedback
- **Reconnection Resilience** - Automatic history sync on reconnect - close tab, reopen, and progress is restored
- **Multi-Tab Support** - Same progress displayed across all browser tabs simultaneously
- **Error Handling** - Graceful degradation when services unavailable, detailed error messages
- **Throttling** - Intelligent progress updates (5% steps) to prevent UI flooding
- **Cleanup** - Completed jobs automatically removed after 5 minutes to prevent memory leaks

**Technical Implementation:**

- **WebSocket Endpoint:** `ws://localhost:8000/api/ws/progress`
- **History API:** `GET /api/jobs/{job_id}/progress-history?since={timestamp}`
- **Dual-Write Pattern:** Redis pub/sub for real-time + PostgreSQL for persistence
- **Post-Connection Auth:** Secure authentication after WebSocket establishment (Option B from security audit)

**Usage:**

1. Navigate to Videos page for any list
2. Click "Videos per CSV hochladen"
3. Upload CSV file with YouTube video IDs (one per line)
4. Progress bar appears automatically with live updates
5. Processing continues in background - safe to close/reopen tab
6. Completed progress bar fades after 5 minutes

**Architecture:**

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│   Frontend  │◄───WS───┤   FastAPI   │◄───────┤   ARQ Worker │
│   (React)   │         │   Backend   │         │  (VideoProc) │
└─────────────┘         └─────────────┘         └──────────────┘
       │                       │                        │
       │                       │                        │
       └───────HTTP────────────┤                        │
               (History API)   │                        │
                              │                        │
                         ┌────▼────┐              ┌────▼────┐
                         │  Redis  │              │ Postgres│
                         │ Pub/Sub │              │   DB    │
                         └─────────┘              └─────────┘
                         (Real-time)              (Persistent)
```

---

### Dashboard 📊

Real-time job progress monitoring dashboard with WebSocket connection.

**Features:**
- Live progress updates (no page refresh required)
- Connection status indicator (connecting/connected/reconnecting/disconnected)
- Job cards with progress bars
- Error messages for failed jobs
- Auto-cleanup (completed jobs removed after 5 min)
- History sync on reconnection

**Technology:**
- `react-use-websocket` for connection management
- FastAPI WebSocket endpoint (`/api/ws/progress`)
- Redis Pub/Sub for real-time events
- PostgreSQL for progress history persistence

**Usage:**
1. Click "Dashboard" in navigation menu
2. View all active video processing jobs
3. Monitor real-time progress updates
4. Jobs automatically disappear after completion (5 min TTL)

**See:** `docs/features/dashboard-real-time-progress.md` for detailed documentation.

---

### Video Collections Management 📚

- **List Organization** - Create and manage multiple video collections
- **CSV Import/Export** - Bulk upload videos via CSV, export for backup
- **Metadata Extraction** - Automatic YouTube metadata fetching (title, channel, duration, thumbnails)
- **Custom Schemas** - Define custom fields for video annotations
- **Status Tracking** - Monitor video processing status (Pending, Processing, Completed, Failed)

---

### Advanced Search & Filtering 🔍

- **Full-Text Search** - Search across video titles, channels, and custom fields
- **Filter by Status** - Find pending, completed, or failed videos
- **Sort & Pagination** - Efficient browsing of large video collections
- **Table View** - Responsive data table with TanStack Table

---

## Tech Stack

### Backend
- **Framework:** FastAPI 0.109.0 (Python 3.11)
- **Database:** PostgreSQL 16 (asyncpg, SQLAlchemy 2.0 async)
- **Task Queue:** ARQ (Redis-based background workers)
- **WebSocket:** FastAPI native WebSocket support
- **Migrations:** Alembic 1.13.1
- **Validation:** Pydantic 2.5.3

### Frontend
- **Framework:** React 18.2.0
- **Build Tool:** Vite 5.0.11
- **Language:** TypeScript 5.3.3 (strict mode)
- **Styling:** Tailwind CSS 3.4.1
- **State Management:** Zustand 4.5.0
- **Data Fetching:** TanStack Query 5.17.19
- **Tables:** TanStack Table 8.11.6
- **Testing:** Vitest 1.2.1

### Infrastructure
- **Database:** PostgreSQL 16 (Docker)
- **Cache/Queue:** Redis 7 (Docker)
- **Container Orchestration:** Docker Compose 3.9

---

## Getting Started

### Prerequisites

- **Python:** 3.11+
- **Node.js:** 18+
- **Docker:** Latest version
- **Docker Compose:** Latest version

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/0ui-labs/smart-youtube-bookmarks.git
cd smart-youtube-bookmarks
```

**2. Start Docker services**
```bash
docker-compose up -d postgres redis
```

**3. Setup Backend**
```bash
cd backend
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start backend server
uvicorn app.main:app --reload
```

Backend will be available at **http://localhost:8000**

**4. Setup Frontend**
```bash
cd frontend
npm install

# Start development server
npm run dev
```

Frontend will be available at **http://localhost:5173**

**5. Start ARQ Worker (for background processing)**
```bash
cd backend
arq app.workers.video_processor.WorkerSettings
```

---

## Usage

### Creating a Video List

1. Navigate to **Home** (`http://localhost:5173`)
2. Click **"Neue Liste"**
3. Enter list name and description
4. Select optional schema for custom fields
5. Click **"Erstellen"**

### Importing Videos via CSV

1. Open a video list
2. Click **"Videos per CSV hochladen"**
3. Upload CSV file with YouTube video IDs (one per line, or `youtube_id` column)
4. Watch real-time progress bar as videos are processed
5. Videos appear in table once metadata extraction completes

**Example CSV:**
```csv
MW3t6jP9AOs
R4I_YaFYv3M
b-IXXlnLeuI
```

### Monitoring Progress

- **Live Updates:** Progress bar shows current status (0-100%)
- **Video Counter:** Displays processed/total videos (e.g., "3/10")
- **Status Badge:** Color-coded status (Processing=blue, Completed=green, Failed=red)
- **Connection Status:** Banner shows reconnection attempts if connection lost
- **History Recovery:** Close/reopen tab - progress is restored from database

---

## Development

### Running Tests

**Backend (pytest):**
```bash
cd backend
pytest                           # All tests
pytest tests/integration/ -v     # Integration tests
pytest -k "test_name" -v         # Specific test
```

**Frontend (Vitest):**
```bash
cd frontend
npm test                         # All tests
npm test -- VideosPage           # Specific test
npm run test:coverage            # With coverage
```

### Code Quality

**Backend:**
```bash
# Type checking
mypy app/

# Linting
flake8 app/

# Formatting
black app/
isort app/
```

**Frontend:**
```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Formatting
npm run format
```

### Database Migrations

**Create migration:**
```bash
cd backend
alembic revision --autogenerate -m "description"
```

**Apply migrations:**
```bash
alembic upgrade head
```

**Rollback:**
```bash
alembic downgrade -1
```

---

## API Documentation

Once the backend is running, visit:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/lists` | GET | List all video collections |
| `/api/lists` | POST | Create new list |
| `/api/lists/{id}/videos` | GET | Get videos in list |
| `/api/lists/{id}/upload-csv` | POST | Upload CSV for processing |
| `/api/jobs/{job_id}/progress-history` | GET | Get progress history |
| `/api/ws/progress` | WS | WebSocket for real-time progress |

---

## WebSocket Progress API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8000/api/ws/progress');

// Authenticate after connection
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-auth-token'
}));
```

### Message Types

**Progress Event:**
```json
{
  "job_id": "uuid",
  "progress_percent": 45,
  "processed_count": 9,
  "total_count": 20,
  "current_video": "MW3t6jP9AOs",
  "message": "Processing video 9 of 20",
  "timestamp": "2025-10-29T12:34:56Z"
}
```

**Completion Event:**
```json
{
  "job_id": "uuid",
  "progress_percent": 100,
  "processed_count": 20,
  "total_count": 20,
  "status": "completed",
  "message": "All videos processed successfully",
  "timestamp": "2025-10-29T12:36:00Z"
}
```

**Error Event:**
```json
{
  "job_id": "uuid",
  "progress_percent": 35,
  "status": "error",
  "error": "Failed to process video: Invalid video ID",
  "timestamp": "2025-10-29T12:35:15Z"
}
```

---

## Testing

### Manual Testing

See [`docs/testing/websocket-progress-manual-tests.md`](docs/testing/websocket-progress-manual-tests.md) for comprehensive manual testing checklist.

### Automated Testing Report

See [`docs/testing/websocket-progress-automated-tests.md`](docs/testing/websocket-progress-automated-tests.md) for automated test results and findings.

**Test Coverage:**
- **Backend:** 59 tests (100% passing)
- **Frontend:** 31 tests (100% passing)
- **Integration:** 10 tests (progress flow + error scenarios)

---

## Known Limitations

### Authentication
- Currently uses hardcoded `user_id` for development
- Console warning: "No auth token found for WebSocket connection" (expected)
- Production deployment requires OAuth/JWT implementation

### CSV Upload & Processing
- CSV upload endpoint (`/api/lists/{id}/videos/bulk`) automatically creates and starts processing jobs
- Real-time progress updates via WebSocket connection
- ARQ worker must be running for video metadata processing

### Performance
- Large CSV uploads (1000+ videos) may take significant time
- WebSocket throttling limits progress updates to 5% steps
- Redis pub/sub required for real-time updates (degrades gracefully to polling)

### Browser Compatibility
- Tested on Chrome 120+, Firefox 121+, Safari 17+
- WebSocket support required (all modern browsers)
- Reduced motion preferences respected for accessibility

---

## Deployment

### Docker Production Build

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose exec backend alembic upgrade head
```

### Environment Variables

**Backend (.env):**
```env
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/db
REDIS_URL=redis://redis:6379
SECRET_KEY=your-secret-key-here
YOUTUBE_API_KEY=your-youtube-api-key
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Build/tooling changes

---

## License

This project is licensed under the MIT License - see LICENSE file for details.

---

## Acknowledgements

- **FastAPI** - Modern, fast web framework for building APIs
- **React** - JavaScript library for building user interfaces
- **TanStack** - Powerful data-fetching and table libraries
- **Tailwind CSS** - Utility-first CSS framework
- **ARQ** - Async task queue for Python

---

## Support

For bugs and feature requests, please open an issue on GitHub:
https://github.com/0ui-labs/smart-youtube-bookmarks/issues

---

**Built with ❤️ using FastAPI, React, and WebSockets**
