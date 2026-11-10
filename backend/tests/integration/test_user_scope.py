"""Database criteria apply to object, scalar, aggregate and bulk queries."""

from uuid import uuid4

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import aliased

from app.models import BookmarkList, User, Video
from app.services.access_service import scope_http_queries  # noqa: F401 -- registers the policy


async def test_scoped_queries_never_expose_foreign_rows(test_db, test_list, test_user):
    other = User(email=f"other-{uuid4()}@example.com", hashed_password="!test")
    test_db.add(other)
    await test_db.flush()
    other_list = BookmarkList(name="foreign", user_id=other.id)
    test_db.add(other_list)
    await test_db.flush()
    own_video = Video(list_id=test_list.id, youtube_id="ownvideo123")
    foreign_video = Video(list_id=other_list.id, youtube_id="foreign1234")
    test_db.add_all([own_video, foreign_video])
    await test_db.commit()
    test_db.info["user"] = test_user
    try:
        assert (await test_db.execute(select(BookmarkList.id))).scalars().all() == [
            test_list.id
        ]
        assert (
            await test_db.execute(select(func.count()).select_from(Video))
        ).scalar_one() == 1
        assert (
            await test_db.execute(select(Video).where(Video.id == foreign_video.id))
        ).scalar_one_or_none() is None
        alias = aliased(Video)
        assert (await test_db.execute(select(alias.id))).scalars().all() == [
            own_video.id
        ]
        assert (
            await test_db.execute(
                update(Video).where(Video.id == foreign_video.id).values(title="stolen")
            )
        ).rowcount == 0
        assert (
            await test_db.execute(delete(Video).where(Video.id == foreign_video.id))
        ).rowcount == 0
    finally:
        test_db.info.pop("user", None)
    await test_db.refresh(foreign_video)
    assert foreign_video.title is None
