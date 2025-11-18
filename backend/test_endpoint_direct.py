"""
Test the actual endpoint to catch the exact error.
"""
import asyncio
from uuid import UUID
from fastapi import HTTPException

# Mock current_user for testing
class MockUser:
    def __init__(self, user_id: str):
        self.id = UUID(user_id)

async def test_get_video_endpoint():
    """Test get_video_by_id endpoint directly."""
    from app.core.database import get_db
    from app.api.videos import get_video_by_id

    video_id = UUID('8655b3cb-5e2c-4889-aa26-ec8ce51e5ddc')

    # Acquire a single db instance
    db_gen = get_db()
    db = await anext(db_gen)

    try:
        try:
            print("Calling get_video_by_id endpoint...")
            result = await get_video_by_id(
                video_id=video_id,
                db=db
            )
            print(f"✓ Success! Got video: {result.get('title', 'No title')}")
            print(f"  - Available fields: {len(result.get('available_fields', []))}")
            print(f"  - Field values: {len(result.get('field_values', []))}")
        except HTTPException as e:
            print(f"❌ HTTPException: {e.status_code} - {e.detail}")
            raise  # Re-raise to not hide HTTP errors
        except Exception as e:
            # Debug logging for unexpected errors
            print(f"❌ Exception: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            raise  # Re-raise to not hide errors
        else:
            # Only return on successful execution (no exception)
            return result
    finally:
        # Ensure db cleanup happens
        try:
            await anext(db_gen, None)
        except StopAsyncIteration:
            pass

if __name__ == "__main__":
    asyncio.run(test_get_video_endpoint())
