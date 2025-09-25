import React from 'react';

function Sidebar({ isOpen, user, onLoginClick }) {
  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="sidebar-content">
        <div className="sidebar-section">
          <ul className="sidebar-menu">
            <li className="sidebar-item active">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/>
              </svg>
              <span>Home</span>
            </li>
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M18,15L13,21L8,15H11V7H15V15H18M12,3A1,1 0 0,1 13,4A1,1 0 0,1 12,5A1,1 0 0,1 11,4A1,1 0 0,1 12,3Z"/>
              </svg>
              <span>Trending</span>
            </li>
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M14,10V18A2,2 0 0,1 12,20A2,2 0 0,1 10,18V10A2,2 0 0,1 12,8A2,2 0 0,1 14,10M9.5,4A5.5,5.5 0 0,0 4,9.5H8.5V4H9.5M14.5,4V9.5H19A5.5,5.5 0 0,0 13.5,4H14.5Z"/>
              </svg>
              <span>Shorts</span>
            </li>
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/>
              </svg>
              <span>Explore</span>
            </li>
          </ul>
        </div>

        <div className="sidebar-divider"></div>

        {user ? (
          <div className="sidebar-section">
            <h3 className="sidebar-heading">Library</h3>
            <ul className="sidebar-menu">
              <li className="sidebar-item">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                </svg>
                <span>History</span>
              </li>
              <li className="sidebar-item">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>
                </svg>
                <span>Your videos</span>
              </li>
              <li className="sidebar-item">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M14,12L10,15.5V8.5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                </svg>
                <span>Watch later</span>
              </li>
              <li className="sidebar-item">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M5,16L3,5H1V3H4L6,14H18.5L21,7H7L6.2,4H23V6H22L19,17H5Z"/>
                </svg>
                <span>Liked videos</span>
              </li>
            </ul>
          </div>
        ) : (
          <div className="sidebar-section signin-prompt">
            <p className="signin-text">Sign in to like videos, comment, and subscribe.</p>
            <button className="sidebar-signin-btn" onClick={onLoginClick}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
              </svg>
              Sign in
            </button>
          </div>
        )}

        <div className="sidebar-divider"></div>

        <div className="sidebar-section">
          <h3 className="sidebar-heading">Categories</h3>
          <ul className="sidebar-menu">
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12,15.39L8.24,17.66L9.23,13.38L5.91,10.5L10.29,10.13L12,6.09L13.71,10.13L18.09,10.5L14.77,13.38L15.76,17.66M22,9.24L14.81,8.63L12,2L9.19,8.63L2,9.24L7.45,13.97L5.82,21L12,17.27L18.18,21L16.54,13.97L22,9.24Z"/>
              </svg>
              <span>Drama</span>
            </li>
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12,17.5C14.33,17.5 16.3,16.04 17.11,14H6.89C7.69,16.04 9.67,17.5 12,17.5M8.5,11A1.5,1.5 0 0,0 10,9.5A1.5,1.5 0 0,0 8.5,8A1.5,1.5 0 0,0 7,9.5A1.5,1.5 0 0,0 8.5,11M15.5,11A1.5,1.5 0 0,0 17,9.5A1.5,1.5 0 0,0 15.5,8A1.5,1.5 0 0,0 14,9.5A1.5,1.5 0 0,0 15.5,11M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
              </svg>
              <span>Comedy</span>
            </li>
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
              </svg>
              <span>Romance</span>
            </li>
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
              </svg>
              <span>Horror</span>
            </li>
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M9,22A1,1 0 0,1 8,21V18H4A2,2 0 0,1 2,16V4C2,2.89 2.9,2 4,2H20A2,2 0 0,1 22,4V16A2,2 0 0,1 20,18H13.9L10.2,21.71C10,21.9 9.75,22 9.5,22H9M10,16V19.08L13.08,16H20V4H4V16H10Z"/>
              </svg>
              <span>Documentary</span>
            </li>
          </ul>
        </div>

        <div className="sidebar-divider"></div>

        <div className="sidebar-section">
          <h3 className="sidebar-heading">More from ReelShorts</h3>
          <ul className="sidebar-menu">
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/>
              </svg>
              <span>About</span>
            </li>
            <li className="sidebar-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
              </svg>
              <span>Send feedback</span>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;