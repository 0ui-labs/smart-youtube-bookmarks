# Optimierungen und Altarbeit integrieren – Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Den geprüften Stabilisierungsstand mit sinnvoller älterer Arbeit zu einem konsistenten, nachvollziehbar geprüften Stand für `main` zusammenführen, ohne lokale Änderungen zu verlieren oder überholte Implementierungen zurückzubringen.

**Architecture:** Ein eigener Integrationsbranch vereinigt die bestehenden Commit-Historien. Fehlende lokale Produktkorrekturen werden anschließend gezielt auf die neue Architektur übertragen; inhaltlich ersetzte Änderungen bleiben als gesicherte Altarbeit nachvollziehbar. Authentifizierung, Queue, Datenverträge und Pagination werden als zusammenhängender neuer Stand geprüft.

**Tech Stack:** Bestehender React-/TypeScript-/FastAPI-/PostgreSQL-/Redis-/ARQ-Stack; Git-Merge-Commits, vorhandene pytest-/Vitest-/Typ-/Lint-/Migrationsprüfungen und GitHub-PR gegen `main`.

---

## 1. Umfang und Autorisierung

Dieser Auftrag erstellt ausschließlich den Integrationsplan. Er führt keine Codeübernahme, Branchbereinigung, Migration, Veröffentlichung, PR-Schließung oder Zusammenführung nach `main` aus. Die folgenden Schritte beschreiben die spätere Umsetzung.

Die öffentliche Freigabe und das Umschalten einer bestehenden Anwendung sind eigene Schritte. Ein Git-Merge aktiviert weder Clerk noch Datenbankmigrationen und ordnet keine bestehenden Daten neu zu.

## 2. Verifizierter Ausgangspunkt, 10. November 2026

| Quelle | Stand | Bedeutung |
| --- | --- | --- |
| Lokales `main` | `37e7b66` | Gemeinsame Basis der neuen Stabilisierung und des bisherigen Fix-Branches. |
| `t3/stabilize-youtube-bookmarks` | `cb12e91` | Lokal geprüfter Implementierungsstand; sauberer eigener Worktree. |
| `fix/grid-field-updates-from-modal` | `fc0ce9a` vor diesem Plancommit | Enthält den alten Grid-Fix, den Stabilisierungsplan und zwei zusätzliche Analysecommits. Vier lokale Code-/Teständerungen sind nicht committet. |
| Zusätzliche Analysecommits | `f1e849e`, `fc0ce9a` | Performancebericht mit Diagnoseskript sowie Architekturreview; fehlen im Stabilisierungsbranch. |
| GitHub PR #8 | Head `2f5b6e9` | Bereits vollständig Vorfahr des Stabilisierungsbranches, aber noch nicht von `main`. Falscher heutiger Zielbranch: `feature/websocket-progress-updates`. |
| GitHub PR #2 | Head `e1cea69` | Bereits vollständig Vorfahr von `main`; weiterhin offen gegen den früheren Feature-Branch. |
| `category-fields-backup` | Alter Kategorie-Entwicklungsstand | Enthält historische, teils vorläufige Implementierungen; Funktionen sind in aktueller Form vorhanden. Kein Kandidat für einen vollständigen Rückmerge. |

Alle Referenzen vor Umsetzung erneut prüfen und Remote-Stände aktualisieren. Verschiebt sich eine Quelle, den neuen Delta zuerst lesen. Die verifizierten alten Hashes bleiben Vergleichspunkte, keine Anweisung, neuere Arbeit zu überschreiben.

Der Stabilisierungsbericht nennt 1.311 erfolgreiche Frontendtests und 1.001 erfolgreiche Backendtests mit 10 bestehenden Skips. Build, Ruff, strenges mypy, Migrationen und API-Drift waren erfolgreich; Biome meldete 169 Warnungen. Diese Ergebnisse gelten für den damaligen Stand, nicht automatisch für den künftigen Merge.

## 3. Zielentscheidung für jede offene Änderung

