#!/usr/bin/env node

/**
 * Video Processing Daemon Startup Script
 * This script starts the video processing daemon as a separate process
 */

require('dotenv').config();
const processingDaemon = require('./src/services/processingDaemon');
const { initializeDatabase } = require('./src/config/database');
const { initializeRedis } = require('./src/config/redis');

async function startDaemon() {
    try {
        console.log('🎬 Starting ReelShorts Video Processing Daemon');
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Processing Drive: ${process.env.PROCESSING_DRIVE || '/mnt/HC_Volume_103339423'}`);
        console.log(`Max Concurrent: ${process.env.MAX_CONCURRENT_PROCESSING || 3}`);
        
        // Initialize database connection
        console.log('📦 Initializing database connection...');
        await initializeDatabase();
        
        // Initialize Redis connection
        console.log('🔑 Initializing Redis connection...');
        await initializeRedis();
        
        console.log('✅ All connections initialized');
        console.log('🚀 Starting processing daemon...');
        
        // Start the daemon
        await processingDaemon.start();
        
    } catch (error) {
        console.error('❌ Failed to start processing daemon:', error);
        process.exit(1);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the daemon
startDaemon();