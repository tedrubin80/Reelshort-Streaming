// package.json - Root package file
{
  "name": "video-platform",
  "version": "1.0.0",
  "description": "YouTube-like video platform",
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "cd backend && npm run dev",
    "client": "cd frontend && npm start",
    "install-all": "npm install && cd backend && npm install && cd ../frontend && npm install"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}

// backend/package.json
{
  "name": "video-platform-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "multer": "^1.4.5-lts.1",
    "aws-sdk": "^2.1474.0",
    "mysql2": "^3.6.5",
    "pg": "^8.11.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.7",
    "uuid": "^9.0.1",
    "joi": "^17.11.0",
    "rate-limit": "^1.0.0",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}

// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const configRoutes = require('./routes/config');
const adminRoutes = require('./routes/admin');
const videoRoutes = require('./routes/videos');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// backend/.env.example
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Admin credentials (change these!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=your-jwt-secret-key-here

# AWS Configuration
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET_NAME=

# Database Configuration (will be set via admin panel)
DB_TYPE=mysql
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=

# Email Configuration (for WeTransfer notifications)
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASSWORD=
WETRANSFER_EMAIL=

# Media Processing Configuration
SRS_SERVER_URL=
SRS_SERVER_PORT=1935
FFMPEG_VPS_HOST=
FFMPEG_VPS_USER=
FFMPEG_VPS_KEY_PATH=

# backend/config/database.js
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.dbType = null;
    this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'system-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.dbType = config.database?.type;
        if (this.dbType) {
          this.connect(config.database);
        }
      }
    } catch (error) {
      console.error('Error loading database config:', error);
    }
  }

  async connect(dbConfig) {
    try {
      if (dbConfig.type === 'mysql') {
        this.connection = await mysql.createConnection({
          host: dbConfig.host,
          port: dbConfig.port || 3306,
          user: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database
        });
        this.dbType = 'mysql';
      } else if (dbConfig.type === 'postgresql') {
        this.connection = new Pool({
          host: dbConfig.host,
          port: dbConfig.port || 5432,
          user: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database
        });
        this.dbType = 'postgresql';
      }
      
      await this.initializeTables();
      console.log(`Connected to ${dbConfig.type} database`);
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  }

  async initializeTables() {
    const createTablesSQL = {
      mysql: `
        CREATE TABLE IF NOT EXISTS videos (
          id VARCHAR(36) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          filename VARCHAR(255) NOT NULL,
          original_filename VARCHAR(255) NOT NULL,
          file_size BIGINT,
          duration INT,
          upload_source ENUM('s3', 'wetransfer', 'direct') NOT NULL,
          s3_key VARCHAR(500),
          wetransfer_id VARCHAR(255),
          status ENUM('uploading', 'processing', 'ready', 'error') DEFAULT 'uploading',
          thumbnail_url VARCHAR(500),
          video_url VARCHAR(500),
          view_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          username VARCHAR(50) UNIQUE,
          email VARCHAR(255) UNIQUE,
          password_hash VARCHAR(255),
          role ENUM('admin', 'user') DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE
        );
      `,
      postgresql: `
        CREATE TABLE IF NOT EXISTS videos (
          id VARCHAR(36) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          filename VARCHAR(255) NOT NULL,
          original_filename VARCHAR(255) NOT NULL,
          file_size BIGINT,
          duration INTEGER,
          upload_source VARCHAR(20) NOT NULL CHECK (upload_source IN ('s3', 'wetransfer', 'direct')),
          s3_key VARCHAR(500),
          wetransfer_id VARCHAR(255),
          status VARCHAR(20) DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'error')),
          thumbnail_url VARCHAR(500),
          video_url VARCHAR(500),
          view_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          username VARCHAR(50) UNIQUE,
          email VARCHAR(255) UNIQUE,
          password_hash VARCHAR(255),
          role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE
        );
      `
    };

    if (this.connection && this.dbType) {
      const sql = createTablesSQL[this.dbType];
      if (this.dbType === 'mysql') {
        await this.connection.execute(sql);
      } else {
        await this.connection.query(sql);
      }
    }
  }

  async query(sql, params = []) {
    if (!this.connection) {
      throw new Error('Database not connected');
    }
    
    if (this.dbType === 'mysql') {
      const [results] = await this.connection.execute(sql, params);
      return results;
    } else {
      const result = await this.connection.query(sql, params);
      return result.rows;
    }
  }

  async disconnect() {
    if (this.connection) {
      if (this.dbType === 'mysql') {
        await this.connection.end();
      } else {
        await this.connection.end();
      }
      this.connection = null;
    }
  }
}