| Änderung | Entscheidung | Umsetzung / Nachweis |
| --- | --- | --- |
| Stabilisierung `cb12e91` | Als fachliche Hauptbasis übernehmen | Historie erhalten, vollständigen Integrationslauf nach allen Ergänzungen ausführen. |
| Alter Grid-Fix `2f5b6e9` | Durch Stabilisierung mit übernehmen | Nicht nochmals cherry-picken; seine Abstammung prüfen. |
| Lokaler Audio-Fix in `VideoPlayer.tsx` | Gezielt portieren | Provider-Language-Konfiguration fehlt im neuen Stand. Tests plus echte mehrsprachige Wiedergabe; gewünschte Audiospur nicht allein aus Kommentar ableiten. |
| Lokaler Feldcache-Fix in `VideosPage.tsx` | Alte Implementierung ersetzen, Absicht absichern | Heutige `useVideoFieldMutation`, Query-Keys und paginierte Antwortformen verwenden. Modal/Grid/Fehler-Rollback als Verhalten testen. |
| Lokale Änderungen in `useTags.ts` | Kein erneutes Einspielen | Zentraler `invalidateVideoViews` deckt die Absicht ab; Einzel- und Bulk-Schemaänderung nachweisen. |
| Lokaler `useTags.test.tsx`-Zusatz | Testabsicht übertragen | Den Test an tatsächliche heutige Keys/Datenformen anpassen, sofern das Verhalten nicht bereits ausreichend geprüft ist. |
| `f1e849e`: Performanceanalyse/Diagnose | Historisch gekennzeichnet erhalten | Gegen neuen Stand abgleichen; offene Empfehlungen von bereits erledigten trennen. Keine alten Messwerte als aktuelle Leistung ausgeben. |
| `fc0ce9a`: Architekturreview | Historisch gekennzeichnet erhalten | Befunde mit Stabilisierungsmaßnahmen verknüpfen; überholte Dateipfade/Beispiele kennzeichnen. |
| Alter Grid-Fix-Plan im Root | Als historische Referenz sichern | Nicht als aktive Implementierungsanweisung in den neuen Stand übernehmen. |
| Fremder Smart-Watch-Plan | Aus Integration ausschließen | Beschreibt `folder_extractor` und lokale Dateisortierung. Ursprungsdatei unverändert lassen, bis separat geklärt. |
| `.cartographer/` | Aus Integration ausschließen | Generierte lokale Analyse; 595 Dateien. Keine Aufnahme ins Produktrepository. |
| `.codemapper.yaml` | Vorerst lokal lassen | Enthält maschinenbezogene Einstellungen; gemeinsame Konfiguration nur in eigenem bewussten Tooling-Schritt. |
| `.claude/settings.local.json` | Lokal lassen | Persönliche Berechtigungen und MCP-Einstellungen nicht verteilen. |
| `.claude/commands/implement.md` | Vorerst lokal lassen | Persönliche Arbeitsanweisung; keine automatische Einführung als Projektstandard. |
| `category-fields-backup` | Nicht vollständig mergen | Gezielt nach exklusivem, noch relevantem Verhalten suchen; Unterschiede sind nicht automatisch fehlende Funktionen. |

## 4. Integrationsreihenfolge

### Task 1: Aktuellen Zustand aufnehmen und Altarbeit sichern

**Dateien:** Ursprünglicher Worktree; später neuer `documentation/reports/integration-main-abnahme.md` auf dem Integrationsbranch.

1. `pwd`, `git status --short --branch`, `git worktree list` und aktuelle Branch-Hashes protokollieren. Bereits gestagte Änderungen gesondert erfassen.
2. Remote-Referenzen mit `git fetch origin` aktualisieren; `origin/main`, lokales `main` und beide Arbeitsbranches auf neue Commits prüfen. Keinen Reset und keinen automatischen Pull/Merge ausführen.
3. Die vier lokalen Code-/Testpatches sowie nicht versionierte Pläne und lokale Werkzeugdateien in einem privaten Sicherungsort außerhalb des Produkt-Worktrees erhalten. Für Dateien Prüfsummen und für Patches Ausgangscommit festhalten. Persönliche Einstellungen nicht in einen öffentlich teilbaren Bericht kopieren.
4. Sicherung auf vollständige Wiederherstellbarkeit prüfen. Im ursprünglichen Worktree nichts löschen, stagen, zurücksetzen oder stashen.
5. Für die Umsetzung einen eigenen Integrationscheckout/Branch `integration/stabilization-and-legacy` von der verifizierten aktuellen `main`-Basis bereitstellen. Bei delegierter Ausführung den vorbereiteten Worktree des Task-Werkzeugs verwenden.

