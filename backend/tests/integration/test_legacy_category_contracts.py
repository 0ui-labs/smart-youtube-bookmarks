"""Regression proofs for category contracts inherited from pre-integration code."""

import json
from uuid import uuid4

import pytest
from sqlalchemy import select, update

from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.tag import Tag, video_tags
from app.models.video_field_value import VideoFieldValue


@pytest.mark.asyncio
async def test_detail_preserves_label_and_category_identity(
    client, test_db, test_user, test_video
):
    category = Tag(user_id=test_user.id, name="Category", is_video_type=True)
    label = Tag(user_id=test_user.id, name="Label", is_video_type=False)
    test_db.add_all([category, label])
    await test_db.flush()
    for tag in [category, label]:
        await test_db.execute(
            video_tags.insert().values(video_id=test_video.id, tag_id=tag.id)
        )
    await test_db.commit()
    response = await client.get(f"/api/videos/{test_video.id}")
    assert response.status_code == 200
    assert {tag["name"]: tag["is_video_type"] for tag in response.json()["tags"]} == {
        "Category": True,
        "Label": False,
    }


@pytest.mark.asyncio
async def test_category_roundtrip_restores_existing_values_repeatedly(
    client, test_db, test_list, test_user, test_video, tmp_path, monkeypatch
):
    import app.services.field_value_backup as backups

    monkeypatch.setattr(backups, "BACKUP_DIR", tmp_path)
    field = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5},
    )
    schema = FieldSchema(list_id=test_list.id, name="Category schema")
    test_db.add_all([field, schema])
    await test_db.flush()
    test_db.add(
        SchemaField(
            schema_id=schema.id, field_id=field.id, display_order=0, show_on_card=True
        )
    )
    first = Tag(
        user_id=test_user.id, name="First", is_video_type=True, schema_id=schema.id
    )
    second = Tag(user_id=test_user.id, name="Second", is_video_type=True)
    test_db.add_all([first, second])
    await test_db.flush()
    test_db.add(
        VideoFieldValue(video_id=test_video.id, field_id=field.id, value_numeric=4)
    )
    await test_db.execute(
        video_tags.insert().values(video_id=test_video.id, tag_id=first.id)
    )
    await test_db.commit()
    video_id, field_id, first_id, second_id = (
        test_video.id,
        field.id,
        first.id,
        second.id,
    )
    endpoint = f"/api/videos/{video_id}/category"
    for _ in range(2):
        switched = await client.put(endpoint, json={"category_id": str(second_id)})
        assert switched.status_code == 200
        assert switched.json()["backup_created"] is True
        await test_db.execute(
            update(VideoFieldValue)
            .where(
                VideoFieldValue.video_id == video_id,
                VideoFieldValue.field_id == field_id,
            )
            .values(value_numeric=1)
        )
        await test_db.commit()
        restored = await client.put(
            endpoint,
            params={"restore_backup": True},
            json={"category_id": str(first_id)},
        )
        assert restored.status_code == 200
        assert restored.json()["restored_count"] == 1
        values = (
            (
                await test_db.execute(
                    select(VideoFieldValue.value_numeric).where(
                        VideoFieldValue.video_id == video_id,
                        VideoFieldValue.field_id == field_id,
                    )
                )
            )
            .scalars()
            .all()
        )
        assert values == [4]

    # Stale/deleted field IDs in an old backup must not create unrelated rows.
    backup_file = tmp_path / str(video_id) / f"{first_id}.json"
    data = json.loads(backup_file.read_text())
    data["values"].append({"field_id": str(uuid4()), "value_numeric": 3})
    backup_file.write_text(json.dumps(data))
    await test_db.execute(
        update(VideoFieldValue)
        .where(
            VideoFieldValue.video_id == video_id, VideoFieldValue.field_id == field_id
        )
        .values(value_numeric=1)
    )
    await test_db.commit()
    assert await backups.restore_field_values(video_id, first_id, test_db) == 1
    await test_db.rollback()
    assert (
        await test_db.execute(
            select(VideoFieldValue.value_numeric).where(
                VideoFieldValue.video_id == video_id,
                VideoFieldValue.field_id == field_id,
            )
        )
    ).scalar_one() == 1
