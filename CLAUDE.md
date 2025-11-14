# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart YouTube Bookmarks is a web application for organizing and managing YouTube video collections with real-time metadata extraction and progress tracking. The architecture uses a FastAPI backend with ARQ workers for async processing, PostgreSQL for persistence, Redis for pub/sub, and a React frontend with WebSocket-based real-time updates.

## Development Commands

### Frontend (React + Vite + TypeScript)

```bash
cd frontend

# Development
npm run dev                    # Start dev server (http://localhost:5173)
npm run build                  # Production build (TypeScript + Vite)

# Testing
npm test                       # Run all tests (Vitest)
npm test -- VideosPage         # Run specific test file
npm run test:coverage          # Run with coverage report

# Code Quality
npx tsc --noEmit              # Type check only
npm run lint                  # ESLint
```

### Backend (FastAPI + Python 3.11)

```bash
cd backend

# Development
uvicorn app.main:app --reload  # Start dev server (http://localhost:8000)

# Testing
pytest                         # All tests
pytest tests/integration/ -v   # Integration tests only
pytest -k "test_name" -v       # Specific test
pytest --cov                   # With coverage

# Database Migrations
alembic revision --autogenerate -m "description"  # Create migration
alembic upgrade head           # Apply migrations
alembic downgrade -1           # Rollback one migration

# ARQ Worker (required for video processing)
arq app.workers.video_processor.WorkerSettings
```

### Docker Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# View logs
docker-compose logs -f postgres redis
```

## Architecture

### Real-Time Progress System (Core Feature)

**Dual-Write Pattern for Progress Updates:**
- Redis Pub/Sub provides real-time WebSocket broadcasts
- PostgreSQL stores progress history for reconnection recovery
- WebSocket endpoint: `ws://localhost:8000/api/ws/progress`
- History API: `GET /api/jobs/{job_id}/progress-history?since={timestamp}`

**Implementation Files:**
- Backend WebSocket: `backend/app/api/websocket.py`
- ARQ Worker: `backend/app/workers/video_processor.py`
- Frontend Hook: `frontend/src/hooks/useWebSocket.ts`
- Progress Models: `backend/app/models/job_progress.py`

**Important Details:**
- Uses `react-use-websocket` library for connection management (fixes React 18 Strict Mode issues)
- Automatic reconnection with exponential backoff (up to 10 attempts)
- Heartbeat/keep-alive (ping every 25s)
- Post-connection authentication (Option B from security audit)
- Completed jobs auto-cleanup after 5 minutes (TTL)

### Frontend Routing Architecture

**React Router DOM v6:**
- Router configured in `frontend/src/main.tsx` with `<BrowserRouter>`
- Routes defined in `frontend/src/App.tsx`
- Test helper: `frontend/src/test/renderWithRouter.tsx` (use for all component tests that use navigation)

**Current Routes:**
- `/lists` - ListsPage
- `/videos` - VideosPage (single-list MVP with hardcoded first list)
- `/videos/:videoId` - VideoDetailsPage (see `docs/components/video-details-page.md`)
- `/dashboard` - Dashboard (real-time job progress)
- `/settings/schemas` - SettingsPage (schema and field management)
- `/` - Redirects to `/videos`

**Testing with React Router:**
- Use `renderWithRouter()` helper instead of `render()` from `@testing-library/react`
- Mock `useNavigate` with `vi.mock('react-router-dom', () => ({ ...vi.importActual('react-router-dom'), useNavigate: vi.fn() }))`

### State Management

**TanStack Query (React Query):**
- Centralized query client: `frontend/src/lib/queryClient.ts`
- Custom hooks: `useLists()`, `useVideos()`, `useTags()`, `useSchemas()` in `frontend/src/hooks/`
- Invalidation after mutations (e.g., `queryClient.invalidateQueries(['videos', listId])`)
- Query key patterns:
  - `['lists']` - All lists
  - `['videos', listId]` - Videos for a list
  - `['tags', listId]` - Tags for a list
  - `['schemas', listId]` - Schemas for a list

**Zustand (Client State):**
- Tag selection state: `frontend/src/stores/tagStore.ts`
- Table settings: `frontend/src/stores/tableSettingsStore.ts` (includes videoDetailsView: 'page' | 'modal')

