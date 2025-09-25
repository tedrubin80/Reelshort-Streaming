const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const videoProcessingService = require('../services/videoProcessingService');
const processingDaemon = require('../services/processingDaemon');

const router = express.Router();

// All monitoring routes require admin authentication
router.use(authenticateToken);
router.use((req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
});

/**
 * @route GET /api/monitoring/dashboard
 * @desc Get comprehensive monitoring dashboard data
 * @access Private (Admin)
 */
router.get('/dashboard', async (req, res) => {
    try {
        // Get queue status
        const queueStatus = await videoProcessingService.getQueueStatus();
        
        // Get disk space
        const diskSpace = await videoProcessingService.getDiskSpace();
        
        // Get daemon status
        const daemonStatus = processingDaemon.getStatus();
        
        // Get system info
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        };
        
        res.json({
            timestamp: new Date().toISOString(),
            queue: queueStatus,
            disk: diskSpace,
            daemon: daemonStatus,
            system: systemInfo
        });
        
    } catch (error) {
        console.error('Error getting dashboard data:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

/**
 * @route GET /api/monitoring/queue
 * @desc Get detailed queue information
 * @access Private (Admin)
 */
router.get('/queue', async (req, res) => {
    try {
        const status = await videoProcessingService.getQueueStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting queue status:', error);
        res.status(500).json({ error: 'Failed to get queue status' });
    }
});

/**
 * @route GET /api/monitoring/disk
 * @desc Get disk space information
 * @access Private (Admin)
 */
router.get('/disk', async (req, res) => {
    try {
        const diskInfo = await videoProcessingService.getDiskSpace();
        res.json(diskInfo);
    } catch (error) {
        console.error('Error getting disk info:', error);
        res.status(500).json({ error: 'Failed to get disk information' });
    }
});

/**
 * @route GET /api/monitoring/daemon
 * @desc Get processing daemon status
 * @access Private (Admin)
 */
router.get('/daemon', async (req, res) => {
    try {
        const status = processingDaemon.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting daemon status:', error);
        res.status(500).json({ error: 'Failed to get daemon status' });
    }
});

/**
 * @route POST /api/monitoring/daemon/start
 * @desc Start the processing daemon
 * @access Private (Admin)
 */
router.post('/daemon/start', async (req, res) => {
    try {
        if (processingDaemon.getStatus().isRunning) {
            return res.status(400).json({ error: 'Daemon is already running' });
        }
        
        // Start daemon in background
        processingDaemon.start().catch(error => {
            console.error('Daemon error:', error);
        });
        
        res.json({ 
            success: true, 
            message: 'Processing daemon started' 
        });
        
    } catch (error) {
        console.error('Error starting daemon:', error);
        res.status(500).json({ error: 'Failed to start daemon' });
    }
});

/**
 * @route POST /api/monitoring/daemon/stop
 * @desc Stop the processing daemon
 * @access Private (Admin)
 */
router.post('/daemon/stop', async (req, res) => {
    try {
        if (!processingDaemon.getStatus().isRunning) {
            return res.status(400).json({ error: 'Daemon is not running' });
        }
        
        processingDaemon.stop();
        
        res.json({ 
            success: true, 
            message: 'Processing daemon stop signal sent' 
        });
        
    } catch (error) {
        console.error('Error stopping daemon:', error);
        res.status(500).json({ error: 'Failed to stop daemon' });
    }
});

/**
 * @route GET /api/monitoring/stats
 * @desc Get processing statistics
 * @access Private (Admin)
 */
router.get('/stats', async (req, res) => {
    try {
        const { query } = require('../config/database');
        
        // Get processing statistics from database
        const stats = await query(`
            SELECT 
                upload_status,
                COUNT(*) as count,
                AVG(duration) as avg_duration,
                AVG(file_size) as avg_file_size
            FROM videos 
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY upload_status
        `);
        
        // Get daily upload counts for the last 7 days
        const dailyStats = await query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as uploads,
                COUNT(CASE WHEN upload_status = 'ready' THEN 1 END) as completed,
                COUNT(CASE WHEN upload_status = 'failed' THEN 1 END) as failed
            FROM videos 
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);
        
        res.json({
            statusCounts: stats.rows,
            dailyStats: dailyStats.rows
        });
        
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

module.exports = router;