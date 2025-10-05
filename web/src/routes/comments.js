const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { authenticateToken } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

// Validation middleware
const validateComment = [
    body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment must be between 1 and 2000 characters'),
    body('videoId').isUUID().withMessage('Valid video ID required'),
    body('parentId').optional().isUUID().withMessage('Parent ID must be a valid UUID')
];

// Get comments for a video
router.get('/video/:videoId', [
    param('videoId').isUUID().withMessage('Valid video ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const comments = await Comment.getByVideoId(videoId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Get user reactions if authenticated
        if (req.user) {
            for (let comment of comments) {
                comment.user_reaction = await Comment.getUserReaction(comment.id, req.user.id);
            }
        }

        res.json({
            success: true,
            comments,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: comments.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch comments' });
    }
});

// Get replies to a comment
router.get('/:commentId/replies', [
    param('commentId').isUUID().withMessage('Valid comment ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { commentId } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        const replies = await Comment.getReplies(commentId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            replies,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: replies.length === parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get replies error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch replies' });
    }
});

// Create a comment
router.post('/', authenticateToken, validateComment, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { videoId, content, parentId } = req.body;
        const userId = req.user.id;

        const comment = await Comment.create({
            videoId,
            userId,
            content,
            parentId
        });

        res.status(201).json({
            success: true,
            message: 'Comment posted successfully',
            comment
        });
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to post comment' });
    }
});

// Update a comment
router.put('/:commentId', authenticateToken, [
    param('commentId').isUUID().withMessage('Valid comment ID required'),
    body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment must be between 1 and 2000 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        const comment = await Comment.update(commentId, userId, content);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found or unauthorized'
            });
        }

        res.json({
            success: true,
            message: 'Comment updated successfully',
            comment
        });
    } catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to update comment' });
    }
});

// Delete a comment
router.delete('/:commentId', authenticateToken, [
    param('commentId').isUUID().withMessage('Valid comment ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { commentId } = req.params;
        const userId = req.user.id;

        const deleted = await Comment.delete(commentId, userId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found or unauthorized'
            });
        }

        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete comment' });
    }
});

// Add reaction to comment
router.post('/:commentId/reaction', authenticateToken, [
    param('commentId').isUUID().withMessage('Valid comment ID required'),
    body('reactionType').isIn(['like', 'dislike']).withMessage('Reaction type must be like or dislike')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { commentId } = req.params;
        const { reactionType } = req.body;
        const userId = req.user.id;

        const reaction = await Comment.addReaction(commentId, userId, reactionType);

        res.json({
            success: true,
            message: 'Reaction added successfully',
            reaction
        });
    } catch (error) {
        console.error('Add reaction error:', error);
        res.status(500).json({ success: false, message: 'Failed to add reaction' });
    }
});

// Remove reaction from comment
router.delete('/:commentId/reaction', authenticateToken, [
    param('commentId').isUUID().withMessage('Valid comment ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { commentId } = req.params;
        const userId = req.user.id;

        await Comment.removeReaction(commentId, userId);

        res.json({
            success: true,
            message: 'Reaction removed successfully'
        });
    } catch (error) {
        console.error('Remove reaction error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove reaction' });
    }
});

module.exports = router;