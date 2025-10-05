const express = require('express');
const router = express.Router();
const Search = require('../models/Search');
const { optionalAuth } = require('../middleware/auth');
const { query, validationResult } = require('express-validator');

// Search videos
router.get('/videos', optionalAuth, [
    query('q').optional().trim().isLength({ max: 200 }).withMessage('Query must be less than 200 characters'),
    query('category').optional().trim(),
    query('duration').optional().isIn(['short', 'medium', 'long']).withMessage('Invalid duration filter'),
    query('sortBy').optional().isIn(['relevance', 'date', 'views', 'rating', 'trending']).withMessage('Invalid sort option'),
    query('uploadedAfter').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const {
            q: query,
            category,
            duration,
            sortBy = 'relevance',
            uploadedAfter,
            limit = 20,
            offset = 0
        } = req.query;

        const videos = await Search.searchVideos({
            query,
            category,
            duration,
            sortBy,
            uploadedAfter,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Record search for analytics
        if (query && query.trim() !== '') {
            await Search.recordSearch({
                query,
                userId: req.user?.id,
                resultsCount: videos.length
            }).catch(err => console.error('Failed to record search:', err));
        }

        res.json({
            success: true,
            videos,
            query: query || '',
            filters: {
                category,
                duration,
                sortBy,
                uploadedAfter
            },
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: videos.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Search videos error:', error);
        res.status(500).json({ success: false, message: 'Failed to search videos' });
    }
});

// Search channels
router.get('/channels', optionalAuth, [
    query('q').trim().notEmpty().withMessage('Search query required'),
    query('q').isLength({ max: 200 }).withMessage('Query must be less than 200 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { q: query, limit = 20, offset = 0 } = req.query;

        const channels = await Search.searchChannels({
            query,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            channels,
            query,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: channels.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Search channels error:', error);
        res.status(500).json({ success: false, message: 'Failed to search channels' });
    }
});

// Get trending videos
router.get('/trending', async (req, res) => {
    try {
        const { timeframe = '7days', limit = 20, offset = 0 } = req.query;

        const videos = await Search.getTrending({
            timeframe,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            videos,
            timeframe,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: videos.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get trending error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch trending videos' });
    }
});

// Get search suggestions
router.get('/suggestions', [
    query('q').trim().notEmpty().withMessage('Search query required'),
    query('q').isLength({ min: 2, max: 200 }).withMessage('Query must be 2-200 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { q: query, limit = 10 } = req.query;

        const suggestions = await Search.getSuggestions(query, parseInt(limit));

        res.json({
            success: true,
            suggestions
        });
    } catch (error) {
        console.error('Get suggestions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch suggestions' });
    }
});

// Get popular searches
router.get('/popular', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const searches = await Search.getPopularSearches(parseInt(limit));

        res.json({
            success: true,
            searches
        });
    } catch (error) {
        console.error('Get popular searches error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch popular searches' });
    }
});

// Get categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await Search.getCategories();

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
});

module.exports = router;
