# Codebase-Stabilisierung Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Einen reproduzierbar prüfbaren, datenintegren und vor öffentlicher Freigabe benutzerisolierten Stand herstellen und die Wartbarkeit sowie das Verhalten bei großen Sammlungen verbessern.

**Architecture:** React, FastAPI, PostgreSQL, Redis und ARQ bleiben erhalten. Korrektheitsfehler werden zunächst separat behoben; danach werden Transaktionsgrenzen, Benutzerzugriff und große Datenmengen systematisch abgesichert. Eine PostgreSQL-Outbox koppelt fachliche Änderungen an Hintergrundaufträge; kleine Services und Hooks trennen anschließend die heute vermischten Verantwortlichkeiten.

**Tech Stack:** Bestehender React-/TypeScript-/TanStack-Query-Stack, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Redis, ARQ, Vitest und pytest; Clerk als Arbeitshypothese gemäß vorhandenem Auth-Konzept.

---

## 1. Geltung und Ausgangslage

Dieser Plan ist ausschließlich ein Planungsartefakt. Seine Erstellung autorisiert weder Implementierung noch Installation, Migration, Provider-Einrichtung oder Veröffentlichung.

Untersuchter Git-Stand: `2f5b6e9` auf `fix/grid-field-updates-from-modal`, einschließlich der damals vorhandenen lokalen Änderungen. Vor Umsetzung muss der aktuelle Stand erneut geprüft werden. Die vorhandenen Änderungen an `VideoPlayer.tsx`, `VideosPage.tsx`, `useTags.ts` und dessen Tests gehören nicht automatisch zu diesem Auftrag und dürfen weder verworfen noch ungeprüft übernommen werden.

Die Review-Befunde haben unterschiedliche Evidenz:

- **Ausgeführt:** Der Frontend-Build scheitert mit TypeScript-Fehlern in `ChannelsPage.tsx`.
- **Ausgeführt:** Ein begrenzter Testlauf über WebSocket-, Tag- und QueryClient-Tests ergibt 26 bestandene und 10 fehlgeschlagene Tests.
- **Ausgeführt:** Der vollständige Frontend-Testlauf zeigt mehrere Fehler und bricht anschließend mit einer nativen libuv-Assertion ab. Es gibt daraus kein vollständiges Testergebnis.
- **Nicht ausgeführt:** Backend-Tests; die vorhandene `.venv` verweist auf einen nicht vorhandenen Python-3.11-Interpreter.
- **Statisch festgestellt:** Fehlende HTTP-Zugriffskontrolle, problematischer CSV-Rollback-Pfad, unerreichbarer Reconnect-History-Zweig, ungefilterte Cache-Erweiterung sowie nicht atomare DB-/Queue-Übergaben.
- **Strukturell festgestellt:** Sehr große API-/UI-Dateien und fehlende serverseitige Begrenzung im regulären Listen-Videoabruf. Es liegt noch keine Lastmessung vor.

Es wird kein Neubau und kein pauschales Dependency-Upgrade geplant. Funktionierende Datenbank-Constraints, Indizes, Batch-Abfragen, Provider-Abstraktionen und Recovery-Mechanismen sollen erhalten bleiben.

## 2. Vollständige Zuordnung der Review-Punkte

| Review-Punkt | Arbeitspaket | Nachweis |
| --- | --- | --- |
| Fehlender HTTP-Benutzerschutz | AP 7–8 | Zwei-Benutzer-Zugriffstests und echte Login-Abnahme |
| Frontend-Build nicht erfolgreich | AP 2 | Erfolgreicher Produktionsbuild mit unveränderten strengen TS-Regeln |
| CSV-Duplikate rollen andere Inserts zurück | AP 4 | PostgreSQL-Tests mit neuen und bestehenden Videos in wechselnder Reihenfolge |
| Reconnect lädt History nicht nach | AP 3 | Simulierter Abbruch plus Wiederverbindung mit verpassten Events |
| Neues Video erscheint in falschen Filtern/Sortierung | AP 5 | Aktive und inaktive Query-Caches, Tagfilter und Sortierung |
| DB-/Queue-Übergabe nicht zuverlässig | AP 6 | Ausfälle an jeder Übergabestelle, Wiederholung und Wiederanlauf |
| Große Dateien und vermischte Zuständigkeiten | AP 9 | Kleine, verhaltensbewahrende Extraktionen mit Regressionstests |
| Vollständiges Laden großer Sammlungen | AP 10 | Begrenzte API-Antworten, vollständige Navigation und dokumentierte Messung |
| Unzuverlässige Tests und lokale Umgebung | AP 1–2, 11 | Reproduzierbares Setup und verpflichtende CI-Prüfungen |
| Dokumentation stimmt teilweise nicht mit Implementierung überein | AP 11 | Frisch nachvollzogene Start-, Worker-, Test- und Auth-Anleitung |

