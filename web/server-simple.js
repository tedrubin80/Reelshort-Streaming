const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
app.use(cors({
    origin: '*',
    credentials: true
}));

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes (only existing ones)
const uploadRoutes = require('./src/routes/upload');
const waiverRoutes = require('./src/routes/waivers');

app.use('/api/upload', uploadRoutes);
app.use('/api/waivers', waiverRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        server: 'Southerns Short Films'
    });
});

// API info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Southerns Short Films API',
        version: '1.0.0',
        endpoints: [
            '/api/health',
            '/api/upload',
            '/api/waivers'
        ]
    });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 Southerns Short Films server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`🌐 Web interface available at http://localhost:${PORT}`);
});