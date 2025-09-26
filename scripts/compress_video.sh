#!/bin/bash

# ReelShorts.tv Video Compression Script
# Optimized for 30-minute maximum duration with efficient compression

set -e

INPUT_FILE="$1"
OUTPUT_DIR="$2"
VIDEO_ID="$3"

if [ $# -ne 3 ]; then
    echo "Usage: $0 <input_file> <output_dir> <video_id>"
    exit 1
fi

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file does not exist: $INPUT_FILE"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get video duration in seconds
DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$INPUT_FILE")
DURATION_INT=$(printf "%.0f" "$DURATION")

echo "Processing video: $VIDEO_ID"
echo "Duration: $DURATION_INT seconds"

# Determine compression settings based on duration
if [ "$DURATION_INT" -le 600 ]; then
    # 0-10 minutes: Higher quality
    CRF=20
    PRESET="medium"
    echo "Short video: Using high quality settings (CRF=$CRF)"
elif [ "$DURATION_INT" -le 1200 ]; then
    # 10-20 minutes: Medium quality
    CRF=23
    PRESET="medium"
    echo "Medium video: Using balanced settings (CRF=$CRF)"
else
    # 20-30 minutes: Maximum compression
    CRF=26
    PRESET="slower"
    echo "Long video: Using maximum compression (CRF=$CRF)"
fi

# Generate different quality versions
echo "Generating 360p version..."
ffmpeg -i "$INPUT_FILE" -c:v libx264 -preset "$PRESET" -crf "$CRF" \
    -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" \
    -c:a aac -b:a 64k -movflags +faststart \
    "$OUTPUT_DIR/${VIDEO_ID}_360p.mp4" -y

# Only generate higher qualities for longer videos
if [ "$DURATION_INT" -gt 300 ]; then
    echo "Generating 480p version..."
    ffmpeg -i "$INPUT_FILE" -c:v libx264 -preset "$PRESET" -crf "$CRF" \
        -vf "scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2" \
        -c:a aac -b:a 96k -movflags +faststart \
        "$OUTPUT_DIR/${VIDEO_ID}_480p.mp4" -y
fi

if [ "$DURATION_INT" -gt 600 ]; then
    echo "Generating 720p version..."
    ffmpeg -i "$INPUT_FILE" -c:v libx264 -preset "$PRESET" -crf "$CRF" \
        -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
        -c:a aac -b:a 128k -movflags +faststart \
        "$OUTPUT_DIR/${VIDEO_ID}_720p.mp4" -y
fi

# Generate thumbnail
echo "Generating thumbnail..."
ffmpeg -i "$INPUT_FILE" -ss $(echo "$DURATION * 0.1" | bc) -vframes 1 \
    -vf "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2" \
    "$OUTPUT_DIR/${VIDEO_ID}_thumb.jpg" -y

echo "Compression complete for video: $VIDEO_ID"
echo "Output files in: $OUTPUT_DIR"