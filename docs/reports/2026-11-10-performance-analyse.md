# Performance-Analyse: Smart YouTube Bookmarks

Stand: 10. November 2026. Untersucht: `0ddbd6f44e801e889f020c94c9689e22aa9cf84d` auf `fix/grid-field-updates-from-modal`, einschließlich vorhandener lokaler Änderungen. Keine App-Implementierung verändert. Die lokalen Änderungen in VideoPlayer, VideosPage und useTags samt Tests bleiben fremde Arbeit.

## Ergebnis

Großes Beschleunigungspotenzial liegt in vermeidbarer Arbeit: globale Store-Benachrichtigungen pro Animationsbild, wiederholte vollständige Listenabrufe, unbegrenztes Rendering und ein großes initiales JavaScript-Paket. Das sind konkrete Codebefunde. Ein Faktor für die gesamte App wäre ohne Browserprofil und realistische Datenmessung unbelegt.

Für die strikte Vorgabe „gleiches Verhalten und Design“ zuerst Animation, Cache-Aktualisierung, doppelte Datenabrufe und interne Berechnungen optimieren. Pagination mit neuen Seitenknöpfen oder ein Wechsel der KI-/Transkriptionsprovider sind keine verhaltensneutralen Maßnahmen und werden nicht empfohlen.

## 1. Höchste Priorität: Fortschrittsanimation von der ganzen Sammlung entkoppeln

**Beleg:** `frontend/src/components/VideoCard.tsx:59–60` abonniert sowohl Tag- als auch Importstore ohne Selektor. `frontend/src/stores/importProgressStore.ts:146–225` betreibt je Video eine eigene requestAnimationFrame-Schleife. Sie erzeugt pro Frame neue Maps für Fortschritt und Frame-Handles. Auch bei erreichtem Ziel läuft sie für nicht abgeschlossene Videos weiter und schreibt unveränderten Anzeigefortschritt erneut.

Jedes Store-Update benachrichtigt damit sämtliche Karten-Abonnements. Zusätzlich werden die Maps mit sämtlichen Einträgen kopiert. Bei I aktiven Importen und N Karten wächst allein die Zahl der Benachrichtigungen mit I × N pro Frame. React kann Updates bündeln; daraus folgt keine identische Zahl tatsächlicher React-Commits.

**Isoliert ausgeführt:** Der echte, mit esbuild geladene Store lief mit 1.000 einfachen Store-Abonnenten und 60 simulierten Frames. Die synthetischen 300-ms-Timer wurden absichtlich nicht ausgelöst. Alle Videos hatten Ziel- und Anzeigefortschritt 0; der sichtbare Wert änderte sich nicht.

| Aktive Importe | Store-Updates | Subscriber-Aufrufe |
| --- | ---: | ---: |
| 1 | 120 | 120.000 |
| 10 | 1.200 | 1.200.000 |
| 100 | 12.000 | 12.000.000 |

Reproduktion: `node scripts/performance/audit-import-progress.cjs`. Keine Netz-, Datenbank- oder Provideraufrufe. Die Ergebnisse messen Benachrichtigungen, keine Browser-FPS oder End-to-End-Latenz.

**Ansatz:** Pro Karte nur `state.progress.get(video.id)` abonnieren; Tagdaten und Aktionen separat selektieren. Unveränderte Werte nicht schreiben. RAF-Handles und Timer außerhalb des reaktiven UI-Zustands verwalten. Die Animation in einen gemeinsamen Frame-Scheduler überführen, der alle tatsächlich veränderten Einträge einmal pro Frame veröffentlicht. Unveränderte Einträge müssen ihre Objektreferenz behalten. Danach Karten/Zeilen memoizieren und Callback-Props stabil halten; `memo` allein behebt direkte Store-Abonnements nicht.

**Potenzial:** Sehr hoch für Reaktionsfähigkeit während Imports, auch bei bereits vorhandenen fertigen Videos. Keine Änderung an Kurve, synthetischem Fortschritt, Stage-Ceilings oder Terminalzuständen erforderlich. Wenn eine ruhende Animation pausiert, muss der synthetische Timer sie bei geändertem Ziel zuverlässig wieder starten.

