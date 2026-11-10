"""Clerk session verification with a bounded, rotating JWKS cache.

Only configured HTTPS issuers are contacted; JWT headers never select a URL.
No secret key or Clerk backend request is needed for signature verification.
"""

import asyncio
import time
from typing import Any
from urllib.parse import urlparse

import httpx
from jose import JWTError, jwt


class InvalidSession(ValueError):
    """Missing configuration, unavailable keys or an invalid session token."""


class ClerkVerifier:
    def __init__(
        self, issuer: str, authorized_parties: list[str], audience: str | None = None
    ) -> None:
        self.issuer = issuer.rstrip("/")
        self.authorized_parties = frozenset(authorized_parties)
        self.audience = audience
        self._keys: dict[str, dict[str, Any]] = {}
        self._expires = 0.0
        self._last_refresh = float("-inf")
        self._lock = asyncio.Lock()

    async def _refresh(self) -> None:
        async with httpx.AsyncClient(timeout=5, follow_redirects=False) as client:
            response = await client.get(f"{self.issuer}/.well-known/jwks.json")
            response.raise_for_status()
            if len(response.content) > 65536:
                raise InvalidSession("Invalid key set")
            document = response.json()
            if not isinstance(document, dict) or not isinstance(
                document.get("keys"), list
            ):
                raise InvalidSession("Invalid key set")
            keys = document["keys"]
            self._keys = {
                key["kid"]: key
                for key in keys
                if isinstance(key, dict)
                and isinstance(key.get("kid"), str)
                and key.get("kty") == "RSA"
                and key.get("use", "sig") == "sig"
                and key.get("alg", "RS256") == "RS256"
            }
            self._last_refresh = time.monotonic()
            self._expires = self._last_refresh + 300

    async def verify(self, token: str) -> dict[str, Any]:
        parsed = urlparse(self.issuer)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.query
            or parsed.fragment
            or not self.authorized_parties
        ):
            raise InvalidSession("Authentication is not configured")
        if not token or len(token) > 16384:
            raise InvalidSession("Invalid session")
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
                raise InvalidSession("Invalid session")
            kid = header["kid"]
            async with self._lock:
                now = time.monotonic()
                if now >= self._expires or (
                    kid not in self._keys and now - self._last_refresh >= 30
                ):
                    await self._refresh()
                key = self._keys.get(kid)
            if key is None:
                raise InvalidSession("Unknown signing key")
            claims: dict[str, Any] = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=self.issuer,
                audience=self.audience,
                options={
                    "require_exp": True,
                    "require_nbf": True,
                    "require_iat": True,
                    "require_sub": True,
                    "verify_aud": bool(self.audience),
                },
            )
            if (
                claims.get("azp") not in self.authorized_parties
                or claims.get("sts") == "pending"
            ):
                raise InvalidSession("Invalid session")
            subject = claims.get("sub")
            if not isinstance(subject, str) or not subject or len(subject) > 255:
                raise InvalidSession("Invalid subject")
            return claims
        except (JWTError, httpx.HTTPError, KeyError, TypeError, ValueError) as error:
            raise InvalidSession("Invalid session") from error
