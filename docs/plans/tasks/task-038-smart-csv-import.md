# Task #38: Implement Smart CSV Import with Field Detection

**Plan Task:** #38
**Wave/Phase:** Wave 3 - Advanced Features
**Dependencies:** Task #62 (VideoFieldValue model), Task #64 (CustomField schemas)

---

## 🎯 Ziel

Enhance the existing CSV bulk upload endpoint to automatically detect custom field columns, infer their types (rating, select, text, boolean), map to existing CustomField definitions or create new ones, and import field values into VideoFieldValue with proper validation and error reporting.

**Current State:** Basic CSV upload with only `url` column support (POST /api/lists/{list_id}/videos/bulk)

**Target State:** Smart CSV import that:
- Auto-detects column types from data patterns
- Maps columns to existing fields by name (case-insensitive)
- Creates new CustomField definitions for unmapped columns
- Bulk inserts VideoFieldValue records with typed columns
- Reports progress via WebSocket with row-level error details

---

## 📋 Acceptance Criteria

- [ ] CSV parser detects and validates YouTube URL column (required)
- [ ] Auto-detection identifies rating columns (numeric 1-10 range)
- [ ] Auto-detection identifies select columns (low cardinality text)
- [ ] Auto-detection identifies boolean columns (yes/no, true/false, 1/0)
- [ ] Auto-detection identifies text columns (free-form strings)
- [ ] Column mapping matches existing CustomField definitions (case-insensitive name match)
- [ ] New CustomField definitions created for unmapped columns with auto-detected config
- [ ] VideoFieldValue records bulk inserted with correct typed column (value_text, value_numeric, value_boolean)
- [ ] Row-level validation errors reported (invalid rating range, invalid select option, etc.)
- [ ] Progress updates published via WebSocket during processing
- [ ] Unit tests for type detection algorithm (100% coverage)
- [ ] Integration test for full CSV import flow with field values
- [ ] Code reviewed

---

## 🛠️ Implementation Steps

### 1. Create CSV Column Type Detection Module
**Files:** `backend/app/utils/csv_type_detector.py` (NEW)
**Action:** Implement algorithm to infer field types from CSV column data

```python
"""
CSV column type detection utilities.

Analyzes CSV column data to infer CustomField field_type and config.
"""
from typing import Literal, Dict, Any
from collections import Counter
import re

FieldType = Literal['select', 'rating', 'text', 'boolean']

class ColumnTypeDetector:
    """
    Analyzes CSV column values to infer CustomField type and configuration.
    
    Detection Algorithm:
    1. Boolean: All values match yes/no/true/false/1/0 (case-insensitive)
    2. Rating: All numeric integers within 1-10 range
    3. Select: Low cardinality text (≤10 unique values, ≥2 occurrences each)
    4. Text: Everything else (high cardinality or free-form strings)
    
    Examples:
        >>> detector = ColumnTypeDetector()
        >>> detector.infer_type(['4', '5', '3', '5', '4'])
        ('rating', {'max_rating': 5})
        
        >>> detector.infer_type(['great', 'good', 'great', 'bad'])
        ('select', {'options': ['bad', 'good', 'great']})
    """
    
    # Boolean detection patterns (case-insensitive)
    BOOLEAN_TRUE = {'yes', 'y', 'true', 't', '1'}
    BOOLEAN_FALSE = {'no', 'n', 'false', 'f', '0'}
    BOOLEAN_ALL = BOOLEAN_TRUE | BOOLEAN_FALSE
    
    # Rating detection thresholds
    RATING_MIN = 1
    RATING_MAX = 10
    
    # Select detection thresholds
    SELECT_MAX_CARDINALITY = 10  # Max unique values for select type
    SELECT_MIN_FREQUENCY = 2     # Min occurrences per option
    
    def infer_type(
        self, 
        values: list[str], 
        column_name: str = ""
    ) -> tuple[FieldType, Dict[str, Any]]:
        """
        Infer field type and config from column values.
        
        Args:
            values: Non-empty list of string values from CSV column
            column_name: Optional column name for hint-based detection
        
        Returns:
            (field_type, config) tuple
        
        Raises:
            ValueError: If values list is empty
        """
        if not values:
            raise ValueError("Cannot infer type from empty values list")
        
        # Filter out empty/null values for analysis
        non_empty = [v.strip() for v in values if v and v.strip()]
        
        if not non_empty:
            # All values empty → default to text
            return ('text', {})
        
        # 1. Check boolean (highest priority - strict match)
        if self._is_boolean(non_empty):
            return ('boolean', {})
        
        # 2. Check rating (numeric 1-10 range)
        if self._is_rating(non_empty):
            max_rating = max(int(v) for v in non_empty)
            return ('rating', {'max_rating': max_rating})
        
        # 3. Check select (low cardinality)
        if self._is_select(non_empty):
            unique_values = sorted(set(non_empty))
            return ('select', {'options': unique_values})
        
        # 4. Default to text
        return ('text', {})
    
    def _is_boolean(self, values: list[str]) -> bool:
        """Check if all values match boolean patterns."""
        return all(v.lower() in self.BOOLEAN_ALL for v in values)
    
    def _is_rating(self, values: list[str]) -> bool:
        """Check if all values are integers in rating range (1-10)."""
        try:
            nums = [int(v) for v in values]
            return all(self.RATING_MIN <= n <= self.RATING_MAX for n in nums)
        except (ValueError, TypeError):
            return False
    
    def _is_select(self, values: list[str]) -> bool:
        """
        Check if values represent select field (low cardinality).
        
        Criteria:
        - ≤10 unique values (SELECT_MAX_CARDINALITY)
        - Each option appears ≥2 times (SELECT_MIN_FREQUENCY)
        """
        value_counts = Counter(values)
        unique_count = len(value_counts)
        
        # Too many unique values → not a select field
        if unique_count > self.SELECT_MAX_CARDINALITY:
            return False
        
        # Check minimum frequency (avoid "every row is unique" case)
        # Exception: if total rows < 10, allow single occurrence
        if len(values) >= 10:
            return all(count >= self.SELECT_MIN_FREQUENCY for count in value_counts.values())
        
        return True


def detect_csv_field_types(
    df_columns: dict[str, list[str]]
) -> dict[str, tuple[FieldType, Dict[str, Any]]]:
    """
    Detect field types for all columns in a CSV DataFrame.
    
    Args:
        df_columns: Dict mapping column name to list of values
    
    Returns:
        Dict mapping column name to (field_type, config) tuple
    
    Example:
        >>> columns = {
        ...     'Rating': ['4', '5', '3'],
        ...     'Quality': ['great', 'good', 'great']
        ... }
        >>> detect_csv_field_types(columns)
        {
            'Rating': ('rating', {'max_rating': 5}),
            'Quality': ('select', {'options': ['good', 'great']})
        }
    """
    detector = ColumnTypeDetector()
    return {
        col_name: detector.infer_type(values, col_name)
        for col_name, values in df_columns.items()
    }
```

