# Semgrep CLI - Quick Reference

> **Purpose:** Security & code quality scanning for Smart YouTube Bookmarks
> **When to use:** Phase 4 (Code Review) after implementation, alongside CodeRabbit
> **Speed:** Fast (seconds to minutes)

---

## Installation

```bash
# macOS (recommended)
brew install semgrep

# Verify
semgrep --version

# Authenticate for Pro rules (FastAPI, React-specific)
semgrep login
```

**Requirement:** Python 3.9+

---

## Quick Scan Commands

### Full Project Scan
```bash
# Auto-detect languages and rules
semgrep scan --config=auto --text --output=semgrep-results.txt
```

### Backend (Python/FastAPI)
```bash
# Security audit
semgrep scan \
  --config=p/python \
  --config=p/security-audit \
  --config=p/owasp-top-ten \
  backend/

# FastAPI-specific (requires semgrep login)
semgrep ci backend/
```

### Frontend (TypeScript/React)
```bash
# Full frontend scan
semgrep scan \
  --config=p/javascript \
  --config=p/typescript \
  --config=p/react \
  frontend/
```

---

## Common Rulesets

| Ruleset | Command | Use Case |
|---------|---------|----------|
| **Auto** | `--config=auto` | General purpose, all languages |
| **Python** | `--config=p/python` | Python security & best practices |
| **JavaScript** | `--config=p/javascript` | JS/TS security & patterns |
| **TypeScript** | `--config=p/typescript` | TypeScript-specific rules |
| **React** | `--config=p/react` | React security & anti-patterns |
| **OWASP Top 10** | `--config=p/owasp-top-ten` | Critical security issues |
| **Security Audit** | `--config=p/security-audit` | Comprehensive security scan |

---

## Output Formats

```bash
# Text (human-readable)
semgrep ci --text --text-output=results.txt

# JSON (for automation)
semgrep ci --json --json-output=results.json

# SARIF (for IDE integration)
semgrep ci --sarif --sarif-output=results.sarif

# Multiple formats
semgrep ci --text --output=results.txt --json-output=results.json
```

---

## Integration with Workflow

**After Task Implementation (Phase 4):**

```bash
# 1. Run tests
cd backend && pytest
cd frontend && npm test

# 2. CodeRabbit (background, 7-30+ min)
coderabbit --prompt-only --type committed

# 3. Semgrep (fast, foreground)
semgrep ci --text --output=semgrep-review.txt

# 4. Review results
cat semgrep-review.txt
```

---

## Performance Options

```bash
# Parallel processing (adjust based on CPU cores)
semgrep scan --config=auto -j 4

# Custom timeouts
semgrep ci --timeout 45 --timeout-threshold 2

# Verbose output
semgrep scan --config=auto -v

# Profile slow files
semgrep scan --config=auto --time
```

---

## Two Main Commands

### `semgrep scan` - Local Development
- No account required
- Local-only results
- Fast iteration
- Custom rules testing

```bash
semgrep scan --config=auto
```

### `semgrep ci` - CI/CD & Team
- Requires authentication (`semgrep login`)
- Uploads findings to platform
- Custom organizational rules
- Diff-aware scanning (only changed files)

```bash
semgrep ci
```

---

## Custom Rules

```bash
# Test custom rule file
semgrep scan --config=custom-rules.yaml

# One-time pattern search
semgrep -e '$X == $X' --lang=py backend/

# Combine registry + custom rules
semgrep scan --config=p/python --config=custom-rules.yaml
```

---

## Language Support for This Project

### Python (FastAPI)
- **Maturity:** GA (Generally Available)
- **Parse rate:** 99%+
- **True positive rate:** 84%
- **Features:** Cross-file, cross-function analysis
- **Frameworks:** FastAPI, Django, Flask explicitly supported
- **⚠️ Note:** FastAPI-specific rules require `semgrep login`

### JavaScript/TypeScript (React)
- **Maturity:** GA (Generally Available)
- **Parse rate:** 99%+
- **True positive rate:** 63%
- **Features:** Cross-file, cross-function analysis
- **Frameworks:** React, Express, NextJS, NestJS supported
- **⚠️ Note:** Framework-specific rules require `semgrep login`

---

## Troubleshooting

### Exit code -11 or -9 (Out of Memory)
```bash
# Reduce parallel jobs
semgrep scan --config=auto -j 1

# Skip problematic files if needed
semgrep scan --config=auto --exclude='**/large-file.py'
```

### Slow Scans
```bash
# Profile to find bottlenecks
semgrep scan --config=auto --time
```

### Update Semgrep
```bash
brew upgrade semgrep  # macOS
python3 -m pip install --upgrade semgrep  # pip
semgrep --version
```

---

## Semgrep vs CodeRabbit

| Aspect | Semgrep | CodeRabbit |
|--------|---------|------------|
| Speed | ⚡ Fast (seconds-minutes) | 🐢 Slow (7-30+ min) |
| Focus | 🔒 Security & patterns | 🎯 All-around review |
| Method | 📋 Pattern matching | 🤖 AI analysis |
| Best for | Security audits, bug patterns | Comprehensive reviews |

**Use both:** Semgrep for security, CodeRabbit for quality.

---

## Exit Codes

- `0`: Success (or findings without blocking rules)
- `-9` / `-11`: Memory exhaustion
- Non-zero: Findings with `--error` flag or blocking rules

---

## Resources

- [Explore rules](https://semgrep.dev/explore)
- [Documentation](https://semgrep.dev/docs)
- [Custom rules syntax](https://semgrep.dev/docs/writing-rules/overview)

---

**Last Updated:** 2025-10-28
**Project:** Smart YouTube Bookmarks
**Related:** `.claude/DEVELOPMENT_WORKFLOW.md`, `CLAUDE.md`
