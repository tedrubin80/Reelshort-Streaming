import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function DashboardPage({ user, onLoginClick }) {
  const [userFilms, setUserFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFilms: 0,
    totalViews: 0,
    totalLikes: 0
  });

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <div className="dashboard-page">
        <div className="container">
          <div className="auth-required">
            <h2>Login Required</h2>
            <p>You must be logged in to access your creator dashboard.</p>
            <button className="btn btn--primary" onClick={onLoginClick}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchUserFilms();
  }, [user]);

  const fetchUserFilms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/films/user', {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserFilms(data.films || []);

        // Calculate stats
        const totalViews = data.films?.reduce((sum, film) => sum + (film.viewCount || 0), 0) || 0;
        const totalLikes = data.films?.reduce((sum, film) => sum + (film.likeCount || 0), 0) || 0;

        setStats({
          totalFilms: data.films?.length || 0,
          totalViews,
          totalLikes
        });
      }
    } catch (error) {
      console.error('Error fetching user films:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dashboard-header">
          <div className="dashboard-title">
            <h1>Creator Dashboard</h1>
            <p>Welcome back, {user.displayName || user.username || user.name}!</p>
          </div>
          <Link to="/upload" className="btn btn--primary">
            Upload New Film
          </Link>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon">🎬</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalFilms}</div>
              <div className="stat-label">Total Films</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👁️</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalViews.toLocaleString()}</div>
              <div className="stat-label">Total Views</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">❤️</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalLikes.toLocaleString()}</div>
              <div className="stat-label">Total Likes</div>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          <div className="section">
            <h2>Your Films</h2>

            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading your films...</p>
              </div>
            ) : userFilms.length > 0 ? (
              <div className="films-grid">
                {userFilms.map(film => (
                  <div key={film.id} className="film-card">
                    <div className="film-thumbnail">
                      <img src={film.thumbnail || '/placeholder.svg'} alt={film.title} />
                      <div className="film-status">
                        <span className={`status-badge status-${film.status || 'pending'}`}>
                          {film.status || 'Pending Review'}
                        </span>
                      </div>
                    </div>
                    <div className="film-info">
                      <h3 className="film-title">{film.title}</h3>
                      <p className="film-meta">
                        Duration: {film.duration} | Genre: {film.genre}
                      </p>
                      <div className="film-stats">
                        <span>👁️ {film.viewCount || 0} views</span>
                        <span>❤️ {film.likeCount || 0} likes</span>
                      </div>
                      <div className="film-actions">
                        <button className="btn btn--secondary btn--small">Edit</button>
                        <button className="btn btn--outline btn--small">Analytics</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🎬</div>
                <h3>No films uploaded yet</h3>
                <p>Start sharing your creative work with the world!</p>
                <Link to="/upload" className="btn btn--primary">
                  Upload Your First Film
                </Link>
              </div>
            )}
          </div>

          <div className="section">
            <h2>Recent Activity</h2>
            <div className="activity-feed">
              <div className="activity-item">
                <div className="activity-icon">📈</div>
                <div className="activity-content">
                  <p>Your films have been viewed <strong>{stats.totalViews}</strong> times this month!</p>
                  <span className="activity-time">Updated daily</span>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">🎯</div>
                <div className="activity-content">
                  <p>Keep uploading! Regular uploads help build your audience.</p>
                  <span className="activity-time">Tip</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;