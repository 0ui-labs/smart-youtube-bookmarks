# Stabilisierung – lokale Implementierung und getrennte externe Abnahme

Plan: `docs/plans/2026-11-09-codebase-stabilisierung.md`, Plan-Commit `0ddbd6f`.
Bestehender isolierter Worktree `t3/stabilize-youtube-bookmarks`. Die ursprünglichen
33 Commits bis `73eb20e` sind unverändert Vorfahren des aktuellen Heads; keine
weiteren Worktrees, Subagents, Pushes, Merges, Deployments oder Providerressourcen.
Anwendungsdaten und die uncommittete Arbeit im ursprünglichen Projekt blieben unberührt.

## Verbindlicher aktueller Stand

AP 1–10 sind lokal implementiert; die lokalen AP-11-Prüfungen sind abgeschlossen.
CI, Dokumentation, Typprüfung, Generator-Drift und Readiness sind implementiert.
Der vollständige Backend-Schlusslauf nach Transport-/ORM-Reparatur ist grün. **Keine vollständige reale Gesamtabnahme oder öffentliche
Betriebsfreigabe:** Clerk-/Provider-/Browsernachweise fehlen; bekannte Dependency-
Risiken und bestehende Legacy-Skips werden unten ausdrücklich ausgewiesen.

| AP | Lokaler Stand | Nachweis / externer Rest |
| --- | --- | --- |
| 1 | Umgesetzt | Reproduzierbare Runtimes, Root-Lockfile, separate Dienste, DB-/Alias-/Suite-Schutz; lokaler Compose-Transport explizit, fehlgeschlagene Testtransaktionen sauber zurückgerollt. |
| 2 | Umgesetzt, Frontend gesamt grün | 1.311 Tests, Produktionsbuild, Biome ohne Fehler; strenge TS-Regeln unverändert. 169 Warnungen bleiben. |
| 3 | Umgesetzt | Reconnect/History/Retry, gemeinsame Event-IDs, monotone Zusammenführung und Abbruch alter Generationen; echter lokaler Socket/Redis separat, reale Clerk-Browser-Recovery noch offen. |
| 4 | Umgesetzt | PostgreSQL-Upsert, Parallelimporte, letzte gültige Feldzeile, atomare äußere Transaktion und Export/Reimport; Providerantworten simuliert. |
| 5 | Umgesetzt | Gemeinsame Query-Keys, korrekte aktive/inaktive Auswahlcaches, Details/Felder/Schemas und Statistikinvalidierung; paginierte Antwortformen bleiben erhalten. |
| 6 | Umgesetzt | Dauerhafte Absichten aller Produzenten/Recovery, atomarer Workerabschluss, konkurrierende Claims/Dispatcher/Retry, Crashfenster, Diagnose/30-Tage-Retention/Fehlerbudget und Readiness. Provider-Absturzfenster ohne externe Idempotenz dokumentiert. |
| 7 | Lokal umgesetzt | Signierte A/B-Matrix über sämtliche Business-Routen, Alias-/Aggregatscope, atomare Referenzprüfung, expliziter Legacy-Transfer und signierter WebSub-Replay-Schutz. Echte Clerk-/Hub-Konfiguration fehlt. |
| 8 | Lokal umgesetzt | Clerk-Gating, zentraler Token-Transport, Einmal-Tickets, Cache-/Store-Trennung und späte Antwort nach Token-Erneuerung; echte zwei Benutzer am lokalen Socket nachgewiesen, Clerk-Identitäten synthetisch. Echte Browseranmeldung offen. |
| 9 | Umgesetzt | Fokussierte Video-Router/Anlage-/CSV-/Query-/Metadaten-/Jobservices; Query-/Mutation-/Transfer-/Import-/Polling-Hooks, Tabelle/Filter/Recovery separat. Unerreichbare Settings-Flows entfernt. Bestehende Architektur und URLs erhalten. |
| 10 | Umgesetzt und gemessen | Seiten 50/max.100, Count/Filter/Sortierung/Export gleicher Auswahlvertrag, ID-Tie-Breaker auch bei Feldsortierung/Nullwerten, Abbruch/Seitenkorrektur, vollständiger Export, begrenztes Polling und Duplikatsuche. 100/1.000/10.000-Rohdaten vorhanden. |
| 11 | Lokal implementiert und geprüft; externe Abnahme offen | Alle lokalen Pflichtprüfungen erfolgreich. Echte Clerk-/Provider-/Browserabnahme und gehosteter CI-Lauf fehlen; bekannte Dependency-Risiken separat bewertet. |

