const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bunnyService = require('../services/bunnyService');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/cdn/video/:videoId/stream
 * Get streaming URL for a video (uses Bunny.net if available, falls back to S3)
 */
router.get('/video/:videoId/stream', async (req, res) => {
    try {
        const { videoId } = req.params;

        // Get video info from database
        const videoResult = await pool.query(
            `SELECT id, title, bunny_video_id, bunny_hls_url, bunny_thumbnail_url,
                    cdn_enabled, bunny_status, hls_url
             FROM videos WHERE id = $1`,
            [videoId]
        );

        if (videoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = videoResult.rows[0];

        // If Bunny.net is enabled and video is ready
        if (video.cdn_enabled && video.bunny_video_id && video.bunny_status === 'ready') {
            return res.json({
                success: true,
                stream_url: video.bunny_hls_url || bunnyService.getHlsUrl(video.bunny_video_id),
                thumbnail_url: video.bunny_thumbnail_url || bunnyService.getThumbnailUrl(video.bunny_video_id),
                cdn_provider: 'bunny',
                format: 'hls',
                adaptive: true
            });
        }

        // Fallback to S3/local storage
        if (video.hls_url) {
            return res.json({
                success: true,
                stream_url: video.hls_url,
                thumbnail_url: video.thumbnail_url,
                cdn_provider: 's3',
                format: 'hls',
                adaptive: false
            });
        }

        // No streaming URL available
        return res.status(503).json({
            error: 'Video not ready for streaming',
            status: video.bunny_status || 'processing'
        });

    } catch (error) {
        console.error('Error getting stream URL:', error);
        res.status(500).json({ error: 'Failed to get stream URL' });
    }
});

/**
 * POST /api/cdn/video/:videoId/upload-to-bunny
 * Upload an existing video to Bunny.net CDN (creator only)
 */
router.post('/video/:videoId/upload-to-bunny', authenticateToken, async (req, res) => {
    try {
        const { videoId } = req.params;
        const userId = req.user.id;

        if (!bunnyService.isEnabled()) {
            return res.status(503).json({ error: 'Bunny.net CDN is not enabled' });
        }

        // Verify ownership
        const videoResult = await pool.query(
            `SELECT v.id, v.title, v.file_path, v.bunny_video_id, c.user_id
             FROM videos v
             JOIN channels c ON v.channel_id = c.id
             WHERE v.id = $1`,
            [videoId]
        );

        if (videoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = videoResult.rows[0];

        if (video.user_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if already uploaded to Bunny
        if (video.bunny_video_id) {
            return res.status(400).json({
                error: 'Video already uploaded to Bunny.net',
                bunny_video_id: video.bunny_video_id
            });
        }

        // Update status to uploading
        await pool.query(
            'UPDATE videos SET bunny_status = $1 WHERE id = $2',
            ['uploading', videoId]
        );

        // Create video in Bunny.net
        const bunnyVideo = await bunnyService.createVideo(video.title);

        // Upload video file
        await bunnyService.uploadVideo(bunnyVideo.guid, video.file_path);

        // Get playback URLs
        const playbackUrls = bunnyService.getPlaybackUrls(bunnyVideo.guid);

        // Update database with Bunny.net info
        await pool.query(
            `UPDATE videos
             SET bunny_video_id = $1,
                 bunny_hls_url = $2,
                 bunny_thumbnail_url = $3,
                 bunny_status = $4,
                 cdn_enabled = true
             WHERE id = $5`,
            [
                bunnyVideo.guid,
                playbackUrls.hls,
                playbackUrls.thumbnail,
                'processing', // Bunny.net will encode the video
                videoId
            ]
        );

        res.json({
            success: true,
            message: 'Video uploaded to Bunny.net successfully',
            bunny_video_id: bunnyVideo.guid,
            playback_urls: playbackUrls,
            status: 'processing'
        });

    } catch (error) {
        console.error('Error uploading to Bunny.net:', error);

        // Update status to error
        await pool.query(
            'UPDATE videos SET bunny_status = $1 WHERE id = $2',
            ['error', req.params.videoId]
        );

        res.status(500).json({ error: 'Failed to upload to Bunny.net' });
    }
});

/**
 * GET /api/cdn/video/:videoId/bunny-status
 * Check Bunny.net encoding status
 */
router.get('/video/:videoId/bunny-status', authenticateToken, async (req, res) => {
    try {
        const { videoId } = req.params;

        const videoResult = await pool.query(
            'SELECT bunny_video_id, bunny_status FROM videos WHERE id = $1',
            [videoId]
        );

        if (videoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = videoResult.rows[0];

        if (!video.bunny_video_id) {
            return res.json({ status: 'not_uploaded' });
        }

        // Get status from Bunny.net
        const encodingStatus = await bunnyService.getEncodingStatus(video.bunny_video_id);

        // Update database if status changed
        if (encodingStatus.status === 3 && video.bunny_status !== 'ready') {
            await pool.query(
                'UPDATE videos SET bunny_status = $1 WHERE id = $2',
                ['ready', videoId]
            );
        }

        res.json({
            success: true,
            bunny_video_id: video.bunny_video_id,
            status: encodingStatus.status,
            progress: encodingStatus.progress,
            available_resolutions: encodingStatus.availableResolutions,
            duration: encodingStatus.duration
        });

    } catch (error) {
        console.error('Error checking Bunny status:', error);
        res.status(500).json({ error: 'Failed to check encoding status' });
    }
});

/**
 * GET /api/cdn/stats
 * Get CDN usage statistics (admin only)
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const userResult = await pool.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows[0]?.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const stats = await pool.query(
            `SELECT
                COUNT(*) as total_videos,
                COUNT(*) FILTER (WHERE cdn_enabled = true) as cdn_enabled_count,
                COUNT(*) FILTER (WHERE bunny_status = 'ready') as ready_count,
                COUNT(*) FILTER (WHERE bunny_status = 'processing') as processing_count,
                COUNT(*) FILTER (WHERE bunny_status = 'error') as error_count
             FROM videos`
        );

        res.json({
            success: true,
            cdn_provider: 'bunny.net',
            cdn_enabled: bunnyService.isEnabled(),
            stats: stats.rows[0]
        });

    } catch (error) {
        console.error('Error getting CDN stats:', error);
        res.status(500).json({ error: 'Failed to get CDN stats' });
    }
});

module.exports = router;
