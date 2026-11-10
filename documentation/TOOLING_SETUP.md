# Verifiziertes Tooling

Stand 10.11.2026: Node 22.22.3/npm 10, Python 3.11.15, PostgreSQL 16 und Redis 7.
Die ausführbaren Schritte stehen im [README](../README.md). Dieses Dokument
beschreibt den vorhandenen Zustand, keinen Installationsplan für weitere Tools.

- Root-`package-lock.json` ist das einzige npm-Lockfile. Installation: `npm ci` im Root.
- Python: frische `backend/.venv`, `pip install -r backend/requirements-dev.txt`.
- Frontend: TypeScript mit `strict` und `noUncheckedIndexedAccess`, Vite, Vitest/Forks mit einem Worker, MSW mit Fehlern bei unerwarteten Requests.
- Lint: Biome/Ultracite im Frontend, Ruff für `app` und `tests`; vorhandene Regeln wurden nicht zur Grünfärbung abgeschwächt.
- Backend-Typprüfung: `mypy app`, `strict=true`. Verfügbare Stubs sind in `requirements-dev.txt` gepinnt. Für Bibliotheken ohne PEP-561-Marker wird deren Implementierung zusätzlich analysiert (`follow_untyped_imports`), kein pauschales Ignore.
- Kleine explizite Casts an tatsächlich untypisierten Bibliotheksgrenzen erhalten deren Laufzeitverhalten. YouTube-Cacheantworten und strukturierte Gemini-Antworten werden zusätzlich validiert.
- Husky/lint-staged/Commitlint prüfen lokale granulare Commits. Generierte API-Dateien kommen ausschließlich aus Orval.
- `scripts/check_api_client.py` startet einen eigenen lokalen OpenAPI-Prozess, erzeugt in einem temporären Verzeichnis und vergleicht Dateinamen und Bytes; `--write` aktualisiert den Client für Review/Commit.
- `.github/workflows/ci.yml` erzwingt Builds, komplette Suites, Linter, Typprüfung, Migration und API-Drift. Ein gehosteter Lauf wurde in diesem lokalen Auftrag nicht ausgelöst.

Testdatenbankschutz greift vor Tabellenoperationen und vergleicht den expliziten
Testnamen mit der Anwendungsdatenbank. PostgreSQL-Advisory-Lock schützt jede Suite
vor konkurrierender Verwendung desselben Testziels. Der lokale Compose-Dienst
auf Loopback:55438 wird explizit ohne die dort nicht unterstützte SSL-Negotiation
angesprochen; für Anwendungs-/Remoteziele gibt es keine Überschreibung. Fixtures
rollen Resttransaktionen immer zurück, statt fehlgeschlagene Flushes nochmals zu
committen. Migrationstests benötigen ein
zusätzliches leeres Ziel und erhalten synthetische Bestandsdaten beim Upgrade.

[Abnahmeprotokoll](reports/codebase-stabilisierung-abnahme.md) und
[Fehlerinventar](reports/stabilisierung-fehlerinventar.md) halten rote Ausgangsläufe,
Reparaturen, aktuelle Nachweise und verbleibende externe Eingaben getrennt fest.
