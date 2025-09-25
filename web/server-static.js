const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic API endpoints
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        server: 'Southerns Short Films'
    });
});

app.get('/api/films', (req, res) => {
    res.json({
        films: [
            {
                id: 1,
                title: "Sweet Tea & Magnolias",
                thumbnail: "/uploads/thumbnails/sweet-tea.jpg",
                duration: "12:45",
                views: "2.3K",
                rating: 4.8
            },
            {
                id: 2,
                title: "Delta Crossroads",
                thumbnail: "/uploads/thumbnails/delta-crossroads.jpg",
                duration: "18:30",
                views: "1.8K",
                rating: 4.6
            },
            {
                id: 3,
                title: "Bourbon Blues",
                thumbnail: "/uploads/thumbnails/bourbon-blues.jpg",
                duration: "15:20",
                views: "3.1K",
                rating: 4.9
            },
            {
                id: 4,
                title: "Cotton Fields Forever",
                thumbnail: "/uploads/thumbnails/cotton-fields.jpg",
                duration: "22:15",
                views: "1.2K",
                rating: 4.5
            },
            {
                id: 5,
                title: "Charleston Rhythms",
                thumbnail: "/uploads/thumbnails/charleston-rhythms.jpg",
                duration: "9:55",
                views: "2.7K",
                rating: 4.7
            },
            {
                id: 6,
                title: "Magnolia Mornings",
                thumbnail: "/uploads/thumbnails/magnolia-mornings.jpg",
                duration: "14:30",
                views: "1.5K",
                rating: 4.6
            }
        ]
    });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 Southerns Short Films server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`🌐 Web interface available at http://localhost:${PORT}`);
});