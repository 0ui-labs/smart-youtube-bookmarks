# Dauerhafte Aufträge und Readiness

Requests speichern Datensatz und Outbox-Absicht in derselben PostgreSQL-Transaktion.
Erfolg bedeutet dauerhaft angenommen. Nur der Dispatcher überträgt committete
Absichten nach Redis/ARQ. Stabile Operation-IDs und PostgreSQL-Advisory-Locks
verhindern parallele Providerarbeit am selben Ziel. Redis-Ausfälle bleiben mit
Backoff wiederholbar; sie verbrauchen kein endgültiges Handler-Fehlerbudget.

Eine Handler-Exception wird höchstens fünfmal automatisch ausgeführt. Danach bleibt
die Operation `failed` erhalten. Ein expliziter Retry erzeugt eine neue ID mit
`payload.retry_of`; doppelte Retry-Anforderungen für dieselbe fehlgeschlagene
Operation verwenden denselben Folgeauftrag. Auch vom Handler gemeldete fachliche
Fehler bleiben sichtbar. Nach einem Absturz zwischen Providerantwort und lokalem
Commit kann ein Provider ohne Idempotenz erneut aufgerufen werden.

Operator-Diagnose (lokal, keine öffentliche HTTP-Route):

```bash
cd backend
OUTBOX_DATABASE_URL=postgresql+asyncpg://test:test@localhost:55438/bookmarks_test \
  .venv/bin/python scripts/outbox_status.py
# Bewusste Mutation, zunächst Diagnose/Operation-ID prüfen:
OUTBOX_DATABASE_URL=... .venv/bin/python scripts/outbox_status.py --retry UUID --apply
OUTBOX_DATABASE_URL=... .venv/bin/python scripts/outbox_status.py --prune-completed --apply
```

Ohne `OUTBOX_DATABASE_URL` wird keine Verbindung geöffnet. Ohne `--apply` werden
keine Operationen verändert. Die Ausgabe enthält Statuszahlen, bis zu 100 offene
Operationen, abgelaufene Leases und bis zu 100 Pending-Videos ohne aktive Operation;
keine Payloads, Tokens oder Provider-Fehlertexte. Betreiberzugriff auf diese CLI
setzt direkten Datenbankzugriff voraus. Sie ist kein Benutzerendpunkt.

Erledigte Operationen werden nach mindestens 30 Tagen in Batches von höchstens
100 Einträgen bereinigt, per Cron alle 15 Minuten. Offene und fehlgeschlagene
Operationen werden niemals automatisch gelöscht. Verwaiste Videos werden vom
bestehenden Recovery-Job mit derselben Ziel-Deduplizierung erneut angenommen.
Hub-Lease-Erneuerung und manuelle Abo-Synchronisation speichern ebenfalls dauerhafte
Absichten; Poll-/Ablaufzeitpunkte werden erst durch den Worker aktualisiert.

`GET /api/health` zeigt ausschließlich Prozess-Liveness. `GET /api/ready` prüft mit
je zwei Sekunden Obergrenze die Outbox-Tabelle, Redis-Ping und einen höchstens
60 Sekunden alten Dispatcher-Heartbeat. HTTP 200 erfordert alle drei; sonst 503.
Der Heartbeat wird bei jedem erfolgreichen Dispatcher-Zyklus erneuert. Die Antwort
enthält nur drei Booleans. Ein laufender API-Prozess allein ist keine Betriebsfreigabe.
