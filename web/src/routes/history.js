const express = require('express');
const router = express.Router();
const WatchHistory = require('../models/WatchHistory');
const { authenticateToken } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

// Get watch history
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const userId = req.user.id;

        const history = await WatchHistory.getHistory(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            history,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: history.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get watch history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch watch history' });
    }
});

// Get continue watching
router.get('/continue', authenticateToken, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const userId = req.user.id;

        const videos = await WatchHistory.getContinueWatching(userId, {
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            videos
        });
    } catch (error) {
        console.error('Get continue watching error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch continue watching' });
    }
});

// Record watch progress
router.post('/record', authenticateToken, [
    body('videoId').isUUID().withMessage('Valid video ID required'),
    body('watchDuration').optional().isInt({ min: 0 }).withMessage('Watch duration must be a positive number'),
    body('completed').optional().isBoolean().withMessage('Completed must be a boolean')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId, watchDuration, completed } = req.body;
        const userId = req.user.id;

        const record = await WatchHistory.record(videoId, userId, {
            watchDuration,
            completed
        });

        res.json({
            success: true,
            record
        });
    } catch (error) {
        console.error('Record watch error:', error);
        res.status(500).json({ success: false, message: 'Failed to record watch progress' });
    }
});

// Get watch progress for video
router.get('/progress/:videoId', authenticateToken, [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const userId = req.user.id;

        const progress = await WatchHistory.getProgress(videoId, userId);

        res.json({
            success: true,
            progress: progress || null
        });
    } catch (error) {
        console.error('Get watch progress error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch watch progress' });
    }
});

// Mark video as completed
router.put('/:videoId/complete', authenticateToken, [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const userId = req.user.id;

        const record = await WatchHistory.markCompleted(videoId, userId);

        res.json({
            success: true,
            message: 'Video marked as completed',
            record
        });
    } catch (error) {
        console.error('Mark completed error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark video as completed' });
    }
});

// Clear watch history
router.delete('/', authenticateToken, async (req, res) => {
    try {
        const { videoId } = req.query;
        const userId = req.user.id;

        const result = await WatchHistory.clearHistory(userId, videoId || null);

        res.json({
            success: true,
            message: videoId ? 'Video removed from history' : 'Watch history cleared',
            result
        });
    } catch (error) {
        console.error('Clear history error:', error);
        res.status(500).json({ success: false, message: 'Failed to clear history' });
    }
});

// Get watch statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const stats = await WatchHistory.getStats(userId);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get watch stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch watch statistics' });
    }
});

module.exports = router;