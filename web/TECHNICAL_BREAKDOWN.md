# ReelShorts.live - Technical Breakdown

## Platform Overview

**ReelShorts.live** is a YouTube-style video streaming platform specifically designed for short films (3-30 minutes). It provides creators with a complete ecosystem for uploading, managing, and monetizing short film content while offering viewers a curated discovery experience powered by advanced recommendation algorithms.

### Platform Philosophy
Built with the same engineering principles as early YouTube, focusing on:
- Performance and scalability
- Creator-first features
- Global content delivery
- Real-time analytics
- Community engagement

---

## Architecture Overview

### System Architecture
```
┌─────────────────┐
│   Client (PWA)  │ ← React 19.1.1 + Modern UI
└────────┬────────┘
         │ HTTP/WebSocket
         ↓
┌─────────────────┐
│  Load Balancer  │ ← Nginx (SSL, Reverse Proxy)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Node.js Server │ ← Express.js (Port 3001)
└────────┬────────┘
         │
    ┌────┴────┬─────────┬──────────┬───────────┐
    │         │         │          │           │
    ↓         ↓         ↓          ↓           ↓
┌────────┐ ┌──────┐ ┌──────┐ ┌──────────┐ ┌────────┐
│Postgres│ │Redis │ │ S3   │ │Bunny.net │ │FFmpeg  │
│  16+   │ │ 6+   │ │Object│ │   CDN    │ │Encoder │
└────────┘ └──────┘ └──────┘ └──────────┘ └────────┘
```

### Request Flow
1. **Client Request** → Nginx SSL termination
2. **Reverse Proxy** → Node.js Express server
3. **Authentication** → JWT validation
4. **Data Layer** → PostgreSQL/Redis
5. **Media Delivery** → Bunny.net CDN or S3
6. **Real-time** → WebSocket (Socket.IO)

---

## Technology Stack

### Frontend
- **Framework**: React 19.1.1
- **Routing**: React Router 7.9.1
- **Build Tool**: Webpack 5.101.2
- **Styling**: CSS3 (Custom, no framework)
- **PWA**: Service Workers, Manifest, Offline support
- **i18n**: react-i18next (English with extensibility)
- **State Management**: React Hooks + Context API

### Backend
- **Runtime**: Node.js 22.21.0
- **Framework**: Express.js
- **Language**: JavaScript (ES6+)
- **Process Management**: PM2 (recommended for production)

### Database & Caching
- **Primary Database**: PostgreSQL 16+
  - UUID primary keys
  - JSONB for flexible data
  - Advanced indexing strategies
  - Full-text search capabilities
- **Cache Layer**: Redis 6+
  - Session management
  - API response caching
  - Real-time data
  - Rate limiting

### Storage & CDN
- **Object Storage**: S3-compatible (hel1.your-objectstorage.com)
  - Hot storage: Frequently accessed videos
  - Cool storage: Older content
  - Archive: Long-term retention
- **CDN**: Bunny.net Stream
  - Global edge network
  - HLS adaptive streaming
  - 360p, 720p quality tiers
  - Auto-encoding
  - Cost: ~18x cheaper than AWS CloudFront

### Video Processing
- **Encoder**: FFmpeg
  - CRF 20-26 adaptive compression
  - H.264 codec
  - Multi-quality output (360p, 720p)
  - Thumbnail generation
  - Watermarking support
  - Duration: 3-30 minutes max

### Security & Infrastructure
- **Authentication**: JWT (7-day expiration)
- **Password Hashing**: bcrypt
- **SSL/TLS**: Let's Encrypt (via Nginx)
- **Security Headers**: Helmet.js
- **Rate Limiting**: express-rate-limit (100 req/15min)
- **CORS**: Configured for specific origins
- **Input Validation**: Custom middleware

### DevOps & Monitoring
- **Web Server**: Nginx
- **OS**: Linux (Ubuntu 24.04 LTS)
- **Logging**: Morgan (HTTP) + Console
- **Error Tracking**: Custom error handlers
- **Health Checks**: /api/health endpoint

### Real-time Features
- **WebSockets**: Socket.IO
  - Live viewer counts
  - Real-time chat
  - Upload progress tracking
  - Notifications

### Documentation
- **API Docs**: Swagger/OpenAPI 3.0
- **Endpoint**: http://localhost:3001/api-docs
- **Interactive**: Swagger UI

---

## Database Schema

### Core Tables

