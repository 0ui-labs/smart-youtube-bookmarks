
⏺ 🎯 Detaillierte Workflow-Breakdowns

  1. GREENFIELD-WORKFLOW (deine geniale Struktur!)

  ├─ Phase 1: Idea Clarification → idea.md
  │  └─ Fokus: Was/Warum/Welches Problem? (KEINE Tech, kein Markt!)
  │
  ├─ Phase 2: User Journey → user-journey.md
  │  └─ Fokus: Zentraler Use-Case, Happy Path
  │
  ├─ Phase 3: User Stories → stories/[ID]-[timestamp]-[category].md
  │  └─ Fokus: Konkrete UX Flows, High-Level Backend-Logic
  │
  ├─ Phase 4: Global Design → global-design.md
  │  └─ Fokus: Design-System, Styling, Branding
  │
  ├─ Phase 5: UI Design per Story → ui-designs/story-[ID]-ui.md
  │  └─ Fokus: Screen-by-Screen mit Begründung
  │
  ├─ Phase 6: Core Functionalities → core-functionalities.md
  │  └─ Fokus: MVP-Features (elementar, kein Nice-to-Have!)
  │
  ├─ Phase 7: High-Level Plan → projektplan/etappen-overview.md
  │  └─ Fokus: Etappen + Dependencies + Begründung
  │
  ├─ Phase 8: Etappen-Details → projektplan/etappe-[N]-detail.md
  │  └─ Fokus: Abschnitte in optimaler Reihenfolge
  │
  ├─ Phase 9: Abschnitts-Plans → projektplan/etappe-[N]-abschnitt-[M].md
  │  └─ Fokus: Step-by-Step Implementation
  │
  ├─ Phase 10: Atomic Steps → projektplan/etappe-[N]-abschnitt-[M]-atomic.md
  │  └─ Fokus: Kleinste testbare Einheiten
  │
  └─ Phase 11: Research & Validation → research/validation-report.md
     └─ Fokus: Best Practices, Tools, Libraries mit Begründung

  ---
  2. FEATURE-WORKFLOW (neu strukturiert)

  ├─ Phase 1: Feature Understanding → features/[ID]-understanding.md
  │  └─ Fokus: Was soll Feature tun? Warum? Für wen?
  │
  ├─ Phase 2: Codebase Analysis → features/[ID]-codebase-analysis.md
  │  └─ Fokus: Bestehende Architektur, Integration-Points, Patterns
  │
  ├─ Phase 3: Impact Assessment → features/[ID]-impact.md
  │  └─ Fokus: Was wird berührt? DB-Schema? APIs? Tests?
  │
  ├─ Phase 4: Integration Strategy → features/[ID]-integration.md
  │  └─ Fokus: Wie integrieren ohne Breaking Changes?
  │
  ├─ Phase 5: Backward Compatibility → features/[ID]-compatibility.md
  │  └─ Fokus: Feature Flags? Versioning? Migration?
  │
  ├─ Phase 6: User Stories → features/[ID]-stories/[story-ID].md
  │  └─ Fokus: Feature-spezifische Use-Cases
  │
  ├─ Phase 7: UI/UX Integration → features/[ID]-ui-integration.md
  │  └─ Fokus: Wie fügt sich Feature ins bestehende Design?
  │
  ├─ Phase 8: Implementation Plan → features/[ID]-plan.md
  │  └─ Fokus: Schritte mit Dependencies
  │
  ├─ Phase 9: Testing Strategy → features/[ID]-testing.md
  │  └─ Fokus: Unit/Integration/E2E + Regression-Tests
  │
  ├─ Phase 10: Atomic Steps → features/[ID]-atomic-steps.md
  │  └─ Fokus: Kleinste testbare Schritte
  │
  └─ Phase 11: Research & Validation → features/[ID]-research.md
     └─ Fokus: Best Practices für diese Art Feature

  ---
  3. BUGFIX-WORKFLOW (neu strukturiert)

  ├─ Phase 1: Bug Reproduction → bugs/[ID]-reproduction.md
  │  └─ Fokus: Steps to Reproduce, Expected vs. Actual
  │
  ├─ Phase 2: Root Cause Analysis → bugs/[ID]-root-cause.md
  │  └─ Fokus: Warum passiert der Bug? (Systematic Debugging)
  │
  ├─ Phase 3: Impact Analysis → bugs/[ID]-impact.md
  │  └─ Fokus: Wie viele User betroffen? Severity? Workaround?
  │
  ├─ Phase 4: Pattern Recognition → bugs/[ID]-pattern.md
  │  └─ Fokus: Ähnliche Bugs im Code? Systematisches Problem?
  │
  ├─ Phase 5: Fix Strategy → bugs/[ID]-fix-strategy.md
  │  └─ Fokus: Wie fixen ohne neue Bugs zu erzeugen?
  │
  ├─ Phase 6: Regression Test Design → bugs/[ID]-regression-test.md
  │  └─ Fokus: Test schreiben BEVOR Fix (TDD!)
  │
  ├─ Phase 7: Fix Implementation Plan → bugs/[ID]-fix-plan.md
  │  └─ Fokus: Schritt-für-Schritt mit Verification
  │
  ├─ Phase 8: Validation Strategy → bugs/[ID]-validation.md
  │  └─ Fokus: Wie beweisen wir, dass Fix funktioniert?
  │
  └─ Phase 9: Prevention → bugs/[ID]-prevention.md
     └─ Fokus: Was ändern wir, damit das nie wieder passiert?

  ---
  4. REFACTOR-WORKFLOW (neu strukturiert mit Safety!)

  ├─ Phase 1: Pain Point Analysis → refactors/[ID]-pain-points.md
  │  └─ Fokus: Was ist das Problem? Warum refactoren?
  │
  ├─ Phase 2: Current State Documentation → refactors/[ID]-current-state.md
  │  └─ Fokus: Code-Struktur, Dependencies, Complexity-Metrics
  │
  ├─ Phase 3: Success Criteria → refactors/[ID]-success-criteria.md
  │  └─ Fokus: Wie messen wir Verbesserung? (Metrics!)
  │
  ├─ Phase 4: Safety Net → refactors/[ID]-safety-net.md
  │  └─ Fokus: Tests schreiben um JETZIGE Funktionalität zu sichern!
  │
  ├─ Phase 5: Refactor Strategy → refactors/[ID]-strategy.md
  │  └─ Fokus: Extract? Rename? Restructure? Welche Pattern?
  │
  ├─ Phase 6: Incremental Steps → refactors/[ID]-incremental-steps.md
  │  └─ Fokus: Kleinste Schritte, Tests bleiben IMMER grün!
  │
  ├─ Phase 7: Atomic Refactor Plan → refactors/[ID]-atomic-plan.md
  │  └─ Fokus: Jeder Schritt = 1 Commit, Tests grün
  │
  ├─ Phase 8: Verification Strategy → refactors/[ID]-verification.md
  │  └─ Fokus: Nach jedem Schritt: Tests + Funktionalitäts-Check
  │
  └─ Phase 9: Code Quality Validation → refactors/[ID]-quality-validation.md
     └─ Fokus: Metrics vorher/nachher (Complexity, Duplication, etc.)

  ---
  5. INTEGRATION-WORKFLOW (neu strukturiert)

  ├─ Phase 1: External Service Analysis → integrations/[ID]-service-analysis.md
  │  └─ Fokus: Was macht Service? API-Docs verstehen
  │
  ├─ Phase 2: API Contract Study → integrations/[ID]-api-contract.md
  │  └─ Fokus: Endpoints, Auth, Rate-Limits, Errors
  │
  ├─ Phase 3: Error Scenarios → integrations/[ID]-error-scenarios.md
  │  └─ Fokus: Alle möglichen Failures (Timeout, 500, 429, etc.)
  │
  ├─ Phase 4: Authentication Strategy → integrations/[ID]-auth.md
  │  └─ Fokus: API-Key? OAuth2? JWT? Wie sicher speichern?
  │
  ├─ Phase 5: Rate Limiting Strategy → integrations/[ID]-rate-limiting.md
  │  └─ Fokus: Limits? Retry-Logic? Backoff-Strategy?
  │
  ├─ Phase 6: Data Mapping → integrations/[ID]-data-mapping.md
  │  └─ Fokus: Externe Daten → Interne Struktur
  │
  ├─ Phase 7: Testing Strategy → integrations/[ID]-testing.md
  │  └─ Fokus: Mocking? VCR? Test-Accounts? Sandbox?
  │
  ├─ Phase 8: Integration Plan → integrations/[ID]-integration-plan.md
  │  └─ Fokus: Schritte mit Fallback-Strategie
  │
  ├─ Phase 9: Monitoring & Alerting → integrations/[ID]-monitoring.md
  │  └─ Fokus: Was loggen? Wann alerten?
  │
  └─ Phase 10: Research & Best Practices → integrations/[ID]-research.md
     └─ Fokus: Wie integrieren andere diesen Service?

  ---
  🎯 Manager-Skill (Intent-Router) - Konzept

  Der Manager-Skill muss:

  1. User-Prompt analysieren
  2. Intent klassifizieren:
     - Greenfield (Keywords: "neue App", "von Grund auf", "neues Projekt")
     - Feature (Keywords: "Feature", "hinzufügen", "erweitern", in Codebase)
     - Bugfix (Keywords: "Bug", "funktioniert nicht", "Fehler")
     - Refactor (Keywords: "verbessern", "umbauen", "aufräumen")
     - Integration (Keywords: "API", "Service integrieren", "Third-Party")

  3. Bei Unklarheit: AskUserQuestion mit Intent-Options

  4. Entsprechenden Workflow-Skill laden

  5. TodoWrite für alle Phasen des gewählten Workflows erstellen

  ---

⏺ ✅ Zusammenfassung

  Ich habe alle 5 Top-Priority-Workflows detailliert strukturiert:

  1. ✅ Greenfield: 11 Phasen (deine Struktur!)
  2. ✅ Feature: 11 Phasen (mit Codebase-Analyse & Backward-Compatibility)
  3. ✅ Bugfix: 9 Phasen (mit Root-Cause & Prevention!)
  4. ✅ Refactor: 9 Phasen (mit Safety-Net - Tests bleiben IMMER grün!)
  5. ✅ Integration: 10 Phasen (mit Error-Handling & Rate-Limiting)
  6. ✅ Manager-Skill: Intent-Router Konzept