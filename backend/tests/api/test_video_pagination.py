"""Stable collection-wide ordering and bounded hydration on PostgreSQL."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import insert

from app.models import Tag, Video
from app.models.tag import video_tags


async def test_all_pages_reachable_with_stable_tie_breaker(client, test_db, test_list):
    identities = [uuid4() for _ in range(103)]
    await test_db.execute(
        insert(Video),
        [
            {
                "id": identity,
                "list_id": test_list.id,
                "youtube_id": f"v{index:010d}",
                "title": "Same title",
                "created_at": datetime(2026, 1, 1, tzinfo=UTC),
            }
            for index, identity in enumerate(identities)
        ],
    )
    await test_db.commit()
    received = []
    for offset, expected in [(0, 50), (50, 50), (100, 3)]:
        response = await client.get(
            f"/api/lists/{test_list.id}/videos/page",
            params={"offset": offset, "sort_by": "title"},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert (data["total"], data["offset"], data["limit"]) == (103, offset, 50)
        assert len(data["items"]) == expected
        received.extend(item["id"] for item in data["items"])
    assert received == sorted(str(identity) for identity in identities)
    assert len(set(received)) == 103


async def test_page_bounds_and_legacy_limit(client, test_db, test_list):
    await test_db.execute(
        insert(Video),
        [
            {"list_id": test_list.id, "youtube_id": f"v{index:010d}"}
            for index in range(105)
        ],
    )
    await test_db.commit()
    for parameters in [{"limit": 101}, {"limit": 0}, {"offset": -1}]:
        assert (
            await client.get(
                f"/api/lists/{test_list.id}/videos/page", params=parameters
            )
        ).status_code == 422
    response = await client.get(f"/api/lists/{test_list.id}/videos")
    assert len(response.json()) <= 100
    maximum = (
        await client.get(
            f"/api/lists/{test_list.id}/videos/page", params={"limit": 100}
        )
    ).json()
    assert len(maximum["items"]) == 100


async def test_filter_count_covers_entire_collection(
    client, test_db, test_list, test_user
):
    tag = Tag(user_id=test_user.id, name="Selected")
    test_db.add(tag)
    await test_db.flush()
    identities = [uuid4() for _ in range(120)]
    await test_db.execute(
        insert(Video),
        [
            {
                "id": identity,
                "list_id": test_list.id,
                "youtube_id": f"v{index:010d}",
                "duration": index,
            }
            for index, identity in enumerate(identities)
        ],
    )
    await test_db.execute(
        insert(video_tags),
        [
            {"video_id": identity, "tag_id": tag.id}
            for index, identity in enumerate(identities)
            if index % 2 == 0
        ],
    )
    await test_db.commit()
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/filter/page?offset=50&limit=10",
        json={"tags": ["selected"], "sort_by": "duration", "sort_order": "desc"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] == 60
    assert [item["duration"] for item in data["items"]] == list(range(18, -1, -2))


async def test_duplicate_lookup_reaches_records_outside_first_page(
    client, test_db, test_list
):
    await test_db.execute(
        insert(Video),
        [
            {"list_id": test_list.id, "youtube_id": f"v{index:010d}"}
            for index in range(150)
        ],
    )
    await test_db.commit()
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/lookup",
        json={"youtube_ids": ["v0000000149", "not-present"]},
    )
    assert response.status_code == 200
    assert response.json() == {"existing_youtube_ids": ["v0000000149"]}
    too_many = await client.post(
        f"/api/lists/{test_list.id}/videos/lookup",
        json={"youtube_ids": ["synthetic"] * 101},
    )
    assert too_many.status_code == 422


async def test_import_status_is_bounded_and_scoped(client, test_db, test_list):
    identities = [uuid4() for _ in range(101)]
    await test_db.execute(
        insert(Video),
        [
            {
                "id": identity,
                "list_id": test_list.id,
                "youtube_id": f"v{index:010d}",
                "import_stage": "complete",
                "import_progress": 100,
            }
            for index, identity in enumerate(identities)
        ],
    )
    await test_db.commit()
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/import-status",
        json={"video_ids": [str(identity) for identity in identities[:100]]},
    )
    assert response.status_code == 200
    assert len(response.json()) == 100
    assert all(
        set(item) == {"id", "import_stage", "import_progress", "processing_status"}
        for item in response.json()
    )
    assert (
        await client.post(
            f"/api/lists/{test_list.id}/videos/import-status",
            json={"video_ids": [str(identity) for identity in identities]},
        )
    ).status_code == 422