## 3. Arbeitsregeln für die spätere Umsetzung

1. Zu Beginn `pwd`, `git status --short --branch` und `git rev-parse HEAD` prüfen. Bereits gestagte Änderungen gesondert berücksichtigen.
2. Bestehende Arbeit nicht stashen, zurücksetzen oder in eigene Commits mischen. Implementierung auf einer passenden Arbeitsbranch beginnen, sobald die Basis geklärt ist.
3. Pro Fehler zuerst einen gezielten Verhaltenstest hinzufügen oder korrigieren, den Fehler nachweisen, minimal beheben und den passenden Test ausführen.
4. Pro unabhängig prüfbarem Schritt einen granularen Commit erstellen. Nur ausdrücklich benannte Dateien stagen.
5. Keine Tests überspringen oder Typregeln abschalten, um einen grünen Status zu erzeugen. Überholte Tests anhand des beabsichtigten Verhaltens überarbeiten.
6. Datenbanktests und Migrationen ausschließlich gegen eine ausdrücklich konfigurierte, separate Testdatenbank ausführen. Schutzprüfung gegen die normale Anwendungsdatenbank ergänzen, bevor destruktive Fixtures laufen.
7. Reale Provider-Aufrufe und Browser-Abnahme getrennt von lokalen Mocks dokumentieren. Fehlende reale Nachweise bleiben sichtbar.

## 4. Reihenfolge und Abhängigkeiten

`AP 1 → AP 2 → AP 3 → AP 4 → AP 5 → AP 6 → AP 7 → AP 8 → AP 9 → AP 10 → AP 11`

AP 3–5 sind fachlich unabhängig, werden aber einzeln fertiggestellt und committet. AP 7–8 können vorgezogen werden, falls eine öffentliche Nutzung unmittelbar bevorsteht. Öffentliche Freigabe bleibt bis zum Abschluss von AP 7–8 und der Gesamtverifikation gesperrt.

## AP 1: Sichere, reproduzierbare Prüfungsumgebung

**Dateien:** `backend/requirements.txt`, `backend/pyproject.toml`, `backend/tests/conftest.py`, `backend/tests/integration/conftest.py`, `frontend/package.json`, beide vorhandenen npm-Lockfiles, `docker-compose.yml`, `documentation/TOOLING_SETUP.md`.

**Schritte:**

1. Unterstützte Python- und Node-Version anhand der tatsächlichen Abhängigkeiten festhalten. Den defekten Interpreter-Link durch eine frisch erstellbare Umgebung ersetzen; zunächst die im Projekt vorgesehene Python-3.11-Basis prüfen.
2. npm-Workspace-Auflösung prüfen und dokumentieren, welches Lockfile für Installation und CI maßgeblich ist. Erst danach doppelte Zuständigkeiten bereinigen.
3. Einen eigenen Test-DB-URL-Parameter einführen. Vor `create_all`, `drop_all` und `TRUNCATE` sicherstellen, dass das Ziel eine explizite Testdatenbank und nicht die Anwendungsdatenbank ist.
4. PostgreSQL 16 und Redis 7 für Tests reproduzierbar bereitstellen; normale Anwendungsvolumes unberührt lassen.
5. Baseline für Build, Frontend-Tests, Backend-Tests und Linting protokollieren: Befehl, Laufzeitversionen, Ergebnis und vollständige Fehlergruppen.
6. Den nativen Frontend-Testabbruch separat untersuchen: Standardlauf mit einem einzelnen Worker und einem kompatiblen alternativen Pool vergleichen. Node-/Vitest-/jsdom-Kompatibilität eingrenzen, bevor Abhängigkeiten gezielt geändert werden.

**Verifikation:** Frisch angelegte Umgebung importiert das Backend und sammelt Tests; ein absichtlich auf die Anwendungsdatenbank zeigender Test-DB-Parameter wird vor jedem destruktiven Zugriff abgelehnt. Ein vollständiger Frontend-Lauf endet mit einem regulären Ergebnis, auch wenn zunächst noch Tests fehlschlagen.

**Commits:** `chore: make local test setup reproducible`, `test: guard database fixtures against application data`.

## AP 2: Build und Testverträge stabilisieren

