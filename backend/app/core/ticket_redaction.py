"""Remove ephemeral ticket values from the ASGI scope used by access logging."""

from urllib.parse import parse_qs

from starlette.types import ASGIApp, Receive, Scope, Send


class TicketRedactionMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "websocket":
            query = parse_qs(
                scope.get("query_string", b"").decode("ascii", errors="ignore")
            )
            tickets = query.get("ticket", [])
            scope["connection_ticket"] = tickets[0] if len(tickets) == 1 else None
            # Mutate the original scope before accept/reject access logging.
            scope["query_string"] = b"ticket=redacted" if tickets else b""
        await self.app(scope, receive, send)
