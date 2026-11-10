# Architekturreview: Smart YouTube Bookmarks

> Historische Analyse des Standes `0ddbd6f` einschließlich damaliger lokaler Änderungen. Befunde, Zeilennummern und Messwerte beschreiben diesen Altstand. Den Abgleich mit der integrierten Implementierung enthält der [Integrationsbericht](integration-main-abnahme.md).

Stand: 10. November 2026. Untersucht wurde Branch `fix/grid-field-updates-from-modal`, HEAD `0ddbd6f44e801e889f020c94c9689e22aa9cf84d`, einschließlich der vorhandenen lokalen Änderungen. Diese wurden nicht verändert. Dieser Bericht enthält Vorschläge; die Architektur wurde nicht umgebaut.

## Einschätzung

React/Vite, FastAPI, PostgreSQL und Redis/ARQ bilden eine brauchbare Basis. Der größte Verbesserungsbedarf liegt in der Verteilung von Verantwortung: Transport, fachliche Regeln, Transaktionen, Jobsteuerung und Darstellung greifen zu häufig ineinander. Die technische Ordnerstruktur suggeriert eine Trennung, die in den Abläufen nur teilweise existiert.

Empfohlen wird ein **modularer Monolith**: fachlich abgegrenzte Module innerhalb des bestehenden Backends, mit getrennt ausführbaren API- und Worker-Prozessen. Die vorhandenen Technologien können bleiben. Eine neue Sprache oder die Verteilung auf Microservices würde die gegenwärtigen Konsistenzprobleme nicht lösen und zusätzliche Übergabestellen schaffen.

Der Bericht ergänzt den [Stabilisierungsplan](../../docs/plans/2026-11-09-codebase-stabilisierung.md). Dieser beschreibt Fehlerkorrekturen und Abnahmen. Hier geht es darum, welche Struktur ähnliche Fehler künftig verhindert.

## Untersuchungsumfang und Nachweise

Gelesen wurden Architektur- und Stabilisierungsvorschlag, App-Einstiegspunkte, zentrale Video-, Feld-, Listen- und Enrichment-Routen, ORM-Modelle, Worker und deren Sessionverwaltung, Provider-Schnittstellen, Query-Hooks, Videoseite, API-Generierung sowie Test-Fixtures. Dies war eine gezielte Quellcodeuntersuchung, keine vollständige Prüfung jeder Datei.

Zusätzlich wurde das tatsächliche lokale Zod-Schema aus `frontend/src/hooks/useVideos.ts` mit einer synthetischen Antwort ausgeführt. Ergebnis: `field_values`, `channel_id` und `channel_thumbnail_url` werden entfernt. Dazu wurde ausschließlich die unbenutzte Tagvalidierung durch einen Platzhalter ersetzt; der Datensatz enthielt keine Tags. Es erfolgten keine Datenbank-, Provider- oder Browserzugriffe. Build und vollständige Tests wurden in diesem Review nicht ausgeführt; frühere Testergebnisse gelten nicht als aktueller Nachweis.

## 1. Einen verbindlichen Datenvertrag und ein Video-Abfragemodul schaffen

**Befund:**

- `frontend/src/hooks/useVideos.ts:8` definiert ein manuelles Zod-Antwortschema. Der Hook parst die Antwort damit und entfernt Felder, die das Backend tatsächlich liefert.
- `frontend/src/hooks/useVideosFilter.ts:194` verwendet einen anderen Query-Key-Aufbau und gibt die Antwort ohne diesen Parser zurück.
- `frontend/src/components/VideosPage.tsx:551` ruft beide Hooks auf und wählt abhängig von Filtern die Ergebnisse aus. Der ungefilterte Hook bleibt auch bei aktiven Filtern aktiv.
- Neben manuellen Typen unter `frontend/src/types/` existieren generierte Modelle und Hooks unter `frontend/src/api/generated/`. Im untersuchten UI werden von dort vorwiegend Modelle für Abonnements verwendet; die Videodaten laufen über manuelle Hooks.
- `backend/app/api/videos.py:521`, `:723` und `:1006` bauen Listen-, Filter- und Detailantworten auf. Feldwertprojektionen werden wiederholt implementiert; teilweise werden Antwortdaten direkt in `video.__dict__["field_values"]` geschrieben, obwohl `field_values` zugleich eine ORM-Beziehung ist.

