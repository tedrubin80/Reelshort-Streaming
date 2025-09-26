const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const { cache } = require('../config/redis');
const { query } = require('../config/database');

const execAsync = promisify(exec);

class VideoProcessingService {
    constructor() {
        this.processingPath = process.env.PROCESSING_DRIVE || '/mnt/HC_Volume_103339423';
        this.scriptsPath = path.join(__dirname, '../../../scripts'); // Use scripts from main codebase
        this.inboxPath = path.join(this.processingPath, 'processing', 'inbox');
        this.outputPath = path.join(this.processingPath, 'processing', 'output');
        this.logsPath = path.join(this.processingPath, 'logs');
    }

    /**
     * Add video to processing queue
     */
    async queueVideo(filmId, filePath, userId) {
        try {
            console.log(`Queueing video for processing: ${filmId}`);
            
            // Create unique filename for inbox
            const timestamp = Date.now();
            const originalName = path.basename(filePath);
            const inboxFile = path.join(this.inboxPath, `${filmId}_${timestamp}_${originalName}`);
            
            // Move file to processing inbox
            await fs.rename(filePath, inboxFile);
            
            // Create processing job metadata
            const jobData = {
                filmId,
                userId,
                originalName,
                inboxFile,
                status: 'queued',
                queuedAt: new Date().toISOString(),
                priority: 'normal'
            };
            
            // Store job metadata in Redis
            await cache.set(`processing_job:${filmId}`, JSON.stringify(jobData), 3600 * 24); // 24 hour TTL
            
            // Add to processing queue
            await cache.lpush('video_processing_queue', filmId);
            
            // Update database status
            await query(
                'UPDATE videos SET upload_status = $1, updated_at = NOW() WHERE id = $2',
                ['queued', filmId]
            );
            
            console.log(`Video queued successfully: ${filmId}`);
            return true;
            
        } catch (error) {
            console.error(`Error queueing video ${filmId}:`, error);
            throw error;
        }
    }

    /**
     * Process next video in queue
     */
    async processNextVideo() {
        try {
            // Get next video from queue (non-blocking)
            const filmId = await cache.rpop('video_processing_queue');
            
            if (!filmId) {
                return null; // No videos to process
            }
            
            const actualFilmId = Array.isArray(filmId) ? filmId[1] : filmId;
            
            // Get job metadata
            const jobDataStr = await cache.get(`processing_job:${actualFilmId}`);
            if (!jobDataStr) {
                console.error(`No job metadata found for film: ${actualFilmId}`);
                return null;
            }
            
            const jobData = JSON.parse(jobDataStr);
            
            // Check if job was cancelled
            const cancelled = await cache.get(`transcode_cancelled:${actualFilmId}`);
            if (cancelled) {
                console.log(`Processing cancelled for film: ${actualFilmId}`);
                await this.cleanupCancelledJob(actualFilmId, jobData);
                return null;
            }
            
            console.log(`Starting processing for film: ${actualFilmId}`);
            
            // Update status to processing
            await this.updateProcessingStatus(actualFilmId, 'processing', 0);
            
            // Process the video
            await this.processVideo(actualFilmId, jobData);
            
            return actualFilmId;
            
        } catch (error) {
            console.error('Error processing next video:', error);
            throw error;
        }
    }

    /**
     * Process individual video
     */
    async processVideo(filmId, jobData) {
        try {
            console.log(`Processing video: ${filmId}`);
            
            // Update progress: Starting
            await this.updateProcessingStatus(filmId, 'processing', 10, 'Starting compression...');
            
            // Execute processing script
            const scriptPath = path.join(this.scriptsPath, 'process_video.sh');
            const command = `${scriptPath} process "${jobData.inboxFile}" "${filmId}"`;
            
            console.log(`Executing: ${command}`);
            
            // Run processing with progress tracking
            const { stdout, stderr } = await execAsync(command, {
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });
            
            console.log(`Processing output for ${filmId}:`, stdout);
            if (stderr) {
                console.error(`Processing stderr for ${filmId}:`, stderr);
            }
            
            // Update progress: Processing complete
            await this.updateProcessingStatus(filmId, 'processing', 80, 'Uploading to storage...');
            
            // Check if output files were created
            const outputDir = path.join(this.outputPath, filmId);
            const outputFiles = await fs.readdir(outputDir).catch(() => []);
            
            if (outputFiles.length === 0) {
                throw new Error('No output files generated');
            }
            
            // Update database with S3 URLs
            await this.updateVideoMetadata(filmId, outputFiles);
            
            // Update progress: Complete
            await this.updateProcessingStatus(filmId, 'ready', 100, 'Processing complete');
            
            // Cleanup
            await this.cleanupProcessedJob(filmId, jobData);
            
            console.log(`Successfully processed video: ${filmId}`);
            
        } catch (error) {
            console.error(`Error processing video ${filmId}:`, error);
            
            // Update status to failed
            await this.updateProcessingStatus(filmId, 'failed', 0, `Processing failed: ${error.message}`);
            
            // Cleanup
            await this.cleanupFailedJob(filmId, jobData);
            
            throw error;
        }
    }

