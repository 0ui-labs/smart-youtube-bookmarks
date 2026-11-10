# Pagination: Messaufbau und Ergebnisse

10.11.2026, Apple M1 Max, 32 GiB RAM, macOS 27.2 arm64. Python 3.11.15,
Node 22.22.3, PostgreSQL 16 und Redis 7 in separaten lokalen Testcontainern.
Synthetische Sammlungen mit 100/1.000/10.000 Videos, zwei Tags und einem
Bewertungsfeld/-wert pro Video; keine Provider- oder Anwendungsdaten.

Drei HTTP-Messungen pro Größe mit ASGITransport, echter PostgreSQL-Ausführung
und JSON-Serialisierung. Gezählt werden alle SQL-Statements während des Requests,
einschließlich der simulierten Principal-Auflösung in der Unit-Testfixture. Diese
Latenz enthält keinen Netzwerk-Roundtrip zum Browser und keine Clerk-Providerzeit.
Die Rohdaten enthalten alle drei Stichproben; keine universelle Leistungszusage.

Die Grid-Messung rendert die tatsächlichen Karten mit Tag und Bewertungsfeld
in Vitest/jsdom. Sie misst initial erzeugte DOM-Karten und JS-Renderdauer,
keine Browser-Paint-Zeit, Scroll-Flüssigkeit oder reale Endgerätegeschwindigkeit.

| Videos | SQL-Statements | Antwortbytes | API-Median ms | Initiale Karten |
| --- | --- | --- | --- | --- |
| 100 | 12 | 165001 | 43,33 | 100 |
| 1.000 | 12 | 1650001 | 210,10 | 1.000 |
| 10.000 | 12 | 16500001 | 2379,71 | 10.000 |

Die Baseline zeigt bereits konstante Query-Anzahl, aber unbegrenzte Antwortgröße
und DOM-Menge. Die Nachher-Messung verwendet denselben Aufbau und dieselbe Hardware.

```sh
# backend, mit expliziten isolierten TEST_DATABASE_URL/TEST_REDIS_URL/REDIS_URL:
SYB_BENCHMARK_PHASE=before SYB_BENCHMARK_OUTPUT=/tmp/api-before.json \
  .venv/bin/python -m pytest tests/performance/test_video_pagination_measurement.py -q -s
# frontend:
SYB_BENCHMARK_PHASE=before SYB_BENCHMARK_OUTPUT=/tmp/grid-before.json \
  npm test -- --run src/components/videos/VideoGrid.measurement.test.tsx
```

Die Baseline wurde auf `f5d8a18` gemessen. Nach wirksamer Begrenzung des
Legacy-Endpunkts reproduziert der alte Pfad absichtlich nicht mehr die volle
unbegrenzte Antwort; dafür den dokumentierten historischen Stand verwenden.

## Nachher-Messung

| Videos | Geliefert | SQL-Statements | Antwortbytes | API-Median ms | Initiale Karten | jsdom Render ms |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 50 | 13 | 82545 | 26.32 | 50 | 118.06 |
| 1.000 | 50 | 13 | 82546 | 26.2 | 50 | 80.68 |
| 10.000 | 50 | 13 | 82547 | 38.38 | 50 | 57.29 |

Die zusätzliche SQL-Abfrage zählt alle Treffer. Die Anzahl bleibt unabhängig von
der Sammlungsgröße konstant; Tags/Feldwerte werden nur für die aktuelle Seite
hydriert. Standard 50 und Obergrenze 100 werden zusätzlich funktional geprüft.
Die Latenzen sind kleine lokale Stichproben, kein SLA. Die Baseline renderte bei
10.000 Videos 10.000 Karten (17.244,99 ms in jsdom), danach nur die aktuelle Seite.
Kein Nachweis für echte Browser-Paint-Zeiten oder mobile Endgeräte.

`api-before.json`, `grid-before.json`, `api-after.json` und `grid-after.json`
enthalten die Rohdaten. Nachher-Befehle wie oben, ohne `SYB_BENCHMARK_PHASE=before`.
Erneut gemessen nach Begrenzung, Alias-Scope-Reparatur, gezielten Dependency-Updates
und Trennung der Antwortmodelle vom ORM-Zustand. Der lokale Nicht-TLS-Testdienst
verwendet jetzt explizit `ssl=False`; die Baseline verwendete die automatische
SSL-Negotiation vor ebenfalls unverschlüsselter lokaler Verbindung. Die API-
Latenzdifferenz ist daher keine isolierte kausale Messung ausschließlich der Pagination.
SQL-Anzahl, Antwortbytes und Kartenanzahl zeigen die tatsächlichen Begrenzungen.

Alle JSON-Aufrufer der Videoseite verwenden die additive `/page`-Route. Legacy-
Routen bleiben für kompatible externe Aufrufer bestehen, sind wirksam auf 100
begrenzt und bieten Offset/Limit. Abgebrochene Auswahl-/Seitenanfragen werden
bis zum XMLHttpRequest-Transport abgebrochen. Filter-/Sortierwechsel setzen die
Seite zurück, das Löschen des letzten Eintrags korrigiert die Seitennummer.

Duplikatsuche und Importstatus verwenden höchstens 100 IDs pro Anfrage; Status
wird über alle überwachten IDs rotiert, auch außerhalb der sichtbaren Seite.
Ein gefilterter CSV-Export nutzt denselben Auswahlvertrag und exportiert im Test
alle 120 Treffer, während die sichtbare Seite nur 50 enthält. Eine Aktion zum
Auswählen aller Treffer wurde nicht eingeführt.
