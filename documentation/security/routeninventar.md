# HTTP-Zugriffsinventar

Aus dem laufenden lokalen Backend am 10.11.2026 erzeugt. Die signierte synthetische
Matrix prüft jeden fachlichen HTTP-Einstieg auf 401 und fremde Ressourcenpfade auf
404. OpenAPI/Swagger enthalten nur Schnittstellenmetadaten. WebSocket
`/api/ws/progress` benötigt ein einmaliges, sitzungsgebundenes Ticket.

| Methode | Pfad | Schutz |
| --- | --- | --- |
| POST | `/api/auth/ws-ticket` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/channels` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/channels/{channel_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PATCH | `/api/channels/{channel_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/chat/subscription` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/chat/subscription/create` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/health` | Öffentlich, ausschließlich Prozess-Liveness |
| GET | `/api/jobs/{job_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/jobs/{job_id}/pause` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/jobs/{job_id}/progress-history` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/lists/{list_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/analytics` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/custom-fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/custom-fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/custom-fields/check-duplicate` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/lists/{list_id}/custom-fields/{field_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}/custom-fields/{field_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/export/csv` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/export/csv` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/process` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/schemas` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/schemas` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/lists/{list_id}/schemas/{schema_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/schemas/{schema_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}/schemas/{schema_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/schemas/{schema_id}/fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/schemas/{schema_id}/fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}/schemas/{schema_id}/fields/batch` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/lists/{list_id}/schemas/{schema_id}/fields/{field_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/videos` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/videos` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/videos/bulk` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/videos/filter` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/videos/filter/page` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/videos/import-status` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/lists/{list_id}/videos/lookup` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/lists/{list_id}/videos/page` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/ready` | Öffentlich, nur DB-/Queue-/Worker-Booleans; keine Fehlerdetails |
| GET | `/api/search` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/subscriptions` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/subscriptions` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/subscriptions/quota` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/subscriptions/{subscription_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/subscriptions/{subscription_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/subscriptions/{subscription_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/subscriptions/{subscription_id}/matches` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/subscriptions/{subscription_id}/sync` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/tags/{tag_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/tags/{tag_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/tags/{tag_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/videos` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/videos/bulk/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/videos/{video_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/videos/{video_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/videos/{video_id}/category` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/videos/{video_id}/enrichment` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/videos/{video_id}/enrichment/retry` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PUT | `/api/videos/{video_id}/fields` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| PATCH | `/api/videos/{video_id}/progress` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/videos/{video_id}/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| POST | `/api/videos/{video_id}/tags` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| DELETE | `/api/videos/{video_id}/tags/{tag_id}` | Clerk-Sitzung, DB-Benutzerscope und Referenzprüfung |
| GET | `/api/webhooks/pubsubhubbub` | Öffentlich, erwartetes Topic; POST zusätzlich HMAC/Größenlimit/Replay-Digest |
| POST | `/api/webhooks/pubsubhubbub` | Öffentlich, erwartetes Topic; POST zusätzlich HMAC/Größenlimit/Replay-Digest |
