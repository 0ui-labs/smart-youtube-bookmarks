"""Enforce ownership in ORM queries and validate request references atomically.

System workers use unscoped sessions. HTTP sessions always carry a principal;
all reads/updates/deletes inherit these criteria, including aggregates and aliases.
"""

from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import and_, event, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import ORMExecuteState, Session, with_loader_criteria

from app.models import (
    BookmarkList,
    Channel,
    CustomField,
    FieldSchema,
    JobProgressEvent,
    ProcessingJob,
    Schema,
    SchemaField,
    Subscription,
    SubscriptionMatch,
    Tag,
    User,
    Video,
    VideoEnrichment,
    VideoFieldValue,
)


def ownership_policies(user_id: UUID) -> list[tuple[Any, Any]]:
    lists = (
        select(BookmarkList.id).where(BookmarkList.user_id == user_id).correlate(None)
    )
    videos = select(Video.id).where(Video.list_id.in_(lists)).correlate(None)
    fields = (
        select(CustomField.id).where(CustomField.list_id.in_(lists)).correlate(None)
    )
    schemas = (
        select(FieldSchema.id).where(FieldSchema.list_id.in_(lists)).correlate(None)
    )
    jobs = (
        select(ProcessingJob.id).where(ProcessingJob.list_id.in_(lists)).correlate(None)
    )
    subscriptions = (
        select(Subscription.id).where(Subscription.user_id == user_id).correlate(None)
    )
    return [
        (User, User.id == user_id),
        (BookmarkList, BookmarkList.user_id == user_id),
        (Tag, Tag.user_id == user_id),
        (Channel, Channel.user_id == user_id),
        (
            Subscription,
            and_(Subscription.user_id == user_id, Subscription.list_id.in_(lists)),
        ),
        (Video, Video.list_id.in_(lists)),
        (CustomField, CustomField.list_id.in_(lists)),
        (FieldSchema, FieldSchema.list_id.in_(lists)),
        (ProcessingJob, ProcessingJob.list_id.in_(lists)),
        (VideoEnrichment, VideoEnrichment.video_id.in_(videos)),
        (
            VideoFieldValue,
            and_(
                VideoFieldValue.video_id.in_(videos),
                VideoFieldValue.field_id.in_(fields),
            ),
        ),
        (
            SchemaField,
            and_(SchemaField.schema_id.in_(schemas), SchemaField.field_id.in_(fields)),
        ),
        (JobProgressEvent, JobProgressEvent.job_id.in_(jobs)),
        (
            SubscriptionMatch,
            and_(
                SubscriptionMatch.subscription_id.in_(subscriptions),
                SubscriptionMatch.video_id.in_(videos),
            ),
        ),
        (
            Schema,
            Schema.id.in_(
                select(BookmarkList.schema_id)
                .where(BookmarkList.user_id == user_id)
                .correlate(None)
            ),
        ),
    ]


@event.listens_for(Session, "do_orm_execute")
def scope_http_queries(execution: ORMExecuteState) -> None:
    user = execution.session.info.get("user")
    if user is None:
        return
    if execution.is_select or execution.is_update or execution.is_delete:
        execution.statement = execution.statement.options(
            *[
                with_loader_criteria(model, condition, include_aliases=True)
                for model, condition in ownership_policies(user.id)
            ]
        )


def authenticated_user(db: AsyncSession) -> User:
    user = db.info.get("user")
    if not isinstance(user, User) or not user.is_active:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


REFERENCE_MODELS = {
    "list_id": BookmarkList,
    "video_id": Video,
    "tag_id": Tag,
    "category_id": Tag,
    "field_id": CustomField,
    "schema_id": FieldSchema,
    "default_schema_id": FieldSchema,
    "channel_id": Channel,
    "subscription_id": Subscription,
    "job_id": ProcessingJob,
}


async def validate_request_references(request: Request, db: AsyncSession) -> None:
    references: list[tuple[str, Any]] = list(request.path_params.items()) + list(
        request.query_params.multi_items()
    )
    if request.headers.get("content-type", "").split(";")[0] == "application/json":
        try:
            body = await request.json()
        except ValueError:
            return  # The route's schema returns its normal validation error.

        def collect(value: Any) -> None:
            if isinstance(value, dict):
                for key, item in value.items():
                    if key.endswith("_ids") and isinstance(item, list):
                        references.extend((key[:-1], identity) for identity in item)
                    elif key in REFERENCE_MODELS:
                        references.append((key, item))
                    else:
                        collect(item)
            elif isinstance(value, list):
                for item in value:
                    collect(item)

        collect(body)
    for name, identity in list(references):
        if (
            name == "sort_by"
            and isinstance(identity, str)
            and identity.startswith("field:")
        ):
            references.append(("field_id", identity.removeprefix("field:")))
    for name, identity in references:
        model = REFERENCE_MODELS.get(name)
        if model is None or identity is None:
            continue
        # YouTube channel IDs used for subscription discovery are external IDs.
        if (
            name == "channel_id"
            and isinstance(identity, str)
            and identity.startswith("UC")
        ):
            continue
        try:
            parsed = UUID(str(identity))
        except ValueError:
            continue  # Pydantic retains responsibility for malformed IDs.
        if (
            name == "schema_id"
            and request.url.path == "/api/lists"
            and request.method == "POST"
        ):
            model = Schema
        if (
            await db.execute(select(model.id).where(model.id == parsed))
        ).scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Resource not found")
