# ReelShorts API Documentation

## Base URL
- **Production**: `http://37.27.220.18:3001/api`
- **Development**: `http://localhost:3001/api`

## Interactive API Documentation
Visit `/api-docs` for interactive Swagger UI documentation.

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Authentication Endpoints

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response:** `201 Created`
```json
{
  "message": "User registered successfully",
  "userId": "uuid",
  "token": "jwt_token"
}
```

### POST /api/auth/login
Login to existing account.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "token": "jwt_token",
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "role": "user|creator|moderator|admin"
  }
}
```

### GET /api/auth/me
Get current authenticated user information.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "role": "string",
  "created_at": "timestamp"
}
```

---

## Video Endpoints

### POST /api/upload
Upload a new video.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body (FormData):**
- `video`: File (required)
- `title`: string (required)
- `description`: string (optional)
- `category_id`: uuid (optional)
- `tags`: string (comma-separated)

**Response:** `201 Created`
```json
{
  "message": "Upload started",
  "videoId": "uuid",
  "status": "processing"
}
```

### GET /api/videos
Get list of videos with pagination and filters.

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 20, max: 100)
- `category`: uuid (optional)
- `sort`: newest|oldest|popular|trending (default: newest)
- `duration`: short|medium|long (optional)

**Response:** `200 OK`
```json
{
  "videos": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "thumbnail_url": "string",
      "duration": 123,
      "view_count": 456,
      "like_count": 78,
      "created_at": "timestamp",
      "uploader": {
        "id": "uuid",
        "username": "string"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### GET /api/videos/:id
Get single video details.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "file_path": "string",
  "thumbnail_url": "string",
  "duration": 123,
  "file_size": 456789,
  "view_count": 100,
  "like_count": 25,
  "upload_status": "completed",
  "created_at": "timestamp",
  "uploader": {
    "id": "uuid",
    "username": "string"
  },
  "cdn_enabled": true,
  "bunny_hls_url": "string"
}
```

### PUT /api/videos/:id
Update video information (owner only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "tags": "string"
}
```

**Response:** `200 OK`

### DELETE /api/videos/:id
Delete video (owner or admin only).

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

## Comment Endpoints

### GET /api/comments/:videoId
Get comments for a video.

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 50)

**Response:** `200 OK`
```json
{
  "comments": [
    {
      "id": "uuid",
      "content": "string",
      "user_id": "uuid",
      "username": "string",
      "created_at": "timestamp",
      "replies": []
    }
  ]
}
```

### POST /api/comments
Add a comment to a video.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "video_id": "uuid",
  "content": "string",
  "parent_comment_id": "uuid" // optional, for replies
}
```

**Response:** `201 Created`

### DELETE /api/comments/:id
Delete a comment (owner or admin only).

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

## Rating Endpoints

### POST /api/ratings
Rate a video.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "video_id": "uuid",
  "rating": 5 // 1-5
}
```

**Response:** `201 Created`

### GET /api/ratings/:videoId
Get average rating for a video.

**Response:** `200 OK`
```json
{
  "video_id": "uuid",
  "average_rating": 4.5,
  "total_ratings": 123
}
```

---

## Playlist Endpoints

### GET /api/playlists
Get user's playlists.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "playlists": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "is_public": true,
      "video_count": 10,
      "created_at": "timestamp"
    }
  ]
}
```

### POST /api/playlists
Create a new playlist.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "is_public": true
}
```

**Response:** `201 Created`

### POST /api/playlists/:id/videos
Add video to playlist.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "video_id": "uuid"
}
```

**Response:** `200 OK`

### DELETE /api/playlists/:playlistId/videos/:videoId
Remove video from playlist.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

## Search Endpoints

### GET /api/search
Search for videos and channels.

**Query Parameters:**
- `q`: string (search query, required)
- `type`: videos|channels|all (default: all)
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Response:** `200 OK`
```json
{
  "videos": [...],
  "channels": [...],
  "total": 45
}
```

---

## Analytics Endpoints (Creator Only)

### GET /api/analytics/dashboard
Get creator dashboard overview.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "total_views": 12345,
  "total_videos": 25,
  "total_subscribers": 150,
  "total_watch_time": 456789,
  "avg_view_duration": 180,
  "revenue": 1234.56
}
```

### GET /api/analytics/videos
Get analytics for all creator's videos.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 20)
- `startDate`: ISO date (optional)
- `endDate`: ISO date (optional)

**Response:** `200 OK`
```json
{
  "videos": [
    {
      "video_id": "uuid",
      "title": "string",
      "views": 1234,
      "likes": 56,
      "comments": 12,
      "avg_watch_duration": 180,
      "completion_rate": 75.5
    }
  ]
}
```

### GET /api/analytics/video/:videoId
Get detailed analytics for a specific video.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "video_id": "uuid",
  "title": "string",
  "daily_stats": [...],
  "traffic_sources": {...},
  "audience_demographics": {...},
  "engagement_metrics": {...}
}
```

