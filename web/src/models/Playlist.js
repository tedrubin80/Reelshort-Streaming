const { pool } = require('../config/database');

class Playlist {
    /**
     * Create a new playlist
     */
    static async create({ userId, title, description = null, isPrivate = false }) {
        const query = `
            INSERT INTO playlists (user_id, title, description, is_private)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const result = await pool.query(query, [userId, title, description, isPrivate]);
        return result.rows[0];
    }

    /**
     * Get playlist by ID
     */
    static async getById(playlistId, viewerUserId = null) {
        const query = `
            SELECT
                p.*,
                u.username,
                u.display_name,
                u.avatar_url as creator_avatar,
                (SELECT COUNT(*) FROM playlist_videos WHERE playlist_id = p.id) as video_count
            FROM playlists p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = $1
            AND (p.is_private = false OR p.user_id = $2)
        `;

        const result = await pool.query(query, [playlistId, viewerUserId]);
        return result.rows[0];
    }

    /**
     * Get playlist videos
     */
    static async getVideos(playlistId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                pv.*,
                v.id as video_id,
                v.title,
                v.thumbnail_url,
                v.duration,
                v.view_count,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.username as uploader
            FROM playlist_videos pv
            JOIN videos v ON pv.video_id = v.id
            JOIN channels c ON v.channel_id = c.id
            JOIN users u ON c.user_id = u.id
            WHERE pv.playlist_id = $1
            ORDER BY pv.position ASC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [playlistId, limit, offset]);
        return result.rows;
    }

    /**
     * Add video to playlist
     */
    static async addVideo(playlistId, videoId, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Verify playlist ownership
            const ownerCheck = await client.query(
                'SELECT user_id FROM playlists WHERE id = $1',
                [playlistId]
            );

            if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== userId) {
                throw new Error('Playlist not found or access denied');
            }

            // Get next position
            const posResult = await client.query(
                'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM playlist_videos WHERE playlist_id = $1',
                [playlistId]
            );

            const position = posResult.rows[0].next_position;

            // Add video
            const addQuery = `
                INSERT INTO playlist_videos (playlist_id, video_id, position)
                VALUES ($1, $2, $3)
                ON CONFLICT (playlist_id, video_id) DO NOTHING
                RETURNING *
            `;

            const result = await client.query(addQuery, [playlistId, videoId, position]);

            // Update playlist video count
            await client.query(
                'UPDATE playlists SET video_count = video_count + 1, updated_at = NOW() WHERE id = $1',
                [playlistId]
            );

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Remove video from playlist
     */
    static async removeVideo(playlistId, videoId, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Verify playlist ownership
            const ownerCheck = await client.query(
                'SELECT user_id FROM playlists WHERE id = $1',
                [playlistId]
            );

            if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== userId) {
                throw new Error('Playlist not found or access denied');
            }

            // Remove video
            const deleteQuery = `
                DELETE FROM playlist_videos
                WHERE playlist_id = $1 AND video_id = $2
                RETURNING *
            `;

            const result = await client.query(deleteQuery, [playlistId, videoId]);

            if (result.rows.length > 0) {
                // Update playlist video count
                await client.query(
                    'UPDATE playlists SET video_count = GREATEST(video_count - 1, 0), updated_at = NOW() WHERE id = $1',
                    [playlistId]
                );
            }

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update playlist
     */
    static async update(playlistId, userId, updates) {
        const allowedFields = ['title', 'description', 'is_private'];
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

        setFields.push('updated_at = NOW()');
        values.push(playlistId, userId);

        const query = `
            UPDATE playlists
            SET ${setFields.join(', ')}
            WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Delete playlist
     */
    static async delete(playlistId, userId) {
        const query = `
            DELETE FROM playlists
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [playlistId, userId]);
        return result.rows[0];
    }

    /**
     * Reorder videos in playlist
     */
    static async reorderVideos(playlistId, userId, videoOrders) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Verify playlist ownership
            const ownerCheck = await client.query(
                'SELECT user_id FROM playlists WHERE id = $1',
                [playlistId]
            );

            if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== userId) {
                throw new Error('Playlist not found or access denied');
            }

            // Update positions
            for (const { videoId, position } of videoOrders) {
                await client.query(
                    'UPDATE playlist_videos SET position = $1 WHERE playlist_id = $2 AND video_id = $3',
                    [position, playlistId, videoId]
                );
            }

            // Update playlist timestamp
            await client.query(
                'UPDATE playlists SET updated_at = NOW() WHERE id = $1',
                [playlistId]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get user's playlists
     */
    static async getUserPlaylists(userId, viewerUserId = null) {
        const query = `
            SELECT
                p.*,
                (SELECT COUNT(*) FROM playlist_videos WHERE playlist_id = p.id) as video_count,
                (SELECT thumbnail_url FROM videos v JOIN playlist_videos pv ON v.id = pv.video_id WHERE pv.playlist_id = p.id ORDER BY pv.position LIMIT 1) as first_video_thumbnail
            FROM playlists p
            WHERE p.user_id = $1
            AND (p.is_private = false OR p.user_id = $2)
            ORDER BY p.updated_at DESC
        `;

        const result = await pool.query(query, [userId, viewerUserId || userId]);
        return result.rows;
    }

    /**
     * Check if video is in playlist
     */
    static async hasVideo(playlistId, videoId) {
        const query = `
            SELECT EXISTS(
                SELECT 1 FROM playlist_videos
                WHERE playlist_id = $1 AND video_id = $2
            ) as has_video
        `;

        const result = await pool.query(query, [playlistId, videoId]);
        return result.rows[0].has_video;
    }
}

module.exports = Playlist;