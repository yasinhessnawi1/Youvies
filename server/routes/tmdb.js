const express = require('express');
const router = express.Router();
const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'af1b71222807c315af18609d22be4cb3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Helper function to make TMDB API calls
async function tmdbRequest(endpoint, params = {}) {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
      params: {
        api_key: TMDB_API_KEY,
        ...params
      },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error('TMDB API error:', error.message);
    throw new Error('Failed to fetch data from TMDB');
  }
}

// GET /api/tmdb/movie/:id - Get movie details
router.get('/movie/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await tmdbRequest(`/movie/${id}`, {
      append_to_response: 'recommendations,credits,videos'
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/tv/:id - Get TV show details
router.get('/tv/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await tmdbRequest(`/tv/${id}`, {
      append_to_response: 'recommendations,credits,videos,external_ids'
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/tv/:id/season/:season - Get TV season details
router.get('/tv/:id/season/:season', async (req, res) => {
  try {
    const { id, season } = req.params;
    const data = await tmdbRequest(`/tv/${id}/season/${season}`);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/tv/:id/season/:season/episode/:episode - Get episode details
router.get('/tv/:id/season/:season/episode/:episode', async (req, res) => {
  try {
    const { id, season, episode } = req.params;
    const data = await tmdbRequest(`/tv/${id}/season/${season}/episode/${episode}`);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/search/movie - Search movies
router.get('/search/movie', async (req, res) => {
  try {
    const { query, page = 1 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const data = await tmdbRequest('/search/movie', { query, page });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/search/tv - Search TV shows
router.get('/search/tv', async (req, res) => {
  try {
    const { query, page = 1 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const data = await tmdbRequest('/search/tv', { query, page });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/popular/movies - Get popular movies
router.get('/popular/movies', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await tmdbRequest('/movie/popular', { page });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/popular/tv - Get popular TV shows
router.get('/popular/tv', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await tmdbRequest('/tv/popular', { page });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/genre/movies - Get movies by genre
router.get('/genre/movies', async (req, res) => {
  try {
    const { genre, page = 1 } = req.query;

    if (!genre) {
      return res.status(400).json({ error: 'Genre parameter is required' });
    }

    const data = await tmdbRequest('/discover/movie', {
      with_genres: genre,
      page,
      sort_by: 'popularity.desc'
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/genre/tv - Get TV shows by genre
router.get('/genre/tv', async (req, res) => {
  try {
    const { genre, page = 1 } = req.query;

    if (!genre) {
      return res.status(400).json({ error: 'Genre parameter is required' });
    }

    const data = await tmdbRequest('/discover/tv', {
      with_genres: genre,
      page,
      sort_by: 'popularity.desc'
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/trending/:type/:timeWindow - Get trending content
router.get('/trending/:type/:timeWindow', async (req, res) => {
  try {
    const { type, timeWindow } = req.params; // type: 'movie' or 'tv', timeWindow: 'day' or 'week'
    const { page = 1 } = req.query;

    const data = await tmdbRequest(`/trending/${type}/${timeWindow}`, { page });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/now-playing - Get now playing movies
router.get('/now-playing', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await tmdbRequest('/movie/now_playing', { page });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
