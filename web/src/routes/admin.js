const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireStrictAdmin, logAdminActivity } = require('../middleware/adminAuth');

// All admin routes require authentication and admin/moderator role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Get platform statistics for admin dashboard
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await pool.query('SELECT * FROM admin_platform_stats');

        // Get additional real-time stats
        const activeUsers = await pool.query(
            `SELECT COUNT(DISTINCT user_id) as count
             FROM view_history
             WHERE created_at > NOW() - INTERVAL '1 hour'`
        );

        const topVideos = await pool.query(
            `SELECT id, title, view_count, like_count
             FROM videos
             WHERE moderation_status = 'approved'
             ORDER BY view_count DESC
             LIMIT 5`
        );

        res.json({
            ...stats.rows[0],
            active_users_hour: parseInt(activeUsers.rows[0].count),
            top_videos: topVideos.rows
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

/**
 * GET /api/admin/moderation/queue
 * Get videos pending moderation
 */
router.get('/moderation/queue', async (req, res) => {
    try {
        const { status = 'pending', limit = 50, offset = 0 } = req.query;

        const videos = await pool.query(
            `SELECT v.*, c.name as channel_name, u.username, u.email
             FROM videos v
             JOIN channels c ON v.channel_id = c.id
             JOIN users u ON c.user_id = u.id
             WHERE v.moderation_status = $1
             ORDER BY v.created_at ASC
             LIMIT $2 OFFSET $3`,
            [status, limit, offset]
        );

        const totalCount = await pool.query(
            'SELECT COUNT(*) FROM videos WHERE moderation_status = $1',
            [status]
        );

        res.json({
            videos: videos.rows,
            total: parseInt(totalCount.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error fetching moderation queue:', error);
        res.status(500).json({ error: 'Failed to fetch moderation queue' });
    }
});

/**
 * POST /api/admin/moderation/video/:videoId/approve
 * Approve a video
 */
router.post('/moderation/video/:videoId/approve', async (req, res) => {
    const { videoId } = req.params;
    const { notes } = req.body;

    try {
        const result = await pool.query(
            `UPDATE videos
             SET moderation_status = 'approved',
                 moderation_notes = $1,
                 moderated_by = $2,
                 moderated_at = NOW(),
                 upload_status = 'completed'
             WHERE id = $3
             RETURNING *`,
            [notes || null, req.user.id, videoId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Log activity
        await logAdminActivity(
            req.user.id,
            'approve_video',
            'video',
            videoId,
            { notes },
            req.ip
        );

        res.json({
            success: true,
            video: result.rows[0],
            message: 'Video approved successfully'
        });
    } catch (error) {
        console.error('Error approving video:', error);
        res.status(500).json({ error: 'Failed to approve video' });
    }
});

/**
 * POST /api/admin/moderation/video/:videoId/reject
 * Reject a video
 */
router.post('/moderation/video/:videoId/reject', async (req, res) => {
    const { videoId } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
    }

    try {
        const result = await pool.query(
            `UPDATE videos
             SET moderation_status = 'rejected',
                 moderation_notes = $1,
                 moderated_by = $2,
                 moderated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [notes || reason, req.user.id, videoId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Log activity
        await logAdminActivity(
            req.user.id,
            'reject_video',
            'video',
            videoId,
            { reason, notes },
            req.ip
        );

        // TODO: Send notification to video owner about rejection

        res.json({
            success: true,
            video: result.rows[0],
            message: 'Video rejected'
        });
    } catch (error) {
        console.error('Error rejecting video:', error);
        res.status(500).json({ error: 'Failed to reject video' });
    }
});

/**
 * POST /api/admin/moderation/video/:videoId/flag
 * Flag a video for review
 */
router.post('/moderation/video/:videoId/flag', async (req, res) => {
    const { videoId } = req.params;
    const { reason, notes } = req.body;

    try {
        const result = await pool.query(
            `UPDATE videos
             SET moderation_status = 'flagged',
                 flag_count = flag_count + 1,
                 moderation_notes = $1
             WHERE id = $2
             RETURNING *`,
            [notes || reason, videoId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Log activity
        await logAdminActivity(
            req.user.id,
            'flag_video',
            'video',
            videoId,
            { reason, notes },
            req.ip
        );

        res.json({ success: true, video: result.rows[0] });
    } catch (error) {
        console.error('Error flagging video:', error);
        res.status(500).json({ error: 'Failed to flag video' });
    }
});

/**
 * GET /api/admin/users
 * Get users with pagination and filtering
 */
router.get('/users', async (req, res) => {
    try {
        const { limit = 50, offset = 0, search, role, banned } = req.query;

        let query = `
            SELECT u.*,
                   COUNT(DISTINCT c.id) as channel_count,
                   COUNT(DISTINCT v.id) as video_count
            FROM users u
            LEFT JOIN channels c ON u.id = c.user_id
            LEFT JOIN videos v ON c.id = v.channel_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
        }

        if (role) {
            params.push(role);
            query += ` AND u.role = $${params.length}`;
        }

        if (banned !== undefined) {
            params.push(banned === 'true');
            query += ` AND u.is_banned = $${params.length}`;
        }

        query += `
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        params.push(limit, offset);

        const users = await pool.query(query, params);

        res.json({
            users: users.rows,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * POST /api/admin/users/:userId/ban
 * Ban a user (admin only)
 */
router.post('/users/:userId/ban', requireStrictAdmin, async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
        return res.status(400).json({ error: 'Ban reason is required' });
    }

    try {
        const result = await pool.query(
            `UPDATE users
             SET is_banned = true,
                 ban_reason = $1,
                 banned_at = NOW(),
                 banned_by = $2
             WHERE id = $3
             RETURNING *`,
            [reason, req.user.id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log activity
        await logAdminActivity(
            req.user.id,
            'ban_user',
            'user',
            userId,
            { reason },
            req.ip
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Error banning user:', error);
        res.status(500).json({ error: 'Failed to ban user' });
    }
});

/**
 * POST /api/admin/users/:userId/unban
 * Unban a user (admin only)
 */
router.post('/users/:userId/unban', requireStrictAdmin, async (req, res) => {
    const { userId } = req.params;

    try {
        const result = await pool.query(
            `UPDATE users
             SET is_banned = false,
                 ban_reason = NULL,
                 banned_at = NULL,
                 banned_by = NULL
             WHERE id = $1
             RETURNING *`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log activity
        await logAdminActivity(
            req.user.id,
            'unban_user',
            'user',
            userId,
            {},
            req.ip
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Error unbanning user:', error);
        res.status(500).json({ error: 'Failed to unban user' });
    }
});

/**
 * GET /api/admin/reports
 * Get content moderation reports
 */
router.get('/reports', async (req, res) => {
    try {
        const { status = 'pending', limit = 50, offset = 0 } = req.query;

        const reports = await pool.query(
            `SELECT cm.*,
                    u_reporter.username as reporter_username,
                    u_moderator.username as moderator_username
             FROM content_moderation cm
             LEFT JOIN users u_reporter ON cm.reporter_id = u_reporter.id
             LEFT JOIN users u_moderator ON cm.moderator_id = u_moderator.id
             WHERE cm.status = $1
             ORDER BY cm.priority DESC, cm.created_at ASC
             LIMIT $2 OFFSET $3`,
            [status, limit, offset]
        );

        res.json({
            reports: reports.rows,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

/**
 * GET /api/admin/activity
 * Get admin activity log
 */
router.get('/activity', async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const activities = await pool.query(
            `SELECT a.*, u.username as admin_username
             FROM admin_activity_log a
             JOIN users u ON a.admin_id = u.id
             ORDER BY a.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json({
            activities: activities.rows,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error fetching activity log:', error);
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

module.exports = router;
