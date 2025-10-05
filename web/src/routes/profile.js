const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { param, body, validationResult } = require('express-validator');

// Get profile by username
router.get('/:username', optionalAuth, [
    param('username').isLength({ min: 3, max: 50 }).withMessage('Valid username required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { username } = req.params;
        const profile = await Profile.getByUsername(username);

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if viewer is subscribed (if logged in)
        if (req.user && profile.id !== req.user.id) {
            const channel = await pool.query(
                'SELECT id FROM channels WHERE user_id = $1 LIMIT 1',
                [profile.id]
            );
            if (channel.rows.length > 0) {
                profile.is_subscribed = await Profile.isSubscribed(req.user.id, channel.rows[0].id);
            }
        }

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
});

// Get current user's profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const profile = await Profile.getById(req.user.id);

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Get current profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
});

// Update profile
router.put('/me', authenticateToken, [
    body('display_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Display name must be 1-100 characters'),
    body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const updates = {};
        if (req.body.display_name !== undefined) updates.display_name = req.body.display_name;
        if (req.body.bio !== undefined) updates.bio = req.body.bio;

        const profile = await Profile.update(req.user.id, updates);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            profile
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

// Upload avatar
router.post('/me/avatar', authenticateToken, async (req, res) => {
    const upload = Profile.avatarUpload();

    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        try {
            // Get old avatar
            const oldProfile = await Profile.getById(req.user.id);

            // Update avatar URL
            const avatarUrl = `/uploads/avatars/${req.file.filename}`;
            const profile = await Profile.update(req.user.id, { avatar_url: avatarUrl });

            // Delete old avatar
            if (oldProfile.avatar_url) {
                await Profile.deleteAvatar(oldProfile.avatar_url);
            }

            res.json({
                success: true,
                message: 'Avatar uploaded successfully',
                avatar_url: avatarUrl,
                profile
            });
        } catch (error) {
            console.error('Upload avatar error:', error);
            res.status(500).json({ success: false, message: 'Failed to upload avatar' });
        }
    });
});

// Get user's videos
router.get('/:username/videos', [
    param('username').isLength({ min: 3, max: 50 }).withMessage('Valid username required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { username } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        const profile = await Profile.getByUsername(username);
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const videos = await Profile.getUserVideos(profile.id, {
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
        console.error('Get user videos error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch videos' });
    }
});

// Get user's playlists
router.get('/:username/playlists', optionalAuth, [
    param('username').isLength({ min: 3, max: 50 }).withMessage('Valid username required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { username } = req.params;
        const profile = await Profile.getByUsername(username);

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const playlists = await Profile.getUserPlaylists(profile.id, req.user?.id);

        res.json({
            success: true,
            playlists
        });
    } catch (error) {
        console.error('Get user playlists error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch playlists' });
    }
});

// Get user's subscribers
router.get('/:username/subscribers', [
    param('username').isLength({ min: 3, max: 50 }).withMessage('Valid username required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { username } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        const profile = await Profile.getByUsername(username);
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const subscribers = await Profile.getSubscribers(profile.id, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            subscribers,
            total: profile.subscriber_count,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: subscribers.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get subscribers error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch subscribers' });
    }
});

// Get user's subscriptions
router.get('/me/subscriptions', authenticateToken, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const subscriptions = await Profile.getSubscriptions(req.user.id, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            subscriptions,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: subscriptions.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch subscriptions' });
    }
});

module.exports = router;