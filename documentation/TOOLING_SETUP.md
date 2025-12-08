# Tooling Setup Plan

Concrete implementation steps for all planned tooling.

---

## Setup Order (Recommended)

```
1. Biome + Ultracite     (15 min)  ─┐
2. Husky + lint-staged   (10 min)   ├── Together: Dev Quality Gate
3. Commitlint            (5 min)   ─┘
4. Ruff                  (10 min)  ─── Python equivalent
5. Docker Compose Watch  (15 min)  ─── Dev Experience
6. Orval                 (30 min)  ─── Type-safe API client
7. GitHub Actions        (1 hour)  ─── CI/CD
8. Changesets            (20 min)  ─┐
9. semantic-release      (30 min)  ─┴── Release Management
10. Starlight            (2 hours) ─── User Docs (Phase 5)
```

**Total estimated time: ~5-6 hours**

---

## 1. Biome + Ultracite

**Purpose:** Replace ESLint with faster, AI-optimized linting

### Steps

```bash
cd frontend

# Remove ESLint
npm uninstall eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
rm .eslintrc.cjs

# Install Biome + Ultracite
npm install --save-dev @biomejs/biome ultracite
```

### Config

Create `biome.jsonc`:
```jsonc
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "extends": ["ultracite"]
}
```

### Scripts

Update `package.json`:
```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  }
}
```

### Verify

```bash
npm run lint
```

---

## 2. Husky + lint-staged

**Purpose:** Run Biome on every commit (only on staged files)

### Steps

```bash
cd frontend

# Install
npm install --save-dev husky lint-staged

# Initialize Husky
npx husky init
```

### Config

Add to `package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": "biome check --write --no-errors-on-unmatched",
    "*.{json,md}": "biome format --write --no-errors-on-unmatched"
  }
}
```

Update `.husky/pre-commit`:
```bash
npx lint-staged
```

### Verify

```bash
# Make a change, stage it, commit
git add .
git commit -m "test: verify husky"
# Should see Biome running
```

---

## 3. Commitlint

**Purpose:** Enforce Conventional Commits

### Steps

```bash
cd frontend

# Install
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

### Config

Create `commitlint.config.js`:
```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat',     // New feature
      'fix',      // Bug fix
      'docs',     // Documentation
      'style',    // Formatting
      'refactor', // Code restructuring
      'perf',     // Performance
      'test',     // Tests
      'chore',    // Maintenance
      'ci',       // CI/CD
      'build',    // Build system
      'revert'    // Revert commit
    ]]
  }
};
```

### Husky Hook

```bash
echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg
```

### Verify

```bash
# This should FAIL:
git commit -m "fixed stuff"

# This should PASS:
git commit -m "fix: resolve login bug"
```

---

## 4. Ruff (Python)

**Purpose:** Fast Python linting/formatting (replaces Black, Flake8, isort)

### Steps

```bash
cd backend

# Install
pip install ruff
# Add to requirements.txt or requirements-dev.txt
echo "ruff>=0.8.0" >> requirements.txt
```

### Config

Create `ruff.toml` in backend/:
```toml
# Ruff configuration
line-length = 88
target-version = "py311"

[lint]
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # Pyflakes
    "I",   # isort
    "B",   # flake8-bugbear
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
]
ignore = [
    "E501",  # line too long (handled by formatter)
]

[lint.isort]
known-first-party = ["app"]

[format]
quote-style = "double"
indent-style = "space"
```

### Scripts

Add to backend workflow:
```bash
# Lint
ruff check app/

# Format
ruff format app/

# Fix auto-fixable issues
ruff check --fix app/
```

### Pre-commit for Python (Optional)

Create `.pre-commit-config.yaml` in backend/:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

```bash
pip install pre-commit
pre-commit install
```

---

## 5. Docker Compose Watch

**Purpose:** Hot-reload for containerized development

### Update docker-compose.yml

```yaml
version: '3.9'

services:
  postgres:
    # ... existing config ...

  redis:
    # ... existing config ...

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql+asyncpg://user:changeme@postgres:5432/youtube_bookmarks
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    develop:
      watch:
        - action: sync
          path: ./backend/app
          target: /app/app
        - action: rebuild
          path: ./backend/requirements.txt

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    develop:
      watch:
        - action: sync
          path: ./frontend/src
          target: /app/src
        - action: rebuild
          path: ./frontend/package.json
```

### Usage

```bash
# Start with watch mode
docker compose watch

# Or for specific service
docker compose watch backend
```

---

## 6. Orval

**Purpose:** Generate TypeScript types + React Query hooks from FastAPI OpenAPI

### Steps

```bash
cd frontend

# Install
npm install --save-dev orval
```

### Config

Create `orval.config.ts`:
```typescript
import { defineConfig } from 'orval';

