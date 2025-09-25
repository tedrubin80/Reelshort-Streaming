const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

// Get file duration using ffprobe
function getFileDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(Math.round(metadata.format.duration));
        });
    });
}

// Get file size
async function getFileSize(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return stats.size;
    } catch (error) {
        throw new Error(`Failed to get file size: ${error.message}`);
    }
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format duration for display
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Get video metadata
function getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            resolve({
                format: {
                    filename: metadata.format.filename,
                    format_name: metadata.format.format_name,
                    duration: parseFloat(metadata.format.duration),
                    size: parseInt(metadata.format.size),
                    bit_rate: parseInt(metadata.format.bit_rate)
                },
                video: videoStream ? {
                    codec: videoStream.codec_name,
                    width: videoStream.width,
                    height: videoStream.height,
                    fps: eval(videoStream.r_frame_rate || '0/1'),
                    bitrate: videoStream.bit_rate ? parseInt(videoStream.bit_rate) : null,
                    pixel_format: videoStream.pix_fmt
                } : null,
                audio: audioStream ? {
                    codec: audioStream.codec_name,
                    channels: audioStream.channels,
                    sample_rate: audioStream.sample_rate,
                    bitrate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) : null
                } : null
            });
        });
    });
}

// Validate video file format
async function validateVideoFile(filePath) {
    try {
        const metadata = await getVideoMetadata(filePath);
        
        // Check if file has video stream
        if (!metadata.video) {
            throw new Error('File does not contain a valid video stream');
        }

        // Check duration (max 30 minutes = 1800 seconds)
        if (metadata.format.duration > 1800) {
            throw new Error('Film duration exceeds 30 minute limit');
        }

        // Check if video dimensions are reasonable
        if (metadata.video.width < 240 || metadata.video.height < 180) {
            throw new Error('Video resolution too low (minimum 240x180)');
        }

        if (metadata.video.width > 7680 || metadata.video.height > 4320) {
            throw new Error('Video resolution too high (maximum 8K)');
        }

        // Check frame rate
        if (metadata.video.fps > 120) {
            throw new Error('Frame rate too high (maximum 120fps)');
        }

        return {
            isValid: true,
            metadata
        };

    } catch (error) {
        return {
            isValid: false,
            error: error.message
        };
    }
}

// Generate secure filename
function generateSecureFilename(originalName, userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(originalName).toLowerCase();
    
    return `${userId}-${timestamp}-${random}${extension}`;
}

// Clean filename for storage
function sanitizeFilename(filename) {
    // Remove or replace unsafe characters
    return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')  // Replace unsafe chars with underscore
        .replace(/_{2,}/g, '_')           // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '')         // Remove leading/trailing underscores
        .substring(0, 100);              // Limit length
}

// Check available disk space
async function checkDiskSpace(directory) {
    try {
        const stats = await fs.statfs(directory);
        const freeBytes = stats.bavail * stats.bsize;
        const totalBytes = stats.blocks * stats.bsize;
        
        return {
            free: freeBytes,
            total: totalBytes,
            used: totalBytes - freeBytes,
            freeFormatted: formatFileSize(freeBytes),
            totalFormatted: formatFileSize(totalBytes)
        };
    } catch (error) {
        throw new Error(`Failed to check disk space: ${error.message}`);
    }
}

// Create directory if it doesn't exist
async function ensureDirectory(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        return true;
    } catch (error) {
        throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
}

// Delete file safely
async function deleteFile(filePath) {
    try {
        await fs.access(filePath); // Check if file exists
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, consider it deleted
            return true;
        }
        throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
}

// Delete directory and contents
async function deleteDirectory(dirPath) {
    try {
        await fs.access(dirPath); // Check if directory exists
        await fs.rmdir(dirPath, { recursive: true });
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Directory doesn't exist, consider it deleted
            return true;
        }
        throw new Error(`Failed to delete directory ${dirPath}: ${error.message}`);
    }
}

// Get file extension from mimetype
function getExtensionFromMimetype(mimetype) {
    const mimetypeMap = {
        'video/mp4': '.mp4',
        'video/avi': '.avi',
        'video/quicktime': '.mov',
        'video/x-msvideo': '.avi',
        'video/x-ms-wmv': '.wmv',
        'video/x-flv': '.flv',
        'video/x-matroska': '.mkv'
    };
    
    return mimetypeMap[mimetype] || '.mp4';
}

// Check if path is safe (prevent directory traversal)
function isSafePath(userPath, baseDir) {
    const normalizedPath = path.normalize(userPath);
    const normalizedBase = path.normalize(baseDir);
    
    return normalizedPath.startsWith(normalizedBase) && 
           !normalizedPath.includes('..') && 
           !normalizedPath.includes('~');
}

module.exports = {
    getFileDuration,
    getFileSize,
    formatFileSize,
    formatDuration,
    getVideoMetadata,
    validateVideoFile,
    generateSecureFilename,
    sanitizeFilename,
    checkDiskSpace,
    ensureDirectory,
    deleteFile,
    deleteDirectory,
    getExtensionFromMimetype,
    isSafePath
};