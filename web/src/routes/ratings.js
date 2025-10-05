const express = require('express');
const router = express.Router();
const Rating = require('../models/Rating');
const { authenticateToken } = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');

// Get rating statistics for a video
router.get('/video/:videoId/stats', [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const stats = await Rating.getStats(videoId);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get rating stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch rating statistics' });
    }
});

// Get ratings for a video
router.get('/video/:videoId', [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        const ratings = await Rating.getByVideoId(videoId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            ratings,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: ratings.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get ratings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch ratings' });
    }
});

// Get user's rating for a video
router.get('/video/:videoId/user', authenticateToken, [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const userId = req.user.id;

        const rating = await Rating.getUserRating(videoId, userId);

        res.json({
            success: true,
            rating: rating || null
        });
    } catch (error) {
        console.error('Get user rating error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user rating' });
    }
});

// Create or update rating
router.post('/', authenticateToken, [
    body('videoId').isUUID().withMessage('Valid video ID required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('review').optional().trim().isLength({ max: 1000 }).withMessage('Review must be less than 1000 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId, rating, review } = req.body;
        const userId = req.user.id;

        const result = await Rating.upsert({
            videoId,
            userId,
            rating,
            review
        });

        res.json({
            success: true,
            message: 'Rating saved successfully',
            rating: result
        });
    } catch (error) {
        console.error('Upsert rating error:', error);
        res.status(500).json({ success: false, message: 'Failed to save rating' });
    }
});

// Delete rating
router.delete('/video/:videoId', authenticateToken, [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const userId = req.user.id;

        await Rating.delete(videoId, userId);

        res.json({
            success: true,
            message: 'Rating deleted successfully'
        });
    } catch (error) {
        console.error('Delete rating error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete rating' });
    }
});

// Get user's all ratings
router.get('/user/my-ratings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, offset = 0 } = req.query;

        const ratings = await Rating.getUserRatings(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            ratings,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: ratings.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get user ratings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user ratings' });
    }
});

module.exports = router;