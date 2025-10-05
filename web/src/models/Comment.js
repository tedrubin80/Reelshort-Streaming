const { pool } = require('../config/database');

class Comment {
    /**
     * Create a new comment
     */
    static async create({ videoId, userId, content, parentId = null }) {
        const query = `
            INSERT INTO comments (video_id, user_id, content, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const values = [videoId, userId, content, parentId];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get comments for a video with user information
     */
    static async getByVideoId(videoId, { limit = 50, offset = 0 } = {}) {
        const query = `
            SELECT
                c.*,
                u.username,
                u.avatar_url,
                (SELECT COUNT(*) FROM comment_reactions WHERE comment_id = c.id AND reaction_type = 'like') as like_count,
                (SELECT COUNT(*) FROM comment_reactions WHERE comment_id = c.id AND reaction_type = 'dislike') as dislike_count,
                (SELECT COUNT(*) FROM comments WHERE parent_id = c.id) as reply_count
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.video_id = $1 AND c.parent_id IS NULL
            ORDER BY c.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [videoId, limit, offset]);
        return result.rows;
    }

    /**
     * Get replies to a comment
     */
    static async getReplies(commentId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                c.*,
                u.username,
                u.avatar_url,
                (SELECT COUNT(*) FROM comment_reactions WHERE comment_id = c.id AND reaction_type = 'like') as like_count,
                (SELECT COUNT(*) FROM comment_reactions WHERE comment_id = c.id AND reaction_type = 'dislike') as dislike_count
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.parent_id = $1
            ORDER BY c.created_at ASC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [commentId, limit, offset]);
        return result.rows;
    }

    /**
     * Update a comment
     */
    static async update(commentId, userId, content) {
        const query = `
            UPDATE comments
            SET content = $1, edited = true, edited_at = NOW(), updated_at = NOW()
            WHERE id = $2 AND user_id = $3
            RETURNING *
        `;
        const result = await pool.query(query, [content, commentId, userId]);
        return result.rows[0];
    }

    /**
     * Delete a comment
     */
    static async delete(commentId, userId) {
        const query = `
            DELETE FROM comments
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `;
        const result = await pool.query(query, [commentId, userId]);
        return result.rows[0];
    }

    /**
     * Add reaction to comment
     */
    static async addReaction(commentId, userId, reactionType) {
        const query = `
            INSERT INTO comment_reactions (comment_id, user_id, reaction_type)
            VALUES ($1, $2, $3)
            ON CONFLICT (comment_id, user_id)
            DO UPDATE SET reaction_type = $3, updated_at = NOW()
            RETURNING *
        `;
        const result = await pool.query(query, [commentId, userId, reactionType]);
        return result.rows[0];
    }

    /**
     * Remove reaction from comment
     */
    static async removeReaction(commentId, userId) {
        const query = `
            DELETE FROM comment_reactions
            WHERE comment_id = $1 AND user_id = $2
            RETURNING id
        `;
        const result = await pool.query(query, [commentId, userId]);
        return result.rows[0];
    }

    /**
     * Get comment count for a video
     */
    static async getCount(videoId) {
        const query = `
            SELECT COUNT(*) as count
            FROM comments
            WHERE video_id = $1
        `;
        const result = await pool.query(query, [videoId]);
        return parseInt(result.rows[0].count);
    }

    /**
     * Get user's reaction to a comment
     */
    static async getUserReaction(commentId, userId) {
        const query = `
            SELECT reaction_type
            FROM comment_reactions
            WHERE comment_id = $1 AND user_id = $2
        `;
        const result = await pool.query(query, [commentId, userId]);
        return result.rows[0]?.reaction_type || null;
    }
}

module.exports = Comment;