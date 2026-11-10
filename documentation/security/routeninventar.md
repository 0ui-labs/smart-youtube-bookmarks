# HTTP-Zugriffsinventar

Aus FastAPI-Routen am 10.11.2026 erzeugt. Die signierte synthetische Matrix
prüft jeden fachlichen HTTP-Einstieg auf 401 sowie alle Ressourcenpfade auf
404 für fremde IDs. WebSocket `/api/ws/progress`: nur Einmal-Ticket.
OpenAPI/Swagger enthalten keine Anwendungsdaten.

| Methode | Pfad | Schutz |
| --- | --- | --- |
| POST | `/api/auth/ws-ticket` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/lists/{list_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/videos` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/videos` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/videos/filter` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/videos/{video_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PATCH | `/api/videos/{video_id}/progress` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/videos` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/videos/{video_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/videos/bulk` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/export/csv` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/videos/bulk/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/videos/{video_id}/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/videos/{video_id}/tags/{tag_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/videos/{video_id}/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/videos/{video_id}/category` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/videos/{video_id}/fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/process` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/jobs/{job_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/jobs/{job_id}/pause` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/jobs/{job_id}/progress-history` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/tags/{tag_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/tags/{tag_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/tags/{tag_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/custom-fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/custom-fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}/custom-fields/{field_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/lists/{list_id}/custom-fields/{field_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/custom-fields/check-duplicate` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/schemas` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/schemas/{schema_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/schemas` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}/schemas/{schema_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/lists/{list_id}/schemas/{schema_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/schemas/{schema_id}/fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/schemas/{schema_id}/fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}/schemas/{schema_id}/fields/batch` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/analytics` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/channels` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PATCH | `/api/channels/{channel_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/channels/{channel_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/videos/{video_id}/enrichment` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/videos/{video_id}/enrichment/retry` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/search` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/subscriptions` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/subscriptions/quota` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/subscriptions` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/subscriptions/{subscription_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/subscriptions/{subscription_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/subscriptions/{subscription_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/subscriptions/{subscription_id}/sync` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/subscriptions/{subscription_id}/matches` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/chat/subscription` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/chat/subscription/create` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/webhooks/pubsubhubbub` | HMAC/erwartetes Topic; separate öffentliche DB-Sitzung |
| POST | `/api/webhooks/pubsubhubbub` | HMAC/erwartetes Topic; separate öffentliche DB-Sitzung |
| GET | `/api/health` | Minimaler öffentlicher Health-Check |
