#!/usr/bin/env python3
"""
Script to refresh channel descriptions from YouTube API for all existing channels.

Usage:
    cd backend
    python scripts/refresh_channel_descriptions.py
"""
import asyncio
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.channel import Channel
from app.clients.youtube import YouTubeClient
from app.core.config import settings


async def refresh_channel_descriptions():
    """Fetch and update descriptions for all channels missing them."""

    youtube_client = YouTubeClient(api_key=settings.youtube_api_key)

    async with AsyncSessionLocal() as db:
        # Get all channels
        result = await db.execute(select(Channel))
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
                    print(f"  -> Updated description ({len(info['description'])} chars)")
                else:
                    print(f"  -> No description available")

                # Also update thumbnail if missing
                if not channel.thumbnail_url and info.get("thumbnail_url"):
                    channel.thumbnail_url = info["thumbnail_url"]
                    print(f"  -> Updated thumbnail")

            except Exception as e:
                print(f"  -> Error: {e}")

        await db.commit()
        print(f"\nDone! Updated {updated} channels.")


if __name__ == "__main__":
    asyncio.run(refresh_channel_descriptions())
