"""
Webhook endpoints for external service integrations.

Currently handles:
- PubSubHubbub (WebSub) notifications from YouTube for channel updates
"""

import logging
from typing import Any

import feedparser
from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.core.redis import get_arq_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.get("/pubsubhubbub")
async def verify_pubsub(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_topic: str = Query(..., alias="hub.topic"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
    hub_lease_seconds: int | None = Query(None, alias="hub.lease_seconds"),
) -> Response:
    """
    Verification callback for PubSubHubbub subscriptions.

    When we subscribe to a YouTube channel feed, Google's hub sends a GET
    request to verify we control this callback URL. We must echo back the
    hub.challenge to confirm the subscription.

    Args:
        hub_mode: Either "subscribe" or "unsubscribe"
        hub_topic: The feed URL we're subscribing to
        hub_challenge: Random string we must echo back
        hub_lease_seconds: How long the subscription will last

    Returns:
        The hub.challenge value as plain text
    """
    # Verify this is a YouTube feed topic we expect
    if not hub_topic.startswith("https://www.youtube.com/xml/feeds/videos.xml"):
        logger.warning(f"PubSubHubbub verification for unknown topic: {hub_topic}")
        raise HTTPException(status_code=404, detail="Unknown topic")

    # Extract channel_id from topic for logging
    channel_id = hub_topic.split("channel_id=")[-1] if "channel_id=" in hub_topic else "unknown"

    logger.info(
        f"PubSubHubbub verification: mode={hub_mode}, "
        f"channel={channel_id}, lease={hub_lease_seconds}s"
    )

    # Echo the challenge to confirm subscription
    return Response(content=hub_challenge, media_type="text/plain")


@router.post("/pubsubhubbub")
async def receive_pubsub_notification(request: Request) -> dict[str, Any]:
    """
    Receive new video notifications from YouTube.

    YouTube's PubSubHubbub hub sends POST requests with Atom XML
    containing information about newly uploaded videos. We parse
    the feed and queue background jobs to process each video.

    The Atom feed contains entries like:
    ```xml
    <entry>
        <yt:videoId>VIDEO_ID</yt:videoId>
        <yt:channelId>CHANNEL_ID</yt:channelId>
        <title>Video Title</title>
        <published>2024-01-01T00:00:00+00:00</published>
    </entry>
    ```

    Returns:
        Status and count of processed entries
    """
    body = await request.body()

    if not body:
        logger.warning("PubSubHubbub received empty notification body")
        return {"status": "empty", "processed": 0}

    # Parse Atom feed
    feed = feedparser.parse(body)

    if feed.bozo:
        # feedparser sets bozo=1 for malformed feeds
        logger.warning(f"PubSubHubbub received malformed feed: {feed.bozo_exception}")
        return {"status": "malformed", "processed": 0}

    if not feed.entries:
        logger.debug("PubSubHubbub notification contained no entries")
        return {"status": "no_entries", "processed": 0}

    # Get ARQ pool for job queueing
    try:
        arq_pool = await get_arq_pool()
    except Exception as e:
        logger.error(f"Failed to get ARQ pool: {e}")
        raise HTTPException(status_code=503, detail="Job queue unavailable")

    processed_count = 0
    for entry in feed.entries:
        # YouTube Atom feeds use custom namespaces
        # feedparser normalizes them to yt_videoid, yt_channelid
        video_id = entry.get("yt_videoid")
        channel_id = entry.get("yt_channelid")

        if not video_id or not channel_id:
            logger.warning(
                f"PubSubHubbub entry missing video_id or channel_id: {entry}"
            )
            continue

        # Log the notification
        title = entry.get("title", "Unknown")
        logger.info(
            f"PubSubHubbub notification: video={video_id}, "
            f"channel={channel_id}, title={title!r}"
        )

        # Queue background job to process this notification
        try:
            await arq_pool.enqueue_job(
                "process_pubsub_notification",
                video_id=video_id,
                channel_id=channel_id,
            )
            processed_count += 1
        except Exception as e:
            logger.error(
                f"Failed to queue job for video {video_id}: {e}"
            )

    logger.info(f"PubSubHubbub processed {processed_count} entries")
    return {"status": "ok", "processed": processed_count}
