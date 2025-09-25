#!/bin/bash

# Stream live video to RTMP server
# Usage: ./stream-to-rtmp.sh input_source rtmp_url stream_key

set -e

INPUT_SOURCE=$1
RTMP_URL=$2
STREAM_KEY=$3

if [ -z "$INPUT_SOURCE" ] || [ -z "$RTMP_URL" ] || [ -z "$STREAM_KEY" ]; then
    echo "Usage: $0 <input_source> <rtmp_url> <stream_key>"
    echo "Example: $0 /dev/video0 rtmp://localhost:1935/live stream123"
    exit 1
fi

echo "Starting live stream to: $RTMP_URL/$STREAM_KEY"

# Stream with adaptive bitrate
ffmpeg -f v4l2 -i "$INPUT_SOURCE" \
    -c:v libx264 -preset veryfast -tune zerolatency \
    -b:v 2500k -maxrate 2500k -bufsize 5000k \
    -vf "scale=1280:720" \
    -g 50 -keyint_min 25 -sc_threshold 0 \
    -c:a aac -b:a 128k -ac 2 -ar 48000 \
    -f flv "$RTMP_URL/$STREAM_KEY"