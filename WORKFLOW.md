# Feature Development Workflow

Idiotensichere Schritt-für-Schritt-Anleitung für den Feature-Entwicklungs-Workflow mit Git, PRs und automatisiertem Code Review (Coderabbit).

---

## Quick Reference (Cheatsheet)

```bash
# Kompletter Workflow in Kurzform
git checkout main && git pull
git checkout -b feat/NAME
# ... implementieren ...
git add . && git commit -m "feat: description"
git push -u origin feat/NAME
gh pr create --draft
# ... Coderabbit feedback loop ...
gh pr ready
gh pr merge --squash
git checkout main && git pull
git branch -d feat/NAME
```

---

## Voraussetzungen

### GitHub CLI installieren (einmalig)

```bash
# macOS
brew install gh

# Authentifizieren
gh auth login
# → "GitHub.com" wählen
# → "HTTPS" wählen
# → "Login with a web browser" wählen
# → Code im Browser eingeben
```

### Coderabbit einrichten (einmalig)

1. https://coderabbit.ai öffnen
2. Mit GitHub anmelden
3. Repository hinzufügen
4. Fertig - Coderabbit analysiert automatisch jeden PR

---

## Die 8 Schritte im Detail

### SCHRITT 1: Sauberen Startpunkt sicherstellen

```bash
# In Projekt-Ordner navigieren
cd /path/to/Smart\ Youtube\ Bookmarks

# Aktuellen Status prüfen
git status
```

**Erwartete Ausgabe:**
```
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

**Falls NICHT sauber:**
```bash
# Option A: Änderungen committen
git add .
git commit -m "wip: unfinished work"

# Option B: Änderungen stashen (temporär weglegen)
git stash
# Später wiederherstellen mit: git stash pop

# Option C: Änderungen verwerfen (VORSICHT - unwiderruflich!)
git checkout -- .
```

**Neuesten Stand holen:**
```bash
git pull origin main
```

✅ **Checkpoint:** Du bist auf `main`, alles ist sauber.

---

### SCHRITT 2: Feature Branch erstellen

**Namenskonvention:**
| Prefix | Verwendung | Beispiel |
|--------|------------|----------|
| `feat/` | Neues Feature | `feat/dark-mode-toggle` |
| `fix/` | Bug Fix | `fix/login-redirect` |
| `chore/` | Aufräumen, Config | `chore/update-deps` |
| `refactor/` | Code-Umbau | `refactor/auth-service` |
| `docs/` | Dokumentation | `docs/api-readme` |

```bash
# Branch erstellen UND wechseln
git checkout -b feat/dark-mode-toggle
```

**Erwartete Ausgabe:**
```
Switched to a new branch 'feat/dark-mode-toggle'
```

**Verifizieren:**
```bash
git branch
```
```
  main
* feat/dark-mode-toggle    ← Stern zeigt aktuellen Branch
```

✅ **Checkpoint:** Du bist auf deinem Feature-Branch.

---

### SCHRITT 3: Feature implementieren

Hier arbeitest du mit Claude an deinem Feature.

**Beispiel-Prompt für Claude:**
```
Implementiere einen Dark Mode Toggle in der Settings-Page.
Der Toggle soll:
- In SettingsPage.tsx erscheinen
- Den Theme-State in localStorage speichern
- Eine CSS-Klasse 'dark' auf <html> setzen
```

**Während der Implementierung:**

```bash
# Tests laufen lassen (TDD!)
cd frontend && npm test
cd backend && pytest

# Lint prüfen
cd frontend && npm run lint

# App starten und manuell testen
cd frontend && npm run dev
cd backend && uvicorn app.main:app --reload
```

✅ **Checkpoint:** Feature funktioniert lokal, Tests sind grün.

---

### SCHRITT 4: Erste Commits & Push

**4a: Änderungen ansehen**
```bash
git status          # Was hat sich geändert?
git diff            # Details der Änderungen
```

**4b: Änderungen stagen**
```bash
# Alles stagen
git add .

# ODER: Gezielt einzelne Dateien
git add frontend/src/pages/SettingsPage.tsx
git add frontend/src/hooks/useTheme.ts
```

**4c: Commit erstellen**

Commit-Message Format: `type(scope): kurze beschreibung`

```bash
git commit -m "feat(settings): add dark mode toggle

