const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');
const { cache } = require('../config/redis');
const s3Service = require('./s3Service');
const bunnyCdnService = require('./bunnyCdnService');

class TranscodeService {
    constructor() {
        this.isProcessing = false;
        this.currentJob = null;
        this.outputQualities = [
            { name: '360p', width: 640, height: 360, bitrate: '1000k', audioBitrate: '96k' },
            { name: '480p', width: 854, height: 480, bitrate: '2500k', audioBitrate: '96k' },
            { name: '720p', width: 1280, height: 720, bitrate: '5000k', audioBitrate: '128k' },
            { name: '1080p', width: 1920, height: 1080, bitrate: '8000k', audioBitrate: '192k' },
            { name: '4K', width: 3840, height: 2160, bitrate: '25000k', audioBitrate: '256k' }
        ];
    }

    async startProcessing() {
        if (this.isProcessing) {
            console.log('⚙️ Transcoding service already running');
            return;
        }

        console.log('🚀 Starting transcoding service...');
        this.isProcessing = true;

        while (this.isProcessing) {
            try {
                const job = await cache.rpop('transcode_queue');
                
                if (!job) {
                    // No jobs in queue, wait 5 seconds
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }

                this.currentJob = job;
                console.log(`📹 Processing film: ${job.filmId}`);

                await this.processFilm(job);

            } catch (error) {
                console.error('❌ Transcoding service error:', error);
                
                if (this.currentJob) {
                    await this.markFilmAsFailed(this.currentJob.filmId, error.message);
                }
                
                // Wait before continuing
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    async stopProcessing() {
        console.log('🛑 Stopping transcoding service...');
        this.isProcessing = false;
    }

    async processFilm(job) {
        const { filmId, userId, filePath, originalName } = job;

        try {
            // Check if job was cancelled
            const cancelled = await cache.get(`transcode_cancelled:${filmId}`);
            if (cancelled) {
                console.log(`⏹️ Job cancelled: ${filmId}`);
                await this.cleanupFiles(filePath);
                return;
            }

            // Update status to processing
            await query(
                'UPDATE videos SET upload_status = $1, updated_at = NOW() WHERE id = $2',
                ['processing', filmId]
            );

            // Analyze input file
            const fileInfo = await this.analyzeFile(filePath);
            console.log(`📊 File analysis for ${filmId}:`, fileInfo);

            // Create output directory
            const outputDir = path.join(__dirname, '../../uploads/processed', filmId);
            await fs.mkdir(outputDir, { recursive: true });

            // Generate thumbnail
            const thumbnailPath = await this.generateThumbnail(filePath, outputDir);

            // Determine which qualities to encode based on source resolution
            const qualitiesList = this.determineOutputQualities(fileInfo);

            // Transcode to multiple qualities
            const transcodeResults = [];
            for (let i = 0; i < qualitiesList.length; i++) {
                const quality = qualitiesList[i];
                
                // Update progress
                const progress = Math.round((i / qualitiesList.length) * 100);
                await cache.set(`transcode_progress:${filmId}`, progress, 3600);

                // Check for cancellation again
                const cancelled = await cache.get(`transcode_cancelled:${filmId}`);
                if (cancelled) {
                    console.log(`⏹️ Job cancelled during processing: ${filmId}`);
                    await this.cleanupFiles(filePath, outputDir);
                    return;
                }

                console.log(`🎬 Encoding ${quality.name} for ${filmId}...`);
                const outputPath = await this.transcodeToQuality(filePath, outputDir, quality, filmId);
                
                if (outputPath) {
                    const fileSize = await this.getFileSize(outputPath);
                    transcodeResults.push({
                        quality: quality.name,
                        path: outputPath,
                        size: fileSize,
                        bitrate: quality.bitrate
                    });

                    // Store in database
                    await query(`
                        INSERT INTO video_files (video_id, quality, file_path, file_size, bitrate, codec)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [filmId, quality.name, outputPath, fileSize, quality.bitrate, 'h264']);
                }
            }

            // Upload to CDN (S3 + Bunny CDN)
            console.log(`📤 Uploading files to CDN for ${filmId}...`);
            let cdnUploads = [];
            
            try {
                // Try Bunny CDN first (faster/cheaper)
                cdnUploads = await bunnyCdnService.uploadVideoFiles(filmId, outputDir);
                console.log(`✅ Uploaded to Bunny CDN: ${cdnUploads.length} files`);
            } catch (error) {
                console.warn('⚠️ Bunny CDN upload failed, falling back to S3:', error.message);
                try {
                    // Fallback to S3
                    cdnUploads = await s3Service.uploadVideoFiles(filmId, outputDir);
                    console.log(`✅ Uploaded to S3: ${cdnUploads.length} files`);
                } catch (s3Error) {
                    console.error('❌ Both CDN uploads failed:', s3Error.message);
                    // Continue with local files
                }
            }

            // Update URLs in transcodeResults with CDN URLs
            const updatedResults = transcodeResults.map(result => {
                const cdnFile = cdnUploads.find(upload => 
                    upload.cdnUrl && upload.cdnUrl.includes(result.quality)
                );
                return {
                    ...result,
                    url: cdnFile ? cdnFile.cdnUrl : result.path,
                    cdnUrl: cdnFile ? cdnFile.cdnUrl : null
                };
            });

            // Find thumbnail CDN URL
            const thumbnailCdn = cdnUploads.find(upload => 
                upload.cdnUrl && upload.cdnUrl.includes('thumbnail')
            );
            const finalThumbnailUrl = thumbnailCdn ? thumbnailCdn.cdnUrl : thumbnailPath;

            // Update film record with results
            await query(`
                UPDATE videos SET 
                    upload_status = $1,
                    thumbnail_url = $2,
                    video_quality = $3,
                    cdn_urls = $4,
                    updated_at = NOW()
                WHERE id = $5
            `, [
                'ready',
                finalThumbnailUrl,
                JSON.stringify(updatedResults.map(r => ({ 
                    quality: r.quality, 
                    size: r.size,
                    url: r.url,
                    cdnUrl: r.cdnUrl 
                }))),
                JSON.stringify(cdnUploads),
                filmId
            ]);

            // Clean up original file
            await this.cleanupFiles(filePath);
            
            // Clean up local processed files after CDN upload
            if (cdnUploads.length > 0) {
                await this.cleanupFiles(outputDir);
                console.log(`🗑️ Cleaned up local files for ${filmId}`);
            }
            
            // Mark original as deleted
            await query(
                'UPDATE videos SET original_deleted = true WHERE id = $1',
                [filmId]
            );

            // Clear progress cache
            await cache.del(`transcode_progress:${filmId}`);
            await cache.del(`transcode_cancelled:${filmId}`);

            console.log(`✅ Successfully processed film: ${filmId}`);

            // Notify user via WebSocket (if socket service is available)
            if (global.io) {
                global.io.to(`user-${userId}`).emit('upload-complete', {
                    filmId,
                    status: 'ready',
                    thumbnailUrl: finalThumbnailUrl,
                    qualities: updatedResults.map(r => ({
                        quality: r.quality,
                        url: r.url,
                        cdnUrl: r.cdnUrl
                    })),
                    cdnEnabled: cdnUploads.length > 0
                });
            }

        } catch (error) {
            console.error(`❌ Failed to process film ${filmId}:`, error);
            await this.markFilmAsFailed(filmId, error.message);
            await this.cleanupFiles(filePath);
        }
    }

    async analyzeFile(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }

                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

                resolve({
                    duration: metadata.format.duration,
                    size: metadata.format.size,
                    bitrate: metadata.format.bit_rate,
                    video: videoStream ? {
                        width: videoStream.width,
                        height: videoStream.height,
                        codec: videoStream.codec_name,
                        fps: eval(videoStream.r_frame_rate)
                    } : null,
                    audio: audioStream ? {
                        codec: audioStream.codec_name,
                        channels: audioStream.channels,
                        sampleRate: audioStream.sample_rate
                    } : null
                });
            });
        });
    }

    determineOutputQualities(fileInfo) {
        if (!fileInfo.video) return [this.outputQualities[0]]; // Default to 360p

        const sourceHeight = fileInfo.video.height;
        
        // Only encode qualities that are equal to or less than source
        return this.outputQualities.filter(quality => quality.height <= sourceHeight);
    }

    async generateThumbnail(inputPath, outputDir) {
        const thumbnailPath = path.join(outputDir, 'thumbnail.jpg');
        
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .screenshots({
                    timestamps: ['10%'],
                    filename: 'thumbnail.jpg',
                    folder: outputDir,
                    size: '1280x720'
                })
                .on('end', () => resolve(thumbnailPath))
                .on('error', reject);
        });
    }

    async transcodeToQuality(inputPath, outputDir, quality, filmId) {
        const outputPath = path.join(outputDir, `${quality.name}.mp4`);

        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .output(outputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .videoBitrate(quality.bitrate)
                .audioBitrate(quality.audioBitrate)
                .size(`${quality.width}x${quality.height}`)
                .autopad()
                .addOption('-preset', 'medium')
                .addOption('-profile:v', 'high')
                .addOption('-level', '4.0')
                .addOption('-pix_fmt', 'yuv420p')
                .addOption('-movflags', '+faststart')
                .addOption('-threads', '0'); // Use all available threads

            // Progress tracking
            command.on('progress', async (progress) => {
                if (progress.percent) {
                    const overallProgress = Math.round(progress.percent);
                    await cache.set(`transcode_progress:${filmId}:${quality.name}`, overallProgress, 3600);
                }
            });

            command.on('end', () => {
                console.log(`✅ Completed ${quality.name} encoding for ${filmId}`);
                resolve(outputPath);
            });

            command.on('error', (err) => {
                console.error(`❌ Error encoding ${quality.name} for ${filmId}:`, err);
                reject(err);
            });

            command.run();
        });
    }

    async getFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch (error) {
            console.error('Error getting file size:', error);
            return 0;
        }
    }

    async markFilmAsFailed(filmId, errorMessage) {
        try {
            await query(
                'UPDATE videos SET upload_status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
                ['failed', errorMessage, filmId]
            );

            // Clear progress cache
            await cache.del(`transcode_progress:${filmId}`);
            
            console.log(`❌ Marked film ${filmId} as failed: ${errorMessage}`);
        } catch (error) {
            console.error('Error marking film as failed:', error);
        }
    }

    async cleanupFiles(...paths) {
        for (const filePath of paths) {
            if (filePath) {
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.isDirectory()) {
                        await fs.rmdir(filePath, { recursive: true });
                    } else {
                        await fs.unlink(filePath);
                    }
                    console.log(`🗑️ Cleaned up: ${filePath}`);
                } catch (error) {
                    console.error(`Error cleaning up ${filePath}:`, error);
                }
            }
        }
    }

    // Get queue status
    async getQueueStatus() {
        try {
            const queueLength = await cache.llen('transcode_queue');
            return {
                queueLength,
                isProcessing: this.isProcessing,
                currentJob: this.currentJob
            };
        } catch (error) {
            console.error('Error getting queue status:', error);
            return { queueLength: 0, isProcessing: false, currentJob: null };
        }
    }
}

// Singleton instance
const transcodeService = new TranscodeService();

// Start the service when the module is loaded
process.nextTick(() => {
    transcodeService.startProcessing();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n📵 Received SIGINT, shutting down transcoding service...');
    await transcodeService.stopProcessing();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n📵 Received SIGTERM, shutting down transcoding service...');
    await transcodeService.stopProcessing();
    process.exit(0);
});

module.exports = transcodeService;