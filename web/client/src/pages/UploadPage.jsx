import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function UploadPage({ user, onLoginClick }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    director: '',
    duration: '',
    description: '',
    genre: '',
    year: new Date().getFullYear(),
    email: user?.email || ''
  });
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <div className="upload-page">
        <div className="container">
          <div className="auth-required">
            <h2>Login Required</h2>
            <p>You must be logged in to upload films.</p>
            <button className="btn btn--primary" onClick={onLoginClick}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setUploading(true);

    try {
      const submitData = new FormData();
      submitData.append('video', selectedFile);
      Object.keys(formData).forEach(key => {
        submitData.append(key, formData[key]);
      });

      const response = await fetch('/api/upload/film', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        },
        body: submitData
      });

      const result = await response.json();

      if (result.success) {
        alert('Film uploaded successfully!');
        navigate('/');
      } else {
        alert(`Upload failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-page">
      <div className="container">
        <div className="upload-section__header">
          <h2 className="section-title">Upload Your Film</h2>
          <p className="section-description">
            Share your story with the world. Upload your short film to our platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="upload-form-container">
          <div className="upload-area">
            <div
              className={`upload-zone ${dragActive ? 'upload-zone--active' : ''} ${selectedFile ? 'upload-zone--has-file' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="upload-zone__file-info">
                  <div className="upload-zone__icon">✓</div>
                  <h3 className="upload-zone__title">{selectedFile.name}</h3>
                  <p className="upload-zone__subtitle">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <button type="button" className="btn btn--secondary" onClick={() => setSelectedFile(null)}>
                    Choose Different File
                  </button>
                </div>
              ) : (
                <>
                  <div className="upload-zone__icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
                      <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
                      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <h3 className="upload-zone__title">Drop your film here</h3>
                  <p className="upload-zone__subtitle">or click to browse files</p>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    id="file-input"
                  />
                  <label htmlFor="file-input" className="btn btn--primary">
                    Choose File
                  </label>
                  <p className="upload-zone__note">
                    Supported formats: MP4, MOV, AVI (Max size: 2GB)
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="film-info">
            <h3>Film Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="title">Film Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="director">Director *</label>
                <input
                  type="text"
                  id="director"
                  name="director"
                  value={formData.director}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="duration">Duration *</label>
                <input
                  type="text"
                  id="duration"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  placeholder="mm:ss"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="genre">Genre *</label>
                <select
                  id="genre"
                  name="genre"
                  value={formData.genre}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Genre</option>
                  <option value="drama">Drama</option>
                  <option value="comedy">Comedy</option>
                  <option value="documentary">Documentary</option>
                  <option value="experimental">Experimental</option>
                  <option value="animation">Animation</option>
                  <option value="horror">Horror</option>
                  <option value="romance">Romance</option>
                  <option value="thriller">Thriller</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="year">Production Year *</label>
                <input
                  type="number"
                  id="year"
                  name="year"
                  value={formData.year}
                  onChange={handleInputChange}
                  min="2000"
                  max={new Date().getFullYear()}
                  required
                />
              </div>

              <div className="form-group form-group--full">
                <label htmlFor="description">Synopsis *</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="4"
                  required
                ></textarea>
              </div>

              <div className="form-group form-group--full">
                <label htmlFor="email">Contact Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary btn--large"
                disabled={uploading || !selectedFile}
              >
                {uploading ? 'Uploading...' : 'Upload Film'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UploadPage;