- Add ThemeToggle component
- Store preference in localStorage
- Apply 'dark' class to html element"
```

**Gute Commit-Messages:**
- `feat(auth): add password reset flow`
- `fix(video): handle missing thumbnail gracefully`
- `refactor(api): extract validation logic`
- `chore(deps): update tanstack-query to v5`

**4d: Zum Remote pushen**
```bash
# Erster Push: Branch auf GitHub erstellen
git push -u origin feat/dark-mode-toggle
```

**Erwartete Ausgabe:**
```
Enumerating objects: 10, done.
...
To github.com:username/smart-youtube-bookmarks.git
 * [new branch]      feat/dark-mode-toggle -> feat/dark-mode-toggle
Branch 'feat/dark-mode-toggle' set up to track remote branch 'feat/dark-mode-toggle' from 'origin'.
```

✅ **Checkpoint:** Code ist auf GitHub.

---

### SCHRITT 5: Draft PR erstellen

**Was ist ein Draft PR?**
- "Work in Progress" - signalisiert, dass du noch nicht fertig bist
- Coderabbit analysiert trotzdem
- Kein Review-Request an Teammitglieder

```bash
gh pr create --draft \
  --title "feat(settings): add dark mode toggle" \
  --body "## Summary
- Adds dark mode toggle to Settings page
- Persists preference in localStorage
- Applies theme via CSS class on html element

## Test Plan
- [ ] Toggle switches theme correctly
- [ ] Preference persists after page reload
- [ ] No flash of wrong theme on load

---
🚧 **Draft** - Waiting for Coderabbit feedback"
```

**Erwartete Ausgabe:**
```
Creating pull request for feat/dark-mode-toggle into main

https://github.com/username/smart-youtube-bookmarks/pull/42
```

**Im Browser öffnen:**
```bash
gh pr view --web
```

✅ **Checkpoint:** Draft PR existiert, Coderabbit startet Analyse.

---

### SCHRITT 6: Coderabbit-Feedback verarbeiten

**6a: Warten (2-5 Minuten)**

Coderabbit postet automatisch Kommentare im PR.

**6b: Feedback kategorisieren**

| Icon | Kategorie | Aktion |
|------|-----------|--------|
| 🔴 | Security | SOFORT fixen |
| 🔴 | Bug | SOFORT fixen |
| 🟡 | Performance | Abwägen |
| 🟢 | Style | Nice-to-have |
| 🟢 | Suggestion | Optional |

**6c: Mit Coderabbit interagieren**

Du kannst Coderabbit direkt im PR antworten:

```
@coderabbitai explain this suggestion
```

```
@coderabbitai full review
```

```
@coderabbitai ignore this comment
```

**6d: Fixes implementieren**

Zurück zu Claude:
```
Coderabbit hat folgendes Feedback gegeben:
1. "Missing error handling in useTheme hook"
2. "localStorage.getItem can return null"

Bitte behebe diese Issues.
```

**6e: Fixes committen und pushen**

```bash
git add .
git commit -m "fix: address coderabbit feedback

- Add error handling to useTheme
- Handle null case for localStorage"

# Kein -u mehr nötig!
git push
```

**6f: Wiederholen bis sauber**

Coderabbit analysiert nach jedem Push automatisch neu.

```
┌─────────────────────────────────────────┐
│  Push → Coderabbit → Feedback → Fix     │
│    ↑                              │     │
│    └──────────────────────────────┘     │
│         Wiederholen bis clean           │
└─────────────────────────────────────────┘
```

✅ **Checkpoint:** Keine kritischen Coderabbit-Kommentare mehr.

---

### SCHRITT 7: PR "Ready" markieren

**Checkliste:**
- [ ] Alle Tests grün? → `npm test` / `pytest`
- [ ] Lint sauber? → `npm run lint`
- [ ] Build funktioniert? → `npm run build`
- [ ] Coderabbit zufrieden? → Keine offenen kritischen Issues
- [ ] Feature manuell getestet?

```bash
gh pr ready
```

**Erwartete Ausgabe:**
```
Pull request #42 is marked as ready for review
```

**Optional: Reviewers hinzufügen**
```bash
gh pr edit --add-reviewer teammate-username
```

✅ **Checkpoint:** PR ist bereit zum Mergen.

---

### SCHRITT 8: Merge & Aufräumen

**8a: Letzte Prüfung**
```bash
gh pr status
gh pr checks
```

**8b: Merge durchführen**

| Merge-Typ | Befehl | Wann verwenden |
|-----------|--------|----------------|
| **Squash** (empfohlen) | `gh pr merge --squash` | Viele kleine Commits |
| Regular Merge | `gh pr merge --merge` | History erhalten |
| Rebase | `gh pr merge --rebase` | Lineare History |

```bash
gh pr merge --squash
```

**Prompt:**
```
? What's next? Submit
```

**Erwartete Ausgabe:**
```
✓ Squashed and merged pull request #42
✓ Deleted branch feat/dark-mode-toggle
```

**8c: Lokal aufräumen**

```bash
# Zurück zu main
git checkout main

