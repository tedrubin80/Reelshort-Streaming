import React, { useState } from 'react';

const UploadSection = () => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Handle file upload
      console.log('Files dropped:', e.dataTransfer.files);
    }
  };

  const requirements = [
    "Original short films (under 30 minutes)",
    "Original creative content from filmmakers worldwide",
    "High-quality video (1080p minimum)",
    "Complete rights and permissions",
    "English subtitles if dialogue is not in English"
  ];

  return (
    <section id="upload" className="upload-section">
      <div className="container">
        <div className="upload-section__header">
          <h2 className="section-title">Share Your Story</h2>
          <p className="section-description">
            Submit your short film to be considered for our curated collection. 
            We're looking for compelling stories and innovative filmmaking from creators worldwide.
          </p>
        </div>

        <div className="upload-section__content">
          <div className="upload-area">
            <div 
              className={`upload-zone ${dragActive ? 'upload-zone--active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="upload-zone__icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
                  <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                  <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
                  <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
                  <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <h3 className="upload-zone__title">Drop your film here</h3>
              <p className="upload-zone__subtitle">or click to browse files</p>
              <button className="btn btn--primary">Choose File</button>
              <p className="upload-zone__note">
                Supported formats: MP4, MOV, AVI (Max size: 2GB)
              </p>
            </div>

            <div className="upload-form">
              <h3>Film Information</h3>
              <form className="form">
                <div className="form-group">
                  <label htmlFor="title">Film Title *</label>
                  <input type="text" id="title" name="title" required />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="director">Director *</label>
                    <input type="text" id="director" name="director" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="duration">Duration *</label>
                    <input type="text" id="duration" name="duration" placeholder="mm:ss" required />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="description">Synopsis *</label>
                  <textarea id="description" name="description" rows="4" required></textarea>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="genre">Genre *</label>
                    <select id="genre" name="genre" required>
                      <option value="">Select Genre</option>
                      <option value="drama">Drama</option>
                      <option value="comedy">Comedy</option>
                      <option value="documentary">Documentary</option>
                      <option value="experimental">Experimental</option>
                      <option value="animation">Animation</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="year">Production Year *</label>
                    <input type="number" id="year" name="year" min="2000" max="2024" required />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Contact Email *</label>
                  <input type="email" id="email" name="email" required />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input type="checkbox" required />
                    <span className="checkmark"></span>
                    I confirm that I own all rights to this film and agree to the submission terms
                  </label>
                </div>

                <button type="submit" className="btn btn--primary btn--large btn--full">
                  Submit Film
                </button>
              </form>
            </div>
          </div>

          <div className="upload-requirements">
            <h3>Submission Requirements</h3>
            <ul className="requirements-list">
              {requirements.map((requirement, index) => (
                <li key={index} className="requirement-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {requirement}
                </li>
              ))}
            </ul>
            
            <div className="upload-process">
              <h4>Review Process</h4>
              <p>
                All submissions are reviewed by our curatorial team within 2-4 weeks. 
                Selected films will be featured on our platform and promoted through 
                our social media channels.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UploadSection;