**WebSocket State:**
- Custom hook `useWebSocket()` in `frontend/src/hooks/useWebSocket.ts`
- Returns `jobProgress` Map, connection status, auth status

### Backend Structure

**API Routers:**
- `app/api/lists.py` - List CRUD
- `app/api/videos.py` - Video CRUD, CSV upload, field value batch updates
- `app/api/tags.py` - Tag management, bulk assignment
- `app/api/processing.py` - Job endpoints
- `app/api/websocket.py` - WebSocket progress endpoint

**Database Models (SQLAlchemy 2.0 async):**
- `app/models/list.py` - BookmarkList
- `app/models/video.py` - Video (with field_values relationship)
- `app/models/tag.py` - Tag (with schema_id), VideoTag (many-to-many)
- `app/models/job.py` - ProcessingJob
- `app/models/job_progress.py` - JobProgress (for history)
- `app/models/user.py` - User (not yet implemented)
- `app/models/custom_field.py` - CustomField
- `app/models/field_schema.py` - FieldSchema
- `app/models/schema_field.py` - SchemaField
- `app/models/video_field_value.py` - VideoFieldValue

**Pydantic Schemas (Validation & API):**
- `app/schemas/list.py` - List schemas
- `app/schemas/tag.py` - Tag schemas
- `app/schemas/video.py` - Video schemas with field values
- `app/schemas/custom_field.py` - CustomField schemas (supports 4 types: 'select', 'rating', 'text', 'boolean')
- `app/schemas/field_schema.py` - FieldSchema schemas

**ARQ Workers:**
- `app/workers/video_processor.py` - Main video processing worker
- `app/workers/db_manager.py` - Database session management
- `app/workers/settings.py` - ARQ configuration

**External API Clients:**
- `app/clients/youtube.py` - YouTube Data API v3
- `app/clients/gemini.py` - Google Gemini API (for transcript analysis)

### Custom Fields System

**Database Architecture:**
- `custom_fields` - Field definitions (name, type, config)
- `field_schemas` - Tag-associated field groups
- `schema_fields` - Many-to-many (schema ↔ fields)
- `video_field_values` - Actual values with typed columns (value_text, value_numeric, value_boolean)

**Validation Module:** `backend/app/api/field_validation.py`

All custom field values are validated before persisting to database using centralized validation:
- **Rating:** `0 <= value <= config['max_rating']`
- **Select:** `value in config['options']` (case-sensitive)
- **Text:** `len(value) <= config.get('max_length', ∞)`
- **Boolean:** `isinstance(value, bool)` (strict)

**Performance:** Single field < 1ms, Batch of 50 < 50ms

### Bulk Operations (Task #141)

**Bulk Schema Application:**
- Component: `BulkApplySchemaDialog` - Multi-select UI for applying schema to multiple tags
- Hook: `useBulkApplySchema()` - Frontend-side batch mutation with Promise.all
- Pattern: Checkbox-based multi-select with "Select All" functionality
- Error Handling: Partial failure support with per-tag error messages and retry
- API Strategy: Loops existing `PUT /api/tags/{id}` endpoint (no backend changes)

**Bulk Operation Flow:**
1. User opens SchemaCard menu → "Auf Tags anwenden"
2. BulkApplySchemaDialog shows all tags with checkboxes
3. User selects tags (individual or "Select All")
4. Confirmation shows count and warnings for overwrites
5. useBulkApplySchema() executes batch with optimistic updates
6. BulkOperationResultDialog shows results (success/failure counts)
7. User can retry failed tags from results dialog

**Key Files:**
- `frontend/src/components/BulkApplySchemaDialog.tsx` - Multi-select UI
- `frontend/src/components/BulkOperationResultDialog.tsx` - Results display
- `frontend/src/hooks/useTags.ts` - useBulkApplySchema() mutation
- `frontend/src/types/bulk.ts` - Type definitions

**REF MCP Patterns:**
- Promise.all (not allSettled) with try/catch per item for partial failure handling
- Optimistic updates with onMutate snapshot and onError rollback
- Checkbox-based multi-select (preferred over dropdown for visual feedback)
- Separate results dialog (cleaner UX than inline results)