**Dateien:** `frontend/src/pages/ChannelsPage.tsx`, `frontend/src/hooks/useWebSocket.test.ts`, `frontend/src/test/setup.ts`, `frontend/src/test/mocks/`, betroffene bestehende Komponenten-/Seitentests; gezielt neue `frontend/src/pages/ChannelsPage.test.tsx`.

**Schritte:**

1. Leere Buchstabenlisten und Zugriffe außerhalb der Array-Grenzen in der Kanalnavigation testen.
2. Die undefinierten Werte explizit behandeln. `strict` und `noUncheckedIndexedAccess` beibehalten; keine pauschalen Non-null-Assertions als Reparatur.
3. Den vollständigen Testlauf nach Fehlerursache gruppieren: Produktfehler, überholter Testvertrag, unvollständiger Mock, fehlender Provider und Runtime-Problem.
4. Unbehandelte API-Aufrufe in Tests durch passende MSW-Handler ersetzen. Unbeabsichtigte Netzwerkanfragen sollen Tests fehlschlagen lassen; beabsichtigte Ausnahmen explizit definieren.
5. Gemeinsame Router-/QueryClient-/Store-Testwrapper und Aufräumverhalten vereinheitlichen. Keine über Tests hinweg geteilten Query-Caches oder lokalen Benutzerdaten.
6. Veraltete WebSocket-Annahmen mit AP 3 abgleichen. Entwicklungsmodus ohne Token und späterer authentifizierter Betrieb brauchen explizit verschiedene Erwartungen.
7. Alle übrigen Produktfehler aus dem vollständigen Baseline-Lauf in kleine Reparaturen aufteilen; Änderungen an Test-Erwartungen jeweils fachlich begründen.

**Verifikation:** `cd frontend && npm run build`; `npm test -- --run` muss nach Bearbeitung aller Fehler regulär und erfolgreich enden. Ein gezielter Kontrolllauf bleibt verfügbar: `npm test -- --run src/hooks/useWebSocket.test.ts src/hooks/__tests__/useTags.test.tsx src/lib/queryClient.test.ts --pool=forks --maxWorkers=1 --minWorkers=1`.

**Commits:** `fix: handle empty channel navigation safely`, danach getrennte Commits je Test-/Produktfehlergruppe.

## AP 3: WebSocket-Reconnect und History zuverlässig machen

**Dateien:** `frontend/src/hooks/useWebSocket.ts`, `frontend/src/hooks/useWebSocket.test.ts`, `frontend/src/stores/importProgressStore.ts`, `backend/app/api/websocket.py`, `backend/app/api/processing.py`, `backend/tests/api/test_websocket.py`, `backend/tests/integration/test_progress_flow.py`.

**Schritte:**

1. Testsequenz abbilden: verbunden → Job beobachten → Abbruch → Events während Abbruch → erneute Verbindung → History abrufen.
2. Den Reconnect-Zustand vor dem Zurücksetzen erfassen. History erst nach erfolgreicher Authentifizierung abrufen und bei fehlgeschlagenem Abruf einen sichtbaren, erneut versuchbaren Fehlerzustand erhalten.
3. History und gleichzeitig eintreffende Live-Events anhand stabiler Event-Identität/-Reihenfolge zusammenführen. Alte Events dürfen einen neueren oder abgeschlossenen Status nicht zurücksetzen.
4. Erstverbindung, absichtliches Schließen, ungültige Authentifizierung, erneuten Abbruch während History-Abruf und mehrere überwachte Jobs testen.
5. WebSocket-Adresse aus dem aktuellen Origin samt `ws`/`wss` ableiten; explizite `VITE_WS_URL` bleibt möglich. Lokalen Proxy und produktives Routing entsprechend dokumentieren.

**Abnahme:** Nach Wiederverbindung entspricht der sichtbare Fortschritt dem persistierten Stand, ohne Doppelzählung und ohne Rücksprung. Eine neue Verbindung ohne vorherigen Abbruch startet keinen unnötigen Recovery-Abruf. Benutzerbezogene History-Zugriffe werden zusätzlich in AP 7 abgesichert.

**Commit:** `fix: recover missed progress after websocket reconnect`.

## AP 4: CSV-Duplikate ohne Verlust anderer Zeilen behandeln

**Dateien:** `backend/app/api/videos.py`, `backend/tests/api/test_csv_field_import_export.py`, `backend/tests/integration/test_csv_roundtrip.py`, neue `backend/tests/integration/test_csv_duplicate_transactions.py`.

**Schritte:**

