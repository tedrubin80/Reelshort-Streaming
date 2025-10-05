const { pool } = require('../config/database');

class Search {
    /**
     * Search videos with filters
     */
    static async searchVideos({
        query = '',
        category = null,
        duration = null,
        sortBy = 'relevance',
        uploadedAfter = null,
        limit = 20,
        offset = 0
    } = {}) {
        let sql = `
            SELECT
                v.*,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.username as uploader,
                u.verified,
                COALESCE(AVG(r.rating), 0) as average_rating,
                COUNT(DISTINCT cm.id) as comment_count,
                ts_rank(to_tsvector('english', v.title || ' ' || COALESCE(v.description, '')), plainto_tsquery('english', $1)) as rank
            FROM videos v
            JOIN channels c ON v.channel_id = c.id
            JOIN users u ON c.user_id = u.id
            LEFT JOIN ratings r ON v.id = r.video_id
            LEFT JOIN comments cm ON v.id = cm.video_id
            WHERE v.upload_status = 'completed'
        `;

        const params = [query || ''];
        let paramCount = 1;

        // Full-text search
        if (query && query.trim() !== '') {
            sql += ` AND (
                to_tsvector('english', v.title || ' ' || COALESCE(v.description, '')) @@ plainto_tsquery('english', $1)
                OR v.title ILIKE $${++paramCount}
                OR v.description ILIKE $${paramCount}
            )`;
            params.push(`%${query}%`);
        }

        // Category filter
        if (category) {
            sql += ` AND v.category_id = $${++paramCount}`;
            params.push(category);
        }

        // Duration filter
        if (duration) {
            switch (duration) {
                case 'short': // < 5 minutes
                    sql += ` AND v.duration < 300`;
                    break;
                case 'medium': // 5-20 minutes
                    sql += ` AND v.duration BETWEEN 300 AND 1200`;
                    break;
                case 'long': // > 20 minutes
                    sql += ` AND v.duration > 1200`;
                    break;
            }
        }

        // Upload date filter
        if (uploadedAfter) {
            sql += ` AND v.created_at >= $${++paramCount}`;
            params.push(uploadedAfter);
        }

        sql += ` GROUP BY v.id, c.name, c.avatar_url, u.username, u.verified`;

        // Sorting
        switch (sortBy) {
            case 'relevance':
                if (query && query.trim() !== '') {
                    sql += ` ORDER BY rank DESC, v.view_count DESC`;
                } else {
                    sql += ` ORDER BY v.view_count DESC`;
                }
                break;
            case 'date':
                sql += ` ORDER BY v.created_at DESC`;
                break;
            case 'views':
                sql += ` ORDER BY v.view_count DESC`;
                break;
            case 'rating':
                sql += ` ORDER BY average_rating DESC, v.view_count DESC`;
                break;
            case 'trending':
                // Trending: high views in last 7 days
                sql += ` ORDER BY (CASE WHEN v.created_at > NOW() - INTERVAL '7 days' THEN v.view_count ELSE 0 END) DESC`;
                break;
            default:
                sql += ` ORDER BY v.created_at DESC`;
        }

        sql += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);

        const result = await pool.query(sql, params);
        return result.rows;
    }

    /**
     * Search channels
     */
    static async searchChannels({ query = '', limit = 20, offset = 0 } = {}) {
        const sql = `
            SELECT
                c.*,
                u.username,
                u.display_name,
                u.verified,
                u.subscriber_count,
                COUNT(DISTINCT v.id) as video_count,
                SUM(v.view_count) as total_views,
                ts_rank(to_tsvector('english', c.name || ' ' || COALESCE(c.description, '')), plainto_tsquery('english', $1)) as rank
            FROM channels c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN videos v ON c.id = v.channel_id AND v.upload_status = 'completed'
            WHERE
                to_tsvector('english', c.name || ' ' || COALESCE(c.description, '')) @@ plainto_tsquery('english', $1)
                OR c.name ILIKE $2
                OR c.description ILIKE $2
            GROUP BY c.id, u.username, u.display_name, u.verified, u.subscriber_count
            ORDER BY rank DESC, u.subscriber_count DESC
            LIMIT $3 OFFSET $4
        `;

        const result = await pool.query(sql, [query, `%${query}%`, limit, offset]);
        return result.rows;
    }

    /**
     * Get trending videos
     */
    static async getTrending({ timeframe = '7days', limit = 20, offset = 0 } = {}) {
        const intervals = {
            '24hours': '1 day',
            '7days': '7 days',
            '30days': '30 days'
        };

        const interval = intervals[timeframe] || '7 days';

        const query = `
            SELECT
                v.*,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.username as uploader,
                u.verified,
                COALESCE(AVG(r.rating), 0) as average_rating,
                COUNT(DISTINCT cm.id) as comment_count,
                (v.view_count * 1.0 / GREATEST(EXTRACT(EPOCH FROM (NOW() - v.created_at)) / 3600, 1)) as trend_score
            FROM videos v
            JOIN channels c ON v.channel_id = c.id
            JOIN users u ON c.user_id = u.id
            LEFT JOIN ratings r ON v.id = r.video_id
            LEFT JOIN comments cm ON v.id = cm.video_id
            WHERE v.upload_status = 'completed'
            AND v.created_at > NOW() - INTERVAL '${interval}'
            GROUP BY v.id, c.name, c.avatar_url, u.username, u.verified
            ORDER BY trend_score DESC, v.view_count DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [limit, offset]);
        return result.rows;
    }

    /**
     * Get search suggestions
     */
    static async getSuggestions(query, limit = 10) {
        const sql = `
            (
                SELECT DISTINCT v.title as suggestion, 'video' as type, v.view_count as score
                FROM videos v
                WHERE v.title ILIKE $1 AND v.upload_status = 'completed'
                ORDER BY v.view_count DESC
                LIMIT $2
            )
            UNION ALL
            (
                SELECT DISTINCT c.name as suggestion, 'channel' as type, u.subscriber_count as score
                FROM channels c
                JOIN users u ON c.user_id = u.id
                WHERE c.name ILIKE $1
                ORDER BY u.subscriber_count DESC
                LIMIT $2
            )
            ORDER BY score DESC
            LIMIT $2
        `;

        const result = await pool.query(sql, [`%${query}%`, limit]);
        return result.rows;
    }

    /**
     * Record search query for analytics
     */
    static async recordSearch({ query, userId = null, resultsCount = 0 }) {
        const sql = `
            INSERT INTO search_history (query, user_id, results_count)
            VALUES ($1, $2, $3)
            RETURNING *
        `;

        const result = await pool.query(sql, [query, userId, resultsCount]);
        return result.rows[0];
    }

    /**
     * Get popular searches
     */
    static async getPopularSearches(limit = 10) {
        const query = `
            SELECT
                query,
                COUNT(*) as search_count,
                AVG(results_count) as avg_results
            FROM search_history
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY query
            HAVING COUNT(*) > 1
            ORDER BY search_count DESC
            LIMIT $1
        `;

        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    /**
     * Get categories with video counts
     */
    static async getCategories() {
        const query = `
            SELECT
                cat.id,
                cat.name as category,
                cat.slug,
                COUNT(v.id) as video_count,
                SUM(v.view_count) as total_views
            FROM categories cat
            LEFT JOIN videos v ON cat.id = v.category_id AND v.upload_status = 'completed'
            GROUP BY cat.id, cat.name, cat.slug
            ORDER BY video_count DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    }
}

module.exports = Search;
