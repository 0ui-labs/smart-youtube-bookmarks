# CSV Import/Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable bulk video upload via CSV and export video lists to CSV format.

**Architecture:** Add two new backend endpoints (bulk upload, CSV export) with proper validation and error handling. Frontend components for file upload and export download. Backend uses Python's built-in CSV module for parsing/generation. File uploads via multipart/form-data.

**Tech Stack:** FastAPI (multipart), Python csv module, React file input, Blob download API

---

## Task 1: Backend CSV Bulk Upload Endpoint

**Files:**
- Modify: `backend/app/api/videos.py`
- Modify: `backend/app/schemas/video.py`
- Test: `backend/tests/api/test_videos.py`

### Step 1: Write failing test for bulk upload endpoint

**File:** `backend/tests/api/test_videos.py`

Add at the end of the file (after existing `test_delete_video_success` test):

```python
import io
from fastapi import UploadFile


@pytest.mark.asyncio
async def test_bulk_upload_csv_success(client, test_list):
    """Test bulk video upload from CSV file."""
    # Create CSV content with 3 videos
    csv_content = """url
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/jNQXAC9IVRw
https://www.youtube.com/watch?v=9bZkp7q19f0"""

    csv_file = io.BytesIO(csv_content.encode('utf-8'))

    # Upload CSV
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/bulk",
        files={"file": ("videos.csv", csv_file, "text/csv")}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["created_count"] == 3
    assert data["failed_count"] == 0
    assert len(data["failures"]) == 0

    # Verify videos were created
    videos_response = await client.get(f"/api/lists/{test_list.id}/videos")
    assert videos_response.status_code == 200
    videos = videos_response.json()
    assert len(videos) == 3


@pytest.mark.asyncio
async def test_bulk_upload_csv_with_failures(client, test_list):
    """Test bulk upload handles invalid URLs gracefully."""
    csv_content = """url
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://invalid.com/video
https://youtu.be/jNQXAC9IVRw"""

    csv_file = io.BytesIO(csv_content.encode('utf-8'))

    response = await client.post(
        f"/api/lists/{test_list.id}/videos/bulk",
        files={"file": ("videos.csv", csv_file, "text/csv")}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["created_count"] == 2  # Only 2 valid URLs
    assert data["failed_count"] == 1
    assert len(data["failures"]) == 1
    assert "invalid.com" in data["failures"][0]["url"]


@pytest.mark.asyncio
async def test_bulk_upload_csv_list_not_found(client):
    """Test bulk upload returns 404 when list doesn't exist."""
    csv_content = """url
https://www.youtube.com/watch?v=dQw4w9WgXcQ"""

    csv_file = io.BytesIO(csv_content.encode('utf-8'))
    fake_list_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        f"/api/lists/{fake_list_id}/videos/bulk",
        files={"file": ("videos.csv", csv_file, "text/csv")}
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_bulk_upload_csv_invalid_header(client, test_list):
    """Test bulk upload validates CSV header."""
    csv_content = """invalid_header
https://www.youtube.com/watch?v=dQw4w9WgXcQ"""

    csv_file = io.BytesIO(csv_content.encode('utf-8'))

    response = await client.post(
        f"/api/lists/{test_list.id}/videos/bulk",
        files={"file": ("videos.csv", csv_file, "text/csv")}
    )

    assert response.status_code == 422
    assert "header" in response.json()["detail"].lower()
```

### Step 2: Run tests to verify they fail

```bash
cd backend
pytest tests/api/test_videos.py::test_bulk_upload_csv_success -v
pytest tests/api/test_videos.py::test_bulk_upload_csv_with_failures -v
pytest tests/api/test_videos.py::test_bulk_upload_csv_list_not_found -v
pytest tests/api/test_videos.py::test_bulk_upload_csv_invalid_header -v
```