**Testing:** Unit tests in `backend/tests/utils/test_csv_type_detector.py`

---

### 2. Create CSV Field Value Parser
**Files:** `backend/app/utils/csv_field_parser.py` (NEW)
**Action:** Parse and validate CSV field values according to field type

```python
"""
CSV field value parsing and validation utilities.
"""
from typing import Any, Literal
from app.models.custom_field import CustomField

FieldType = Literal['select', 'rating', 'text', 'boolean']

class FieldValueParser:
    """
    Parse and validate CSV string values for CustomField types.
    
    Handles type conversion and validation for all field types:
    - rating: Parse to float, validate range
    - select: Validate against options list
    - boolean: Parse yes/no/true/false/1/0 to bool
    - text: Validate max_length if configured
    """
    
    # Boolean parsing map (case-insensitive)
    BOOLEAN_MAP = {
        'yes': True, 'y': True, 'true': True, 't': True, '1': True,
        'no': False, 'n': False, 'false': False, 'f': False, '0': False,
    }
    
    def parse_value(
        self,
        raw_value: str,
        field: CustomField
    ) -> tuple[bool, Any, str | None]:
        """
        Parse and validate CSV value for a CustomField.
        
        Args:
            raw_value: Raw string value from CSV
            field: CustomField definition with type and config
        
        Returns:
            (is_valid, parsed_value, error_message) tuple
            - is_valid: True if validation passed
            - parsed_value: Converted value (float for rating, bool for boolean, str otherwise)
            - error_message: Error description if is_valid=False, None otherwise
        
        Examples:
            >>> field = CustomField(field_type='rating', config={'max_rating': 5})
            >>> parser.parse_value('4', field)
            (True, 4.0, None)
            
            >>> parser.parse_value('10', field)
            (False, None, "Rating must be between 1-5")
        """
        value = raw_value.strip() if raw_value else ""
        
        # Empty values are valid (optional fields)
        if not value:
            return (True, None, None)
        
        if field.field_type == 'rating':
            return self._parse_rating(value, field.config)
        elif field.field_type == 'select':
            return self._parse_select(value, field.config)
        elif field.field_type == 'boolean':
            return self._parse_boolean(value)
        elif field.field_type == 'text':
            return self._parse_text(value, field.config)
        else:
            return (False, None, f"Unknown field type: {field.field_type}")
    
    def _parse_rating(
        self, 
        value: str, 
        config: dict
    ) -> tuple[bool, float | None, str | None]:
        """Parse rating value (1-max_rating)."""
        try:
            num = float(value)
            max_rating = config.get('max_rating', 5)
            
            if num < 1 or num > max_rating:
                return (False, None, f"Rating must be between 1-{max_rating}")
            
            return (True, num, None)
        except (ValueError, TypeError):
            return (False, None, f"Invalid number: {value}")
    
    def _parse_select(
        self, 
        value: str, 
        config: dict
    ) -> tuple[bool, str | None, str | None]:
        """Parse select value (must be in options list)."""
        options = config.get('options', [])
        
        # Case-insensitive match
        value_lower = value.lower()
        for option in options:
            if option.lower() == value_lower:
                return (True, option, None)  # Return original case from config
        
        return (False, None, f"Value must be one of: {', '.join(options)}")
    
    def _parse_boolean(
        self, 
        value: str
    ) -> tuple[bool, bool | None, str | None]:
        """Parse boolean value (yes/no, true/false, 1/0)."""
        bool_val = self.BOOLEAN_MAP.get(value.lower())
        
        if bool_val is None:
            valid_values = ', '.join(sorted(self.BOOLEAN_MAP.keys()))
            return (False, None, f"Boolean must be one of: {valid_values}")
        
        return (True, bool_val, None)
    
    def _parse_text(
        self, 
        value: str, 
        config: dict
    ) -> tuple[bool, str | None, str | None]:
        """Parse text value (validate max_length if configured)."""
        max_length = config.get('max_length')
        
        if max_length and len(value) > max_length:
            return (False, None, f"Text exceeds max length ({max_length} characters)")
        
        return (True, value, None)
```

