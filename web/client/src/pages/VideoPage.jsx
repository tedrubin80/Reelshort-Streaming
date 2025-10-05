import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import Comments from '../components/Comments';
import Ratings from '../components/Ratings';

function VideoPage({ user }) {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);

  useEffect(() => {
    if (videoId) {
      fetchVideo();
      fetchRelatedVideos();
      recordView();
    }
  }, [videoId]);

  const fetchVideo = async () => {
    try {
      const headers = user ? {
        'Authorization': `Bearer ${user.token}`
      } : {};

      const response = await fetch(`/api/videos/${videoId}`, { headers });
      const data = await response.json();

      if (data.success) {
        setVideo(data.video);
      } else {
        setError(data.message || 'Video not found');
      }
    } catch (error) {
      console.error('Failed to fetch video:', error);
      setError('Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedVideos = async () => {
    try {
      const response = await fetch(`/api/videos/search?limit=6`);
      const data = await response.json();
      if (data.success) {
        setRelatedVideos(data.videos.filter(v => v.id !== videoId));
      }
    } catch (error) {
      console.error('Failed to fetch related videos:', error);
    }
  };

  const recordView = async () => {
    try {
      const headers = user ? {
        'Authorization': `Bearer ${user.token}`
      } : {};

      await fetch(`/api/videos/${videoId}/view`, {
        method: 'POST',
        headers
      });
    } catch (error) {
      console.error('Failed to record view:', error);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toString() || '0';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (loading) {
    return (
      <div className="video-page-loading">
        <div className="loading-spinner"></div>
        <p>Loading video...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="video-page-error">
        <h2>Video Not Found</h2>
        <p>{error || 'The video you are looking for does not exist.'}</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="video-page">
      <div className="video-main">
        <div className="video-container">
          <VideoPlayer
            videoUrl={video.hls_url || `/uploads/videos/${videoId}.mp4`}
            thumbnailUrl={video.thumbnail_url}
            title={video.title}
            autoplay={true}
          />
        </div>

        <div className="video-info">
          <h1 className="video-title">{video.title}</h1>

          <div className="video-stats">
            <span className="stat-item">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" />
              </svg>
              {formatNumber(video.view_count)} views
            </span>
            <span className="stat-item">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12,2L15.09,8.26L22,9.27L17,14.14L18.18,21.02L12,17.77L5.82,21.02L7,14.14L2,9.27L8.91,8.26L12,2Z" />
              </svg>
              {video.average_rating ? parseFloat(video.average_rating).toFixed(1) : 'No ratings'}
            </span>
            <span className="stat-item">{formatDate(video.created_at)}</span>
          </div>

          <div className="video-channel">
            <div className="channel-avatar">
              {video.channel_avatar ? (
                <img src={video.channel_avatar} alt={video.channel_name} />
              ) : (
                <div className="avatar-placeholder">
                  {video.channel_name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="channel-info">
              <h3 className="channel-name">{video.channel_name}</h3>
              <p className="channel-creator">by {video.uploader}</p>
            </div>
          </div>

          {video.description && (
            <div className="video-description">
              <h3>Description</h3>
              <p>{video.description}</p>
            </div>
          )}

          {video.tags && video.tags.length > 0 && (
            <div className="video-tags">
              {video.tags.map((tag, index) => (
                <span key={index} className="tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>

        <Ratings videoId={videoId} user={user} />
        <Comments videoId={videoId} user={user} />
      </div>

      <div className="video-sidebar">
        <h3 className="sidebar-title">Related Videos</h3>
        <div className="related-videos">
          {relatedVideos.map(relatedVideo => (
            <div
              key={relatedVideo.id}
              className="related-video-card"
              onClick={() => navigate(`/watch/${relatedVideo.id}`)}
            >
              <div className="related-thumbnail">
                {relatedVideo.thumbnail_url ? (
                  <img src={relatedVideo.thumbnail_url} alt={relatedVideo.title} />
                ) : (
                  <div className="thumbnail-placeholder">
                    <svg viewBox="0 0 24 24" width="48" height="48">
                      <path fill="white" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
                    </svg>
                  </div>
                )}
                {relatedVideo.duration && (
                  <span className="duration">{Math.floor(relatedVideo.duration / 60)}:{(relatedVideo.duration % 60).toString().padStart(2, '0')}</span>
                )}
              </div>
              <div className="related-info">
                <h4 className="related-title">{relatedVideo.title}</h4>
                <p className="related-channel">{relatedVideo.channel_name}</p>
                <div className="related-stats">
                  <span>{formatNumber(relatedVideo.view_count)} views</span>
                  <span>•</span>
                  <span>{formatDate(relatedVideo.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VideoPage;