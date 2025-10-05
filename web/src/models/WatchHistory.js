const { pool } = require('../config/database');

class WatchHistory {
    /**
     * Record video watch
     */
    static async record(videoId, userId, watchData = {}) {
        const {
            watchDuration = 0,
            completed = false,
            sessionId = null
        } = watchData;

        const query = `
            INSERT INTO view_history (video_id, user_id, watch_duration, completed, session_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (video_id, user_id)
            DO UPDATE SET
                watch_duration = GREATEST(view_history.watch_duration, $3),
                completed = view_history.completed OR $4,
                updated_at = NOW()
            RETURNING *
        `;

        const result = await pool.query(query, [videoId, userId, watchDuration, completed, sessionId]);
        return result.rows[0];
    }

    /**
     * Get user's watch history
     */
    static async getHistory(userId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                vh.*,
                v.id as video_id,
                v.title,
                v.thumbnail_url,
                v.duration,
                v.view_count,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.username as uploader,
                ROUND((vh.watch_duration::float / NULLIF(v.duration, 0)) * 100, 2) as progress_percent
            FROM view_history vh
            JOIN videos v ON vh.video_id = v.id
            JOIN channels c ON v.channel_id = c.id
            JOIN users u ON c.user_id = u.id
            WHERE vh.user_id = $1
            ORDER BY vh.updated_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    /**
     * Get continue watching (videos not completed)
     */
    static async getContinueWatching(userId, { limit = 10 } = {}) {
        const query = `
            SELECT
                vh.*,
                v.id as video_id,
                v.title,
                v.thumbnail_url,
                v.duration,
                v.view_count,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.username as uploader,
                ROUND((vh.watch_duration::float / NULLIF(v.duration, 0)) * 100, 2) as progress_percent
            FROM view_history vh
            JOIN videos v ON vh.video_id = v.id
            JOIN channels c ON v.channel_id = c.id
            JOIN users u ON c.user_id = u.id
            WHERE vh.user_id = $1
            AND vh.completed = false
            AND vh.watch_duration > 30
            AND vh.watch_duration < (v.duration - 30)
            ORDER BY vh.updated_at DESC
            LIMIT $2
        `;

        const result = await pool.query(query, [userId, limit]);
        return result.rows;
    }

    /**
     * Get watch progress for specific video
     */
    static async getProgress(videoId, userId) {
        const query = `
            SELECT
                vh.*,
                ROUND((vh.watch_duration::float / NULLIF(v.duration, 0)) * 100, 2) as progress_percent
            FROM view_history vh
            JOIN videos v ON vh.video_id = v.id
            WHERE vh.video_id = $1 AND vh.user_id = $2
        `;

        const result = await pool.query(query, [videoId, userId]);
        return result.rows[0];
    }

    /**
     * Mark video as completed
     */
    static async markCompleted(videoId, userId) {
        const query = `
            UPDATE view_history
            SET completed = true, updated_at = NOW()
            WHERE video_id = $1 AND user_id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [videoId, userId]);
        return result.rows[0];
    }

    /**
     * Clear watch history
     */
    static async clearHistory(userId, videoId = null) {
        let query, values;

        if (videoId) {
            // Delete specific video from history
            query = `
                DELETE FROM view_history
                WHERE user_id = $1 AND video_id = $2
                RETURNING *
            `;
            values = [userId, videoId];
        } else {
            // Clear all history
            query = `
                DELETE FROM view_history
                WHERE user_id = $1
                RETURNING COUNT(*) as deleted_count
            `;
            values = [userId];
        }

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get watch statistics
     */
    static async getStats(userId) {
        const query = `
            SELECT
                COUNT(*) as total_watched,
                COUNT(*) FILTER (WHERE completed = true) as completed_count,
                SUM(watch_duration) as total_watch_time,
                AVG(watch_duration) as average_watch_time,
                COUNT(DISTINCT DATE(created_at)) as days_active
            FROM view_history
            WHERE user_id = $1
        `;

        const result = await pool.query(query, [userId]);
        return result.rows[0];
    }

    /**
     * Get recently watched videos by category
     */
    static async getByCategory(userId, categoryId, { limit = 10 } = {}) {
        const query = `
            SELECT
                vh.*,
                v.id as video_id,
                v.title,
                v.thumbnail_url,
                c.name as channel_name
            FROM view_history vh
            JOIN videos v ON vh.video_id = v.id
            JOIN channels c ON v.channel_id = c.id
            WHERE vh.user_id = $1 AND v.category_id = $2
            ORDER BY vh.updated_at DESC
            LIMIT $3
        `;

        const result = await pool.query(query, [userId, categoryId, limit]);
        return result.rows;
    }

    /**
     * Check if video has been watched
     */
    static async hasWatched(videoId, userId) {
        const query = `
            SELECT EXISTS(
                SELECT 1 FROM view_history
                WHERE video_id = $1 AND user_id = $2
            ) as has_watched
        `;

        const result = await pool.query(query, [videoId, userId]);
        return result.rows[0].has_watched;
    }
}

module.exports = WatchHistory;