---

### 3. Extend Bulk Upload Endpoint with Field Detection
**Files:** `backend/app/api/videos.py`
**Action:** Modify `bulk_upload_videos()` endpoint to detect and process custom fields

**Changes:**
1. Parse CSV with pandas (replace csv.DictReader)
2. Detect column types using `ColumnTypeDetector`
3. Map columns to existing CustomField or create new ones
4. Parse field values and store in VideoFieldValue
5. Report errors per row with field-specific details

```python
# At top of file, add pandas import
import pandas as pd
from app.utils.csv_type_detector import detect_csv_field_types, ColumnTypeDetector
from app.utils.csv_field_parser import FieldValueParser
from app.models.custom_field import CustomField
from app.models.video_field_value import VideoFieldValue

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
    Bulk upload videos from CSV file with smart field detection.
    
    CSV format (auto-detected custom fields):
    ```
    url,Rating,Presentation Quality,Recommended
    https://www.youtube.com/watch?v=VIDEO_ID_1,5,great,yes
    https://youtu.be/VIDEO_ID_2,4,good,no
    ```
    
    Field Detection:
    - Required: 'url' column (YouTube URLs)
    - Optional: Any additional columns → auto-detected as custom fields
    - Type inference: rating (1-10), select (low cardinality), boolean (yes/no), text
    
    Field Mapping:
    - Matches existing CustomField by name (case-insensitive)
    - Creates new CustomField if no match found
    - Validates field values per type (range, options, etc.)
    
    Returns:
        BulkUploadResponse with created_count, failed_count, and per-row failures
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
    
    # Read CSV with pandas for better type detection
    try:
        content = await file.read()
        csv_string = content.decode('utf-8')
        
        # Parse CSV with pandas (reads all as strings initially)
        df = pd.read_csv(
            io.StringIO(csv_string),
            dtype=str,  # Read all as strings for type detection
            keep_default_na=False,  # Don't convert to NaN
            skip_blank_lines=True,
            on_bad_lines='skip'  # Skip malformed rows (pandas 1.4+)
        )
        
        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CSV file is empty"
            )
        
        # Validate required 'url' column exists
        if 'url' not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CSV must have 'url' column"
            )
        
        # Separate URL column from field columns
        field_columns = [col for col in df.columns if col.lower() != 'url']
        
        # Step 1: Detect field types for all non-URL columns
        field_type_map = {}  # col_name -> (field_type, config)
        if field_columns:
            df_columns = {col: df[col].tolist() for col in field_columns}
            field_type_map = detect_csv_field_types(df_columns)
            logger.info(f"Detected field types: {field_type_map}")
        
        # Step 2: Map columns to existing CustomField or create new ones
        field_map = {}  # col_name -> CustomField
        for col_name, (field_type, config) in field_type_map.items():
            # Try to find existing field (case-insensitive)
            existing_field = await db.execute(
                select(CustomField).where(
                    CustomField.list_id == list_id,
                    func.lower(CustomField.name) == col_name.lower()
                )
            )
            field = existing_field.scalar_one_or_none()
            
            if field:
                # Use existing field (validate type matches?)
                # Design decision: Accept existing field even if type differs
                # Alternative: Raise error if types don't match
                logger.info(f"Column '{col_name}' mapped to existing field '{field.name}'")
                field_map[col_name] = field
            else:
                # Create new CustomField
                new_field = CustomField(
                    list_id=list_id,
                    name=col_name.strip(),
                    field_type=field_type,
                    config=config
                )
                db.add(new_field)
                await db.flush()  # Get field.id
                await db.refresh(new_field)
                field_map[col_name] = new_field
                logger.info(f"Created new field '{new_field.name}' (type={field_type})")
        
        await db.commit()  # Commit field creations before video processing
        
        # Step 3: Process videos with field values
        videos_to_create = []
        field_values_to_create = []
        failures = []
        parser = FieldValueParser()
        
        for idx, row in df.iterrows():
            row_num = idx + 2  # +2 for header row and 0-based index
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
            except ValueError as e:
                failures.append(BulkUploadFailure(
                    row=row_num,
                    url=url,
                    error=str(e)
                ))
                continue
            
            # Check for duplicates in batch
            if any(v["youtube_id"] == youtube_id for v in videos_to_create):
                failures.append(BulkUploadFailure(
                    row=row_num,
                    url=url,
                    error="Duplicate video in CSV"
                ))
                continue
            
            # Parse and validate field values
            row_field_values = []
            field_errors = []
            
            for col_name, field in field_map.items():
                raw_value = row.get(col_name, '')
                is_valid, parsed_value, error_msg = parser.parse_value(raw_value, field)
                
                if not is_valid:
                    field_errors.append(f"{col_name}: {error_msg}")
                elif parsed_value is not None:
                    # Store for later insertion (after video created)
                    row_field_values.append({
                        'field_id': field.id,
                        'field_type': field.field_type,
                        'value': parsed_value
                    })
            
            # If field validation failed, skip row
            if field_errors:
                failures.append(BulkUploadFailure(
                    row=row_num,
                    url=url,
                    error=f"Field validation errors: {'; '.join(field_errors)}"
                ))
                continue
            
            # Create video object
            video = Video(
                list_id=list_id,
                youtube_id=youtube_id,
                processing_status="pending"
            )
            videos_to_create.append({
                "video": video,
                "field_values": row_field_values
            })
        
        # Step 4: Bulk insert videos
        if videos_to_create:
            video_objects = [v["video"] for v in videos_to_create]
            db.add_all(video_objects)
            
            try:
                await db.commit()
                
                # Refresh to get video IDs
                for v in video_objects:
                    await db.refresh(v)
                
            except IntegrityError:
                # Handle duplicates (existing videos in DB)
                await db.rollback()
                created = 0
                successful_videos = []
                
                for video_data in videos_to_create:
                    video = video_data["video"]
                    try:
                        db.add(video)
                        await db.flush()
                        await db.refresh(video)
                        successful_videos.append(video_data)
                        created += 1
                    except IntegrityError:
                        await db.rollback()
                        failures.append(BulkUploadFailure(
                            row=0,
                            url=f"https://www.youtube.com/watch?v={video.youtube_id}",
                            error="Video already exists in this list"
                        ))
                
                await db.commit()
                videos_to_create = successful_videos
        
        # Step 5: Bulk insert VideoFieldValue records
        if videos_to_create and field_map:
            value_objects = []
            
            for video_data in videos_to_create:
                video = video_data["video"]
                for field_value_data in video_data["field_values"]:
                    field_id = field_value_data['field_id']
                    field_type = field_value_data['field_type']
                    value = field_value_data['value']
                    
                    # Create VideoFieldValue with appropriate typed column
                    vfv = VideoFieldValue(
                        video_id=video.id,
                        field_id=field_id
                    )
                    
                    # Set typed column based on field type
                    if field_type == 'rating':
                        vfv.value_numeric = value
                    elif field_type in ('select', 'text'):
                        vfv.value_text = value
                    elif field_type == 'boolean':
                        vfv.value_boolean = value
                    
                    value_objects.append(vfv)
            
            if value_objects:
                db.add_all(value_objects)
                await db.commit()
                logger.info(f"Inserted {len(value_objects)} field values")
        
        # Step 6: Enqueue ARQ processing job
        await _enqueue_video_processing(db, list_id, len(videos_to_create))
        
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
    except pd.errors.ParserError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid CSV format: {str(e)}"
        )
```

