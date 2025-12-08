"""Tests for webhook endpoints."""

from unittest.mock import AsyncMock, patch

import pytest


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
        assert response.headers["content-type"] == "text/plain; charset=utf-8"

    @pytest.mark.asyncio
    async def test_verification_unsubscribe(self, client):
        """Verification works for unsubscribe mode."""
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
    async def test_notification_success(self, client, sample_atom_feed, mock_arq_pool):
        """Notification parses feed and enqueues job."""
        with patch("app.api.webhooks.get_arq_pool", return_value=mock_arq_pool):
            response = await client.post(
                "/api/webhooks/pubsubhubbub",
                content=sample_atom_feed,
                headers={"Content-Type": "application/atom+xml"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["processed"] == 1

        # Verify job was enqueued
        mock_arq_pool.enqueue_job.assert_called_once_with(
            "process_pubsub_notification",
            video_id="dQw4w9WgXcQ",
            channel_id="UCxxxxxx",
        )

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
    async def test_notification_multiple_entries(self, client, mock_arq_pool):
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

        with patch("app.api.webhooks.get_arq_pool", return_value=mock_arq_pool):
            response = await client.post(
                "/api/webhooks/pubsubhubbub",
                content=multi_entry_feed,
                headers={"Content-Type": "application/atom+xml"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 2
        assert mock_arq_pool.enqueue_job.call_count == 2

    @pytest.mark.asyncio
    async def test_notification_missing_video_id(self, client, mock_arq_pool):
        """Notification skips entries without video_id."""
        incomplete_feed = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <yt:channelId>UCxxxxxx</yt:channelId>
    <title>Missing Video ID</title>
  </entry>
</feed>"""

        with patch("app.api.webhooks.get_arq_pool", return_value=mock_arq_pool):
            response = await client.post(
                "/api/webhooks/pubsubhubbub",
                content=incomplete_feed,
                headers={"Content-Type": "application/atom+xml"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 0
        mock_arq_pool.enqueue_job.assert_not_called()

    @pytest.mark.asyncio
    async def test_notification_redis_unavailable(self, client, sample_atom_feed):
        """Notification returns 503 when Redis unavailable."""
        with patch(
            "app.api.webhooks.get_arq_pool",
            side_effect=Exception("Redis connection failed"),
        ):
            response = await client.post(
                "/api/webhooks/pubsubhubbub",
                content=sample_atom_feed,
                headers={"Content-Type": "application/atom+xml"},
            )

        assert response.status_code == 503
        assert "Job queue unavailable" in response.json()["detail"]