**Folge:** Derselbe fachliche Datensatz hat je nach Zugriffspfad unterschiedliche Formen. Änderungen an einem Endpunkt müssen an mehreren, nicht gemeinsam abgesicherten Stellen nachgezogen werden. Die verlorenen Felder sind ein konkret nachvollzogener Fehler, kein bloßes Stilproblem.

**Vorschlag:**

1. Backend-Request-/Response-Modelle als verbindliche Beschreibung verwenden und Transporttypen daraus erzeugen. Orval ist bereits vorhanden. Entscheiden, ob nur Transportfunktionen oder auch Query-Hooks generiert werden; beide Wege dürfen keine konkurrierenden Cachekonventionen erzeugen.
2. Ein Frontend-Modul für Videoabfragen bereitstellen: normalisierte Filter, Sortierung, Seitengröße, Listen-ID und später Benutzer-ID ergeben einen Query-Key und einen Abfrageweg. Komponenten kennen keine Endpunktvarianten.
3. Wenn Laufzeitvalidierung benötigt wird, sie aus demselben Vertrag generieren oder durch ausdrückliche Vertragstests gegen Drift absichern. Handgeschriebene UI-Modelle dürfen abweichende Darstellungsbedürfnisse ausdrücken; sie werden dann explizit aus dem Transportmodell abgeleitet.
4. Backendseitig SQL-Abfrageaufbau und Antwortprojektion zusammenführen. Eigenständige Pydantic-Antwortobjekte erzeugen, statt ORM-Beziehungen für die Serialisierung zu überschreiben.
5. Liste und Detail dürfen unterschiedliche, bewusst benannte Modelle haben. Beide teilen jedoch dieselbe Feldwertsemantik und dieselben Projektionsteile.

**Erfolgskriterium:** Ein gespeicherter Feldwert bleibt beim Wechsel zwischen ungefilterter Liste, gefilterter Liste und Detailansicht erhalten. Ein Contract-Test prüft echte serialisierte Backend-Antworten gegen den verwendeten Frontend-Parser. CI erkennt veraltete generierte Dateien.

## 2. Transaktionen und Hintergrundarbeit einem Ablaufverantwortlichen zuordnen

**Befund:**

- `backend/app/core/database.py:get_db` committet am Ende des Requests. Parallel committen Router und einige Services selbst.
- `backend/app/api/videos.py:_enqueue_enrichment` stellt den Redis-Auftrag vor dem Commit des Enrichment-Datensatzes zu. `_enqueue_video_processing` committet umgekehrt zuerst und stellt danach zu.
- `backend/app/api/enrichment.py:retry_enrichment` stellt ebenfalls vor dem abschließenden Commit zu.
- `backend/app/api/processing.py:start_processing` committet den Job und startet mehrere Enqueues über `asyncio.gather`. Die Operationen werden dadurch gleichzeitig, aber nicht atomar ausgeführt.
- `backend/app/services/enrichment/enrichment_service.py` committet intern. Worker committen ebenfalls, zusätzlich entscheidet `backend/app/workers/settings.py:after_job_end` über Commit/Rollback.
- Metadatenbeschaffung und Anlegen von Videos existieren sowohl in HTTP-Importpfaden als auch in Workern und Abonnementverarbeitung.

**Folge:** Aufrufer müssen versteckte Reihenfolgen kennen. Rollback erfasst bereits committete Teiländerungen nicht. Ein schneller Worker kann noch nicht sichtbare Daten lesen; bei Redis-Ausfall können bereits gespeicherte Jobs ohne Zustellung zurückbleiben.

**Vorschlag:**

