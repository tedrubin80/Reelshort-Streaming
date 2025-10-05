import React, { useState, useEffect } from 'react';

function Ratings({ videoId, user }) {
  const [stats, setStats] = useState(null);
  const [userRating, setUserRating] = useState(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRatingStats();
    if (user) {
      fetchUserRating();
    }
  }, [videoId, user]);

  const fetchRatingStats = async () => {
    try {
      const response = await fetch(`/api/ratings/video/${videoId}/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch rating stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRating = async () => {
    try {
      const response = await fetch(`/api/ratings/video/${videoId}/user`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      const data = await response.json();
      if (data.success && data.rating) {
        setUserRating(data.rating.rating);
        setReview(data.rating.review || '');
      }
    } catch (error) {
      console.error('Failed to fetch user rating:', error);
    }
  };

  const handleRatingSubmit = async (rating) => {
    if (!user) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          videoId,
          rating,
          review: review || null
        })
      });

      const data = await response.json();
      if (data.success) {
        setUserRating(rating);
        setShowReviewForm(false);
        fetchRatingStats();
      }
    } catch (error) {
      console.error('Failed to submit rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStarClick = (rating) => {
    if (!user) return;
    handleRatingSubmit(rating);
  };

  const renderStars = (rating, interactive = false) => {
    return (
      <div className="stars-container">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`star ${interactive ? 'interactive' : ''} ${star <= (interactive ? (hoverRating || userRating) : rating) ? 'filled' : ''}`}
            viewBox="0 0 24 24"
            width="24"
            height="24"
            onClick={() => interactive && handleStarClick(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
          >
            <path
              fill={star <= (interactive ? (hoverRating || userRating) : rating) ? '#ffd700' : '#gray'}
              d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"
            />
          </svg>
        ))}
      </div>
    );
  };

  const renderRatingDistribution = () => {
    if (!stats || stats.total_ratings === 0) return null;

    const total = parseInt(stats.total_ratings);
    const distribution = [
      { stars: 5, count: parseInt(stats.five_star || 0) },
      { stars: 4, count: parseInt(stats.four_star || 0) },
      { stars: 3, count: parseInt(stats.three_star || 0) },
      { stars: 2, count: parseInt(stats.two_star || 0) },
      { stars: 1, count: parseInt(stats.one_star || 0) }
    ];

    return (
      <div className="rating-distribution">
        {distribution.map(({ stars, count }) => (
          <div key={stars} className="distribution-row">
            <span className="stars-label">{stars} ★</span>
            <div className="distribution-bar">
              <div
                className="distribution-fill"
                style={{ width: `${(count / total) * 100}%` }}
              ></div>
            </div>
            <span className="count-label">{count}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="ratings-loading">Loading ratings...</div>;
  }

  return (
    <div className="ratings-section">
      <h3 className="ratings-title">Ratings & Reviews</h3>

      <div className="ratings-overview">
        <div className="rating-summary">
          <div className="average-rating">
            {stats && stats.total_ratings > 0 ? (
              <>
                <span className="rating-number">{parseFloat(stats.average_rating).toFixed(1)}</span>
                {renderStars(Math.round(parseFloat(stats.average_rating)))}
                <span className="rating-count">{stats.total_ratings} ratings</span>
              </>
            ) : (
              <span className="no-ratings">No ratings yet</span>
            )}
          </div>

          {renderRatingDistribution()}
        </div>

        {user ? (
          <div className="user-rating-section">
            <h4>Your Rating</h4>
            {renderStars(userRating || 0, true)}

            {userRating && !showReviewForm && (
              <button
                className="add-review-button"
                onClick={() => setShowReviewForm(true)}
              >
                {review ? 'Edit Review' : 'Add Review'}
              </button>
            )}

            {showReviewForm && (
              <div className="review-form">
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Write your review... (optional)"
                  rows="4"
                  maxLength="1000"
                />
                <div className="review-form-actions">
                  <button onClick={() => setShowReviewForm(false)}>Cancel</button>
                  <button
                    onClick={() => handleRatingSubmit(userRating)}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Save Review'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="login-prompt">
            <p>Log in to rate this video</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Ratings;