### GET /api/analytics/audience
Get audience demographics.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "age_groups": {...},
  "countries": {...},
  "devices": {...}
}
```

---

## Recommendation Endpoints

### GET /api/recommendations/personalized
Get personalized video recommendations.

**Headers:** `Authorization: Bearer <token>` (optional)

**Query Parameters:**
- `limit`: number (default: 20)

**Response:** `200 OK`
```json
{
  "recommendations": [
    {
      "video_id": "uuid",
      "title": "string",
      "score": 0.95,
      "reason": "Based on your viewing history"
    }
  ]
}
```

### GET /api/recommendations/trending
Get trending videos.

**Query Parameters:**
- `limit`: number (default: 20)
- `timeframe`: 24h|7d|30d (default: 24h)

**Response:** `200 OK`

### GET /api/recommendations/related/:videoId
Get videos related to a specific video.

**Query Parameters:**
- `limit`: number (default: 10)

**Response:** `200 OK`

---

## Admin Endpoints (Admin/Moderator Only)

### GET /api/admin/stats
Get platform statistics.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "total_users": 1234,
  "total_videos": 5678,
  "active_users_24h": 456,
  "pending_moderation": 12,
  "storage_used_gb": 567.89
}
```

### GET /api/admin/moderation/queue
Get videos pending moderation.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Response:** `200 OK`
```json
{
  "videos": [
    {
      "id": "uuid",
      "title": "string",
      "uploader": "string",
      "uploaded_at": "timestamp",
      "flag_count": 3
    }
  ]
}
```

### POST /api/admin/moderation/video/:videoId/approve
Approve a video.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "notes": "string" // optional
}
```

**Response:** `200 OK`

### POST /api/admin/moderation/video/:videoId/reject
Reject a video.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "reason": "string",
  "notes": "string" // optional
}
```

**Response:** `200 OK`

### GET /api/admin/users
Get user list with management options.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 50)
- `role`: user|creator|moderator|admin (optional)
- `banned`: true|false (optional)

**Response:** `200 OK`

### POST /api/admin/users/:userId/ban
Ban a user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "reason": "string",
  "duration": "permanent|7d|30d|90d" // optional
}
```

**Response:** `200 OK`

### POST /api/admin/users/:userId/unban
Unban a user.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

## CDN Endpoints

### GET /api/cdn/video/:videoId/stream
Get CDN streaming URL for a video.

**Response:** `200 OK`
```json
{
  "video_id": "uuid",
  "hls_url": "string",
  "bunny_video_id": "string",
  "status": "ready",
  "qualities": ["360p", "720p"]
}
```

### POST /api/cdn/video/:videoId/upload-to-bunny
Upload video to Bunny.net CDN (owner only).

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "message": "Video uploaded to CDN",
  "bunny_video_id": "string",
  "status": "encoding"
}
```

### GET /api/cdn/video/:videoId/bunny-status
Check Bunny.net encoding status.

**Response:** `200 OK`
```json
{
  "bunny_video_id": "string",
  "status": "finished|encoding|failed",
  "encoding_progress": 100
}
```

---

## Profile Endpoints

### GET /api/profile/:username
Get user profile/channel.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "username": "string",
  "bio": "string",
  "avatar_url": "string",
  "subscriber_count": 123,
  "total_views": 45678,
  "videos": [...]
}
```

### PUT /api/profile
Update own profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "bio": "string",
  "website": "string",
  "social_links": {}
}
```

**Response:** `200 OK`

---

## Subscription Endpoints

### POST /api/subscriptions/:channelId
Subscribe to a channel.

**Headers:** `Authorization: Bearer <token>`

**Response:** `201 Created`

### DELETE /api/subscriptions/:channelId
Unsubscribe from a channel.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

### GET /api/subscriptions
Get user's subscriptions.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "subscriptions": [
    {
      "channel_id": "uuid",
      "channel_name": "string",
      "subscribed_at": "timestamp"
    }
  ]
}
```

---

## Notification Endpoints

### GET /api/notifications
Get user notifications.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `unread`: true|false (optional)
- `limit`: number (default: 50)

**Response:** `200 OK`
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "comment|like|subscribe|video_processed",
      "message": "string",
      "is_read": false,
      "created_at": "timestamp"
    }
  ]
}
```

### PUT /api/notifications/:id/read
Mark notification as read.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

## Share Endpoints

### GET /api/share/:videoId
Get share URLs and embed code.

**Response:** `200 OK`
```json
{
  "video_id": "uuid",
  "share_url": "string",
  "embed_code": "string",
  "social_urls": {
    "facebook": "string",
    "twitter": "string",
    "linkedin": "string"
  }
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation error",
  "message": "Detailed error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Token is invalid or expired"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Something went wrong"
}
```

---

## Rate Limiting
- 100 requests per 15 minutes per IP for `/api/*` endpoints
- 10 upload requests per hour per authenticated user

## Webhooks (Future Feature)
Webhook support for video processing events, moderation decisions, and more coming soon.

## WebSocket Events
Real-time features via Socket.IO:
- `join-stream`: Join a video stream room
- `chat-message`: Send chat message in stream
- `viewer-count-updated`: Get live viewer count updates