**Abnahme:** Jede alte Änderung bleibt unverändert wiederherstellbar; die Integration arbeitet ausschließlich im eigenen sauberen Checkout. App-Daten und `.env` werden nicht in die Sicherungsdokumentation kopiert.

### Task 2: Historien auf dem Integrationsbranch vereinigen

**Quellen:** `t3/stabilize-youtube-bookmarks`, `fix/grid-field-updates-from-modal` einschließlich dieses Plancommits.

1. Zuerst den verifizierten Stabilisierungsbranch mit einem Merge-Commit übernehmen.
2. Anschließend den committeten bisherigen Fix-Branch mit einem weiteren Merge-Commit integrieren. Nach aktuellem Stand kommen daraus die zwei Analysen und dieser Integrationsplan hinzu; die vier lokalen Patches werden dadurch nicht übernommen.
3. Konflikte pro Datei nach fachlichem Vertrag lösen. Keine pauschale Auswahl von `ours`/`theirs`. Aktuelle Auth-Prüfungen, Outbox-Aufträge, paginierte Response-Modelle und Generatorausgaben dürfen nicht durch Altstände ersetzt werden.
4. Abweichungen vom erwarteten Delta anhalten und einzeln prüfen. Generator-Dateien bei Vertragsänderungen neu erzeugen, nicht manuell zusammenkopieren.
5. Abstammung beider Quellbranches mit `git merge-base --is-ancestor` bestätigen.

**Abnahme:** Beide committierten Arbeitsstände sind enthalten, vorhandene granulare Implementierungscommits bleiben nachvollziehbar. Keine generierten Analyseverzeichnisse oder lokalen Berechtigungsdateien landen im Diff.

**Geplante Commits:** `merge: integrate verified stabilization`, `merge: retain supplementary codebase analyses`.

### Task 3: Fehlenden Player-Fix gezielt übernehmen

**Dateien:** `frontend/src/components/VideoPlayer.tsx`, `frontend/src/components/__tests__/VideoPlayer.test.tsx`.

1. Den gesicherten Patch gegen den heutigen Player vergleichen. Vor Implementierung anhand der tatsächlich installierten Vidstack-Version und ihrer offiziellen Dokumentation prüfen, welche Wirkung `provider.language` auf YouTube hat.
2. Gewünschtes Verhalten festhalten: keine unbeabsichtigte erzwungene englische Synchronspur; Wiedergabe und vorhandene Spracheinstellungen respektieren. Die Gleichsetzung „leere Sprache = immer Originalton“ ist erst nach echter Beobachtung bestätigt.
3. Gezielt fehlenden Test für YouTube-Providerwechsel schreiben; Nicht-YouTube-Provider, erneuten Providerwechsel und vorhandene Player-/Watch-Progress-Funktionen mit abdecken.
4. Nur die notwendige Providerkonfiguration portieren. Anschließend den gezielten Testlauf ausführen:

   `cd frontend && npm test -- --run src/components/__tests__/VideoPlayer.test.tsx`

5. Reale Wiedergabe eines Videos mit mehreren Audiospuren prüfen; beobachtete Sprache und Einschränkungen dokumentieren. Ohne diesen Nachweis den Patch nicht als bewiesene Audio-Reparatur deklarieren.

**Commit:** `fix: preserve intended audio selection for youtube playback`.

### Task 4: Alte Cache-Korrekturen fachlich abschließen

