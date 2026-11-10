"""PostgreSQL regression for duplicate rows without rollback of earlier rows."""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.video import Video


@pytest.mark.parametrize(
    "ids",
    [
        ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"],
        ["bbbbbbbbbbb", "aaaaaaaaaaa", "ccccccccccc"],
        ["aaaaaaaaaaa", "ccccccccccc", "bbbbbbbbbbb"],
        ["aaaaaaaaaaa", "bbbbbbbbbbb", "aaaaaaaaaaa", "ccccccccccc"],
    ],
)
async def test_duplicate_import_preserves_other_rows(client, test_db, test_list, ids):
    existing = Video(
        list_id=test_list.id, youtube_id="bbbbbbbbbbb", processing_status="completed"
    )
    test_db.add(existing)
    await test_db.commit()
    list_id = test_list.id
    contents = "url\n" + "\n".join(
        f"https://youtu.be/{youtube_id}" for youtube_id in ids
    )
    with (
        patch("app.api.videos.YouTubeClient") as youtube,
        patch("app.api.videos._enqueue_enrichment", new_callable=AsyncMock),
        patch("app.api.videos._enqueue_video_processing", new_callable=AsyncMock),
    ):
        youtube.return_value.get_video_metadata = AsyncMock(
            return_value={"title": "Synthetic", "channel": "Test"}
        )
        response = await client.post(
            f"/api/lists/{list_id}/videos/bulk",
            files={"file": ("duplicates.csv", contents, "text/csv")},
        )
    assert response.status_code == 201, response.text
    rows = (
        (await test_db.execute(select(Video).where(Video.list_id == list_id)))
        .scalars()
        .all()
    )
    assert {row.youtube_id for row in rows} == {
        "aaaaaaaaaaa",
        "bbbbbbbbbbb",
        "ccccccccccc",
    }
    assert response.json()["created_count"] == 2
    assert set(response.json()["created_video_ids"]) == {
        str(row.id) for row in rows if row.id != existing.id
    }