    /**
     * Update processing status and progress
     */
    async updateProcessingStatus(filmId, status, progress = 0, message = '') {
        try {
            // Update database
            await query(
                'UPDATE videos SET upload_status = $1, updated_at = NOW() WHERE id = $2',
                [status, filmId]
            );
            
            // Update Redis with progress info
            const progressData = {
                status,
                progress,
                message,
                updatedAt: new Date().toISOString()
            };
            
            await cache.set(`transcode_progress:${filmId}`, JSON.stringify(progressData), 3600);
            
            console.log(`Updated status for ${filmId}: ${status} (${progress}%) - ${message}`);
            
        } catch (error) {
            console.error(`Error updating status for ${filmId}:`, error);
        }
    }

    /**
     * Update video metadata with S3 URLs and file info
     */
    async updateVideoMetadata(filmId, outputFiles) {
        try {
            const s3BaseUrl = `https://${process.env.S3_ENDPOINT}/southernshortfilm/hot/${filmId}`;
            
            const qualities = [];
            let thumbnailUrl = null;
            
            for (const file of outputFiles) {
                if (file.endsWith('_thumb.jpg')) {
                    thumbnailUrl = `${s3BaseUrl}/${file}`;
                } else if (file.endsWith('.mp4')) {
                    // Extract quality from filename (e.g., video_360p.mp4)
                    const qualityMatch = file.match(/_(\d+p)\.mp4$/);
                    if (qualityMatch) {
                        const quality = qualityMatch[1];
                        qualities.push({
                            quality,
                            url: `${s3BaseUrl}/${file}`,
                            filename: file
                        });
                    }
                }
            }
            
            // Update database with metadata
            await query(`
                UPDATE videos SET 
                    thumbnail_url = $1,
                    video_qualities = $2,
                    s3_bucket = $3,
                    s3_path = $4,
                    updated_at = NOW()
                WHERE id = $5
            `, [
                thumbnailUrl,
                JSON.stringify(qualities),
                'southernshortfilm',
                `hot/${filmId}`,
                filmId
            ]);
            
            console.log(`Updated metadata for video ${filmId}: ${qualities.length} qualities, thumbnail: ${thumbnailUrl ? 'yes' : 'no'}`);
            
        } catch (error) {
            console.error(`Error updating metadata for ${filmId}:`, error);
            throw error;
        }
    }

    /**
     * Get processing queue status
     */
    async getQueueStatus() {
        try {
            const queueLength = await cache.llen('video_processing_queue');
            const processingJobs = await cache.keys('processing_job:*');
            
            const activeJobs = [];
            for (const jobKey of processingJobs) {
                const jobDataStr = await cache.get(jobKey);
                if (jobDataStr) {
                    const jobData = JSON.parse(jobDataStr);
                    const progressStr = await cache.get(`transcode_progress:${jobData.filmId}`);
                    const progress = progressStr ? JSON.parse(progressStr) : null;
                    
                    activeJobs.push({
                        filmId: jobData.filmId,
                        status: progress?.status || 'queued',
                        progress: progress?.progress || 0,
                        queuedAt: jobData.queuedAt
                    });
                }
            }
            
            return {
                queueLength,
                activeJobs: activeJobs.length,
                jobs: activeJobs.slice(0, 10) // Return first 10 jobs
            };
            
        } catch (error) {
            console.error('Error getting queue status:', error);
            throw error;
        }
    }

    /**
     * Get disk space information
     */
    async getDiskSpace() {
        try {
            const { stdout } = await execAsync(`df -h ${this.processingPath}`);
            const lines = stdout.trim().split('\n');
            const data = lines[1].split(/\s+/);
            
            return {
                total: data[1],
                used: data[2],
                available: data[3],
                usedPercent: data[4]
            };
            
        } catch (error) {
            console.error('Error getting disk space:', error);
            return null;
        }
    }

    /**
     * Cleanup processed job
     */
    async cleanupProcessedJob(filmId, jobData) {
        try {
            // Remove job metadata
            await cache.del(`processing_job:${filmId}`);
            await cache.del(`transcode_progress:${filmId}`);
            
            // Remove inbox file
            if (jobData.inboxFile) {
                await fs.unlink(jobData.inboxFile).catch(() => {});
            }
            
            console.log(`Cleaned up processed job: ${filmId}`);
            
        } catch (error) {
            console.error(`Error cleaning up job ${filmId}:`, error);
        }
    }

    /**
     * Cleanup failed job
     */
    async cleanupFailedJob(filmId, jobData) {
        try {
            // Keep job metadata for debugging, but remove progress
            await cache.del(`transcode_progress:${filmId}`);
            
            // Remove inbox file
            if (jobData.inboxFile) {
                await fs.unlink(jobData.inboxFile).catch(() => {});
            }
            
            console.log(`Cleaned up failed job: ${filmId}`);
            
        } catch (error) {
            console.error(`Error cleaning up failed job ${filmId}:`, error);
        }
    }

    /**
     * Cleanup cancelled job
     */
    async cleanupCancelledJob(filmId, jobData) {
        try {
            // Remove all job data
            await cache.del(`processing_job:${filmId}`);
            await cache.del(`transcode_progress:${filmId}`);
            await cache.del(`transcode_cancelled:${filmId}`);
            
            // Remove inbox file
            if (jobData.inboxFile) {
                await fs.unlink(jobData.inboxFile).catch(() => {});
            }
            
            console.log(`Cleaned up cancelled job: ${filmId}`);
            
        } catch (error) {
            console.error(`Error cleaning up cancelled job ${filmId}:`, error);
        }
    }
}

module.exports = new VideoProcessingService();