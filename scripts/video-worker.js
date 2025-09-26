#!/usr/bin/env node

/**
 * Video Processing Worker
 * Continuously processes videos from Redis queue
 */

const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

// Add the web directory to require path
const webDir = path.join(__dirname, '../web/src');
process.env.NODE_PATH = webDir;
require('module').Module._initPaths();

const videoProcessingService = require('../web/src/services/videoProcessingService');
const { initializeRedis, cache } = require('../web/src/config/redis');

const execAsync = promisify(exec);

class VideoWorker {
    constructor() {
        this.running = false;
        this.processingCount = 0;
        this.maxConcurrentJobs = 1; // Process one video at a time
    }

    async start() {
        console.log('🎬 Starting Video Processing Worker...');
        console.log(`📁 Processing Path: ${videoProcessingService.processingPath}`);
        console.log(`📜 Scripts Path: ${videoProcessingService.scriptsPath}`);

        // Initialize Redis connection
        await initializeRedis();
        console.log('✅ Redis initialized for worker');

        this.running = true;

        // Main processing loop
        while (this.running) {
            try {
                if (this.processingCount < this.maxConcurrentJobs) {
                    await this.processNext();
                }

                // Wait 5 seconds before checking for next job
                await this.sleep(5000);

            } catch (error) {
                console.error('❌ Worker error:', error.message);
                await this.sleep(10000); // Wait longer on error
            }
        }

        console.log('🛑 Video Processing Worker stopped');
    }

    async processNext() {
        try {
            const filmId = await videoProcessingService.processNextVideo();

            if (filmId) {
                this.processingCount++;
                console.log(`🎥 Processed video: ${filmId} (Active jobs: ${this.processingCount})`);
                this.processingCount = Math.max(0, this.processingCount - 1);
            }

        } catch (error) {
            this.processingCount = Math.max(0, this.processingCount - 1);
            console.error('❌ Processing error:', error.message);
        }
    }

    async getQueueStatus() {
        try {
            const queueLength = await cache.llen('video_processing_queue');
            const status = await videoProcessingService.getQueueStatus();

            console.log(`📊 Queue Status: ${queueLength} pending, ${status.activeJobs} active`);
            return status;

        } catch (error) {
            console.error('❌ Error getting queue status:', error.message);
            return null;
        }
    }

    async stop() {
        console.log('🛑 Stopping Video Processing Worker...');
        this.running = false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Handle process signals
const worker = new VideoWorker();

process.on('SIGINT', async () => {
    console.log('\n🔄 Received SIGINT, gracefully shutting down...');
    await worker.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🔄 Received SIGTERM, gracefully shutting down...');
    await worker.stop();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the worker
if (require.main === module) {
    worker.start().catch(error => {
        console.error('❌ Failed to start worker:', error);
        process.exit(1);
    });
}

module.exports = VideoWorker;