**Dateien:** `frontend/src/hooks/videos/useVideoFieldMutation.ts`, dessen Testdatei, `frontend/src/hooks/useTags.ts`, `frontend/src/hooks/__tests__/useTags.test.tsx`, `frontend/src/hooks/videos/cache.ts`, vorhandene Modal-/Grid-Integrationstests.

1. Prüfen, ob vorhandene Tests die Absichten der alten Patches vollständig nachweisen: Feldänderung im Modal, Wechsel des Tag-Schemas und Bulk-Schemaänderung.
2. Fehlende Verhaltensfälle ergänzen: Detailansicht und Grid werden aktuell, gefilterte/sortierte Seiten bleiben fachlich korrekt, inaktive Caches werden stale und beim Öffnen neu geladen.
3. Erstmalig gesetzte Feldwerte und fehlgeschlagene Speicherung prüfen. Fehler dürfen weder bestätigte Daten vortäuschen noch Seite, Gesamtanzahl oder andere Videos beschädigen.
4. Ausschließlich moderne Query-Keys verwenden, insbesondere `videoKeys.detail(...)`; keine Wiederaufnahme von `["video-detail", id]` als zweitem parallelen Vertrag.
5. Die lokale `oldVideos.map(...)`-Logik nicht auf paginierte `{ items, total, offset, limit }`-Antworten anwenden. Falls unmittelbare Optimistik gewünscht ist, Arrays, Details und Seiten explizit behandeln; sonst verlässlichen Refetch mit sichtbarem Speicherstatus beibehalten.
6. Das Verhalten prüfen, nicht die genaue Anzahl interner Invalidierungsaufrufe. Alte Patches anschließend als „inhaltlich ersetzt, gesichert“ im Integrationsbericht zuordnen.

**Abnahme:** Keine fehlende fachliche Wirkung der alten Änderungen. Keine doppelte Mutation oder parallele Cachekonvention. Schon ausreichend abgedeckte Fälle brauchen keine bloß duplizierenden Tests.

**Commit bei Ergänzungsbedarf:** `test: preserve legacy modal and schema update behavior`.

### Task 5: Analysen und Optimierungsvorgaben auf den neuen Stand beziehen

**Dateien:** `docs/reports/2026-11-10-performance-analyse.md`, `scripts/performance/audit-import-progress.cjs`, `documentation/reports/2026-11-10-architektur-review.md`, neuer Integrationsbericht.

1. Beide Berichte eindeutig mit untersuchtem historischen Commit kennzeichnen und auf den aktuellen Abnahmebericht verlinken.
2. Empfehlungen als erledigt, teilweise erledigt, noch zu messen oder bewusst nicht übernommen klassifizieren. Keine alten Zeilennummern als aktuelle Implementierungsbelege ausgeben.
3. Diagnoseskript gegen den aktuellen Store ausführen, wenn es noch kompatibel ist. Bei Anpassung gleiche Messmethode erhalten; synthetische Store-Benachrichtigungen nicht mit Browser-FPS verwechseln. Keine neuen Optimierungsfeatures allein aufgrund des alten Berichts implementieren.
4. Zwei sichtbare Änderungen ausdrücklich in der Integrationsabnahme bewerten:
   - **Pagination:** Der freigegebene Stabilisierungsplan sieht serverseitige Seiten vor; die spätere Performanceanalyse nennt eine Vorgabe ohne sichtbare Änderung des Bedienmodells und lehnt neue Seitenknöpfe ab. Das sind unterschiedliche Produktvorgaben. Vor Merge nach `main` muss feststehen, welche gilt. Empfehlung: serverseitig begrenzte Abfragen erhalten; falls die bisherige Bedienung verbindlich ist, UI auf kompatibles schrittweises Nachladen umstellen und Suche, Auswahl, Scrollposition und Export absichern. Nicht stillschweigend eine Vorgabe übergehen.
   - **Anmeldung:** Der neue Stand sperrt fachliche Zugriffe ohne Clerk-Konfiguration. Bestehende lokale Nutzung darf nicht überraschend unerreichbar werden. Vor Integration in den verwendeten Standardstand Konfiguration, Login und explizite Altdatenzuordnung vorbereiten; keinen unsicheren Entwicklungsbypass einführen.