1. PostgreSQL-Regressionstest für die Reihenfolge `neu A → bestehend B → neu C` ergänzen; außerdem Duplikate am Anfang, am Ende und innerhalb derselben Datei prüfen.
2. Den globalen Rollback innerhalb der Zeilenschleife entfernen. Bevorzugt gezieltes `INSERT ... ON CONFLICT DO NOTHING ... RETURNING` für den tatsächlichen Listen-/YouTube-Eindeutigkeitsschlüssel verwenden und bestehende Videos anschließend gezielt laden.
3. Nur den erwarteten Duplikatkonflikt abfangen; andere Integritätsfehler dürfen nicht als „bereits vorhanden“ verschwinden.
4. `created_count`, `created_video_ids`, Fehler und Feldwert-Aktualisierungen aus tatsächlich gespeicherten Datensätzen ableiten. Verhalten für mehrfach vorkommende Feldwerte explizit festlegen und testen: letzte gültige CSV-Zeile gewinnt.
5. Parallelimporte desselben Videos testen. Bereits existierende Video-Feldwerte nur gemäß bestehendem Importvertrag aktualisieren; keine unbeabsichtigten Löschungen.

**Abnahme:** Beide neuen Videos bleiben gespeichert, das bestehende Video bleibt eindeutig, alle Rückgabewerte stimmen mit der Datenbank überein und CSV-Export/Reimport bleibt funktionsfähig.

**Commit:** `fix: preserve successful csv rows when duplicates occur`.

## AP 5: Query-Cache nach Änderungen konsistent halten

**Dateien:** `frontend/src/hooks/useVideos.ts`, `frontend/src/hooks/useVideosFilter.ts`, `frontend/src/hooks/useCustomFields.ts`, `frontend/src/hooks/useSchemas.ts`, `frontend/src/hooks/useTags.ts`, zugehörige Hook-Tests und `frontend/src/components/VideosPage.integration.test.tsx`.

**Schritte:**

1. Einen QueryClient mit ungefiltertem Cache, zwei unterschiedlichen Tagfiltern und auf-/absteigender Sortierung vorbereiten.
2. Das pauschale Anhängen neuer Videos an alle Varianten entfernen. Abgeleitete Listen gezielt invalidieren und vom Server neu berechnen lassen, statt Filter- und Sortierlogik im Client zu duplizieren.
3. Rückmeldung nach erfolgreichem Erstellen sofort anzeigen; vorhandene Listen während des Refetch erhalten. Ein unmittelbares Einfügen nur dort zulassen, wo die Zugehörigkeit und Position eindeutig sind.
4. Query-Key-Factories für betroffene Video-, Detail- und Feldwertabfragen vereinheitlichen. Die parallelen manuellen und generierten API-Hooks hinsichtlich Response-Form und Cache-Verwendung abgleichen.
5. Modaländerung → Grid, Tag-/Schemaänderung → verfügbare Felder sowie Löschung → Liste/Details/Statistik als zusammenhängende Regressionen prüfen. Vorhandene lokale Tag-Fixes erst nach aktuellem Vergleich integrieren.

**Abnahme:** Kein Video erscheint allein wegen eines Create-Ereignisses unter einem falschen Filter. Sortierungen stimmen nach der Mutation; Feldänderungen werden ohne Seitenreload sichtbar. Inaktive Caches werden beim nächsten Öffnen korrekt geladen.

**Commit:** `fix: reconcile video caches after mutations`.

## AP 6: Dauerhafte Jobübergabe und idempotente Verarbeitung

**Dateien:** `backend/app/api/videos.py`, `backend/app/api/enrichment.py`, `backend/app/api/processing.py`, `backend/app/workers/video_processor.py`, `backend/app/workers/enrichment_worker.py`, `backend/app/workers/subscription_worker.py`, `backend/app/workers/settings.py`, `backend/app/services/enrichment/enrichment_service.py`; neu `backend/app/models/job_outbox.py`, `backend/app/services/job_dispatch_service.py`, `backend/app/workers/outbox_dispatcher.py`, Alembic-Migration und `backend/tests/integration/test_job_outbox.py`.

**Entscheidung:** PostgreSQL speichert fachliche Änderungen und Versandabsicht in derselben Transaktion. Ein Dispatcher überträgt nur committete Absichten an ARQ. Die Zustellung ist mindestens einmal; der Worker muss Wiederholungen vertragen. Ein erfolgreicher Redis-Aufruf ist keine atomare Transaktion mit PostgreSQL.

**Schritte:**

