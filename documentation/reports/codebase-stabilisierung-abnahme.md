# Stabilisierungsabnahme

Plan: `docs/plans/2026-11-09-codebase-stabilisierung.md`. Basis: `0ddbd6f`.
Isolierter Checkout `t3/stabilize-youtube-bookmarks`, bei Start sauber.

## Arbeitsprotokoll

- AP 1 begonnen. Node 22.22.3, npm 10.9.8, frisch angelegtes Python 3.11.15 mit uv.
- Maßgeblich ist das Root-Lockfile: Root definiert npm workspaces; Installation mit `npm ci` im Root.
- Keine bestehenden Anwendungsdaten, Volumes oder Provider-Ressourcen werden verwendet.
- Schnittstellen: AP 3 History wird in AP 7/8 authentifiziert; AP 5 Query-Keys werden in AP 9/10 weiterverwendet; AP 6 Outbox muss auch nach AP 9-Extraktionen alle Enqueue-Pfade umfassen; AP 10 Export bleibt unpaginiert.
- Entscheidung: Umsetzung und Abschlussreview selbst, da der Auftrag weitere Subagents verbietet. Kein Push/Merge/Deployment.
- Kein separates Spec referenziert; Plan und expliziter Auftrag bilden die verbindlichen Anforderungen.

## Status

AP 1–11 sind noch nicht abgenommen. Dieser Bericht trennt fortlaufend Implementierung, lokale Simulation und echte Provider-/Browsernachweise.

### AP 1: Einrichtung und Datenbankschutz

`npm ci` erfolgreich (979 Pakete); Python-Anforderungen installiert, Backend importierbar.
Installation meldet vorhandene Dependency-Sicherheitsbefunde (npm: 55; google-genai 0.3.0 zurückgezogen).
Kein pauschales Upgrade durchgeführt; gezielte Bewertung bleibt offen.
`pytest tests/test_database_safety.py -q`: zunächst fehlendes Schutzmodul, danach **7 bestanden**.
PostgreSQL 16 und Redis 7 laufen unter eigenem Compose-Projektnamen mit flüchtigem Speicher.

### AP 2: Kanalnavigation

Leere Listen und Ziehen außerhalb der Buchstaben über Komponententests geprüft (2 bestanden).
Array-Zugriffe sind explizit abgesichert, strenge TypeScript-Konfiguration unverändert.
`npm run build`: erfolgreich; Vite meldet große Bundles, kein Buildfehler.

### Baseline und Testinfrastruktur

Frontend-Baseline mit einem Fork: 163 fehlgeschlagen, 1127 bestanden, 3 Fehler,
153,51 s; außerdem nativer libuv-Abbruch einer Worker-Verbindung. Threads ebenfalls betroffen.
HTTP-/WebSocket-Leaks im Integrationstest sind eine konkrete Ursache; MSW erhält
explizite WebSocket-/Kanal-/Listenverträge, unbehandelte Requests sind nun Fehler.
Backend erster Diagnose-Lauf nach 105,88 s abgebrochen: 156 Fehler, 128 bestanden,
108 Fixture-Fehler. Ursache vieler Folgefehler: sessionweiter eigener Event-Loop.
Entfernen des Overrides und Rollback vor Cleanup: zuvor betroffene Migration-Fixture-Tests
jetzt 2/2 bestanden. Weiterer vollständiger Lauf folgt; die abgebrochenen Läufe sind keine Abnahme.

Nach MSW-WebSocket-Handler: vollständiger Frontend-Lauf endet regulär ohne libuv-Abbruch,
151,17 s, 168 fehlgeschlagen / 1127 bestanden / 19 unbehandelte Testfehler. Strikte
HTTP-Prüfung legt zusätzliche fehlende Handler offen; Tests wurden nicht deaktiviert.
AP 2 bleibt offen. Unabhängige AP-3/4/5-Regressionen werden während der Auswertung
vorbereitet; diese Reihenfolge ändert keine Abnahmekriterien.