1. Benannte Anwendungsfälle einführen, etwa `ImportVideos`, `RequestEnrichment`, `RetryEnrichment` und `SetVideoFields`. HTTP, Cron und Worker rufen deren definierte Interfaces auf.
2. Für jeden Anwendungsfall festlegen, wer die Transaktion besitzt. Hilfsfunktionen schreiben bzw. flushen innerhalb dieser Transaktion und committen nicht selbst. Session-Erzeugung und Commit-Verantwortung werden ausdrücklich getrennt.
3. Video-/Jobänderung und Versandabsicht gemeinsam in PostgreSQL speichern. Ein Dispatcher überträgt committete Outbox-Einträge nach ARQ. Stabile Operation-IDs, Wiederholungszeitpunkt und ablaufende Claims machen einen Neustart beherrschbar.
4. Wiederholte Zustellung durch atomaren Claim bzw. konkurrierungssichere Statusänderung abfangen. Die vorhandene Prüfung „bereits completed?“ in `process_video` verhindert keine gleichzeitigen Starts zweier noch nicht abgeschlossener Ausführungen.
5. Externe Provider-Aufrufe außerhalb langer DB-Transaktionen ausführen: kurz claimen und committen, Provider aufrufen, Ergebnis anschließend mit passender Ausführungs-ID speichern. Ein veralteter Versuch darf einen neueren nicht überschreiben.
6. Ein gemeinsamer Metadatenablauf bedient Einzelimport, CSV und Abonnement. CSV behandelt Format und Zeilenfehler; es implementiert keine eigene Provider- und Channellogik.

**Abwägung:** Die Outbox bringt einen zusätzlichen Zustellungsprozess und Bereinigung mit. Sie adressiert hier eine konkrete DB-/Redis-Lücke. Eine einfachere Alternative wäre eine PostgreSQL-Jobtabelle, die Worker direkt abfragen; das würde jedoch die bestehende ARQ-Integration umfassender verändern. Zunächst ist die Outbox die passendere Weiterentwicklung.

**Erfolgskriterium:** Ein dauerhaft angenommener Auftrag wird nach Redis-Ausfall erneut zugestellt; konkurrierende Zustellung startet nicht gleichzeitig dieselbe Operation. Keine Garantie „exakt einmal“ für externe Provider behaupten, wenn deren Schnittstelle sie nicht unterstützt. Die [AWS-Beschreibung des Outbox-Musters](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) beschreibt genau diese Dual-Write-Problematik und die notwendige Behandlung von Duplikaten.

## 3. Verarbeitung und Fortschritt als explizites Zustandsmodell gestalten

**Befund:** `Video.processing_status`, `Video.import_stage`, `Video.import_progress`, `VideoEnrichment.status`, `ProcessingJob.status` und `JobProgressEvent.progress_data` bilden verschiedene Ausschnitte desselben Ablaufs ab. `update_stage` und `publish_progress` sind in beiden Video-/Enrichment-Workern vorhanden. Das Frontend kombiniert WebSocket-Zustand, Import-Store und Polling. `useWebSocket.ts:onOpen` setzt das Reconnect-Flag vor dessen Prüfung zurück.

**Vorschlag:**

- Importauftrag, einzelne Videoausführung und Gesamtergebnis unterscheiden. Metadaten können fertig sein, während Transkription noch läuft; teilweise Ergebnisse sind ausdrücklich zulässig.
- Erlaubte Übergänge zentral definieren, beispielsweise `pending → running → completed | partial | failed`; Wiederholung erzeugt einen neuen Versuch mit eigener ID. Stufen wie `metadata` oder `captions` beschreiben die Arbeit innerhalb einer Ausführung.
- Einen Fortschrittsdatensatz bzw. ein versioniertes Ereignisformat mit Operation-ID, Video-ID, Stufe, Ergebnis und serverseitiger Revision verwenden. Vorhandene Tabellen möglichst weiterverwenden, neue Tabellen nur für fehlende Semantik ergänzen.
- Fachlichen Status und wiederherstellbare Fortschritte in PostgreSQL halten. Redis verteilt Benachrichtigungen. Ein verlorenes Live-Ereignis darf weder Auftrag noch dauerhaftes Ergebnis verlieren.
- Ein appweites Fortschrittsmodul betreibt Verbindung, Wiederverbindung und Abgleich. Ein HTTP-Snapshot aktiver Aufträge dient als einfache Wiederherstellung; Ereignis-Replay mit Cursor ist eine weitergehende Option. Nicht allein auf Empfangszeitstempel des Browsers vertrauen.
- Fortschrittsereignisse aktualisieren die Anzeige; abgeschlossene Änderungen invalidieren gezielt die betroffenen Serverabfragen. Polling bleibt begrenzter Ersatz bei Verbindungsausfall.