1. Alle fachlichen Enqueue-Stellen inventarisieren, einschließlich Import, manueller Verarbeitung, Retry, Abonnements und Recovery. Explizite Commit-Verantwortung festlegen; Services dürfen äußere Transaktionen nicht überraschend abschließen.
2. Outbox mit Auftragsart, Ziel-ID, Payload-Version, eindeutiger Operation-ID, Status, Versuchsanzahl, nächstem Versuch und Lease-Zeitpunkt modellieren. Keine Credentials in Payloads speichern.
3. Fachlichen Datensatz und Outbox-Eintrag gemeinsam speichern. Request-Erfolg bedeutet „dauerhaft angenommen“, nicht „bereits verarbeitet“.
4. Dispatcher mit begrenzten Batches, konkurrierenden Instanzen, ablaufender Lease und Backoff implementieren. Nach Absturz muss eine andere Instanz unvollständigen Versand übernehmen können.
5. Stabile ARQ-Job-ID aus der Operation-ID ableiten. Zusätzlich eine dauerhafte fachliche Claim-/Statusprüfung vor kostenpflichtigen Seiteneffekten vorsehen; Redis-Deduplizierung allein reicht wegen ihrer begrenzten Lebensdauer nicht aus.
6. Retry als neue, nachvollziehbare Operation behandeln. Gleichzeitige Retries und doppelte Recovery-Aufträge dürfen keine parallele Verarbeitung derselben Operation starten.
7. Vorhandene Recovery-Jobs auf das gemeinsame Verfahren umstellen. Verwaiste Pending-Zustände, abgebrochene Worker und endgültig gescheiterte Aufträge sichtbar machen; Aufbewahrung und Bereinigung erledigter Outbox-Einträge definieren.
8. Ausfälle gezielt injizieren: DB-Rollback, Redis nicht verfügbar, Absturz nach Enqueue vor Versandmarkierung, doppelter Dispatcher und Worker-Abbruch nach Provider-Antwort.

**Abnahme:** Kein Worker liest uncommittete Auftragsdaten. Kein dauerhaft angenommener Auftrag verschwindet nach Redis-Ausfall oder Prozessabsturz. Doppelte Zustellung startet keine parallele fachliche Verarbeitung. Wo ein externer Provider keine Idempotenz unterstützt, bleibt das mögliche Wiederholungsfenster nach einem Absturz ausdrücklich dokumentiert.

**Commits:** `feat: persist background job intents in postgres`, `feat: dispatch durable jobs with retry and leases`, `fix: make job handlers safe against duplicate delivery`.

## AP 7: HTTP-Authentifizierung und Datenisolation

**Dateien:** Bestehendes Konzept unter `features/clerk-auth-multitenancy/`; `backend/app/api/deps.py`, `backend/app/core/config.py`, `backend/app/models/user.py`, sämtliche fachlichen Router unter `backend/app/api/`, `backend/app/schemas/`, Alembic-Migration; neu `backend/app/core/clerk.py`, `backend/app/services/access_service.py`, `backend/tests/api/test_auth.py`, `backend/tests/integration/test_user_isolation.py`.

**Entscheidung:** Das vorhandene Clerk-Konzept ist Ausgangspunkt, keine bestätigte aktuelle Provider-Konfiguration. Vor Implementierung SDK und Tokenprüfung anhand aktueller offizieller Dokumentation verifizieren. Öffentlicher Betrieb darf keinen Auth-Bypass aktivieren. Bestehende Daten werden keinem zufälligen ersten Login zugeordnet.

**Schritte:**

1. Routeninventar mit Schutzbedarf erstellen: Listen, Videos, Tags, Felder, Schemas, Kanäle, Suche, Analytics, Jobs/History, Enrichment, Chat, Abonnements und Bulk-/Export-Endpunkte.
2. Einen gemeinsamen Benutzerresolver mit Signatur-, Algorithmus-, Issuer-, Ablaufzeit- und den für die gewählte Clerk-Konfiguration nötigen Audience-/Authorized-Party-Prüfungen einführen. JWKS-Cache und Schlüsselrotation testen.
3. Externe Clerk-ID eindeutig auf lokalen Benutzer abbilden. Gleichzeitige Erstanmeldungen sicher behandeln; Accounts nicht allein aufgrund einer übermittelten E-Mail-Adresse verbinden.
4. Eigentümerschaft in Datenbankabfragen erzwingen, bei Videos und Jobs über die zugehörige Liste. Zugehörigkeit von referenzierten Tags, Feldern, Schemas und Kanälen auch bei Schreiboperationen und Bulk-Requests prüfen.
5. Vom Client gelieferte `user_id` nicht mehr als Identität akzeptieren. Fehlende Anmeldung ergibt 401, fremde Ressourcen konsistent 404. Eine Manipulation fremder IDs darf keine Teiländerungen erzeugen.
6. Bestehende Daten über ein separates, wiederholbar prüfbares Administrationsskript mit expliziter Quell- und Zielidentität zuordnen; vorher Dry-Run und Backup verlangen. Kein automatischer Transfer an den ersten Benutzer.
7. Öffentliche Ausnahmen ausdrücklich begrenzen: Health-Check mit minimalen Daten und verifizierte Webhooks. WebSub-Absenderprüfung, erwartete Topics, Größenbegrenzung und Replay-/Duplikatbehandlung anhand der tatsächlichen Hub-Unterstützung umsetzen.

