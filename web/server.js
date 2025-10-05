const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
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

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://37.27.220.18",
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
    origin: process.env.CLIENT_URL || "http://37.27.220.18",
    credentials: true
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/waivers', waiverRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/films', filmsRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/ratings', ratingsRoutes);

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
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💾 Processing Drive: ${process.env.PROCESSING_DRIVE || '/mnt/HC_Volume_103339423'}`);
            console.log(`☁️  S3 Endpoint: ${process.env.S3_ENDPOINT || 'Not configured'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, server, io };