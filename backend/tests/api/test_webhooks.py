"""Tests for webhook endpoints."""

import hashlib
import hmac
from unittest.mock import patch

import pytest
from pydantic import SecretStr
from sqlalchemy import select

from app.core.config import settings
from app.models import BookmarkList, Subscription
from app.models.job_outbox import JobOutbox
from app.services.job_dispatch_service import record_job


@pytest.fixture(autouse=True)
async def signed_webhook_requests(client, test_db, test_user, monkeypatch):
    """Happy paths use actual HMAC bytes; negative tests override the signature."""
    secret = "synthetic-websub-test-only"
    monkeypatch.setattr(settings, "pubsub_signing_secret", SecretStr(secret))
    collection = BookmarkList(name="Synthetic webhook owner", user_id=test_user.id)
    test_db.add(collection)
    await test_db.flush()
    test_db.add(
        Subscription(
            user_id=test_user.id,
            list_id=collection.id,
            name="Synthetic channel subscription",
            channel_ids=["UCxxxxxx"],
        )
    )
    await test_db.commit()

    async def sign(request):
        if (
            request.method == "POST"
            and request.url.path == "/api/webhooks/pubsubhubbub"
            and "x-hub-signature" not in request.headers
        ):
            request.headers["x-hub-signature"] = (
                "sha256="
                + hmac.new(secret.encode(), request.content, hashlib.sha256).hexdigest()
            )

    client.event_hooks["request"].append(sign)
    yield
    client.event_hooks["request"].remove(sign)


class TestPubSubHubbubVerification:
    """Tests for GET /api/webhooks/pubsubhubbub verification endpoint."""

    @pytest.mark.asyncio
    async def test_verification_success(self, client):
        """Verification returns challenge on valid YouTube topic."""
        response = await client.get(
            "/api/webhooks/pubsubhubbub",
            params={
                "hub.mode": "subscribe",
                "hub.topic": "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCxxxxxx",
                "hub.challenge": "test-challenge-12345",
                "hub.lease_seconds": "864000",
            },
        )

        assert response.status_code == 200
        assert response.text == "test-challenge-12345"
        assert response.headers["content-type"] == "application/octet-stream"

    @pytest.mark.asyncio
    async def test_verification_unsubscribe(self, client, test_db):
        """Verification works for a durably intended unsubscribe."""
        await record_job(test_db, "sync_pubsub_channel", "UCxxxxxx", ["UCxxxxxx"])
        await test_db.commit()
        response = await client.get(
            "/api/webhooks/pubsubhubbub",
            params={
                "hub.mode": "unsubscribe",
                "hub.topic": "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCxxxxxx",
                "hub.challenge": "unsubscribe-challenge",
            },
        )

        assert response.status_code == 200
        assert response.text == "unsubscribe-challenge"

    @pytest.mark.asyncio
    async def test_verification_unknown_topic(self, client):
        """Verification returns 404 for non-YouTube topics."""
        response = await client.get(
            "/api/webhooks/pubsubhubbub",
            params={
                "hub.mode": "subscribe",
                "hub.topic": "https://malicious.example.com/feed",
                "hub.challenge": "test-challenge",
            },
        )

        assert response.status_code == 404
        assert "Unknown topic" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_verification_missing_params(self, client):
        """Verification returns 422 when required params missing."""
        response = await client.get(
            "/api/webhooks/pubsubhubbub",
            params={
                "hub.mode": "subscribe",
                # Missing hub.topic and hub.challenge
            },
        )

        assert response.status_code == 422


