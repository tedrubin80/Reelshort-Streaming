# 🚀 ReelShorts.live Deployment Guide

## Overview
ReelShorts.live is a complete video streaming platform built with React frontend, Node.js/Express backend, PostgreSQL database, and Redis caching. Features include user authentication, video upload/processing, real-time streaming, and automated video compression with S3 storage integration.

## 🏗️ Architecture

### Frontend
- **React 18** with React Router for navigation
- **Webpack** build system with production optimization
- **CSS3** with responsive design
- **Real-time updates** via WebSocket integration

### Backend
- **Node.js/Express** API server
- **PostgreSQL** database for persistent data
- **Redis** for caching and job queues
- **JWT** authentication with secure sessions
- **Multer** for file upload handling
- **Socket.IO** for real-time communication

### Video Processing
- **FFmpeg** for video compression and transcoding
- **Multiple quality outputs** (360p, 480p, 720p)
- **Thumbnail generation** for video previews
- **S3 integration** for cloud storage
- **Background processing** with Redis queues

### Infrastructure
- **Nginx** reverse proxy with SSL termination
- **Systemd services** for process management
- **Let's Encrypt** SSL certificates
- **Automated backups** with cron jobs

## 🛠️ Prerequisites

### System Requirements
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+ and npm
- PostgreSQL 12+
- Redis 6+
- Nginx 1.18+
- FFmpeg 4.4+
- Git

### Hardware Recommendations
- **Minimum**: 2 CPU cores, 4GB RAM, 50GB storage
- **Recommended**: 4+ CPU cores, 8GB+ RAM, 100GB+ storage
- **External drive** for video processing (recommended)

## 📦 Installation

### 1. System Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y nginx postgresql postgresql-contrib redis-server \
                    ffmpeg git curl build-essential python3-pip s3cmd

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Database Setup
```bash
# Create database user and database
sudo -u postgres createuser --pwprompt reelshorts_user
sudo -u postgres createdb -O reelshorts_user reelshorts_db

# Import database schema
psql -h localhost -U reelshorts_user -d reelshorts_db < reelshorts_schema.sql
```

### 3. Application Setup
```bash
# Clone repository
git clone https://github.com/tedrubin80/Reelshort.git
cd Reelshort

# Install backend dependencies
cd web && npm install

# Install frontend dependencies
cd client && npm install

# Build frontend
npm run build

# Copy environment file and configure
cp .env.example .env
# Edit .env with your configuration
```

### 4. Configuration

#### Environment Variables (.env)
```bash
# Database Configuration
DATABASE_URL=postgresql://reelshorts_user:password@localhost:5432/reelshorts_db

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Application Configuration
NODE_ENV=production
PORT=3000
CLIENT_URL=http://your-server-ip
DOMAIN=your-domain.com

# JWT Configuration
JWT_SECRET=your-secure-jwt-secret-key
JWT_EXPIRES_IN=7d

# Email Configuration (Resend)
RESEND_API_KEY=your_resend_api_key

# S3 Storage Configuration
S3_ENDPOINT=your-s3-endpoint.com
S3_ACCESS_KEY=your_s3_access_key
S3_SECRET_KEY=your_s3_secret_key
S3_BUCKET_HOT=reelshorts-hot

# Processing Configuration
PROCESSING_DRIVE=/mnt/your-external-drive
MAX_CONCURRENT_PROCESSING=3
```

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/your-domain.com
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 20480M;
    root /path/to/Reelshort/web/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5. SSL Setup
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Enable automatic renewal
sudo systemctl enable --now certbot.timer
```

### 6. Service Setup

#### Application Service
```bash
# /etc/systemd/system/reelshorts-app.service
[Unit]
Description=ReelShorts Application Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/Reelshort/web
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Video Processing Worker
```bash
# /etc/systemd/system/reelshorts-worker.service
[Unit]
Description=ReelShorts Video Processing Worker
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/Reelshort
ExecStart=/usr/bin/node scripts/video-worker.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 7. Start Services
```bash
# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable --now reelshorts-app reelshorts-worker
sudo systemctl enable --now nginx postgresql redis-server

# Check service status
sudo systemctl status reelshorts-app reelshorts-worker
```

## 🔧 Configuration Options

### Video Processing
- **Max file size**: 20GB (configurable)
- **Max duration**: 30 minutes (configurable)
- **Quality outputs**: 360p, 480p, 720p (automatic)
- **Compression**: Adaptive based on content length
- **Storage**: Hot/Cool/Archive tiers on S3

### User Management
- **Registration**: Email/password with validation
- **Authentication**: JWT with 7-day expiration
- **Rate limiting**: 5 requests per 15 minutes
- **File uploads**: Drag & drop interface

### Monitoring
- **Health checks**: API endpoints for monitoring
- **Logs**: Structured logging with rotation
- **Metrics**: Processing times, queue lengths
- **Alerts**: Disk space, processing failures

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify database exists
sudo -u postgres psql -l | grep reelshorts

# Test connection
psql -h localhost -U reelshorts_user -d reelshorts_db
```

#### Video Processing Issues
```bash
# Check FFmpeg installation
ffmpeg -version

# Verify processing directories
ls -la /mnt/your-external-drive/processing/

# Check worker logs
journalctl -u reelshorts-worker -f
```

#### Nginx 502 Errors
```bash
# Check application is running
curl http://localhost:3000/api/health

# Verify nginx configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

## 📊 Monitoring & Maintenance

### Health Checks
- Application: `GET /api/health`
- Database: `GET /api/health/db`
- Redis: `GET /api/health/redis`
- Processing: `GET /api/health/processing`

### Log Locations
- Application: `journalctl -u reelshorts-app`
- Worker: `journalctl -u reelshorts-worker`
- Nginx: `/var/log/nginx/`
- Processing: `/mnt/your-external-drive/logs/`

### Backup Strategy
- **Database**: Daily automated backups
- **Uploaded files**: Synced to S3 storage
- **Application code**: Git repository backups
- **Logs**: 30-day retention with rotation

## 🔐 Security Considerations

### Environment Security
- Use strong, unique passwords for all services
- Secure `.env` file with restricted permissions
- Regular security updates for all dependencies
- SSL certificates with automatic renewal

### Application Security
- JWT secrets with high entropy
- Rate limiting on authentication endpoints
- Input validation and sanitization
- CORS configuration for API access

### Infrastructure Security
- Firewall configuration (ports 80, 443, 22 only)
- SSH key-based authentication
- Regular security updates
- Monitoring for suspicious activity

## 📈 Scaling Considerations

### Horizontal Scaling
- Load balancer with multiple app instances
- Redis cluster for high availability
- PostgreSQL read replicas
- CDN for static asset delivery

### Vertical Scaling
- Increase processing worker instances
- Larger external drives for video processing
- More CPU cores for faster encoding
- Additional RAM for larger file handling

## 🆘 Support

### Documentation
- API documentation: `/api/docs`
- System logs: `journalctl` commands
- Configuration examples in repository

### Monitoring
- Application metrics dashboard
- Real-time processing queue status
- System resource monitoring
- Automated alert notifications

---

**Last Updated**: 2025-09-26
**Version**: 1.0.0
**Support**: GitHub Issues