**Abnahme:** Eine Zwei-Benutzer-Testmatrix prüft jeden Endpunkt und jede referenzierte Fremd-ID. Benutzer A kann Daten von B weder lesen, verändern, löschen, exportieren noch deren Verarbeitung auslösen. Ein nicht authentifizierter Request kann keine kostenpflichtige Arbeit anstoßen.

**Commits:** `feat: verify user identity for api requests`, `fix: enforce ownership across api resources`, `feat: add explicit legacy data ownership migration`.

## AP 8: Anmeldung und benutzerbezogene Echtzeitverbindung im Frontend

**Dateien:** `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/lib/api.ts`, `frontend/src/lib/queryClient.ts`, `frontend/src/hooks/useWebSocket.ts`, `backend/app/api/websocket.py`, `backend/app/api/deps.py`, neue Login-/Logout-Komponenten und zugehörige Tests.

**Schritte:**

1. Clerk-Provider und geschützte App-Routen integrieren; fachliche Datenabfragen erst nach geklärtem Anmeldestatus aktivieren.
2. Aktuelles Token zentral an API-Aufrufe anhängen und Tokenablauf behandeln. Keine langlebigen Tokens manuell in `localStorage` speichern.
3. Für WebSockets einen klaren Auth-Vertrag festlegen: bevorzugt ein kurzlebiges, einmal nutzbares, serverseitig an den Benutzer gebundenes Verbindungsticket über einen authentifizierten HTTP-Endpunkt. Tickets im Logging redigieren und atomar verbrauchen.
4. WebSocket und History benutzen denselben Benutzerresolver; die Entwicklungsausnahme „erster Benutzer“ im geschützten Modus entfernen.
5. Bei Logout/Benutzerwechsel WebSocket schließen, Requests abbrechen und Query-Caches, Fortschrittsstores und benutzerbezogene persistierte UI-Daten löschen oder eindeutig partitionieren.
6. Provider-Einrichtung und reale Login-Abnahme erst mit expliziter Implementierungsfreigabe und vorhandener Konfiguration durchführen. Account-Löschung zunächst als definierter manueller Verwaltungsprozess dokumentieren; keine automatische Kaskadenlöschung ohne eigenen Produktentscheid.

**Abnahme:** Login, Refresh, Tokenablauf, Logout und Wechsel A → B funktionieren ohne Anzeige von A-Daten bei B. Fehlende, abgelaufene und wiederverwendete WebSocket-Tickets werden abgelehnt. Reconnect funktioniert weiterhin gemäß AP 3. Reale Browser-/Provider-Nachweise werden separat protokolliert.

**Commit:** `feat: protect app sessions and user progress connections`.

## AP 9: Große Dateien in fachliche Bausteine zerlegen

**Dateien:** `backend/app/api/videos.py`, `frontend/src/components/VideosPage.tsx`, `frontend/src/hooks/useVideos.ts`; neue Module unter `backend/app/api/video_routes/`, `backend/app/services/video_import_service.py`, `backend/app/services/video_query_service.py`, `frontend/src/components/videos/`, `frontend/src/hooks/videos/`.

**Schritte:**

1. Nach den Korrektheitsfixes Verhalten und API-Verträge durch Regressionen absichern.
2. Backend-Router entlang von Lesen/Filtern, Import/Export, Tags/Kategorien und Feldwerten aufteilen. Pfade, Statuscodes und Response-Modelle beibehalten.
3. Transaktionen und Importlogik aus HTTP-Handlern in Services verschieben; Abfrageaufbau in einen Query-Service. Authentifizierung bleibt am Zugriffspfad sichtbar und testbar.
4. Frontend in Toolbar/Filter, Darstellung, Auswahl/Aktionen und Dialogsteuerung aufteilen. Serverdaten im Query-Cache halten; lokale UI-Zustände nicht zusätzlich als Datenkopien pflegen.
5. Hooks für Abfragen und Mutationen trennen. Wiederholte Invalidierungsregeln zentralisieren; generierte API-Dateien unverändert aus dem Generator beziehen.
6. Historische Task-/MCP-Kommentare entfernen, sofern sie nur Entstehungsgeschichte wiederholen. Kommentare für fachliche Regeln, Transaktionsgrenzen und ungewöhnliche Entscheidungen erhalten.

