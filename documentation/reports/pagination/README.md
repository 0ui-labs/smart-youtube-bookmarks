# Messaufbau – vor Einführung der Pagination

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
und DOM-Menge. Nachher-Werte werden mit denselben Daten und derselben Hardware
nach Implementierung des begrenzten Vertrags ergänzt.

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
