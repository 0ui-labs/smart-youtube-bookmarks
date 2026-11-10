# Integration nach main – Arbeits- und Abnahmebericht

Plan: `docs/plans/2026-11-10-integration-main-und-altarbeit.md`.
Nutzerfreigabe zur Umsetzung: „ok, leg los“. Kein Deployment und keine Migration bestehender Benutzerdaten.

## Stand und Herkunft

Integrationsbranch: `integration/stabilization-and-legacy`.
Remote und lokales main bei Start: `37e7b66`; nach `git fetch origin` identisch.

- `c4d8359`: Stabilisierungsbranch bis `cb12e91` vollständig mit Historie übernommen.
- `96161d8`: bisherigen Fix-Branch bis `c4cacbc` mit zusätzlicher Performance-/Architekturanalyse und Integrationsplan übernommen.
- `c3b8016`: lokale Player-Absicht portiert und präzisiert: keine feste englische Embed-/Untertitelpräferenz, keine behauptete Garantie für Originalton.
- `548a2a9`: alte Modal-/Schemaabsichten durch aktive Query-Integrationstests abgesichert.

Die vier ursprünglichen lokalen Code-/Teständerungen bleiben im Ursprungsworktree unverändert. Vor Integration wurden 603 geänderte/nicht versionierte Dateien privat außerhalb des Projekts gesichert, SHA256 geprüft und die vier getrackten Patches gegen ihren Ausgangscommit exakt rekonstruiert. Persönliche Einstellungen und deren Inhalte werden nicht in Git übernommen. Sicherungsort ist im lokalen Arbeitsledger dokumentiert.

## Zuordnung alter Dateien

| Altänderung | Behandlung |
| --- | --- |
| VideoPlayer Provider-Sprache | Gezielt übernommen; YouTube, andere Provider, erneuter Providerwechsel und null/Teardown geprüft. |
| VideosPage Modal-/Grid-Cache | Heutige Keys und Datenformen beibehalten; erste Feldwerte, aktive Details/Seiten, Filtermitgliedschaft und fehlgeschlagene Saves geprüft. |
| useTags und lokaler Regressionstest | Absicht über zentralen Invalidierungsweg nachgewiesen, einschließlich Einzel-/Bulk-Schemawechsel; kein alter `video-detail`-Key zurückgebracht. |
| Grid-Fix-Plan im Root | Privat gesichert, als historische Anweisung nicht erneut implementiert. |
| Smart-Watch-Plan | Nicht übernommen: fremde Dateisortierung mit `folder_extractor`. Original bleibt erhalten. |
| Cartographer, Codemapper und persönliche Claude-Dateien | Nicht übernommen; Original und private Sicherung bleiben erhalten. |

## category-fields-backup: fachlicher Abgleich

Kein Rückmerge dieses alten Entwicklungsbranches. Die alte Implementierung enthält unter anderem WIP-Schritte und andere Service-Schnittstellen; ihre exklusiven Commit-Hashes sind kein Beleg für fehlende Produktfunktionen.

| Altes Verhalten | Heutiger Nachweis |
| --- | --- |
| Kategorie gegenüber frei kombinierbaren Labels | `frontend/src/components/CategorySelector.tsx`, `frontend/src/hooks/useTags.ts`; Backend-Validierung unterscheidet Kategorien/Labels. |
| Nur eine Kategorie pro Video | `backend/app/services/category_validation.py`; Unit- und Integrationstests in `backend/tests/unit/test_category_validation.py` und `backend/tests/integration/test_category_validation.py`. |
| Standard-/Kategorieschema und Feldunion | `backend/app/services/field_aggregation.py`, `backend/app/api/helpers/field_union.py`; Unit-/API-Tests. |
| Feldwertsicherung bei Kategoriewechsel | `backend/app/services/field_value_backup.py`, `backend/tests/unit/test_field_value_backup.py`, `backend/tests/integration/test_category_change.py`. |
| Datenbankgrundlage | Vorhandene Migration `5e0cc055afa3_add_is_video_type_and_default_schema_id.py`; komplette Migrationskette wird erneut gegen Testdatenbank geprüft. |

