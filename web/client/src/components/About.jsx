import React from 'react';

const About = () => {
  const features = [
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3.09 8.26L12 14L20.91 8.26L12 2Z" fill="currentColor"/>
          <path d="M12 14L3.09 8.26V15.74L12 22L20.91 15.74V8.26L12 14Z" fill="currentColor" fillOpacity="0.6"/>
        </svg>
      ),
      title: "Curated Excellence",
      description: "Every film is carefully selected for its artistic merit and compelling storytelling."
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M17 3H7C5.9 3 5 3.9 5 5V19L12 16L19 19V5C19 3.9 18.1 3 17 3Z" fill="currentColor"/>
        </svg>
      ),
      title: "Emerging Voices",
      description: "Supporting new and established filmmakers from around the world."
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 9.5V7.5L12 9L15 10.5V9.5L21 12V10L15 7.5V9.5L12 8L15 6.5V8.5L21 6V4L15 6.5V4.5L12 6L15 7.5V5.5L21 3V5L15 2.5V4.5L12 3L15 1.5V3.5L21 1" fill="currentColor"/>
        </svg>
      ),
      title: "Community Driven",
      description: "Building a vibrant community of filmmakers and film enthusiasts worldwide."
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
        </svg>
      ),
      title: "Award Recognition",
      description: "Showcasing films that have earned recognition at prestigious film festivals."
    }
  ];

  return (
    <section id="about" className="about">
      <div className="container">
        <div className="about__content">
          <div className="about__text">
            <h2 className="section-title">Celebrating Short Film Excellence</h2>
            <p className="about__description">
              ReelShorts.live is a premier platform dedicated to showcasing exceptional short films 
              from creators worldwide. We believe in the power of cinema to tell powerful stories, 
              challenge perspectives, and connect communities across the globe.
            </p>
            <p className="about__description">
              From emerging indie filmmakers to established creators, we celebrate the diverse voices 
              and innovative storytelling that make short films such a compelling medium for 
              creative expression.
            </p>
            <div className="about__cta">
              <button className="btn btn--primary">Learn More</button>
              <button className="btn btn--ghost">Our Mission</button>
            </div>
          </div>
          
          <div className="about__features">
            <div className="features-grid">
              {features.map((feature, index) => (
                <div key={index} className="feature-card">
                  <div className="feature-card__icon">
                    {feature.icon}
                  </div>
                  <h3 className="feature-card__title">{feature.title}</h3>
                  <p className="feature-card__description">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="about__stats">
          <div className="stat-card">
            <span className="stat-card__number">5+</span>
            <span className="stat-card__label">Years Running</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__number">15</span>
            <span className="stat-card__label">Countries Represented</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__number">200+</span>
            <span className="stat-card__label">Film Submissions</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__number">25+</span>
            <span className="stat-card__label">Festival Awards</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;