5. Bestehende zusätzliche Produktentscheidungen aus anderen aktiven Arbeiten vor der Umsetzung abgleichen; dieser Plan autorisiert keine neue UI- oder Architekturentscheidung.

**Abnahme:** Der Integrationsbericht nennt den gewählten Bedienvertrag ausdrücklich. Ungeklärte Pagination-/Auth-Betriebsfragen blockieren die Freigabe nach `main`, nicht das sichere Zusammenführen auf dem Integrationsbranch.

**Commit:** `docs: reconcile historical analyses with integrated implementation`.

### Task 6: Backup-Branch und alte PRs ohne Rückschritte behandeln

1. `category-fields-backup` gegen die Integration hinsichtlich Kategorie/Label-UI, exklusiver Kategoriezuweisung, Standard-/Kategorieschema, Feldwertsicherung und Schemawechsel vergleichen. Eindeutige Commit-Hashes allein belegen keine fehlende Funktion.
2. Nur falls tatsächlich relevantes Verhalten fehlt, einen kleinen aktuellen Fix samt Test erstellen. Keine WIP-Implementierungen und keine alten Migrationen vollständig zurückmergen.
3. PR #2 als „bereits in main enthalten“ dokumentieren. Bei später autorisierter GitHub-Bereinigung mit Begründung schließen, ohne neuen Merge.
4. PR #8 erst nach erfolgreicher Integration in `main` als über den Integrations-PR erledigt schließen. Nicht erneut gegen den überholten Feature-Branch mergen.
5. Backup- und Quellbranches vorerst behalten. Keine automatische Löschung, kein Pruning und keine Entfernung des alten Worktrees oder seiner lokalen Änderungen.

**Abnahme:** Ein Delta-Inventar weist jedes relevante Altverhalten nach oder begründet seine Nichtübernahme. PR-Bereinigung folgt der tatsächlichen Abstammung des finalen `main`.

### Task 7: Den gemeinsamen Stand vollständig prüfen

**Dateien:** Integrationsbericht, bestehende CI-Konfiguration und Tests.

1. Nach allen Codeergänzungen einmal den vollständigen Frontend-/Backend-Prüfsatz ausführen. Weitere Wiederholungen nur bei Änderungen, Fehlern oder offenen Befunden.

```bash
# frontend/
npm run build
npm test -- --run
npm run lint

# backend/ – explizite dedizierte Test-DB-/Redis-Konfiguration vorab setzen
.venv/bin/python -m pytest -q -rs --tb=short
.venv/bin/ruff check app tests
.venv/bin/mypy app
.venv/bin/python scripts/check_api_client.py
```

2. Zusätzlich die dokumentierten Migrations- und Workerstartprüfungen auf neuen Testdatenbanken ausführen. Bestehende App-Volumes bleiben unberührt.
3. Neue Testfälle dürfen die bekannte Skip-Liste nicht stillschweigend vergrößern. 169 bekannte Lintwarnungen sind eine historische Referenz, keine Erlaubnis für beliebig neue Warnungen.
4. In einer echten Browserreise prüfen: Login A → Liste → Einzelvideo/mehrsprachiger Player → CSV-Duplikate → Modal-/Tag-Schemaänderung → Filter/Sortierung/Seitennavigation → Reconnect → vollständiger Export → Logout → Login B. Fremde Daten bleiben unsichtbar.
5. Fehlende Clerk-/Provider-Konfiguration ausschließlich über den vorgesehenen privaten Eingabekanal beschaffen. Ablaufzeit einer Anfrage ersetzt keine Eingabe. Lokale Simulationen und reale Nachweise getrennt ausweisen.
6. Abnahmebericht mit finalem Integrations-SHA, Herkunft der Änderungen, Prüfungen, verbleibenden Risiken und nicht übernommenen Altdateien vervollständigen.

**Abnahme:** Alle lokalen Pflichtprüfungen erfolgreich; moderne Daten-/Auth-/Queue-Verträge bleiben erhalten. Playerwirkung und sichtbare Bedienung sind real geprüft. Kein „vollständig abgenommen“, solange erforderliche externe Nachweise fehlen.

