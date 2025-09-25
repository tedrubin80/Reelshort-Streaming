import React, { useState } from 'react';

const FeaturedFilms = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Films' },
    { id: 'drama', name: 'Drama' },
    { id: 'comedy', name: 'Comedy' },
    { id: 'documentary', name: 'Documentary' },
    { id: 'experimental', name: 'Experimental' }
  ];

  const films = [
    {
      id: 1,
      title: "Cotton Fields & Dreams",
      director: "Sarah Mitchell",
      duration: "12:30",
      category: "drama",
      thumbnail: "/uploads/thumbnails/cotton-fields.jpg",
      description: "A poignant tale of family legacy in rural Alabama.",
      awards: ["Best Short Film - Atlanta Film Festival"]
    },
    {
      id: 2,
      title: "Bourbon & Blues",
      director: "Marcus Johnson",
      duration: "8:45",
      category: "documentary",
      thumbnail: "/uploads/thumbnails/bourbon-blues.jpg",
      description: "Exploring the musical heritage of Kentucky's distilleries.",
      awards: ["Audience Choice - Nashville Film Festival"]
    },
    {
      id: 3,
      title: "Magnolia Mornings",
      director: "Emily Rodriguez",
      duration: "15:20",
      category: "drama",
      thumbnail: "/uploads/thumbnails/magnolia-mornings.jpg",
      description: "A grandmother's wisdom shapes a young girl's summer.",
      awards: []
    },
    {
      id: 4,
      title: "Charleston Rhythms",
      director: "David Thompson",
      duration: "6:15",
      category: "experimental",
      thumbnail: "/uploads/thumbnails/charleston-rhythms.jpg",
      description: "Visual poetry celebrating Southern coastal culture.",
      awards: ["Best Cinematography - Savannah Film Festival"]
    },
    {
      id: 5,
      title: "Sweet Tea Chronicles",
      director: "Lisa Parks",
      duration: "11:30",
      category: "comedy",
      thumbnail: "/uploads/thumbnails/sweet-tea.jpg",
      description: "A humorous look at family dinner traditions.",
      awards: []
    },
    {
      id: 6,
      title: "Delta Crossroads",
      director: "Robert Lee",
      duration: "14:45",
      category: "documentary",
      thumbnail: "/uploads/thumbnails/delta-crossroads.jpg",
      description: "The intersection of music and community in Mississippi.",
      awards: ["Best Documentary Short - Memphis Film Prize"]
    }
  ];

  const filteredFilms = selectedCategory === 'all' 
    ? films 
    : films.filter(film => film.category === selectedCategory);

  return (
    <section id="films" className="featured-films">
      <div className="container">
        <div className="featured-films__header">
          <h2 className="section-title">Featured Films</h2>
          <p className="section-description">
            Discover award-winning short films that capture the essence of Southern storytelling
          </p>
        </div>

        <div className="featured-films__filters">
          {categories.map(category => (
            <button
              key={category.id}
              className={`filter-btn ${selectedCategory === category.id ? 'filter-btn--active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="featured-films__grid">
          {filteredFilms.map(film => (
            <div key={film.id} className="film-card">
              <div className="film-card__thumbnail">
                <img src={film.thumbnail} alt={film.title} />
                <div className="film-card__overlay">
                  <button className="film-card__play">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M8 5v14l11-7z" fill="currentColor"/>
                    </svg>
                  </button>
                  <span className="film-card__duration">{film.duration}</span>
                </div>
              </div>
              
              <div className="film-card__content">
                <h3 className="film-card__title">{film.title}</h3>
                <p className="film-card__director">Directed by {film.director}</p>
                <p className="film-card__description">{film.description}</p>
                
                {film.awards.length > 0 && (
                  <div className="film-card__awards">
                    <span className="award-badge">{film.awards[0]}</span>
                  </div>
                )}
                
                <div className="film-card__actions">
                  <button className="btn btn--primary btn--small">Watch Now</button>
                  <button className="btn btn--ghost btn--small">Details</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="featured-films__footer">
          <button className="btn btn--secondary">View All Films</button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedFilms;