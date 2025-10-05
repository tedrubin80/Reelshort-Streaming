const { pool } = require('../config/database');

class Rating {
    /**
     * Create or update a rating
     */
    static async upsert({ videoId, userId, rating, review = null }) {
        const query = `
            INSERT INTO film_ratings (film_id, user_id, rating, review)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (film_id, user_id)
            DO UPDATE SET
                rating = $3,
                review = $4,
                updated_at = NOW()
            RETURNING *
        `;
        const values = [videoId, userId, rating, review];
        const result = await pool.query(query, values);

        // Update video statistics
        await this.updateVideoStats(videoId);

        return result.rows[0];
    }

    /**
     * Get rating for a video by a specific user
     */
    static async getUserRating(videoId, userId) {
        const query = `
            SELECT * FROM film_ratings
            WHERE film_id = $1 AND user_id = $2
        `;
        const result = await pool.query(query, [videoId, userId]);
        return result.rows[0];
    }

    /**
     * Get ratings for a video with pagination
     */
    static async getByVideoId(videoId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                fr.*,
                u.username,
                u.avatar_url
            FROM film_ratings fr
            LEFT JOIN users u ON fr.user_id = u.id
            WHERE fr.film_id = $1 AND fr.review IS NOT NULL
            ORDER BY fr.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [videoId, limit, offset]);
        return result.rows;
    }

    /**
     * Get rating statistics for a video
     */
    static async getStats(videoId) {
        const query = `
            SELECT
                COUNT(*) as total_ratings,
                ROUND(AVG(rating)::numeric, 2) as average_rating,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
            FROM film_ratings
            WHERE film_id = $1
        `;
        const result = await pool.query(query, [videoId]);
        return result.rows[0];
    }

    /**
     * Update video rating statistics
     */
    static async updateVideoStats(videoId) {
        const query = `
            UPDATE videos
            SET like_count = (
                SELECT COUNT(*) FROM film_ratings WHERE film_id = $1
            )
            WHERE id = $1
        `;
        await pool.query(query, [videoId]);
    }

    /**
     * Delete a rating
     */
    static async delete(videoId, userId) {
        const query = `
            DELETE FROM film_ratings
            WHERE film_id = $1 AND user_id = $2
            RETURNING id
        `;
        const result = await pool.query(query, [videoId, userId]);

        // Update video statistics
        await this.updateVideoStats(videoId);

        return result.rows[0];
    }

    /**
     * Get user's ratings
     */
    static async getUserRatings(userId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                fr.*,
                v.title,
                v.thumbnail_url,
                v.duration
            FROM film_ratings fr
            LEFT JOIN videos v ON fr.film_id = v.id
            WHERE fr.user_id = $1
            ORDER BY fr.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }
}

module.exports = Rating;