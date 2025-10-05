const { pool } = require('../config/database');

class Share {
    /**
     * Record a share
     */
    static async create({ videoId, userId = null, shareType, platform = null }) {
        const query = `
            INSERT INTO video_shares (video_id, user_id, share_type, platform)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(query, [videoId, userId, shareType, platform]);

            // Update video share count
            await client.query(
                'UPDATE videos SET share_count = share_count + 1 WHERE id = $1',
                [videoId]
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
     * Get share statistics for a video
     */
    static async getVideoStats(videoId) {
        const query = `
            SELECT
                COUNT(*) as total_shares,
                COUNT(DISTINCT user_id) as unique_users,
                share_type,
                platform,
                COUNT(*) as count
            FROM video_shares
            WHERE video_id = $1
            GROUP BY share_type, platform
        `;

        const result = await pool.query(query, [videoId]);

        const stats = {
            total_shares: 0,
            unique_users: 0,
            by_type: {},
            by_platform: {}
        };

        result.rows.forEach(row => {
            if (row.total_shares) stats.total_shares = parseInt(row.total_shares);
            if (row.unique_users) stats.unique_users = parseInt(row.unique_users);

            if (row.share_type) {
                stats.by_type[row.share_type] = (stats.by_type[row.share_type] || 0) + parseInt(row.count);
            }
            if (row.platform) {
                stats.by_platform[row.platform] = (stats.by_platform[row.platform] || 0) + parseInt(row.count);
            }
        });

        return stats;
    }

    /**
     * Get user's share history
     */
    static async getUserShares(userId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                vs.*,
                v.id as video_id,
                v.title,
                v.thumbnail_url,
                v.duration,
                c.name as channel_name,
                u.username as uploader
            FROM video_shares vs
            JOIN videos v ON vs.video_id = v.id
            JOIN channels c ON v.channel_id = c.id
            JOIN users u ON c.user_id = u.id
            WHERE vs.user_id = $1
            ORDER BY vs.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    /**
     * Generate share URL
     */
    static generateShareUrl(videoId, baseUrl = process.env.CLIENT_URL) {
        return `${baseUrl}/watch/${videoId}`;
    }

    /**
     * Generate embed code
     */
    static generateEmbedCode(videoId, { width = 640, height = 360, autoplay = false } = {}) {
        const baseUrl = process.env.CLIENT_URL;
        const autoplayParam = autoplay ? '?autoplay=1' : '';

        return `<iframe width="${width}" height="${height}" src="${baseUrl}/embed/${videoId}${autoplayParam}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }

    /**
     * Share types
     */
    static SHARE_TYPES = {
        LINK: 'link',
        EMBED: 'embed',
        SOCIAL: 'social',
        EMAIL: 'email'
    };

    /**
     * Platforms
     */
    static PLATFORMS = {
        FACEBOOK: 'facebook',
        TWITTER: 'twitter',
        REDDIT: 'reddit',
        WHATSAPP: 'whatsapp',
        TELEGRAM: 'telegram',
        LINKEDIN: 'linkedin',
        EMAIL: 'email'
    };
}

module.exports = Share;
