const express = require('express');
const router = express.Router();
const Playlist = require('../models/Playlist');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

// Create playlist
router.post('/', authenticateToken, [
    body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Title must be 1-255 characters'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('isPrivate').optional().isBoolean().withMessage('isPrivate must be a boolean')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { title, description, isPrivate } = req.body;
        const userId = req.user.id;

        const playlist = await Playlist.create({
            userId,
            title,
            description,
            isPrivate: isPrivate || false
        });

        res.status(201).json({
            success: true,
            message: 'Playlist created successfully',
            playlist
        });
    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({ success: false, message: 'Failed to create playlist' });
    }
});

// Get playlist by ID
router.get('/:playlistId', optionalAuth, [
    param('playlistId').isUUID().withMessage('Valid playlist ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { playlistId } = req.params;
        const playlist = await Playlist.getById(playlistId, req.user?.id);

        if (!playlist) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found or private'
            });
        }

        res.json({
            success: true,
            playlist
        });
    } catch (error) {
        console.error('Get playlist error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch playlist' });
    }
});

// Get playlist videos
router.get('/:playlistId/videos', [
    param('playlistId').isUUID().withMessage('Valid playlist ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { playlistId } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        const videos = await Playlist.getVideos(playlistId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            videos,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: videos.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get playlist videos error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch playlist videos' });
    }
});

// Add video to playlist
router.post('/:playlistId/videos', authenticateToken, [
    param('playlistId').isUUID().withMessage('Valid playlist ID required'),
    body('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { playlistId } = req.params;
        const { videoId } = req.body;
        const userId = req.user.id;

        const result = await Playlist.addVideo(playlistId, videoId, userId);

        res.json({
            success: true,
            message: 'Video added to playlist',
            result
        });
    } catch (error) {
        console.error('Add video to playlist error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to add video to playlist' });
    }
});

// Remove video from playlist
router.delete('/:playlistId/videos/:videoId', authenticateToken, [
    param('playlistId').isUUID().withMessage('Valid playlist ID required'),
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { playlistId, videoId } = req.params;
        const userId = req.user.id;

        await Playlist.removeVideo(playlistId, videoId, userId);

        res.json({
            success: true,
            message: 'Video removed from playlist'
        });
    } catch (error) {
        console.error('Remove video from playlist error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to remove video from playlist' });
    }
});

// Update playlist
router.put('/:playlistId', authenticateToken, [
    param('playlistId').isUUID().withMessage('Valid playlist ID required'),
    body('title').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Title must be 1-255 characters'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('is_private').optional().isBoolean().withMessage('is_private must be a boolean')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { playlistId } = req.params;
        const updates = {};

        if (req.body.title !== undefined) updates.title = req.body.title;
        if (req.body.description !== undefined) updates.description = req.body.description;
        if (req.body.is_private !== undefined) updates.is_private = req.body.is_private;

        const playlist = await Playlist.update(playlistId, req.user.id, updates);

        if (!playlist) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found or access denied'
            });
        }

        res.json({
            success: true,
            message: 'Playlist updated successfully',
            playlist
        });
    } catch (error) {
        console.error('Update playlist error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to update playlist' });
    }
});

// Delete playlist
router.delete('/:playlistId', authenticateToken, [
    param('playlistId').isUUID().withMessage('Valid playlist ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { playlistId } = req.params;
        const userId = req.user.id;

        const deleted = await Playlist.delete(playlistId, userId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found or access denied'
            });
        }

        res.json({
            success: true,
            message: 'Playlist deleted successfully'
        });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete playlist' });
    }
});

// Reorder playlist videos
router.put('/:playlistId/reorder', authenticateToken, [
    param('playlistId').isUUID().withMessage('Valid playlist ID required'),
    body('videoOrders').isArray().withMessage('videoOrders must be an array'),
    body('videoOrders.*.videoId').isUUID().withMessage('All video IDs must be valid UUIDs'),
    body('videoOrders.*.position').isInt({ min: 0 }).withMessage('Position must be a non-negative integer')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { playlistId } = req.params;
        const { videoOrders } = req.body;
        const userId = req.user.id;

        await Playlist.reorderVideos(playlistId, userId, videoOrders);

        res.json({
            success: true,
            message: 'Playlist reordered successfully'
        });
    } catch (error) {
        console.error('Reorder playlist error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to reorder playlist' });
    }
});

// Get user's playlists
router.get('/user/:username', optionalAuth, async (req, res) => {
    try {
        const { username } = req.params;

        // Get user ID from username
        const { pool } = require('../config/database');
        const userResult = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = userResult.rows[0].id;
        const playlists = await Playlist.getUserPlaylists(userId, req.user?.id);

        res.json({
            success: true,
            playlists
        });
    } catch (error) {
        console.error('Get user playlists error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user playlists' });
    }
});

module.exports = router;