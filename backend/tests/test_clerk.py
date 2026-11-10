"""Real RSA signatures and simulated Clerk JWKS; no provider/account required."""

import time
from unittest.mock import AsyncMock

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
)
from jose import jwk, jwt

from app.core.clerk import ClerkVerifier, InvalidSession


@pytest.fixture
def identity_keys():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    public = jwk.construct(pem, algorithm="RS256").to_dict()
    public.pop("d", None)
    return pem, public


def session_token(pem, **overrides):
    now = int(time.time())
    claims = {
        "sub": "user_synthetic_a",
        "iss": "https://clerk.test",
        "azp": "http://localhost:5173",
        "iat": now,
        "nbf": now - 1,
        "exp": now + 60,
        **overrides,
    }
    return jwt.encode(claims, pem, algorithm="RS256", headers={"kid": "key-a"})


@pytest.fixture
def verifier(identity_keys):
    instance = ClerkVerifier("https://clerk.test", ["http://localhost:5173"])
    instance._keys = {"key-a": identity_keys[1]}
    instance._expires = time.monotonic() + 300
    instance._last_refresh = time.monotonic()
    return instance


async def test_valid_signed_session(verifier, identity_keys):
    assert (await verifier.verify(session_token(identity_keys[0])))[
        "sub"
    ] == "user_synthetic_a"


@pytest.mark.parametrize(
    "claims",
    [
        {"exp": 0},
        {"nbf": int(time.time()) + 600},
        {"iss": "https://other.test"},
        {"azp": "https://evil.test"},
        {"azp": None},
        {"sub": ""},
        {"sts": "pending"},
    ],
)
async def test_invalid_claims_rejected(verifier, identity_keys, claims):
    with pytest.raises(InvalidSession):
        await verifier.verify(session_token(identity_keys[0], **claims))


async def test_wrong_signature_and_algorithm_rejected(verifier):
    forged = jwt.encode(
        {"sub": "user_synthetic_a"},
        "synthetic-test-only",
        algorithm="HS256",
        headers={"kid": "key-a"},
    )
    with pytest.raises(InvalidSession):
        await verifier.verify(forged)


async def test_missing_configuration_fails_closed(identity_keys):
    with pytest.raises(InvalidSession):
        await ClerkVerifier("", []).verify(session_token(identity_keys[0]))


async def test_unknown_key_refreshes_once_and_uses_cached_key(
    verifier, identity_keys, monkeypatch
):
    verifier._keys = {}
    verifier._last_refresh = time.monotonic() - 31

    async def refresh():
        verifier._keys = {"key-a": identity_keys[1]}
        verifier._last_refresh = time.monotonic()
        verifier._expires = time.monotonic() + 300

    refresh_mock = AsyncMock(side_effect=refresh)
    monkeypatch.setattr(verifier, "_refresh", refresh_mock)
    for _ in range(2):
        await verifier.verify(session_token(identity_keys[0]))
    assert refresh_mock.await_count == 1


async def test_audience_is_checked_when_configured(verifier, identity_keys):
    verifier.audience = "bookmarks"
    with pytest.raises(InvalidSession):
        await verifier.verify(session_token(identity_keys[0], aud="other"))
    assert await verifier.verify(session_token(identity_keys[0], aud="bookmarks"))


async def test_real_jwks_parser_caches_and_rotates(identity_keys, monkeypatch):
    import httpx

    requests = []
    current_kid = "key-a"

    def endpoint(request):
        requests.append(str(request.url))
        return httpx.Response(
            200, json={"keys": [{**identity_keys[1], "kid": current_kid, "use": "sig"}]}
        )

    client_class = httpx.AsyncClient
    monkeypatch.setattr(
        "app.core.clerk.httpx.AsyncClient",
        lambda **kwargs: client_class(
            transport=httpx.MockTransport(endpoint), **kwargs
        ),
    )
    instance = ClerkVerifier("https://clerk.test", ["http://localhost:5173"])
    await instance.verify(session_token(identity_keys[0]))
    await instance.verify(session_token(identity_keys[0]))
    assert requests == ["https://clerk.test/.well-known/jwks.json"]
    current_kid = "key-b"
    instance._last_refresh = time.monotonic() - 31
    token = session_token(identity_keys[0])
    claims = jwt.get_unverified_claims(token)
    rotated = jwt.encode(
        claims, identity_keys[0], algorithm="RS256", headers={"kid": "key-b"}
    )
    assert await instance.verify(rotated)
    assert len(requests) == 2
    with pytest.raises(InvalidSession):
        await instance.verify(token)
    assert len(requests) == 2
