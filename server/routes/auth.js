const express = require('express');
const router = express.Router();
const {
  supabase,
  verifyToken,
  getUserProfile,
  getWatchedItems,
  upsertWatchedItem,
  getLikedItems,
  addLikedItem,
  removeLikedItem,
  getUserPreferences,
  updateUserPreferences,
  setPreferredSubtitleLanguage,
  getPreferredSubtitleLanguage
} = require('../services/supabase');

// Middleware to verify JWT token
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Authentication service not configured' });
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Fetch user profile
    const profile = await getUserProfile(data.user.id);

    res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        username: profile.username,
        created_at: profile.created_at
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register - User registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Authentication service not configured' });
    }

    // Sign up with Supabase - include username in metadata so trigger can use it
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Profile is automatically created by database trigger
    // Wait a moment for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        username
      },
      message: 'Registration successful. Please check your email to verify your account.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/logout - User logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Authentication service not configured' });
    }

    await supabase.auth.signOut();

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/user - Get user profile with watched list
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    const watchedItems = await getWatchedItems(req.user.id);
    const likedItems = await getLikedItems(req.user.id);

    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        username: profile.username,
        created_at: profile.created_at
      },
      watchedItems,
      likedItems
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// PUT /api/auth/user/watched - Add/update watched item
router.put('/user/watched', authMiddleware, async (req, res) => {
  try {
    const item = req.body;

    if (!item.mediaType || !item.tmdbId || !item.title) {
      return res.status(400).json({ error: 'mediaType, tmdbId, and title are required' });
    }

    await upsertWatchedItem(req.user.id, item);

    res.json({ success: true, message: 'Watched item updated' });
  } catch (error) {
    console.error('Update watched item error:', error);
    res.status(500).json({ error: 'Failed to update watched item' });
  }
});

// GET /api/auth/user/watched - Get watched items
router.get('/user/watched', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const watchedItems = await getWatchedItems(req.user.id, limit);

    res.json({ success: true, watchedItems });
  } catch (error) {
    console.error('Get watched items error:', error);
    res.status(500).json({ error: 'Failed to fetch watched items' });
  }
});

// POST /api/auth/user/liked - Add liked item
router.post('/user/liked', authMiddleware, async (req, res) => {
  try {
    const item = req.body;

    if (!item.mediaType || !item.tmdbId || !item.title) {
      return res.status(400).json({ error: 'mediaType, tmdbId, and title are required' });
    }

    await addLikedItem(req.user.id, item);

    res.json({ success: true, message: 'Item liked' });
  } catch (error) {
    console.error('Add liked item error:', error);
    res.status(500).json({ error: 'Failed to add liked item' });
  }
});

// DELETE /api/auth/user/liked/:mediaType/:tmdbId - Remove liked item
router.delete('/user/liked/:mediaType/:tmdbId', authMiddleware, async (req, res) => {
  try {
    const { mediaType, tmdbId } = req.params;

    await removeLikedItem(req.user.id, mediaType, parseInt(tmdbId));

    res.json({ success: true, message: 'Item unliked' });
  } catch (error) {
    console.error('Remove liked item error:', error);
    res.status(500).json({ error: 'Failed to remove liked item' });
  }
});

// GET /api/auth/user/liked - Get liked items
router.get('/user/liked', authMiddleware, async (req, res) => {
  try {
    const likedItems = await getLikedItems(req.user.id);

    res.json({ success: true, likedItems });
  } catch (error) {
    console.error('Get liked items error:', error);
    res.status(500).json({ error: 'Failed to fetch liked items' });
  }
});

// ============================================================================
// USER PREFERENCES ROUTES
// ============================================================================

// GET /api/auth/user/preferences - Get user preferences
router.get('/user/preferences', authMiddleware, async (req, res) => {
  try {
    const preferences = await getUserPreferences(req.user.id);
    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /api/auth/user/preferences - Update user preferences
router.put('/user/preferences', authMiddleware, async (req, res) => {
  try {
    const preferences = req.body;
    const updated = await updateUserPreferences(req.user.id, preferences);
    res.json({ success: true, preferences: updated });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// PUT /api/auth/user/preferences/subtitle-language - Set preferred subtitle language
router.put('/user/preferences/subtitle-language', authMiddleware, async (req, res) => {
  try {
    const { language } = req.body;
    
    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }
    
    const updated = await setPreferredSubtitleLanguage(req.user.id, language.toLowerCase());
    res.json({ 
      success: true, 
      message: `Preferred subtitle language set to ${language}`,
      preferredLanguage: language.toLowerCase()
    });
  } catch (error) {
    console.error('Set subtitle language error:', error);
    res.status(500).json({ error: 'Failed to set subtitle language' });
  }
});

// GET /api/auth/user/preferences/subtitle-language - Get preferred subtitle language
router.get('/user/preferences/subtitle-language', authMiddleware, async (req, res) => {
  try {
    const language = await getPreferredSubtitleLanguage(req.user.id);
    res.json({ 
      success: true, 
      preferredLanguage: language 
    });
  } catch (error) {
    console.error('Get subtitle language error:', error);
    res.status(500).json({ error: 'Failed to get subtitle language' });
  }
});

module.exports = router;
