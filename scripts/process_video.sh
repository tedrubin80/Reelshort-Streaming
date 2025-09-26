#!/bin/bash

# Main video processing workflow
# Handles the complete pipeline from upload to S3 storage

set -e

PROCESSING_DIR="/mnt/HC_Volume_103339423/processing"
SCRIPTS_DIR="/mnt/HC_Volume_103339423/scripts"
LOG_DIR="/mnt/HC_Volume_103339423/logs"

# Create log file with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/processing_$TIMESTAMP.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

process_video() {
    local input_file="$1"
    local video_id="$2"
    
    log "Starting processing for video: $video_id"
    log "Input file: $input_file"
    
    # Create working directory
    local work_dir="$PROCESSING_DIR/working/$video_id"
    local output_dir="$PROCESSING_DIR/output/$video_id"
    
    mkdir -p "$work_dir" "$output_dir"
    
    # Copy to working directory
    log "Copying to working directory..."
    cp "$input_file" "$work_dir/"
    local work_file="$work_dir/$(basename "$input_file")"
    
    # Check video duration (enforce 30-minute limit)
    local duration=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$work_file")
    local duration_int=$(printf "%.0f" "$duration")
    
    if [ "$duration_int" -gt 1800 ]; then
        log "ERROR: Video exceeds 30-minute limit ($duration_int seconds)"
        rm -rf "$work_dir"
        return 1
    fi
    
    log "Video duration: $duration_int seconds (within limit)"
    
    # Compress video
    log "Starting compression..."
    "$SCRIPTS_DIR/compress_video.sh" "$work_file" "$output_dir" "$video_id"
    
    # Upload to S3
    log "Uploading to S3..."
    "$SCRIPTS_DIR/upload_to_s3.sh" "$output_dir" "$video_id"
    
    # Cleanup
    log "Cleaning up temporary files..."
    rm -rf "$work_dir"
    
    # Calculate space saved
    local original_size=$(du -b "$input_file" | cut -f1)
    local compressed_size=$(du -bc "$output_dir"/* | tail -1 | cut -f1)
    local space_saved=$((original_size - compressed_size))
    local percent_saved=$((space_saved * 100 / original_size))
    
    log "Processing complete for video: $video_id"
    log "Original size: $(numfmt --to=iec $original_size)"
    log "Compressed size: $(numfmt --to=iec $compressed_size)"
    log "Space saved: $(numfmt --to=iec $space_saved) ($percent_saved%)"
    
    return 0
}

# Check for videos in inbox
check_inbox() {
    local inbox_dir="$PROCESSING_DIR/inbox"
    
    for file in "$inbox_dir"/*; do
        if [ -f "$file" ]; then
            local filename=$(basename "$file")
            local video_id="${filename%.*}_$(date +%s)"
            
            log "Found new video: $filename"
            
            # Move to processing
            mv "$file" "$PROCESSING_DIR/working/"
            
            # Process the video
            if process_video "$PROCESSING_DIR/working/$filename" "$video_id"; then
                log "Successfully processed: $filename"
                rm -f "$PROCESSING_DIR/working/$filename"
            else
                log "Failed to process: $filename"
                # Move back to inbox for retry
                mv "$PROCESSING_DIR/working/$filename" "$inbox_dir/"
            fi
        fi
    done
}

# Monitor disk space
check_disk_space() {
    local used_percent=$(df /mnt/HC_Volume_103339423 | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$used_percent" -gt 80 ]; then
        log "WARNING: Disk space at $used_percent% - cleaning cache"
        find /mnt/HC_Volume_103339423/cache -type f -mtime +1 -delete
        find "$PROCESSING_DIR/output" -type d -mtime +7 -exec rm -rf {} +
    fi
    
    if [ "$used_percent" -gt 90 ]; then
        log "CRITICAL: Disk space at $used_percent% - emergency cleanup"
        find "$PROCESSING_DIR/output" -type d -mtime +1 -exec rm -rf {} +
    fi
}

# Main processing loop
main() {
    log "Starting video processing service"
    log "Processing directory: $PROCESSING_DIR"
    
    while true; do
        check_disk_space
        check_inbox
        sleep 30  # Check every 30 seconds
    done
}

# Handle script arguments
case "${1:-}" in
    "daemon")
        main
        ;;
    "process")
        if [ $# -ne 3 ]; then
            echo "Usage: $0 process <input_file> <video_id>"
            exit 1
        fi
        process_video "$2" "$3"
        ;;
    *)
        echo "Usage: $0 {daemon|process <input_file> <video_id>}"
        echo "  daemon  - Run continuous processing service"
        echo "  process - Process a single video file"
        exit 1
        ;;
esac