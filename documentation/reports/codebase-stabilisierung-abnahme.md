# Stabilisierungsstand – Teilimplementierung, keine Gesamtabnahme

Plan: `docs/plans/2026-11-09-codebase-stabilisierung.md`. Basis: `0ddbd6f`.
Isolierter Checkout `t3/stabilize-youtube-bookmarks`, bei Start sauber.

## Verbindlicher Stand

Codebasis für die Schlussprüfungen: `238f7df` (ausgehend von `0ddbd6f`).
Der Auftrag zur vollständigen Umsetzung von AP 1–11 ist **nicht abgeschlossen**.
Die offenen Punkte umfassen noch Implementierung, nicht nur fehlende externe Nachweise.

| AP | Status | Umgesetzt / verbleibend |
| --- | --- | --- |
| 1 | Lokal umgesetzt | Python 3.11, Root-npm-Lockfile, separate PostgreSQL-/Redis-Services, DB-Ziel-/Verbindungs-/Suite-Schutz, reguläre vollständige Testläufe. |
| 2 | Teilweise | Build repariert, mehrere Produktfehler und Testverträge korrigiert. Vollständiges Frontend und Linting noch nicht grün. |
| 3 | Teilweise | Auth-bestätigter Reconnect, paginierte History, monotone Zusammenführung, Retry-UI und Origin-URL lokal getestet. Der HTTP-Vertrag verlangt noch `user_id`; produktive History-/Clerk-Integration und stabile serverseitige Eventidentitäten fehlen. |
| 4 | Lokal abgeschlossen | PostgreSQL-Upsert statt Zeilen-Rollback, letzte gültige Feldzeile, Parallelimport und CSV-Roundtrip nachgewiesen. Provider gemockt. |
| 5 | Teilweise | Create verändert keine fremden Filter-/Sortiercaches, inaktive Varianten werden stale. Vollständige Detail-/Schema-/Feldwert-Invalidierung noch offen. |
| 6 | Weitgehend lokal implementiert, nicht vollständig abgenommen | Outbox, Dispatcher, Leases/Backoff, stabile ARQ-ID, dauerhafte Worker-Claims, Ziel-Lock und Commit vor Bestätigung; fachliche Produzenten/Recovery umgestellt. Einige geforderte Crash-/Doppeldispatch-Fälle und Oberflächen für verwaiste/finale Fehler fehlen. |
| 7 | Nicht implementiert | Clerk-Tokens, alle HTTP-Eigentumsprüfungen, Zwei-Benutzer-Matrix, Altdatenzuordnung und verifizierte WebSub-Ausnahmen fehlen. |
| 8 | Nicht implementiert | Clerk-Frontend, zentrale Tokens, Einmal-Tickets und vollständige Bereinigung beim Benutzerwechsel fehlen. |
| 9 | Teilweise | CSV-Persistenz/Feldimport-Service und eigenständige Thumbnail-Komponente extrahiert. Router-/Query-Service-Aufteilung, weitere Page-/Hook-Extraktionen fehlen. |
| 10 | Nicht implementiert | Serverpagination, Migration der Aufrufer und Messung 100/1.000/10.000 fehlen. |
| 11 | Teilweise | CI-Datei, reparierte Migrationskette samt synthetischem Upgrade, Worker-Start und aktualisierte Anleitung. Frontend-/Typprüfungen, API-Generator-Drift, Readiness und vollständiger realer Ablauf offen. |

