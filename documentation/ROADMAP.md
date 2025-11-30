# Fluffless Roadmap

**Goal:** Launch-ready in ~8 weeks

**Vision:** AI-curated YouTube without the fluff. User-defined quality criteria, AI-powered analysis, only gems – no junk.

---

## Phase 1: Foundation (Week 1-2)

### Authentication
- [ ] Clerk integration (Frontend)
- [ ] Clerk integration (Backend/FastAPI)
- [ ] Replace hardcoded `user_id` with real auth
- [ ] Remove `[TESTING ONLY]` query parameters
- [ ] User onboarding flow

### Code Cleanup
- [ ] Error Boundaries (Frontend)
- [ ] Consistent error handling across API
- [x] Remove unused dependencies (dnd-kit)

### Developer Tooling (Frontend)
- [x] Biome + Ultracite (replace ESLint, AI-optimized linting)
- [x] Husky + lint-staged (pre-commit hooks for Biome)
- [x] Commitlint (enforce Conventional Commits)
- [x] Orval setup (generate TypeScript types + React Query hooks from OpenAPI)

### Developer Tooling (Backend)
- [x] Ruff (Python linter/formatter, Rust-based, replaces Black + Flake8)

### Developer Tooling (Infrastructure)
- [ ] Docker Compose Watch (hot-reload for containerized dev)

---

## Phase 2: AI Enrichments (Week 3-5)

### Core AI Features
- [ ] AI task definition per custom field
- [ ] Trigger AI analysis for single video
- [ ] Batch AI analysis for multiple videos
- [ ] AI-generated vs. manual value distinction (UI)
- [ ] Progress tracking for AI jobs

### AI Providers
- [ ] Gemini integration refinement
- [ ] Groq Whisper optimization
- [ ] Cost tracking per user
- [ ] Rate limiting per user

---

## Phase 3: UX/UI Polish (Week 5-6)

### User Experience
- [ ] _TODO: Add specific UX improvements_
- [ ] _TODO: Add specific UI improvements_
- [ ] _TODO: Add design optimizations_

### Small Features
- [ ] _TODO: List small features_

---

## Phase 4: Security & Performance (Week 7)

### Security Hardening
- [ ] Rate limiting (API-wide)
- [ ] Input validation audit
- [ ] CORS configuration for production
- [ ] Secrets management
- [ ] SQL injection review (ORM should handle, but verify)
- [ ] XSS prevention audit

### Performance
- [ ] Database query optimization
- [ ] Frontend bundle size audit
- [ ] Lazy loading for heavy components
- [ ] Image/thumbnail optimization
- [ ] API response caching strategy

---

## Phase 5: Launch Prep (Week 8)

### Deployment
- [ ] Production environment setup
- [ ] GitHub Actions CI/CD pipeline (tests, lint, deploy)
- [ ] Monitoring & logging
- [ ] Backup strategy

### Release Management
- [ ] Changesets (changelog + version management)
- [ ] semantic-release (automated releases from commits)

### Documentation
- [x] README.md (updated)
- [x] ARCHITECTURE.md (created)
- [ ] User documentation site (Starlight)
- [ ] Getting Started guide
- [ ] Feature documentation (Custom Fields, AI Kuratierung)
- [ ] FAQ
- [ ] API documentation review

### Final Testing
- [ ] End-to-end testing
- [ ] Cross-browser testing
- [ ] Mobile responsiveness check
- [ ] Load testing

---

## Backlog (Unscheduled)

### Post-Launch Tooling
- [ ] Sentry (error tracking, Frontend + Backend)
- [ ] Renovate (automated dependency updates as PRs)
- [ ] Posthog/Plausible (product analytics, privacy-friendly)

### Ideas & Future Features
- [ ] **AI Bug Tracker** – Chat-basiert, Duplikat-Erkennung, klare Issue-Generierung
- [ ] Second Brain integration
- [ ] Video collections sharing
- [ ] Public/private lists
- [ ] Browser extension for quick save
- [ ] Mobile app
- [ ] Collaborative curation

### Technical Debt
- [ ] _Add items as discovered_

---

## Notes

_Use this section to capture decisions, blockers, or context._

- **2024-11-29:** Roadmap created. Starting with Clerk Auth.
- **2025-11-30:** Developer Tooling komplett abgeschlossen:
  - Frontend: Biome 2.x + Ultracite, Husky + lint-staged, Commitlint, Orval
  - Backend: Ruff 0.14+ mit FastAPI-spezifischer Konfiguration
  - Pre-commit hooks für Frontend (Biome) und Backend (Ruff) aktiv
- **App name:** Fluffless (currently "Smart YouTube Bookmarks")

### Tooling Decisions
| Tool | Decision | Reason |
|------|----------|--------|
| **Biome + Ultracite** | ✅ Yes | Faster than ESLint, AI-optimized, zero-config |
| **Husky + lint-staged** | ✅ Yes | Pre-commit hooks, ensures code quality |
| **Commitlint** | ✅ Yes | Enforce Conventional Commits for clean history |
| **Ruff** | ✅ Yes | Biome-equivalent for Python, Rust-based, fast |
| **Orval** | ✅ Yes | Type-safe API client from OpenAPI, fits Python + React stack |
| **Docker Compose Watch** | ✅ Yes | Hot-reload for containerized dev |
| **GitHub Actions** | ✅ Yes | CI/CD pipeline for tests, lint, deploy |
| **Changesets** | ✅ Yes | Changelog + version management |
| **semantic-release** | ✅ Yes | Automated releases from commits |
| **Starlight** | ✅ Yes | User-facing docs site, Astro-based, fast & simple |
| **Renovate** | ✅ Post-launch | Automated dependency updates |
| **Sentry** | ✅ Post-launch | Error tracking when app is live |
| **GitHub Issues** | ✅ Yes | Bug tracking (free, already have it) |
| **GitHub Discussions** | ✅ Yes | Feature voting via reactions (free) |
| **Turborepo** | ❌ Not now | Overkill for current setup (not a JS monorepo) |
| **tRPC / oRPC** | ❌ No | Requires TypeScript backend, we have Python |
| **Fumadocs** | ❌ No | Good but more complex than Starlight for our needs |

---

## Progress Tracking

| Phase | Status | Start | End |
|-------|--------|-------|-----|
| Phase 1: Foundation | 🔄 In Progress | | |
| Phase 2: AI Enrichments | ⏳ Pending | | |
| Phase 3: UX/UI Polish | ⏳ Pending | | |
| Phase 4: Security & Performance | ⏳ Pending | | |
| Phase 5: Launch Prep | ⏳ Pending | | |
