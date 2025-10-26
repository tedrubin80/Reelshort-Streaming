import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function BackstagePage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await onLogin({ email, password });

    if (result.success) {
      navigate('/admin');
    } else {
      setError(result.message || 'Invalid credentials');
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: '#1a1f2e',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        maxWidth: '400px',
        width: '100%',
        border: '1px solid #2d3748'
      }}>
        <h1 style={{
          color: '#e8f4f8',
          marginBottom: '10px',
          fontSize: '28px',
          textAlign: 'center'
        }}>
          🎬 Backstage Access
        </h1>
        <p style={{
          color: '#a0aec0',
          marginBottom: '30px',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          Admin & Moderator Login
        </p>

        {error && (
          <div style={{
            background: '#ff4444',
            color: 'white',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#e8f4f8',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                background: '#2a303c',
                border: '1px solid #4a5568',
                borderRadius: '6px',
                color: '#e8f4f8',
                fontSize: '16px',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#065fd4'}
              onBlur={(e) => e.target.style.borderColor = '#4a5568'}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{
              display: 'block',
              color: '#e8f4f8',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                background: '#2a303c',
                border: '1px solid #4a5568',
                borderRadius: '6px',
                color: '#e8f4f8',
                fontSize: '16px',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#065fd4'}
              onBlur={(e) => e.target.style.borderColor = '#4a5568'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#555' : 'linear-gradient(135deg, #e50914 0%, #ff6b6b 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{
          color: '#718096',
          fontSize: '12px',
          textAlign: 'center',
          marginTop: '20px'
        }}>
          This page is for authorized personnel only
        </p>
      </div>
    </div>
  );
}

export default BackstagePage;
