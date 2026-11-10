"""Synthetic administrative transfer; never touches application data."""

import pytest

from app.models import User
from app.services.legacy_ownership_service import transfer_legacy_ownership


async def test_transfer_is_explicit_repeatable_and_dry_run_first(
    test_db, test_user, test_list
):
    target = User(
        clerk_id="user_synthetic_target",
        email="target@identity.invalid",
        hashed_password="!test",
    )
    test_db.add(target)
    await test_db.commit()
    counts = await transfer_legacy_ownership(test_db, test_user.id, target.clerk_id)
    assert counts["bookmarks_lists"] == 1
    await test_db.refresh(test_list)
    assert test_list.user_id == test_user.id
    await transfer_legacy_ownership(test_db, test_user.id, target.clerk_id, apply=True)
    await test_db.commit()
    await test_db.refresh(test_list)
    assert test_list.user_id == target.id
    assert all(
        value == 0
        for value in (
            await transfer_legacy_ownership(
                test_db, test_user.id, target.clerk_id, apply=True
            )
        ).values()
    )


async def test_transfer_rejects_bound_source_and_unknown_target(test_db, test_user):
    with pytest.raises(ValueError):
        await transfer_legacy_ownership(test_db, test_user.id, "missing")
    test_user.clerk_id = "user_bound"
    await test_db.commit()
    with pytest.raises(ValueError):
        await transfer_legacy_ownership(test_db, test_user.id, "user_bound")
