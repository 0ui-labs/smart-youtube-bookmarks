"""
WebSocket endpoint for real-time progress updates.

Provides WebSocket connections that subscribe to user-specific Redis channels
for progress updates from video processing jobs.

Supports heartbeat ping/pong to keep connections alive through load balancers.
"""

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.api.deps import get_current_ws_user
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis_client
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_default_user() -> User | None:
    """Get the first user for development mode (no auth)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        return result.scalar_one_or_none()


@router.websocket("/ws/progress")
async def websocket_progress_endpoint(
    websocket: WebSocket,
    token: str | None = None,
):
    """
    WebSocket endpoint for real-time progress updates.

    Authenticates via token query parameter OR uses first user in dev mode.
    Subscribes to user-specific Redis channel and forwards progress messages.

    Args:
        websocket: WebSocket connection
        token: Optional JWT authentication token (query parameter)

    Flow:
        1. Authenticate user via JWT token OR use default user (dev mode)
        2. Accept WebSocket connection
        3. Subscribe to Redis channel: progress:user:{user_id}
        4. Forward all messages from Redis to WebSocket client
        5. Handle disconnection and cleanup
    """
    # Authenticate or get default user
    if token:
        user = await get_current_ws_user(websocket, token)
    elif settings.env != "production":
        # Development mode: use first user
        user = await get_default_user()
        if not user:
            logger.error("No users found in database for WebSocket connection")
            await websocket.close(code=1008)
            return
        logger.warning(f"WebSocket using default user (no auth): {user.id}")
    else:
        logger.error("WebSocket connection without token in production")
        await websocket.close(code=1008)
        return

    # Accept connection after authentication
    await websocket.accept()
    logger.info(f"WebSocket connected for user {user.id}")

    # Send auth confirmation to frontend
    await websocket.send_json(
        {"type": "auth_confirmed", "authenticated": True, "user_id": str(user.id)}
    )

    # Setup Redis Pub/Sub
    redis = await get_redis_client()
    pubsub = redis.pubsub()
    channel = f"progress:user:{user.id}"

    # Flag to signal shutdown to both tasks
    shutdown_event = asyncio.Event()

    async def handle_redis_messages():
        """Listen for progress updates from Redis and forward to WebSocket."""
        try:
            await pubsub.subscribe(channel)
            logger.warning(f"✓ WebSocket subscribed to Redis channel: {channel}")

            async for message in pubsub.listen():
                if shutdown_event.is_set():
                    break

                if message["type"] == "message":
                    try:
                        # Check WebSocket state before sending
                        if websocket.client_state.name != "CONNECTED":
                            logger.info(
                                f"WebSocket no longer connected (state: {websocket.client_state.name}), stopping"
                            )
                            break

                        # Parse and forward message to WebSocket client
                        progress_data = json.loads(message["data"])
                        logger.info(
                            f"↓ Forwarding progress to WebSocket: {progress_data}"
                        )
                        await websocket.send_json(progress_data)
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse progress message: {e}")
                        continue
                    except (WebSocketDisconnect, RuntimeError) as e:
                        logger.info(f"WebSocket connection closed: {e}")
                        break
                    except Exception as e:
                        logger.error(
                            f"Error forwarding message ({type(e).__name__}): {e}"
                        )
                        if "close" in str(e).lower() or "disconnect" in str(e).lower():
                            break
                        continue
        finally:
            shutdown_event.set()

    async def handle_websocket_messages():
        """Listen for client messages (ping/pong heartbeat, auth)."""
        try:
            while not shutdown_event.is_set():
                try:
                    # Wait for message with timeout to check shutdown periodically
                    message = await asyncio.wait_for(
                        websocket.receive_json(), timeout=1.0
                    )

                    msg_type = message.get("type")

                    # Handle heartbeat ping → respond with pong
                    if msg_type == "ping":
                        await websocket.send_json({"type": "pong"})
                        continue

                    # Handle auth message (re-auth on reconnect)
                    if msg_type == "auth":
                        logger.debug(f"Received auth message for user {user.id}")
                        continue

                    # Log unknown message types for debugging
                    logger.debug(f"Received unknown message type: {msg_type}")

                except asyncio.TimeoutError:
                    # No message received, check shutdown and continue
                    continue
                except json.JSONDecodeError:
                    logger.warning("Received non-JSON WebSocket message")
                    continue

        except WebSocketDisconnect:
            logger.info(f"WebSocket client disconnected for user {user.id}")
        except Exception as e:
            logger.error(f"Error in WebSocket message handler: {e}")
        finally:
            shutdown_event.set()

    try:
        # Run both handlers concurrently
        # When either exits, the other will be cancelled
        await asyncio.gather(
            handle_redis_messages(),
            handle_websocket_messages(),
        )
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user.id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
    finally:
        # Cleanup: unsubscribe and close pubsub
        shutdown_event.set()
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            logger.info(f"Cleaned up WebSocket for user {user.id}")
        except Exception as e:
            logger.error(f"Error during WebSocket cleanup: {e}")
