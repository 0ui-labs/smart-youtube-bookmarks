"""Reproducible synthetic collections; never provider or application data.

Before: SYB_BENCHMARK_PHASE=before SYB_BENCHMARK_OUTPUT=/tmp/before.json
After: default phase uses the additive paginated endpoint.
"""

import json
import os
import platform
import statistics
import time
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import event, insert

from app.models import (
    CustomField,
    FieldSchema,
    SchemaField,
    Tag,
    Video,
    VideoFieldValue,
)
from app.models.tag import video_tags


@pytest.mark.parametrize("size", [100, 1000, 10000])
async def test_measure_bounded_video_response(
    client, test_db, test_engine, test_list, test_user, size
):
    field = CustomField(
        list_id=test_list.id,
        name="Measurement rating",
        field_type="rating",
        config={"max_rating": 5},
    )
    schema = FieldSchema(list_id=test_list.id, name="Measurement schema")
    tags = [
        Tag(user_id=test_user.id, name=f"Measurement tag {index}") for index in range(2)
    ]
    test_db.add_all([field, schema, *tags])
    await test_db.flush()
    test_db.add(
        SchemaField(
            schema_id=schema.id, field_id=field.id, display_order=0, show_on_card=True
        )
    )
    test_list.default_schema_id = schema.id
    identities = [uuid4() for _ in range(size)]
    for offset in range(0, size, 500):
        batch = identities[offset : offset + 500]
        await test_db.execute(
            insert(Video),
            [
                {
                    "id": identity,
                    "list_id": test_list.id,
                    "youtube_id": f"v{offset + index:010d}",
                    "title": f"Measurement video {(offset + index) // 2:05d}",
                    "channel": "Synthetic channel",
                    "duration": 120,
                    "processing_status": "completed",
                    "import_stage": "complete",
                    "import_progress": 100,
                }
                for index, identity in enumerate(batch)
            ],
        )
        await test_db.execute(
            insert(video_tags),
            [
                {"video_id": identity, "tag_id": tags[index % 2].id}
                for index, identity in enumerate(batch)
            ],
        )
        await test_db.execute(
            insert(VideoFieldValue),
            [
                {"video_id": identity, "field_id": field.id, "value_numeric": 4}
                for identity in batch
            ],
        )
    await test_db.commit()
    phase = os.environ.get("SYB_BENCHMARK_PHASE", "after")
    endpoint = f"/api/lists/{test_list.id}/videos" + (
        "" if phase == "before" else "/page"
    )
    latencies, queries, response_bytes = [], [], []
    query_count = 0

    def count_query(*args):
        nonlocal query_count
        query_count += 1

    event.listen(test_engine.sync_engine, "before_cursor_execute", count_query)
    try:
        for _ in range(3):
            query_count = 0
            started = time.perf_counter()
            response = await client.get(endpoint)
            latencies.append(round((time.perf_counter() - started) * 1000, 2))
            assert response.status_code == 200, response.text[:200]
            data = response.json()
            items = data if phase == "before" else data["items"]
            assert len(items) == (size if phase == "before" else min(50, size))
            if phase != "before":
                assert data["total"] == size
                assert len(items) <= 100
            if phase != "before":
                assert query_count <= 20, (
                    "Page hydration must not issue per-video queries"
                )
            queries.append(query_count)
            response_bytes.append(len(response.content))
    finally:
        event.remove(test_engine.sync_engine, "before_cursor_execute", count_query)
    record = {
        "size": size,
        "returned": len(items),
        "sql_queries": queries,
        "response_bytes": response_bytes,
        "latency_ms": latencies,
        "median_ms": statistics.median(latencies),
    }
    print(json.dumps(record))
    output = os.environ.get("SYB_BENCHMARK_OUTPUT")
    if output:
        path = Path(output)
        report = (
            json.loads(path.read_text())
            if path.exists()
            else {
                "phase": phase,
                "platform": platform.platform(),
                "python": platform.python_version(),
                "samples": [],
            }
        )
        report["samples"] = [
            sample for sample in report["samples"] if sample["size"] != size
        ] + [record]
        path.write_text(json.dumps(report, indent=2) + "\n")