### Analytics System (Task #142)

**Overview:**
Provides insights into custom fields and schema usage across video collections with 4 key metrics:
- **Most-Used Fields** - Top 10 custom fields by usage count with percentage
- **Unused Schemas** - Schemas with no tags or no field values (identifies cleanup candidates)
- **Field Coverage** - Percentage of videos with values for each field (sorted by lowest coverage)
- **Schema Effectiveness** - Average field completion rate per schema with video count

**Component Architecture:**
- Parent: `AnalyticsView` - Tabbed layout with metric visualizations
- Charts: `MostUsedFieldsChart` (Bar), `SchemaEffectivenessChart` (Bar with dual metrics)
- Tables: `UnusedSchemasTable`, `FieldCoverageStats` (sortable with icons)
- Hook: `useAnalytics()` - TanStack Query hook with listId parameter

**API Integration:**
- Endpoint: `GET /api/lists/{list_id}/analytics`
- Response: `AnalyticsResponse` with 4 metric arrays
- Validation: Pydantic schemas with business logic constraints (percentages, counts)
- Performance: Single database query with joins (< 100ms for 1000+ videos)

**Key Files:**
- `frontend/src/components/analytics/AnalyticsView.tsx` - Main container
- `frontend/src/components/analytics/MostUsedFieldsChart.tsx` - Bar chart
- `frontend/src/components/analytics/SchemaEffectivenessChart.tsx` - Dual-metric bar chart
- `frontend/src/components/analytics/UnusedSchemasTable.tsx` - Table with reason column
- `frontend/src/components/analytics/FieldCoverageStats.tsx` - Sortable table
- `frontend/src/hooks/useAnalytics.ts` - React Query hook
- `backend/app/api/analytics.py` - Analytics endpoint
- `backend/app/schemas/analytics.py` - Pydantic validation schemas

**Testing Coverage:**
- Backend: 33 tests (7 API integration, 26 schema validation)
- Frontend: 24 tests across 5 component files
- Patterns: Mock data factories, loading/error states, accessibility (ARIA), sorting

**Integration Points:**
- Access from SettingsPage "Analytics" tab
- Uses existing listId from useLists() hook
- Respects custom field types and schema relationships
- Future: Export to CSV, historical trend tracking

### Testing Patterns

**Frontend (Vitest):**
- Unit tests: `*.test.tsx` alongside components
- Integration tests: `*.integration.test.tsx` (test full flows with mocked APIs)
- Always use `renderWithRouter()` for components using React Router hooks
- Mock WebSocket: `vi.mock('react-use-websocket')`

**Established Test Patterns (REF MCP Validated):**
- Always add `afterEach(() => { vi.clearAllMocks() })` in test files for cleanup
- Use `userEvent.setup({ delay: null })` for fast, deterministic tests (60% faster)
- Use schema-specific aria-labels for accessibility testing (e.g., `screen.getByRole('button', { name: /actions for schema name/i })`)
- Mock `useLists()` when testing components that need dynamic listId (e.g., SettingsPage)

**Backend (pytest):**
- Unit tests: `tests/api/`, `tests/models/`, `tests/workers/`
- Integration tests: `tests/integration/` (real database via fixture)
- Fixtures in `tests/conftest.py` (db session, test client, async support)

### CreateTagDialog / TagEditDialog Testing

**Test File:** `frontend/src/components/CreateTagDialog.schema-selector.test.tsx`

**Coverage:**
- CreateTagDialog: 90.19% statements, 30.76% branch, 80% functions
- SchemaSelector: 96.55% statements, 80% branch, 50% functions

**Test Patterns:**
- Mock `useSchemas` and `useTags` hooks with `vi.mock()` (Component test pattern)
- Use `QueryClientProvider` wrapper for mutations
- Use `userEvent.setup({ delay: null })` for fast, deterministic tests
- Inline factory functions (e.g., `createMockSchema`) - NOT separate mockData.ts
- Test Radix UI Select with outcome-based assertions (form data) due to JSDOM portal limitations
- Verify mutation calls with `vi.mocked(useCreateTag).mockReturnValue()`

