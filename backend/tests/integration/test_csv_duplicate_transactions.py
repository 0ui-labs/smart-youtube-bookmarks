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
        patch("app.services.video_creation_service.YouTubeClient") as youtube,
        patch(
            "app.services.video_creation_service._enqueue_enrichment",
            new_callable=AsyncMock,
        ),
        patch(
            "app.services.video_creation_service._enqueue_video_processing",
            new_callable=AsyncMock,
        ),
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


async def test_parallel_imports_keep_one_video(test_db, test_list, test_engine):
    import asyncio
    import io

    from fastapi import UploadFile
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.api.videos import bulk_upload_videos

    list_id = test_list.id
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)

    async def upload():
        async with sessions() as db:
            return await bulk_upload_videos(
                list_id,
                UploadFile(
                    filename="parallel.csv",
                    file=io.BytesIO(b"url\nhttps://youtu.be/aaaaaaaaaaa"),
                ),
                db,
            )

    with (
        patch("app.services.video_creation_service.YouTubeClient") as youtube,
        patch(
            "app.services.video_creation_service._enqueue_enrichment",
            new_callable=AsyncMock,
        ),
    ):
        youtube.return_value.get_video_metadata = AsyncMock(
            return_value={"title": "Synthetic", "channel": "Test"}
        )
        results = await asyncio.gather(upload(), upload())
    assert sorted(result.created_count for result in results) == [0, 1]
    rows = (
        (await test_db.execute(select(Video).where(Video.list_id == list_id)))
        .scalars()
        .all()
    )
    assert len(rows) == 1


async def test_repeated_fields_use_last_valid_value(client, test_db, test_list):
    from app.models.custom_field import CustomField
    from app.models.video_field_value import VideoFieldValue

    field = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5},
    )
    test_db.add(field)
    await test_db.commit()
    contents = "url,field_Rating\nhttps://youtu.be/aaaaaaaaaaa,2\nhttps://youtu.be/aaaaaaaaaaa,4\nhttps://youtu.be/aaaaaaaaaaa,invalid"
    with patch(
        "app.services.video_creation_service._enqueue_enrichment",
        new_callable=AsyncMock,
    ):
        response = await client.post(
            f"/api/lists/{test_list.id}/videos/bulk",
            files={"file": ("fields.csv", contents, "text/csv")},
        )
    assert response.status_code == 201, response.text
    value = (
        await test_db.execute(
            select(VideoFieldValue).where(VideoFieldValue.field_id == field.id)
        )
    ).scalar_one()
    assert value.value_numeric == 4
