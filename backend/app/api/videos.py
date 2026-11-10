"""Video API composition. Public URLs remain stable across focused routers."""

from fastapi import APIRouter

from app.api.video_routes import (
    deletion,
    fields,
    import_export,
    progress,
    reading,
    tagging,
)
from app.api.video_routes.deletion import delete_video as delete_video
from app.api.video_routes.fields import (
    batch_update_video_field_values as batch_update_video_field_values,
)
from app.api.video_routes.import_export import (
    add_video_to_list as add_video_to_list,
    bulk_upload_videos as bulk_upload_videos,
    export_videos_csv as export_videos_csv,
)
from app.api.video_routes.progress import update_watch_progress as update_watch_progress
from app.api.video_routes.reading import (
    filter_videos_in_list as filter_videos_in_list,
    get_video_by_id as get_video_by_id,
    get_videos_in_list as get_videos_in_list,
    list_all_videos as list_all_videos,
)
from app.api.video_routes.tagging import (
    assign_tags_to_video as assign_tags_to_video,
    bulk_assign_tags_to_videos as bulk_assign_tags_to_videos,
    get_video_tags as get_video_tags,
    remove_tag_from_video as remove_tag_from_video,
    set_video_category as set_video_category,
)
from app.services.video_job_service import (
    _enqueue_enrichment as _enqueue_enrichment,
    _enqueue_video_processing as _enqueue_video_processing,
)
from app.services.video_metadata_service import (
    extract_youtube_id as extract_youtube_id,
    parse_youtube_duration as parse_youtube_duration,
    parse_youtube_timestamp as parse_youtube_timestamp,
)
from app.services.video_query_service import (
    _apply_sorting as _apply_sorting,
    _load_channel_thumbnails as _load_channel_thumbnails,
)

router = APIRouter(prefix="/api", tags=["videos"])
router.include_router(reading.router)
router.include_router(import_export.router)
router.include_router(progress.router)
router.include_router(deletion.router)
router.include_router(tagging.router)
router.include_router(fields.router)