**Abwägung:** WebSocket kann bleiben. Ein Wechsel zu SSE würde die zentrale Frage der Persistenz und Wiederherstellung nicht lösen. Ein vollständiges Event-Sourcing-System ist für diesen Bedarf unnötig.

**Erfolgskriterium:** Browserreload und Verbindungsabbruch stellen laufende Aufträge korrekt wieder her. Ein verspätetes Ereignis setzt abgeschlossene Arbeit nicht auf einen früheren Stand zurück. Teilweise erfolgreiche Anreicherung erscheint konsistent in Liste, Detail und Fortschrittsanzeige.

## 4. Felder, Kategorien und Extraktionsschemata fachlich klären

**Befund:**

- `BookmarkList.schema_id → Schema.fields` bildet ein JSONB-Extraktionsschema ab; daneben existiert `default_schema_id → FieldSchema → SchemaField → CustomField` für benutzerdefinierte Felder.
- `Video.extracted_data` und `VideoFieldValue` sind verschiedene Speicherorte. Der untersuchte `process_video` nimmt noch ein Schemaargument entgegen, die Gemini-Extraktion steht dort aber als TODO. Das ist kein Nachweis einer funktionierenden durchgängigen Extraktionspipeline.
- Feldzusammenstellung liegt in `app/api/helpers/field_union.py`; eine zweite Implementierung liegt in `app/services/field_aggregation.py`. Letztere hat in den untersuchten Produktionsdateien keinen Aufrufer. Sie sollte nicht als zweiter aktiver Laufzeitpfad dargestellt werden.
- Die API-Hilfsfunktion berücksichtigt Schemata aller Tags; die zweite Implementierung orientiert sich an der Kategorie. Regeln zur Kategoriezuweisung liegen bereits sinnvoll in `category_validation.py`, Wertvalidierung hingegen unter `app/api/field_validation.py`.
- Die Architekturübersicht beschreibt Tags als listenbezogen; das aktuelle Modell `Tag` besitzt dagegen `user_id`. `CustomField` und `FieldSchema` sind listenbezogen.

**Vorschlag:** Ein fachliches Feldmodul entscheidet über verfügbare Felder, Kategorien, Wertvalidierung, Schemawechsel und den Umgang mit bisherigen Werten. Die vorhandenen reinen Funktionen sind dafür gute Ausgangspunkte; Ladeoperationen und reine Regeln intern trennen.

Vor Datenmigrationen müssen drei Fragen entschieden und dokumentiert sein:

1. Sind KI-Ergebnisse Vorschläge für benutzerdefinierte Felder oder ein eigenständiger Datenbestand?
2. Sollen normale Labels Felder bereitstellen können oder ausschließlich Kategorien und das Listenschema?
3. Wie funktionieren benutzerweite Tags mit listenbezogenen Feldschemata bei Verwendung in mehreren Listen?

Empfehlung: Zunächst Begriffe trennen (`ExtractionSchema` und `FieldSchema`), Aufrufer inventarisieren und Regeln vereinheitlichen. Ein späteres Zusammenführen benötigt ein explizites Mapping und eine geprüfte Migration. KI-Ergebnisse sollten bei Übernahme in Benutzerfelder Herkunft und Ausführungs-/Schemaversion behalten; manuelle Bearbeitungen dürfen nicht still überschrieben werden.

Das relationale Grundmodell mit typisierten Feldwertspalten, Fremdschlüsseln und Eindeutigkeit bleibt erhalten. Flexible Konfiguration kann weiterhin JSONB sein.

**Erfolgskriterium:** Dieselbe Feldregel gilt für Detailansicht, Grid, CSV, Kategorieänderung und spätere KI-Übernahme. Nach einem Schemawechsel ist eindeutig, welche bisherigen Werte erhalten, verborgen oder entfernt werden.

