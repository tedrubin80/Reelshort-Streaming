#!/usr/bin/env node

/**
 * Transcode Worker Service
 * Processes video uploads in the background
 */

require('dotenv').config();
const { initializeRedis } = require('./src/config/redis');
const { initializeDatabase } = require('./src/config/database');
const transcodeService = require('./src/services/transcodeService');

console.log('🎬 Starting Transcode Worker Service...');
console.log('Environment:', process.env.NODE_ENV || 'development');

async function startWorker() {
    try {
        // Initialize database connection
        await initializeDatabase();
        console.log('✅ Database connected for transcode worker');

        // Initialize Redis connection
        await initializeRedis();
        console.log('✅ Redis connected for transcode worker');

        // Start processing
        console.log('🚀 Starting video processing worker...');
        await transcodeService.startProcessing();

    } catch (error) {
        console.error('❌ Failed to start transcode worker:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n📵 Received SIGINT, shutting down transcode worker...');
    await transcodeService.stopProcessing();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n📵 Received SIGTERM, shutting down transcode worker...');
    await transcodeService.stopProcessing();
    process.exit(0);
});

// Start the worker
startWorker();