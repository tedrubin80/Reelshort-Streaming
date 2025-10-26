const pool = require('../config/database');
const { cache } = require('../config/redis');

/**
 * Advanced Recommendation Engine for ReelShorts
 * Combines collaborative filtering, content-based filtering, and trending algorithms
 */

class RecommendationEngine {
    constructor() {
        this.CACHE_TTL = 3600; // 1 hour cache
        this.TRENDING_WINDOW_HOURS = 48;
        this.MIN_INTERACTIONS_FOR_CF = 5; // Minimum interactions needed for collaborative filtering
    }

    /**
     * Get personalized recommendations for a user
     * Uses multiple strategies and combines them
     */
    async getPersonalizedRecommendations(userId, limit = 20) {
        try {
            const cacheKey = `recommendations:user:${userId}`;
            const cached = await cache.get(cacheKey);

            if (cached) {
                return JSON.parse(cached);
            }

            // Get user's interaction history
            const userHistory = await this.getUserInteractionHistory(userId);

            let recommendations = [];

            if (userHistory.length >= this.MIN_INTERACTIONS_FOR_CF) {
                // User has enough history - use collaborative filtering
                const cfRecommendations = await this.collaborativeFiltering(userId, limit);
                const cbRecommendations = await this.contentBasedFiltering(userId, userHistory, limit);
                const trendingRecommendations = await this.getTrendingVideos(limit / 2);

                // Combine strategies with weights
                recommendations = this.combineRecommendations([
                    { videos: cfRecommendations, weight: 0.5 },
                    { videos: cbRecommendations, weight: 0.3 },
                    { videos: trendingRecommendations, weight: 0.2 }
                ], limit);
            } else {
                // New user - use content popularity and trending
                const popularVideos = await this.getPopularVideos(limit);
                const trendingVideos = await this.getTrendingVideos(limit);

                recommendations = this.combineRecommendations([
                    { videos: popularVideos, weight: 0.6 },
                    { videos: trendingVideos, weight: 0.4 }
                ], limit);
            }

            // Cache results
            await cache.set(cacheKey, JSON.stringify(recommendations), this.CACHE_TTL);

            return recommendations;
        } catch (error) {
            console.error('Error generating personalized recommendations:', error);
            // Fallback to popular videos
            return await this.getPopularVideos(limit);
        }
    }

    /**
     * Collaborative Filtering
     * Find similar users and recommend what they watched
     */
    async collaborativeFiltering(userId, limit = 20) {
        try {
            // Find users with similar viewing patterns using Jaccard similarity
            const similarUsers = await pool.query(
                `WITH user_videos AS (
                    SELECT DISTINCT video_id
                    FROM view_history
                    WHERE user_id = $1
                ),
                other_user_videos AS (
                    SELECT DISTINCT user_id, video_id
                    FROM view_history
                    WHERE user_id != $1
                ),
                similarity_scores AS (
                    SELECT
                        ouv.user_id,
                        COUNT(DISTINCT CASE WHEN uv.video_id IS NOT NULL THEN ouv.video_id END)::FLOAT /
                        NULLIF(
                            COUNT(DISTINCT ouv.video_id) +
                            (SELECT COUNT(*) FROM user_videos) -
                            COUNT(DISTINCT CASE WHEN uv.video_id IS NOT NULL THEN ouv.video_id END),
                            0
                        ) as similarity
                    FROM other_user_videos ouv
                    LEFT JOIN user_videos uv ON ouv.video_id = uv.video_id
                    GROUP BY ouv.user_id
                    HAVING COUNT(DISTINCT CASE WHEN uv.video_id IS NOT NULL THEN ouv.video_id END) > 0
                )
                SELECT
                    v.*,
                    AVG(ss.similarity) as relevance_score
                FROM similarity_scores ss
                JOIN view_history vh ON ss.user_id = vh.user_id
                JOIN videos v ON vh.video_id = v.id
                WHERE v.id NOT IN (SELECT video_id FROM user_videos)
                    AND v.moderation_status = 'approved'
                    AND v.upload_status = 'completed'
                    AND ss.similarity > 0.2
                GROUP BY v.id
                ORDER BY relevance_score DESC, v.view_count DESC
                LIMIT $2`,
                [userId, limit]
            );

            return similarUsers.rows;
        } catch (error) {
            console.error('Error in collaborative filtering:', error);
            return [];
        }
    }

