const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { query, param, validationResult } = require('express-validator');

// Search and filter videos
router.get('/search', optionalAuth, async (req, res) => {
    try {
        const {
            q = '',
            category,
            tags,
            sortBy = 'created_at',
            order = 'DESC',
            limit = 20,
            offset = 0
        } = req.query;

        const searchParams = {
            query: q,
            categoryId: category,
            tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
            sortBy,
            order,
            limit: parseInt(limit),
            offset: parseInt(offset),
            userId: req.user?.id
        };

        const videos = await Video.search(searchParams);

        res.json({
            success: true,
            videos,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: videos.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Video search error:', error);
        res.status(500).json({ success: false, message: 'Failed to search videos' });
    }
});

// Get trending videos
router.get('/trending', async (req, res) => {
    try {
        const { limit = 20, timeframe = '7 days' } = req.query;

        const videos = await Video.getTrending({
            limit: parseInt(limit),
            timeframe
        });

        res.json({
            success: true,
            videos
        });
    } catch (error) {
        console.error('Get trending videos error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch trending videos' });
    }
});

// Get recommended videos for user
router.get('/recommended', authenticateToken, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const userId = req.user.id;

        const videos = await Video.getRecommended(userId, {
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            videos
        });
    } catch (error) {
        console.error('Get recommended videos error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch recommended videos' });
    }
});

// Get video by ID
router.get('/:videoId', optionalAuth, [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const userId = req.user?.id;

        const video = await Video.getById(videoId, userId);

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        res.json({
            success: true,
            video
        });
    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch video' });
    }
});

// Increment view count
router.post('/:videoId/view', optionalAuth, [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const userId = req.user?.id;
        const sessionId = req.sessionID;

        await Video.incrementViewCount(videoId, userId, sessionId);

        res.json({
            success: true,
            message: 'View recorded'
        });
    } catch (error) {
        console.error('Record view error:', error);
        res.status(500).json({ success: false, message: 'Failed to record view' });
    }
});

// Get video statistics
router.get('/:videoId/stats', [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const stats = await Video.getStats(videoId);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get video stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch video statistics' });
    }
});

// Get user's uploaded videos
router.get('/user/my-videos', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, offset = 0 } = req.query;

        const videos = await Video.getUserVideos(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            videos,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: videos.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get user videos error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user videos' });
    }
});

// Delete video
router.delete('/:videoId', authenticateToken, [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const userId = req.user.id;

        const deleted = await Video.delete(videoId, userId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Video not found or unauthorized'
            });
        }

        res.json({
            success: true,
            message: 'Video deleted successfully'
        });
    } catch (error) {
        console.error('Delete video error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete video' });
    }
});

module.exports = router;