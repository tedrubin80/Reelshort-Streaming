import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const VideoGrid = memo(function VideoGrid({ videos }) {
  if (!videos || videos.length === 0) {
    return (
      <div className="video-grid-empty">
        <svg viewBox="0 0 24 24" width="48" height="48">
          <path fill="#ccc" d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>
        </svg>
        <h3>No videos found</h3>
        <p>Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="video-grid">
      {videos.map(video => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
});

const VideoCard = memo(function VideoCard({ video }) {
  const navigate = useNavigate();

  const handleVideoClick = useCallback(() => {
    navigate(`/watch/${video.id}`);
  }, [navigate, video.id]);

  const handleChannelClick = useCallback((e) => {
    e.stopPropagation();
    // Channel pages not yet implemented - could navigate to /channel/:id
    navigate(`/?channel=${encodeURIComponent(video.channel)}`);
  }, [navigate, video.channel]);

  return (
    <article className="video-card" onClick={handleVideoClick} role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && handleVideoClick()} aria-label={`Watch ${video.title}`}>
      <div className="video-thumbnail-container">
        <img
          src={video.thumbnail}
          alt={`Thumbnail for ${video.title}`}
          className="video-thumbnail"
          loading="lazy"
          onError={(e) => {
            e.target.src = '/placeholder.svg';
          }}
        />
        <div className="video-duration">{video.duration}</div>
        <div className="video-overlay">
          <svg viewBox="0 0 24 24" width="48" height="48" className="play-icon">
            <path fill="white" d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
          </svg>
        </div>
      </div>
      
      <div className="video-info">
        <div className="video-details">
          <h3 className="video-title" title={video.title}>
            {video.title}
          </h3>
          
          <div className="video-meta">
            <div className="channel-info" onClick={handleChannelClick} role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && handleChannelClick(e)}>
              <img
                src={video.channelAvatar}
                alt={`${video.channel} channel avatar`}
                className="channel-avatar"
                loading="lazy"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(video.channel)}&background=ccc&color=fff`;
                }}
              />
              <span className="channel-name">
                {video.channel}
                {video.verified && (
                  <svg viewBox="0 0 24 24" width="14" height="14" className="verified-icon">
                    <path fill="#606060" d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
                  </svg>
                )}
              </span>
            </div>
            
            <div className="video-stats">
              <span className="views">{video.views}</span>
              <span className="separator">•</span>
              <span className="upload-time">{video.uploadedAt}</span>
            </div>
          </div>
        </div>
        
        <div className="video-actions">
          <button className="action-btn" title="Watch later" aria-label="Add to watch later" onClick={(e) => e.stopPropagation()}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="currentColor" d="M14,12L10,15.5V8.5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
            </svg>
          </button>
          <button className="action-btn" title="Add to queue" aria-label="Add to queue" onClick={(e) => e.stopPropagation()}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="currentColor" d="M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z"/>
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
});

export default VideoGrid;