const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { param, validationResult } = require('express-validator');

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { limit = 20, offset = 0, unreadOnly = false } = req.query;
        const userId = req.user.id;

        const notifications = await Notification.getByUserId(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset),
            unreadOnly: unreadOnly === 'true'
        });

        res.json({
            success: true,
            notifications,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: notifications.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
});

// Get unread count
router.get('/unread/count', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await Notification.getUnreadCount(userId);

        res.json({
            success: true,
            count
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ success: false, message: 'Failed to get unread count' });
    }
});

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, [
    param('notificationId').isUUID().withMessage('Valid notification ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { notificationId } = req.params;
        const userId = req.user.id;

        const notification = await Notification.markAsRead(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification marked as read',
            notification
        });
    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
});

// Mark all as read
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await Notification.markAllAsRead(userId);

        res.json({
            success: true,
            message: `${count} notifications marked as read`,
            count
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark all as read' });
    }
});

// Delete notification
router.delete('/:notificationId', authenticateToken, [
    param('notificationId').isUUID().withMessage('Valid notification ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { notificationId } = req.params;
        const userId = req.user.id;

        const deleted = await Notification.delete(notificationId, userId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete notification' });
    }
});

// Delete all notifications
router.delete('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await Notification.deleteAll(userId);

        res.json({
            success: true,
            message: `${count} notifications deleted`,
            count
        });
    } catch (error) {
        console.error('Delete all notifications error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete all notifications' });
    }
});

module.exports = router;