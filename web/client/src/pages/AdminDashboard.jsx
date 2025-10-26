import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user is admin/moderator
  useEffect(() => {
    if (!user || !user.token) {
      navigate('/');
      return;
    }

    // Fetch initial data
    fetchStats();
  }, [user, navigate]);

  const fetchWithAuth = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 403) {
      alert('Access denied. Admin privileges required.');
      navigate('/');
      return null;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/api/admin/stats');
      if (data) setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchModerationQueue = async (status = 'pending') => {
    try {
      setLoading(true);
      const data = await fetchWithAuth(`/api/admin/moderation/queue?status=${status}&limit=50`);
      if (data) setModerationQueue(data.videos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (filters = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams(filters);
      const data = await fetchWithAuth(`/api/admin/users?${params}`);
      if (data) setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const approveVideo = async (videoId) => {
    try {
      const notes = prompt('Add approval notes (optional):');
      await fetchWithAuth(`/api/admin/moderation/video/${videoId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes })
      });
      alert('Video approved successfully!');
      fetchModerationQueue();
      fetchStats();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const rejectVideo = async (videoId) => {
    const reason = prompt('Rejection reason (required):');
    if (!reason) return;

    const notes = prompt('Additional notes (optional):');

    try {
      await fetchWithAuth(`/api/admin/moderation/video/${videoId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason, notes })
      });
      alert('Video rejected');
      fetchModerationQueue();
      fetchStats();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const banUser = async (userId) => {
    const reason = prompt('Ban reason (required):');
    if (!reason) return;

    if (!confirm('Are you sure you want to ban this user?')) return;

    try {
      await fetchWithAuth(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      alert('User banned successfully');
      fetchUsers();
      fetchStats();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const unbanUser = async (userId) => {
    if (!confirm('Are you sure you want to unban this user?')) return;

    try {
      await fetchWithAuth(`/api/admin/users/${userId}/unban`, {
        method: 'POST'
      });
      alert('User unbanned successfully');
      fetchUsers();
      fetchStats();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);

    switch(tab) {
      case 'moderation':
        fetchModerationQueue();
        break;
      case 'users':
        fetchUsers();
        break;
      default:
        fetchStats();
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-user-info">
          {user?.username} ({user?.role || 'admin'})
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => handleTabChange('stats')}
        >
          Statistics {stats?.videos_pending_moderation > 0 && `(${stats.videos_pending_moderation} pending)`}
        </button>
        <button
          className={activeTab === 'moderation' ? 'active' : ''}
          onClick={() => handleTabChange('moderation')}
        >
          Moderation Queue
        </button>
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => handleTabChange('users')}
        >
          User Management
        </button>
      </div>

      <div className="admin-content">
        {error && <div className="admin-error">{error}</div>}
        {loading && <div className="admin-loading">Loading...</div>}

        {/* Statistics Tab */}
        {activeTab === 'stats' && stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Users</h3>
              <div className="stat-value">{stats.total_users?.toLocaleString()}</div>
              <div className="stat-subtext">+{stats.new_users_week} this week</div>
            </div>
            <div className="stat-card">
              <h3>Total Videos</h3>
              <div className="stat-value">{stats.total_videos?.toLocaleString()}</div>
              <div className="stat-subtext">+{stats.new_videos_week} this week</div>
            </div>
            <div className="stat-card">
              <h3>Total Views</h3>
              <div className="stat-value">{stats.total_views?.toLocaleString()}</div>
            </div>
            <div className="stat-card alert">
              <h3>Pending Moderation</h3>
              <div className="stat-value">{stats.videos_pending_moderation}</div>
            </div>
            <div className="stat-card alert">
              <h3>Flagged Videos</h3>
              <div className="stat-value">{stats.flagged_videos}</div>
            </div>
            <div className="stat-card warn">
              <h3>Banned Users</h3>
              <div className="stat-value">{stats.banned_users}</div>
            </div>
          </div>
        )}

        {/* Moderation Queue Tab */}
        {activeTab === 'moderation' && (
          <div className="moderation-queue">
            <div className="queue-filters">
              <button onClick={() => fetchModerationQueue('pending')}>Pending</button>
              <button onClick={() => fetchModerationQueue('flagged')}>Flagged</button>
              <button onClick={() => fetchModerationQueue('reviewing')}>Reviewing</button>
            </div>

            {moderationQueue.length === 0 ? (
              <div className="empty-state">No videos in queue</div>
            ) : (
              <div className="video-queue-list">
                {moderationQueue.map(video => (
                  <div key={video.id} className="queue-item">
                    <div className="queue-video-info">
                      <img src={video.thumbnail_url || '/placeholder.jpg'} alt={video.title} />
                      <div>
                        <h4>{video.title}</h4>
                        <p>By: {video.username} ({video.email})</p>
                        <p>Channel: {video.channel_name}</p>
                        <p>Duration: {formatDuration(video.duration)} | Uploaded: {formatDate(video.created_at)}</p>
                        <p>Status: <span className={`status-badge ${video.moderation_status}`}>{video.moderation_status}</span></p>
                        {video.flag_count > 0 && <p className="flag-count">Flags: {video.flag_count}</p>}
                      </div>
                    </div>
                    <div className="queue-actions">
                      <button className="btn-approve" onClick={() => approveVideo(video.id)}>Approve</button>
                      <button className="btn-reject" onClick={() => rejectVideo(video.id)}>Reject</button>
                      <a href={`/video/${video.id}`} target="_blank" rel="noopener noreferrer" className="btn-view">View</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="users-management">
            <div className="users-filters">
              <input
                type="text"
                placeholder="Search users..."
                onKeyPress={(e) => e.key === 'Enter' && fetchUsers({ search: e.target.value })}
              />
              <select onChange={(e) => fetchUsers({ role: e.target.value })}>
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="creator">Creator</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Videos</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={u.is_banned ? 'banned-user' : ''}>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                    <td>{u.video_count}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>
                      {u.is_banned ? (
                        <span className="status-banned">Banned</span>
                      ) : (
                        <span className="status-active">Active</span>
                      )}
                    </td>
                    <td>
                      {u.is_banned ? (
                        <button className="btn-unban" onClick={() => unbanUser(u.id)}>Unban</button>
                      ) : (
                        <button className="btn-ban" onClick={() => banUser(u.id)}>Ban</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
