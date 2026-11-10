# Smart YouTube Bookmarks

React-/FastAPI-Anwendung für private YouTube-Sammlungen mit CSV-Import/-Export,
Tags, Feldschemata, eigenen Feldwerten und Hintergrundverarbeitung. Architektur:
PostgreSQL 16, Redis 7, ARQ, SQLAlchemy, TanStack Query und Clerk.

Der aktuelle lokale Nachweis und verbleibende externe Abnahmen stehen im
[Stabilisierungsbericht](documentation/reports/codebase-stabilisierung-abnahme.md).
Eine öffentliche Veröffentlichung ist nicht Bestandteil der Stabilisierung.

## Reproduzierbare Einrichtung

Voraussetzungen: Node **22.22.3**, npm 10, Python **3.11**, Docker Compose v2.
Verifiziert mit Python 3.11.15 unter macOS/arm64. Das **Root-`package-lock.json`**
ist maßgeblich; `frontend` ist ein npm-Workspace.

```bash
# Projektwurzel
npm ci
python3.11 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
docker compose -p syb-stabilization-test -f docker-compose.test.yml up -d --wait
```

Die Testservices binden ausschließlich localhost: PostgreSQL **55438**, Redis
**56388**. PostgreSQL verwendet flüchtigen Speicher; keine Anwendungsvolumes.
Sie enthalten ausschließlich synthetische Testdaten.

## Lokale Anwendung

Eine bereits vorhandene Clerk-Anwendung konfigurieren; siehe
[Auth-Einrichtung](documentation/AUTH_SETUP.md). Ohne gültige Konfiguration bleibt
die Oberfläche gesperrt. Fachliche HTTP-Routen benötigen eine verifizierte Sitzung.
Es gibt keinen Entwicklungs- oder Standardbenutzer-Bypass.

Für eine neue lokale Anwendung zuerst eine **neue, leere** Datenbank erstellen.
Der folgende Migrationsschritt darf nur nach erfolgreicher Neuanlage erfolgen.
Keine Migration auf bestehenden Benutzerdaten ausführen:

```bash
docker compose -p syb-stabilization-test -f docker-compose.test.yml \
  exec -T postgres createdb -U test bookmarks_local_dev
# backend/.env: DATABASE_URL auf die gerade neu angelegte Datenbank setzen.
```

Beispiel für `backend/.env` (echte Providerkonfiguration privat ergänzen):

```dotenv
ENV=development
DATABASE_URL=postgresql+asyncpg://test:test@localhost:55438/bookmarks_local_dev
REDIS_URL=redis://localhost:56388/0
CLERK_ISSUER=
CLERK_AUTHORIZED_PARTIES=http://localhost:5173
YOUTUBE_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
PUBSUB_SIGNING_SECRET=
```

`frontend/.env.local` benötigt `VITE_CLERK_PUBLISHABLE_KEY` aus derselben Clerk-
Anwendung. Für die JWT-Prüfung über öffentliches JWKS ist kein Clerk Secret Key nötig.
`CLERK_AUDIENCE` nur setzen, wenn die vorhandene Session-Konfiguration ihn benötigt.

```bash
# Terminal 1, backend/; nur die neu angelegte lokale Datenbank
.venv/bin/alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# Terminal 2, backend/; gleiche DATABASE_URL und REDIS_URL
.venv/bin/arq app.workers.settings.WorkerSettings
# Terminal 3, Projektwurzel
npm run dev --workspace frontend
```

Frontend: `http://localhost:5173`; REST und WebSocket laufen über Vites `/api`-
Proxy. `VITE_WS_URL` ist optional; sonst folgt der Socket dem aktuellen Origin
und `ws`/`wss`. Tokens bleiben im Speicher; WebSockets verwenden Einmal-Tickets.

YouTube-Metadaten benötigen den vorhandenen YouTube-Key. Gemini und Groq sind
je nach genutztem KI-/Transkriptpfad erforderlich. Ohne Providerkonfiguration
sind deren reale Ergebnisse nicht nachgewiesen. WebSub benötigt eine vorhandene,
vom Hub erreichbare Callback-Umgebung und Signaturkonfiguration; lokales Starten
richtet weder Tunnel noch öffentliche Ressourcen ein.

