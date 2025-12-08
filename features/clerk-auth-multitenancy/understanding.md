# Feature Understanding: Clerk Authentication & Multi-Tenancy

## Feature Summary

**In 2-3 Sätzen:** Die App soll mit Clerk-Authentifizierung ausgestattet werden, um User-Accounts mit sicherer Anmeldung (Email/Passwort, Social Login, Magic Links) zu ermöglichen. Alle Daten werden User-basiert isoliert, sodass jeder User nur seine eigenen Bookmark-Listen, Videos, Tags und Channels sieht.

## Anforderungen

### Multi-Tenancy Typ
- **User-basiert** (nicht Organization-basiert)
- Jeder User hat eigene, isolierte Daten
- Kein Team-Sharing geplant (vorerst)
- Schema bereits vorbereitet (`user_id` FK überall vorhanden)

### Authentifizierungs-Methoden
| Methode | Priorität | Beschreibung |
|---------|-----------|--------------|
| Email + Passwort | P1 | Klassische Registrierung mit Email-Verifizierung |
| Google OAuth | P1 | "Continue with Google" |
| GitHub OAuth | P2 | Für Developer-Zielgruppe |
| Magic Links | P2 | Passwordless login via Email |

### Datenmigration
- **Bestehende Test-Daten:** Hardcoded `test@example.com` User
- **Migrationsstrategie:** Test-User-Daten dem ersten echten Clerk-User zuordnen
- **Risiko:** Niedrig (nur Entwicklungsdaten)

## Warum dieses Feature?

1. **Sicherheit:** Aktuell sind alle Endpoints ungeschützt - jeder kann alle Daten sehen
2. **Multi-User-Fähigkeit:** App soll von mehreren Personen nutzbar sein
3. **Personalisierung:** User-spezifische Tags, Schemas, Einstellungen
4. **Zukunftssicherheit:** Basis für spätere Features (Sharing, Collaboration)

## Erwartetes Verhalten

### Nicht eingeloggt
- Redirect zu Clerk Sign-In/Sign-Up Page
- Kein Zugriff auf App-Funktionalität
- Landing Page (optional, später)

### Eingeloggt
- Voller Zugriff auf eigene Daten
- Automatische Token-Injection in API-Calls
- Session bleibt über Browser-Refresh erhalten
- Logout-Funktion in UI

### API-Verhalten
- Alle Endpoints erfordern gültigen JWT
- 401 Unauthorized bei fehlendem/ungültigem Token
- Queries automatisch nach `user_id` gefiltert

## Scope Boundaries

### In Scope ✅
- Clerk-Integration (Frontend + Backend)
- User-basierte Datenisolation
- Protected Routes
- Sign In / Sign Up / Sign Out Flows
- JWT-Verification im Backend
- Migration des Test-Users

### Out of Scope ❌
- Organization/Team Features
- Role-Based Access Control (RBAC)
- User Profile Editing (nutzt Clerk's UI)
- Password Reset (handled by Clerk)
- Email Verification (handled by Clerk)

## Edge Cases

| Szenario | Handling |
|----------|----------|
| User löscht Account bei Clerk | Cascade Delete in DB? Oder Soft-Delete? |
| Token expired während Session | Auto-Refresh via Clerk SDK |
| Erster Login (neuer User) | User in DB anlegen mit `clerk_id` |
| WebSocket-Verbindung | Token via Query-Parameter oder Header |
| API-Call während Logout | Graceful 401, Redirect zu Login |

## Offene Fragen

1. **Account Deletion:** Was passiert mit User-Daten wenn Clerk-Account gelöscht wird?
2. **WebSocket Auth:** Query-Param Token oder eigenes Auth-Handshake?
3. **Test-User Migration:** Automatisch dem ersten User zuweisen oder manuell?

---

**Exit Condition:** ✅ Feature in 2-3 Sätzen erklärbar, Scope klar definiert