    /**
     * Content-Based Filtering
     * Recommend videos similar to what user has watched
     */
    async contentBasedFiltering(userId, userHistory, limit = 20) {
        try {
            // Get user's preferred categories and tags
            const preferences = await pool.query(
                `SELECT
                    v.category_id,
                    UNNEST(v.tags) as tag,
                    COUNT(*) as frequency
                FROM view_history vh
                JOIN videos v ON vh.video_id = v.id
                WHERE vh.user_id = $1
                GROUP BY v.category_id, tag
                ORDER BY frequency DESC
                LIMIT 10`,
                [userId]
            );

            if (preferences.rows.length === 0) {
                return [];
            }

            // Get categories and tags the user likes
            const preferredCategories = preferences.rows
                .filter(p => p.category_id)
                .map(p => p.category_id);
            const preferredTags = preferences.rows
                .filter(p => p.tag)
                .map(p => p.tag);

            // Find videos matching user preferences
            const recommendations = await pool.query(
                `SELECT
                    v.*,
                    (
                        CASE WHEN v.category_id = ANY($1::uuid[]) THEN 5 ELSE 0 END +
                        COALESCE(array_length(ARRAY(SELECT unnest(v.tags) INTERSECT SELECT unnest($2::text[])), 1), 0) * 2
                    ) as relevance_score
                FROM videos v
                WHERE v.id NOT IN (
                    SELECT video_id FROM view_history WHERE user_id = $3
                )
                AND v.moderation_status = 'approved'
                AND v.upload_status = 'completed'
                AND (
                    v.category_id = ANY($1::uuid[])
                    OR v.tags && $2::text[]
                )
                ORDER BY relevance_score DESC, v.view_count DESC
                LIMIT $4`,
                [preferredCategories, preferredTags, userId, limit]
            );

            return recommendations.rows;
        } catch (error) {
            console.error('Error in content-based filtering:', error);
            return [];
        }
    }

    /**
     * Get trending videos based on recent engagement
     */
    async getTrendingVideos(limit = 20) {
        try {
            const cacheKey = 'recommendations:trending';
            const cached = await cache.get(cacheKey);

            if (cached) {
                return JSON.parse(cached);
            }

            // Calculate trending score based on recent views, likes, and comments
            const trending = await pool.query(
                `SELECT
                    v.*,
                    (
                        COALESCE(recent_views.view_count, 0) * 1.0 +
                        COALESCE(recent_likes.like_count, 0) * 3.0 +
                        COALESCE(recent_comments.comment_count, 0) * 2.0
                    ) / GREATEST(
                        EXTRACT(EPOCH FROM (NOW() - v.created_at)) / 3600,
                        1
                    ) as trending_score
                FROM videos v
                LEFT JOIN (
                    SELECT video_id, COUNT(*) as view_count
                    FROM view_history
                    WHERE created_at > NOW() - INTERVAL '${this.TRENDING_WINDOW_HOURS} hours'
                    GROUP BY video_id
                ) recent_views ON v.id = recent_views.video_id
                LEFT JOIN (
                    SELECT video_id, COUNT(*) as like_count
                    FROM video_reactions
                    WHERE reaction_type = 'like'
                        AND created_at > NOW() - INTERVAL '${this.TRENDING_WINDOW_HOURS} hours'
                    GROUP BY video_id
                ) recent_likes ON v.id = recent_likes.video_id
                LEFT JOIN (
                    SELECT video_id, COUNT(*) as comment_count
                    FROM comments
                    WHERE created_at > NOW() - INTERVAL '${this.TRENDING_WINDOW_HOURS} hours'
                    GROUP BY video_id
                ) recent_comments ON v.id = recent_comments.video_id
                WHERE v.moderation_status = 'approved'
                    AND v.upload_status = 'completed'
                    AND v.created_at > NOW() - INTERVAL '30 days'
                ORDER BY trending_score DESC
                LIMIT $1`,
                [limit]
            );

            await cache.set(cacheKey, JSON.stringify(trending.rows), 600); // Cache for 10 minutes

            return trending.rows;
        } catch (error) {
            console.error('Error getting trending videos:', error);
            return [];
        }
    }

