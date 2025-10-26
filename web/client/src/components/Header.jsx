import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Header({ user, onSearchChange, onLoginClick, onLogout }) {
  const [searchValue, setSearchValue] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const location = useLocation();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearchChange) {
      onSearchChange(searchValue);
    }
  };

  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-btn" onClick={toggleMobileMenu}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>

        <Link to="/" className="logo">
          <img src="/reelshorts.png" alt="ReelShorts.live" className="logo-icon" width="400" height="50" />
        </Link>

        <nav className="nav-links">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            Home
          </Link>
          {user && (
            <>
              <Link to="/upload" className={`nav-link ${location.pathname === '/upload' ? 'active' : ''}`}>
                Upload
              </Link>
              <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
                Dashboard
              </Link>
              {(user.role === 'admin' || user.role === 'moderator') && (
                <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>
                  Admin
                </Link>
              )}
            </>
          )}
        </nav>
      </div>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <Link to="/" className="mobile-logo" onClick={() => setShowMobileMenu(false)}>
                <img src="/reelshorts.png" alt="ReelShorts.live" width="200" height="25" />
              </Link>
              <button className="close-btn" onClick={() => setShowMobileMenu(false)}>
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
            <nav className="mobile-nav">
              <Link to="/" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>
                Home
              </Link>
              {user ? (
                <>
                  <Link to="/upload" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>
                    Upload
                  </Link>
                  <Link to="/dashboard" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>
                    Dashboard
                  </Link>
                  {(user.role === 'admin' || user.role === 'moderator') && (
                    <Link to="/admin" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>
                      Admin
                    </Link>
                  )}
                  <div className="mobile-nav-divider"></div>
                  <button className="mobile-nav-link" onClick={() => { onLogout(); setShowMobileMenu(false); }}>
                    Sign out
                  </button>
                </>
              ) : (
                <button className="mobile-nav-link" onClick={() => { onLoginClick(); setShowMobileMenu(false); }}>
                  Sign in
                </button>
              )}
            </nav>
          </div>
        </div>
      )}

      <div className="header-center">
        <form className="search-form" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className="search-input"
            placeholder="Search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <button type="submit" className="search-btn">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
            </svg>
          </button>
        </form>
      </div>

      <div className="header-right">
        {user ? (
          <>
            <button className="icon-btn upload-btn">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>
              </svg>
            </button>
            
            <button className="icon-btn">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M10,21H14A2,2 0 0,1 12,23A2,2 0 0,1 10,21M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M17,11A5,5 0 0,0 12,6A5,5 0 0,0 7,11V18H17V11Z"/>
              </svg>
            </button>
            
            <div className="user-menu-container">
              <button 
                className="user-avatar-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <img 
                  src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=ff6b6b&color=fff`}
                  alt={user.name}
                  className="user-avatar"
                />
              </button>
              
              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-menu-header">
                    <img 
                      src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=ff6b6b&color=fff`}
                      alt={user.name}
                      className="user-menu-avatar"
                    />
                    <div>
                      <div className="user-menu-name">{user.name}</div>
                      <div className="user-menu-email">{user.email}</div>
                    </div>
                  </div>
                  <div className="user-menu-divider"></div>
                  <button className="user-menu-item">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                    </svg>
                    Your channel
                  </button>
                  <button className="user-menu-item">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31L23.31,12L20,8.69Z"/>
                    </svg>
                    Creator Studio
                  </button>
                  <button className="user-menu-item">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
                    </svg>
                    Settings
                  </button>
                  <div className="user-menu-divider"></div>
                  <button className="user-menu-item" onClick={onLogout}>
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M16,17V14H9V10H16V7L21,12L16,17M14,2A2,2 0 0,1 16,4V6H14V4H5V20H14V18H16V20A2,2 0 0,1 14,22H5A2,2 0 0,1 3,20V4A2,2 0 0,1 5,2H14Z"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button className="sign-in-btn" onClick={onLoginClick}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
            </svg>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;