**Note:** This replaces the existing `bulk_upload_videos()` function entirely.

---

### 4. Add pandas Dependency
**Files:** `backend/requirements.txt`
**Action:** Add pandas for robust CSV parsing

```
pandas>=2.0.0,<3.0.0
```

**Run:** `pip install pandas` in backend virtual environment

---

### 5. Update BulkUploadFailure Schema for Field Errors
**Files:** `backend/app/schemas/video.py`
**Action:** Extend error reporting to include field-specific details (optional enhancement)

**Current schema is sufficient** - field errors are concatenated in the `error` string.

**Optional future enhancement:**
```python
class BulkUploadFailure(BaseModel):
    """Details about a failed video upload in bulk operation."""
    row: int
    url: str
    error: str
    field_errors: dict[str, str] | None = None  # NEW: field_name -> error_message
```

---

### 6. Unit Tests for Type Detection
**Files:** `backend/tests/utils/test_csv_type_detector.py` (NEW)
**Action:** Comprehensive tests for ColumnTypeDetector

```python
"""
Unit tests for CSV type detection.
"""
import pytest
from app.utils.csv_type_detector import ColumnTypeDetector, detect_csv_field_types


class TestColumnTypeDetector:
    """Test ColumnTypeDetector.infer_type()"""
    
    def test_detect_boolean_yes_no(self):
        """Detect boolean from yes/no values"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type(['yes', 'no', 'yes', 'no'])
        assert field_type == 'boolean'
        assert config == {}
    
    def test_detect_boolean_true_false(self):
        """Detect boolean from true/false values"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type(['true', 'False', 'TRUE', 'false'])
        assert field_type == 'boolean'
    
    def test_detect_boolean_numeric(self):
        """Detect boolean from 1/0 values"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type(['1', '0', '1', '0'])
        assert field_type == 'boolean'
    
    def test_detect_rating_1_to_5(self):
        """Detect rating from 1-5 scale"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type(['1', '3', '5', '4', '2'])
        assert field_type == 'rating'
        assert config == {'max_rating': 5}
    
    def test_detect_rating_1_to_10(self):
        """Detect rating from 1-10 scale"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type(['7', '10', '8', '9'])
        assert field_type == 'rating'
        assert config == {'max_rating': 10}
    
    def test_rating_out_of_range_becomes_text(self):
        """Values outside 1-10 range → text"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type(['0', '11', '15'])
        assert field_type == 'text'
    
    def test_detect_select_low_cardinality(self):
        """Detect select from low cardinality text"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type(['great', 'good', 'bad', 'great', 'good', 'great'])
        assert field_type == 'select'
        assert config == {'options': ['bad', 'good', 'great']}
    
    def test_select_max_10_unique_values(self):
        """Select allows up to 10 unique values"""
        detector = ColumnTypeDetector()
        values = [str(i % 10) for i in range(20)]  # 10 unique values, repeated
        field_type, config = detector.infer_type(values)
        assert field_type == 'select'
        assert len(config['options']) == 10
    
    def test_high_cardinality_becomes_text(self):
        """More than 10 unique values → text"""
        detector = ColumnTypeDetector()
        values = [f"value_{i}" for i in range(15)]
        field_type, config = detector.infer_type(values)
        assert field_type == 'text'
    
    def test_detect_text_free_form(self):
        """Detect text from free-form strings"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type([
            'This is a long description',
            'Another unique text value',
            'Each row has different content'
        ])
        assert field_type == 'text'
    
    def test_empty_values_default_to_text(self):
        """All empty values → text"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type(['', ' ', '', ''])
        assert field_type == 'text'
    
    def test_empty_list_raises_error(self):
        """Empty values list raises ValueError"""
        detector = ColumnTypeDetector()
        with pytest.raises(ValueError, match="Cannot infer type from empty"):
            detector.infer_type([])
    
    def test_mixed_empty_and_numeric_detects_rating(self):
        """Empty values ignored, numeric values detected as rating"""
        detector = ColumnTypeDetector()
        field_type, config = detector.infer_type(['4', '', '5', '3', ''])
        assert field_type == 'rating'


class TestDetectCSVFieldTypes:
    """Test detect_csv_field_types() helper function"""
    
    def test_detect_multiple_columns(self):
        """Detect types for multiple columns at once"""
        columns = {
            'Rating': ['4', '5', '3', '5'],
            'Quality': ['great', 'good', 'great', 'bad'],
            'Recommended': ['yes', 'no', 'yes', 'yes']
        }
        result = detect_csv_field_types(columns)
        
        assert result['Rating'] == ('rating', {'max_rating': 5})
        assert result['Quality'] == ('select', {'options': ['bad', 'good', 'great']})
        assert result['Recommended'] == ('boolean', {})
```

