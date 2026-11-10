"""Creation services never commit the caller's other business changes."""

import io
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import UploadFile
from sqlalchemy import select

from app.models import BookmarkList, Video
from app.models.job_outbox import JobOutbox
from app.schemas.video import VideoAdd
from app.services.video_creation_service import create_video, import_csv_videos


@pytest.mark.parametrize("csv", [False, True])
async def test_video_service_keeps_the_outer_transaction_owned_by_caller(
    test_db, test_list, test_user, csv
):
    list_id = test_list.id
    marker = BookmarkList(name="Outer transaction marker", user_id=test_user.id)
    test_db.add(marker)
    await test_db.flush()
    marker_id = marker.id
    with (
        patch("app.services.video_creation_service.get_redis_client", new=AsyncMock()),
        patch("app.services.video_creation_service.YouTubeClient") as factory,
    ):
        factory.return_value.get_video_metadata = AsyncMock(
            return_value={
                "title": "Synthetic",
                "duration": "PT1M",
                "published_at": "2026-11-10T00:00:00Z",
            }
        )
        if csv:
            await import_csv_videos(
                test_db,
                list_id,
                UploadFile(
                    filename="synthetic.csv",
                    file=io.BytesIO(b"url\nhttps://youtu.be/dQw4w9WgXcQ\n"),
                ),
            )
        else:
            await create_video(
                test_db, list_id, VideoAdd(url="https://youtu.be/dQw4w9WgXcQ")
            )
    await test_db.rollback()
    assert (
        await test_db.execute(
            select(BookmarkList.id).where(BookmarkList.id == marker_id)
        )
    ).scalar_one_or_none() is None
    assert (await test_db.execute(select(Video))).scalars().all() == []
    assert (await test_db.execute(select(JobOutbox))).scalars().all() == []