module.exports = new DatabaseManager();

// backend/config/system-config.json (initial config file)
{
  "database": {
    "type": null,
    "host": "",
    "port": null,
    "username": "",
    "password": "",
    "database": ""
  },
  "aws": {
    "accessKeyId": "",
    "secretAccessKey": "",
    "region": "us-east-1",
    "s3BucketName": ""
  },
  "email": {
    "host": "",
    "port": 587,
    "username": "",
    "password": "",
    "wetransferEmail": ""
  },
  "mediaProcessing": {
    "srsServerUrl": "",
    "srsServerPort": 1935,
    "ffmpegVpsHost": "",
    "ffmpegVpsUser": "",
    "ffmpegVpsKeyPath": ""
  },
  "general": {
    "siteName": "Video Platform",
    "maxFileSize": 1073741824,
    "allowedFormats": ["mp4", "avi", "mov", "mkv", "webm"]
  }
}

// backend/routes/config.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const Joi = require('joi');
const router = express.Router();

const configPath = path.join(__dirname, '../config/system-config.json');

// Get current configuration
router.get('/', (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // Remove sensitive data
    const safeConfig = {
      ...config,
      database: {
        ...config.database,
        password: config.database.password ? '****' : ''
      },
      aws: {
        ...config.aws,
        secretAccessKey: config.aws.secretAccessKey ? '****' : ''
      },
      email: {
        ...config.email,
        password: config.email.password ? '****' : ''
      }
    };
    res.json(safeConfig);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

// Update configuration
router.post('/', async (req, res) => {
  const configSchema = Joi.object({
    database: Joi.object({
      type: Joi.string().valid('mysql', 'postgresql').allow(null),
      host: Joi.string().allow(''),
      port: Joi.number().allow(null),
      username: Joi.string().allow(''),
      password: Joi.string().allow(''),
      database: Joi.string().allow('')
    }),
    aws: Joi.object({
      accessKeyId: Joi.string().allow(''),
      secretAccessKey: Joi.string().allow(''),
      region: Joi.string().allow(''),
      s3BucketName: Joi.string().allow('')
    }),
    email: Joi.object({
      host: Joi.string().allow(''),
      port: Joi.number(),
      username: Joi.string().allow(''),
      password: Joi.string().allow(''),
      wetransferEmail: Joi.string().email().allow('')
    }),
    mediaProcessing: Joi.object({
      srsServerUrl: Joi.string().allow(''),
      srsServerPort: Joi.number(),
      ffmpegVpsHost: Joi.string().allow(''),
      ffmpegVpsUser: Joi.string().allow(''),
      ffmpegVpsKeyPath: Joi.string().allow('')
    }),
    general: Joi.object({
      siteName: Joi.string(),
      maxFileSize: Joi.number(),
      allowedFormats: Joi.array().items(Joi.string())
    })
  });

  try {
    const { error, value } = configSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Read current config
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Merge with new config, preserving passwords if not changed
    const newConfig = {
      ...currentConfig,
      ...value
    };

    // Handle password fields (don't overwrite if sent as '****')
    if (value.database?.password === '****') {
      newConfig.database.password = currentConfig.database.password;
    }
    if (value.aws?.secretAccessKey === '****') {
      newConfig.aws.secretAccessKey = currentConfig.aws.secretAccessKey;
    }
    if (value.email?.password === '****') {
      newConfig.email.password = currentConfig.email.password;
    }

    // Write updated config
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

    // Test database connection if database config is provided
    if (newConfig.database?.type && newConfig.database?.host) {
      const db = require('../config/database');
      try {
        await db.connect(newConfig.database);
      } catch (dbError) {
        return res.status(400).json({ 
          error: 'Configuration saved but database connection failed',
          details: dbError.message 
        });
      }
    }

    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

module.exports = router;

// backend/routes/admin.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const router = express.Router();

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin required.' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Admin login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // For now, use environment variables for admin auth
  // Later this can be moved to database
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ 
      token,
      user: { username, role: 'admin' }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Get dashboard stats
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const stats = {
      totalVideos: 0,
      totalViews: 0,
      storageUsed: 0,
      recentUploads: []
    };

    if (db.connection) {
      // Get total videos
      const videoCount = await db.query('SELECT COUNT(*) as count FROM videos');
      stats.totalVideos = videoCount[0]?.count || 0;

      // Get total views
      const viewCount = await db.query('SELECT SUM(view_count) as total FROM videos');
      stats.totalViews = viewCount[0]?.total || 0;

      // Get storage used
      const storageCount = await db.query('SELECT SUM(file_size) as total FROM videos');
      stats.storageUsed = storageCount[0]?.total || 0;

      // Get recent uploads
      const recentVideos = await db.query(
        'SELECT id, title, created_at, status FROM videos ORDER BY created_at DESC LIMIT 5'
      );
      stats.recentUploads = recentVideos;
    }

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get all videos for admin management
router.get('/videos', authenticateAdmin, async (req, res) => {
  try {
    if (!db.connection) {
      return res.json([]);
    }

    const videos = await db.query(`
      SELECT id, title, description, filename, file_size, duration, 
             upload_source, status, view_count, created_at 
      FROM videos 
      ORDER BY created_at DESC
    `);

    res.json(videos);
  } catch (error) {
    console.error('Fetch videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Delete video
router.delete('/videos/:id', authenticateAdmin, async (req, res) => {
  try {
    if (!db.connection) {
      return res.status(400).json({ error: 'Database not configured' });
    }

    const { id } = req.params;
    await db.query('DELETE FROM videos WHERE id = ?', [id]);
    
    // TODO: Also delete from S3 if it's an S3 upload
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

module.exports = router;

// backend/routes/videos.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const router = express.Router();

// Get all videos (public endpoint)
router.get('/', async (req, res) => {
  try {
    if (!db.connection) {
      return res.json([]);
    }

    const videos = await db.query(`
      SELECT id, title, description, thumbnail_url, duration, view_count, created_at 
      FROM videos 
      WHERE status = 'ready' 
      ORDER BY created_at DESC
    `);

    res.json(videos);
  } catch (error) {
    console.error('Fetch videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get single video
router.get('/:id', async (req, res) => {
  try {
    if (!db.connection) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const { id } = req.params;
    const videos = await db.query('SELECT * FROM videos WHERE id = ? AND status = ?', [id, 'ready']);
    
    if (videos.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videos[0];

    // Increment view count
    await db.query('UPDATE videos SET view_count = view_count + 1 WHERE id = ?', [id]);
    video.view_count += 1;

    res.json(video);
  } catch (error) {
    console.error('Fetch video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Search videos
router.get('/search/:query', async (req, res) => {
  try {
    if (!db.connection) {
      return res.json([]);
    }

    const { query } = req.params;
    const searchTerm = `%${query}%`;
    
    const videos = await db.query(`
      SELECT id, title, description, thumbnail_url, duration, view_count, created_at 
      FROM videos 
      WHERE status = 'ready' AND (title LIKE ? OR description LIKE ?)
      ORDER BY created_at DESC
    `, [searchTerm, searchTerm]);

    res.json(videos);
  } catch (error) {
    console.error('Search videos error:', error);
    res.status(500).json({ error: 'Failed to search videos' });
  }
});

module.exports = router;

// backend/routes/upload.js
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }
  }
});

// Direct upload endpoint
router.post('/direct', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description } = req.body;
    const videoId = uuidv4();

    // Save video info to database
    if (db.connection) {
      await db.query(`
        INSERT INTO videos (id, title, description, filename, original_filename, 
                          file_size, upload_source, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        videoId,
        title || req.file.originalname,
        description || '',
        req.file.filename,
        req.file.originalname,
        req.file.size,
        'direct',
        'processing'
      ]);
    }

    // TODO: Queue for processing with FFMPEG
    // For now, just mark as ready
    setTimeout(async () => {
      if (db.connection) {
        await db.query('UPDATE videos SET status = ? WHERE id = ?', ['ready', videoId]);
      }
    }, 1000);

    res.json({
      message: 'Video uploaded successfully',
      videoId,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// S3 upload configuration endpoint
router.get('/s3-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config/system-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!config.aws.accessKeyId || !config.aws.s3BucketName) {
      return res.status(400).json({ error: 'S3 not configured' });
    }

    // Return safe config for frontend
    res.json({
      region: config.aws.region,
      bucket: config.aws.s3BucketName,
      // Don't send credentials to frontend for security
      configured: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get S3 configuration' });
  }
});

// WeTransfer webhook endpoint
router.post('/wetransfer-webhook', async (req, res) => {
  try {
    const { transfer_id, download_url, filename, size } = req.body;
    
    // TODO: Download file from WeTransfer
    // TODO: Process and store video
    
    const videoId = uuidv4();
    
    if (db.connection) {
      await db.query(`
        INSERT INTO videos (id, title, filename, original_filename, 
                          file_size, upload_source, wetransfer_id, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        videoId,
        filename,
        filename,
        filename,
        size,
        'wetransfer',
        transfer_id,
        'processing'
      ]);
    }

    res.json({ message: 'WeTransfer upload received', videoId });
  } catch (error) {
    console.error('WeTransfer webhook error:', error);
    res.status(500).json({ error: 'Failed to process WeTransfer upload' });
  }
});

module.exports = router;

// frontend/package.json
{
  "name": "video-platform-frontend",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "react-scripts": "5.0.1",
    "axios": "^1.6.2",
    "react-dropzone": "^14.2.3",
    "react-player": "^2.13.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "proxy": "http://localhost:5000"
}

// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Upload from './pages/Upload';
import Admin from './pages/Admin';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watch/:id" element={<Watch />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/admin/*" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

// frontend/src/components/Header.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <h1>VideoTube</h1>
        </Link>
        
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">
            Search
          </button>
        </form>

        <nav className="nav-links">
          <Link to="/upload" className="nav-link upload-btn">
            Upload Video
          </Link>
          <Link to="/admin" className="nav-link admin-btn">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;

// frontend/src/components/Header.css
.header {
  background: #1a1a1a;
  border-bottom: 1px solid #333;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  height: 60px;
}

.logo h1 {
  color: #ff4444;
  margin: 0;
  text-decoration: none;
  font-size: 24px;
  font-weight: bold;
}

.logo {
  text-decoration: none;
}

.search-form {
  display: flex;
  flex: 1;
  max-width: 600px;
  margin: 0 40px;
}

.search-input {
  flex: 1;
  padding: 8px 15px;
  border: 1px solid #333;
  border-radius: 20px 0 0 20px;
  background: #2a2a2a;
  color: white;
  outline: none;
}

.search-input:focus {
  border-color: #ff4444;
}

.search-button {
  padding: 8px 20px;
  border: 1px solid #333;
  border-left: none;
  border-radius: 0 20px 20px 0;
  background: #333;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.search-button:hover {
  background: #ff4444;
}

.nav-links {
  display: flex;
  gap: 15px;
}

.nav-link {
  padding: 8px 16px;
  text-decoration: none;
  border-radius: 4px;
  transition: background 0.2s;
  font-weight: 500;
}

.upload-btn {
  background: #ff4444;
  color: white;
}

.upload-btn:hover {
  background: #ff6666;
}

.admin-btn {
  background: #333;
  color: white;
  border: 1px solid #555;
}

.admin-btn:hover {
  background: #555;
}

// frontend/src/pages/Home.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

const Home = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await axios.get('/api/videos');
      setVideos(response.data);
    } catch (err) {
      setError('Failed to load videos');
      console.error('Error fetching videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (loading) {
    return (
      <div className="home">
        <div className="loading">Loading videos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="container">
        {videos.length === 0 ? (
          <div className="no-videos">
            <h2>No videos uploaded yet</h2>
            <p>Be the first to share a video!</p>
            <Link to="/upload" className="upload-first-btn">
              Upload Video
            </Link>
          </div>
        ) : (
          <>
            <h1>Latest Videos</h1>
            <div className="videos-grid">
              {videos.map((video) => (
                <div key={video.id} className="video-card">
                  <Link to={`/watch/${video.id}`} className="video-link">
                    <div className="video-thumbnail">
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt={video.title} />
                      ) : (
                        <div className="thumbnail-placeholder">
                          <span>📹</span>
                        </div>
                      )}
                      {video.duration && (
                        <span className="video-duration">
                          {formatDuration(video.duration)}
                        </span>
                      )}
                    </div>
                    <div className="video-info">
                      <h3 className="video-title">{video.title}</h3>
                      <div className="video-meta">
                        <span className="view-count">
                          {video.view_count.toLocaleString()} views
                        </span>
                        <span className="upload-date">
                          {formatDate(video.created_at)}
                        </span>
                      </div>
                      {video.description && (
                        <p className="video-description">
                          {video.description.substring(0, 100)}
                          {video.description.length > 100 && '...'}
                        </p>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Home;

// frontend/src/pages/Home.css
.home {
  padding: 20px;
  min-height: calc(100vh - 60px);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  color: #ccc;
  font-size: 18px;
}

.error {
  color: #ff6b6b;
}

.no-videos {
  text-align: center;
  padding: 60px 20px;
  color: #ccc;
}

.no-videos h2 {
  margin-bottom: 10px;
  color: white;
}

.upload-first-btn {
  display: inline-block;
  margin-top: 20px;
  padding: 12px 24px;
  background: #ff4444;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
  transition: background 0.2s;
}

.upload-first-btn:hover {
  background: #ff6666;
}

.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.video-card {
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.video-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.video-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.video-thumbnail {
  position: relative;
  aspect-ratio: 16/9;
  background: #1a1a1a;
  overflow: hidden;
}

.video-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 48px;
  color: #666;
}

.video-duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.video-info {
  padding: 15px;
}

.video-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: white;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-meta {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: #aaa;
  margin-bottom: 8px;
}

.video-description {
  font-size: 13px;
  color: #999;
  line-height: 1.4;
  margin: 0;
}

// frontend/src/pages/Watch.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactPlayer from 'react-player';
import axios from 'axios';
import './Watch.css';

const Watch = () => {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVideo();
  }, [id]);

  const fetchVideo = async () => {
    try {
      const response = await axios.get(`/api/videos/${id}`);
      setVideo(response.data);
    } catch (err) {
      setError('Video not found');
      console.error('Error fetching video:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="watch-page">
        <div className="loading">Loading video...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="watch-page">
        <div className="error">{error || 'Video not found'}</div>
      </div>
    );
  }

  const videoUrl = video.video_url || `/uploads/${video.filename}`;

  return (
    <div className="watch-page">
      <div className="watch-container">
        <div className="video-player-container">
          <ReactPlayer
            url={videoUrl}
            controls
            width="100%"
            height="100%"
            className="video-player"
          />
        </div>
        
        <div className="video-details">
          <h1 className="video-title">{video.title}</h1>
          
          <div className="video-stats">
            <span className="view-count">
              {video.view_count.toLocaleString()} views
            </span>
            <span className="upload-date">
              Uploaded on {formatDate(video.created_at)}
            </span>
          </div>

          {video.description && (
            <div className="video-description">
              <h3>Description</h3>
              <p>{video.description}</p>
            </div>
          )}

          <div className="video-metadata">
            <div className="metadata-item">
              <strong>File:</strong> {video.original_filename}
            </div>
            {video.file_size && (
              <div className="metadata-item">
                <strong>Size:</strong> {(video.file_size / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
            {video.duration && (
              <div className="metadata-item">
                <strong>Duration:</strong> {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Watch;

// frontend/src/pages/Watch.css
.watch-page {
  padding: 20px;
  min-height: calc(100vh - 60px);
}

.watch-container {
  max-width: 1000px;
  margin: 0 auto;
}

.video-player-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.video-player {
  border-radius: 8px;
}

.video-details {
  color: white;
}

.video-title {
  font-size: 24px;
  margin: 0 0 15px 0;
  line-height: 1.3;
}

.video-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #333;
  color: #aaa;
  font-size: 14px;
}

.video-description {
  margin-bottom: 20px;
}

.video-description h3 {
  margin: 0 0 10px 0;
  color: white;
}

.video-description p {
  line-height: 1.6;
  color: #ccc;
  white-space: pre-wrap;
}

.video-metadata {
  background: #2a2a2a;
  padding: 15px;
  border-radius: 6px;
  font-size: 14px;
}

.metadata-item {
  margin-bottom: 8px;
  color: #ccc;
}

.metadata-item strong {
  color: white;
  margin-right: 8px;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  color: #ccc;
  font-size: 18px;
}

.error {
  color: #ff6b6b;
}

// frontend/src/pages/Upload.js
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './Upload.css';

const Upload = () => {
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension for title
      setMessage('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    },
    multiple: false,
    maxSize: 2 * 1024 * 1024 * 1024 // 2GB
  });

  const handleUpload = async () => {
    if (!uploadedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', uploadedFile);
    formData.append('title', title);
    formData.append('description', description);

    try {
      const response = await axios.post('/api/upload/direct', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      setUploadStatus('success');
      setMessage(`Video uploaded successfully! Video ID: ${response.data.videoId}`);
      
      // Reset form after successful upload
      setTimeout(() => {
        setUploadedFile(null);
        setTitle('');
        setDescription('');
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 3000);

    } catch (error) {
      setUploadStatus('error');
      setMessage(error.response?.data?.error || 'Upload failed. Please try again.');
      console.error('Upload error:', error);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setTitle('');
    setDescription('');
    setMessage('');
    setUploadStatus('idle');
    setUploadProgress(0);
  };

  return (
    <div className="upload-page">
      <div className="upload-container">
        <h1>Upload Video</h1>

        <div className="upload-options">
          <div className="upload-method active">
            <h3>Direct Upload</h3>
            
            {!uploadedFile ? (
              <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                <input {...getInputProps()} />
                <div className="dropzone-content">
                  <div className="upload-icon">📁</div>
                  {isDragActive ? (
                    <p>Drop the video file here...</p>
                  ) : (
                    <>
                      <p>Drag & drop a video file here</p>
                      <p>or <strong>click to browse</strong></p>
                      <div className="file-info">
                        <small>Supported formats: MP4, AVI, MOV, MKV, WebM</small>
                        <small>Maximum size: 2GB</small>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="file-selected">
                <div className="file-info-card">
                  <div className="file-details">
                    <h4>{uploadedFile.name}</h4>
                    <p>Size: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p>Type: {uploadedFile.type}</p>
                  </div>
                  <button onClick={removeFile} className="remove-file-btn">
                    ✕
                  </button>
                </div>

                <div className="video-form">
                  <div className="form-group">
                    <label htmlFor="title">Title *</label>
                    <input
                      type="text"
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter video title"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter video description (optional)"
                      rows={4}
                    />
                  </div>

                  {uploadStatus === 'uploading' && (
                    <div className="upload-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p>Uploading... {uploadProgress}%</p>
                    </div>
                  )}

                  {message && (
                    <div className={`message ${uploadStatus}`}>
                      {message}
                    </div>
                  )}

                  <button
                    onClick={handleUpload}
                    disabled={!title.trim() || uploadStatus === 'uploading'}
                    className="upload-btn"
                  >
                    {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Video'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="upload-method disabled">
            <h3>S3 Upload</h3>
            <p className="coming-soon">Coming soon - Configure S3 in admin panel</p>
          </div>

          <div className="upload-method disabled">
            <h3>WeTransfer</h3>
            <p className="coming-soon">Coming soon - Configure email in admin panel</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;

// frontend/src/pages/Upload.css
.upload-page {
  padding: 20px;
  min-height: calc(100vh - 60px);
}

.upload-container {
  max-width: 800px;
  margin: 0 auto;
}

.upload-container h1 {
  text-align: center;
  margin-bottom: 30px;
  color: white;
}

.upload-options {
  display: grid;
  gap: 20px;
}

.upload-method {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 20px;
  transition: opacity 0.2s;
}

.upload-method.disabled {
  opacity: 0.6;
}

.upload-method h3 {
  margin: 0 0 15px 0;
  color: white;
}

.coming-soon {
  color: #aaa;
  font-style: italic;
}

.dropzone {
  border: 2px dashed #666;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.dropzone:hover,
.dropzone.active {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.1);
}

.dropzone-content {
  color: #ccc;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.dropzone p {
  margin: 5px 0;
}

.dropzone strong {
  color: #ff4444;
}

.file-info {
  margin-top: 15px;
}

.file-info small {
  display: block;
  color: #999;
  margin: 2px 0;
}

.file-selected {
  space-y: 20px;
}

.file-info-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1a1a1a;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 20px;
}

.file-details h4 {
  margin: 0 0 5px 0;
  color: white;
}

.file-details p {
  margin: 2px 0;
  color: #aaa;
  font-size: 14px;
}

.remove-file-btn {
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.remove-file-btn:hover {
  background: #ff6666;
}

.video-form {
  space-y: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: white;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #555;
  border-radius: 4px;
  background: #1a1a1a;
  color: white;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #ff4444;
}

.upload-progress {
  margin: 20px 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: #ff4444;
  transition: width 0.3s;
}

.upload-progress p {
  text-align: center;
  color: #ccc;
  margin: 0;
}

.message {
  padding: 10px;
  border-radius: 4px;
  margin: 15px 0;
  text-align: center;
}

.message.success {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
  border: 1px solid #4caf50;
}

.message.error {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
  border: 1px solid #f44336;
}

.upload-btn {
  width: 100%;
  padding: 12px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 20px;
}

.upload-btn:hover:not(:disabled) {
  background: #ff6666;
}

.upload-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

// frontend/src/App.css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #1a1a1a;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  line-height: 1.6;
}

.App {
  min-height: 100vh;
}

.main-content {
  margin-top: 0;
}

h1, h2, h3, h4, h5, h6 {
  color: white;
}

// frontend/src/pages/Admin.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import AdminLogin from '../components/admin/AdminLogin';
import AdminDashboard from '../components/admin/AdminDashboard';
import AdminConfig from '../components/admin/AdminConfig';
import AdminVideos from '../components/admin/AdminVideos';
import './Admin.css';

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      // TODO: Verify token with backend
      setIsAuthenticated(true);
    }
    setLoading(false);
  };

  const handleLogin = (token) => {
    localStorage.setItem('adminToken', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div className="admin-loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="admin-layout">
      <nav className="admin-sidebar">
        <div className="admin-header">
          <h2>Admin Panel</h2>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
        <ul className="admin-nav">
          <li>
            <Link 
              to="/admin/dashboard" 
              className={location.pathname === '/admin/dashboard' ? 'active' : ''}
            >
              📊 Dashboard
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/videos" 
              className={location.pathname === '/admin/videos' ? 'active' : ''}
            >
              🎥 Videos
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/config" 
              className={location.pathname === '/admin/config' ? 'active' : ''}
            >
              ⚙️ Configuration
            </Link>
          </li>
        </ul>
      </nav>
      
      <main className="admin-content">
        <Routes>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/videos" element={<AdminVideos />} />
          <Route path="/config" element={<AdminConfig />} />
        </Routes>
      </main>
    </div>
  );
};

export default Admin;

// frontend/src/pages/Admin.css
.admin-layout {
  display: flex;
  min-height: calc(100vh - 60px);
}

.admin-sidebar {
  width: 250px;
  background: #2a2a2a;
  border-right: 1px solid #333;
  flex-shrink: 0;
}

.admin-header {
  padding: 20px;
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-header h2 {
  margin: 0;
  color: white;
  font-size: 18px;
}

.logout-btn {
  background: #ff4444;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.logout-btn:hover {
  background: #ff6666;
}

.admin-nav {
  list-style: none;
  padding: 0;
  margin: 0;
}

.admin-nav li {
  border-bottom: 1px solid #333;
}

.admin-nav a {
  display: block;
  padding: 15px 20px;
  color: #ccc;
  text-decoration: none;
  transition: all 0.2s;
}

.admin-nav a:hover,
.admin-nav a.active {
  background: #333;
  color: white;
}

.admin-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.admin-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100vh - 60px);
  color: #ccc;
  font-size: 18px;
}

// frontend/src/components/admin/AdminLogin.js
import React, { useState } from 'react';
import axios from 'axios';
import './AdminLogin.css';

const AdminLogin = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/admin/login', credentials);
      onLogin(response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="login-container">
        <h2>Admin Login</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;

// frontend/src/components/admin/AdminLogin.css
.admin-login {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 60px);
  padding: 20px;
}

.login-container {
  background: #2a2a2a;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 400px;
}

.login-container h2 {
  text-align: center;
  margin-bottom: 30px;
  color: white;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 5px;
  color: white;
  font-weight: 500;
}

.form-group input {
  padding: 12px;
  border: 1px solid #555;
  border-radius: 4px;
  background: #1a1a1a;
  color: white;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #ff4444;
}

.error-message {
  color: #ff6b6b;
  text-align: center;
  padding: 10px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 4px;
  border: 1px solid #ff6b6b;
}

.login-btn {
  padding: 12px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.login-btn:hover:not(:disabled) {
  background: #ff6666;
}

.login-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

// frontend/src/components/admin/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalViews: 0,
    storageUsed: 0,
    recentUploads: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  return (
    <div className="admin-dashboard">
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🎥</div>
          <div className="stat-content">
            <h3>Total Videos</h3>
            <p className="stat-number">{stats.totalVideos}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">👀</div>
          <div className="stat-content">
            <h3>Total Views</h3>
            <p className="stat-number">{stats.totalViews.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">💾</div>
          <div className="stat-content">
            <h3>Storage Used</h3>
            <p className="stat-number">{formatBytes(stats.storageUsed)}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Avg Views/Video</h3>
            <p className="stat-number">
              {stats.totalVideos > 0 ? Math.round(stats.totalViews / stats.totalVideos) : 0}
            </p>
          </div>
        </div>
      </div>

      <div className="recent-uploads">
        <h2>Recent Uploads</h2>
        {stats.recentUploads.length === 0 ? (
          <p className="no-uploads">No recent uploads</p>
        ) : (
          <div className="uploads-table">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Upload Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentUploads.map((video) => (
                  <tr key={video.id}>
                    <td className="video-title">{video.title}</td>
                    <td>
                      <span className={`status ${video.status}`}>
                        {video.status}
                      </span>
                    </td>
                    <td>{formatDate(video.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

// frontend/src/components/admin/AdminDashboard.css
.admin-dashboard h1 {
  margin-bottom: 30px;
  color: white;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.stat-card {
  background: #2a2a2a;
  padding: 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 15px;
  border: 1px solid #333;
}

.stat-icon {
  font-size: 32px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  border-radius: 8px;
}

.stat-content h3 {
  margin: 0 0 5px 0;
  color: #ccc;
  font-size: 14px;
  font-weight: 500;
}

.stat-number {
  margin: 0;
  color: white;
  font-size: 24px;
  font-weight: bold;
}

.recent-uploads h2 {
  margin-bottom: 20px;
  color: white;
}

.no-uploads {
  color: #999;
  text-align: center;
  padding: 40px;
  background: #2a2a2a;
  border-radius: 8px;
}

.uploads-table {
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
}

.uploads-table table {
  width: 100%;
  border-collapse: collapse;
}

.uploads-table th,
.uploads-table td {
  padding: 15px;
  text-align: left;
  border-bottom: 1px solid #333;
}

.uploads-table th {
  background: #1a1a1a;
  color: white;
  font-weight: 600;
}

.uploads-table td {
  color: #ccc;
}

.video-title {
  color: white !important;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status.ready {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.status.processing {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.status.uploading {
  background: rgba(33, 150, 243, 0.2);
  color: #2196f3;
}

.status.error {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
}

.dashboard-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #ccc;
}

// frontend/src/components/admin/AdminVideos.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminVideos.css';

const AdminVideos = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/videos', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVideos(response.data);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (videoId) => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`/api/admin/videos/${videoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVideos(videos.filter(video => video.id !== videoId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Failed to delete video');
    }
  };

  const format