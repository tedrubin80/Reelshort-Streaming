import React from 'react';

const Hero = () => {
  return (
    <section id="home" className="hero">
      <div className="hero__background">
        <div className="hero__overlay"></div>
      </div>
      
      <div className="hero__content">
        <div className="hero__container">
          <h1 className="hero__title">
            Discover Amazing Stories
            <span className="hero__title-accent">That Move the Soul</span>
          </h1>
          
          <p className="hero__description">
            Experience captivating short films from talented creators around the world.
            Quality storytelling meets innovative filmmaking on ReelShorts.live.
          </p>
          
          <div className="hero__actions">
            <button className="btn btn--primary btn--large">
              <span>Watch Films</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M8 5v14l11-7z" fill="currentColor"/>
              </svg>
            </button>
            
            <button className="btn btn--secondary btn--large">
              <span>Submit Your Film</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14m7-7H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          
          <div className="hero__stats">
            <div className="hero__stat">
              <span className="hero__stat-number">150+</span>
              <span className="hero__stat-label">Films</span>
            </div>
            <div className="hero__stat">
              <span className="hero__stat-number">50+</span>
              <span className="hero__stat-label">Filmmakers</span>
            </div>
            <div className="hero__stat">
              <span className="hero__stat-number">10K+</span>
              <span className="hero__stat-label">Viewers</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="hero__scroll-indicator">
        <div className="hero__scroll-arrow"></div>
      </div>
    </section>
  );
};

export default Hero;