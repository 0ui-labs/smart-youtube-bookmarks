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
- `/dashboard` - Dashboard (real-time job progress)
- `/` - Redirects to `/videos`

**Testing with React Router:**
- Use `renderWithRouter()` helper instead of `render()` from `@testing-library/react`
- Mock `useNavigate` with `vi.mock('react-router-dom', () => ({ ...vi.importActual('react-router-dom'), useNavigate: vi.fn() }))`

### State Management

**TanStack Query (React Query):**
- Centralized query client: `frontend/src/lib/queryClient.ts`
- Custom hooks: `useLists()`, `useVideos()`, `useTags()` in `frontend/src/hooks/`
- Invalidation after mutations (e.g., `queryClient.invalidateQueries(['videos', listId])`)

**Zustand (Client State):**
- Tag selection state: `frontend/src/stores/tagStore.ts`
- Manages selected tags for filtering across components

**WebSocket State:**
- Custom hook `useWebSocket()` in `frontend/src/hooks/useWebSocket.ts`
- Returns `jobProgress` Map, connection status, auth status

### Backend Structure

**API Routers:**
- `app/api/lists.py` - List CRUD
- `app/api/videos.py` - Video CRUD, CSV upload
- `app/api/tags.py` - Tag management, bulk assignment
- `app/api/processing.py` - Job endpoints
- `app/api/websocket.py` - WebSocket progress endpoint