---

### 7. Unit Tests for Field Value Parser
**Files:** `backend/tests/utils/test_csv_field_parser.py` (NEW)
**Action:** Test validation logic for all field types

```python
"""
Unit tests for CSV field value parsing and validation.
"""
import pytest
from app.utils.csv_field_parser import FieldValueParser
from app.models.custom_field import CustomField


class TestFieldValueParser:
    """Test FieldValueParser.parse_value()"""
    
    def test_parse_rating_valid(self):
        """Valid rating value parses correctly"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        
        is_valid, value, error = parser.parse_value("4", field)
        assert is_valid is True
        assert value == 4.0
        assert error is None
    
    def test_parse_rating_out_of_range(self):
        """Rating above max_rating fails validation"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        
        is_valid, value, error = parser.parse_value("10", field)
        assert is_valid is False
        assert value is None
        assert "between 1-5" in error
    
    def test_parse_rating_invalid_number(self):
        """Non-numeric rating value fails"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        
        is_valid, value, error = parser.parse_value("abc", field)
        assert is_valid is False
        assert "Invalid number" in error
    
    def test_parse_select_valid_option(self):
        """Valid select option parses correctly"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Quality",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        
        is_valid, value, error = parser.parse_value("good", field)
        assert is_valid is True
        assert value == "good"
    
    def test_parse_select_case_insensitive(self):
        """Select matching is case-insensitive"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Quality",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        
        is_valid, value, error = parser.parse_value("GOOD", field)
        assert is_valid is True
        assert value == "good"  # Returns original case from config
    
    def test_parse_select_invalid_option(self):
        """Invalid select option fails validation"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Quality",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        
        is_valid, value, error = parser.parse_value("amazing", field)
        assert is_valid is False
        assert "must be one of" in error
    
    def test_parse_boolean_yes(self):
        """Boolean 'yes' parses to True"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Recommended",
            field_type="boolean",
            config={}
        )
        
        is_valid, value, error = parser.parse_value("yes", field)
        assert is_valid is True
        assert value is True
    
    def test_parse_boolean_case_insensitive(self):
        """Boolean parsing is case-insensitive"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Recommended",
            field_type="boolean",
            config={}
        )
        
        is_valid, value, error = parser.parse_value("TRUE", field)
        assert is_valid is True
        assert value is True
    
    def test_parse_text_valid(self):
        """Text value parses correctly"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Notes",
            field_type="text",
            config={}
        )
        
        is_valid, value, error = parser.parse_value("Some text", field)
        assert is_valid is True
        assert value == "Some text"
    
    def test_parse_text_max_length(self):
        """Text exceeding max_length fails"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Notes",
            field_type="text",
            config={"max_length": 10}
        )
        
        is_valid, value, error = parser.parse_value("This is too long", field)
        assert is_valid is False
        assert "exceeds max length" in error
    
    def test_parse_empty_value_is_valid(self):
        """Empty values are valid (optional fields)"""
        parser = FieldValueParser()
        field = CustomField(
            list_id="uuid",
            name="Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        
        is_valid, value, error = parser.parse_value("", field)
        assert is_valid is True
        assert value is None
```

