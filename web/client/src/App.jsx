import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import LoginModal from './components/LoginModal';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load page components for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const VideoPage = lazy(() => import('./pages/VideoPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const BackstagePage = lazy(() => import('./pages/BackstagePage'));

// Loading spinner component for Suspense fallback
const PageLoader = () => (
  <div className="page-loading">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for logged in user
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = async (credentials) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (data.success && data.data?.user) {
        const userData = {
          ...data.data.user,
          token: data.data.token
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setIsLoginOpen(false);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const handleRegister = async (userData) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (data.success && data.data?.user) {
        const newUser = {
          ...data.data.user,
          token: data.data.token
        };
        setUser(newUser);
        localStorage.setItem('user', JSON.stringify(newUser));
        setIsLoginOpen(false);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Registration failed', errors: data.errors };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <ErrorBoundary>
        <div className="app">
          <Header
            user={user}
            onLoginClick={() => setIsLoginOpen(true)}
            onLogout={handleLogout}
          />

          <main className="app-body" id="main-content">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <HomePage
                      user={user}
                      onLoginClick={() => setIsLoginOpen(true)}
                    />
                  }
                />
                <Route
                  path="/upload"
                  element={
                    <UploadPage
                      user={user}
                      onLoginClick={() => setIsLoginOpen(true)}
                    />
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <DashboardPage
                      user={user}
                      onLoginClick={() => setIsLoginOpen(true)}
                    />
                  }
                />
                <Route
                  path="/watch/:videoId"
                  element={<VideoPage user={user} />}
                />
                <Route
                  path="/admin"
                  element={<AdminDashboard user={user} />}
                />
                <Route
                  path="/backstage"
                  element={<BackstagePage onLogin={handleLogin} />}
                />
                <Route
                  path="/creator"
                  element={<Navigate to="/dashboard" replace />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>

          {isLoginOpen && (
            <LoginModal
              onClose={() => setIsLoginOpen(false)}
              onLogin={handleLogin}
              onRegister={handleRegister}
            />
          )}
        </div>
      </ErrorBoundary>
    </Router>
  );
}

export default App;