"""
WebSocket endpoint for real-time progress updates.

Provides WebSocket connections that subscribe to user-specific Redis channels
for progress updates from video processing jobs.
"""

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.deps import get_current_ws_user
from app.core.redis import get_redis_client


router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/progress")
async def websocket_progress_endpoint(
    websocket: WebSocket,
    token: str,
):
    """
    WebSocket endpoint for real-time progress updates.

    Authenticates via token query parameter, subscribes to user-specific
    Redis channel, and forwards progress messages to the client.

    Args:
        websocket: WebSocket connection
        token: JWT authentication token (query parameter)

    Flow:
        1. Authenticate user via JWT token
        2. Accept WebSocket connection
        3. Subscribe to Redis channel: progress:user:{user_id}
        4. Forward all messages from Redis to WebSocket client
        5. Handle disconnection and cleanup
    """
    # Authenticate first (before accepting connection)
    user = await get_current_ws_user(websocket, token)

    # Accept connection after authentication
    await websocket.accept()
    logger.info(f"WebSocket connected for user {user.id}")

    # Setup Redis Pub/Sub
    redis = await get_redis_client()
    pubsub = redis.pubsub()
    channel = f"progress:user:{user.id}"

    try:
        await pubsub.subscribe(channel)
        logger.info(f"Subscribed to Redis channel: {channel}")

        # Listen for messages from Redis
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    # Parse and forward message to WebSocket client
                    progress_data = json.loads(message["data"])
                    await websocket.send_json(progress_data)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse progress message: {e}")
                except Exception as e:
                    logger.error(f"Error forwarding message: {e}")
                    break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user.id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
    finally:
        # Cleanup: unsubscribe and close pubsub
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            logger.info(f"Cleaned up WebSocket for user {user.id}")
        except Exception as e:
            logger.error(f"Error during WebSocket cleanup: {e}")
