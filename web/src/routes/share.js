const express = require('express');
const router = express.Router();
const Share = require('../models/Share');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

// Record a share
router.post('/', optionalAuth, [
    body('videoId').isUUID().withMessage('Valid video ID required'),
    body('shareType').isIn(['link', 'embed', 'social', 'email']).withMessage('Valid share type required'),
    body('platform').optional().isString().withMessage('Platform must be a string')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId, shareType, platform } = req.body;
        const userId = req.user?.id || null;

        const share = await Share.create({
            videoId,
            userId,
            shareType,
            platform
        });

        res.json({
            success: true,
            message: 'Share recorded successfully',
            share
        });
    } catch (error) {
        console.error('Record share error:', error);
        res.status(500).json({ success: false, message: 'Failed to record share' });
    }
});

// Get video share statistics
router.get('/stats/:videoId', [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const stats = await Share.getVideoStats(videoId);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get share stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch share statistics' });
    }
});

// Get user's share history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const userId = req.user.id;

        const shares = await Share.getUserShares(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            shares,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: shares.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get share history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch share history' });
    }
});

// Generate share URL
router.get('/url/:videoId', [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const shareUrl = Share.generateShareUrl(videoId);

        res.json({
            success: true,
            url: shareUrl
        });
    } catch (error) {
        console.error('Generate share URL error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate share URL' });
    }
});

// Generate embed code
router.get('/embed/:videoId', [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const { width, height, autoplay } = req.query;

        const embedCode = Share.generateEmbedCode(videoId, {
            width: parseInt(width) || 640,
            height: parseInt(height) || 360,
            autoplay: autoplay === 'true'
        });

        res.json({
            success: true,
            embedCode
        });
    } catch (error) {
        console.error('Generate embed code error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate embed code' });
    }
});

module.exports = router;
