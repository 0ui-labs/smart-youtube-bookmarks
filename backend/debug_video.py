"""
Debug script to investigate video detail endpoint 500 error.
"""
import asyncio
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.video import Video
from app.api.helpers.field_union import get_available_fields_for_video


async def debug_video(video_id_str: str):
    """Debug a specific video to find cause of 500 error."""
    video_id = UUID(video_id_str)

    async for db in get_db():
        try:
            print(f"\n=== Debugging Video {video_id} ===\n")

            # Step 1: Load video with tags
            print("Step 1: Loading video with tags...")
            stmt = (
                select(Video)
                .where(Video.id == video_id)
                .options(selectinload(Video.tags))
            )
            result = await db.execute(stmt)
            video = result.scalar_one_or_none()

            if not video:
                print(f"❌ Video {video_id} not found")
                return

            print(f"✓ Video loaded: {video.title}")
            print(f"  - Tags type: {type(video.tags)}")
            print(f"  - Tags value: {video.tags}")

            # Step 2: Try to iterate tags
            print("\nStep 2: Testing tags iteration...")
            try:
                tags = video.tags if video.tags is not None else []
                print(f"  - Tags assigned: {tags}")
                print(f"  - Tags is iterable: {hasattr(tags, '__iter__')}")

                # Try to iterate
                tag_list = list(tags)
                print(f"  - Tags converted to list: {tag_list}")
                print(f"  - Number of tags: {len(tag_list)}")

                for tag in tag_list:
                    print(f"    * Tag: {tag.name}, schema_id: {tag.schema_id}")

            except TypeError as e:
                print(f"❌ TypeError during tags iteration: {e}")
                # Try workaround
                if "'Tag' object is not iterable" in str(e):
                    print("  - Applying single-tag workaround...")
                    tags = [video.tags]
                    print(f"  - Workaround tags: {tags}")

            # Step 3: Load tags manually like endpoint does
            print("\nStep 3: Loading tags manually...")
            from app.models.tag import Tag, video_tags as video_tags_table
            tags_stmt = (
                select(Tag)
                .join(video_tags_table, Tag.id == video_tags_table.c.tag_id)
                .where(video_tags_table.c.video_id == video_id)
            )
            tags_result = await db.execute(tags_stmt)
            tags_list = list(tags_result.scalars().all())
            print(f"  - Manual tags query: {len(tags_list)} tags found")
            for tag in tags_list:
                print(f"    * Tag: {tag.name}, schema_id: {tag.schema_id}")

            # Assign to video
            video.__dict__['tags'] = tags_list

            # Step 4: Try get_available_fields_for_video
            print("\nStep 4: Testing get_available_fields_for_video...")
            try:
                available_fields = await get_available_fields_for_video(video, db)
                print(f"✓ Available fields loaded: {len(available_fields)} fields")
                for field, schema_name, display_order, show_on_card in available_fields:
                    print(f"    * {field.name} (type: {field.field_type}), schema: {schema_name}")
            except Exception as e:
                print(f"❌ Error in get_available_fields_for_video: {e}")
                import traceback
                traceback.print_exc()

            print("\n=== Debug Complete ===\n")
            break

        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")
            import traceback
            traceback.print_exc()
            break


if __name__ == "__main__":
    # Test the failing video
    asyncio.run(debug_video("8655b3cb-5e2c-4889-aa26-ec8ce51e5ddc"))
