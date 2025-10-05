const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

class Profile {
    /**
     * Get user profile by ID
     */
    static async getById(userId) {
        const query = `
            SELECT
                u.id,
                u.username,
                u.display_name,
                u.avatar_url,
                u.bio,
                u.verified,
                u.subscriber_count,
                u.total_views,
                u.created_at,
                (SELECT COUNT(*) FROM videos v JOIN channels c ON v.channel_id = c.id WHERE c.user_id = u.id) as video_count,
                (SELECT COUNT(*) FROM playlists WHERE user_id = u.id AND is_private = false) as playlist_count
            FROM users u
            WHERE u.id = $1
        `;
        const result = await pool.query(query, [userId]);
        return result.rows[0];
    }

    /**
     * Get user profile by username
     */
    static async getByUsername(username) {
        const query = `
            SELECT
                u.id,
                u.username,
                u.display_name,
                u.avatar_url,
                u.bio,
                u.verified,
                u.subscriber_count,
                u.total_views,
                u.created_at,
                (SELECT COUNT(*) FROM videos v JOIN channels c ON v.channel_id = c.id WHERE c.user_id = u.id) as video_count,
                (SELECT COUNT(*) FROM playlists WHERE user_id = u.id AND is_private = false) as playlist_count
            FROM users u
            WHERE u.username = $1
        `;
        const result = await pool.query(query, [username]);
        return result.rows[0];
    }

    /**
     * Update user profile
     */
    static async update(userId, updates) {
        const allowedFields = ['display_name', 'bio', 'avatar_url'];
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
        values.push(userId);

        const query = `
            UPDATE users
            SET ${setFields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, username, display_name, avatar_url, bio, verified, subscriber_count, total_views
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get user's uploaded videos
     */
    static async getUserVideos(userId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                v.*,
                c.name as channel_name,
                (SELECT AVG(rating) FROM film_ratings WHERE film_id = v.id) as average_rating,
                (SELECT COUNT(*) FROM film_ratings WHERE film_id = v.id) as rating_count
            FROM videos v
            JOIN channels c ON v.channel_id = c.id
            WHERE c.user_id = $1 AND v.is_private = false
            ORDER BY v.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    /**
     * Get user's playlists
     */
    static async getUserPlaylists(userId, viewerUserId = null) {
        const query = `
            SELECT
                p.*,
                u.username,
                u.display_name,
                (SELECT COUNT(*) FROM playlist_videos WHERE playlist_id = p.id) as video_count
            FROM playlists p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = $1
            AND (p.is_private = false OR p.user_id = $2)
            ORDER BY p.created_at DESC
        `;
        const result = await pool.query(query, [userId, viewerUserId || userId]);
        return result.rows;
    }

    /**
     * Check if user is subscribed to channel
     */
    static async isSubscribed(subscriberId, channelId) {
        const query = `
            SELECT EXISTS(
                SELECT 1 FROM subscriptions
                WHERE subscriber_id = $1 AND channel_id = $2
            ) as is_subscribed
        `;
        const result = await pool.query(query, [subscriberId, channelId]);
        return result.rows[0].is_subscribed;
    }

    /**
     * Get user's subscribers
     */
    static async getSubscribers(userId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                u.id,
                u.username,
                u.display_name,
                u.avatar_url,
                s.created_at as subscribed_at
            FROM subscriptions s
            JOIN users u ON s.subscriber_id = u.id
            JOIN channels c ON s.channel_id = c.id
            WHERE c.user_id = $1
            ORDER BY s.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    /**
     * Get user's subscriptions
     */
    static async getSubscriptions(userId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                c.id as channel_id,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.id as user_id,
                u.username,
                u.display_name,
                s.notifications_enabled,
                s.created_at as subscribed_at
            FROM subscriptions s
            JOIN channels c ON s.channel_id = c.id
            JOIN users u ON c.user_id = u.id
            WHERE s.subscriber_id = $1
            ORDER BY s.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    /**
     * Upload avatar
     */
    static avatarUpload() {
        const storage = multer.diskStorage({
            destination: async (req, file, cb) => {
                const uploadDir = path.join(__dirname, '../../uploads/avatars');
                await fs.mkdir(uploadDir, { recursive: true });
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, `avatar-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
            }
        });

        return multer({
            storage,
            limits: {
                fileSize: 5 * 1024 * 1024 // 5MB
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = /jpeg|jpg|png|gif|webp/;
                const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
                const mimetype = allowedTypes.test(file.mimetype);

                if (mimetype && extname) {
                    return cb(null, true);
                } else {
                    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
                }
            }
        }).single('avatar');
    }

    /**
     * Delete old avatar
     */
    static async deleteAvatar(avatarUrl) {
        if (avatarUrl && avatarUrl.includes('/uploads/avatars/')) {
            const filePath = path.join(__dirname, '../../', avatarUrl);
            try {
                await fs.unlink(filePath);
            } catch (error) {
                console.error('Error deleting avatar:', error);
            }
        }
    }
}

module.exports = Profile;