**Abnahme:** Identische Fortschrittswerte und Übergänge bei gleicher Zeitbasis; vollständiger Cleanup; keine Kartenupdates für andere Video-IDs; React-Profil bei 1.000 Karten und 10 aktiven Importen.

## 2. Höchste Priorität: vollständige Polling-Antworten durch gezielte Änderungen ersetzen

**Beleg:** `frontend/src/components/VideosPage.tsx:363` setzt 500 ms. `:562–581` aktiviert bei Filtern zusätzlich zum Filterabruf weiterhin den vollständigen Listenabruf. Beide pollen während Imports. Das ergibt bei ausreichend schnellen Antworten bis zu vier vollständige Listenrequests pro Sekunde. Die tatsächliche Rate hängt von Requestdauer und Browserzustand ab.

`backend/app/api/videos.py:520–720` und `:722–1003` laden alle Treffer ohne Limit, danach Tags, Schemafelder, Feldwerte und Kanalbilder. `VideoResponse` enthält außerdem Beschreibungen und zahlreiche Metadaten. Das Backend verwendet an diesen Stellen bereits sinnvolle Batchabfragen: Der Engpass ist hier nicht pauschal „N+1“, sondern die wiederholte vollständige Hydrierung, Serialisierung, Übertragung und Verarbeitung.

**Ansatz, zunächst risikoarm:** Nur benötigte vollständige Abfragen aktiv halten. Vor Abschalten des ungefilterten Abrufs prüfen, welche Verbraucher ihn benötigen. Insbesondere muss die Importüberwachung auf den tatsächlich importierten IDs beruhen; aktuell prüft sie in `VideosPage.tsx:614–640` nur die angezeigten Treffer. Versteckte importierte Videos dürfen das Polling nicht endlos aktiv halten.

**Größerer Hebel:** Initial dieselbe vollständige Sammlung laden, anschließend maximal im bisherigen Aktualisierungsintervall nur importierte/veränderte Videos samt relevanten Metadaten abrufen und in den Cache einarbeiten. Vorhandene WebSocket-Events können den Abruf auslösen; sie enthalten allein noch kein vollständiges Video. Für Wiederverbindung, verpasste Events und Abschluss ist eine verlässliche Reconciliation nötig. Ein kleiner Batch-Status-/Änderungsendpunkt kann zunächst die bestehende Pollingfrequenz beibehalten und trotzdem die teure Vollübertragung vermeiden.

**Potenzial:** Sehr hoch bei großen Sammlungen während Imports. Die Ersparnis hängt vom Verhältnis geänderter Videos zur gesamten Sammlung ab; kein gemessener Gesamtfaktor.

**Abnahme:** Gleiche Aktualität; Tag-/Kanal-/Feldfilter und serverseitige Sortierung bleiben korrekt. Ein geändertes Video kann aus einem Ergebnis herausfallen, neu hineinkommen oder seine Position wechseln. Blindes Anhängen oder Ersetzen eines Objekts genügt dafür nicht. Bei Unsicherheit betroffene Ergebnisabfrage gezielt neu laden.

## 3. Hohe Priorität: einzelne Änderungen lösen keinen globalen Listenreload aus

**Beleg:** `frontend/src/hooks/useWatchProgress.ts:49–53` invalidiert nach jedem erfolgreichen Positionsspeichern sämtliche Videoabfragen. Speichern erfolgt beim Pausieren, Suchen und am Ende sowie über den bestehenden Debounce in `VideoPlayer.tsx:129–138`. Der Kommentar „alle 10 Sekunden“ beschreibt keine garantierte Intervallausführung: Es ist ein Debounce. `useVideoFieldValues.ts:114–124` invalidiert nach einem Feldwrite ebenfalls alle Videoabfragen. Mehrere Mutationen in `useVideos.ts` tun dies auch.