## 5. Benutzer- und Listenkontext als Teil jedes Zugriffs behandeln

**Befund:** `api/deps.py` enthält eine WebSocket-Authentifizierung, jedoch keinen entsprechenden gemeinsamen HTTP-Benutzerresolver. Listenrouten lesen ohne Benutzerfilter; beim Erstellen kann `user_id` aus dem Request kommen. Video- und Feldzugriffe prüfen vielfach Existenz statt Eigentümerschaft. `App.tsx` wählt für `/videos` die erste Liste aus.

**Vorschlag:**

- Ein verifizierter `ActorContext` wird an jeden geschützten Anwendungsfall übergeben. Worker verwenden den gespeicherten Eigentümer und den Zielkontext des Auftrags.
- Zielobjekte und referenzierte Felder, Tags, Schemata und Kanäle müssen gemeinsam zu diesem Kontext passen. Die Prüfung darf nicht nur am Login oder beim Laden der Hauptressource stattfinden.
- Benutzerbezogene SQL-Auswahl an wenigen Modulinterfaces konzentrieren. Zusätzliche Datenbankconstraints dort einsetzen, wo die Zugehörigkeit sinnvoll relational ausdrückbar ist. PostgreSQL-RLS erst bei Bedarf und mit sauberem Connection-Kontext ergänzen.
- Aktive Liste ausdrücklich in Route/URL führen, beispielsweise `/lists/:listId/videos`. Filter, UI-Einstellungen und Query-Keys an Benutzer und Liste binden; Benutzerwechsel beendet Verbindung und verwirft alte Benutzerdaten.

**Abwägung:** Der konkrete Identitätsanbieter ist von dieser Struktur unabhängig. Das vorhandene Clerk-Konzept ist ein möglicher Adapter; seine Einrichtung ist keine Voraussetzung für die Definition des fachlichen Zugriffsinterfaces. FastAPI unterstützt die zentrale Auflösung gemeinsamer Abhängigkeiten über [Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/).

**Erfolgskriterium:** Zwei Benutzer und zwei Listen können sämtliche Zugriffe einschließlich Import, Export, Retry und Fremd-IDs prüfen. Fremde Ressourcen bleiben unzugänglich; ein Listenwechsel übernimmt keine veralteten Filter oder Daten einer anderen Liste.

## 6. Frontend nach Funktionen gliedern und Cachewissen zentralisieren

**Befund:** `VideosPage.tsx` umfasst im untersuchten Arbeitsstand 1.649 Zeilen, der Video-Router 2.658 und `useVideos.ts` 732. Die Größe allein ist kein Architekturfehler; entscheidend ist die Mischung von Dialogsteuerung, HTTP-Schreibzugriff, optimistischen Cacheänderungen, Import, Polling und Darstellung. Eine eigene Feldmutation liegt direkt in der Videoseite, zusätzlich zu `useUpdateVideoFieldValues`.

**Vorschlag:** Neue oder herausgelöste Logik wird nach Funktionen organisiert, beispielsweise `features/videos`, `features/fields`, `features/imports`, `features/subscriptions` und `features/player`. Gemeinsame UI-Primitiven bleiben in `components/ui`, Transportkonfiguration und generierte Typen gemeinsam zugänglich.

- Die Videoseite verbindet Filter, Ansichten und Dialoge. HTTP und Cacheänderungen liegen hinter dem Video-/Feldmodul.
- Ein Schreibweg pro Aktion bedient Grid, Modal und Detailseite. Query-Keys und Folgewirkungen liegen zusammen im jeweiligen Modul.
- TanStack Query hält Serverdaten. Zustand speichert UI-Präferenzen und lokale Arbeitszustände; Fortschritt besitzt eine klar benannte Zuständigkeit.
- Detailwerte können nach erfolgreicher Mutation direkt aktualisiert werden. Gefilterte/paginierte Listen werden invalidiert, sobald Zugehörigkeit oder Sortierung betroffen sind. Das wahllose Anhängen neuer Videos an sämtliche Filtercaches in `useCreateVideo` entfällt.
- Optimistische Änderungen nur mit definiertem Fehler- und Konkurrenzverhalten verwenden. Eine spätere fehlgeschlagene Mutation darf nicht die erfolgreiche Änderung einer anderen Mutation durch einen alten Snapshot zurückrollen.

