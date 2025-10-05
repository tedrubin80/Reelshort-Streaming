const { pool } = require('../config/database');

class Subscription {
    /**
     * Subscribe to a channel
     */
    static async subscribe(subscriberId, channelId, notificationsEnabled = true) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create subscription
            const subQuery = `
                INSERT INTO subscriptions (subscriber_id, channel_id, notifications_enabled)
                VALUES ($1, $2, $3)
                ON CONFLICT (subscriber_id, channel_id) DO NOTHING
                RETURNING *
            `;
            const subResult = await client.query(subQuery, [subscriberId, channelId, notificationsEnabled]);

            // Update subscriber count
            const updateQuery = `
                UPDATE users
                SET subscriber_count = subscriber_count + 1
                WHERE id = (SELECT user_id FROM channels WHERE id = $1)
            `;
            await client.query(updateQuery, [channelId]);

            await client.query('COMMIT');
            return subResult.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Unsubscribe from a channel
     */
    static async unsubscribe(subscriberId, channelId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete subscription
            const deleteQuery = `
                DELETE FROM subscriptions
                WHERE subscriber_id = $1 AND channel_id = $2
                RETURNING *
            `;
            const deleteResult = await client.query(deleteQuery, [subscriberId, channelId]);

            if (deleteResult.rows.length > 0) {
                // Update subscriber count
                const updateQuery = `
                    UPDATE users
                    SET subscriber_count = GREATEST(subscriber_count - 1, 0)
                    WHERE id = (SELECT user_id FROM channels WHERE id = $1)
                `;
                await client.query(updateQuery, [channelId]);
            }

            await client.query('COMMIT');
            return deleteResult.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Toggle notification settings
     */
    static async toggleNotifications(subscriberId, channelId) {
        const query = `
            UPDATE subscriptions
            SET notifications_enabled = NOT notifications_enabled
            WHERE subscriber_id = $1 AND channel_id = $2
            RETURNING *
        `;
        const result = await pool.query(query, [subscriberId, channelId]);
        return result.rows[0];
    }

    /**
     * Get subscription status
     */
    static async getStatus(subscriberId, channelId) {
        const query = `
            SELECT * FROM subscriptions
            WHERE subscriber_id = $1 AND channel_id = $2
        `;
        const result = await pool.query(query, [subscriberId, channelId]);
        return result.rows[0];
    }

    /**
     * Get user's subscriptions with latest videos
     */
    static async getSubscriptionsWithVideos(userId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                s.*,
                c.id as channel_id,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.id as creator_id,
                u.username as creator_username,
                u.display_name as creator_display_name,
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', v.id,
                            'title', v.title,
                            'thumbnail_url', v.thumbnail_url,
                            'view_count', v.view_count,
                            'created_at', v.created_at
                        ) ORDER BY v.created_at DESC
                    )
                    FROM videos v
                    WHERE v.channel_id = c.id AND v.is_private = false
                    LIMIT 5
                ) as recent_videos
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
     * Get subscription feed (videos from subscribed channels)
     */
    static async getFeed(userId, { limit = 20, offset = 0 } = {}) {
        const query = `
            SELECT
                v.*,
                c.name as channel_name,
                c.avatar_url as channel_avatar,
                u.username as uploader,
                (SELECT AVG(rating) FROM film_ratings WHERE film_id = v.id) as average_rating
            FROM videos v
            JOIN channels c ON v.channel_id = c.id
            JOIN users u ON c.user_id = u.id
            WHERE c.id IN (
                SELECT channel_id FROM subscriptions WHERE subscriber_id = $1
            )
            AND v.is_private = false
            ORDER BY v.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    /**
     * Get subscriber count for channel
     */
    static async getSubscriberCount(channelId) {
        const query = `
            SELECT COUNT(*) as count
            FROM subscriptions
            WHERE channel_id = $1
        `;
        const result = await pool.query(query, [channelId]);
        return parseInt(result.rows[0].count);
    }

    /**
     * Get bulk subscription status
     */
    static async getBulkStatus(subscriberId, channelIds) {
        const query = `
            SELECT channel_id, true as is_subscribed
            FROM subscriptions
            WHERE subscriber_id = $1 AND channel_id = ANY($2)
        `;
        const result = await pool.query(query, [subscriberId, channelIds]);
        return result.rows.reduce((acc, row) => {
            acc[row.channel_id] = row.is_subscribed;
            return acc;
        }, {});
    }
}

module.exports = Subscription;