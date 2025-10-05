const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const { authenticateToken } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');
const { pool } = require('../config/database');

// Subscribe to a channel
router.post('/', authenticateToken, [
    body('channelId').isUUID().withMessage('Valid channel ID required'),
    body('notificationsEnabled').optional().isBoolean().withMessage('Notifications must be a boolean')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { channelId, notificationsEnabled = true } = req.body;
        const userId = req.user.id;

        // Check if trying to subscribe to own channel
        const channelCheck = await pool.query(
            'SELECT user_id FROM channels WHERE id = $1',
            [channelId]
        );

        if (channelCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Channel not found'
            });
        }

        if (channelCheck.rows[0].user_id === userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot subscribe to your own channel'
            });
        }

        const subscription = await Subscription.subscribe(userId, channelId, notificationsEnabled);

        res.json({
            success: true,
            message: 'Successfully subscribed',
            subscription
        });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ success: false, message: 'Failed to subscribe' });
    }
});

// Unsubscribe from a channel
router.delete('/:channelId', authenticateToken, [
    param('channelId').isUUID().withMessage('Valid channel ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { channelId } = req.params;
        const userId = req.user.id;

        await Subscription.unsubscribe(userId, channelId);

        res.json({
            success: true,
            message: 'Successfully unsubscribed'
        });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ success: false, message: 'Failed to unsubscribe' });
    }
});

// Toggle notifications for subscription
router.put('/:channelId/notifications', authenticateToken, [
    param('channelId').isUUID().withMessage('Valid channel ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { channelId } = req.params;
        const userId = req.user.id;

        const subscription = await Subscription.toggleNotifications(userId, channelId);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        res.json({
            success: true,
            message: `Notifications ${subscription.notifications_enabled ? 'enabled' : 'disabled'}`,
            subscription
        });
    } catch (error) {
        console.error('Toggle notifications error:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle notifications' });
    }
});

// Get subscription status
router.get('/status/:channelId', authenticateToken, [
    param('channelId').isUUID().withMessage('Valid channel ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { channelId } = req.params;
        const userId = req.user.id;

        const subscription = await Subscription.getStatus(userId, channelId);

        res.json({
            success: true,
            is_subscribed: !!subscription,
            subscription: subscription || null
        });
    } catch (error) {
        console.error('Get subscription status error:', error);
        res.status(500).json({ success: false, message: 'Failed to get subscription status' });
    }
});

// Get subscriptions with latest videos
router.get('/feed', authenticateToken, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const userId = req.user.id;

        const subscriptions = await Subscription.getSubscriptionsWithVideos(userId, {
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
        console.error('Get subscriptions feed error:', error);
        res.status(500).json({ success: false, message: 'Failed to get subscriptions feed' });
    }
});

// Get subscription feed (videos from subscribed channels)
router.get('/videos', authenticateToken, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const userId = req.user.id;

        const videos = await Subscription.getFeed(userId, {
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
        console.error('Get subscription videos error:', error);
        res.status(500).json({ success: false, message: 'Failed to get subscription videos' });
    }
});

// Get bulk subscription status
router.post('/status/bulk', authenticateToken, [
    body('channelIds').isArray().withMessage('Channel IDs must be an array'),
    body('channelIds.*').isUUID().withMessage('All channel IDs must be valid UUIDs')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { channelIds } = req.body;
        const userId = req.user.id;

        const statuses = await Subscription.getBulkStatus(userId, channelIds);

        res.json({
            success: true,
            statuses
        });
    } catch (error) {
        console.error('Get bulk subscription status error:', error);
        res.status(500).json({ success: false, message: 'Failed to get subscription statuses' });
    }
});

module.exports = router;