class TestPubSubHubbubNotification:
    """Tests for POST /api/webhooks/pubsubhubbub notification endpoint."""

    @pytest.fixture
    def sample_atom_feed(self):
        """Sample Atom XML notification from YouTube."""
        return b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns="http://www.w3.org/2005/Atom">
  <link rel="hub" href="https://pubsubhubbub.appspot.com"/>
  <link rel="self" href="https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCxxxxxx"/>
  <title>YouTube video feed</title>
  <updated>2024-01-15T12:00:00+00:00</updated>
  <entry>
    <id>yt:video:dQw4w9WgXcQ</id>
    <yt:videoId>dQw4w9WgXcQ</yt:videoId>
    <yt:channelId>UCxxxxxx</yt:channelId>
    <title>Test Video Title</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
    <author>
      <name>Test Channel</name>
      <uri>https://www.youtube.com/channel/UCxxxxxx</uri>
    </author>
    <published>2024-01-15T12:00:00+00:00</published>
    <updated>2024-01-15T12:00:00+00:00</updated>
  </entry>
</feed>"""

    @pytest.mark.asyncio
    async def test_notification_success(
        self, client, sample_atom_feed, mock_arq_pool, test_db
    ):
        """Notification parses feed and enqueues job."""
        with patch("app.core.redis.get_arq_pool", return_value=mock_arq_pool):
            response = await client.post(
                "/api/webhooks/pubsubhubbub",
                content=sample_atom_feed,
                headers={"Content-Type": "application/atom+xml"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["processed"] == 1

        intent = (await test_db.execute(select(JobOutbox))).scalar_one()
        assert intent.kind == "process_pubsub_notification"
        assert intent.payload["kwargs"] == {
            "video_id": "dQw4w9WgXcQ",
            "channel_id": "UCxxxxxx",
        }

    @pytest.mark.asyncio
    async def test_notification_empty_body(self, client):
        """Notification handles empty body gracefully."""
        response = await client.post(
            "/api/webhooks/pubsubhubbub",
            content=b"",
            headers={"Content-Type": "application/atom+xml"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "empty"
        assert data["processed"] == 0

    @pytest.mark.asyncio
    async def test_notification_no_entries(self, client):
        """Notification handles feed with no entries."""
        empty_feed = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Empty feed</title>
</feed>"""

        response = await client.post(
            "/api/webhooks/pubsubhubbub",
            content=empty_feed,
            headers={"Content-Type": "application/atom+xml"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "no_entries"

    @pytest.mark.asyncio
    async def test_notification_multiple_entries(self, client, mock_arq_pool, test_db):
        """Notification processes multiple entries."""
        multi_entry_feed = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <yt:videoId>video1</yt:videoId>
    <yt:channelId>UCxxxxxx</yt:channelId>
    <title>Video 1</title>
  </entry>
  <entry>
    <yt:videoId>video2</yt:videoId>
    <yt:channelId>UCxxxxxx</yt:channelId>
    <title>Video 2</title>
  </entry>
</feed>"""

        with patch("app.core.redis.get_arq_pool", return_value=mock_arq_pool):
            response = await client.post(
                "/api/webhooks/pubsubhubbub",
                content=multi_entry_feed,
                headers={"Content-Type": "application/atom+xml"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 2
        assert len((await test_db.execute(select(JobOutbox))).scalars().all()) == 2

    @pytest.mark.asyncio
    async def test_notification_missing_video_id(self, client, mock_arq_pool, test_db):
        """Notification skips entries without video_id."""
        incomplete_feed = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <yt:channelId>UCxxxxxx</yt:channelId>
    <title>Missing Video ID</title>
  </entry>
</feed>"""

        with patch("app.core.redis.get_arq_pool", return_value=mock_arq_pool):
            response = await client.post(
                "/api/webhooks/pubsubhubbub",
                content=incomplete_feed,
                headers={"Content-Type": "application/atom+xml"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 0
        assert (await test_db.execute(select(JobOutbox))).scalars().all() == []

    @pytest.mark.asyncio
    async def test_notification_redis_unavailable(
        self, client, sample_atom_feed, test_db
    ):
        """Notification remains durably accepted while Redis is unavailable."""
        with patch(
            "app.core.redis.get_arq_pool",
            side_effect=Exception("Redis connection failed"),
        ):
            response = await client.post(
                "/api/webhooks/pubsubhubbub",
                content=sample_atom_feed,
                headers={"Content-Type": "application/atom+xml"},
            )

        assert response.status_code == 200
        assert response.json()["processed"] == 1
        assert (
            await test_db.execute(select(JobOutbox))
        ).scalar_one().status == "pending"


@pytest.mark.parametrize("signature", ["", "sha256=invalid", "md5=invalid"])
async def test_forged_or_missing_signature_is_rejected(client, signature, test_db):
    response = await client.post(
        "/api/webhooks/pubsubhubbub",
        content=b"synthetic",
        headers={"x-hub-signature": signature},
    )
    assert response.status_code == 401
    assert (await test_db.execute(select(JobOutbox))).scalars().all() == []


async def test_replayed_notification_has_one_durable_intent(client, test_db):
    body = b'<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom"><entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><yt:channelId>UCxxxxxx</yt:channelId></entry></feed>'
    first = await client.post("/api/webhooks/pubsubhubbub", content=body)
    second = await client.post("/api/webhooks/pubsubhubbub", content=body)
    assert first.json() == {"status": "ok", "processed": 1}
    assert second.json() == {"status": "duplicate", "processed": 0}
    assert len((await test_db.execute(select(JobOutbox))).scalars().all()) == 1


async def test_oversized_notification_rejected_before_parsing(client):
    response = await client.post(
        "/api/webhooks/pubsubhubbub", content=b"x" * (256 * 1024 + 1)
    )
    assert response.status_code == 413


async def test_unknown_subscription_cannot_trigger_work(client, test_db):
    body = b'<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom"><entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><yt:channelId>UCunknown</yt:channelId></entry></feed>'
    response = await client.post("/api/webhooks/pubsubhubbub", content=body)
    assert response.status_code == 404
    assert (await test_db.execute(select(JobOutbox))).scalars().all() == []


async def test_missing_signing_configuration_fails_closed(client, monkeypatch):
    monkeypatch.setattr(settings, "pubsub_signing_secret", SecretStr(""))
    response = await client.post("/api/webhooks/pubsubhubbub", content=b"synthetic")
    assert response.status_code == 503


async def test_replay_guard_rolls_back_with_failed_intent(
    client, test_db, test_engine, monkeypatch
):
    from unittest.mock import AsyncMock

    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.core.database import get_public_db
    from app.main import app
    from app.models.webhook_delivery import WebhookDelivery

    override = app.dependency_overrides.pop(get_public_db)
    monkeypatch.setattr(
        "app.core.database.AsyncSessionLocal",
        async_sessionmaker(test_engine, expire_on_commit=False),
    )
    body = b'<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom"><entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><yt:channelId>UCxxxxxx</yt:channelId></entry></feed>'
    try:
        with patch(
            "app.api.webhooks.DurableJobQueue.enqueue_job",
            new=AsyncMock(side_effect=RuntimeError("injected")),
        ):
            with pytest.raises(RuntimeError):
                await client.post("/api/webhooks/pubsubhubbub", content=body)
        assert (await test_db.execute(select(WebhookDelivery))).scalars().all() == []
        response = await client.post("/api/webhooks/pubsubhubbub", content=body)
        assert response.json() == {"status": "ok", "processed": 1}
    finally:
        app.dependency_overrides[get_public_db] = override


async def test_parallel_duplicate_deliveries_have_one_intent(
    client, test_db, test_engine, monkeypatch
):
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.core.database import get_public_db
    from app.main import app

    override = app.dependency_overrides.pop(get_public_db)
    monkeypatch.setattr(
        "app.core.database.AsyncSessionLocal",
        async_sessionmaker(test_engine, expire_on_commit=False),
    )
    body = b'<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom"><entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><yt:channelId>UCxxxxxx</yt:channelId></entry></feed>'
    try:
        responses = await asyncio.gather(
            *[client.post("/api/webhooks/pubsubhubbub", content=body) for _ in range(3)]
        )
        assert sorted(response.json()["processed"] for response in responses) == [
            0,
            0,
            1,
        ]
        assert len((await test_db.execute(select(JobOutbox))).scalars().all()) == 1
    finally:
        app.dependency_overrides[get_public_db] = override