Die [TanStack-Dokumentation zur Invalidierung nach Mutationen](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations) beschreibt den vorhandenen Mechanismus; benötigt wird vor allem eine einheitliche Zuordnung im Projekt.

**Erfolgskriterium:** Ein neuer Aufrufer für „Feldwert ändern“ benötigt kein eigenes Wissen über Listen-, Detail-, Schema- und Feldwertcaches. Eine neue Videoansicht kann vorhandene Abfragen und Aktionen unverändert benutzen.

## 7. Datenmenge und Providerzugriffe begrenzen

**Befund:** Die Listen- und Filterrouten liefern vollständige Videoarrays. Feldwerte und Schemata werden bereits teilweise sinnvoll batchweise geladen, allerdings für die gesamte Treffermenge. Providerclients werden an mehreren Stellen erzeugt. `AdaptiveRateLimiter` benutzt prozesslokale Semaphoren; `QuotaService` trennt Verfügbarkeitsprüfung und spätere Verbrauchsbuchung.

**Vorschlag:**

- Einen paginierten Video-Abfragevertrag mit stabiler Sortierung einschließlich ID, Gesamtzahl und begrenzter Seitengröße einführen. Listenabfrage, Zählung und Export teilen sich die Filterdefinition. Export arbeitet über alle Treffer in begrenzten Batches.
- Zuerst Offsetpagination verwenden; Cursor nur bei passendem Nutzungsfall oder gemessener Notwendigkeit. Kartenvirtualisierung löst keine unbegrenzten API-Antworten.
- Providerabhängigkeiten beim Start zusammensetzen und injizieren. Die vorhandene `CaptionProvider`-Schnittstelle mit YouTube-/Groq-Alternativen ist eine gute bestehende Abstraktion.
- Fachliche Fehler wie „nicht verfügbar“, „temporär fehlgeschlagen“ und „Budget erschöpft“ einheitlich behandeln. Retryregeln, Timeouts und Ausführungs-IDs gehören in den gemeinsamen Ablauf.
- Vor mehreren Workerinstanzen gemeinsame Providerbudgets atomar reservieren. Ein prozesslokales Parallelitätslimit bleibt eine lokale Schutzmaßnahme und ist keine globale Begrenzung.

**Erfolgskriterium:** 10.000 gespeicherte Videos verursachen weiterhin begrenzte Antworten und begrenztes Rendering. Ein Ausfall von Untertiteln verhindert nicht die Speicherung erfolgreicher Metadaten. Die globale Providerlast steigt nicht unkontrolliert mit der Workeranzahl. Laufzeitgewinne sind anschließend zu messen; hier wurden keine Benchmarks durchgeführt.

## Zielaufteilung und Abhängigkeitsregeln

| Backend-Modul | Zuständigkeit | Beispiel für das externe Interface |
| --- | --- | --- |
| Library | Listen, Videozuordnung, Abfragen und Antwortprojektionen | `query_videos(actor, list_id, query)` |
| Fields | Felddefinitionen, Verfügbarkeit, Kategorien und Werte | `set_video_fields(actor, video_id, updates)` |
| Imports | Eingabeformate, Zeilenresultate und Importannahme | `import_videos(actor, list_id, source)` |
| Processing | Ausführungen, Stufen, Retry, Claims und Status | `request_enrichment(actor, video_id)` |
| Subscriptions | Suchregeln, Treffer und geplante Auslösung | `process_subscription_match(operation_id)` |
| Infrastructure | DB, Redis/ARQ, Providertransport und Konfiguration | konkrete Adapter für benötigte Interfaces |

Die Namen sind ein Zielvorschlag, keine Vorgabe für sofort anzulegende Pakete. Die Anwendungsfälle bündeln Verhalten hinter kleinen Interfaces. Router übersetzen HTTP und Fehler; Worker übersetzen Queue-Nachrichten. Fachmodule importieren keine Router. Modulinterne SQLAlchemy-Abfragen bleiben erlaubt; ein generisches Repository pro Tabelle wäre zunächst eine zusätzliche Schicht ohne nachgewiesenen Nutzen. Neue Interfaces entstehen dort, wo tatsächlich Transport, Provider oder Tests andere Implementierungen benötigen.

