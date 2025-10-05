const { pool } = require('../config/database');

class Video {
    /**
     * Create a new video entry
     */
    static async create({ channelId, title, description, categoryId = null, tags = [] }) {
        const query = `
            INSERT INTO videos (channel_id, title, description, category_id, tags)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const values = [channelId, title, description, categoryId, tags];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get video by ID with full details
     */
    static async getById(videoId, userId = null) {
        const query = `
            SELECT
                v.*,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.username as uploader,
                cat.name as category_name,
                (SELECT COUNT(*) FROM comments WHERE video_id = v.id) as comment_count,
                (SELECT AVG(rating) FROM film_ratings WHERE film_id = v.id) as average_rating,
                (SELECT COUNT(*) FROM film_ratings WHERE film_id = v.id) as rating_count,
                ${userId ? `(SELECT rating FROM film_ratings WHERE film_id = v.id AND user_id = $2) as user_rating,` : ''}
                ${userId ? `(SELECT true FROM view_history WHERE video_id = v.id AND user_id = $2 LIMIT 1) as watched` : 'false as watched'}
            FROM videos v
            LEFT JOIN channels c ON v.channel_id = c.id
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN categories cat ON v.category_id = cat.id
            WHERE v.id = $1
        `;
        const values = userId ? [videoId, userId] : [videoId];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Search and filter videos
     */
    static async search({
        query = '',
        categoryId = null,
        tags = [],
        sortBy = 'created_at',
        order = 'DESC',
        limit = 20,
        offset = 0,
        userId = null
    }) {
        let sql = `
            SELECT
                v.*,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.username as uploader,
                cat.name as category_name,
                (SELECT AVG(rating) FROM film_ratings WHERE film_id = v.id) as average_rating,
                (SELECT COUNT(*) FROM film_ratings WHERE film_id = v.id) as rating_count
            FROM videos v
            LEFT JOIN channels c ON v.channel_id = c.id
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN categories cat ON v.category_id = cat.id
            WHERE v.is_private = false
        `;

        const values = [];
        let paramCount = 1;

        // Text search
        if (query) {
            sql += ` AND (
                to_tsvector('english', v.title) @@ plainto_tsquery('english', $${paramCount})
                OR v.title ILIKE $${paramCount + 1}
                OR v.description ILIKE $${paramCount + 1}
            )`;
            values.push(query, `%${query}%`);
            paramCount += 2;
        }

        // Category filter
        if (categoryId) {
            sql += ` AND v.category_id = $${paramCount}`;
            values.push(categoryId);
            paramCount++;
        }

        // Tags filter
        if (tags.length > 0) {
            sql += ` AND v.tags && $${paramCount}`;
            values.push(tags);
            paramCount++;
        }

        // Sorting
        const allowedSorts = ['created_at', 'view_count', 'like_count', 'title'];
        const sortField = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        sql += ` ORDER BY v.${sortField} ${sortOrder}`;

        // Pagination
        sql += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);

        const result = await pool.query(sql, values);
        return result.rows;
    }

    /**
     * Get trending videos
     */
    static async getTrending({ limit = 20, timeframe = '7 days' } = {}) {
        const query = `
            SELECT
                v.*,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.username as uploader,
                (SELECT COUNT(*) FROM view_history WHERE video_id = v.id AND created_at > NOW() - INTERVAL '${timeframe}') as recent_views,
                (SELECT AVG(rating) FROM film_ratings WHERE film_id = v.id) as average_rating
            FROM videos v
            LEFT JOIN channels c ON v.channel_id = c.id
            LEFT JOIN users u ON c.user_id = u.id
            WHERE v.is_private = false
            AND v.created_at > NOW() - INTERVAL '30 days'
            ORDER BY recent_views DESC, v.view_count DESC
            LIMIT $1
        `;
        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    /**
     * Get recommended videos for a user
     */
    static async getRecommended(userId, { limit = 20 } = {}) {
        const query = `
            WITH user_preferences AS (
                SELECT DISTINCT category_id, tags
                FROM videos v
                JOIN view_history vh ON v.id = vh.video_id
                WHERE vh.user_id = $1
            )
            SELECT DISTINCT
                v.*,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                (SELECT AVG(rating) FROM film_ratings WHERE film_id = v.id) as average_rating
            FROM videos v
            LEFT JOIN channels c ON v.channel_id = c.id
            WHERE v.is_private = false
            AND v.id NOT IN (SELECT video_id FROM view_history WHERE user_id = $1)
            AND (
                v.category_id IN (SELECT category_id FROM user_preferences)
                OR v.tags && (SELECT array_agg(DISTINCT unnest) FROM user_preferences, unnest(tags))
            )
            ORDER BY v.view_count DESC, v.created_at DESC
            LIMIT $2
        `;
        const result = await pool.query(query, [userId, limit]);
        return result.rows;
    }

    /**
     * Update video details
     */
    static async update(videoId, updates) {
        const allowedFields = ['title', 'description', 'category_id', 'tags', 'thumbnail_url',
                               'is_private', 'is_unlisted', 'upload_status'];

        const setFields = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setFields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (setFields.length === 0) {
            throw new Error('No valid fields to update');
        }

        setFields.push(`updated_at = NOW()`);
        values.push(videoId);

        const query = `
            UPDATE videos
            SET ${setFields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Increment view count
     */
    static async incrementViewCount(videoId, userId = null, sessionId = null) {
        // Add to view history
        if (userId || sessionId) {
            await pool.query(`
                INSERT INTO view_history (video_id, user_id, session_id, ip_address)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            `, [videoId, userId, sessionId, null]);
        }

        // Increment view count
        const query = `
            UPDATE videos
            SET view_count = view_count + 1
            WHERE id = $1
            RETURNING view_count
        `;
        const result = await pool.query(query, [videoId]);
        return result.rows[0];
    }

    /**
     * Delete video
     */
    static async delete(videoId, userId) {
        const query = `
            DELETE FROM videos v
            USING channels c
            WHERE v.id = $1 AND v.channel_id = c.id AND c.user_id = $2
            RETURNING v.id
        `;
        const result = await pool.query(query, [videoId, userId]);
        return result.rows[0];
    }

    /**
     * Get user's uploaded videos
     */
    static async getUserVideos(userId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT v.*,
                c.name as channel_name,
                (SELECT AVG(rating) FROM film_ratings WHERE film_id = v.id) as average_rating,
                (SELECT COUNT(*) FROM film_ratings WHERE film_id = v.id) as rating_count
            FROM videos v
            JOIN channels c ON v.channel_id = c.id
            WHERE c.user_id = $1
            ORDER BY v.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    /**
     * Get video statistics
     */
    static async getStats(videoId) {
        const query = `
            SELECT
                v.view_count,
                v.like_count,
                v.dislike_count,
                v.comment_count,
                (SELECT AVG(rating) FROM film_ratings WHERE film_id = v.id) as average_rating,
                (SELECT COUNT(*) FROM film_ratings WHERE film_id = v.id) as rating_count,
                (SELECT COUNT(*) FROM view_history WHERE video_id = v.id AND created_at > NOW() - INTERVAL '24 hours') as views_24h,
                (SELECT COUNT(*) FROM view_history WHERE video_id = v.id AND created_at > NOW() - INTERVAL '7 days') as views_7d
            FROM videos v
            WHERE v.id = $1
        `;
        const result = await pool.query(query, [videoId]);
        return result.rows[0];
    }
}

module.exports = Video;