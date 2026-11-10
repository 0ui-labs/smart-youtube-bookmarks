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


async def test_query_response_does_not_corrupt_relationships_or_rollback(
    test_db, test_list, test_user
):
    from sqlalchemy import func

    from app.models import CustomField, FieldSchema, SchemaField, Tag, VideoFieldValue
    from app.models.tag import video_tags
    from app.services.video_query_service import query_videos_in_list

    field = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5},
    )
    schema = FieldSchema(list_id=test_list.id, name="Workspace")
    tag = Tag(user_id=test_user.id, name="Selected", is_video_type=False)
    test_db.add_all([field, schema, tag])
    await test_db.flush()
    test_list.default_schema_id = schema.id
    test_db.add(
        SchemaField(
            schema_id=schema.id, field_id=field.id, display_order=0, show_on_card=True
        )
    )
    video = Video(list_id=test_list.id, youtube_id="relation001", tags=[tag])
    test_db.add(video)
    await test_db.flush()
    value = VideoFieldValue(video_id=video.id, field_id=field.id, value_numeric=4)
    test_db.add(value)
    await test_db.commit()
    list_id, video_id = test_list.id, video.id
    await test_db.refresh(video, attribute_names=["field_values"])
    result = await query_videos_in_list(test_db, list_id)
    assert result[0].field_values[0].value == 4
    assert result[0].tags[0].name == "Selected"
    assert video.field_values == [value]
    await test_db.rollback()
    assert result[0].field_values[0].value == 4
    assert (
        await test_db.scalar(
            select(func.count())
            .select_from(video_tags)
            .where(video_tags.c.video_id == video_id)
        )
        == 1
    )
    assert (
        await test_db.scalar(
            select(VideoFieldValue.value_numeric).where(
                VideoFieldValue.video_id == video_id
            )
        )
        == 4
    )