## Empfohlene Reihenfolge

Aufwand ist relativ und keine Zeit- oder Kostenzusage.

| Etappe | Inhalt | Nutzen | Aufwand |
| --- | --- | --- | --- |
| 1 | Video-Antwortvertrag, Parser und Feldmutation vereinheitlichen | Behebt unmittelbar unterschiedliche Ansichten und schafft eine überprüfbare Modulgrenze | mittel |
| 2 | Benutzer-/Listenkontext und geschützte Auswahl etablieren | Verhindert falsche Zugriffe und legt den Kontext für alle weiteren Module fest | groß |
| 3 | Import/Enrichment als Anwendungsfälle, Transaktionsbesitz, Outbox und Claims | Verhindert verlorene und konkurrierende Hintergrundarbeit | groß |
| 4 | Verarbeitungszustand und Fortschrittsabgleich vereinheitlichen | Macht Ausfälle, Reloads und Retry verständlich und beherrschbar | mittel bis groß |
| 5 | Feld-/Schemasemantik klären und in ein Modul überführen | Verhindert auseinanderlaufende Fachregeln | mittel bis groß |
| 6 | Abfragen paginieren, Providerbudgets und Betriebsnachweise ergänzen | Begrenzt Last und schafft eine messbare Betriebsgrundlage | mittel bis groß |

Fachliche Extraktionen und Frontendaufteilung erfolgen jeweils innerhalb dieser Etappen. Ein separates großes „erst alle Ordner umsortieren“-Projekt bringt wenig. Bei geplantem Mehrbenutzerbetrieb hat Etappe 2 Vorrang vor jeder öffentlichen Freigabe. Die grundlegenden Build-/Testprobleme des Stabilisierungsplans müssen vor größeren Verhaltensänderungen geklärt sein.

**Erster überschaubarer Umbau:** „Feldwert im Modal ändern“ als durchgängigen Schnitt auswählen. Backend liefert eine ausdrückliche Antwortprojektion; ein gemeinsamer Transportvertrag erhält alle benötigten Felder; ein Feld-Schreibinterface aktualisiert bzw. invalidiert Grid und Detail. Regressionen prüfen mit und ohne Filter, neues und vorhandenes Feld, Fehlerfall und parallele Änderungen. Danach wird genau derselbe Weg aus der Detailseite verwendet. So entsteht eine bewertbare Vorlage für weitere Umbauten.

## Absicherung der Architektur

- Reine Fachregeln über kleine Interfaces testen: Feldunion, Kategoriezuweisung, Zustandsübergänge, Filterkanonisierung.
- PostgreSQL-Integrationstests für Transaktionen, konkurrierende Claims, Eigentümerschaft, Constraints und Alembic-Migrationen verwenden. ORM-`create_all` allein belegt keine funktionierenden Migrationen.
- Aufträge mit kontrollierten Ausfällen prüfen: DB-Rollback, Redis-Ausfall, doppelte Zustellung, Workerabbruch und verspätetes Providerergebnis.
- Wenige durchgängige UI-Tests über die echten Modulinterfaces führen; externe Provider an ihren Adaptern ersetzen. Die derzeitigen globalen Mocks und Patchlisten nicht als einzige Nachweise verwenden.
- In CI Build, Tests, Migrationen und API-Vertragsdrift prüfen; einfache Importregeln verhindern beispielsweise Abhängigkeiten von Fachmodulen auf `api/`.
- Request-ID, Operation-ID, Video-ID und Versuch gemeinsam protokollieren. Wartende Outbox-Einträge, Auftragsalter, endgültige Fehler und Providerlatenzen messbar machen. Liveness und Readiness unterscheiden.

Das angestrebte Ergebnis ist eine App, bei der eine fachliche Änderung an einer Stelle implementiert wird und sich über ein kleines, überprüfbares Interface durch alle Ansichten und Ausführungswege zieht.