## Verpflichtende lokale Prüfungen

```bash
# frontend/
npm run build
npm test -- --run
npm run lint

# backend/: explizite, separate Testziele für jede Shell setzen
export TEST_DATABASE_URL=postgresql+asyncpg://test:test@localhost:55438/bookmarks_test
export TEST_REDIS_URL=redis://localhost:56388/3
export REDIS_URL=redis://localhost:56388/0
.venv/bin/python -m pytest -q --tb=short
.venv/bin/ruff check app tests
.venv/bin/mypy app
.venv/bin/python scripts/check_api_client.py
```

Die Fixtures verweigern fehlende/unsichere Test-URLs vor `create_all`, `drop_all`
und `TRUNCATE`. Der Datenbankname muss auf `_test` enden und sich von der
Anwendungsdatenbank unterscheiden. Eine Suite darf pro Testdatenbank gleichzeitig
laufen; der PostgreSQL-Suite-Lock verhindert konkurrierendes Löschen.

Alembic zusätzlich auf einer **neu angelegten, leeren** Testdatenbank prüfen:

```bash
# Projektwurzel; neuen Namen verwenden, bestehende DB niemals zurücksetzen
docker compose -p syb-stabilization-test -f docker-compose.test.yml \
  exec -T postgres createdb -U test bookmarks_migration_test
# backend/
TEST_MIGRATION_DATABASE_URL=postgresql+asyncpg://test:test@localhost:55438/bookmarks_migration_test \
  .venv/bin/python scripts/check_migrations.py
```

Das Skript prüft Erstinstallation und Upgrade eines synthetischen Altbestands.
Ein nichtleeres Ziel wird abgewiesen. `create_all` allein ist kein Migrationsnachweis.
Die CI erzwingt Build, Suites, Linter, strenge Typprüfung, Migration und API-Drift.
Ein lokaler Erfolg ist kein bereits ausgeführter gehosteter CI-Lauf.

## API, Pagination und Hintergrundarbeit

OpenAPI: `http://localhost:8000/docs`. Neue Listenabrufe:

- `GET /api/lists/{id}/videos/page`: `{items,total,offset,limit}`.
- `POST /api/lists/{id}/videos/filter/page`: derselbe Seitenvertrag mit Feld-/Tag-/Kanalfiltern.
- Standard 50, maximal 100 Einträge pro Serverantwort; stabile Sortierung mit ID als Tie-Breaker.
- Die Oberfläche lädt beim Scrollen weitere Videos nach und erhält die bisherigen Karten/Zeilen. Es gibt keine Seitenknöpfe; Filterwechsel starten eine neue Auswahl. Tastaturbedienung und Wiederholung nach Ladefehlern bleiben möglich.
- Alte JSON-Listenrouten sind auf 100 begrenzt. Importstatus und Duplikatsuche verwenden Batches bis 100 IDs.
- CSV-Export liefert alle passenden Treffer, unabhängig von den bereits geladenen Videos.

Videoänderungen invalidieren abhängige Listen, Details und Statistiken. Ein
angenommener Import speichert fachliche Daten und Jobabsicht atomar. Dispatcher,
Retry, Diagnose, Aufbewahrung und Readiness:
[Queue-Betrieb](documentation/QUEUE_OPERATIONS.md).

`GET /api/health` meldet Prozess-Liveness. `GET /api/ready` liefert nur dann 200,
wenn Datenbank/Outbox, Redis und der Dispatcher-Heartbeat verfügbar sind.

API-Client nach Backendänderungen reproduzierbar neu erzeugen:

```bash
# backend/, mit obiger Testkonfiguration
.venv/bin/python scripts/check_api_client.py --write
.venv/bin/python scripts/check_api_client.py  # schlägt bei Drift fehl
```

Generierte Dateien nie manuell ändern. Für laufendes Entwicklungsbackend bleibt
`npm run generate-api --workspace frontend` verfügbar.

Weitere Informationen: [Architektur](documentation/ARCHITECTURE.md),
[Tooling](documentation/TOOLING_SETUP.md),
[Messwerte](documentation/reports/pagination/README.md),
[Zugriffsinventar](documentation/security/routeninventar.md).
