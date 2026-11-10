"""Actual ASGI routes, RSA-signed synthetic sessions and isolated PostgreSQL."""

import re
import time
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient
from jose import jwk, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.clerk import ClerkVerifier, get_clerk_verifier
from app.main import app
from app.models import (
    BookmarkList,
    Channel,
    CustomField,
    FieldSchema,
    ProcessingJob,
    Subscription,
    Tag,
    User,
    Video,
)
from app.models.job_outbox import JobOutbox


@pytest.fixture
async def isolated_api(test_db, test_engine, monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    verifier = ClerkVerifier("https://clerk.synthetic.test", ["http://test"])
    verifier._keys = {
        "test-key": jwk.construct(
            private.public_key().public_bytes(
                Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
            ),
            algorithm="RS256",
        ).to_dict()
    }
    verifier._expires = time.monotonic() + 300
    verifier._last_refresh = time.monotonic()
    app.dependency_overrides[get_clerk_verifier] = lambda: verifier
    monkeypatch.setattr(
        "app.core.database.AsyncSessionLocal",
        async_sessionmaker(test_engine, expire_on_commit=False),
    )

    def token(subject):
        now = int(time.time())
        return jwt.encode(
            {
                "sub": subject,
                "iss": verifier.issuer,
                "azp": "http://test",
                "iat": now,
                "nbf": now - 1,
                "exp": now + 120,
            },
            pem,
            algorithm="RS256",
            headers={"kid": "test-key"},
        )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client, token
    app.dependency_overrides.clear()


async def test_every_business_route_rejects_anonymous_requests(isolated_api):
    client, _ = isolated_api
    checked = []
    for route in app.routes:
        if (
            not isinstance(route, APIRoute)
            or route.path in {"/api/health", "/api/ready"}
            or route.path.startswith("/api/webhooks/")
        ):
            continue
        path = re.sub(r"\{[^}]+\}", str(uuid4()), route.path)
        for method in route.methods:
            response = await client.request(method, path, json={})
            assert response.status_code == 401, (method, path, response.text)
            checked.append((method, route.path))
    assert len(checked) >= 50
    assert (await client.get("/api/health")).json() == {"status": "ok"}


@pytest.fixture
async def foreign_resources(test_db):
    owner = User(
        clerk_id="user_synthetic_b",
        email=f"b-{uuid4()}@test.invalid",
        hashed_password="!test",
    )
    test_db.add(owner)
    await test_db.flush()
    collection = BookmarkList(user_id=owner.id, name="Private B")
    test_db.add(collection)
    await test_db.flush()
    resources = {
        "list_id": collection,
        "video_id": Video(
            list_id=collection.id, youtube_id="privateB123", title="Secret title"
        ),
        "tag_id": Tag(user_id=owner.id, name="Private tag", is_video_type=True),
        "field_id": CustomField(
            list_id=collection.id, name="Private field", field_type="text", config={}
        ),
        "schema_id": FieldSchema(list_id=collection.id, name="Private schema"),
        "job_id": ProcessingJob(
            list_id=collection.id, total_videos=1, status="running"
        ),
        "channel_id": Channel(
            user_id=owner.id, youtube_channel_id="UCprivate", name="Private channel"
        ),
        "subscription_id": Subscription(
            user_id=owner.id,
            list_id=collection.id,
            name="Private subscription",
            channel_ids=["UCprivate"],
        ),
    }
    test_db.add_all(resources.values())
    await test_db.commit()
    return resources


async def test_foreign_path_resources_are_hidden_for_every_route(
    isolated_api, foreign_resources
):
    client, token = isolated_api
    client.headers["Authorization"] = f"Bearer {token('user_synthetic_a')}"
    checked = []
    for route in app.routes:
        if (
            not isinstance(route, APIRoute)
            or not route.path.startswith("/api/")
            or route.path.startswith("/api/webhooks/")
        ):
            continue
        names = re.findall(r"\{([^}]+)\}", route.path)
        if not names or any(name not in foreign_resources for name in names):
            continue
        path = route.path
        for name in names:
            path = path.replace("{" + name + "}", str(foreign_resources[name].id))
        for method in route.methods:
            response = await client.request(method, path, json={})
            assert response.status_code == 404, (method, path, response.text)
            checked.append((method, route.path))
    assert len(checked) >= 30


async def test_client_user_id_cannot_choose_identity(isolated_api, foreign_resources):
    client, token = isolated_api
    owner_b = foreign_resources["list_id"].user_id
    client.headers["Authorization"] = f"Bearer {token('user_synthetic_a')}"
    response = await client.post(
        "/api/lists", json={"name": "Private A", "user_id": str(owner_b)}
    )
    assert response.status_code == 201, response.text
    assert response.json()["user_id"] != str(owner_b)
    visible = await client.get("/api/lists", params={"user_id": str(owner_b)})
    assert [row["name"] for row in visible.json()] == ["Private A"]
    client.headers["Authorization"] = f"Bearer {token('user_synthetic_b')}"
    assert [row["name"] for row in (await client.get("/api/lists")).json()] == [
        "Private B"
    ]


async def test_foreign_body_references_reject_bulk_atomically(
    isolated_api, foreign_resources, test_db
):
    client, token = isolated_api
    client.headers["Authorization"] = f"Bearer {token('user_synthetic_a')}"
    own = (await client.post("/api/lists", json={"name": "Private A"})).json()
    own_list_id = own["id"]
    for name, value in foreign_resources.items():
        response = await client.post(
            "/api/chat/subscription",
            json={
                "list_id": own_list_id,
                "message": "synthetic",
                "current_config": {name: str(value.id)},
            },
        )
        assert response.status_code == 404, (name, response.text)
    response = await client.post(
        "/api/videos/bulk/tags",
        json={
            "video_ids": [str(foreign_resources["video_id"].id)],
            "tag_ids": [str(foreign_resources["tag_id"].id)],
        },
    )
    assert response.status_code == 404
    assert (await test_db.execute(select(JobOutbox))).scalars().all() == []


async def test_signed_http_ticket_drives_real_websocket_and_isolates_redis_channels(
    isolated_api, test_engine, monkeypatch
):
    import asyncio
    import json
    import os
    import socket

    import uvicorn
    from redis.asyncio import Redis
    from websockets import connect
    from websockets.exceptions import InvalidStatus

    target = os.environ.get("TEST_REDIS_URL")
    assert target == "redis://localhost:56388/3"
    redis = Redis.from_url(target)
    client, token = isolated_api
    monkeypatch.setattr("app.api.auth.get_redis_client", lambda: _redis())
    monkeypatch.setattr("app.api.deps.get_redis_client", lambda: _redis())
    monkeypatch.setattr("app.api.websocket.get_redis_client", lambda: _redis())
    monkeypatch.setattr(
        "app.api.deps.AsyncSessionLocal",
        async_sessionmaker(test_engine, expire_on_commit=False),
    )

    async def _redis():
        return redis

    client.headers["Authorization"] = f"Bearer {token('user_socket_a')}"
    grant_a = await client.post("/api/auth/ws-ticket")
    assert grant_a.status_code == 200
    client.headers["Authorization"] = f"Bearer {token('user_socket_b')}"
    grant_b = await client.post("/api/auth/ws-ticket")
    assert grant_b.status_code == 200
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(
        uvicorn.Config(app, lifespan="off", access_log=False, log_level="error")
    )
    task = asyncio.create_task(server.serve(sockets=[sock]))
    try:
        for _ in range(300):
            if server.started:
                break
            await asyncio.sleep(0.01)
        assert server.started
        base = f"ws://127.0.0.1:{port}/api/ws/progress?ticket="
        async with (
            connect(base + grant_a.json()["ticket"]) as a,
            connect(base + grant_b.json()["ticket"]) as b,
        ):
            identity_a = json.loads(await asyncio.wait_for(a.recv(), 2))["user_id"]
            identity_b = json.loads(await asyncio.wait_for(b.recv(), 2))["user_id"]
            assert identity_a != identity_b
            for _ in range(200):
                counts = await redis.pubsub_numsub(
                    f"progress:user:{identity_a}", f"progress:user:{identity_b}"
                )
                if all(count == 1 for _, count in counts):
                    break
                await asyncio.sleep(0.01)
            assert all(count == 1 for _, count in counts)
            await redis.publish(
                f"progress:user:{identity_b}", json.dumps({"marker": "private B"})
            )
            await redis.publish(
                f"progress:user:{identity_a}", json.dumps({"marker": "private A"})
            )
            assert json.loads(await asyncio.wait_for(a.recv(), 2)) == {
                "marker": "private A"
            }
            assert json.loads(await asyncio.wait_for(b.recv(), 2)) == {
                "marker": "private B"
            }
            with pytest.raises(InvalidStatus) as rejection:
                async with connect(base + grant_a.json()["ticket"]):
                    pass
            assert rejection.value.response.status_code == 403
    finally:
        server.should_exit = True
        await asyncio.wait_for(task, 5)
        sock.close()
        await redis.aclose()
