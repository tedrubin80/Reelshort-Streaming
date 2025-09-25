import React from 'react';

function CategoryBar({ selectedCategory, onCategoryChange, user, onLoginClick }) {
  const categories = [
    { id: 'all', name: 'All', icon: null },
    { id: 'drama', name: 'Drama', icon: '🎭' },
    { id: 'comedy', name: 'Comedy', icon: '😄' },
    { id: 'horror', name: 'Horror', icon: '👻' },
    { id: 'romance', name: 'Romance', icon: '💝' },
    { id: 'action', name: 'Action', icon: '💥' },
    { id: 'sci-fi', name: 'Sci-Fi', icon: '🚀' },
    { id: 'documentary', name: 'Documentary', icon: '📹' },
    { id: 'animation', name: 'Animation', icon: '🎨' },
    { id: 'experimental', name: 'Experimental', icon: '🧪' },
    { id: 'thriller', name: 'Thriller', icon: '🔪' }
  ];

  return (
    <div className="category-bar">
      {/* Navigation Section */}
      <div className="navigation-section">
        <div className="nav-group">
          <h3 className="nav-heading">Browse</h3>
          <div className="nav-pills">
            <button className="nav-pill active">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/>
              </svg>
              Home
            </button>
            <button className="nav-pill">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M18,15L13,21L8,15H11V7H15V15H18M12,3A1,1 0 0,1 13,4A1,1 0 0,1 12,5A1,1 0 0,1 11,4A1,1 0 0,1 12,3Z"/>
              </svg>
              Trending
            </button>
            <button className="nav-pill">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/>
              </svg>
              Explore
            </button>
          </div>
        </div>

        {user ? (
          <div className="nav-group">
            <h3 className="nav-heading">Library</h3>
            <div className="nav-pills">
              <button className="nav-pill">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                </svg>
                History
              </button>
              <button className="nav-pill">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>
                </svg>
                Your videos
              </button>
              <button className="nav-pill">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M5,16L3,5H1V3H4L6,14H18.5L21,7H7L6.2,4H23V6H22L19,17H5Z"/>
                </svg>
                Liked videos
              </button>
            </div>
          </div>
        ) : (
          <div className="nav-group signin-section">
            <p className="signin-text">Sign in to access your library and personalized features.</p>
            <button className="nav-signin-btn" onClick={onLoginClick}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
              </svg>
              Sign in
            </button>
          </div>
        )}
      </div>

      {/* Categories Section */}
      <div className="category-bar-container">
        <div className="category-pills">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-pill ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.icon && <span className="category-icon">{category.icon}</span>}
              {category.name}
            </button>
          ))}
        </div>
        
        <div className="category-actions">
          <button className="filter-btn" title="Filter">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z"/>
            </svg>
          </button>
          
          <button className="sort-btn" title="Sort">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M18 21L14 17H17V7H14L18 3L22 7H19V17H22M2 19V17H12V19M2 13V11H9V13M2 7V5H6V7H2Z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CategoryBar;