**Ansatz:** Bei Wiedergabeposition die Antwort gezielt in vorhandene Detail-/Listen-Caches übernehmen, ohne gespeicherte Frequenz oder Resume-Verhalten zu verändern. Bei Feldwrites die zurückgegebenen Werte übernehmen und nur betroffene Listen/Filter/Sortierungen invalidieren. Beide Detail-Key-Varianten berücksichtigen: `['videos', id]` und `['video-detail', id]`; Feldwertcache separat konsistent halten.

**Potenzial:** Hoch für Editieren und Videomodal bei großen Sammlungen. Für gefilterte und sortierte Ergebnisse muss die fachliche Korrektheit Vorrang vor dem Einsparen eines Requests behalten.

**Abnahme:** Änderungen aus Modal, Inline-Editor und Detailseite sind sofort überall sichtbar, Rollbacks funktionieren, Filterzugehörigkeit und Sortierung stimmen, Fehler werden nicht als erfolgreiche Saves behandelt.

## 4. Hohe Priorität bei großen Sammlungen: Renderingkosten begrenzen

**Beleg:** `frontend/src/components/VideoGrid.tsx:73` erstellt jede Karte. `frontend/src/components/VideosPage.tsx:1553` erstellt jede Tabellenzeile. Weder Grid noch Tabelle verwenden hier Virtualisierung. Bild-Lazy-Loading ist bereits vorhanden und spart diese React-/DOM-Arbeit nicht ein.

**Ansatz in Stufen:** Zuerst Store-Isolation und stabile/memoisierte Karten/Zeilen. Dann CSS `content-visibility: auto` als experimentellen Kandidaten messen: Es kann Layout/Paint außerhalb des sichtbaren Bereichs reduzieren, behebt aber weder initiale React-Mounts noch Store-Abonnements. Platzhalterhöhen müssen zum Layout passen.

Viewport-Virtualisierung könnte bei Tausenden Karten wesentlich weiter gehen; die vorhandene Dependency `@tanstack/react-virtual` ist allein noch keine Integration. Unter der strikten Vorgabe ist Virtualisierung jedoch ein bedingter Kandidat: Unmounting kann Browser-Suche, Tastaturfokus, Screenreader, offene Inline-Editoren, variable Kartenhöhen und Scrollwiederherstellung verändern. Erst empfehlen, wenn diese Eigenschaften erhalten und geprüft sind. Keine neuen Seitenknöpfe und kein sichtbarer Wechsel des Bedienmodells.

**Potenzial:** Sehr hoch bei großen Sammlungen, gering bei wenigen Videos. Ohne Browsermessung ist nicht belegt, welche Rendermaßnahme die größte Wirkung hat.

## 5. Hohe Priorität für Kaltstart: große Funktionspakete später laden

**Beleg:** `frontend/src/App.tsx:2–10` importiert alle Hauptseiten statisch. Der Listenpfad zieht über `VideoDetailsModal` den Player und über `TextSnippet.tsx:25` den Tiptap-Editor mit. `TiptapEditor.tsx` initialisiert `createLowlight(common)` auf Modulebene. Die genaue anteilige Größe der Bibliotheken wurde nicht separat gemessen.

**Ausgeführt:** Separater Vite-Produktionsbundle nach `/tmp/syb-performance-audit-dist`: initiales `index-DF1bDiqF.js` 1.991,06 kB minifiziert, 608,47 kB gzip; CSS 124,68 kB, 21,93 kB gzip. Vite verarbeitet 2.851 Module. Bereits vorhandene Vidstack-Teilchunks bleiben erhalten. Dies ist ein Bundlegrößenbefund, keine gemessene Netz- oder Startdauer.

**Ansatz:** Seiten, Videomodal/Player, Analytics und Editor über sinnvolle dynamische Importgrenzen trennen. Nur zusätzliche Vendor-Chunks zu erzeugen reduziert nicht automatisch die initial benötigte Menge. Vorher den Thumbnail aus VideosPage herauslösen, damit `VideoCard → VideosPage → VideoGrid → VideoCard` keine ungünstige Kopplung der Grenzen erzeugt. Editorcode nicht allein zum Anzeigen von Text laden.

