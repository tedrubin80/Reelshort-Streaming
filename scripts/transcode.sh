#!/bin/bash

# Video transcoding script for YouTube-style platform
# Usage: ./transcode.sh input_file output_dir stream_id

set -e

INPUT_FILE=$1
OUTPUT_DIR=$2
STREAM_ID=$3

if [ -z "$INPUT_FILE" ] || [ -z "$OUTPUT_DIR" ] || [ -z "$STREAM_ID" ]; then
    echo "Usage: $0 <input_file> <output_dir> <stream_id>"
    exit 1
fi

echo "Starting transcoding for stream: $STREAM_ID"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate thumbnail
ffmpeg -i "$INPUT_FILE" -ss 00:00:01.000 -vframes 1 -q:v 2 "$OUTPUT_DIR/thumbnail.jpg" -y

# Transcode to multiple qualities
# 1080p
ffmpeg -i "$INPUT_FILE" \
    -c:v libx264 -preset medium -crf 23 -maxrate 5000k -bufsize 10000k \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
    -c:a aac -b:a 128k -ac 2 -ar 48000 \
    -f mp4 -movflags +faststart \
    "$OUTPUT_DIR/${STREAM_ID}_1080p.mp4" -y

# 720p
ffmpeg -i "$INPUT_FILE" \
    -c:v libx264 -preset medium -crf 25 -maxrate 3000k -bufsize 6000k \
    -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
    -c:a aac -b:a 96k -ac 2 -ar 48000 \
    -f mp4 -movflags +faststart \
    "$OUTPUT_DIR/${STREAM_ID}_720p.mp4" -y

# 480p
ffmpeg -i "$INPUT_FILE" \
    -c:v libx264 -preset medium -crf 27 -maxrate 1500k -bufsize 3000k \
    -vf "scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2" \
    -c:a aac -b:a 64k -ac 2 -ar 48000 \
    -f mp4 -movflags +faststart \
    "$OUTPUT_DIR/${STREAM_ID}_480p.mp4" -y

# 360p
ffmpeg -i "$INPUT_FILE" \
    -c:v libx264 -preset medium -crf 30 -maxrate 800k -bufsize 1600k \
    -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" \
    -c:a aac -b:a 48k -ac 2 -ar 48000 \
    -f mp4 -movflags +faststart \
    "$OUTPUT_DIR/${STREAM_ID}_360p.mp4" -y

echo "Transcoding completed for stream: $STREAM_ID"