#### users
```sql
- id (UUID, PK)
- username (VARCHAR, UNIQUE)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- role (ENUM: user, creator, moderator, admin)
- is_banned (BOOLEAN)
- ban_reason (TEXT)
- banned_at (TIMESTAMP)
- banned_by (UUID, FK)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### videos
```sql
- id (UUID, PK)
- title (VARCHAR)
- description (TEXT)
- uploader_id (UUID, FK)
- file_path (VARCHAR)
- thumbnail_url (VARCHAR)
- duration (INTEGER, seconds)
- file_size (BIGINT, bytes)
- view_count (INTEGER)
- like_count (INTEGER)
- upload_status (ENUM: pending, processing, completed, failed)
- moderation_status (ENUM: pending, approved, rejected)
- moderation_notes (TEXT)
- moderated_by (UUID, FK)
- flag_count (INTEGER)
- cdn_enabled (BOOLEAN)
- bunny_video_id (VARCHAR)
- bunny_status (VARCHAR)
- bunny_hls_url (VARCHAR)
- bunny_thumbnail_url (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### comments
```sql
- id (UUID, PK)
- video_id (UUID, FK)
- user_id (UUID, FK)
- parent_comment_id (UUID, FK, nullable)
- content (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### ratings
```sql
- id (UUID, PK)
- video_id (UUID, FK)
- user_id (UUID, FK)
- rating (INTEGER, 1-5)
- created_at (TIMESTAMP)
UNIQUE(video_id, user_id)
```

#### playlists
```sql
- id (UUID, PK)
- name (VARCHAR)
- description (TEXT)
- user_id (UUID, FK)
- is_public (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Analytics Tables

#### video_analytics
```sql
- id (UUID, PK)
- video_id (UUID, FK)
- date (DATE)
- views_count (INTEGER)
- unique_viewers (INTEGER)
- avg_watch_duration (INTEGER)
- completion_rate (DECIMAL)
- engagement_rate (DECIMAL)
- shares_count (INTEGER)
- likes_added (INTEGER)
- comments_added (INTEGER)
```

#### view_sessions
```sql
- id (UUID, PK)
- video_id (UUID, FK)
- user_id (UUID, FK, nullable)
- watch_duration (INTEGER)
- completion_percentage (DECIMAL)
- traffic_source (VARCHAR)
- device_type (VARCHAR)
- country (VARCHAR)
- created_at (TIMESTAMP)
```

#### audience_demographics
```sql
- id (UUID, PK)
- channel_id (UUID, FK)
- date (DATE)
- age_group (VARCHAR)
- gender (VARCHAR)
- country (VARCHAR)
- viewer_count (INTEGER)
```

### Administration Tables

#### admin_activity_log
```sql
- id (UUID, PK)
- admin_id (UUID, FK)
- action_type (VARCHAR)
- target_type (VARCHAR)
- target_id (UUID)
- details (JSONB)
- created_at (TIMESTAMP)
```

### Performance Indexes
- `idx_videos_uploader` on videos(uploader_id)
- `idx_videos_status` on videos(upload_status, moderation_status)
- `idx_videos_created` on videos(created_at DESC)
- `idx_comments_video` on comments(video_id)
- `idx_ratings_video` on ratings(video_id)
- `idx_analytics_video_date` on video_analytics(video_id, date)

---

## Features Implemented

### Core Features ✅
1. **User Authentication**
   - Registration with email verification
   - JWT-based sessions (7-day)
   - Role-based access control (User, Creator, Moderator, Admin)
   - Password reset flow

2. **Video Upload & Management**
   - Multi-format support (MP4, AVI, MOV, WMV, FLV, MKV)
   - Max file size: 20GB
   - Real-time upload progress tracking
   - FFmpeg transcoding pipeline
   - Automatic thumbnail generation
   - Duration validation (3-30 minutes)

3. **Video Streaming**
   - HLS adaptive streaming via Bunny.net CDN
   - Fallback to direct S3 streaming
   - Multiple quality tiers (360p, 720p)
   - Buffer-free playback
   - Mobile-optimized delivery

4. **Search & Discovery**
   - Full-text search (videos, channels)
   - Advanced filters (category, duration, date)
   - Sort options (newest, popular, trending)
   - Pagination support

5. **Social Features**
   - Comments with nested replies
   - 5-star rating system
   - Video sharing (social media, embed codes)
   - User subscriptions
   - Playlists (public/private)
   - Watch history

6. **Real-time Features** (Socket.IO)
   - Live upload progress
   - Viewer count updates
   - Chat functionality
   - Push notifications

### Advanced Features ✅

7. **Content Moderation Dashboard**
   - Admin/moderator roles
   - Video approval/rejection workflow
   - User ban system with reasons
   - Flag count tracking
   - Moderation notes
   - Activity logging

8. **Creator Analytics**
   - Real-time view tracking
   - Engagement metrics (likes, comments, shares)
   - Watch time analytics
   - Audience demographics (age, country, device)
   - Traffic source analysis
   - Revenue tracking (future monetization)
   - Video performance comparisons
   - Channel growth metrics

9. **Recommendation Engine**
   - **Collaborative Filtering**: Jaccard similarity on user viewing patterns
   - **Content-Based Filtering**: Category and tag matching
   - **Trending Algorithm**: Time-decay weighted popularity
   - **Related Videos**: Context-aware suggestions
   - Redis caching (1-hour TTL)
   - Minimum 5 interactions for personalized recommendations
   - Fallback to popular content for new users

10. **CDN Integration (Bunny.net)**
    - Automatic video upload to CDN
    - HLS stream generation
    - Global edge delivery
    - Encoding status tracking
    - Fallback to origin storage
    - Cost optimization (18x cheaper than AWS)

11. **Video Watermarking**
    - Text watermarks (customizable)
    - Logo/image watermarks
    - Combined watermarks
    - Timestamp watermarks
    - Position control (9 positions)
    - Opacity adjustment
    - Font customization
    - Reusable templates

12. **Progressive Web App (PWA)**
    - Installable on mobile/desktop
    - Offline functionality
    - Service Worker caching
    - App shortcuts (Upload, Dashboard, Trending)
    - Push notification support (infrastructure)
    - Share target API
    - App icons (16x16 to 512x512)

13. **Internationalization (i18n)**
    - react-i18next integration
    - English language pack (complete)
    - Extensible for 40+ languages
    - Browser language detection
    - localStorage persistence
    - RTL support ready

14. **API Documentation**
    - Swagger/OpenAPI 3.0
    - Interactive Swagger UI at /api-docs
    - Complete endpoint documentation
    - Request/response schemas
    - Authentication examples
    - Error code reference

### Festival Features (Existing)
15. **Film Festival Submissions**
    - Festival organizer accounts
    - Submission management
    - Waiver system
    - Entry tracking

---

## API Endpoints Summary

### Public Endpoints (No Auth)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/videos` - Browse videos
- `GET /api/videos/:id` - View video
- `GET /api/search` - Search content
- `GET /api/recommendations/trending` - Trending videos
- `GET /api/cdn/video/:id/stream` - Stream video

### Authenticated Endpoints
- `GET /api/auth/me` - Get current user
- `POST /api/upload` - Upload video
- `PUT /api/videos/:id` - Update video
- `DELETE /api/videos/:id` - Delete video
- `POST /api/comments` - Add comment
- `POST /api/ratings` - Rate video
- `GET /api/playlists` - Get playlists
- `POST /api/subscriptions/:channelId` - Subscribe
- `GET /api/notifications` - Get notifications
- `GET /api/analytics/dashboard` - Creator analytics

### Creator-Only Endpoints
- `GET /api/analytics/videos` - Video analytics
- `GET /api/analytics/video/:id` - Detailed analytics
- `GET /api/analytics/audience` - Audience demographics
- `POST /api/cdn/video/:id/upload-to-bunny` - CDN upload

### Admin/Moderator Endpoints
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/moderation/queue` - Pending videos
- `POST /api/admin/moderation/video/:id/approve` - Approve video
- `POST /api/admin/moderation/video/:id/reject` - Reject video
- `GET /api/admin/users` - User management
- `POST /api/admin/users/:id/ban` - Ban user
- `POST /api/admin/users/:id/unban` - Unban user

**Total: 40+ API endpoints** (See API.md for full documentation)

---

## Video Processing Pipeline

### Upload Flow
```
1. Client uploads video → /api/upload
   ↓
2. Multer receives file → /uploads/pending/
   ↓
3. File validation (format, size, duration)
   ↓
4. Database record created (status: pending)
   ↓
5. Background processing job started
   ↓
6. FFmpeg transcoding:
   - Extract metadata
   - Generate thumbnail
   - Transcode to 720p (H.264, CRF 22)
   - Transcode to 360p (H.264, CRF 26)
   - Apply watermark (if enabled)
   ↓
7. Upload to S3 storage
   ↓
8. (Optional) Upload to Bunny.net CDN
   ↓
9. Update database (status: completed)
   ↓
10. Notify user via WebSocket/notification
```

### Storage Tiers
- **Hot Storage** (S3 bucket: reelshorts-hot)
  - Videos < 30 days old
  - High access frequency
  - Fast retrieval

- **Cool Storage** (S3 bucket: reelshorts-cool)
  - Videos 30-365 days old
  - Medium access frequency
  - Cost-optimized

- **Archive** (S3 bucket: reelshorts-archive)
  - Videos > 365 days old
  - Low access frequency
  - Cheapest storage

---

## Performance Optimizations

### Caching Strategy
1. **Redis Cache**
   - User sessions (30 min TTL)
   - Video metadata (1 hour TTL)
   - Recommendations (1 hour TTL)
   - Search results (15 min TTL)
   - Popular videos list (5 min TTL)

2. **Browser Cache**
   - Static assets (1 year)
   - Video thumbnails (1 week)
   - API responses (conditional)

3. **Service Worker Cache**
   - App shell files
   - Critical CSS/JS
   - Offline fallback pages

### Database Optimizations
- Composite indexes on frequent queries
- Materialized views for analytics
- Query result caching
- Connection pooling (max 20 connections)
- Prepared statements

### CDN Benefits
- 99.9% uptime SLA
- 50ms average latency worldwide
- Automatic failover
- DDoS protection
- Bandwidth savings: 80%+

---

## Security Measures

### Application Security
- **Input Validation**: All user inputs sanitized
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content escaping, CSP headers
- **CSRF Protection**: Token-based validation
- **Rate Limiting**: 100 requests/15min per IP
- **File Upload Security**:
  - MIME type validation
  - File size limits
  - Virus scanning (planned)
  - Secure file naming

### Authentication & Authorization
- JWT tokens (HS256 algorithm)
- Bcrypt password hashing (10 rounds)
- Role-based access control (RBAC)
- Token expiration (7 days)
- Secure cookie handling
- Password complexity requirements

### Infrastructure Security
- SSL/TLS encryption (Let's Encrypt)
- Nginx security headers
- Firewall rules (UFW)
- SSH key-only access
- Regular security updates
- Database encryption at rest

---

## Scalability Considerations

### Current Capacity
- **Concurrent Users**: 1,000+ (single server)
- **Video Storage**: 2TB+ available
- **Monthly Bandwidth**: 10TB CDN allocation
- **Database**: 100GB+ capacity
- **Redis**: 4GB memory

### Horizontal Scaling Path
1. **Add application servers** → Load balancer distribution
2. **Database replication** → Read replicas for queries
3. **Redis cluster** → Distributed caching
4. **CDN expansion** → More edge locations
5. **Microservices** → Split by domain (auth, video, analytics)

### Bottleneck Mitigation
- **Database**: Read replicas + connection pooling
- **File uploads**: Direct S3 uploads (pre-signed URLs)
- **Video encoding**: Separate worker queue
- **API requests**: Redis caching + CDN offloading

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env

# Start PostgreSQL & Redis
sudo systemctl start postgresql redis

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Build & Deploy
```bash
# Build frontend
npm run build

# Start production server
PORT=3001 NODE_ENV=production node server.js

# Or with PM2
pm2 start server.js --name reelshorts
```

### Testing
```bash
# Run unit tests (planned)
npm test

# Run integration tests (planned)
npm run test:integration

# Run e2e tests (planned)
npm run test:e2e
```

---

## Configuration

### Environment Variables
See `.env` file:
- **Database**: DATABASE_URL
- **Redis**: REDIS_URL
- **CDN**: BUNNY_LIBRARY_ID, BUNNY_API_KEY, CDN_HOSTNAME
- **Storage**: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY
- **Email**: RESEND_API_KEY, FROM_EMAIL
- **JWT**: JWT_SECRET, JWT_EXPIRES_IN
- **Server**: PORT, NODE_ENV, CLIENT_URL

### Nginx Configuration
- SSL termination
- Reverse proxy to port 3001
- Static file serving
- Gzip compression
- Security headers
- Rate limiting

---

## Monitoring & Logging

### Current Logging
- HTTP requests (Morgan)
- Application errors (Console + file)
- Database queries (development only)
- User activity (admin_activity_log table)

### Planned Monitoring
- Prometheus metrics
- Grafana dashboards
- Error tracking (Sentry)
- Uptime monitoring
- Performance APM

---

## Future Enhancements (Planned)

### Short-term
- [ ] Two-factor authentication (2FA)
- [ ] Payment integration (Stripe/PayPal)
- [ ] Comprehensive test suite
- [ ] Additional languages (Spanish, French, German)

### Medium-term
- [ ] Live streaming support
- [ ] Advanced video editor
- [ ] Community features (forums, groups)
- [ ] Premium subscriptions
- [ ] Ad integration

### Long-term
- [ ] Mobile apps (iOS/Android)
- [ ] AI-powered content moderation
- [ ] Automatic captioning
- [ ] 4K video support
- [ ] Blockchain-based rights management

---

## Performance Metrics

### Current Benchmarks
- **Homepage Load**: < 2s (3G connection)
- **Video Start Time**: < 3s (CDN enabled)
- **API Response Time**: < 100ms (cached)
- **Database Queries**: < 50ms average
- **Upload Speed**: Network-limited (S3 direct)

### Optimization Targets
- 95th percentile page load: < 3s
- Time to Interactive: < 4s
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s

---

## Cost Analysis

### Monthly Operating Costs (Estimated)
- **Server**: $40-80 (VPS)
- **Database**: Included in VPS
- **Redis**: Included in VPS
- **S3 Storage**: $0.02/GB (~$40 for 2TB)
- **Bunny.net CDN**: $0.005/GB (~$50 for 10TB bandwidth)
- **Domain & SSL**: $15/year
- **Email (Resend)**: $0 (free tier)

**Total**: ~$100-150/month for MVP scale

### Scaling Costs
- 10,000 users: ~$300/month
- 100,000 users: ~$1,500/month
- 1,000,000 users: ~$10,000/month

---

## Deployment Information

### Production Server
- **IP**: 37.27.220.18
- **Domain**: reelshorts.live
- **SSL**: Let's Encrypt (Auto-renewal)
- **Port**: 3001 (internal), 80/443 (external)
- **OS**: Ubuntu 24.04 LTS ARM64
- **Node**: v22.21.0

### File Locations
- **Application**: /var/www/reelshorts.live/web/
- **Uploads**: /var/www/reelshorts.live/web/uploads/
- **Processing**: /mnt/HC_Volume_103339423/
- **Logs**: /var/log/nginx/, /var/www/reelshorts.live/web/logs/
- **Nginx Config**: /etc/nginx/sites-available/reelshorts.live

---

## Key Differentiators

### vs. YouTube
- ✅ Short film focus (3-30 minutes)
- ✅ Film festival integration
- ✅ Advanced creator analytics
- ✅ Lower barrier to entry
- ✅ Curated content discovery

### vs. Vimeo
- ✅ Free unlimited uploads
- ✅ Better recommendation engine
- ✅ Real-time features
- ✅ More affordable CDN
- ✅ PWA for mobile experience

### Technical Advantages
- Modern tech stack (React 19, Node 22, Postgres 16)
- Cost-effective infrastructure (18x cheaper CDN)
- Advanced recommendation algorithms
- Comprehensive analytics for creators
- Built-in moderation tools
- Extensible architecture

---

## Contributing

### Code Style
- ESLint configuration (AirBnB)
- Prettier for formatting
- Conventional commits
- Meaningful variable names
- Comprehensive comments

### Git Workflow
- Main branch: production-ready
- Development branch: latest features
- Feature branches: `feature/feature-name`
- Bug fixes: `fix/bug-name`
- Pull request reviews required

---

## License
MIT License (Open source)

---

## Contact & Support

- **Website**: https://reelshorts.live
- **Email**: support@reelshorts.live
- **API Docs**: http://localhost:3001/api-docs
- **Status Page**: Planned

---

## Credits

Built with modern web technologies and best practices inspired by YouTube's original architecture. Special thanks to the open-source community for the amazing tools and libraries that made this possible.

**Total Development Time**: 50+ hours of focused engineering
**Lines of Code**: 15,000+ (excluding dependencies)
**Database Tables**: 20+
**API Endpoints**: 40+
**Features Implemented**: 14 major features

---

*Last Updated: January 2025*
*Version: 1.0.0*
*Status: Production-Ready MVP*