## Aktuelle Prüfungen

Alle Datenbankbefehle verwenden eigene `_test`-Datenbanken. Keine Migration wurde
auf bestehenden Benutzerdaten ausgeführt. Grundlage: Python 3.11.15, Node 22.22.3,
PostgreSQL 16, Redis 7, macOS 27.2 arm64 / Apple M1 Max / 32 GiB.

| Prüfung | Ausgeführtes Ergebnis |
| --- | --- |
| `frontend: npm test -- --run` | **1.311 bestanden**, 122 Dateien, regulär beendet, 137,93 s. Zuvor 1.308/3 mit veraltetem Provider-Mock; dieser wurde fachlich korrigiert und anschließend die volle Suite grün ausgeführt. |
| `frontend: npm run build` | Erfolgreich nach gezielten Dependency-Updates; Vite-Bundle-Warnung bleibt. |
| `frontend: npm run lint` | Erfolgreich, keine Fehler; 169 Warnungen, keine Regelabschwächung. |
| `backend: mypy app` | **125 Quelldateien ohne Fehler**, `strict=true`; keine pauschalen Ignores/Ausschlüsse. |
| `backend: ruff check app tests` | Erfolgreich, Regeln unverändert. |
| Vollständige Backend-Suite vor letzten Prüfungsfällen | **988 bestanden / 11 bestehende Skips**, 203,48 s. |
| Zusätzlicher Backend-Schlusslauf | 992 bestanden / 10 Skips; ein Verbindungsfehler beim SSL-Upgrade und ein daraus folgender Fixturefehler. Nicht als grün gewertet. Nachfolgend Fixture-/Transportreparatur und erneuter vollständiger Lauf. |
| Fixture-/Transportregression | Cleanup zunächst reproduzierbar rot (Commit einer nach Flush fehlgeschlagenen Transaktion), dann grün; 38 relevante Prüfungen. 250 unabhängige echte Verbindungen zum isolierten lokalen Dienst erfolgreich. |
| Backend-Schlusslauf nach Reparatur | **1.001 bestanden / 10 bestehende Skips**, keine Fehler, 196,74 s. Vorher durch striktes Rollback aufgedeckte ORM-Korruption (7 Test-/7 Cleanup-Fehler) wurde durch separate Antwortmodelle und korrekte Collection-Instrumentierung behoben. |
| Signierter kontinuierlicher API-Abnahmeablauf | Bestanden: A → Liste → Video → CSV/Duplikat → Tag/Feld → Auswahl/Sortierung → Export/Reimport → Redis-Ausfall/Worker-Replay → anonymer Zugriff → B. RSA/HTTP/PostgreSQL echt; Provider und Ausfall simuliert. |
| Tatsächlicher lokaler WebSocket | Signierte HTTP-Sitzung → Redis-Einmal-Ticket → Uvicorn/TCP → private A/B-Kanäle; Wiederverwendung HTTP 403. Bestanden. Keine echte Clerk-Anmeldung. |
| Zusatzfälle Pagination/Retry/Readiness | 19 gezielte Tests bestanden: Feldsortierung über alle Seiten in beiden Richtungen, paralleler expliziter Retry, echte DB/Redis/Dispatcher-Readiness sowie bisherige Grenzen/Retention. |
| Migration auf neuer leerer Testdatenbank | `bookmarks_final_transport_test`: komplette Kette und Upgrade synthetischer Altdaten erfolgreich. Kein ORM-only-Nachweis. |
| Workerstart | `arq app.workers.settings.WorkerSettings --burst` auf eigens migriertem `bookmarks_final_20261110_0434_test`, Redis-DB 2: erfolgreich, 18 Funktionen/Cronjobs; keine Providerarbeit. |
| Operator-CLI | `scripts/outbox_status.py` auf derselben synthetischen DB: erfolgreich, leere Diagnose, ohne Mutationsflags. |
| API-Drift | `scripts/check_api_client.py`: eigener laufender Test-Backend-Prozess, 249 erzeugte Dateien stimmen byteweise überein. Neuer Client aus Orval, keine manuellen Änderungen. |
| Pagination-Messung | Je 3 Backend-/Frontendfälle bestanden; Rohdaten und Grenzen unter [pagination/](pagination/README.md). |

