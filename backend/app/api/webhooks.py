"""Public WebSub callbacks, limited to expected topics and signed deliveries."""

import hashlib
import hmac
from typing import Any, Literal
from urllib.parse import parse_qs, urlsplit

import feedparser
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_public_db
from app.models.job_outbox import JobOutbox
from app.models.subscription import Subscription
from app.models.webhook_delivery import WebhookDelivery
from app.services.job_dispatch_service import DurableJobQueue

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
MAX_DELIVERY_BYTES = 256 * 1024


async def expected_channel(db: AsyncSession, channel_id: str) -> bool:
    return (
        await db.execute(
            select(Subscription.id)
            .where(
                Subscription.is_active.is_(True),
                Subscription.channel_ids.any(channel_id),
            )
            .limit(1)
        )
    ).scalar_one_or_none() is not None


@router.get("/pubsubhubbub")
async def verify_pubsub(
    hub_mode: Literal["subscribe", "unsubscribe"] = Query(..., alias="hub.mode"),
    hub_topic: str = Query(..., alias="hub.topic", max_length=2048),
    hub_challenge: str = Query(
        ...,
        alias="hub.challenge",
        min_length=1,
        max_length=512,
        pattern=r"^[A-Za-z0-9._~+=/-]+$",
    ),
    hub_lease_seconds: int | None = Query(
        None, alias="hub.lease_seconds", ge=1, le=864000
    ),
    db: AsyncSession = Depends(get_public_db),
) -> Response:
    topic = urlsplit(hub_topic)
    query = parse_qs(topic.query)
    channels = query.get("channel_id", [])
    if (
        topic.scheme != "https"
        or topic.netloc != "www.youtube.com"
        or topic.path not in {"/xml/feeds/videos.xml", "/feeds/videos.xml"}
        or topic.fragment
        or set(query) != {"channel_id"}
        or len(channels) != 1
    ):
        raise HTTPException(status_code=404, detail="Unknown topic")
    expected = await expected_channel(db, channels[0])
    if hub_mode == "unsubscribe":
        expected = (
            await db.execute(
                select(JobOutbox.id)
                .where(
                    JobOutbox.kind == "sync_pubsub_channel",
                    JobOutbox.target_id == channels[0],
                )
                .limit(1)
            )
        ).scalar_one_or_none() is not None
    if not expected:
        raise HTTPException(status_code=404, detail="Unknown topic")
    return Response(
        content=hub_challenge,
        media_type="application/octet-stream",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.post("/pubsubhubbub")
async def receive_pubsub_notification(
    request: Request, db: AsyncSession = Depends(get_public_db)
) -> dict[str, Any]:
    secret = settings.pubsub_signing_secret.get_secret_value()
    if not secret:
        raise HTTPException(
            status_code=503, detail="Webhook verification not configured"
        )
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_DELIVERY_BYTES:
            raise HTTPException(status_code=413, detail="Delivery too large")
    method, _, signature = request.headers.get("x-hub-signature", "").partition("=")
    if (
        method not in {"sha1", "sha256", "sha384", "sha512"}
        or len(signature) > 128
        or not hmac.compare_digest(
            hmac.new(secret.encode(), body, method).hexdigest(), signature
        )
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    if not body:
        return {"status": "empty", "processed": 0}
    feed = feedparser.parse(bytes(body))
    if feed.bozo:
        return {"status": "malformed", "processed": 0}
    entries = [
        (entry.get("yt_videoid"), entry.get("yt_channelid")) for entry in feed.entries
    ]
    valid = [(video, channel) for video, channel in entries if video and channel]
    for channel in {channel for _, channel in valid}:
        if not await expected_channel(db, channel):
            raise HTTPException(status_code=404, detail="Unknown topic")
    digest = hashlib.sha256(body).hexdigest()
    accepted = (
        await db.execute(
            insert(WebhookDelivery)
            .values(digest=digest)
            .on_conflict_do_nothing(index_elements=[WebhookDelivery.digest])
            .returning(WebhookDelivery.id)
        )
    ).scalar_one_or_none()
    if accepted is None:
        return {"status": "duplicate", "processed": 0}
    for video_id, channel_id in valid:
        await DurableJobQueue(db).enqueue_job(
            "process_pubsub_notification", video_id=video_id, channel_id=channel_id
        )
    await db.commit()
    return {"status": "ok" if entries else "no_entries", "processed": len(valid)}
