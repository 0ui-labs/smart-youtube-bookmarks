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
