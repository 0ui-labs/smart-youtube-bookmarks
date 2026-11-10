# Gezielte Dependency-Bewertung, 10.11.2026

Kein pauschales Framework-/SDK-Upgrade wurde durchgeführt. Die Stabilisierung
ändert weder Architektur noch Providerressourcen. Registry-/Advisory-Befunde sind
keine Behauptung, jeder gemeldete Pfad sei in dieser Anwendung ausnutzbar.

## Ausgeführte begrenzte Updates

| Bereich | Verifizierter neuer Stand | Zweck |
| --- | --- | --- |
| Axios | 1.21.1 | Gepatchter Request-/Header-/Konfigurationstransport |
| DOMPurify | 3.4.17 | Sanitizer für gespeicherten Rich Text |
| Tiptap-Familie | 3.33.0 | Editor-/Paste-/Attributverarbeitung; Hauptversion 3 erhalten |
| React Router DOM | 6.30.6 | Verfügbare Korrekturen innerhalb Hauptversion 6 |
| python-jose | 3.5.0 | Verfügbare JWT-Korrekturen; RS256-Allowlist und Größenlimit bleiben |
| python-multipart | 0.0.31 | Korrekturen im CSV-/Multipart-Eingang |

Das Root-Lockfile hält die konkreten npm-Versionen fest. npm hat dabei die
Workspace-Auflösung umgeordnet; das erklärt den großen Lockfile-Diff. Kein
`npm audit fix --force`, kein Major-Upgrade auf Router 7/Zod 4 und keine
Abschwächung der Tests. Vollständige Frontend-Suite und Build sowie Backend-
Suite/Typprüfung prüfen den neuen Stand; CSV- und signierter Abnahmeablauf sind
darunter. Fehlerhafte Cache-Response-Typen werden zur Laufzeit validiert.

Tiptap-Befund: [Hersteller-Advisory zu mergeAttributes](https://github.com/advisories/GHSA-cp6q-959q-f8rh).
Weitere Referenzen stammen aus den zugehörigen npm-/PyPI-Advisory-Ausgaben.

## Verbleibende Risiken, keine Sicherheitsfreigabe

`npm audit --omit=dev --json`: vor gezieltem Update 22 Paketbefunde (17 high,
5 moderate), danach 13 (7 high, 6 moderate, 0 critical). `npm audit --json`
inklusive Entwicklungswerkzeugen meldet weiterhin 48 (14 critical, 21 high,
11 moderate, 2 low). Darunter sind Generator-/Glob-/CSS-Werkzeuge und Zod 3.
Das sind weder ignorierte Testergebnisse noch ein fehlerfreier Security-Audit.

Zod 4 und Router 7 würden API-/Verhaltensmigrationen auslösen. Bestehende
serverseitige Größenlimits, ausschließlich intern erzeugte UUID-Navigationsziele
und lokale Generierung aus dem eigenen OpenAPI-Dokument begrenzen relevante
Eingaben; sie ersetzen kein separates Security-Review. Produktionsbuilds
bündeln Entwicklungswerkzeuge nicht automatisch in die Browseranwendung.

`uvx pip-audit --path backend/.venv/lib/python3.11/site-packages --format json`
meldet nach den gezielten Updates noch 93 Einträge über sechs Pakete; einzelne
Advisory-IDs sind doppelt enthalten. Eindeutige IDs pro Paket:

| Paket | Version | Unterschiedliche gemeldete IDs |
| --- | --- | --- |
| ecdsa | 0.19.2 | 1 |
| fastapi | 0.109.0 | 1 |
| Pillow | 11.3.0 | 56 |
| pytest | 7.4.4 | 1 |
| python-jose | 3.5.0 | 1 |
| Starlette | 0.35.1 | 7 |

Der alte GenAI-Pin 0.3.0 ist laut [PyPI-Veröffentlichung](https://pypi.org/project/google-genai/0.3.0/)
wegen Pillow-Sicherheitsproblemen zurückgezogen. Er bindet die alte Pillow-
Familie. Der vorhandene Anwendungspfad verwendet Text statt Bild-Uploads;
das ist keine Entwarnung für das installierte Paket. Ein Wechsel auf eine
aktuelle GenAI-Hauptversion mit passenden HTTPX-/Pydantic-Abhängigkeiten und
aktuellen Modellnamen benötigt eine eigene gezielte Kompatibilitätsmigration
und reale Providerabnahme. Die drei bereits zuvor übersprungenen Legacy-Worker-
Tests zur direkten Gemini-Extraktion beschreiben außerdem einen bislang nicht
implementierten Produktpfad; die vorhandene Metadaten-/Enrichment-Architektur
wurde nicht durch eine neue Extraktionsfunktion ersetzt.

Für python-jose wird ausschließlich RS256 mit festem Issuer/JWKS geprüft;
ECDSA-/JWE-Pfade werden nicht angeboten. FastAPI/Starlette-/Upload- und
Entwicklungswerkzeug-Befunde bleiben für eine spätere öffentliche Freigabe
explizit zu prüfen und gegebenenfalls durch kompatible Framework-Updates zu
beheben. Dieser Auftrag führt kein Deployment durch und erklärt die Anwendung
nicht allein wegen grüner Verhaltenstests für öffentlich betriebssicher.