---

### 8. Integration Test for Full CSV Import Flow
**Files:** `backend/tests/integration/test_csv_field_import.py` (NEW)
**Action:** End-to-end test with CSV containing custom fields

```python
"""
Integration test for smart CSV import with field detection.
"""
import io
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.list import BookmarkList
from app.models.video import Video
from app.models.custom_field import CustomField
from app.models.video_field_value import VideoFieldValue


@pytest.mark.asyncio
async def test_csv_import_with_custom_fields(
    client: AsyncClient,
    db: AsyncSession
):
    """
    Test full CSV import flow with custom field detection and value insertion.
    
    Scenario:
    1. Upload CSV with url, Rating, Quality, Recommended columns
    2. Verify auto-detection creates 3 CustomField definitions
    3. Verify 2 videos created with field values
    4. Verify VideoFieldValue records use correct typed columns
    """
    # Create test list
    test_list = BookmarkList(name="Test List", user_id="test-user")
    db.add(test_list)
    await db.commit()
    await db.refresh(test_list)
    
    # Prepare CSV content
    csv_content = """url,Rating,Quality,Recommended
https://www.youtube.com/watch?v=VIDEO_1,5,great,yes
https://www.youtube.com/watch?v=VIDEO_2,3,good,no
"""
    
    # Upload CSV
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/bulk",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["created_count"] == 2
    assert data["failed_count"] == 0
    
    # Verify CustomField definitions created
    fields = await db.execute(
        select(CustomField).where(CustomField.list_id == test_list.id)
    )
    fields_list = list(fields.scalars().all())
    assert len(fields_list) == 3
    
    # Check field types
    field_by_name = {f.name: f for f in fields_list}
    assert field_by_name["Rating"].field_type == "rating"
    assert field_by_name["Rating"].config == {"max_rating": 5}
    assert field_by_name["Quality"].field_type == "select"
    assert field_by_name["Quality"].config == {"options": ["good", "great"]}
    assert field_by_name["Recommended"].field_type == "boolean"
    
    # Verify videos created
    videos = await db.execute(
        select(Video).where(Video.list_id == test_list.id)
    )
    videos_list = list(videos.scalars().all())
    assert len(videos_list) == 2
    
    # Verify VideoFieldValue records
    video1 = next(v for v in videos_list if v.youtube_id == "VIDEO_1")
    video2 = next(v for v in videos_list if v.youtube_id == "VIDEO_2")
    
    # Video 1 field values
    v1_values = await db.execute(
        select(VideoFieldValue).where(VideoFieldValue.video_id == video1.id)
    )
    v1_values_list = list(v1_values.scalars().all())
    assert len(v1_values_list) == 3
    
    # Check typed columns are used correctly
    rating_value = next(
        v for v in v1_values_list 
        if v.field_id == field_by_name["Rating"].id
    )
    assert rating_value.value_numeric == 5.0
    assert rating_value.value_text is None
    assert rating_value.value_boolean is None
    
    quality_value = next(
        v for v in v1_values_list 
        if v.field_id == field_by_name["Quality"].id
    )
    assert quality_value.value_text == "great"
    assert quality_value.value_numeric is None
    
    recommended_value = next(
        v for v in v1_values_list 
        if v.field_id == field_by_name["Recommended"].id
    )
    assert recommended_value.value_boolean is True
    assert recommended_value.value_text is None


@pytest.mark.asyncio
async def test_csv_import_maps_to_existing_fields(
    client: AsyncClient,
    db: AsyncSession
):
    """
    Test CSV import reuses existing CustomField definitions.
    
    Scenario:
    1. Create CustomField "Rating" manually
    2. Upload CSV with "rating" column (different case)
    3. Verify no duplicate field created
    4. Verify values mapped to existing field
    """
    # Create test list
    test_list = BookmarkList(name="Test List", user_id="test-user")
    db.add(test_list)
    await db.commit()
    await db.refresh(test_list)
    
    # Create existing field
    existing_field = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    db.add(existing_field)
    await db.commit()
    await db.refresh(existing_field)
    
    # Upload CSV with different case
    csv_content = """url,rating
https://www.youtube.com/watch?v=VIDEO_1,4
"""
    
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/bulk",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )
    
    assert response.status_code == 201
    
    # Verify no duplicate field created
    fields = await db.execute(
        select(CustomField).where(CustomField.list_id == test_list.id)
    )
    fields_list = list(fields.scalars().all())
    assert len(fields_list) == 1
    assert fields_list[0].id == existing_field.id
    
    # Verify value mapped to existing field
    video = await db.execute(
        select(Video).where(Video.list_id == test_list.id)
    )
    video = video.scalar_one()
    
    values = await db.execute(
        select(VideoFieldValue).where(VideoFieldValue.video_id == video.id)
    )
    values_list = list(values.scalars().all())
    assert len(values_list) == 1
    assert values_list[0].field_id == existing_field.id
    assert values_list[0].value_numeric == 4.0


@pytest.mark.asyncio
async def test_csv_import_validation_errors(
    client: AsyncClient,
    db: AsyncSession
):
    """
    Test CSV import reports validation errors per row.
    
    Scenario:
    1. Upload CSV with invalid field values
    2. Verify failed rows reported with error details
    3. Verify valid rows still processed
    """
    # Create test list
    test_list = BookmarkList(name="Test List", user_id="test-user")
    db.add(test_list)
    await db.commit()
    await db.refresh(test_list)
    
    # CSV with validation errors
    csv_content = """url,Rating,Quality
https://www.youtube.com/watch?v=VIDEO_1,15,great
https://www.youtube.com/watch?v=VIDEO_2,3,amazing
https://www.youtube.com/watch?v=VIDEO_3,4,good
"""
    
    response = await client.post(
        f"/api/lists/{test_list.id}/videos/bulk",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["created_count"] == 1  # Only VIDEO_3 valid
    assert data["failed_count"] == 2
    
    # Check error messages
    failures = data["failures"]
    assert len(failures) == 2
    
    # VIDEO_1: Rating out of range
    video1_error = next(f for f in failures if "VIDEO_1" in f["url"])
    assert "Rating must be between 1-10" in video1_error["error"]
    
    # VIDEO_2: Invalid select option
    video2_error = next(f for f in failures if "VIDEO_2" in f["url"])
    assert "must be one of" in video2_error["error"]
```