**Commit:** `docs: record integrated main acceptance and legacy disposition`.

### Task 8: PR nach main und kontrollierter Abschluss

1. Einen neuen Integrations-PR ausdrücklich gegen `main` vorbereiten. Titel und Beschreibung betreffen den gesamten Endstand, nicht nur den alten Grid-Fix.
2. Vor Push den konkreten Diff, Testbericht, Auth-Voraussetzungen, Migrationshinweise und verbleibende Risiken reviewbar bereitstellen. Erst bei entsprechender Ausführungsfreigabe pushen/PR erstellen; PR im Task-System verlinken.
3. Gehostete CI und einen gezielten Review des finalen Diffs abschließen. Der Umfang von derzeit 529 veränderten Dateien einschließlich generierter Clients rechtfertigt einen vollständigen Integrationsreview; frühere Selbstreviews ersetzen diesen nicht.
4. Bei Änderungen an `main` den Integrationsbranch aktualisieren, Konflikte fachlich lösen und betroffene Prüfungen erneuern. Vor tatsächlichem Merge muss der geprüfte SHA dem aktuellen PR-Head entsprechen.
5. Nach Freigabe mit Merge-Commit nach `main` übernehmen, damit granulare Herkunft und Integrationsentscheidung erhalten bleiben. Keine zweite unabhängige Übernahme derselben Fixes.
6. Danach prüfen, dass Stabilisierung und bisheriger Fix-Branch im finalen `main` enthalten sind. Nur dann PR #8 als erledigt behandeln. PR #2 kann unabhängig davon als bereits enthalten geschlossen werden.
7. Ursprüngliche lokale Änderungen weiter erhalten. Erst auf separaten ausdrücklichen Auftrag bereinigen, nachdem Sicherung und inhaltliche Zuordnung geprüft sind.

**Abnahme:** Geprüfter Stand liegt nachweislich in `main`, CI gehört zu diesem Head und alle Altänderungen sind nachvollziehbar eingeordnet. Keine automatische Bereitstellung und keine Migration existierender Nutzerdaten.

## 5. Abbruch- und Rückweg

- Konflikte und Fehlversuche bleiben auf dem Integrationsbranch; `main` und die Ursprungsworktrees bleiben bis zur Freigabe unverändert.
- Keine destruktiven Git-Befehle gegen fremde lokale Änderungen. Einen fehlerhaften lokalen Merge vor Commit ausschließlich im sauberen Integrationscheckout abbrechen.
- Nach veröffentlichtem Merge Korrekturen/Reverts nachvollziehbar committen; kein Umschreiben veröffentlichter Historie.
- Datenbank-/Auth-Umschaltung ist ein eigener Betriebsplan mit Backup. Ein Code-Revert macht eine angewandte Migration nicht automatisch rückgängig.

## 6. Fertigkriterien

- [ ] Alle Quellen neu geprüft, lokale Altarbeit vollständig gesichert und unverändert erhalten.
- [ ] Stabilisierung und zusätzliche Analysen auf einem gemeinsamen Branch, Historie nachvollziehbar.
- [ ] Player-Fix geprüft und übernommen oder mit konkretem Prüfbefund zurückgestellt.
- [ ] Alte Cache-/Schemaabsichten mit modernen Datenformen nachgewiesen, keine Rückkehr alter Keys.
- [ ] Historische Berichte eingeordnet; Bedienvertrag für Pagination und Auth-Betrieb geklärt.
- [ ] Backup-Branch geprüft; projektfremde Pläne und persönliche Werkzeugdaten ausgeschlossen.
- [ ] Vollständige lokale Prüfungen, reale Integrationsreise, Review und gehostete CI abgeschlossen.
- [ ] Erst nach Ausführungsfreigabe nach `main` gemerged; alte PRs korrekt als enthalten/ersetzt behandelt.
- [ ] Keine unbeabsichtigte Datenmigration, Veröffentlichung oder Löschung lokaler Arbeit.
