# Lokale Anmeldung und Benutzerisolation

Die App benötigt eine **vorhandene** Clerk-Anwendung. Der Code richtet keine
Provider-Ressource ein. Ohne Konfiguration bleibt die Oberfläche gesperrt und
jeder fachliche HTTP-Endpunkt antwortet ohne gültige Sitzung mit 401.

## Konfiguration

Frontend: `VITE_CLERK_PUBLISHABLE_KEY` der bestehenden Anwendung.
Backend: `CLERK_ISSUER` (HTTPS), `CLERK_AUTHORIZED_PARTIES` als kommagetrennte
Liste exakter Frontend-Origins, gegebenenfalls `CLERK_AUDIENCE` entsprechend
der bestehenden Session-Konfiguration. Die normale Clerk-Session benötigt
keinen selbst erfundenen Audience-Wert. Für JWT-Prüfung über öffentliches JWKS
ist kein Clerk-Backend-Secret nötig. Secrets ausschließlich über den vorgesehenen
privaten Secret-Kanal übergeben; keine Tokens in Chat, Git oder localStorage.

Verifizierter Ausgangspunkt: offizielle [JWT-Prüfung](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
und [React-Einrichtung](https://clerk.com/docs/react/getting-started/quickstart),
am 10.11.2026 geprüft. Installiert ist `@clerk/react` 6.18.6; kein CLI-`init`
und keine neue Provider-Anwendung. RS256, Issuer, Ablaufzeit, nbf, iat, Subject,
Authorized Party und optional Audience werden lokal geprüft. JWKS wird fünf
Minuten gecacht; unbekannte Schlüssel lösen höchstens alle 30 Sekunden eine
Rotation aus. Während dieser kurzen Begrenzung werden unbekannte Schlüssel
abgelehnt, niemals ungeprüft angenommen.

HTTP-Sitzungen erhalten einen obligatorischen Benutzerscope. Referenzen in
Pfad, Query und JSON werden vor fachlichen Änderungen geprüft. Fremde und
nicht vorhandene Ressourcen ergeben denselben 404-Vertrag. Das
[Routeninventar](security/routeninventar.md) nennt die Einstiegspunkte.

WebSockets erhalten über `POST /api/auth/ws-ticket` eine 60 Sekunden gültige,
einmal nutzbare Berechtigung. Redis speichert ausschließlich deren Hash und
Benutzer-ID; atomisches GETDEL verhindert parallele Wiederverwendung. Die
ASGI-Schicht redigiert die Ticket-Query vor Accept-/Reject-Logging. Es gibt
keine Entwicklungsausnahme mit erstem Benutzer und keinen Legacy-JWT-Fallback.

Beim Wechsel der Clerk-Sitzung werden private Ansichten vor neuen Requests
ausgehängt, laufende Requests abgebrochen und Auswahl-/Filter-/Chat-/Import-
und Tabellenspeicher zurückgesetzt. Jede Anmeldung erhält einen neuen Query-
Cache. Verspätete Callbacks der vorherigen Sitzung erreichen diesen Cache nicht.

## Bestehende Daten explizit zuordnen

Ein Login legt ausschließlich eine neue lokale Identität für die verifizierte
Clerk-ID an. E-Mail-Adressen sind kein Verknüpfungsschlüssel. Legacy-Benutzer
mit leerer Clerk-ID bleiben unverändert und werden keinem ersten Login zugeordnet.

Nach geprüftem Datenbankbackup:

```sh
cd backend
# Die explizite Ziel-URL über die lokale Umgebung setzen, niemals hier eintragen.
.venv/bin/python -m scripts.transfer_legacy_ownership \
  --source-user-id <legacy-uuid> --target-clerk-id <bestehende-clerk-id>
```

Der Aufruf ist ein Dry-Run. Zur Anwendung sind zusätzlich `--apply`,
`--backup-file <vorhandene-nichtleere-backup-datei>` und `--backup-confirmed`
erforderlich. Ausschließlich `LEGACY_TRANSFER_DATABASE_URL` wird akzeptiert,
keine automatische Anwendungs-URL. Bei Constraints/Kollisionen muss die ganze
Transaktion zurückgerollt und die Datenzuordnung vor einem neuen Versuch
geprüft werden. Ein wiederholter erfolgreicher Transfer findet keine Restdaten.
Das Skript wurde hier nur mit synthetischen Daten geprüft.

## Öffentliche WebSub-Ausnahme

`PUBSUB_SIGNING_SECRET` muss aus der bestehenden Betriebsumgebung kommen.
Ohne diesen Wert wird keine unsignierte Subscription eingerichtet; eingehende
Zustellungen werden abgelehnt. `hub.secret` wird bei der Anmeldung übermittelt.
Die Zustellung benötigt eine gültige HMAC-Signatur, darf maximal 256 KiB groß
sein und nur aktive, erwartete Kanäle betreffen. SHA-1 wird für ältere Hubs gemäß
[WebSub](https://www.w3.org/TR/websub/) unterstützt; SHA-256/384/512 ebenfalls.
GET-Verifikation akzeptiert nur exakte YouTube-Feed-URLs und erwartete Topics;
Challenges werden begrenzt mit `application/octet-stream` und `nosniff` ausgegeben.

Der SHA-256-Digest jeder angenommenen Zustellung bleibt für Replay-Erkennung
persistiert, ohne Rohinhalt oder Credentials. Digest und Outbox werden gemeinsam
committet. Änderungen an Abonnements erzeugen dauerhafte Abgleichaufträge;
das Löschen eines Abonnenten meldet einen von anderen Benutzern weiterhin
benötigten Kanal nicht ab. Kein echter Google-Hub-Aufruf wurde zur Abnahme
vorgenommen. Dessen tatsächliche Signatur-/Callback-Unterstützung bleibt separat
mit vorhandener Konfiguration nachzuweisen.

## Manuelle Account-Deaktivierung

Zunächst Clerk-Sitzungen über die bestehende Administration widerrufen und den
zugehörigen lokalen Benutzer explizit deaktivieren (`is_active=false`). Danach
werden HTTP-Requests und neue Socket-Tickets verweigert. Bestehende Verbindungen
und laufende Jobs im Betriebsprozess gezielt beenden. Daten bleiben erhalten;
eine automatische Kaskadenlöschung ist kein Bestandteil dieses Plans.

## Nachweise

Echte lokale RSA-Signaturen, ASGI-Routen und PostgreSQL-Benutzerscope sind mit
synthetischen A/B-Identitäten geprüft. Redis-Ticketverbrauch ist auf der separaten
realen Testinstanz geprüft. Frontend-Anmeldung und Benutzerwechsel sind mit
simuliertem Clerk-Zustand getestet. Das ersetzt **nicht** die ausstehende echte
Clerk-Anmeldung im Browser, Refresh/Logout/A→B und den realen Hub-Nachweis.