**Database Models (SQLAlchemy 2.0 async):**
- `app/models/list.py` - BookmarkList
- `app/models/video.py` - Video (extended with field_values relationship)
- `app/models/tag.py` - Tag (extended with schema_id), VideoTag (many-to-many)
- `app/models/job.py` - ProcessingJob
- `app/models/job_progress.py` - JobProgress (for history)
- `app/models/user.py` - User (not yet implemented)
- `app/models/custom_field.py` - CustomField (Task #59)
- `app/models/field_schema.py` - FieldSchema (Task #60)
- `app/models/schema_field.py` - SchemaField (Task #61)
- `app/models/video_field_value.py` - VideoFieldValue (Task #62)

**Pydantic Schemas (Validation & API):**
- `app/schemas/list.py` - ListCreate, ListUpdate, ListResponse
- `app/schemas/tag.py` - TagBase, TagCreate, TagUpdate, TagResponse
- `app/schemas/custom_field.py` - CustomField schemas (Task #64):
  - CustomFieldBase: Shared validation logic with field_type/config validation
  - CustomFieldCreate: Create new field (inherits Base)
  - CustomFieldUpdate: Partial update support (all fields optional)
  - CustomFieldResponse: API responses with ORM conversion
  - DuplicateCheckRequest/Response: Case-insensitive name checking
  - Supports 4 field types: 'select', 'rating', 'text', 'boolean'
  - DRY principle: Shared `_validate_config_for_type()` helper function
- `app/schemas/field_schema.py` - FieldSchema schemas (Task #65):
  - SchemaFieldItem: Field association for creation (field_id, display_order, show_on_card)
  - FieldSchemaCreate: Create schema with fields (3 validators: show_on_card_limit max 3, no duplicate display_order, no duplicate field_ids)
  - FieldSchemaUpdate: Partial updates (name/description only, not field associations)
  - SchemaFieldResponse: Nested field data with full CustomFieldResponse (eliminates N+1 queries)
  - FieldSchemaResponse: Complete schema with nested schema_fields list
  - REF MCP improvements: Better error messages with truncated UUIDs, duplicate validation
  - 21 unit tests with 100% code coverage

**ARQ Workers:**
- `app/workers/video_processor.py` - Main video processing worker
- `app/workers/db_manager.py` - Database session management
- `app/workers/settings.py` - ARQ configuration

**External API Clients:**
- `app/clients/youtube.py` - YouTube Data API v3
- `app/clients/gemini.py` - Google Gemini API (for transcript analysis)

### Custom Fields System (Tasks #59-#62)

**VideoFieldValue Model (Task #62):**
- Stores actual field values for videos with typed columns
- Inherits from BaseModel (has auto-generated UUID id and updated_at)
- IMPORTANT: Migration omits created_at column (only id and updated_at)
- Typed columns: value_text (TEXT), value_numeric (NUMERIC), value_boolean (BOOLEAN)
- UNIQUE constraint: (video_id, field_id) - one value per field per video
- Foreign keys: video_id → videos(id) CASCADE, field_id → custom_fields(id) CASCADE
- Performance indexes: (field_id, value_numeric), (field_id, value_text) for filtering
- Relationships: video (Video), field (CustomField) with passive_deletes=True

**Why Typed Columns?**
- Performance: Enables efficient filtering via composite indexes
- Example: "Show videos where Rating >= 4" uses idx_video_field_values_field_numeric
- Alternative (JSONB) would require slower JSON path queries

### Custom Field Value Validation (Task #73)

**Validation Module:** `backend/app/api/field_validation.py`

All custom field values are validated before persisting to database using a centralized validation module (extracted from Task #72 inline validation).

**Validation Rules:**

| Field Type | Validation Rules | Example |
|------------|------------------|---------|
| **rating** | `0 <= value <= config['max_rating']` (default: 5) | If max_rating=5, valid: 0-5 |
| **select** | `value in config['options']` (case-sensitive) | If options=['bad','good','great'], valid: 'good' |
| **text** | `len(value) <= config.get('max_length', ∞)` | If max_length=500, valid: strings ≤ 500 chars |
| **boolean** | `isinstance(value, bool)` (strict, not truthy) | Valid: True, False (not 1, 0, 'true') |

**Usage Pattern:**

```python
from app.api.field_validation import validate_field_value, FieldValidationError

try:
    validate_field_value(
        value=5,
        field_type='rating',
        config={'max_rating': 5},
        field_name='Overall Rating'  # Optional, for context
    )
except FieldValidationError as e:
    # Handle validation error
    return {"error": str(e)}
```

**Performance:**
- Single field: < 1ms (no database queries, pure in-memory)
- Batch of 50: < 50ms (verified with benchmark tests)
- All validation is pure function (no side effects)

**Testing:**
- 23 unit tests covering all validation paths (100% coverage)
- 2 performance tests verifying speed targets
- Tests: `backend/tests/api/test_field_validation.py`

**Integration:**
- Task #72: Batch update endpoint uses validation module
- Future CRUD endpoints: Should reuse same validation

**Implementation Note:**
Extracted from Task #72 inline validation (videos.py:1294-1360) in Task #73. Original inline logic was production-tested with 11/11 passing tests. Refactoring maintained 100% backward compatibility.

### Testing Patterns

**Frontend (Vitest):**
- Unit tests: `*.test.tsx` alongside components
- Integration tests: `*.integration.test.tsx` (test full flows with mocked APIs)
- Always use `renderWithRouter()` for components using React Router hooks
- Mock WebSocket: `vi.mock('react-use-websocket')`

**Backend (pytest):**
- Unit tests: `tests/api/`, `tests/models/`, `tests/workers/`
- Integration tests: `tests/integration/` (real database via fixture)
- Fixtures in `tests/conftest.py` (db session, test client, async support)

## Known Patterns & Conventions

### CSV Upload Flow

1. User uploads CSV via `VideosPage` component
2. Frontend POSTs to `/api/lists/{id}/videos/bulk`
3. Backend creates `ProcessingJob` and enqueues ARQ tasks
4. ARQ worker processes videos one-by-one:
   - Fetches YouTube metadata
   - Gets transcript (if available)
   - Extracts custom fields via Gemini
   - Updates database
   - Publishes progress to Redis
5. WebSocket broadcasts progress to all connected clients
6. Frontend displays progress bar with real-time updates

### Tag Filtering System

- Tags stored in `tags` table with `list_id` (scoped to each list)
- Many-to-many relationship via `video_tags` join table
- Filter by tag IDs: `GET /api/lists/{id}/videos?tag_ids=uuid1,uuid2`
- Frontend uses `tagStore` (Zustand) to manage selected tags
- `TagNavigation` component displays all tags with selection state

### Field Union Pattern (Option D - Intelligente Lösung)

**Two-Tier Response Strategy:**
- **List endpoints** (`GET /lists/{id}/videos`): Return only `field_values` (fast, ~50KB for 100 videos)
- **Detail endpoint** (`GET /videos/{id}`): Return `field_values` + `available_fields` (complete, ~5KB for 1 video)

**Use Cases:**
- **List/Grid View:** Shows only filled fields on cards (user configures which fields to display)
- **Detail Modal:** Shows ALL available fields for editing (filled + empty)

**Implementation:**

1. **Helper Module:** `backend/app/api/helpers/field_union.py`
   - `get_available_fields_for_video()` - Single video field union with conflict resolution
   - `get_available_fields_for_videos()` - Batch version for multiple videos
   - `compute_field_union_with_conflicts()` - Two-pass algorithm for name conflicts

2. **Conflict Resolution Algorithm (Two-Pass):**
   ```
   Pass 1: Detect conflicts
   - Group fields by name (case-insensitive)
   - If same name + different type → mark as conflict

   Pass 2: Apply schema prefix
   - Conflicting fields get prefix: "Schema Name: Field Name"
   - Non-conflicting fields keep original name
   ```

3. **Example Scenario:**
   ```
   Video has tags: ["Makeup Tutorial", "Product Review"]

   Schemas:
   - "Makeup Tutorial": [Rating (rating), Quality (select)]
   - "Product Review": [Rating (select), Price (number)]

   Result after conflict resolution:
   - "Makeup Tutorial: Rating" (type: rating)
   - "Product Review: Rating" (type: select)
   - "Quality" (type: select, no conflict)
   - "Price" (type: number, no conflict)
   ```

4. **API Responses:**

   **List Endpoint** (fast):
   ```json
   {
     "id": "...",
     "title": "Video Title",
     "field_values": [
       {"field_name": "Rating", "value": 4, ...}
     ],
     "available_fields": null
   }
   ```

   **Detail Endpoint** (complete):
   ```json
   {
     "id": "...",
     "title": "Video Title",
     "field_values": [
       {"field_name": "Rating", "value": 4, ...},
       {"field_name": "Quality", "value": null, ...}
     ],
     "available_fields": [
       {"field_name": "Rating", "field_type": "rating", "config": {...}},
       {"field_name": "Quality", "field_type": "select", "config": {...}}
     ]
   }
   ```

**Performance:**
- List endpoint: 2-3 DB queries for 100 videos (batch loading with selectinload)
- Detail endpoint: 2-3 DB queries for 1 video (<100ms target)
- Conflict resolution: Pure Python, in-memory (0 DB queries)

**Testing:**
- Unit tests: `backend/tests/api/helpers/test_field_union.py` (9 passing, 7 skipped due to async greenlet issues)
- Integration tests: Task #71 tests verify batch loading works correctly

**Related Tasks:**
- Task #71: Video GET endpoint with field_values (batch loading foundation)
- Task #74: Multi-tag field union query with conflict resolution (Option D implementation)

### Feature Flag Pattern

**Environment Variables (Frontend):**
- `VITE_FEATURE_ADD_SCHEMA_BUTTON` - Shows "Schema hinzufügen" button (default: "true")
- `VITE_FEATURE_EDIT_SCHEMA_BUTTON` - Shows "Schema bearbeiten" button (default: "true")
- Configured in `frontend/src/config/featureFlags.ts`

### Custom Fields Display Pattern (Task #89)

**Discriminated Union Type Pattern:**
```typescript
// Zod schemas define runtime validation + TypeScript types
export const RatingFieldValueSchema = z.object({
  field_id: z.string().uuid(),
  field: z.object({
    name: z.string(),
    field_type: z.literal('rating'),
    config: z.object({ max_rating: z.number() })
  }),
  value: z.number().nullable(),
  schema_name: z.string(),
  show_on_card: z.boolean().default(false)
})

export const VideoFieldValueSchema = z.union([
  RatingFieldValueSchema,
  SelectFieldValueSchema,
  BooleanFieldValueSchema,
  TextFieldValueSchema
])

export type VideoFieldValue = z.infer<typeof VideoFieldValueSchema>

// Type guards for discriminated unions
export function isRatingFieldValue(fv: VideoFieldValue): fv is RatingFieldValue {
  return fv.field.field_type === 'rating'
}
```

**Optimistic UI Updates Pattern:**
```typescript
export const useUpdateFieldValue = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoId, fieldId, value }) => {
      const { data } = await api.put(`/api/videos/${videoId}/fields`, {
        updates: [{ field_id: fieldId, value }]
      })
      return data
    },
    onMutate: async ({ videoId, fieldId, value }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: videoKeys.all })

      // Snapshot current state
      const previousData = queryClient.getQueriesData({ queryKey: videoKeys.all })

      // Optimistically update UI
      queryClient.setQueriesData({ queryKey: videoKeys.all }, (old) => {
        // Update logic...
      })

      return { previousData }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    }
  })
}
```

**Inline Editing Pattern:**
- **saveOnBlur**: Save changes when focus leaves input (default: true)
- **Keyboard shortcuts**: Tab/Enter saves, Escape cancels
- **Event isolation**: `stopPropagation()` prevents parent click handlers
- Components: `RatingStars.tsx`, `SelectBadge.tsx`, `TextSnippet.tsx`, `BooleanCheckbox.tsx`

**Performance Optimization for Large Lists:**
```typescript
// Memoize derived data to prevent recalculations on every render
const cardFields = useMemo(
  () => fieldValues.filter(fv => fv.show_on_card).slice(0, 3),
  [fieldValues]
)

const hasMoreFields = useMemo(
  () => fieldValues.filter(fv => fv.show_on_card).length > 3,
  [fieldValues]
)

// Memoize callbacks to prevent child re-renders
const handleFieldChange = useCallback(
  (fieldId: string, value: string | number | boolean) => {
    updateField.mutate({ listId, videoId, fieldId, value })
  },
  [updateField, listId, videoId]
)

// Memo entire component if it receives stable props
export const CustomFieldsPreview = React.memo(({ ... }) => { ... })
```

**Accessibility Pattern (WCAG 2.1 AA):**
```typescript
// Semantic ARIA labels with context
<div
  role="group"
  aria-label={`${fieldName}: ${value ?? 0} out of ${maxRating}`}
>
  <button
    aria-label={`Rate ${index + 1} out of ${maxRating}`}
    onKeyDown={(e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()  // Prevent VideoCard navigation
        onChange?.(index + 2)
      }
    }}
  />
</div>

// More badge with count
<Badge aria-label={`View ${moreFieldsCount} more fields`}>
  +{moreFieldsCount} more
</Badge>
```

**Implementation Files:**
- Types: `frontend/src/types/video.ts` (VideoFieldValue schemas)
- Hook: `frontend/src/hooks/useVideoFieldValues.ts` (optimistic updates)
- Components: `frontend/src/components/fields/` (RatingStars, SelectBadge, TextSnippet, BooleanCheckbox, FieldDisplay, CustomFieldsPreview)
- Integration: `frontend/src/components/VideoCard.tsx` (lines 167-175)
- Tests: 41 tests (16 unit + 13 hook + 12 integration)

**Performance Targets:**
- Grid with 100 VideoCards: Smooth 60fps scrolling with memoization
- Optimistic update latency: <16ms (single frame)
- API call: Backend validation + DB update <100ms

**Related Tasks:**
- Task #78: CustomField TypeScript types
- Task #79: useCustomFields hook (CRUD operations template)
- Task #90: VideoDetailsModal (will use same field display components)

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

## Common Gotchas

1. **React Router in Tests:** Always use `renderWithRouter()` or tests will fail with "useNavigate() may be used only in the context of a <Router> component"
2. **WebSocket Auth Warning:** Console warning about missing auth token is expected in development
3. **ARQ Worker Must Run:** Video processing requires ARQ worker to be running, otherwise jobs will queue but not process
4. **Migration After Model Changes:** Run `alembic revision --autogenerate` after changing SQLAlchemy models
5. **Query Invalidation:** After mutations, invalidate relevant TanStack Query keys to refresh UI
6. **Feature Flags:** Check `frontend/src/config/featureFlags.ts` before showing/hiding UI elements

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

**Production Note:** This migration is backward-compatible. Existing tags without schemas will continue to work normally. The migration adds nullable foreign key constraints and creates new tables without modifying existing data.

## Documentation

- Task plans: `docs/plans/tasks/`
- Handoff logs: `docs/handoffs/`
- Implementation reports: `docs/reports/`
- Templates: `docs/templates/`

# Workflow Instruction

You are a coding agent focused on one codebase. Use the br CLI to manage working context.
Core Rules:

- Start from memory. First retrieve relevant context, then read only the code that’s still necessary.
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

- Be specific (“Use React Query for data fetching in web modules”).
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
