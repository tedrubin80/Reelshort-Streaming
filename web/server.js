const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');
require('dotenv').config();

const { initializeDatabase } = require('./src/config/database');
const { initializeRedis } = require('./src/config/redis');
const ProgressTracker = require('./src/services/progressTracker');

// Import routes
const authRoutes = require('./src/routes/auth');
const uploadRoutes = require('./src/routes/upload');
const waiverRoutes = require('./src/routes/waivers');
const monitoringRoutes = require('./src/routes/monitoring');
const filmsRoutes = require('./src/routes/films');
const videosRoutes = require('./src/routes/videos');
const commentsRoutes = require('./src/routes/comments');
const ratingsRoutes = require('./src/routes/ratings');
const profileRoutes = require('./src/routes/profile');
const subscriptionsRoutes = require('./src/routes/subscriptions');
const historyRoutes = require('./src/routes/history');
const playlistsRoutes = require('./src/routes/playlists');
const notificationsRoutes = require('./src/routes/notifications');
const shareRoutes = require('./src/routes/share');
const searchRoutes = require('./src/routes/search');
const adminRoutes = require('./src/routes/admin');
const analyticsRoutes = require('./src/routes/analytics');
const recommendationsRoutes = require('./src/routes/recommendations');
const cdnRoutes = require('./src/routes/cdn');

const app = express();
const server = http.createServer(app);
// Validate required environment variables
if (!process.env.CLIENT_URL) {
    console.warn('⚠️  CLIENT_URL not set, defaulting to https://reelshorts.live');
}

const ALLOWED_ORIGINS = [
    process.env.CLIENT_URL,
    'https://reelshorts.live',
    'https://www.reelshorts.live'
].filter(Boolean);

const io = socketIo(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ["GET", "POST"]
    }
});

// Security middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
}));

// HTTP Caching headers for static assets
app.use((req, res, next) => {
    // Static assets - 1 year cache
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // HTML - short cache with revalidation
    else if (req.url.endsWith('.html') || req.url === '/') {
        res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ReelShorts API Documentation',
    customfavIcon: '/static/favicon.ico'
}));

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/walkthrough', express.static(path.join(__dirname, 'walkthrough')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/waivers', waiverRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/films', filmsRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/cdn', cdnRoutes);

// Serve React app
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Initialize progress tracker
let progressTracker;

// Socket.io for real-time features
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join user room for personal notifications
    socket.on('join-user', (userId) => {
        socket.join(`user-${userId}`);
        console.log(`User ${socket.id} joined user room ${userId}`);
    });

    // Join upload progress tracking
    socket.on('join-upload-progress', (filmId) => {
        if (progressTracker) {
            progressTracker.handleUserJoinProgress(socket, filmId);
            console.log(`User ${socket.id} joined upload progress for ${filmId}`);
        }
    });

    // Leave upload progress tracking
    socket.on('leave-upload-progress', (filmId) => {
        if (progressTracker) {
            progressTracker.handleUserLeaveProgress(socket, filmId);
            console.log(`User ${socket.id} left upload progress for ${filmId}`);
        }
    });

    // Join stream room
    socket.on('join-stream', (streamId) => {
        socket.join(`stream-${streamId}`);
        console.log(`User ${socket.id} joined stream ${streamId}`);
        
        // Notify others in the room
        socket.to(`stream-${streamId}`).emit('user-joined', socket.id);
    });

    // Leave stream room
    socket.on('leave-stream', (streamId) => {
        socket.leave(`stream-${streamId}`);
        console.log(`User ${socket.id} left stream ${streamId}`);
        
        // Notify others in the room
        socket.to(`stream-${streamId}`).emit('user-left', socket.id);
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
        const { streamId, message, username } = data;
        
        // Broadcast to all users in the stream room
        io.to(`stream-${streamId}`).emit('chat-message', {
            username,
            message,
            timestamp: new Date().toISOString()
        });
    });

    // Handle live viewer count updates
    socket.on('update-viewer-count', (streamId) => {
        const room = io.sockets.adapter.rooms.get(`stream-${streamId}`);
        const viewerCount = room ? room.size : 0;
        
        io.to(`stream-${streamId}`).emit('viewer-count-updated', viewerCount);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Initialize database and Redis connections
async function startServer() {
    try {
        await initializeDatabase();
        await initializeRedis();
        
        // Initialize progress tracker
        progressTracker = new ProgressTracker(io);
        console.log('📊 Progress tracker initialized');

        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`🎬 ReelShorts Server running on port ${PORT}`);
            console.log(`🌐 Client URL: ${process.env.CLIENT_URL || `http://localhost:${PORT}`}`);
            console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💾 Processing Drive: ${process.env.PROCESSING_DRIVE || '/mnt/HC_Volume_103339423'}`);
            console.log(`☁️  S3 Endpoint: ${process.env.S3_ENDPOINT || 'Not configured'}`);

            // Log CDN status
            if (process.env.USE_CDN === 'true') {
                console.log(`✅ Bunny.net CDN enabled - Library: ${process.env.BUNNY_LIBRARY_ID || 'Not configured'}`);
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, server, io };