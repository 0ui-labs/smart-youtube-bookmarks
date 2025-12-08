#!/bin/bash

# Script to get precise date and time in Berlin timezone
# Uses Europe/Berlin timezone which handles both CET and CEST automatically
# Compatible with both BSD (macOS) and GNU (Linux) date commands

# Method 1: Using TZ environment variable (most portable)
echo "=== Berlin Time (Method 1: Basic Format) ==="
TZ='Europe/Berlin' date '+%Y-%m-%d %H:%M:%S %Z'

echo ""

# Method 2: Detailed German format
echo "=== Berlin Time (Method 2: Detailed Format) ==="
TZ='Europe/Berlin' date '+%A, %d. %B %Y - %H:%M:%S Uhr %Z'

echo ""

# Method 3: ISO 8601 format with timezone (BSD compatible)
echo "=== Berlin Time (Method 3: ISO 8601 Format) ==="
TZ='Europe/Berlin' date '+%Y-%m-%dT%H:%M:%S%z'

echo ""

# Method 4: Unix timestamp + human readable
echo "=== Berlin Time (Method 4: Unix Timestamp) ==="
echo "Unix Timestamp: $(TZ='Europe/Berlin' date +%s)"
echo "Human Readable: $(TZ='Europe/Berlin' date '+%d.%m.%Y %H:%M:%S')"

echo ""

# Method 5: With timezone offset
echo "=== Berlin Time (Method 5: With UTC Offset) ==="
TZ='Europe/Berlin' date '+%Y-%m-%d %H:%M:%S %Z (UTC%z)'