---

### 9. Update Documentation
**Files:** `CLAUDE.md`
**Action:** Document smart CSV import feature

Add section under "Common Gotchas":

```markdown
## CSV Upload with Custom Fields

The bulk CSV upload endpoint (`POST /api/lists/{id}/videos/bulk`) supports automatic custom field detection:

**Required Column:**
- `url` - YouTube video URLs

**Optional Columns:**
- Any additional columns are auto-detected as custom fields
- Column names map to CustomField.name (case-insensitive)
- Field types inferred from data patterns:
  - Rating: Numeric values 1-10
  - Select: Low cardinality text (≤10 unique values)
  - Boolean: yes/no, true/false, 1/0
  - Text: Everything else

**Example CSV:**
```csv
url,Rating,Quality,Recommended
https://youtube.com/watch?v=VIDEO1,5,great,yes
https://youtube.com/watch?v=VIDEO2,3,good,no
```

**Behavior:**
1. Type detection runs on all non-URL columns
2. Existing CustomField definitions reused (by name, case-insensitive)
3. New CustomField definitions created for unmapped columns
4. VideoFieldValue records inserted with typed columns
5. Row-level validation errors reported in response

**Dependencies:**
- pandas>=2.0.0 (CSV parsing)
- Custom Fields System (Tasks #59-#62)
```

---

## 🧪 Testing Strategy

### Unit Tests

**CSV Type Detector (`test_csv_type_detector.py`):**
- ✅ Boolean detection: yes/no, true/false, 1/0
- ✅ Rating detection: 1-10 numeric range
- ✅ Select detection: low cardinality (≤10 unique values)
- ✅ Text detection: high cardinality or free-form
- ✅ Edge cases: empty values, mixed data, boundary conditions
- ✅ Error handling: empty list raises ValueError

**Field Value Parser (`test_csv_field_parser.py`):**
- ✅ Rating: valid range, out of range, invalid number
- ✅ Select: valid option, invalid option, case-insensitive matching
- ✅ Boolean: yes/no/true/false/1/0, case-insensitive
- ✅ Text: valid text, max_length validation
- ✅ Empty values: all field types accept empty (optional fields)

