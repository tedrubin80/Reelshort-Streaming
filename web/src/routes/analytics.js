const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// All analytics routes require authentication
router.use(authenticateToken);

/**
 * GET /api/analytics/dashboard
 * Get creator dashboard summary stats
 */
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.id;

        // Get the user's channel
        const channelResult = await pool.query(
            'SELECT id FROM channels WHERE user_id = $1 LIMIT 1',
            [userId]
        );

        if (channelResult.rows.length === 0) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        const channelId = channelResult.rows[0].id;

        // Get dashboard stats from view
        const stats = await pool.query(
            'SELECT * FROM creator_dashboard_stats WHERE channel_id = $1',
            [channelId]
        );

        if (stats.rows.length === 0) {
            return res.json({
                channel_id: channelId,
                total_videos: 0,
                total_views: 0,
                total_likes: 0,
                total_subscribers: 0
            });
        }

        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

/**
 * GET /api/analytics/videos
 * Get performance analytics for all creator's videos
 */
router.get('/videos', async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 30, limit = 10 } = req.query;

        const videos = await pool.query(
            `SELECT
                v.id,
                v.title,
                v.thumbnail_url,
                v.created_at,
                v.view_count,
                v.like_count,
                v.dislike_count,
                v.comment_count,
                v.share_count,
                v.duration,
                COALESCE(SUM(va.views_count), 0) as views_last_period,
                COALESCE(AVG(va.avg_watch_duration), 0) as avg_watch_duration,
                COALESCE(AVG(va.completion_rate), 0) as avg_completion_rate
             FROM videos v
             JOIN channels c ON v.channel_id = c.id
             LEFT JOIN video_analytics va ON v.id = va.video_id
                AND va.date > NOW() - INTERVAL '${parseInt(days)} days'
             WHERE c.user_id = $1 AND v.moderation_status = 'approved'
             GROUP BY v.id
             ORDER BY v.view_count DESC
             LIMIT $2`,
            [userId, limit]
        );

        res.json({ videos: videos.rows });
    } catch (error) {
        console.error('Error fetching video analytics:', error);
        res.status(500).json({ error: 'Failed to fetch video analytics' });
    }
});

/**
 * GET /api/analytics/video/:videoId
 * Get detailed analytics for a specific video
 */
router.get('/video/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const userId = req.user.id;
        const { days = 30 } = req.query;

        // Verify ownership
        const ownershipCheck = await pool.query(
            `SELECT v.id FROM videos v
             JOIN channels c ON v.channel_id = c.id
             WHERE v.id = $1 AND c.user_id = $2`,
            [videoId, userId]
        );

        if (ownershipCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get video details
        const videoInfo = await pool.query(
            `SELECT id, title, thumbnail_url, created_at, duration,
                    view_count, like_count, dislike_count, comment_count, share_count
             FROM videos WHERE id = $1`,
            [videoId]
        );

        // Get daily analytics for the period
        const dailyAnalytics = await pool.query(
            `SELECT date, views_count, unique_viewers, avg_watch_duration,
                    completion_rate, likes_count, comments_count, shares_count,
                    source_direct, source_search, source_recommended, source_external,
                    desktop_views, mobile_views, tablet_views
             FROM video_analytics
             WHERE video_id = $1 AND date > NOW() - INTERVAL '${parseInt(days)} days'
             ORDER BY date ASC`,
            [videoId]
        );

        // Get geographic distribution
        const geoData = await pool.query(
            `SELECT country_code, COUNT(*) as views
             FROM view_sessions
             WHERE video_id = $1 AND started_at > NOW() - INTERVAL '${parseInt(days)} days'
                AND country_code IS NOT NULL
             GROUP BY country_code
             ORDER BY views DESC
             LIMIT 10`,
            [videoId]
        );

        // Get traffic sources summary
        const trafficSources = await pool.query(
            `SELECT
                SUM(source_direct) as direct,
                SUM(source_search) as search,
                SUM(source_recommended) as recommended,
                SUM(source_external) as external,
                SUM(source_playlist) as playlist
             FROM video_analytics
             WHERE video_id = $1 AND date > NOW() - INTERVAL '${parseInt(days)} days'`,
            [videoId]
        );

        // Get average watch time over time
        const watchTimeData = await pool.query(
            `SELECT date, avg_watch_duration, completion_rate
             FROM video_analytics
             WHERE video_id = $1 AND date > NOW() - INTERVAL '${parseInt(days)} days'
             ORDER BY date ASC`,
            [videoId]
        );

        res.json({
            video: videoInfo.rows[0],
            daily_analytics: dailyAnalytics.rows,
            geo_distribution: geoData.rows,
            traffic_sources: trafficSources.rows[0] || {},
            watch_time: watchTimeData.rows
        });
    } catch (error) {
        console.error('Error fetching video detailed analytics:', error);
        res.status(500).json({ error: 'Failed to fetch detailed analytics' });
    }
});

/**
 * GET /api/analytics/audience
 * Get audience demographics for creator's channel
 */
