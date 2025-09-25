const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Mock films data - replace with database queries in production
const mockFilms = [
  {
    id: 1,
    title: "City Dreams",
    thumbnail: "/uploads/thumbnails/sweet-tea.jpg",
    duration: "12:45",
    views: "2.3K views",
    uploadedAt: "2 days ago",
    channel: "Urban Films",
    channelAvatar: "https://ui-avatars.com/api/?name=Urban+Films&background=ff6b6b&color=fff",
    verified: true,
    category: "drama"
  },
  {
    id: 2,
    title: "Desert Roads - A Journey",
    thumbnail: "/uploads/thumbnails/delta-crossroads.jpg",
    duration: "18:30",
    views: "1.8K views",
    uploadedAt: "5 days ago",
    channel: "Delta Films",
    channelAvatar: "https://ui-avatars.com/api/?name=Delta+Films&background=4ecdc4&color=fff",
    verified: true,
    category: "adventure"
  },
  {
    id: 3,
    title: "Jazz Nights: City Lights",
    thumbnail: "/uploads/thumbnails/bourbon-blues.jpg",
    duration: "15:20",
    views: "3.1K views",
    uploadedAt: "1 week ago",
    channel: "Music City Productions",
    channelAvatar: "https://ui-avatars.com/api/?name=Music+City&background=95e1d3&color=fff",
    verified: false,
    category: "music"
  },
  {
    id: 4,
    title: "Open Fields - Rural Life",
    thumbnail: "/uploads/thumbnails/cotton-fields.jpg",
    duration: "22:15",
    views: "1.2K views",
    uploadedAt: "2 weeks ago",
    channel: "Heritage Films",
    channelAvatar: "https://ui-avatars.com/api/?name=Heritage+Films&background=f38181&color=fff",
    verified: true,
    category: "documentary"
  },
  {
    id: 5,
    title: "Ocean Rhythms",
    thumbnail: "/uploads/thumbnails/charleston-rhythms.jpg",
    duration: "9:55",
    views: "2.7K views",
    uploadedAt: "3 weeks ago",
    channel: "Coastal Cinema",
    channelAvatar: "https://ui-avatars.com/api/?name=Coastal+Cinema&background=aa96da&color=fff",
    verified: false,
    category: "nature"
  },
  {
    id: 6,
    title: "Morning Light - A Love Story",
    thumbnail: "/uploads/thumbnails/magnolia-mornings.jpg",
    duration: "14:30",
    views: "1.5K views",
    uploadedAt: "1 month ago",
    channel: "Romance Films",
    channelAvatar: "https://ui-avatars.com/api/?name=Romance+Films&background=fcbad3&color=fff",
    verified: true,
    category: "romance"
  },
  {
    id: 7,
    title: "Forest Mysteries",
    thumbnail: "/uploads/thumbnails/sweet-tea.jpg",
    duration: "25:10",
    views: "4.2K views",
    uploadedAt: "1 month ago",
    channel: "Mystery Channel",
    channelAvatar: "https://ui-avatars.com/api/?name=Mystery+Channel&background=a8d8ea&color=fff",
    verified: true,
    category: "mystery"
  },
  {
    id: 8,
    title: "Gothic Tales",
    thumbnail: "/uploads/thumbnails/delta-crossroads.jpg",
    duration: "19:45",
    views: "5.6K views",
    uploadedAt: "2 months ago",
    channel: "Gothic Productions",
    channelAvatar: "https://ui-avatars.com/api/?name=Gothic+Productions&background=aa96da&color=fff",
    verified: false,
    category: "horror"
  }
];

// GET /api/films - Get all films
router.get('/', async (req, res) => {
  try {
    const { category, search, limit = 50, offset = 0 } = req.query;

    let films = [...mockFilms];

    // Filter by category
    if (category && category !== 'all') {
      films = films.filter(film => film.category === category);
    }

    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase();
      films = films.filter(film =>
        film.title.toLowerCase().includes(searchLower) ||
        film.channel.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedFilms = films.slice(startIndex, endIndex);

    res.json({
      success: true,
      films: paginatedFilms,
      total: films.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching films:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/films/:id - Get single film
router.get('/:id', async (req, res) => {
  try {
    const filmId = parseInt(req.params.id);
    const film = mockFilms.find(f => f.id === filmId);

    if (!film) {
      return res.status(404).json({
        success: false,
        message: 'Film not found'
      });
    }

    res.json({
      success: true,
      film
    });
  } catch (error) {
    console.error('Error fetching film:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/films/categories - Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = [...new Set(mockFilms.map(film => film.category))];

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/films/user - Get films for authenticated user
router.get('/user', async (req, res) => {
  try {
    // TODO: Add authentication middleware to get user ID
    // For now, return empty array as placeholder

    res.json({
      success: true,
      films: [],
      total: 0
    });
  } catch (error) {
    console.error('Error fetching user films:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;