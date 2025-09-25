const express = require('express');
const { UploadController, upload } = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// All upload routes require authentication
router.use(authenticateToken);

/**
 * @route POST /api/upload/film
 * @desc Upload a film
 * @access Private
 */
router.post('/film', 
    UploadController.checkUploadLimit,
    upload.single('film'),
    UploadController.uploadFilm
);

/**
 * @route GET /api/upload/status/:filmId
 * @desc Get upload/processing status
 * @access Private
 */
router.get('/status/:filmId', UploadController.getUploadStatus);

/**
 * @route DELETE /api/upload/cancel/:filmId
 * @desc Cancel an upload in progress
 * @access Private
 */
router.delete('/cancel/:filmId', UploadController.cancelUpload);

/**
 * @route GET /api/upload/history
 * @desc Get user's upload history
 * @access Private
 */
router.get('/history', UploadController.getUploadHistory);

/**
 * @route GET /api/upload/limits
 * @desc Get user's current upload limits and usage
 * @access Private
 */
router.get('/limits', async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date().toISOString().split('T')[0];
        const limitKey = `upload_limit:${userId}:${today}`;
        
        const { cache } = require('../config/redis');
        const uploadCount = await cache.get(limitKey) || 0;
        
        const remainingUploads = Math.max(0, 1 - uploadCount);
        const nextResetTime = new Date();
        nextResetTime.setDate(nextResetTime.getDate() + 1);
        nextResetTime.setHours(0, 0, 0, 0);
        
        res.json({
            dailyLimit: 1,
            used: uploadCount,
            remaining: remainingUploads,
            nextReset: nextResetTime.toISOString(),
            canUpload: remainingUploads > 0
        });
    } catch (error) {
        console.error('Error getting upload limits:', error);
        res.status(500).json({ error: 'Failed to get upload limits' });
    }
});

/**
 * @route GET /api/upload/queue-status
 * @desc Get transcoding queue status (admin only)
 * @access Private (Admin)
 */
router.get('/queue-status', async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const videoProcessingService = require('../services/videoProcessingService');
        const status = await videoProcessingService.getQueueStatus();
        
        res.json(status);
    } catch (error) {
        console.error('Error getting queue status:', error);
        res.status(500).json({ error: 'Failed to get queue status' });
    }
});

module.exports = router;