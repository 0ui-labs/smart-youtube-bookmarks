"""Session-bound ephemeral connection grants."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis_client
from app.services.access_service import authenticated_user
from app.services.connection_ticket_service import issue_ticket

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/ws-ticket")
async def create_connection_ticket(
    db: AsyncSession = Depends(get_db),
) -> dict[str, str | int]:
    user = authenticated_user(db)
    try:
        redis = await get_redis_client()
        ticket = await issue_ticket(redis, user.id)
    except Exception as error:
        raise HTTPException(
            status_code=503, detail="Realtime connection unavailable"
        ) from error
    return {"ticket": ticket, "expires_in": 60}