**Abnahme:** Jede Extraktion ist separat testbar und verändert weder URLs noch Bedienabläufe. Keine neue generische Framework-Schicht. Die großen Dateien koordinieren ihre Bausteine, statt deren vollständige Implementierung zu enthalten.

**Commits:** Getrennt je Backend-Service/Router-Gruppe und je Frontend-Extraktion, beispielsweise `refactor: extract video import service` und `refactor: split video page controls and views`.

## AP 10: Große Sammlungen begrenzt laden und darstellen

**Dateien:** Nach AP 9 zuständige Video-Router/-Services, `backend/app/schemas/video.py`, `frontend/src/hooks/videos/`, `frontend/src/hooks/useVideosFilter.ts`, `frontend/src/components/videos/`, `frontend/src/components/VideoGrid.tsx`, generierte API-Clients, `backend/tests/performance/` und Frontend-Integrationstests.

**Schritte:**

1. Vorher-Messung mit reproduzierbaren synthetischen Sammlungen von 100, 1.000 und 10.000 Videos samt Tags/Feldwerten erstellen: SQL-Abfragen, Antwortgröße, API-Latenz und initial gerenderte Karten.
2. Einen paginierten Listenvertrag mit Standardgröße 50, Höchstgröße 100, stabiler Sortierung einschließlich ID als Tie-Breaker und Gesamtanzahl einführen. Zunächst offsetbasierte Seiten verwenden; Cursor erst bei nachgewiesenem Bedarf.
3. Filter, Suche, Sortierung und Zählung auf denselben serverseitigen Auswahlvertrag bringen. Zugehörige Felder/Tags nur für die aktuelle Seite batchweise laden. Regelmäßiges Polling ebenfalls begrenzen.
4. Frontend auf echte serverseitige Seiten umstellen; Seite bei Filteränderung zurücksetzen und beim Löschen des letzten Eintrags einer Seite korrigieren. Alte Abfragen bei schnellen Wechseln abbrechen.
5. „Alles auswählen“ klar definieren: zunächst aktuelle Seite; eine Aktion für alle Treffer benötigt eine eigene serverseitige Filteroperation. CSV-Export muss weiterhin alle passenden Treffer liefern und darf nicht versehentlich auf die aktuelle Seite schrumpfen.
6. API-Vertrag über eine additive Übergangsroute umstellen und alle Aufrufer migrieren. Den unbegrenzten Standardpfad nach Prüfung externer Aufrufer entfernen oder wirksam begrenzen.
7. Nachher-Messung unter denselben Bedingungen durchführen. Bei 10.000 Videos sind Antworten auf höchstens 100 Einträge begrenzt und ohne N+1-Zunahme. Zusätzliche Virtualisierung nur bei messbarem Renderingproblem ergänzen.

**Abnahme:** Alle Videos bleiben über Seiten erreichbar; Gleichstände erzeugen bei unverändertem Datenbestand keine Lücken/Duplikate. Filter und Sortierung gelten für die gesamte Sammlung. Gemessene Laufzeiten und Hardware werden dokumentiert; es werden keine unbelegten Performance-Zusagen gemacht.

**Commits:** `feat: paginate video queries on the server`, `feat: browse video collections with server pagination`.

## AP 11: CI, Dokumentation und abschließende Abnahme

**Dateien:** Neu `.github/workflows/ci.yml`; `README.md`, `documentation/ARCHITECTURE.md`, `documentation/TOOLING_SETUP.md`, `frontend/package.json`, Backend-Testkonfiguration, API-Generierungskonfiguration; neu `documentation/reports/codebase-stabilisierung-abnahme.md`.

**Schritte:**

