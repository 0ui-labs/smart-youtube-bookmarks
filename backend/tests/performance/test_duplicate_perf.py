import time

import pytest
from httpx import AsyncClient

from app.models.custom_field import CustomField
from app.models.list import BookmarkList


@pytest.mark.performance
@pytest.mark.asyncio
class TestDuplicateDetectionPerformance:
    """Performance benchmarks for duplicate detection."""

    async def test_basic_mode_performance_1000_fields(
        self, client: AsyncClient, test_db, test_list: BookmarkList
    ):
        """Basic mode should handle 1000 fields in < 100ms."""
        # Create 1000 fields
        fields = []
        for i in range(1000):
            field = CustomField(
                list_id=test_list.id,
                name=f"Test Field {i:04d}",
                field_type="text",
                config={},
            )
            fields.append(field)

        test_db.add_all(fields)
        await test_db.commit()

        # Benchmark check
        start = time.time()
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
            json={"name": "Test Field 0500"},
        )
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 0.1  # 100ms
        print(f"Basic mode with 1000 fields: {elapsed * 1000:.2f}ms")

    async def test_smart_mode_performance_100_fields(
        self, client: AsyncClient, test_db, test_list: BookmarkList
    ):
        """Smart mode should handle 100 fields in < 500ms."""
        # Create 100 fields
        fields = []
        for i in range(100):
            field = CustomField(
                list_id=test_list.id,
                name=f"Test Field {i:03d}",
                field_type="text",
                config={},
            )
            fields.append(field)

        test_db.add_all(fields)
        await test_db.commit()

        # Benchmark smart check
        start = time.time()
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields/check-duplicate?mode=smart",
            json={"name": "Test Field X"},
        )
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 0.5  # 500ms
        print(f"Smart mode with 100 fields: {elapsed * 1000:.2f}ms")

    async def test_levenshtein_calculation_speed(self):
        """Levenshtein calculation should be very fast."""
        from app.services.duplicate_detection import DuplicateDetector

        detector = DuplicateDetector(gemini_client=None, redis_client=None)

        # Benchmark 10000 calculations
        start = time.time()
        for i in range(10000):
            detector._calculate_levenshtein("test string", "test strong")
        elapsed = time.time() - start

        # Should complete in < 1 second
        assert elapsed < 1.0
        print(
            f"10000 Levenshtein calculations: {elapsed * 1000:.2f}ms ({10000 / elapsed:.0f} ops/sec)"
        )