Backend-Reproduktion (`backend/`):

```sh
export TEST_DATABASE_URL=postgresql+asyncpg://test:test@localhost:55438/bookmarks_test
export TEST_REDIS_URL=redis://localhost:56388/3
export REDIS_URL=redis://localhost:56388/0
.venv/bin/python -m pytest -q -rs --tb=short
.venv/bin/ruff check app tests
.venv/bin/mypy app
.venv/bin/python scripts/check_api_client.py
```

Der lokale Compose-Dienst hat `SHOW ssl = off`. Nur für Loopback/Port 55438 mit
`_test`-Datenbank wird SSL-Negotiation explizit ausgeschaltet; Anwendung und entfernte
Datenbanken erhalten keine solche Überschreibung. Test-URL-Prüfung bleibt davor
obligatorisch. Der genaue frühere einmalige Verbindungsabbruch wird dadurch nicht
rückwirkend als vollständig erklärte Ursache behauptet.

## Nachweisarten und verbleibende Grenzen

**Echt lokal:** PostgreSQL-Transaktionen/Constraints/Locks, parallele Imports,
Redis/ARQ-Transport, RSA-Signaturen/JWKS-Parser, ASGI-Routen, tatsächlicher TCP-
WebSocket, Readiness, Alembic, Workerstart, Compiler/Linter/Tests und Messwerte.
**Simuliert:** Clerk-Sitzungszustand im Frontend, signierte synthetische Clerk-
Subjects, YouTube-/Gemini-/Groq-Antworten und injizierter Redis-Ausfall. UI-Tests
laufen in jsdom; die Renderdaten messen keine Browser-Paint-Zeit.

Es wurden 21 frühere Skips durch ausgeführte Prüfungen abgedeckt (11 Abo-Worker,
7 Feldunion, 1 kombinierte Sortierung, 1 Socket-Authentifizierung,
1 lokale Transcript-Validierung). Zehn vorher bestehende
Skips bleiben ausdrücklich sichtbar: zwei echte Gemini-Clienttests und fünf
Provider-Integrationstests ohne `GEMINI_API_KEY`; drei Tests für einen bislang
nicht implementierten direkten Legacy-Gemini-Extraktionspfad im Video-Worker.
Letztere sind keine durch fehlende Secrets erklärte Implementierung. Eine neue
Extraktionsfunktion liegt gemäß Planabschnitt 5 außerhalb der Stabilisierung;
sie wird nicht als bereits vorhandene Produktfunktion ausgegeben.

Folgende reale Abnahmen sind **nicht erledigt**:

1. Bestehende Clerk-Anwendung im Browser: Login, Ablauf/Refresh, Logout, A→B,
   Cache-/Store-/Socket-Trennung und Wiederverbindung. Erforderlich sind
   `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_ISSUER`, exakte
   `CLERK_AUTHORIZED_PARTIES` und gegebenenfalls die tatsächlich konfigurierte
   Audience sowie zwei verwendbare Testidentitäten. Die private Secret-Anfrage
   lief ohne Eingabe ab. Kein Clerk Secret Key ist für JWKS-Verifikation nötig.
2. Echte YouTube-/Gemini-/Groq-/Hub-Antworten mit vorhandenen privaten Keys und
   bestehender erreichbarer Callback-Konfiguration. Es wurde keine kostenpflichtige
   Ressource eingerichtet. Eine durchgehende echte Browser-/Providerreise bleibt offen.
3. Gehosteter CI-Lauf: Workflow lokal implementiert, kein Push/Deployment ausgelöst.

