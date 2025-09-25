import React from 'react';

function VideoGrid({ videos }) {
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
}

function VideoCard({ video }) {
  const handleVideoClick = () => {
    // TODO: Navigate to video player page
    console.log('Playing video:', video.title);
  };

  const handleChannelClick = (e) => {
    e.stopPropagation();
    // TODO: Navigate to channel page
    console.log('Visiting channel:', video.channel);
  };

  return (
    <div className="video-card" onClick={handleVideoClick}>
      <div className="video-thumbnail-container">
        <img 
          src={video.thumbnail} 
          alt={video.title}
          className="video-thumbnail"
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
            <div className="channel-info" onClick={handleChannelClick}>
              <img 
                src={video.channelAvatar} 
                alt={video.channel}
                className="channel-avatar"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${video.channel}&background=ccc&color=fff`;
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
          <button className="action-btn" title="Watch later">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M14,12L10,15.5V8.5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
            </svg>
          </button>
          <button className="action-btn" title="Add to queue">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoGrid;