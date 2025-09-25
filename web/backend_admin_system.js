// ============================================
// BACKEND ADMIN SYSTEM - CORE FILES
// ============================================

// backend/middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// Rate limiting for admin endpoints
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login rate limiting (stricter)
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: { error: 'Too many login attempts, please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Access denied. Token required.',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.',
        code: 'NOT_ADMIN'
      });
    }

    req.admin = {
      username: decoded.username,
      role: decoded.role,
      loginTime: decoded.loginTime
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token.',
      code: 'INVALID_TOKEN'
    });
  }
};

// Optional admin middleware (doesn't block non-admins)
const optionalAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') {
        req.admin = {
          username: decoded.username,
          role: decoded.role,
          loginTime: decoded.loginTime
        };
      }
    } catch (error) {
      // Silently fail for optional middleware
    }
  }
  
  next();
};

module.exports = {
  requireAdmin,
  optionalAdmin,
  adminRateLimit,
  loginRateLimit
};

// ============================================
// ADMIN AUTHENTICATION ROUTES
// ============================================

// backend/routes/adminAuth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { requireAdmin, loginRateLimit } = require('../middleware/adminAuth');
const router = express.Router();

// Validation rules
const loginValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

// Login endpoint
router.post('/login', loginRateLimit, loginValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid input',
        details: errors.array()
      });
    }

    const { username, password, rememberMe = false } = req.body;

    // Get admin credentials from environment
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      return res.status(500).json({
        error: 'Admin credentials not configured'
      });
    }

    // Verify username
    if (username !== adminUsername) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Verify password
    let passwordValid = false;
    
    // Check if password is hashed (starts with $2a$ or $2b$)
    if (adminPassword.startsWith('$2a$') || adminPassword.startsWith('$2b$')) {
      passwordValid = await bcrypt.compare(password, adminPassword);
    } else {
      // Plain text password (development only)
      passwordValid = password === adminPassword;
    }

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const tokenExpiry = rememberMe ? '30d' : '24h';
    const payload = {
      username: adminUsername,
      role: 'admin',
      loginTime: new Date().toISOString()
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { 
      expiresIn: tokenExpiry 
    });

    // Log successful login
    console.log(`[${new Date().toISOString()}] Admin login: ${username}`);

    res.json({
      success: true,
      token,
      user: {
        username: adminUsername,
        role: 'admin'
      },
      expiresIn: tokenExpiry
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed'
    });
  }
});

// Validate token endpoint
router.get('/validate', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      valid: false,
      error: 'No token provided'
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        valid: false,
        error: 'Not an admin'
      });
    }

    res.json({
      valid: true,
      user: {
        username: decoded.username,
        role: decoded.role,
        loginTime: decoded.loginTime
      }
    });

  } catch (error) {
    res.status(401).json({
      valid: false,
      error: 'Invalid or expired token'
    });
  }
});