Unter „gleiches Verhalten“ darf der erste Klick keine neue sichtbare Ladepause bekommen: auf erkennbare Absicht oder kontrolliert im Idle vorladen, identische Geometrie erhalten und Chunk-Ladefehler behandeln. Benötigt der Startzustand bereits den Editor, fällt die Einsparung entsprechend geringer aus.

**Potenzial:** Hoch für Kaltstart und schwächere Geräte; wenig Effekt auf bereits geladenes Scrolling. Keine Aussage, um wie viel kleiner das Paket wird, bevor die Grenzen gebaut und gemessen sind.

## 6. Mittlere Priorität: identische Schemaarbeit einmal pro Request berechnen

**Beleg:** `backend/app/api/helpers/field_union.py:261–271` berechnet Konflikte und sortierte Feldunion für jedes Video erneut, auch wenn viele Videos dieselbe geordnete Schemafolge haben. Die DB-Daten werden bereits gebündelt geladen. Der normale Listenendpunkt lädt in `videos.py:634–636` die bereits zu Beginn gefundene BookmarkList erneut.

**Ansatz:** Feldunion innerhalb eines Requests nach `tuple(schema_ids)` memoizieren; die Reihenfolge muss erhalten bleiben, weil „first wins“ und Workspace-/Kategoriepriorität fachlich relevant sind. Bereits geladene Liste wiederverwenden. Kein globaler TTL-Cache nötig und damit keine neue Invalidierungsfrage bei Schemaänderungen.

**Potenzial:** Mittel bei vielen Videos und umfangreichen wiederholten Schemas. Es bleibt weiterhin pro Video die Zuweisung seiner individuellen Werte erforderlich. Struktur und Reihenfolge der API-Antwort müssen exakt gleich bleiben.

## 7. Großer Kandidat für Importdauer: vorhandenes Batching einsetzen

**Beleg:** `backend/app/workers/video_processor.py:458` verarbeitet die Liste seriell; `process_video` ruft bei `:290` Einzelmetadaten ab. `backend/app/clients/youtube.py:394` enthält bereits einen Batchclient für bis zu 50 IDs. Die kleine direkte CSV-Importstrecke in `videos.py:1728` ruft ebenfalls seriell Metadaten ab. Der Batchclient muss vor Wiederverwendung auf vollständige Feld- und Cache-Parität geprüft werden; seine Existenz beweist diese Parität nicht.

**Ansatz:** Metadaten bündeln und Kanalinformationen pro eindeutiger Kanal-ID wiederverwenden. Cachetreffer und nicht gefundene Videos mit derselben bisherigen Semantik behandeln. Weitere Parallelisierung nur begrenzt und mit unabhängigen DB-Sessions; kein `gather` mit der gemeinsam genutzten AsyncSession. Fortschrittsereignisse, Fehler und Commitgrenzen erhalten. Falls exakt dieselbe sichtbare Abarbeitungsreihenfolge gefordert ist, zuerst Batching mit geordnetem Anwenden umsetzen.

**Weiterer Befund:** `enrichment_service.py:328–354` hält den auf drei Plätze begrenzten YouTube-Semaphor auch während des Groq-Audio-/Transkriptionsfallbacks. So können lange Fallbacks andere YouTube-Aufgaben blockieren. Den Schutz auf tatsächliche YouTube-Aufrufe begrenzen und für Download/Transkription eigene Ressourcengrenzen vorsehen. Dabei nicht einfach die Semaphorezahl erhöhen oder Provider-Fallbacks entfernen. Der Semaphor ist pro Prozess, keine globale Begrenzung über mehrere Workerprozesse.