Die offizielle [Clerk-Tokenprüfung](https://clerk.com/docs/guides/sessions/manual-jwt-verification),
[Session-Claims](https://clerk.com/docs/guides/sessions/session-tokens) und
[React-Einrichtung](https://clerk.com/docs/react/getting-started/quickstart) wurden geprüft.
Tokens/Secrets wurden nicht in Chat, Git oder localStorage übernommen.

Bekannte verbleibende [Dependency-Risiken](dependency-bewertung.md) sind separat
bewertet; grüne Verhaltenstests sind keine Security-Freigabe. Ein externer Provider
kann ohne Idempotenz nach Antwort plus lokalem Absturz erneut aufgerufen werden.
Weitere Betriebsgrenzen: [Auth](../AUTH_SETUP.md), [Queue](../QUEUE_OPERATIONS.md),
[Routeninventar](../security/routeninventar.md), [Architektur](../ARCHITECTURE.md).

## Historische Arbeitsstände

Die folgenden Einträge bewahren rote Läufe und Zwischenstände. Sie ersetzen nicht
die aktuelle Matrix und Prüfungen oben.

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

## Fortsetzung am 10.11.2026 – laufende Implementierung

Der vollständige Auftrag bleibt aktiv; dies ist ein Zwischenprotokoll.

- `ddeaa1a`: SQLAlchemy-Beziehungen, Python-UUID-Typen und Timestamp-Vererbung
  korrigiert; 37 Modell-/Feldwerttests bestanden. Mypy von 232 auf 205 Fehler
  in 41 Dateien reduziert, ohne Regelabschwächung.
- `7c3bb73`, `3cad882`, `0a7bfbe`: Frontend-Lintfehler bearbeitet,
  Kategorie-/Einstellungsfehler mit Retry sichtbar gemacht, Sortierköpfe
  zugänglich und Test-Mocks dem aktuellen UI-Vertrag angepasst.
  Neun betroffene Dateien: 95 Tests bestanden.
- `ed16b7a`: Query-Cache-Array beim Feldsortieren nicht mehr mutiert;
  Rich Text sanitisiert, abgeschnittener Inhalt als Text gerendert;
  Editor als Textbox zugänglich. Neue Regressionen zunächst rot,
  anschließend fünf betroffene Dateien mit 88 Tests grün.
- `8b1c32a`: Aktuellen Player-/Informationsdialog-Vertrag statt überholter
  Thumbnail-/Collapsible-Annahmen getestet: 32 Tests bestanden.
- `bd9b37c`, `91c8e7e`, `96e895f`: Eindeutige Schemafeldauswahl mit
  Abwahl/Entfernung, keine verschachtelten Formulare, sichtbare wiederholbare
  Feldanlagefehler und keine verlorene Schemaauswahl während Options-Refresh.
  Durchgängiger Kategorien-/Schema-/Feldablauf mit echtem Frontendtransport
  gegen MSW geprüft; keine echte Provider-/Browserabnahme.
- `4ffe443`: Gemeinsame Video-Query-Schlüssel einschließlich Detailansichten,
  Optimismus auf Listencaches begrenzt, abhängige Details bei Schema-/Feldänderung
  invalidiert. Neue Detailobjekt-Regression zuerst rot, danach 68 gezielte Tests
  bestanden. Produktionsbuild erneut erfolgreich.

Gesamtlauf Frontend: 1.288 bestanden, ein Fehler im während des Laufs neu
hinzugekommenen Cache-Regressionstest; dieser ist danach gezielt behoben und
verifiziert. Daher noch kein abschließender vollständiger grüner Lauf auf
stabilem Head. Lint aktuell ohne Fehler (156 bestehende Warnungen), Regeln
unverändert. AP 2: bekannte Fehlergruppen bearbeitet, stabile Gesamtprüfung
noch ausstehend. AP 5: Detail-/Schema-/Feldinvalidierung ergänzt; die spätere
Pagination muss die Cacheverträge erneut absichern. AP 3/6–11 bleiben gemäß
obiger Matrix weiter in Arbeit.

### Fortsetzung: Authentifizierung, Echtzeit und Ausfallfenster

- `9cbb968`: History und Live-Zustellung teilen dieselbe Event-ID; Zähler,
  History und Sendeabsicht liegen in einer Transaktion. Individuelle Videojobs
  schließen nun ihren Elternjob mit ab. Finale DB-Änderung und Outbox-Bestätigung
  werden gemeinsam committet. 26 gezielte Backendtests inklusive realem Redis/ARQ,
  paralleler Fortschrittsupdates und Rollback; 28 WebSocket-/Recoverytests bestanden.
- `624e5cf`, `27607dd`: Clerk-Signaturen/JWKS/Rotation, Issuer/exp/nbf/iat/azp/aud,
  parallele lokale Identitätsanlage und obligatorischer HTTP-Benutzerscope.
  Signierte synthetische A/B-Matrix über alle fachlichen Routen und Fremd-ID-Pfade
  bestanden. Keine Identität aus Client-`user_id`, kein erster Benutzer als Fallback.
  Gezielt 47 von 48 älteren/neu ergänzten Tests bestanden; der letzte Unterschied
  im vereinheitlichten 404-Fehlertext wurde danach einzeln grün geprüft.
- `237a0e1`: Einmal-Tickets statt Legacy-JWT/Default-Benutzer am WebSocket,
  Hashspeicherung/TTL/atomisches GETDEL auf echter isolierter Redis-Instanz.
  Ticketredaktion und Abbruch blockierter Listener geprüft.
- `61325f9`: Vorhandenes Clerk-React-SDK lokal installiert, private Oberfläche
  gegated, aktuelles Token zentral im Transport, einmalige Erneuerung nach 401,
  Abbruch/Generationsprüfung und neuer Cache pro Sitzung. 36 gezielte Tests und
  Produktionsbuild bestanden. Clerk-Zustand in Frontendtests simuliert.
- `a113bba`: Signierte und begrenzte WebSub-Zustellung mit permanenten
  Replay-Digests und atomarer Outbox. Hub-Abgleich nach Commit, gemeinsame Kanäle
  werden bei verbleibenden Abonnenten nicht abgemeldet. 68 gezielte Tests bestanden,
  11 bereits zuvor vorhandene Worker-Skips; zusätzlicher Shared-Channel-Test grün.
  Keine neuen Skips. Replay-Rollback und parallele identische Zustellungen geprüft.
- `0914e97`: Explizites Legacy-Transfer-Skript mit Dry-Run, Backup-Anforderung
  und wiederholbarem synthetischem Transfer (2 Tests). Migrationskette auf neuem
  `bookmarks_auth_migration_test` inklusive synthetischer Altdaten erfolgreich.
- `9d15ddf`: 12 Outbox-Tests einschließlich Absturz nach Enqueue, konkurrierender
  Dispatcher und Abbruch zwischen Providerantwort und finalem Commit bestanden.
  **Begrenzung:** Ein externer Provider ohne Idempotenz kann nach solchem Abbruch
  erneut aufgerufen werden. Der Test zeigt absichtlich zwei simulierte Antworten,
  aber nur einen final persistierten Datensatz. Keine Exactly-once-Providerzusage.

AP 7/8 sind lokal implementiert; zusätzliche Gesamt-/Integrationsprüfung und echte
Clerk-/Hub-Abnahmen stehen aus. Details und Betriebsgrenzen:
`documentation/AUTH_SETUP.md`, `documentation/security/routeninventar.md`.
AP 6: zusätzliche Ausfallfälle jetzt geprüft; Sichtbarkeit/Retention und verbleibende
Recovery-Fälle werden noch vervollständigt. AP 9/10/11 bleiben in Arbeit.

## Abschließende Selbstprüfung und Commit-Nachweis

Die zuletzt aufgedeckten Fehler wurden nicht durch tolerantere Fixtures verdeckt:
`6ecd3de` erzwingt einen sauberen Rollback; dadurch aufgedeckte Modellkorruption
wird in `3de1a22` tatsächlich behoben. `9b7a2a0` serialisiert Erstanmeldungen,
ohne Konten anhand der Platzhalter-E-Mail zu verbinden. Danach: vollständige Suite
1.001/10, strenges mypy über 125 Dateien und Ruff grün. Die API-Driftprüfung blieb
auch nach der DTO-Trennung unverändert grün. Die alten roten Läufe bleiben oben
als solche dokumentiert.

Selbstreview entsprechend dem ausdrücklichen Subagent-Verbot: Diff-/Whitespace-
Prüfung, lokale Dokumentationslinks, Enqueue-Inventar (einzige direkte fachliche
ARQ-Übergabe im Dispatcher), Commit-Abstammung und Betriebsanleitungen geprüft.
Keine unabhängige Review- oder gehostete CI-Abnahme behauptet. Der private Clerk-
Konfigurationskanal endete mit `timed_out`; keine lokale Aufgabe wurde deshalb
vorzeitig beendet. Zusätzlich nötige reale Eingaben/Nachweise stehen oben.

Alle 33 Ausgangscommits bis `73eb20e401553d9c9ea628ceeb28553d52c25921` sind erhalten.
Folgende 50 Fortsetzungscommits liegen danach; der abschließende Protokollcommit
ist zusätzlich über den Repository-Head nachvollziehbar:

- `ddeaa1a` fix: type model relationships and timestamp inheritance correctly
- `7c3bb73` fix: resolve frontend lint errors without weakening rules
- `3cad882` fix: cover category actions and recoverable settings errors
- `0a7bfbe` fix: expose sorting controls and align interaction test fixtures
- `ed16b7a` fix: preserve field cache order and sanitize rich text output
- `8b1c32a` test: verify player and information dialog detail flows
- `bd9b37c` fix: reconcile schema field selection and enable removal
- `91c8e7e` test: verify animated import progress and category table contract
- `96e895f` fix: preserve new schema selection and recover field creation failures
- `4ffe443` fix: unify video detail keys and invalidate dependent field views
- `7603bbb` docs: record frontend repairs and remaining stabilization acceptance
- `9cbb968` fix: persist progress delivery and acknowledge parent work atomically
- `624e5cf` feat: verify Clerk signatures and map external identities explicitly
- `27607dd` feat: protect business routes and enforce user ownership in queries
- `237a0e1` feat: authenticate realtime connections with single-use tickets
- `61325f9` feat: gate app sessions and isolate tokens caches and realtime state
- `a113bba` feat: verify WebSub deliveries and persist replay-safe channel intents
- `0914e97` feat: add explicit dry-run legacy ownership administration
- `9d15ddf` test: cover dispatcher crashes and worker acknowledgement failure windows
- `5c6e9e7` docs: record local identity isolation and durable progress proofs
- `a4b4e8d` fix: persist subscription imports and exercise formerly skipped worker cases
- `c9214f0` fix: retain ownership criteria when ORM state expires
- `f5d8a18` refactor: split video routes and extract metadata jobs and queries
- `01fc3c1` refactor: separate video hooks and share one progress connection
- `f2e73ff` feat: paginate collection queries with stable ordering and totals
- `87336df` feat: browse server pages and reconcile totals after filter and deletion
- `b20758d` fix: bound import polling and detect duplicates beyond the current page
- `fff1ff3` feat: export every matching video with the shared selection contract
- `f083344` refactor: move video creation and CSV orchestration behind transaction-owned services
- `62cb7d0` refactor: separate video table and field editing from page coordination
- `23842fa` refactor: remove unreachable settings flows and their redundant queries
- `e7b0119` refactor: extract video filters recovery display and import controller
- `e0f2e41` fix: enforce strict backend contracts and validate provider cache responses
- `8100d24` feat: expose durable operation recovery retention and dependency readiness
- `df1248b` fix: adapt ownership criteria to aliased field queries
- `975b863` test: enforce hidden-resource and atomic progress failure contracts
- `25f4105` test: activate field regressions and verify real socket user isolation
- `db503c8` fix: reject stale responses after token-refresh user changes
- `ca3e05c` test: verify page cancellation and refresh field-dependent statistics
- `a09e0a6` ci: regenerate API clients and reject drift against a running test backend
- `12a7a70` test: assert a single progress connection shared by consumers
- `e869e5b` chore: retire unused legacy JWT configuration validation
- `21cfe96` chore: update exposed transport editor sanitizer and token dependencies
- `1c905b3` test: verify signed acceptance flow recovery and stable field pagination
- `207b7ca` test: validate empty transcripts without requiring provider secrets
- `6ecd3de` fix: stabilize local test transport and roll back failed fixture transactions
- `3de1a22` fix: keep response DTOs separate from instrumented ORM relationships
- `9b7a2a0` fix: serialize first identity creation across both unique indexes
- `d96fe6f` docs: describe verified setup ownership boundaries and dependency limits
- `db7a29b` docs: record bounded pagination measurements and their limits
