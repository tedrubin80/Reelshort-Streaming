const express = require('express');
const router = express.Router();
const recommendationEngine = require('../services/recommendationEngine');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

/**
 * GET /api/recommendations/personalized
 * Get personalized video recommendations for logged-in user
 */
router.get('/personalized', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20 } = req.query;

        const recommendations = await recommendationEngine.getPersonalizedRecommendations(
            userId,
            parseInt(limit)
        );

        res.json({
            success: true,
            recommendations,
            count: recommendations.length
        });
    } catch (error) {
        console.error('Error getting personalized recommendations:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

/**
 * GET /api/recommendations/trending
 * Get trending videos (public endpoint)
 */
router.get('/trending', async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const trending = await recommendationEngine.getTrendingVideos(parseInt(limit));

        res.json({
            success: true,
            videos: trending,
            count: trending.length
        });
    } catch (error) {
        console.error('Error getting trending videos:', error);
        res.status(500).json({ error: 'Failed to get trending videos' });
    }
});

/**
 * GET /api/recommendations/popular
 * Get popular videos (public endpoint)
 */
router.get('/popular', async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const popular = await recommendationEngine.getPopularVideos(parseInt(limit));

        res.json({
            success: true,
            videos: popular,
            count: popular.length
        });
    } catch (error) {
        console.error('Error getting popular videos:', error);
        res.status(500).json({ error: 'Failed to get popular videos' });
    }
});

/**
 * GET /api/recommendations/related/:videoId
 * Get videos related to a specific video (watch next)
 */
router.get('/related/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const { limit = 10 } = req.query;

        const related = await recommendationEngine.getRelatedVideos(
            videoId,
            parseInt(limit)
        );

        res.json({
            success: true,
            related_videos: related,
            count: related.length
        });
    } catch (error) {
        console.error('Error getting related videos:', error);
        res.status(500).json({ error: 'Failed to get related videos' });
    }
});

/**
 * GET /api/recommendations/home
 * Get homepage recommendations (mix of trending, popular, and personalized if logged in)
 */
router.get('/home', optionalAuth, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const { limit = 30 } = req.query;

        let recommendations;

        if (userId) {
            // Logged in user - get personalized recommendations
            recommendations = await recommendationEngine.getPersonalizedRecommendations(
                userId,
                parseInt(limit)
            );
        } else {
            // Anonymous user - mix trending and popular
            const trending = await recommendationEngine.getTrendingVideos(parseInt(limit / 2));
            const popular = await recommendationEngine.getPopularVideos(parseInt(limit / 2));

            // Interleave trending and popular
            recommendations = [];
            const maxLength = Math.max(trending.length, popular.length);
            for (let i = 0; i < maxLength; i++) {
                if (i < trending.length) recommendations.push(trending[i]);
                if (i < popular.length) recommendations.push(popular[i]);
            }
        }

        res.json({
            success: true,
            videos: recommendations.slice(0, parseInt(limit)),
            is_personalized: !!userId
        });
    } catch (error) {
        console.error('Error getting home recommendations:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

/**
 * POST /api/recommendations/refresh-cache
 * Manually refresh recommendation caches (admin only)
 */
router.post('/refresh-cache', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const { role } = req.user;

        if (role !== 'admin' && role !== 'moderator') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        await recommendationEngine.clearAllCaches();

        res.json({
            success: true,
            message: 'Recommendation caches cleared successfully'
        });
    } catch (error) {
        console.error('Error refreshing cache:', error);
        res.status(500).json({ error: 'Failed to refresh cache' });
    }
});

module.exports = router;