# Neuesten Stand holen
git pull

# Lokalen Branch löschen
git branch -d feat/dark-mode-toggle
```

**8d: Verifizieren**

```bash
git branch
```
```
* main
```

✅ **FERTIG!** Feature ist in main, alles aufgeräumt.

---

## Troubleshooting

### "gh: command not found"

```bash
brew install gh
gh auth login
```

### "Branch already exists"

```bash
git branch -D feat/feature-name
git checkout -b feat/feature-name
```

### "Merge conflicts"

```bash
# Main in deinen Branch mergen
git checkout feat/feature-name
git merge main

# Konflikte in VS Code oder Editor lösen
# Dann:
git add .
git commit -m "fix: resolve merge conflicts"
git push
```

### "PR checks failing"

```bash
# Lokal prüfen
npm run lint
npm test
npm run build

# Fixen
git add .
git commit -m "fix: resolve failing checks"
git push
```

### "Coderabbit not responding"

Im PR kommentieren:
```
@coderabbitai review
```

### "Accidentally committed to main"

```bash
# Letzten Commit rückgängig (behält Änderungen)
git reset --soft HEAD~1

# Neuen Branch erstellen
git checkout -b feat/feature-name

# Jetzt committen
git add .
git commit -m "feat: description"
```

---

## Nützliche Befehle

### Git Shortcuts

```bash
# Status (kurz)
git status -s

# Schöner Log
git log --oneline -10

# Alle Branches
git branch -a

# Branch wechseln
git checkout branch-name

# Letzten Commit ändern (VOR push!)
git commit --amend
```

### GitHub CLI Shortcuts

```bash
# PR im Browser öffnen
gh pr view --web

# Alle offenen PRs
gh pr list

# PR Status
gh pr status

# PR Checks ansehen
gh pr checks
```

### Workflow-Aliases (optional in ~/.gitconfig)

```ini
[alias]
    co = checkout
    br = branch
    ci = commit
    st = status
    last = log -1 HEAD
    new = checkout -b
```

---

## Commit Message Konventionen

### Format

```
type(scope): kurze beschreibung

Optionaler längerer Body mit mehr Details.
- Bullet points sind OK
- Erkläre das "warum", nicht das "was"

Closes #123
```

### Types

| Type | Beschreibung |
|------|--------------|
| `feat` | Neues Feature |
| `fix` | Bug Fix |
| `docs` | Dokumentation |
| `style` | Formatting (kein Code-Change) |
| `refactor` | Code-Umbau (keine neuen Features) |
| `perf` | Performance-Verbesserung |
| `test` | Tests hinzufügen/ändern |
| `chore` | Build, Dependencies, Config |

### Beispiele

```bash
# Feature
git commit -m "feat(auth): add password reset flow"

# Bug Fix
git commit -m "fix(video): handle missing thumbnail gracefully"

# Mit Issue-Referenz
git commit -m "fix(upload): validate file size before processing

Closes #42"
```

---

## Retrospektives Code Review

Falls du bereits Code in `main` hast ohne vorheriges Review:

### Option 1: Audit PR

```bash
git checkout -b chore/code-audit
echo "# Code Audit $(date)" >> AUDIT.md
git add AUDIT.md
git commit -m "chore: trigger code review audit"
git push -u origin chore/code-audit

gh pr create --title "chore: code quality audit" \
  --body "@coderabbitai full review"
```

### Option 2: Lokale Analyse

```bash
# Frontend
cd frontend
npm run lint
npx tsc --noEmit

# Backend
cd backend
source .venv/bin/activate
mypy app/
```

---

## Weitere Ressourcen

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [Coderabbit Docs](https://docs.coderabbit.ai/)
