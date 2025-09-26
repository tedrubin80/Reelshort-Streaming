#!/bin/bash

# Upload processed videos to S3 with intelligent tiering
# Usage: ./upload_to_s3.sh <video_dir> <video_id>

VIDEO_DIR="$1"
VIDEO_ID="$2"

if [ $# -ne 2 ]; then
    echo "Usage: $0 <video_dir> <video_id>"
    exit 1
fi

echo "Uploading video $VIDEO_ID to S3..."

# Upload to hot storage (new content)
for file in "$VIDEO_DIR"/*; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "Uploading $filename to hot storage..."
        s3cmd put "$file" "s3://southernshortfilm/hot/$VIDEO_ID/$filename" --no-preserve
    fi
done

echo "Upload complete for video: $VIDEO_ID"
echo "Files uploaded to s3://southernshortfilm/hot/$VIDEO_ID/"