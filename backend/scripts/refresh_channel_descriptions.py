#!/usr/bin/env python3
"""
Script to refresh channel descriptions from YouTube API for existing channels.

Usage:
    cd backend

    # Refresh channels for a specific user:
    python scripts/refresh_channel_descriptions.py --user-id <uuid>

    # Refresh ALL channels (admin-only, requires explicit flag):
    python scripts/refresh_channel_descriptions.py --all

Note: Either --user-id or --all must be provided. This prevents accidental
processing of all users' data, which could cause rate-limiting and privacy issues.
"""

import argparse
import asyncio
import os
import sys
from uuid import UUID

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.clients.youtube import YouTubeClient
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.channel import Channel


def parse_args() -> argparse.Namespace:
    """Parse and validate command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Refresh channel descriptions from YouTube API.",
        epilog="Either --user-id or --all must be provided.",
    )
    parser.add_argument(
        "--user-id",
        type=str,
        help="UUID of the user whose channels should be refreshed",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="all_users",
        help="Process ALL channels across all users (admin-only)",
    )

    args = parser.parse_args()

    # Validate: require either --user-id or --all
    if not args.user_id and not args.all_users:
        parser.error(
            "You must specify either --user-id <uuid> or --all.\n"
            "Use --all only for admin operations affecting all users."
        )

    # Validate UUID format if provided
    if args.user_id:
        try:
            args.user_id = UUID(args.user_id)
        except ValueError:
            parser.error(f"Invalid UUID format: {args.user_id}")

    return args


async def refresh_channel_descriptions(user_id: UUID | None = None):
    """Fetch and update descriptions for channels.

    Args:
        user_id: If provided, only refresh channels for this user.
                 If None, refresh all channels (admin mode).
    """
    youtube_client = YouTubeClient(api_key=settings.youtube_api_key)

    async with AsyncSessionLocal() as db:
        # Build query with optional user filter
        query = select(Channel)
        if user_id is not None:
            query = query.where(Channel.user_id == user_id)
            print(f"Filtering channels for user: {user_id}")
        else:
            print("WARNING: Processing ALL channels across all users (admin mode)")

        result = await db.execute(query)
        channels = result.scalars().all()

        print(f"Found {len(channels)} channels to check")

        updated = 0
        for channel in channels:
            # Fetch channel info from YouTube
            print(f"Fetching info for: {channel.name} ({channel.youtube_channel_id})")

            try:
                info = await youtube_client.get_channel_info(channel.youtube_channel_id)

                # Update description if we got one
                if info.get("description"):
                    channel.description = info["description"]
                    updated += 1
                    print(
                        f"  -> Updated description ({len(info['description'])} chars)"
                    )
                else:
                    print("  -> No description available")

                # Also update thumbnail if missing
                if not channel.thumbnail_url and info.get("thumbnail_url"):
                    channel.thumbnail_url = info["thumbnail_url"]
                    print("  -> Updated thumbnail")

            except Exception as e:
                print(f"  -> Error: {e}")

        await db.commit()
        print(f"\nDone! Updated {updated} channels.")


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(refresh_channel_descriptions(user_id=args.user_id))
