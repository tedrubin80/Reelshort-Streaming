const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');
const { cache } = require('../config/redis');
const { validateFilm, sanitizeInput } = require('../utils/validation');
const { getFileDuration, getFileSize } = require('../utils/fileUtils');

// Multer configuration for large file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/temp');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'video/mp4', 'video/avi', 'video/mov', 'video/quicktime',
        'video/x-msvideo', 'video/x-ms-wmv', 'video/x-flv', 'video/x-matroska',
        'application/octet-stream' // Sometimes files are sent with this type
    ];
    
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Only video files are allowed. Received: ${file.mimetype}`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024 * 1024, // 20GB limit
        files: 1
    }
});

class UploadController {
    // Check daily upload limit
    async checkUploadLimit(req, res, next) {
        try {
            const userId = req.user.id;
            const today = new Date().toISOString().split('T')[0];
            const limitKey = `upload_limit:${userId}:${today}`;
            
            const uploadCount = await cache.get(limitKey) || 0;
            
            if (uploadCount >= 1) {
                return res.status(429).json({
                    error: 'Daily upload limit reached',
                    message: 'You can only upload one film per day. Try again tomorrow.',
                    nextUploadTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                });
            }
            
            req.uploadLimitKey = limitKey;
            next();
        } catch (error) {
            console.error('Error checking upload limit:', error);
            res.status(500).json({ error: 'Failed to check upload limit' });
        }
    }

    // Handle file upload
    async uploadFilm(req, res) {
        try {
            const { title, description, category_id, tags, cast, crew, production_year } = req.body;
            const userId = req.user.id;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Validate form data
            const validation = validateFilm({
                title: sanitizeInput(title),
                description: sanitizeInput(description),
                category_id,
                tags: tags ? tags.split(',').map(tag => sanitizeInput(tag.trim())) : [],
                cast: sanitizeInput(cast),
                crew: sanitizeInput(crew),
                production_year: parseInt(production_year)
            });

            if (!validation.isValid) {
                await fs.unlink(file.path); // Clean up uploaded file
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: validation.errors 
                });
            }

            // Get file information
            const fileSize = await getFileSize(file.path);
            const duration = await getFileDuration(file.path);

            // Check duration limit (30 minutes = 1800 seconds)
            if (duration > 1800) {
                await fs.unlink(file.path);
                return res.status(400).json({
                    error: 'Film too long',
                    message: 'Films must be 30 minutes or shorter',
                    duration: Math.round(duration / 60) + ' minutes'
                });
            }

            // Get user's channel
            const channelResult = await query(
                'SELECT id FROM channels WHERE user_id = $1 AND is_active = true LIMIT 1',
                [userId]
            );

            if (channelResult.rows.length === 0) {
                await fs.unlink(file.path);
                return res.status(400).json({
                    error: 'No active channel found',
                    message: 'Please create a channel before uploading films'
                });
            }

            const channelId = channelResult.rows[0].id;

            // Create database entry
            const filmId = uuidv4();
            const streamKey = uuidv4();

            await transaction(async (client) => {
                // Insert film record
                await client.query(`
                    INSERT INTO videos (
                        id, channel_id, category_id, title, description, tags,
                        duration, file_size, upload_status, stream_key,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                `, [
                    filmId, channelId, category_id, validation.data.title,
                    validation.data.description, validation.data.tags,
                    Math.round(duration), fileSize, 'processing', streamKey
                ]);

                // Add metadata if provided
                if (cast || crew || production_year) {
                    await client.query(`
                        INSERT INTO film_metadata (film_id, cast_info, crew_info, production_year)
                        VALUES ($1, $2, $3, $4)
                    `, [filmId, cast, crew, production_year]);
                }
            });

            // Add to new video processing queue
            const videoProcessingService = require('../services/videoProcessingService');
            await videoProcessingService.queueVideo(filmId, file.path, userId);

            // Update upload limit
            const newCount = await cache.incr(req.uploadLimitKey);
            await cache.expire(req.uploadLimitKey, 86400); // 24 hours

            // Send response
            res.status(201).json({
                success: true,
                filmId,
                message: 'Film uploaded successfully and added to processing queue',
                estimatedProcessingTime: Math.round(duration * 4), // 1:4 ratio
                status: 'processing'
            });

            // Notify user via WebSocket
            req.io.to(`user-${userId}`).emit('upload-status', {
                filmId,
                status: 'processing',
                message: 'Your film is being processed'
            });

        } catch (error) {
            console.error('Upload error:', error);
            
            // Clean up file if it exists
            if (req.file && req.file.path) {
                try {
                    await fs.unlink(req.file.path);
                } catch (unlinkError) {
                    console.error('Failed to cleanup file:', unlinkError);
                }
            }

            res.status(500).json({
                error: 'Upload failed',
                message: 'An error occurred while processing your upload'
            });
        }
    }

    // Get upload status
    async getUploadStatus(req, res) {
        try {
            const { filmId } = req.params;
            const userId = req.user.id;

            const result = await query(`
                SELECT v.*, c.name as channel_name 
                FROM videos v
                JOIN channels c ON v.channel_id = c.id
                WHERE v.id = $1 AND c.user_id = $2
            `, [filmId, userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Film not found' });
            }

            const film = result.rows[0];

            // Get processing progress from Redis if still processing
            let progress = null;
            if (film.upload_status === 'processing') {
                progress = await cache.get(`transcode_progress:${filmId}`);
            }

            res.json({
                filmId: film.id,
                title: film.title,
                status: film.upload_status,
                progress: progress || null,
                duration: film.duration,
                createdAt: film.created_at,
                ...(film.upload_status === 'ready' && {
                    thumbnail_url: film.thumbnail_url,
                    video_qualities: film.video_quality
                })
            });

        } catch (error) {
            console.error('Get upload status error:', error);
            res.status(500).json({ error: 'Failed to get upload status' });
        }
    }

    // Cancel upload (if still processing)
    async cancelUpload(req, res) {
        try {
            const { filmId } = req.params;
            const userId = req.user.id;

            const result = await query(`
                SELECT v.*, c.user_id 
                FROM videos v
                JOIN channels c ON v.channel_id = c.id
                WHERE v.id = $1 AND c.user_id = $2 AND v.upload_status = 'processing'
            `, [filmId, userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Film not found or cannot be cancelled' 
                });
            }

            // Mark as cancelled in database
            await query(
                'UPDATE videos SET upload_status = $1, updated_at = NOW() WHERE id = $2',
                ['cancelled', filmId]
            );

            // Remove from processing queue (mark as cancelled)
            await cache.set(`transcode_cancelled:${filmId}`, true, 3600);

            // Reset daily upload limit
            const today = new Date().toISOString().split('T')[0];
            const limitKey = `upload_limit:${userId}:${today}`;
            await cache.del(limitKey);

            res.json({
                success: true,
                message: 'Upload cancelled successfully'
            });

        } catch (error) {
            console.error('Cancel upload error:', error);
            res.status(500).json({ error: 'Failed to cancel upload' });
        }
    }

    // Get user's upload history
    async getUploadHistory(req, res) {
        try {
            const userId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const result = await query(`
                SELECT v.*, c.name as channel_name,
                       cat.name as category_name
                FROM videos v
                JOIN channels c ON v.channel_id = c.id
                LEFT JOIN categories cat ON v.category_id = cat.id
                WHERE c.user_id = $1
                ORDER BY v.created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]);

            const countResult = await query(`
                SELECT COUNT(*) as total
                FROM videos v
                JOIN channels c ON v.channel_id = c.id
                WHERE c.user_id = $1
            `, [userId]);

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            res.json({
                films: result.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });

        } catch (error) {
            console.error('Get upload history error:', error);
            res.status(500).json({ error: 'Failed to get upload history' });
        }
    }
}

module.exports = {
    UploadController: new UploadController(),
    upload
};