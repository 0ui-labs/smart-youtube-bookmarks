"""Video import export endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.video import Video
from app.schemas.video import (
    BulkUploadResponse,
    VideoAdd,
    VideoFilterRequest,
    VideoResponse,
)
from app.services.video_creation_service import create_video, import_csv_videos
from app.services.video_csv_export_service import build_csv_export

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/lists/{list_id}/videos",
    response_model=VideoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_video_to_list(
    list_id: UUID, video_data: VideoAdd, db: AsyncSession = Depends(get_db)
) -> Video:
    video = await create_video(db, list_id, video_data)
    await db.commit()
    return video


@router.post(
    "/lists/{list_id}/videos/bulk",
    response_model=BulkUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def bulk_upload_videos(
    list_id: UUID, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
) -> BulkUploadResponse:
    result = await import_csv_videos(db, list_id, file)
    await db.commit()
    return result


@router.get("/lists/{list_id}/export/csv")
async def export_videos_csv(
    list_id: UUID, db: AsyncSession = Depends(get_db)
) -> StreamingResponse:
    return csv_download(list_id, await build_csv_export(db, list_id))


@router.post("/lists/{list_id}/export/csv")
async def export_filtered_videos_csv(
    list_id: UUID, filters: VideoFilterRequest, db: AsyncSession = Depends(get_db)
) -> StreamingResponse:
    return csv_download(list_id, await build_csv_export(db, list_id, filters))


def csv_download(list_id: UUID, content: str) -> StreamingResponse:
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=videos_{list_id}.csv"},
    )