router.get('/audience', async (req, res) => {
    try {
        const userId = req.user.id;

        // Get channel
        const channelResult = await pool.query(
            'SELECT id FROM channels WHERE user_id = $1 LIMIT 1',
            [userId]
        );

        if (channelResult.rows.length === 0) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        const channelId = channelResult.rows[0].id;

        // Get demographics
        const demographics = await pool.query(
            'SELECT * FROM audience_demographics WHERE channel_id = $1',
            [channelId]
        );

        // Get geographic distribution from recent view sessions
        const geoData = await pool.query(
            `SELECT vs.country_code, COUNT(*) as views
             FROM view_sessions vs
             JOIN videos v ON vs.video_id = v.id
             JOIN channels c ON v.channel_id = c.id
             WHERE c.id = $1 AND vs.started_at > NOW() - INTERVAL '90 days'
                AND vs.country_code IS NOT NULL
             GROUP BY vs.country_code
             ORDER BY views DESC
             LIMIT 10`,
            [channelId]
        );

        // Get device breakdown
        const deviceData = await pool.query(
            `SELECT vs.device_type, COUNT(*) as views
             FROM view_sessions vs
             JOIN videos v ON vs.video_id = v.id
             JOIN channels c ON v.channel_id = c.id
             WHERE c.id = $1 AND vs.started_at > NOW() - INTERVAL '30 days'
                AND vs.device_type IS NOT NULL
             GROUP BY vs.device_type`,
            [channelId]
        );

        res.json({
            demographics: demographics.rows[0] || null,
            top_countries: geoData.rows,
            device_breakdown: deviceData.rows
        });
    } catch (error) {
        console.error('Error fetching audience analytics:', error);
        res.status(500).json({ error: 'Failed to fetch audience data' });
    }
});

/**
 * GET /api/analytics/revenue
 * Get revenue data for creator (future monetization)
 */
router.get('/revenue', async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 30 } = req.query;

        // Get channel
        const channelResult = await pool.query(
            'SELECT id FROM channels WHERE user_id = $1 LIMIT 1',
            [userId]
        );

        if (channelResult.rows.length === 0) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        const channelId = channelResult.rows[0].id;

        // Get revenue data
        const revenue = await pool.query(
            `SELECT date, ad_revenue, tip_revenue, premium_revenue, sponsor_revenue,
                    platform_fee, processing_fee, net_revenue, payout_status
             FROM creator_revenue
             WHERE channel_id = $1 AND date > NOW() - INTERVAL '${parseInt(days)} days'
             ORDER BY date DESC`,
            [channelId]
        );

        // Get total revenue summary
        const summary = await pool.query(
            `SELECT
                COALESCE(SUM(ad_revenue), 0) as total_ad_revenue,
                COALESCE(SUM(tip_revenue), 0) as total_tip_revenue,
                COALESCE(SUM(premium_revenue), 0) as total_premium_revenue,
                COALESCE(SUM(net_revenue), 0) as total_net_revenue,
                COALESCE(SUM(CASE WHEN payout_status = 'paid' THEN net_revenue ELSE 0 END), 0) as total_paid_out,
                COALESCE(SUM(CASE WHEN payout_status = 'pending' THEN net_revenue ELSE 0 END), 0) as pending_payout
             FROM creator_revenue
             WHERE channel_id = $1 AND date > NOW() - INTERVAL '${parseInt(days)} days'`,
            [channelId]
        );

        res.json({
            daily_revenue: revenue.rows,
            summary: summary.rows[0] || {}
        });
    } catch (error) {
        console.error('Error fetching revenue data:', error);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
});

/**
 * POST /api/analytics/view-session
 * Record a view session (called from video player)
 */
router.post('/view-session', async (req, res) => {
    try {
        const {
            video_id,
            watch_duration,
            video_duration,
            traffic_source,
            device_type,
            referrer_url
        } = req.body;

        const userId = req.user ? req.user.id : null;
        const sessionId = req.headers['x-session-id'] || null;

        if (!video_id || !watch_duration) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const completionPercentage = video_duration
            ? (watch_duration / video_duration * 100).toFixed(2)
            : 0;

        // Insert view session
        const result = await pool.query(
            `INSERT INTO view_sessions
             (video_id, user_id, session_id, watch_duration, video_duration,
              completion_percentage, traffic_source, device_type, referrer_url,
              ip_address, started_at, ended_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
             RETURNING id`,
            [
                video_id,
                userId,
                sessionId,
                watch_duration,
                video_duration,
                completionPercentage,
                traffic_source || 'direct',
                device_type || 'desktop',
                referrer_url,
                req.ip
            ]
        );

        res.json({
            success: true,
            session_id: result.rows[0].id
        });
    } catch (error) {
        console.error('Error recording view session:', error);
        res.status(500).json({ error: 'Failed to record view session' });
    }
});

/**
 * GET /api/analytics/growth
 * Get channel growth metrics over time
 */
router.get('/growth', async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 90 } = req.query;

        // Get channel
        const channelResult = await pool.query(
            'SELECT id FROM channels WHERE user_id = $1 LIMIT 1',
            [userId]
        );

        if (channelResult.rows.length === 0) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        const channelId = channelResult.rows[0].id;

        // Get daily growth metrics
        const growth = await pool.query(
            `SELECT
                date,
                total_views,
                new_subscribers,
                lost_subscribers,
                total_subscribers,
                total_likes,
                total_comments,
                total_watch_time
             FROM channel_analytics
             WHERE channel_id = $1 AND date > NOW() - INTERVAL '${parseInt(days)} days'
             ORDER BY date ASC`,
            [channelId]
        );

        res.json({ growth: growth.rows });
    } catch (error) {
        console.error('Error fetching growth metrics:', error);
        res.status(500).json({ error: 'Failed to fetch growth data' });
    }
});

module.exports = router;