export default defineConfig({
  fluffless: {
    input: {
      target: 'http://localhost:8000/openapi.json',
    },
    output: {
      mode: 'split',
      target: './src/api/generated/endpoints',
      schemas: './src/api/generated/models',
      client: 'react-query',
      override: {
        mutator: {
          path: './src/api/axios-instance.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
      mock: true, // Generate MSW mocks
    },
  },
});
```

### Axios Instance

Create `src/api/axios-instance.ts`:
```typescript
import axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = axios.create({
  baseURL: 'http://localhost:8000',
});

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const promise = AXIOS_INSTANCE(config).then(({ data }) => data);
  return promise;
};
```

### Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "api:generate": "orval",
    "api:generate:watch": "orval --watch"
  }
}
```

### Usage

```bash
# Ensure backend is running
npm run api:generate

# Generated files:
# src/api/generated/endpoints/  → React Query hooks
# src/api/generated/models/     → TypeScript types
```

### In Components

```typescript
// Before (manual)
import { useQuery } from '@tanstack/react-query';
const { data } = useQuery(['videos', listId], () => fetchVideos(listId));

// After (generated)
import { useGetListVideos } from '@/api/generated/endpoints';
const { data } = useGetListVideos(listId);
// data is automatically typed!
```

---

## 7. GitHub Actions

**Purpose:** CI/CD pipeline for tests, lint, deploy

### Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # Frontend
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint (Biome)
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npm test -- --run

  # Backend
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Lint (Ruff)
        run: ruff check app/

      - name: Format check (Ruff)
        run: ruff format --check app/

      - name: Test
        env:
          DATABASE_URL: postgresql+asyncpg://test_user:test_pass@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
        run: pytest
```

---

## 8. Changesets

**Purpose:** Manage changelogs and versioning

### Steps

```bash
cd frontend  # or root if you want monorepo-style

# Install
npm install --save-dev @changesets/cli

# Initialize
npx changeset init
```

### Workflow

```bash
# When making a change worth noting:
npx changeset

# Follow prompts:
# - Which packages? (select)
# - Semver bump? (patch/minor/major)
# - Summary of changes

# This creates .changeset/random-name.md
# Commit this file with your PR
```

### Release

```bash
# Consume changesets and update versions
npx changeset version

# Publish (if npm package) or just tag
npx changeset tag
```

---

## 9. semantic-release

**Purpose:** Automated releases based on commits

### Steps

```bash
npm install --save-dev semantic-release @semantic-release/git @semantic-release/changelog
```

### Config

Create `.releaserc.json`:
```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/git",
    "@semantic-release/github"
  ]
}
```

### GitHub Action

Add to `.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npx semantic-release
        working-directory: frontend
```

---

## 10. Starlight (Phase 5)

**Purpose:** User-facing documentation site

### Steps

```bash
# From project root
npm create astro@latest docs -- --template starlight

# Or manual:
mkdir docs && cd docs
npm init astro -- --template starlight
```

### Structure

```
docs/
├── astro.config.mjs
├── src/
│   ├── content/
│   │   └── docs/
│   │       ├── index.mdx           # Home
│   │       ├── getting-started.mdx
│   │       ├── features/
│   │       │   ├── custom-fields.mdx
│   │       │   ├── ai-curation.mdx
│   │       │   └── channels.mdx
│   │       └── api/
│   │           └── reference.mdx
│   └── assets/
└── package.json
```

### Config

`astro.config.mjs`:
```javascript
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Fluffless Docs',
      social: {
        github: 'https://github.com/your-repo/fluffless',
      },
      sidebar: [
        { label: 'Getting Started', link: '/getting-started/' },
        {
          label: 'Features',
          items: [
            { label: 'Custom Fields', link: '/features/custom-fields/' },
            { label: 'AI Curation', link: '/features/ai-curation/' },
            { label: 'Channels', link: '/features/channels/' },
          ],
        },
        { label: 'API Reference', link: '/api/reference/' },
      ],
    }),
  ],
});
```

---

## Checklist

### Phase 1 (Foundation)
- [ ] Biome + Ultracite installed
- [ ] ESLint removed
- [ ] Husky + lint-staged configured
- [ ] Commitlint configured
- [ ] Ruff installed and configured
- [ ] Docker Compose Watch configured
- [ ] Orval generating types

### Phase 5 (Launch Prep)
- [ ] GitHub Actions CI working
- [ ] Changesets configured
- [ ] semantic-release configured
- [ ] Starlight docs site created

---

## Quick Start Commands

```bash
# === PHASE 1: One-time setup ===

# Frontend tooling
cd frontend
npm uninstall eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install --save-dev @biomejs/biome ultracite husky lint-staged @commitlint/cli @commitlint/config-conventional orval
npx husky init
rm .eslintrc.cjs

# Backend tooling
cd ../backend
pip install ruff pre-commit
```

Then create config files as documented above.