    /**
     * Get popular videos (all-time best performers)
     */
    async getPopularVideos(limit = 20) {
        try {
            const cacheKey = 'recommendations:popular';
            const cached = await cache.get(cacheKey);

            if (cached) {
                return JSON.parse(cached);
            }

            const popular = await pool.query(
                `SELECT v.*,
                    (v.view_count * 1.0 + v.like_count * 5.0 + v.comment_count * 3.0) as popularity_score
                FROM videos v
                WHERE v.moderation_status = 'approved'
                    AND v.upload_status = 'completed'
                ORDER BY popularity_score DESC, v.created_at DESC
                LIMIT $1`,
                [limit]
            );

            await cache.set(cacheKey, JSON.stringify(popular.rows), 1800); // Cache for 30 minutes

            return popular.rows;
        } catch (error) {
            console.error('Error getting popular videos:', error);
            return [];
        }
    }

    /**
     * Get recommendations based on a specific video (watch next)
     */
    async getRelatedVideos(videoId, limit = 10) {
        try {
            const cacheKey = `recommendations:related:${videoId}`;
            const cached = await cache.get(cacheKey);

            if (cached) {
                return JSON.parse(cached);
            }

            // Get video details
            const videoResult = await pool.query(
                'SELECT category_id, tags, channel_id FROM videos WHERE id = $1',
                [videoId]
            );

            if (videoResult.rows.length === 0) {
                return [];
            }

            const video = videoResult.rows[0];

            // Find similar videos by category, tags, and channel
            const related = await pool.query(
                `SELECT v.*,
                    (
                        CASE WHEN v.category_id = $2 THEN 10 ELSE 0 END +
                        CASE WHEN v.channel_id = $3 THEN 5 ELSE 0 END +
                        COALESCE(array_length(ARRAY(SELECT unnest(v.tags) INTERSECT SELECT unnest($4::text[])), 1), 0) * 3
                    ) as similarity_score
                FROM videos v
                WHERE v.id != $1
                    AND v.moderation_status = 'approved'
                    AND v.upload_status = 'completed'
                    AND (
                        v.category_id = $2
                        OR v.channel_id = $3
                        OR v.tags && $4::text[]
                    )
                ORDER BY similarity_score DESC, v.view_count DESC
                LIMIT $5`,
                [videoId, video.category_id, video.channel_id, video.tags || [], limit]
            );

            await cache.set(cacheKey, JSON.stringify(related.rows), this.CACHE_TTL);

            return related.rows;
        } catch (error) {
            console.error('Error getting related videos:', error);
            return [];
        }
    }

    /**
     * Get user's interaction history
     */
    async getUserInteractionHistory(userId) {
        try {
            const history = await pool.query(
                `SELECT DISTINCT video_id
                FROM view_history
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 100`,
                [userId]
            );

            return history.rows.map(row => row.video_id);
        } catch (error) {
            console.error('Error getting user history:', error);
            return [];
        }
    }

    /**
     * Combine recommendations from multiple strategies
     */
    combineRecommendations(strategies, limit) {
        const videoScores = new Map();

        // Calculate weighted scores for each video
        strategies.forEach(({ videos, weight }) => {
            videos.forEach((video, index) => {
                const positionScore = (videos.length - index) / videos.length;
                const score = positionScore * weight;

                if (videoScores.has(video.id)) {
                    videoScores.set(video.id, {
                        ...video,
                        score: videoScores.get(video.id).score + score
                    });
                } else {
                    videoScores.set(video.id, { ...video, score });
                }
            });
        });

        // Sort by combined score and return top N
        return Array.from(videoScores.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Clear cache for a specific user (call when user performs new actions)
     */
    async clearUserCache(userId) {
        const cacheKey = `recommendations:user:${userId}`;
        await cache.del(cacheKey);
    }

    /**
     * Clear all recommendation caches (call periodically or when content changes significantly)
     */
    async clearAllCaches() {
        await cache.del('recommendations:trending');
        await cache.del('recommendations:popular');
        // Note: User-specific caches will expire naturally
    }
}

module.exports = new RecommendationEngine();