1. CI mit festgelegten Runtime-Versionen sowie PostgreSQL-/Redis-Services einführen. Frontend-Build, vollständige Frontend- und Backend-Tests, relevante Linter und Migrationstest müssen Fehler zuverlässig melden.
2. Migrationen auf leerer Datenbank und auf einem synthetischen Datenbestand des bisherigen Schemas testen. ORM-`create_all` ersetzt keinen Alembic-Migrationsnachweis.
3. API-Client aus dem laufenden Test-Backend reproduzierbar generieren und Drift prüfen. Nicht mehr vorhandene README-Befehle wie `test:coverage` entweder korrekt ergänzen oder aus der Anleitung entfernen.
4. Backend-Typprüfung auswerten; fehlende Tool-Abhängigkeit und tatsächliche Fehler beheben, bevor sie als bestandene Prüfung dokumentiert wird. Keine pauschale Unterdrückung für das gesamte Projekt.
5. Worker-Startpfad prüfen: README nennt derzeit `app.workers.video_processor.WorkerSettings`; tatsächlich passende Konfiguration einschließlich Outbox-Dispatcher und Cronjobs dokumentieren und aus sauberem Setup nachweisen.
6. Auth-, Queue-, Recovery-, Pagination- und Betriebsdokumentation aktualisieren. Health/Readiness so trennen, dass „Prozess läuft“ nicht mit „DB/Queue arbeitsfähig“ verwechselt wird.
7. Gesamtabnahme durchführen: Login → Liste → einzelnes Video → CSV mit Duplikaten → Tag/Feld im Modal ändern → Filter/Sortierung → Verbindungsabbruch → Wiederverbindung → Export/Reimport → Redis-Ausfall/Wiederanlauf → Logout → anderer Benutzer.
8. Abschlussbericht mit Commit-IDs, Befehlen, Ergebnissen, realen gegenüber simulierten Nachweisen und verbleibenden Einschränkungen verfassen.

**Prüfbefehle nach eingerichtetem Setup:**

```bash
# Jeweils im angegebenen Verzeichnis ausführen.
# frontend/
npm run build
npm test -- --run
npm run lint

# backend/; ausschließlich mit eigener Testkonfiguration
.venv/bin/python -m pytest -q
.venv/bin/ruff check app tests
# Alembic-Migrationstests laufen ebenfalls nur auf separaten Testdatenbanken.
```

**Abnahme:** Ein frischer Checkout lässt sich anhand der Dokumentation starten und prüfen. Alle verpflichtenden Prüfungen sind erfolgreich; Tests sind nicht zur Erreichung dieses Zustands stillgelegt. Reale Login-/Provider-/Browser-Abnahme und lokale Ausfallsimulationen sind eindeutig unterscheidbar.

**Commits:** `ci: enforce build tests and migration checks`, `docs: document verified setup and stabilization acceptance`.

## 5. Entscheidungen und Grenzen vor der Umsetzung

- **Auth-Anbieter:** Clerk ist aufgrund des vorhandenen Konzepts die Planungsannahme. Falls ein anderer Anbieter bereits beschlossen oder eingerichtet wurde, AP 7–8 vor Implementierung entsprechend anpassen.
- **Altdaten:** Eigentümer explizit bestimmen; keine automatische Übernahme durch den ersten Login. Der tatsächliche Migrationslauf benötigt Quell-/Zielidentität und Backup.
- **Öffentliche Freigabe:** Kein Bestandteil dieses Plans und kein Nebeneffekt einer lokalen Abnahme.
- **Outbox:** Zusätzliche Komplexität ist gezielt auf die nachgewiesene DB-/Queue-Lücke begrenzt. Externe Provider lassen sich ohne deren Idempotenzunterstützung nicht pauschal auf „genau einmal“ garantieren.
- **Umfang:** Erst die Sicherheits- und Korrektheitsprobleme schließen, dann verhaltensbewahrend refaktorieren und datenbasiert skalieren. Neue Produktfunktionen bleiben außerhalb dieses Stabilisierungsvorhabens.

## 6. Definition of Done

- [ ] Reproduzierbare, abgesicherte Testumgebung und erfolgreicher Frontend-Build.
- [ ] Vollständige Testläufe enden regulär und erfolgreich; CI erzwingt die Prüfungen.
- [ ] CSV-Duplikate verlieren keine anderen Zeilen; Zähler stimmen mit gespeicherten Daten überein.
- [ ] Reconnect stellt verpasste Fortschritte wieder her.
- [ ] Filter-, Sortier-, Detail- und Feldwert-Caches bleiben nach Änderungen konsistent.
- [ ] Hintergrundaufträge werden dauerhaft angenommen, nach Ausfällen erneut zugestellt und idempotent verarbeitet.
- [ ] HTTP, WebSocket, History, Bulk-Aktionen und Exporte respektieren Benutzergrenzen.
- [ ] Benutzerwechsel hinterlässt keine fremden Daten im Browserzustand.
- [ ] Große Dateien sind entlang fachlicher Verantwortlichkeiten aufgeteilt.
- [ ] Große Sammlungen werden serverseitig begrenzt geladen; Messwerte und Exportverhalten sind dokumentiert.
- [ ] Migrationen, Startanleitung, Worker-Konfiguration und tatsächlicher Betriebszustand sind nachgewiesen.
- [ ] Granulare Commits und ein Abschlussbericht machen jede Änderung und ihren Nachweis nachvollziehbar.