**Coverage Target:** 100% for both utils modules

### Integration Tests

**Full CSV Import Flow (`test_csv_field_import.py`):**
- ✅ End-to-end: Upload CSV → detect types → create fields → insert values
- ✅ Field mapping: Reuse existing CustomField by name (case-insensitive)
- ✅ Validation errors: Row-level error reporting with field details
- ✅ Typed columns: Verify value_numeric/value_text/value_boolean used correctly
- ✅ Batch processing: Multiple rows with different field values

**Coverage Target:** Happy path + 2-3 error scenarios

### Manual Testing

**Test Cases:**
1. **Basic CSV with all field types**
   - Upload CSV with rating, select, boolean, text columns
   - Verify field detection in logs
   - Check database: CustomField records created
   - Check database: VideoFieldValue records use correct typed columns
   - Expected: All fields detected correctly, no errors

2. **CSV maps to existing fields**
   - Create CustomField "Rating" manually
   - Upload CSV with "rating" column (different case)
   - Expected: No duplicate field created, values mapped to existing field

3. **CSV with validation errors**
   - Upload CSV with out-of-range rating (15), invalid select option
   - Expected: Response shows failed rows with error details, valid rows processed

4. **Large CSV (100 rows)**
   - Upload CSV with 100 rows, 5 custom fields each
   - Monitor WebSocket progress updates
   - Expected: Bulk insert performance <2s, progress updates received

5. **Empty field values**
   - Upload CSV with some empty field values
   - Expected: Empty values stored as NULL, no validation errors

---

## 📚 Reference

### Related Docs
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Custom Fields architecture
- `backend/app/api/videos.py` - Current bulk upload endpoint (lines 480-657)
- `backend/app/models/video_field_value.py` - VideoFieldValue model with typed columns

### Related Code
- Similar validation: `backend/app/schemas/custom_field.py` - Field type validation
- Bulk insert pattern: `backend/app/api/videos.py:605-610` - Current bulk video insert
- Progress publishing: `backend/app/workers/video_processor.py:210-244` - WebSocket progress

### Design Decisions

**Why pandas over csv.DictReader?**
- Better type inference capabilities
- Handles malformed rows gracefully (`on_bad_lines='skip'`)
- Consistent string handling with `dtype=str`
- Industry standard for CSV processing

**Why auto-create CustomField definitions?**
- Reduces friction for users (no manual field setup required)
- Enables "import and rate" workflow (upload CSV → fields auto-detected)
- Alternative (reject unknown columns) would require pre-configuration

**Why case-insensitive field name matching?**
- User-friendly: "rating" column matches "Rating" field
- Prevents duplicate fields from case variations
- Consistent with duplicate check endpoint behavior

**Why continue processing after field validation errors?**
- Fail-fast per row, but continue batch
- User gets maximum useful data + error report
- Alternative (abort entire batch) loses valid rows

**Batch Size Considerations:**
- SQLAlchemy 2.0 bulk insert uses [insertmanyvalues](https://docs.sqlalchemy.org/en/20/core/connections.html#engine-insertmanyvalues) for optimal batching
- Postgres default: 1000 rows per batch (configurable)
- No manual batching needed - SQLAlchemy handles it

**Type Detection Thresholds:**
- Rating: 1-10 range chosen to cover common scales (1-5, 1-10)
- Select: ≤10 unique values balances usability vs. performance
- Select frequency: ≥2 occurrences avoids "every row unique" misdetection
- Boolean: Strict match (no fuzzy parsing) prevents false positives

**Performance Optimization:**
- Bulk insert VideoFieldValue records (not one-by-one)
- Commit CustomField creations before video processing (avoid foreign key errors)
- Use pandas `keep_default_na=False` to preserve empty strings

**Error Reporting Strategy:**
- Row-level errors with field-specific details
- Continue processing valid rows (partial success)
- Concatenate field errors into single string (current BulkUploadFailure schema)
- Future enhancement: Structured field_errors dict

---

## ⏱️ Implementation Time Estimate

**Total: 6-8 hours**

- Step 1 (Type Detector): 2 hours
- Step 2 (Field Parser): 1.5 hours
- Step 3 (Endpoint Integration): 2 hours
- Steps 4-5 (Dependencies & Schema): 0.5 hours
- Step 6 (Unit Tests - Type Detector): 1.5 hours
- Step 7 (Unit Tests - Parser): 1 hour
- Step 8 (Integration Tests): 1.5 hours
- Step 9 (Documentation): 0.5 hours

**Assumptions:**
- Custom Fields System (Tasks #59-#62) completed
- Database migration already applied
- ARQ worker already configured

**Risk Factors:**
- pandas CSV parsing edge cases (encoding, malformed rows)
- Type detection false positives (e.g., UUIDs detected as text when they should be ignored)
- Performance with very large CSVs (>1000 rows) - may need chunking