**Potenzial:** Hoch für Importdurchsatz, wenn externe Metadaten oder lange Fallbacks dominieren. Nicht als Beschleunigung der fertigen Gridansicht zu verstehen. Keine realen Providercalls für diese Analyse ausgeführt.

## Weitere, kleinere Befunde

- Analytics: `backend/app/api/analytics.py:347–383` führt pro nicht leerem Schema bis zu zwei weitere Abfragen aus. Schemaübergreifend aggregieren; dabei DISTINCT, leere Mengen und die vorhandene Rundungsreihenfolge bewahren. Relevant für Analytics, kein Hauptgrund für ein langsames Videogrid.
- Textvorschau: `frontend/src/components/fields/TextSnippet.tsx:85–101` parst HTML bei jedem Render mit DOMParser, bei gekürztem Text erneut. Nach Inhaltswert memoisieren und das Parsergebnis wiederverwenden. Keine Änderung an HTML-Darstellung, Sanitizing oder Kürzungsregel als Teil dieser Optimierung.
- `pendingVideoIds.includes` im Durchlauf aller Videos durch ein memoisiertes Set ersetzen. Kleiner, risikoarmer Hebel, behebt nicht die großen Transport-/Renderingkosten.
- Weitere Indizes erst nach aktuellem `EXPLAIN (ANALYZE, BUFFERS)` mit relevanten Daten und Filtern planen. Vorhandene Tag-/Feldindizes und alte Benchmarkberichte sind kein Nachweis der aktuellen Produktionslatenz. Kein Anlass für einen Stackwechsel oder pauschale Dependency-Upgrades.

## Empfohlene Reihenfolge und Nachweis

1. Fortschrittsstore isolieren und Batchanimation einführen; separat committen.
2. Watch-/Feldwert-Cache gezielt pflegen und doppelte Vollabfragen beseitigen; getrennte Commits je Verhalten.
3. Schemaunion pro Request wiederverwenden; API-Ergebnisse auf Parität vergleichen.
4. Initiale Importgrenzen für Seiten/Player/Editor messen und gezielt aufteilen.
5. Danach Renderingmaßnahmen und Änderungenabruf anhand des dominierenden Restengpasses. Provider-Batching separat für Importdurchsatz verfolgen.

Vorher/nachher unter identischen Bedingungen: 100, 1.000 und 10.000 synthetische Videos mit denselben Tags/Feldwerten; getrennt Kaltstart, warme Navigation, Filtern/Sortieren, Modal öffnen, Feld editieren und Import. Erfassen: API-p50/p95, SQL-Anzahl/-Zeit, Antwortbytes, initiales JS, Long Tasks, React-Commits, DOM-Knoten und Speicher. Für Animation sowohl aktive als auch fertige Karten beobachten. Korrektheitsmatrix: Suche/Filter/Sortierung, Detailcache, Inline-Editing, Resume, Importfehler/Abschluss, Reconnect, Tastatur-/Scrollverhalten und unveränderte Screenshots.

## Prüfgrenzen dieses Reviews

- Statische Untersuchung der aktuellen Quellen; deterministische Store-Diagnose erfolgreich ausgeführt.
- `npm run build --workspace frontend` aktuell fehlgeschlagen: TypeScript in `ChannelsPage.tsx:101,129,143` (`string | undefined` / möglicherweise undefinierte Indizes). Nicht im Rahmen dieser Analyse repariert.
- Separater Vite-Build ohne vorgelagerte Typprüfung erfolgreich; ausschließlich für Bundlegrößenanalyse, kein bestandener vollständiger Produktionsbuild.
- Keine Browserprofile, Live-DB-Abfragen, Migrationen, Lasttests gegen Nutzerdaten oder kostenpflichtigen Provideraufrufe. Keine Bibliotheken installiert, keine vollständigen Testsuiten ausgeführt. Die Diagnose ersetzt keine funktionale Abnahme einer späteren Implementierung.
- Neu hinzugefügt werden ausschließlich dieser Bericht und das isolierte Diagnoseskript; bestehende lokale App-Änderungen werden nicht übernommen.
