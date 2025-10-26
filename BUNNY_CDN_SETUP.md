# Bunny.net CDN Integration Guide

## Configuration Complete ✅

Your ReelShorts platform is now integrated with Bunny.net Stream CDN!

## Environment Variables (.env)

```bash
# Already configured:
CDN_HOSTNAME=vz-9dd55677-161.b-cdn.net
USE_CDN=true
BUNNY_LIBRARY_ID=518863
BUNNY_API_KEY=  # ⚠️  ADD YOUR API KEY HERE
BUNNY_STREAM_API_URL=https://video.bunnycdn.com/library
```

## Get Your Bunny.net API Key

1. Log in to https://dash.bunny.net/
2. Go to **Account** → **API**
3. Copy your **API Key**
4. Add it to `.env` file:
   ```bash
   BUNNY_API_KEY=your-api-key-here
   ```
5. Restart the server

## API Endpoints

### 1. Get Stream URL
```bash
GET /api/cdn/video/:videoId/stream
```
Returns HLS streaming URL (Bunny.net if available, falls back to S3)

### 2. Upload Video to Bunny.net
```bash
POST /api/cdn/video/:videoId/upload-to-bunny
Headers: Authorization: Bearer <token>
```
Uploads an existing video to Bunny.net CDN

### 3. Check Encoding Status
```bash
GET /api/cdn/video/:videoId/bunny-status
Headers: Authorization: Bearer <token>
```
Check Bunny.net encoding progress

### 4. CDN Statistics (Admin)
```bash
GET /api/cdn/stats
Headers: Authorization: Bearer <token>
```
View CDN usage statistics

## How It Works

### Upload Flow:
1. User uploads video → saves to local server
2. Video processes with FFmpeg (backup to S3)
3. Creator can upload to Bunny.net via dashboard
4. Bunny.net encodes and delivers via global CDN

### Playback Flow:
1. Video player requests `/api/cdn/video/:id/stream`
2. Returns Bunny.net HLS URL if available
3. Falls back to S3 if Bunny.net not enabled
4. HLS adaptive streaming for best quality

## Features

✅ **Global CDN** - 100+ edge locations worldwide
✅ **Adaptive Streaming** - HLS with automatic quality switching
✅ **Cost Effective** - $0.005 per GB streaming
✅ **Auto Encoding** - Multiple resolutions automatically
✅ **Analytics** - Built-in viewing statistics
✅ **Thumbnails** - Auto-generated at any timestamp

## Database Schema

New columns added to `videos` table:
- `bunny_video_id` - Bunny.net video GUID
- `bunny_status` - Encoding status (pending, uploading, processing, ready, error)
- `bunny_hls_url` - HLS manifest URL
- `bunny_thumbnail_url` - Thumbnail URL
- `cdn_enabled` - Whether CDN is active for this video

## Video Player Integration

Update your video player to use the CDN stream URL:

```javascript
// Fetch stream URL
const response = await fetch(`/api/cdn/video/${videoId}/stream`);
const { stream_url, cdn_provider, adaptive } = await response.json();

// Use with HLS.js for best results
if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource(stream_url);
  hls.attachMedia(videoElement);
}
```

## Testing with Your Test Video

You already have a test video:
- Video ID: 518863
- CDN: vz-9dd55677-161.b-cdn.net

Stream URL: `https://vz-9dd55677-161.b-cdn.net/518863/playlist.m3u8`

## Next Steps

1. **Add API Key** to `.env`
2. **Restart Server**: `systemctl restart reelshorts` (or `node server.js`)
3. **Test Upload**: Upload a video via `/api/cdn/video/:id/upload-to-bunny`
4. **Update Video Player**: Integrate HLS.js for adaptive streaming
5. **Monitor**: Check `/api/cdn/stats` for usage

## Cost Estimates

| Usage | Storage | Streaming | Total/Month |
|-------|---------|-----------|-------------|
| 100 hours | $5 | $5 | **$10** |
| 500 hours | $25 | $25 | **$50** |
| 1000 hours | $50 | $50 | **$100** |

## Troubleshooting

### CDN Not Working?
- Check if `BUNNY_API_KEY` is set in `.env`
- Verify `USE_CDN=true`
- Restart the server after adding API key
- Check logs for connection errors

### Video Still Processing?
- Encoding can take 1-5 minutes
- Use `/api/cdn/video/:id/bunny-status` to check progress
- Status: 0=Queued, 1=Processing, 2=Encoding, 3=Finished, 4=Error

### Playback Issues?
- Ensure HLS.js is installed on frontend
- Check browser console for CORS errors
- Verify video completed encoding (status=3)

## Benefits Over S3 Only

| Feature | S3 Only | Bunny.net CDN |
|---------|---------|---------------|
| Global Delivery | ❌ Single location | ✅ 100+ edge servers |
| Adaptive Streaming | ❌ Manual switching | ✅ Automatic HLS |
| Cost per GB | $0.09 | $0.005 (18x cheaper!) |
| Video Encoding | ❌ Manual FFmpeg | ✅ Automatic multi-res |
| Analytics | ❌ Custom tracking | ✅ Built-in dashboard |

---

**Integration Status**: ✅ Complete
**Server Updated**: Ready to use (add API key and restart)
**Database**: Migrated
**API Routes**: Active
