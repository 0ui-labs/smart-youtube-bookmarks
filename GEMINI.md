# Smart YouTube Bookmarks

A full-stack application for organizing and managing YouTube video collections with custom fields, real-time processing, and video enrichment.

## Project Overview

- **Purpose:** Manage YouTube video lists with custom metadata, tags, and AI enrichment.
- **Architecture:** Monorepo with a Python FastAPI backend and a React frontend.
- **Infrastructure:** Docker Compose for PostgreSQL (primary DB) and Redis (cache/pub-sub).

## Tech Stack

### Backend (`backend/`)
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL (Async SQLAlchemy 2.0)
- **Migrations:** Alembic
- **Async Tasks:** ARQ with Redis
- **Validation:** Pydantic 2.5
- **Testing:** Pytest

### Frontend (`frontend/`)
- **Framework:** React 18.2 + Vite
- **Language:** TypeScript 5.3
- **State Management:** Zustand (Client), TanStack Query (Server)
- **UI:** Tailwind CSS, Radix UI, TanStack Table
- **Linting/Formatting:** Biome
- **API Client:** Orval (generated from OpenAPI)

## Getting Started

### 1. Infrastructure
Start the required databases:
```bash
docker-compose up -d
```
*Creates PostgreSQL and Redis containers.*

### 2. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configure API keys
alembic upgrade head  # Apply migrations
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

## Development Commands

### Backend
*Must be in `backend/` directory with virtual environment activated.*

- **Start API Server:**
  ```bash
  uvicorn app.main:app --reload
  ```
- **Start Background Worker:**
  ```bash
  arq app.workers.video_processor.WorkerSettings
  ```
- **Run Tests:**
  ```bash
  pytest
  ```
- **Lint & Type Check:**
  ```bash
  ruff check .
  mypy app/
  ```
- **Migrations:**
  ```bash
  alembic revision --autogenerate -m "message"
  alembic upgrade head
  ```

### Frontend
*Must be in `frontend/` directory.*

- **Start Dev Server:**
  ```bash
  npm run dev
  ```
- **Run Tests:**
  ```bash
  npm test
  ```
- **Lint & Format:**
  ```bash
  npm run lint
  npm run format
  ```
- **Regenerate API Client:**
  *Run this after changing backend schemas/endpoints.*
  ```bash
  npm run generate-api
  ```

## Key Architecture Patterns

- **Real-time Progress:**
  - CSV Imports trigger a background job (ARQ).
  - Worker updates job progress in Redis.
  - Backend broadcasts progress via WebSockets (`/api/ws/progress`).
  - Frontend (`useWebSocket`) updates the UI in real-time.

- **Custom Fields:**
  - stored as JSONB in PostgreSQL to allow flexible field definitions (Text, Rating, Boolean, Select) without schema changes.

- **API Client Generation:**
  - The frontend uses `orval` to generate TypeScript types and hooks from the backend OpenAPI spec.
  - **Do not modify** files in `frontend/src/api/generated/`.
  - Use `npm run generate-api` to update them.

## Conventions

- **Commits:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat:`, `fix:`, `chore:`).
- **Path Aliases:** Frontend uses `@/` to refer to `src/`.
- **Code Style:**
  - **Python:** Strict `mypy` and `ruff` configuration.
  - **TypeScript:** `biome` for linting and formatting.

---

## Projektübersicht (Aktualisiert)

Das Projekt "Fluffless" (ehemals "Smart YouTube Bookmarks") zielt darauf ab, eine KI-kuratierte YouTube-Bibliothek ohne Ablenkungen zu schaffen. Es ermöglicht Nutzern, Videos nach eigenen Qualitätskriterien zu filtern und durch KI analysieren zu lassen. Die Architektur basiert auf einem Python FastAPI Backend und einem React Frontend in einem Monorepo.

## Kernfunktionalitäten

- **KI-Kuratierung**: Automatische Analyse von Videos auf Basis benutzerdefinierter Kriterien (Phase 2).
- **Benutzerdefinierte Felder**: Flexible Metadatenstrukturen für Videos (Text, Bewertung, Boolean, Auswahl).
- **Authentifizierung**: Sichere Nutzerverwaltung mittels Clerk (Phase 1).
- **Entwickler-Experience**: Modernes Tooling mit Biome, Ruff und Docker Compose Watch.
- **Echtzeit-Fortschritt**: Live-Updates bei Importen und KI-Jobs via WebSockets.

## Tooling-Konfiguration

Die Entwicklungsumgebung wurde für maximale Effizienz und Code-Qualität optimiert:

- **Frontend**: 
  - **Biome + Ultracite**: Schnelleres Linting und Formatting (ersetzt ESLint/Prettier).
  - **Husky + lint-staged**: Pre-Commit Hooks zur Sicherstellung der Code-Qualität.
  - **Commitlint**: Erzwingt Konventionelle Commits.
  - **Orval**: Automatische Generierung von TypeScript-Typen und React Query Hooks aus der OpenAPI-Spezifikation.
- **Backend**: 
  - **Ruff**: Schnelles Python Linting und Formatting (ersetzt Black/Flake8).
  - **Pydantic**: Datenvalidierung.
- **Infrastruktur**: 
  - **Docker Compose Watch**: Hot-Reloading für containerisierte Entwicklung.
  - **GitHub Actions**: CI/CD für Tests, Linting und Deployment.
- **Release Management**: 
  - **Changesets** & **semantic-release**: Automatisiertes Versioning und Changelog-Erstellung.

## Nächste Schritte

1.  **Authentifizierung**: Clerk-Integration in Frontend und Backend vervollständigen, Hardcoded `user_id` entfernen.
2.  **Code Cleanup**: Fehlerbehandlung im API vereinheitlichen, ungenutzte Abhängigkeiten bereinigen.
3.  **KI-Integration**: Definition von KI-Tasks pro benutzerdefiniertem Feld und Implementierung der Analyse-Logik starten.
4.  **Infrastruktur**: CI/CD Pipeline finalisieren (GitHub Actions).

## Vision

**"AI-curated YouTube without the fluff."**

Die App soll Nutzern helfen, dem algorithmischen Rauschen zu entkommen. Statt endloser Feeds bietet Fluffless eine kuratierte Sammlung, bei der die KI als Gatekeeper fungiert – basierend auf den persönlichen Qualitätsstandards des Nutzers. Das Ziel ist bewusster Konsum hochwertiger Inhalte ("Gems") statt Zeitverschwendung ("Junk").