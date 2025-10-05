import React, { useState, useEffect } from 'react';

function Comments({ videoId, user }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});

  useEffect(() => {
    fetchComments();
  }, [videoId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/comments/video/${videoId}`);
      const data = await response.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          videoId,
          content: newComment,
          parentId: replyTo
        })
      });

      const data = await response.json();
      if (data.success) {
        setNewComment('');
        setReplyTo(null);
        fetchComments();
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (commentId, reactionType) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/comments/${commentId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ reactionType })
      });

      if (response.ok) {
        fetchComments();
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const toggleReplies = async (commentId) => {
    if (expandedReplies[commentId]) {
      setExpandedReplies({ ...expandedReplies, [commentId]: null });
    } else {
      try {
        const response = await fetch(`/api/comments/${commentId}/replies`);
        const data = await response.json();
        if (data.success) {
          setExpandedReplies({ ...expandedReplies, [commentId]: data.replies });
        }
      } catch (error) {
        console.error('Failed to fetch replies:', error);
      }
    }
  };

  const formatTimeAgo = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }
    return 'Just now';
  };

  const Comment = ({ comment, isReply = false }) => (
    <div className={`comment ${isReply ? 'comment-reply' : ''}`}>
      <div className="comment-avatar">
        {comment.avatar_url ? (
          <img src={comment.avatar_url} alt={comment.username} />
        ) : (
          <div className="avatar-placeholder">
            {comment.username?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="comment-content">
        <div className="comment-header">
          <span className="comment-author">{comment.username}</span>
          <span className="comment-time">{formatTimeAgo(comment.created_at)}</span>
          {comment.edited && <span className="comment-edited">(edited)</span>}
        </div>

        <div className="comment-text">{comment.content}</div>

        <div className="comment-actions">
          <button
            className={`action-button ${comment.user_reaction === 'like' ? 'active' : ''}`}
            onClick={() => handleReaction(comment.id, 'like')}
            disabled={!user}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M23,10C23,8.89 22.1,8 21,8H14.68L15.64,3.43C15.66,3.33 15.67,3.22 15.67,3.11C15.67,2.7 15.5,2.32 15.23,2.05L14.17,1L7.59,7.58C7.22,7.95 7,8.45 7,9V19C7,20.1 7.9,21 9,21H18C18.83,21 19.54,20.5 19.84,19.78L22.86,12.73C22.95,12.5 23,12.26 23,12V10M1,21H5V9H1V21Z" />
            </svg>
            {comment.like_count || 0}
          </button>

          <button
            className={`action-button ${comment.user_reaction === 'dislike' ? 'active' : ''}`}
            onClick={() => handleReaction(comment.id, 'dislike')}
            disabled={!user}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19,15H23V3H19M15,3H6C5.17,3 4.46,3.5 4.16,4.22L1.14,11.27C1.05,11.5 1,11.74 1,12V14C1,15.1 1.9,16 3,16H9.31L8.36,20.57C8.34,20.67 8.33,20.77 8.33,20.88C8.33,21.3 8.5,21.67 8.77,21.94L9.83,23L16.41,16.41C16.78,16.05 17,15.55 17,15V5C17,3.89 16.1,3 15,3Z" />
            </svg>
            {comment.dislike_count || 0}
          </button>

          {!isReply && user && (
            <button
              className="action-button"
              onClick={() => setReplyTo(comment.id)}
            >
              Reply
            </button>
          )}

          {!isReply && comment.reply_count > 0 && (
            <button
              className="action-button"
              onClick={() => toggleReplies(comment.id)}
            >
              {expandedReplies[comment.id] ? 'Hide' : 'Show'} {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>

        {replyTo === comment.id && (
          <form className="reply-form" onSubmit={handleSubmitComment}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={`Reply to ${comment.username}...`}
              rows="2"
              maxLength="2000"
            />
            <div className="reply-actions">
              <button type="button" onClick={() => { setReplyTo(null); setNewComment(''); }}>
                Cancel
              </button>
              <button type="submit" disabled={!newComment.trim() || submitting}>
                Reply
              </button>
            </div>
          </form>
        )}

        {expandedReplies[comment.id] && expandedReplies[comment.id].length > 0 && (
          <div className="replies-container">
            {expandedReplies[comment.id].map(reply => (
              <Comment key={reply.id} comment={reply} isReply={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return <div className="comments-loading">Loading comments...</div>;
  }

  return (
    <div className="comments-section">
      <h3 className="comments-title">{comments.length} Comments</h3>

      {user ? (
        <form className="comment-form" onSubmit={handleSubmitComment}>
          <div className="comment-input-wrapper">
            <div className="comment-avatar">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} />
              ) : (
                <div className="avatar-placeholder">
                  {user.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows="3"
              maxLength="2000"
            />
          </div>
          <div className="comment-form-actions">
            <span className="char-count">{newComment.length}/2000</span>
            <button type="submit" disabled={!newComment.trim() || submitting}>
              {submitting ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="login-prompt">
          <p>Please log in to comment</p>
        </div>
      )}

      <div className="comments-list">
        {comments.map(comment => (
          <Comment key={comment.id} comment={comment} />
        ))}

        {comments.length === 0 && (
          <div className="no-comments">
            <p>No comments yet. Be the first to comment!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Comments;