**Expected output:** All 4 tests FAIL with `404: Not Found` (endpoint doesn't exist yet)

### Step 3: Add Pydantic schema for bulk upload response

**File:** `backend/app/schemas/video.py`

Add after the `VideoResponse` class:

```python
class BulkUploadFailure(BaseModel):
    """Details about a failed video upload in bulk operation."""
    row: int
    url: str
    error: str


class BulkUploadResponse(BaseModel):
    """Response schema for bulk video upload."""
    created_count: int
    failed_count: int
    failures: list[BulkUploadFailure] = Field(default_factory=list)
```

### Step 4: Implement bulk upload endpoint

**File:** `backend/app/api/videos.py`

Add these imports at the top:

```python
import csv
import io
from fastapi import UploadFile, File
from app.schemas.video import BulkUploadResponse, BulkUploadFailure
```

Add this endpoint after the `delete_video` function (at the end of the file):

```python
@router.post(
    "/lists/{list_id}/videos/bulk",
    response_model=BulkUploadResponse,
    status_code=status.HTTP_201_CREATED
)
async def bulk_upload_videos(
    list_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
) -> BulkUploadResponse:
    """
    Bulk upload videos from CSV file.

    CSV format:
    ```
    url
    https://www.youtube.com/watch?v=VIDEO_ID_1
    https://youtu.be/VIDEO_ID_2
    ```

    - Validates list exists (404 if not found)
    - Validates CSV header must be "url"
    - Processes each row, collecting failures
    - Returns created_count, failed_count, and failure details
    - Commits all valid videos in single transaction

    Args:
        list_id: UUID of the bookmark list
        file: CSV file with YouTube URLs
        db: Database session

    Returns:
        BulkUploadResponse: Statistics and failure details

    Raises:
        HTTPException 404: List not found
        HTTPException 422: Invalid CSV header or file format
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Read and parse CSV
    try:
        content = await file.read()
        csv_string = content.decode('utf-8')
        csv_file = io.StringIO(csv_string)
        reader = csv.DictReader(csv_file)

        # Validate header
        if reader.fieldnames is None or 'url' not in reader.fieldnames:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CSV must have 'url' header column"
            )

        videos_to_create = []
        failures = []
        row_num = 1  # Start at 1 (header is row 0)

        for row in reader:
            row_num += 1
            url = row.get('url', '').strip()

            if not url:
                failures.append(BulkUploadFailure(
                    row=row_num,
                    url=url,
                    error="Empty URL"
                ))
                continue

            # Extract YouTube ID
            try:
                youtube_id = extract_youtube_id(url)

                # Check for duplicates in this batch
                if any(v.youtube_id == youtube_id for v in videos_to_create):
                    failures.append(BulkUploadFailure(
                        row=row_num,
                        url=url,
                        error="Duplicate video in CSV"
                    ))
                    continue

                # Create video object
                video = Video(
                    list_id=list_id,
                    youtube_id=youtube_id,
                    processing_status="pending"
                )
                videos_to_create.append(video)

            except ValueError as e:
                failures.append(BulkUploadFailure(
                    row=row_num,
                    url=url,
                    error=str(e)
                ))

        # Bulk insert valid videos
        if videos_to_create:
            db.add_all(videos_to_create)
            try:
                await db.commit()
            except IntegrityError:
                # Handle duplicates with existing videos in DB
                await db.rollback()
                # Retry one by one to identify which failed
                created = 0
                for video in videos_to_create:
                    try:
                        db.add(video)
                        await db.flush()
                        created += 1
                    except IntegrityError:
                        await db.rollback()
                        failures.append(BulkUploadFailure(
                            row=0,  # Row unknown in retry
                            url=f"https://www.youtube.com/watch?v={video.youtube_id}",
                            error="Video already exists in this list"
                        ))
                await db.commit()

                return BulkUploadResponse(
                    created_count=created,
                    failed_count=len(failures),
                    failures=failures
                )

        return BulkUploadResponse(
            created_count=len(videos_to_create),
            failed_count=len(failures),
            failures=failures
        )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File must be UTF-8 encoded"
        )
    except csv.Error as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid CSV format: {str(e)}"
        )
```

### Step 5: Run tests to verify they pass

```bash
cd backend
pytest tests/api/test_videos.py::test_bulk_upload_csv_success -v
pytest tests/api/test_videos.py::test_bulk_upload_csv_with_failures -v
pytest tests/api/test_videos.py::test_bulk_upload_csv_list_not_found -v
pytest tests/api/test_videos.py::test_bulk_upload_csv_invalid_header -v
```

**Expected output:** All 4 tests PASS

### Step 6: Commit bulk upload feature

```bash
cd backend
git add app/api/videos.py app/schemas/video.py tests/api/test_videos.py
git commit -m "feat: add CSV bulk video upload endpoint

Implements POST /api/lists/{list_id}/videos/bulk endpoint:
- Accepts CSV file with 'url' column
- Validates YouTube URLs and extracts IDs
- Bulk inserts valid videos in single transaction
- Returns created/failed counts with detailed failure info
- Handles duplicates gracefully (both in CSV and DB)

Tests: 4 new tests covering success, failures, 404, invalid header

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Backend CSV Export Endpoint

**Files:**
- Modify: `backend/app/api/videos.py`
- Test: `backend/tests/api/test_videos.py`

### Step 1: Write failing test for CSV export

**File:** `backend/tests/api/test_videos.py`

Add at the end of the file:

```python
@pytest.mark.asyncio
async def test_export_videos_csv_success(client, test_list, test_video):
    """Test exporting videos to CSV."""
    response = await client.get(f"/api/lists/{test_list.id}/export/csv")

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment" in response.headers["content-disposition"]

    # Parse CSV response
    csv_content = response.content.decode('utf-8')
    lines = csv_content.strip().split('\n')

    assert len(lines) == 2  # Header + 1 video
    assert lines[0] == "youtube_id,status,created_at"
    assert test_video.youtube_id in lines[1]
    assert "pending" in lines[1]


@pytest.mark.asyncio
async def test_export_videos_csv_empty_list(client, test_list):
    """Test exporting empty list returns CSV with header only."""
    response = await client.get(f"/api/lists/{test_list.id}/export/csv")

    assert response.status_code == 200
    csv_content = response.content.decode('utf-8')
    lines = csv_content.strip().split('\n')

    assert len(lines) == 1  # Header only
    assert lines[0] == "youtube_id,status,created_at"


@pytest.mark.asyncio
async def test_export_videos_csv_list_not_found(client):
    """Test export returns 404 when list doesn't exist."""
    fake_list_id = "00000000-0000-0000-0000-000000000000"

    response = await client.get(f"/api/lists/{fake_list_id}/export/csv")

    assert response.status_code == 404
```

### Step 2: Run tests to verify they fail

```bash
cd backend
pytest tests/api/test_videos.py::test_export_videos_csv_success -v
pytest tests/api/test_videos.py::test_export_videos_csv_empty_list -v
pytest tests/api/test_videos.py::test_export_videos_csv_list_not_found -v
```

**Expected output:** All 3 tests FAIL with `404: Not Found`

### Step 3: Implement CSV export endpoint

**File:** `backend/app/api/videos.py`

Add these imports at the top:

```python
from fastapi.responses import StreamingResponse
from datetime import datetime
```

Add this endpoint after the `bulk_upload_videos` function:

```python
@router.get("/lists/{list_id}/export/csv")
async def export_videos_csv(
    list_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> StreamingResponse:
    """
    Export all videos in a list to CSV format.

    CSV format:
    ```
    youtube_id,status,created_at
    VIDEO_ID_1,pending,2025-10-28T10:00:00
    VIDEO_ID_2,completed,2025-10-27T15:30:00
    ```

    - Validates list exists (404 if not found)
    - Returns CSV file as downloadable attachment
    - Empty lists return CSV with header only

    Args:
        list_id: UUID of the bookmark list
        db: Database session

    Returns:
        StreamingResponse: CSV file download

    Raises:
        HTTPException 404: List not found
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    # Get all videos
    result = await db.execute(
        select(Video)
        .where(Video.list_id == list_id)
        .order_by(Video.created_at)
    )
    videos: Sequence[Video] = result.scalars().all()  # type: ignore[assignment]

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow(['youtube_id', 'status', 'created_at'])

    # Write video rows
    for video in videos:
        writer.writerow([
            video.youtube_id,
            video.processing_status,
            video.created_at.isoformat()
        ])

    # Create streaming response
    csv_content = output.getvalue()

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=videos_{list_id}.csv"
        }
    )
```

### Step 4: Run tests to verify they pass

```bash
cd backend
pytest tests/api/test_videos.py::test_export_videos_csv_success -v
pytest tests/api/test_videos.py::test_export_videos_csv_empty_list -v
pytest tests/api/test_videos.py::test_export_videos_csv_list_not_found -v
```

**Expected output:** All 3 tests PASS

### Step 5: Run all video tests to ensure no regressions

```bash
cd backend
pytest tests/api/test_videos.py -v
```

**Expected output:** All tests PASS (original tests + 7 new tests = 23 total)

### Step 6: Commit CSV export feature

```bash
cd backend
git add app/api/videos.py tests/api/test_videos.py
git commit -m "feat: add CSV video export endpoint

Implements GET /api/lists/{list_id}/export/csv endpoint:
- Exports all videos in list to CSV format
- Columns: youtube_id, status, created_at
- Returns as downloadable file attachment
- Handles empty lists (header only)
- Validates list exists (404 if not found)

Tests: 3 new tests covering success, empty list, 404

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Frontend CSV Upload Component

**Files:**
- Create: `frontend/src/components/CSVUpload.tsx`
- Modify: `frontend/src/hooks/useVideos.ts`

### Step 1: Add bulk upload mutation hook

**File:** `frontend/src/hooks/useVideos.ts`

Add this type definition after the existing schemas (around line 13):

```typescript
export interface BulkUploadFailure {
  row: number
  url: string
  error: string
}

export interface BulkUploadResponse {
  created_count: number
  failed_count: number
  failures: BulkUploadFailure[]
}
```

Add this hook at the end of the file:

```typescript
export const useBulkUploadVideos = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const { data } = await api.post<BulkUploadResponse>(
        `/lists/${listId}/videos/bulk`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      return data
    },
    onSuccess: () => {
      // Invalidate videos query to refetch
      queryClient.invalidateQueries({ queryKey: ['videos', listId] })
    },
  })
}
```

### Step 2: Create CSV upload component

**File:** `frontend/src/components/CSVUpload.tsx`

```typescript
import { useState } from 'react'
import { useBulkUploadVideos, type BulkUploadResponse } from '@/hooks/useVideos'

interface CSVUploadProps {
  listId: string
  onCancel: () => void
  onSuccess: () => void
}

export const CSVUpload = ({ listId, onCancel, onSuccess }: CSVUploadProps) => {
  const [file, setFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null)
  const bulkUpload = useBulkUploadVideos(listId)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.csv')) {
        alert('Bitte wählen Sie eine CSV-Datei aus')
        return
      }
      setFile(selectedFile)
      setUploadResult(null)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      alert('Bitte wählen Sie eine Datei aus')
      return
    }

    try {
      const result = await bulkUpload.mutateAsync(file)
      setUploadResult(result)

      // If all succeeded, close form
      if (result.failed_count === 0) {
        setTimeout(() => {
          onSuccess()
        }, 1500)
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        alert('Ungültige CSV-Datei. Bitte überprüfen Sie das Format.')
      } else {
        alert('Fehler beim Hochladen der Datei. Bitte versuchen Sie es erneut.')
      }
    }
  }

  return (
    <div className="mb-6 p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
      <h2 className="text-lg font-semibold mb-4">CSV-Datei hochladen</h2>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label
            htmlFor="csv-file"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            CSV-Datei auswählen
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Format: Eine Spalte "url" mit YouTube-URLs (eine pro Zeile)
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Beispiel: https://www.youtube.com/watch?v=VIDEO_ID
          </p>
        </div>

        {uploadResult && (
          <div className={`p-4 rounded-lg ${
            uploadResult.failed_count === 0
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <p className="font-semibold mb-2">
              {uploadResult.created_count} Video{uploadResult.created_count !== 1 ? 's' : ''} erfolgreich hinzugefügt
            </p>
            {uploadResult.failed_count > 0 && (
              <>
                <p className="text-sm text-yellow-800 mb-2">
                  {uploadResult.failed_count} Fehler:
                </p>
                <ul className="text-sm text-yellow-700 space-y-1 max-h-40 overflow-y-auto">
                  {uploadResult.failures.map((failure, idx) => (
                    <li key={idx}>
                      Zeile {failure.row}: {failure.error} ({failure.url})
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!file || bulkUpload.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            {bulkUpload.isPending ? 'Wird hochgeladen...' : 'Hochladen'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}
```

### Step 3: Commit CSV upload component

```bash
cd frontend
git add src/components/CSVUpload.tsx src/hooks/useVideos.ts
git commit -m "feat: add CSV upload component

- New CSVUpload component with file input and validation
- useBulkUploadVideos hook for bulk upload mutation
- Shows upload results with success/failure counts
- Displays detailed error messages for failed rows
- Auto-closes form on full success

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Frontend CSV Export Button

**Files:**
- Modify: `frontend/src/hooks/useVideos.ts`
- Modify: `frontend/src/components/VideosPage.tsx`

### Step 1: Add export function to useVideos hook

**File:** `frontend/src/hooks/useVideos.ts`

Add this function at the end of the file:

```typescript
export const exportVideosCSV = async (listId: string) => {
  const response = await api.get(`/lists/${listId}/export/csv`, {
    responseType: 'blob',
  })

  // Create download link
  const blob = new Blob([response.data], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `videos_${listId}.csv`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
```

### Step 2: Add upload and export buttons to VideosPage

**File:** `frontend/src/components/VideosPage.tsx`

Add CSVUpload import at the top:

```typescript
import { CSVUpload } from './CSVUpload'
import { exportVideosCSV } from '@/hooks/useVideos'
```

Add new state variable for CSV upload (after line 54):

```typescript
const [isUploadingCSV, setIsUploadingCSV] = useState(false)
```

Add export handler function (after line 58):

```typescript
const handleExportCSV = async () => {
  try {
    await exportVideosCSV(listId)
  } catch (error) {
    alert('Fehler beim Exportieren der Videos. Bitte versuchen Sie es erneut.')
  }
}
```

Replace the header section (lines 210-226) with this updated version:

```typescript
<div className="flex justify-between items-center mb-8">
  <div>
    <button
      onClick={onBack}
      className="text-blue-600 hover:text-blue-800 mb-2 text-sm"
    >
      ← Zurück zu Listen
    </button>
    <h1 className="text-3xl font-bold text-gray-900">Videos</h1>
  </div>
  <div className="flex gap-2">
    <button
      onClick={handleExportCSV}
      disabled={videos.length === 0}
      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
    >
      CSV Export
    </button>
    <button
      onClick={() => setIsUploadingCSV(true)}
      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
    >
      CSV Upload
    </button>
    <button
      onClick={() => setIsAdding(true)}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      Video hinzufügen
    </button>
  </div>
</div>
```

Add CSV upload form (after line 227, before the existing `isAdding` form):

```typescript
{isUploadingCSV && (
  <CSVUpload
    listId={listId}
    onCancel={() => setIsUploadingCSV(false)}
    onSuccess={() => setIsUploadingCSV(false)}
  />
)}
```

### Step 3: Verify TypeScript compiles

```bash
cd frontend
npx tsc --noEmit
```

**Expected output:** No errors

### Step 4: Commit CSV export and upload integration

```bash
cd frontend
git add src/hooks/useVideos.ts src/components/VideosPage.tsx
git commit -m "feat: integrate CSV upload and export in VideosPage

- Add CSV Export button (downloads videos.csv)
- Add CSV Upload button (opens CSVUpload component)
- exportVideosCSV helper creates blob download
- Export disabled when list is empty
- Clean UI with 3 action buttons (Export, Upload, Add)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Manual Browser Testing

**No automated tests for frontend - manual verification required**

### Step 1: Start development environment

```bash
# Terminal 1: Start Docker services
docker-compose up -d postgres redis

# Terminal 2: Run migrations and start backend
cd backend
alembic upgrade head
uvicorn app.main:app --reload

# Terminal 3: Start frontend
cd frontend
npm run dev
```

**Expected output:**
- Backend running on http://localhost:8000
- Frontend running on http://localhost:5173

### Step 2: Test CSV Upload in browser

1. Navigate to http://localhost:5173
2. Create a test list (e.g., "Test CSV List")
3. Click on the list to view videos
4. Click "CSV Upload" button
5. Create a test CSV file on your desktop:

```csv
url
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/jNQXAC9IVRw
https://www.youtube.com/watch?v=9bZkp7q19f0
```

6. Upload the CSV file
7. Verify:
   - Upload success message shows "3 Videos erfolgreich hinzugefügt"
   - Form auto-closes after 1.5 seconds
   - Videos appear in table

### Step 3: Test CSV Upload with errors

1. Create another CSV with invalid URLs:

```csv
url
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://invalid.com/video
https://youtu.be/jNQXAC9IVRw
```

2. Upload the CSV
3. Verify:
   - Shows "2 Videos erfolgreich hinzugefügt"
   - Shows "1 Fehler"
   - Error list displays the invalid URL with reason

### Step 4: Test CSV Export

1. Click "CSV Export" button
2. Verify:
   - CSV file downloads (videos_[UUID].csv)
   - Open CSV in text editor
   - Verify header: `youtube_id,status,created_at`
   - Verify all videos are listed with correct data

### Step 5: Verify export button disabled when empty

1. Create a new empty list
2. Navigate to its videos page
3. Verify: "CSV Export" button is disabled (gray)

### Step 6: Check browser console for errors

Open browser DevTools (F12) and check Console tab:
- Verify: No errors in console
- Verify: Network requests show 201 (bulk upload) and 200 (export)

---

## Verification Checklist

**Backend Tests:**
```bash
cd backend
pytest tests/api/test_videos.py -v
```

**Expected:** 23/23 tests passing (16 original + 7 new CSV tests)

**Frontend Build:**
```bash
cd frontend
npx tsc --noEmit
npm run build
```

**Expected:** No TypeScript errors, build succeeds

**Manual Browser Tests:**
- [ ] CSV upload with valid URLs works
- [ ] CSV upload with invalid URLs shows errors
- [ ] CSV export downloads file with correct data
- [ ] Export button disabled on empty list
- [ ] No console errors in browser DevTools

**API Endpoints:**
```bash
# Test bulk upload
curl -X POST http://localhost:8000/api/lists/[LIST_ID]/videos/bulk \
  -F "file=@videos.csv"

# Test export
curl http://localhost:8000/api/lists/[LIST_ID]/export/csv
```

---

## Success Criteria

- ✅ Backend bulk upload endpoint implemented with tests
- ✅ Backend CSV export endpoint implemented with tests
- ✅ All 23 backend tests passing
- ✅ Frontend CSVUpload component created
- ✅ Frontend export button integrated
- ✅ TypeScript compiles without errors
- ✅ Manual browser testing confirms upload/export work
- ✅ No console errors in browser
- ✅ Code review completed (3 tools)
- ✅ All issues fixed

---

## Estimated Time

- Task 1 (Bulk Upload): 20-25 minutes
- Task 2 (CSV Export): 15-20 minutes
- Task 3 (Upload Component): 15-20 minutes
- Task 4 (Export Integration): 10-15 minutes
- Task 5 (Manual Testing): 10-15 minutes
- **Total:** 70-95 minutes (1-1.5 hours)

---

**References:**
- Backend video API: `backend/app/api/videos.py`
- Video schemas: `backend/app/schemas/video.py`
- Video model: `backend/app/models/video.py`
- Frontend hooks: `frontend/src/hooks/useVideos.ts`
- Videos UI: `frontend/src/components/VideosPage.tsx`

**Related Skills:**
- @superpowers:test-driven-development - For backend TDD
- @superpowers:verification-before-completion - Before claiming complete
- @superpowers:requesting-code-review - After implementation
- @task-validator - Final validation