Keine fehlende exklusive Funktion wurde beim gezielten Vergleich festgestellt. Vollständige Suites bestätigen anschließend den aktuellen Vertrag; der Backup-Branch bleibt erhalten.

## Historische Analysen: Abgleich

| Empfehlung | Integrierter Stand / Rest |
| --- | --- |
| DB-/Queue-Übergabe, Claims, Recovery | Durch Outbox und dauerhafte Worker-Claims umgesetzt; externe Provider ohne Idempotenz behalten ein dokumentiertes Wiederholungsfenster. |
| Benutzer-/Listenisolation | Lokal implementiert; echte Clerk-Konfiguration und Login-Abnahme weiterhin notwendig. |
| Große Router/Page/Hooks aufteilen | In Stabilisierung umgesetzt; aktueller Modulzuschnitt ersetzt historische Pfad-/Zeilenangaben. |
| Cachekonventionen und Modaländerungen | Vereinheitlicht und durch zusätzliche aktive Query-Tests abgesichert. |
| Vollständiges Polling/Listenrendering | Serverseitige Seiten und begrenzte Importabfragen vorhanden; gewünschte sichtbare Navigation ist vor main zu klären. |
| Fortschrittsanimation/Store-Benachrichtigungen | Noch offen. Diagnoseskript auf integriertem Store reproduziert die historische Zahl von 120/1.200/12.000 Store-Updates bei 1/10/100 Importen über 60 simulierte Frames mit je 1.000 unselektierten Abonnenten. Keine Browser-FPS-Messung und keine Behauptung neuer Performanceverbesserung. |
| Gezieltes Watch-Progress-Cacheupdate | Weiterhin breite Video-Invalidierung; separate Optimierung, kein Rückschritt dieser Integration. |
| Bundle-Splitting, Memoisierung und Metadaten-Batching | Empfehlungen für gezielte Folgearbeit, keine pauschal abgeschlossenen Optimierungen. |

Die Analysen bleiben historische Evidenz; aus ihrem Text entsteht kein zusätzlicher Implementierungsauftrag für alle Performancevorschläge.

## Player: präziser Vertrag

Installiertes Vidstack setzt `language = "en"` und überträgt dies als `hl` und `cc_lang_pref`. Die Portierung setzt diese feste Präferenz auf leer. Offizielle Quellen: [Vidstack YouTube Provider](https://vidstack.io/docs/player/api/providers/youtube/), [YouTube Player-Parameter](https://developers.google.com/youtube/player_parameters#hl). `hl` beschreibt die Oberflächensprache, `cc_lang_pref` die Untertitelpräferenz; eine garantierte Audiospurwahl folgt daraus nicht.

Unit-Nachweis: drei neue Fälle zunächst fehlgeschlagen, nach Korrektur alle 13 Player-Tests erfolgreich. Die reale Wirkung auf ein konkretes mehrsprachiges Video ist noch nicht abgenommen.

## Offene Freigabepunkte

- Pagination: explizite Auswahl zwischen Seitenknöpfen und bisheriger Bedienung angefragt. Bis zur Klärung bleibt die integrierte Implementierung auf dem Prüfbranch; keine stillschweigende Freigabe nach main.
- Clerk: vorhandene lokale Konfiguration enthält keine Clerk-Werte. Private Publishable-Key-Anfrage ohne Eingabe abgelaufen. Das ist keine Eingabe oder Zustimmung. Echte Anmeldung, Tokenablauf, A/B-Wechsel und Datenzuordnung bleiben offen; kein Auth-Bypass.
- Reale Player-/Providerreise sowie gehostete CI und unabhängiger Integrationsreview folgen separat. Keine vollständige Gesamtabnahme behauptet.

## Prüfungen und Abschluss

Ergebnisse werden nach den Integrationsläufen ergänzt. Es werden ausschließlich dedizierte `_test`-Datenbanken und isolierte Redis-Datenbanken benutzt.
