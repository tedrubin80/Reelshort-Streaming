const { pool } = require('../config/database');

class Notification {
    /**
     * Create notification
     */
    static async create({ userId, type, title, message, relatedId = null }) {
        const query = `
            INSERT INTO notifications (user_id, type, title, message, related_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const result = await pool.query(query, [userId, type, title, message, relatedId]);
        return result.rows[0];
    }

    /**
     * Get user notifications
     */
    static async getByUserId(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
        let query = `
            SELECT * FROM notifications
            WHERE user_id = $1
        `;

        const values = [userId];

        if (unreadOnly) {
            query += ' AND is_read = false';
        }

        query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(notificationId, userId) {
        const query = `
            UPDATE notifications
            SET is_read = true
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [notificationId, userId]);
        return result.rows[0];
    }

    /**
     * Mark all as read
     */
    static async markAllAsRead(userId) {
        const query = `
            UPDATE notifications
            SET is_read = true
            WHERE user_id = $1 AND is_read = false
            RETURNING COUNT(*) as count
        `;

        const result = await pool.query(query, [userId]);
        return parseInt(result.rows[0].count);
    }

    /**
     * Get unread count
     */
    static async getUnreadCount(userId) {
        const query = `
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = $1 AND is_read = false
        `;

        const result = await pool.query(query, [userId]);
        return parseInt(result.rows[0].count);
    }

    /**
     * Delete notification
     */
    static async delete(notificationId, userId) {
        const query = `
            DELETE FROM notifications
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [notificationId, userId]);
        return result.rows[0];
    }

    /**
     * Delete all notifications
     */
    static async deleteAll(userId) {
        const query = `
            DELETE FROM notifications
            WHERE user_id = $1
            RETURNING COUNT(*) as count
        `;

        const result = await pool.query(query, [userId]);
        return parseInt(result.rows[0].count);
    }

    /**
     * Notification types helper
     */
    static TYPES = {
        NEW_VIDEO: 'new_video',
        NEW_COMMENT: 'new_comment',
        NEW_REPLY: 'new_reply',
        NEW_LIKE: 'new_like',
        NEW_SUBSCRIBER: 'new_subscriber',
        VIDEO_PROCESSED: 'video_processed',
        SYSTEM: 'system'
    };
}

module.exports = Notification;