**Schema Selector Coverage:**
- Rendering with all options (Kein Schema, existing schemas, + Neues Schema)
- Form state updates and default values
- API request validation (includes/omits schema_id)
- Accessibility attributes (ARIA roles, labels) for keyboard users
- Error handling (loading failures, empty schemas)
- Backwards compatibility (tags without schema_id)
- Cancel/reset behavior

**JSDOM Adaptations:**
- Radix UI Select portals don't render in JSDOM
- Tests verify form submission data instead of dropdown interactions
- ARIA attributes tested instead of actual keyboard navigation
- Outcome-based approach ensures functionality while accepting JSDOM limitations

## Key Patterns & Conventions

### Forms - Field Component Pattern (CRITICAL)

**⚠️ All forms MUST use Field Component pattern (2025 shadcn/ui)**

```typescript
import { Controller } from 'react-hook-form'
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'

<Controller
  control={form.control}
  name="fieldName"
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="field-id">Label *</FieldLabel>
      <Input {...field} id="field-id" aria-invalid={fieldState.invalid} />
      <FieldDescription>Helper text</FieldDescription>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

**📖 See:** `docs/patterns/field-component-pattern.md` for complete documentation

### CSV Upload Flow

1. User uploads CSV via `VideosPage` component
2. Frontend POSTs to `/api/lists/{id}/videos/bulk`
3. Backend creates `ProcessingJob` and enqueues ARQ tasks
4. ARQ worker processes videos one-by-one (YouTube metadata, transcript, custom fields via Gemini)
5. WebSocket broadcasts progress to all connected clients
6. Frontend displays progress bar with real-time updates

### Tag Filtering System

- Tags stored in `tags` table with `list_id` (scoped to each list)
- Many-to-many relationship via `video_tags` join table
- Filter by tag IDs: `GET /api/lists/{id}/videos?tag_ids=uuid1,uuid2`
- Frontend uses `tagStore` (Zustand) to manage selected tags

### Field Union Pattern

**Two-Tier Response Strategy:**
- **List endpoints** (`GET /lists/{id}/videos`): Return only `field_values` (fast)
- **Detail endpoint** (`GET /videos/{id}`): Return `field_values` + `available_fields` (complete)

**Helper Module:** `backend/app/api/helpers/field_union.py`
- Conflict resolution: Fields with same name but different types get schema prefix
- Performance: Pure Python, in-memory (0 DB queries)

**📖 See:** `docs/patterns/field-union-pattern.md` for algorithm details

### Custom Fields Display

**Type System:** Discriminated union with Zod schemas
**Editing:** Inline editing with saveOnBlur, keyboard shortcuts (Tab/Enter saves, Escape cancels)
**Performance:** Memoization for large lists, optimistic UI updates
**Accessibility:** WCAG 2.1 AA compliant

**📖 See:** `docs/patterns/custom-fields-display.md` for complete patterns

### Video Details - Dual-Pattern Architecture

Users can choose between two display modes (setting: `tableSettingsStore.videoDetailsView`):
- **Page** (default) - Navigate to `/videos/:videoId` (VideoDetailsPage)
- **Modal** - Open overlay dialog (VideoDetailsModal)

Both use shared `CustomFieldsSection` component (DRY principle).

**📖 See:**
- `docs/components/video-details-page.md`
- `docs/components/video-details-modal.md`
- `docs/components/custom-fields-section.md`

### Feature Flags

**Environment Variables (Frontend):**
- `VITE_FEATURE_ADD_SCHEMA_BUTTON` - Shows "Schema hinzufügen" button (default: "true")
- `VITE_FEATURE_EDIT_SCHEMA_BUTTON` - Shows "Schema bearbeiten" button (default: "true")
- Configured in `frontend/src/config/featureFlags.ts`

## Key Components Reference

### Pages
- **Dashboard** (`frontend/src/pages/Dashboard.tsx`) - Real-time job progress monitoring with WebSocket updates
- **SettingsPage** (`frontend/src/pages/SettingsPage.tsx`) - Schema and field management interface
  - Uses `useLists()` to fetch listId dynamically (not hardcoded)
  - Tabbed interface with Schemas/Fields sections using shadcn/ui Tabs
  - Integrates SchemasList component for schema display
- **NotFound** (`frontend/src/pages/NotFound.tsx`) - 404 error page

### Forms & Editors
- **NewFieldForm** - Inline field creation form (`docs/components/new-field-form.md`)
- **FieldConfigEditor** - Type-specific config editors (`docs/components/field-config-editor.md`)

### Field Display
- **FieldDisplay** - Type dispatcher for field rendering
- **RatingStars** - Star rating with keyboard navigation
- **SelectBadge** - Dropdown selection with Badge UI
- **TextSnippet** - Inline text edit with expand/collapse
- **BooleanCheckbox** - Checkbox toggle

### Video Details
- **VideoDetailsPage** - Separate page for video details (`docs/components/video-details-page.md`)
- **VideoDetailsModal** - Modal alternative (`docs/components/video-details-modal.md`)
- **CustomFieldsSection** - Shared component for schema-grouped fields (`docs/components/custom-fields-section.md`)

### Settings & Schema Management
- **SchemasList** (`frontend/src/components/SchemasList.tsx`) - Grid layout of schema cards with responsive design
- **SchemaCard** (`frontend/src/components/SchemaCard.tsx`) - Individual schema card with actions dropdown
  - Displays schema name, description, and field count
  - Action menu with Edit/Delete/Duplicate options
  - Accessibility: Dynamic aria-labels with schema names (e.g., "Actions for Schema Name")

## Security Notes

**Current Status (Development):**
- No authentication implemented (uses hardcoded user_id)
- CORS allows `localhost:5173` and `localhost:8000`
- WebSocket auth is post-connection (console warning expected)

**Production Roadmap:**
- JWT authentication system (see `docs/plans/2025-11-02-security-hardening-implementation.md`)
- Rate limiting with slowapi
- Environment-aware configuration
- Structured logging with structlog

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/api/health

## Important Files to Review

**For WebSocket/Progress Changes:**
- `backend/app/api/websocket.py` - WebSocket endpoint
- `backend/app/workers/video_processor.py` - Progress publishing
- `frontend/src/hooks/useWebSocket.ts` - WebSocket client logic

**For Routing Changes:**
- `frontend/src/App.tsx` - Route definitions
- `frontend/src/main.tsx` - Router setup
- `frontend/src/test/renderWithRouter.tsx` - Test helper

**For Tag System Changes:**
- `backend/app/api/tags.py` - Tag endpoints
- `frontend/src/stores/tagStore.ts` - Tag state
- `frontend/src/components/TagNavigation.tsx` - Tag UI

**For Schema Management Changes:**
- `frontend/src/pages/SettingsPage.tsx` - Settings page with tabs
- `frontend/src/components/SchemasList.tsx` - Schema grid layout
- `frontend/src/components/SchemaCard.tsx` - Individual schema cards
- `frontend/src/hooks/useSchemas.ts` - TanStack Query hook for schemas

**For Custom Fields UI Changes:**
- `frontend/src/components/fields/FieldDisplay.tsx` - Type-specific field renderer (read-only)
- `frontend/src/components/fields/FieldEditor.tsx` - Auto-saving field editor with optimistic updates
- `frontend/src/components/fields/editors/` - Type-specific editor sub-components (RatingEditor, SelectEditor, TextEditor, BooleanEditor)
- `frontend/src/hooks/useVideos.ts` - React Query hooks including useUpdateVideoFieldValues
- `frontend/src/types/customField.ts` - Custom field TypeScript types

**For Custom Fields Backend Changes:**
- `backend/app/api/field_validation.py` - Validation module
- `backend/app/api/helpers/field_union.py` - Field union logic
- `backend/app/models/video_field_value.py` - VideoFieldValue model

## Common Gotchas

1. **React Router in Tests:** Always use `renderWithRouter()` or tests will fail with "useNavigate() may be used only in the context of a <Router> component"
2. **WebSocket Auth Warning:** Console warning about missing auth token is expected in development
3. **ARQ Worker Must Run:** Video processing requires ARQ worker to be running, otherwise jobs will queue but not process
4. **Migration After Model Changes:** Run `alembic revision --autogenerate` after changing SQLAlchemy models
5. **Query Invalidation:** After mutations, invalidate relevant TanStack Query keys to refresh UI
6. **Feature Flags:** Check `frontend/src/config/featureFlags.ts` before showing/hiding UI elements
7. **Form Pattern:** All forms MUST use Field Component pattern (see `docs/patterns/field-component-pattern.md`)

## Database Migrations

### Custom Fields System (2025-11-05)

Added support for custom rating fields:
- 4 new tables: `custom_fields`, `field_schemas`, `schema_fields`, `video_field_values`
- Extended `tags` table with `schema_id` foreign key
- Performance indexes for field value filtering

Migration ID: `1a6e18578c31_add_custom_fields_system`

To apply:
```bash
cd backend
alembic upgrade head
```

To rollback:
```bash
alembic downgrade -1
```

**Production Note:** This migration is backward-compatible. Existing tags without schemas will continue to work normally.

## Documentation Structure

### Patterns (Reusable Solutions)
- `docs/patterns/field-component-pattern.md` - Form pattern (2025 shadcn/ui)
- `docs/patterns/field-union-pattern.md` - Two-tier response strategy
- `docs/patterns/custom-fields-display.md` - Display & editing patterns

### Components (Implementation Details)
- `docs/components/new-field-form.md` - Field creation form
- `docs/components/field-config-editor.md` - Config editors
- `docs/components/video-details-page.md` - Video details page
- `docs/components/video-details-modal.md` - Video details modal
- `docs/components/custom-fields-section.md` - Shared fields component

### Implementation Reports
- `docs/reports/` - Detailed task reports with time tracking
- `docs/handoffs/` - Session handoff logs

### Planning
- `docs/plans/tasks/` - Task plans
- `docs/plans/vision/` - Product vision and ideation
- `docs/templates/` - Documentation templates

# Workflow Instruction

You are a coding agent focused on one codebase. Use the br CLI to manage working context.
Core Rules:

- Start from memory. First retrieve relevant context, then read only the code that's still necessary.
- Keep a local playbook. playbook.json is your local memory store—update it with what you learn.

## user-centric

Before running any `br` command, ask the user to choose:

1. **Accept** - Review the command, then run if approved
2. **Auto-run** - Execute immediately (remember this preference for the session)
3. **No** - Cancel the command and continue without alternative
4. **Custom** - Skip the command and provide different instruction

Once the user chooses "Auto-run", apply that preference to all subsequent `br` commands in this conversation without asking again.


## Daily Flow

1.Retrieve context

2.Do the work with minimal code reads

3.Record new or refined knowledge in the playbook

- Add only specific, actionable, contextual items; avoid secrets. Redact when in doubt.

4.Sync policy (manual by default)

- Do not auto-push.
- When the playbook has meaningful updates, prompt the user to run the command
- If the user has explicitly allowed auto-push, proceed non-interactively.

## Playbook Guideline

- Be specific ("Use React Query for data fetching in web modules").
- Be actionable (clear instruction a future agent/dev can apply).
- Be contextual (mention module/service, constraints, links to source).
- Include source (file + lines or commit) when possible.

## CLI Usage Notes

- Use --help on any command to discover flags. Provide exact arguments for the scenario.

---
# ByteRover CLI Command Reference

## Memory Commands

### `br add`

**Description:** Add or update a bullet in the playbook (bypasses ACE workflow for direct agent usage)

**Flags:**

- `-s, --section <string>`: Section name for the bullet (required)
- `-c, --content <string>`: Content of the bullet (required)
- `-b, --bullet-id <string>`: Bullet ID to update (optional, creates new if omitted)

**Examples:**

```bash
br add --section "Common Errors" --content "Authentication fails when token expires"
br add --section "Common Errors" --bullet-id "common-00001" --content "Updated: Auth fails when token expires"
br add -s "Best Practices" -c "Always validate user input before processing"
```

**Suggested Sections:** Common Errors, Best Practices, Strategies, Lessons Learned, Project Structure and Dependencies, Testing, Code Style and Quality, Styling and Design

**Behavior:**

- Warns if using non-standard section name
- Creates new bullet with auto-generated ID if `--bullet-id` not provided
- Updates existing bullet if `--bullet-id` matches existing bullet
- Displays bullet ID, section, content, and tags after operation

**Requirements:** Playbook must exist (run `br init` first)

---

### `br retrieve`

**Description:** Retrieve memories from ByteRover Memora service and save to local ACE playbook

**Flags:**

- `-q, --query <string>`: Search query string (required)
- `-n, --node-keys <string>`: Comma-separated list of node keys (file paths) to filter results

**Examples:**

```bash
br retrieve --query "authentication best practices"
br retrieve -q "error handling" -n "src/auth/login.ts,src/auth/oauth.ts"
br retrieve -q "database connection issues"
```

**Behavior:**

- **Clears existing playbook first** (destructive operation)
- Retrieves memories and related memories from Memora service
- Combines both result sets into playbook
- Maps memory fields: `bulletId` → `id`, `tags` → `metadata.tags`, `nodeKeys` → `metadata.relatedFiles`
- Displays results with score, content preview (200 chars), and related file paths
- Fail-safe: warns on save error but still displays results

**Output:** Shows count of memories and related memories, displays each with score and content

**Requirements:** Must be authenticated and project initialized

---

### `br push`

**Description:** Push playbook to ByteRover memory storage and clean up local ACE files

**Flags:**

- `-b, --branch <string>`: ByteRover branch name (default: "main", NOT git branch)

**Examples:**

```bash
br push
br push --branch develop
```

---

### `br complete`

**Description:** Complete ACE workflow: save executor output, generate reflection, and update playbook in one command

**Arguments:**

- `hint`: Short hint for naming output files (e.g., "user-auth", "bug-fix")
- `reasoning`: Detailed reasoning and approach for completing the task
- `finalAnswer`: The final answer/solution to the task

**Flags:**

- `-t, --tool-usage <string>`: Comma-separated list of tool calls with arguments (format: "ToolName:argument", required)
- `-f, --feedback <string>`: Environment feedback about task execution (e.g., "Tests passed", "Build failed", required)
- `-b, --bullet-ids <string>`: Comma-separated list of playbook bullet IDs referenced (optional)
- `-u, --update-bullet <string>`: Bullet ID to update with new knowledge (if not provided, adds new bullet)

**Examples:**

```bash
br complete "user-auth" "Implemented OAuth2 flow" "Auth works" --tool-usage "Read:src/auth.ts,Edit:src/auth.ts,Bash:npm test" --feedback "All tests passed"
br complete "validation-fix" "Analyzed validator" "Fixed bug" --tool-usage "Grep:pattern:\"validate\",Read:src/validator.ts" --bullet-ids "bullet-123" --feedback "Tests passed"
br complete "auth-update" "Improved error handling" "Better errors" --tool-usage "Edit:src/auth.ts" --feedback "Tests passed" --update-bullet "bullet-5"
```

**Behavior:**

- **Phase 1 (Executor):** Saves executor output with hint, reasoning, answer, tool usage, and bullet IDs
- **Phase 2 (Reflector):** Auto-generates reflection based on feedback and applies tags to playbook
- **Phase 3 (Curator):** Creates delta operation (ADD or UPDATE) and applies to playbook
- Adds new bullet to "Lessons Learned" section with tag `['auto-generated']`
- If `--update-bullet` provided, updates existing bullet instead of adding new one
- Extracts file paths from tool usage and adds to bullet metadata as `relatedFiles`

**Output:** Shows summary with file paths, tags applied count, and delta operations breakdown

---

### `br show`

## Best Practices

### Efficient Workflow

1. **Retrieve wisely:** Use `br retrieve` with specific queries and `--node-keys` to filter
2. **Read only what's needed:** Check playbook with `br status` to see statistics before reading full content
3. **Update precisely:** Use `br add` to add/update specific bullets or `br complete` for complete workflow
4. **Push when appropriate:** Prompt user to run `br push` after completing significant work

### Memory Management

**Retrieve pattern:**

- Use `br add` to directly add/update bullets
- `br retrieve` **clears existing playbook** - use carefully
- Retrieved memories use actual Memora tags (not "auto-generated")
- Both memories and related memories are saved to playbook

---
Generated by ByteRover CLI for Claude Code