// Logout endpoint
router.post('/logout', requireAdmin, (req, res) => {
  console.log(`[${new Date().toISOString()}] Admin logout: ${req.admin.username}`);
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Get current admin info
router.get('/me', requireAdmin, (req, res) => {
  res.json({
    user: req.admin
  });
});

module.exports = router;

// ============================================
// ADMIN DASHBOARD ROUTES
// ============================================

// backend/routes/adminDashboard.js
const express = require('express');
const { requireAdmin } = require('../middleware/adminAuth');
const db = require('../config/database');
const router = express.Router();

// All admin dashboard routes require authentication
router.use(requireAdmin);

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      videos: {
        total: 0,
        ready: 0,
        processing: 0,
        error: 0
      },
      views: {
        total: 0,
        today: 0,
        thisWeek: 0
      },
      storage: {
        totalBytes: 0,
        totalGB: 0
      },
      users: {
        total: 0,
        active: 0
      }
    };

    if (db.connection) {
      // Get video stats
      const videoStats = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
          SUM(view_count) as total_views,
          SUM(file_size) as total_bytes
        FROM videos
      `);

      if (videoStats.length > 0) {
        const video = videoStats[0];
        stats.videos.total = video.total || 0;
        stats.videos.ready = video.ready || 0;
        stats.videos.processing = video.processing || 0;
        stats.videos.error = video.error || 0;
        stats.views.total = video.total_views || 0;
        stats.storage.totalBytes = video.total_bytes || 0;
        stats.storage.totalGB = Math.round((video.total_bytes || 0) / 1024 / 1024 / 1024 * 100) / 100;
      }

      // Get recent views (today)
      const todayViews = await db.query(`
        SELECT COUNT(*) as today_views
        FROM video_views 
        WHERE DATE(created_at) = CURDATE()
      `);

      if (todayViews.length > 0) {
        stats.views.today = todayViews[0].today_views || 0;
      }

      // Get this week views
      const weekViews = await db.query(`
        SELECT COUNT(*) as week_views
        FROM video_views 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `);

      if (weekViews.length > 0) {
        stats.views.thisWeek = weekViews[0].week_views || 0;
      }

      // Get user stats (if users table exists)
      try {
        const userStats = await db.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active
          FROM users
        `);

        if (userStats.length > 0) {
          stats.users.total = userStats[0].total || 0;
          stats.users.active = userStats[0].active || 0;
        }
      } catch (error) {
        // Users table might not exist yet
        console.log('Users table not found, skipping user stats');
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Recent activity
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    let activities = [];

    if (db.connection) {
      // Get recent uploads
      const recentUploads = await db.query(`
        SELECT 
          id,
          title,
          status,
          created_at,
          'upload' as activity_type
        FROM videos 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [limit]);

      activities = recentUploads.map(video => ({
        id: video.id,
        type: 'upload',
        title: `Video uploaded: ${video.title}`,
        status: video.status,
        timestamp: video.created_at,
        metadata: {
          videoId: video.id,
          videoTitle: video.title
        }
      }));
    }

    res.json(activities);
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// System health check
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      storage: 'unknown',
      processing: 'unknown'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  // Check database connection
  try {
    if (db.connection) {
      await db.query('SELECT 1');
      health.services.database = 'healthy';
    } else {
      health.services.database = 'disconnected';
    }
  } catch (error) {
    health.services.database = 'error';
  }

  // Check storage (basic disk space would go here)
  health.services.storage = 'healthy';

  // Check processing queue (if implemented)
  health.services.processing = 'healthy';

  // Overall status
  const serviceStatuses = Object.values(health.services);
  if (serviceStatuses.includes('error')) {
    health.status = 'error';
  } else if (serviceStatuses.includes('warning')) {
    health.status = 'warning';
  }

  res.json(health);
});

module.exports = router;

// ============================================
// ADMIN VIDEO MANAGEMENT ROUTES
// ============================================

// backend/routes/adminVideos.js
const express = require('express');
const { requireAdmin } = require('../middleware/adminAuth');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// All video admin routes require authentication
router.use(requireAdmin);

// Get all videos with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'all';
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    if (!db.connection) {
      return res.json({
        videos: [],
        pagination: { page: 1, limit, total: 0, pages: 0 }
      });
    }

    // Build WHERE clause
    let whereClause = '1=1';
    const params = [];

    if (status !== 'all') {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM videos WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    // Get videos
    const videosQuery = `
      SELECT 
        id, title, description, filename, original_filename,
        file_size, duration, upload_source, status, view_count,
        created_at, updated_at
      FROM videos 
      WHERE ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const videos = await db.query(videosQuery, [...params, limit, offset]);

    // Format response
    const formattedVideos = videos.map(video => ({
      ...video,
      file_size_mb: video.file_size ? Math.round(video.file_size / 1024 / 1024) : 0,
      duration_formatted: video.duration ? formatDuration(video.duration) : null
    }));

    res.json({
      videos: formattedVideos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Admin videos fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get single video details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!db.connection) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videos = await db.query('SELECT * FROM videos WHERE id = ?', [id]);
    
    if (videos.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videos[0];

    // Get additional stats
    const viewsToday = await db.query(`
      SELECT COUNT(*) as views_today
      FROM video_views 
      WHERE video_id = ? AND DATE(created_at) = CURDATE()
    `, [id]);

    res.json({
      ...video,
      stats: {
        views_today: viewsToday[0]?.views_today || 0
      }
    });

  } catch (error) {
    console.error('Admin video fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Update video details
router.put('/:id', [
  body('title').optional().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('status').optional().isIn(['uploading', 'processing', 'ready', 'error'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updates = {};
    
    // Only include provided fields
    ['title', 'description', 'status'].forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    if (!db.connection) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Build update query
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    const result = await db.query(
      `UPDATE videos SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    console.log(`[${new Date().toISOString()}] Admin ${req.admin.username} updated video ${id}`);

    res.json({
      success: true,
      message: 'Video updated successfully'
    });

  } catch (error) {
    console.error('Admin video update error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// Delete video
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!db.connection) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Get video info first
    const videos = await db.query('SELECT * FROM videos WHERE id = ?', [id]);
    
    if (videos.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videos[0];

    // Delete from database
    await db.query('DELETE FROM videos WHERE id = ?', [id]);

    // Delete physical file if it exists
    if (video.filename) {
      try {
        const filePath = path.join(__dirname, '../uploads', video.filename);
        await fs.unlink(filePath);
        console.log(`Deleted file: ${filePath}`);
      } catch (fileError) {
        console.warn(`Could not delete file ${video.filename}:`, fileError.message);
      }
    }

    console.log(`[${new Date().toISOString()}] Admin ${req.admin.username} deleted video ${id} (${video.title})`);

    res.json({
      success: true,
      message: 'Video deleted successfully'
    });

  } catch (error) {
    console.error('Admin video delete error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Bulk operations
router.post('/bulk', [
  body('action').isIn(['delete', 'update_status']),
  body('video_ids').isArray().notEmpty(),
  body('status').optional().isIn(['uploading', 'processing', 'ready', 'error'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { action, video_ids, status } = req.body;

    if (!db.connection) {
      return res.status(500).json({ error: 'Database not available' });
    }

    let result;

    if (action === 'delete') {
      const placeholders = video_ids.map(() => '?').join(',');
      result = await db.query(`DELETE FROM videos WHERE id IN (${placeholders})`, video_ids);
      
      console.log(`[${new Date().toISOString()}] Admin ${req.admin.username} bulk deleted ${result.affectedRows} videos`);
    } 
    else if (action === 'update_status' && status) {
      const placeholders = video_ids.map(() => '?').join(',');
      result = await db.query(
        `UPDATE videos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, 
        [status, ...video_ids]
      );
      
      console.log(`[${new Date().toISOString()}] Admin ${req.admin.username} bulk updated ${result.affectedRows} videos to status: ${status}`);
    }

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      affected_rows: result?.affectedRows || 0
    });

  } catch (error) {
    console.error('Bulk operation error:', error);
    res.status(500).json({ error: 'Bulk operation failed' });
  }
});

// Helper function to format duration
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

module.exports = router;

// ============================================
// UPDATED SERVER.JS INTEGRATION
// ============================================

// backend/server.js - Add these routes
/*
const adminAuthRoutes = require('./routes/adminAuth');
const adminDashboardRoutes = require('./routes/adminDashboard');
const adminVideosRoutes = require('./routes/adminVideos');
const { adminRateLimit } = require('./middleware/adminAuth');

// Admin routes with rate limiting
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminRateLimit, adminDashboardRoutes);
app.use('/api/admin/videos', adminRateLimit, adminVideosRoutes);
*/

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

/*
Add to your .env file:

NODE_ENV=development
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-here

# For production, hash your password with bcrypt:
# ADMIN_PASSWORD=$2b$12$hashedPasswordHere

# Database config (handled by system-config.json)
# AWS config (handled by system-config.json)
# etc.
*/