Clerk wurde anhand der offiziellen [Token-Verifikation](https://clerk.com/docs/guides/sessions/manual-jwt-verification),
[Session-Claims](https://clerk.com/docs/guides/sessions/session-tokens) und des
[React-Quickstarts](https://clerk.com/docs/react/getting-started/quickstart) geprüft.
Es wurde keine vorhandene Instanzkonfiguration nachgewiesen und keine reale Anmeldung durchgeführt.
Keine Secrets angefordert oder in Chat/Repository übernommen. Fehlende Konfiguration erklärt
nicht die noch fehlende lokale Auth-Implementierung.

## Nachweisarten

- **Echt lokal:** PostgreSQL-Transaktionen, parallele CSV-Imports, DB-Leases/-Claims/-Locks,
  Redis/ARQ-Transport, Alembic auf neuer Datenbank und synthetischem Altstand, Worker-Burst-Start,
  npm-Produktionsbuild, pytest/Vitest/Ruff/mypy-Ausführung.
- **Simuliert:** YouTube-/KI-Antworten, Redis-Ausfalltest, WebSocket-Verbindungsabläufe und
  Providerarbeit im ARQ-Transporttest. Diese Tests sind keine echte Provider-/Browserabnahme.
- **Nicht nachgewiesen:** Clerk-Login, Tokenablauf, Benutzerwechsel, produktive WebSocket-Tickets,
  vollständige Zwei-Benutzer-Isolation, echte Providerantworten, Lastmessung und gehosteter CI-Lauf.

Die Workflow-Datei ist lokal erstellt und syntaktisch als YAML geprüft. Es erfolgten kein Push,
Merge, Deployment oder externer CI-Lauf. Bestehende Benutzerdaten wurden nicht migriert.
Die ursprünglichen uncommitteten Projektdateien außerhalb dieses Worktrees wurden nicht übernommen.

## Arbeitsprotokoll

- AP 1 begonnen. Node 22.22.3, npm 10.9.8, frisch angelegtes Python 3.11.15 mit uv.
- Maßgeblich ist das Root-Lockfile: Root definiert npm workspaces; Installation mit `npm ci` im Root.
- Keine bestehenden Anwendungsdaten, Volumes oder Provider-Ressourcen werden verwendet.
- Schnittstellen: AP 3 History wird in AP 7/8 authentifiziert; AP 5 Query-Keys werden in AP 9/10 weiterverwendet; AP 6 Outbox muss auch nach AP 9-Extraktionen alle Enqueue-Pfade umfassen; AP 10 Export bleibt unpaginiert.
- Entscheidung: Umsetzung und Abschlussreview selbst, da der Auftrag weitere Subagents verbietet. Kein Push/Merge/Deployment.
- Kein separates Spec referenziert; Plan und expliziter Auftrag bilden die verbindlichen Anforderungen.

## Status

Die Gesamtstabilisierung ist noch nicht abgenommen. Verbindlich ist die folgende Statusmatrix; die späteren Abschnitte protokollieren auch zwischenzeitliche rote Läufe.

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

### AP 4: CSV-Transaktionen

PostgreSQL-Regression zunächst **3 fehlgeschlagen / 1 bestanden** (neue Zeilen gingen
beim Duplikat verloren). Gezieltes `ON CONFLICT (list_id, youtube_id) DO NOTHING RETURNING`
ersetzt globale Rollbacks. Andere Integritätsfehler werden nicht als Duplikate verschluckt.
Wiederholte CSV-Zeilen werden für Feldwerte in Dateireihenfolge verarbeitet; ungültige
Werte überschreiben keine vorherigen gültigen Werte.
Gezielter Lauf inklusive bestehender Feldimport-/Export- und Roundtrip-Tests:
**23 bestanden** in 8,23 s. Parallelimport und expliziter Letzte-gültige-Zeile-Test stehen noch aus.

### AP 3: Fortschritt nach Wiederverbindung

Reconnect-Zustand bleibt bis zur Authentifizierungsbestätigung erhalten. History wird
seitenweise im tatsächlichen API-Format gelesen (keine Millisekunden als Datetime-Cursor).
Live-/History-Updates werden monoton zusammengeführt; getrennte Verbindungsgenerationen
verwerfen verspätete Antworten. Fehler bleiben sichtbar und sind über die UI erneut versuchbar.
WebSocket-URL folgt Origin und ws/wss; Proxy nutzt `/api` einschließlich WebSockets.
Gezielte Reconnect-Regression rot → grün. Bestehender Hook-Testvertrag korrigiert:
Socket-Mock löst bei Öffnen wie die echte Library ein Render aus; Store liefert `realProgress`.
HTTP-History-Authentifizierung und persistente Eventidentität bleiben Teil der offenen AP-7/8-Arbeit.

AP 4 ergänzend: Parallelimporte desselben Videos und letzte gültige Feldwerte in
wiederholten CSV-Zeilen explizit geprüft: **6/6 bestanden**, echte PostgreSQL-Transaktionen,
YouTube-/Queue-Seiteneffekte simuliert.

### AP 5: Create-Cache

Regression mit ungefiltertem, zwei Tagfiltern und absteigender Sortierung rot → grün.
Create hängt keine Datensätze mehr in abgeleitete Caches; vorhandene Daten bleiben bis
zum Refetch erhalten, inaktive Varianten werden stale. Mutationsergebnis steht sofort bereit.
Gemeinsamer gezielter Hook-Lauf (Cache + WebSocket): **26/26 bestanden**.
Weitere Detail-/Schema-/Feldwert-Regressionen stehen noch aus.

### AP 6: Dauerhafte Jobübergabe (laufend)

Outbox mit Operation-ID, Payload-Version, Status, Versuchen, Backoff und Lease.
Dispatcher arbeitet begrenzte Batches ab, überspringt gesperrte Zeilen und verwendet
stabile ARQ-IDs. Worker beansprucht die Operation vor Providerarbeit dauerhaft;
ein PostgreSQL-Advisory-Lock verhindert parallele Ausführung desselben Ziels auch
bei abgelaufener Lease. Abgeschlossene Operationen werden nicht erneut ausgeführt.
Tests: Rollback, Redis-Ausfall, unsichtbare uncommittete Absichten und konkurrierende
Doppelzustellung: **4/4 bestanden**. Produzenten-/CSV-/Processing-Regressionen: **41 bestanden**.

Inventar: Videoimport/-erstellung, Processing, Enrichment-Retry, Video-Worker,
Abonnement-Polling, Webhooks sowie Startup-/Cron-Recovery wurden auf transaktionsgebundene
Absichten umgestellt. Der Dispatcher ist die einzige direkte fachliche ARQ-Übergabe.
Alle Ausfallfenster sind noch nicht vollständig abgenommen. Provider ohne eigene
Idempotenz können nach Antwort plus Prozessabsturz erneut aufgerufen werden.
Aufbewahrung: offene/fehlgeschlagene Einträge nie automatisch löschen; abgeschlossene
Operationen mindestens 30 Tage erhalten. Ein automatischer Bereinigungsjob ist nicht eingerichtet.


## Weitere verifizierte Schritte

- AP 2: Feldwechsel bricht ausstehende Debounce-Speicherung ab; ältere Videos ohne
  Importstatus bleiben anklickbar; ungültige Tag-Farbe zeigt einen sichtbaren Fehler.
  Bestehende rote Regressionen wurden grün. Dialog-/Thumbnail-/Store-Verträge: **83/83 bestanden**.
- Import-/Outbox-/echter Redis-/Fixture-Lock-Lauf nach Extraktion: **34/34 bestanden**.
- Leases, Wiederholung, Daten-Commit vor Abschlussmarkierung und Sicherheitsprüfungen:
  gezielte Läufe bis **16/16 bestanden**. Die Handler-Commit-Lücke wurde mit einem
  PostgreSQL-Test rot → grün behoben.
- Alembic: vier zuvor defekte Schritte repariert. `scripts/check_migrations.py` auf neuer
  Testdatenbank erfolgreich; synthetische Liste bleibt beim Upgrade erhalten.
- Worker `app.workers.settings.WorkerSettings --burst` mit expliziter Test-DB und isoliertem
  Redis erfolgreich gestartet; 16 normale/Cron-Funktionen registriert. Keine Providerarbeit dabei.
- Kollision zweier Läufe auf derselben Test-DB wurde nicht als Produktbefund gewertet.
  Wiederholung serialisiert grün; Fixture lehnt weitere parallele Suites vor Tabellenzugriff ab.
- Zwischenzeitlicher gleichzeitiger Commit-Versuch von Git abgelehnt, anschließend seriell committet.
- Backend-Typisierung: Basismodell verwendete SQLAlchemys UUID-Typ als Python-ID-Typ.
  Korrektur auf `uuid.UUID`; keine Abschwächung von `strict` oder Projektregeln.
- Abschlussreview ist ein Selbstreview entsprechend dem Verbot weiterer Subagents;
  kein unabhängiger Review behauptet. Es gibt keine öffentliche Betriebsfreigabe.

## Fortsetzung

Zuerst rote Frontend-Verträge und Backend-Typfehler anhand des Fehlerinventars beheben;
AP 3/5/6 noch fehlende Pflichtfälle ergänzen. Danach AP 7/8 vollständig implementieren,
weitere AP-9-Extraktionen und AP 10 durchführen. Anschließend API-Drift/Readiness und
vollständige lokale sowie reale Abnahme aus AP 11 durchführen. Für echte Clerk-Abnahme
benötigte Konfiguration erst über den vorgesehenen Secret-Kanal entgegennehmen.


## Schlussprüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `cd frontend && npm run build` | Erfolgreich; 4,38 s Vite-Build, Bundle-Größenwarnung bleibt. |
| `cd frontend && npm test -- --run` (JSON-Reporter zur Inventarisierung) | 1.195 bestanden / 104 fehlgeschlagen; reguläres Ergebnis, keine Tests deaktiviert. |
| `cd frontend && npm run lint` | 76 Fehler / 162 Warnungen. |
| `cd backend && .venv/bin/ruff check app tests` | Erfolgreich. |
| `cd backend && .venv/bin/mypy app` | 232 Fehler in 52 Dateien auf Schlussbasis `238f7df`. |
| PostgreSQL-/CSV-/Outbox-/Redis-/Processing-Regressionen | 43 bestanden nach dem zusätzlichen Parallelstart-Fix. |
| Alembic-Skript auf leerer dedizierter Datenbank | Erfolgreich; synthetischer Bestand bleibt erhalten. |
| Worker-Burst-Start auf migrierter Test-DB / Redis-DB 2 | Erfolgreich; keine Providerarbeit. |

Der vorletzte vollständige Backend-Lauf endete mit **895 bestanden, 31 vorhandenen Skips
und einem Fixture-Verbindungsfehler** (`test_create_custom_field_select`, Verbindung beim Refresh
geschlossen). Kein fehlgeschlagener Verhaltenstest in diesem Lauf. Der Verbindungsfehler wird
nicht verschwiegen; der serielle Schlusslauf wird separat unten protokolliert.

Die 31 vorhandenen Backend-Skips wurden nicht neu eingeführt oder zur Grünfärbung verwendet;
darunter ist der bisher nicht implementierte gültige WebSocket-Auth-Test. Ein grüner Backend-Lauf
allein ersetzt daher keine Auth-Abnahme. Alle verbleibenden Frontend-Testnamen sowie die
Typfehlerverteilung stehen im [Fehlerinventar](stabilisierung-fehlerinventar.md).

Zusätzlicher Selbstreview-Fix: konkurrierende Processing-Starts sperren die Liste und lehnen
einen weiteren aktiven Elternauftrag mit 409 ab. CSV-Fanout plant nur neu erstellte ausstehende
Videos als einzelne Operationen. PostgreSQL-Regression rot → grün; reale Redis-Tests benutzen
pro Lauf eigene Queue-Namen.

## Serieller Backend-Schlusslauf

Auf Codebasis `238f7df` erfolgreich: **897 bestanden, 31 vorhandene Skips, 24 Warnungen**,
156,30 s. Befehl in `backend/`:

```bash
TEST_DATABASE_URL=postgresql+asyncpg://test:test@localhost:55438/bookmarks_test \
TEST_REDIS_URL=redis://localhost:56388/3 \
REDIS_URL=redis://localhost:56388/0 \
.venv/bin/python -m pytest -q --tb=short
```

Keine Anwendungstabellen/-volumes verwendet. Die Warnungen betreffen unter anderem
Deprecations, einen wiederverwendeten AsyncLimiter, ORM-Relationship-Warnung sowie
nicht benutzte Benchmark-Fixtures. Dies ist ausdrücklich kein AP-10-Lastnachweis.
Der vorherige einmalige Verbindungsfehler bleibt oben protokolliert; eine abschließend
nachgewiesene Ursache dafür liegt nicht vor.

Die vorangegangenen roten Läufe wurden nach Fehlerursache bearbeitet: falsche
Provider-Mocks, fehlende synthetische Konfiguration, implizite Benutzer-/FK-Fixtures,
Kategorien statt Labels und überholte direkte Redis-Erwartungen. Keine Tests neu
übersprungen oder Typ-/Lint-Regeln abgeschwächt.

Die lokalen Compose-Testservices bleiben für eine Fortsetzung erreichbar. Sie lassen
sich ohne Anwendungsvolumes über `docker compose -p syb-stabilization-test -f docker-compose.test.yml down`
beenden. Neue Alembic-Revisionen werden nicht mehr durch `.gitignore` verborgen.

## Lokale Commits

- `a15c62f` chore: make local test setup reproducible
- `d92732d` test: guard database fixtures against application data
- `0f6b3ed` fix: handle empty channel navigation safely
- `433f092` test: keep async database fixtures on the test event loop
- `8690678` test: isolate progress sockets and reject unexpected requests
- `f20ab29` fix: preserve successful csv rows when duplicates occur
- `63ae2cc` fix: recover missed progress after websocket reconnect
- `d946994` fix: reconcile video caches after mutations
- `30a4aac` feat: persist background job intents in postgres
- `cb84976` feat: dispatch durable jobs with retry and leases
- `5b6c281` fix: make job producers use durable operation intents
- `7d27867` fix: commit worker data before acknowledging durable jobs
- `cc59ced` fix: make the migration chain runnable on an empty database
- `bb167fb` refactor: extract csv persistence and field import service
- `69fac90` test: cover parallel imports and durable retry delivery
- `f090e2d` test: reject application connections and overlapping database suites
- `5698ec3` refactor: extract standalone video thumbnails
- `208a83d` fix: keep legacy videos without import state interactive
- `f94878d` fix: cancel pending field saves when switching fields
- `08cecac` chore: complete backend test tooling and satisfy ruff checks
- `f9fe421` test: reject application database aliases conservatively
- `b34926d` fix: use python uuid types in mapped model identities
- `1240022` test: model current hook return values in page fixtures
- `36bbe94` ci: enforce build tests typing lint and migration checks
- `d2731c4` test: verify current import and durable worker contracts
- `7ad0182` test: use labels for multi-tag assignment scenarios
- `89e75d8` test: isolate provider configuration with synthetic credentials
- `c57f3c7` test: make api reference and user fixtures explicit
- `d8cf5cd` fix: show color validation errors in tag editor
- `7184630` test: align grid sizing and animated progress expectations
- `238f7df` fix: serialize processing acceptance and claim each imported video
- `532291e` chore: keep new alembic revisions visible to git
