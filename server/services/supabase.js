const { createClient } = require('@supabase/supabase-js');
const { validateTMDBIdOrThrow } = require('./tmdbValidator');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Helper function to verify JWT token
async function verifyToken(token) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) throw error;
    return user;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Helper function to get user profile
async function getUserProfile(userId) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

// Helper function to get watched items
async function getWatchedItems(userId, limit = 30) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('watched_items')
    .select('*')
    .eq('user_id', userId)
    .order('last_watched', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// Helper function to add/update watched item
// For shows/anime: Updates the existing row with new season/episode (one row per show)
// For movies: One row per movie
async function upsertWatchedItem(userId, item) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Validate ID before inserting (TMDB for movies/shows, AniList for anime)
  if (item.mediaType === 'anime') {
    const { validateAniListIdOrThrow } = require('./anilistValidator');
    await validateAniListIdOrThrow(item.tmdbId, item.title);
  } else {
    await validateTMDBIdOrThrow(item.tmdbId, item.mediaType, item.title);
  }

  // Check if this show/movie already exists for this user (by tmdb_id and content_type only)
  // This means: one row per show, updated with latest episode watched
  const { data: existingData, error: selectError } = await supabase
    .from('watched_items')
    .select('id, season, episode')
    .eq('user_id', userId)
    .eq('tmdb_id', item.tmdbId)
    .eq('content_type', item.mediaType)
    .single();

  if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw selectError;
  }

  let result;
  if (existingData) {
    // Update existing record with new season/episode
    console.log(`📺 Updating watched item: ${item.title} - S${item.season || 1}E${item.episode || 1} (was S${existingData.season}E${existingData.episode})`);
    
    const { data, error } = await supabase
      .from('watched_items')
      .update({
        title: item.title,
        season: item.season || 1,
        episode: item.episode || 1,
        poster_url: item.posterPath || null,
        rating: item.rating || null,
        last_watched: new Date().toISOString()
      })
      .eq('id', existingData.id)
      .select();

    if (error) throw error;
    result = data;
  } else {
    // Insert new record
    console.log(`📺 Adding new watched item: ${item.title} - S${item.season || 1}E${item.episode || 1}`);
    
    const { data, error } = await supabase
      .from('watched_items')
      .insert({
        user_id: userId,
        content_type: item.mediaType,
        tmdb_id: item.tmdbId,
        title: item.title,
        season: item.season || 1,
        episode: item.episode || 1,
        poster_url: item.posterPath || null,
        rating: item.rating || null,
        last_watched: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    result = data;
  }

  return result;
}

// Helper function to get liked items
async function getLikedItems(userId) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('liked_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// Helper function to add liked item
async function addLikedItem(userId, item) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Validate ID before inserting (TMDB for movies/shows, AniList for anime)
  if (item.mediaType === 'anime') {
    const { validateAniListIdOrThrow } = require('./anilistValidator');
    await validateAniListIdOrThrow(item.tmdbId, item.title);
  } else {
    await validateTMDBIdOrThrow(item.tmdbId, item.mediaType, item.title);
  }

  const { data, error } = await supabase
    .from('liked_items')
    .insert({
      user_id: userId,
      content_type: item.mediaType,
      tmdb_id: item.tmdbId,
      title: item.title,
      poster_url: item.posterPath || null,
      created_at: new Date().toISOString()
    });

  if (error) {
    // Check if already exists
    if (error.code === '23505') {
      return { message: 'Item already liked' };
    }
    throw error;
  }
  return data;
}

// Helper function to remove liked item
async function removeLikedItem(userId, mediaType, tmdbId) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('liked_items')
    .delete()
    .eq('user_id', userId)
    .eq('content_type', mediaType)
    .eq('tmdb_id', tmdbId);

  if (error) throw error;
  return { success: true };
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

/**
 * Get user preferences (including subtitle language)
 */
async function getUserPreferences(userId) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Try to get from user_preferences table first
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }

  // Return default preferences if none exist
  if (!data) {
    return {
      user_id: userId,
      preferred_subtitle_language: null,
      auto_play_subtitles: true,
      subtitle_size: 'medium',
      created_at: null,
      updated_at: null
    };
  }

  return data;
}

/**
 * Update user preferences
 */
async function updateUserPreferences(userId, preferences) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Check if preferences exist
  const { data: existing, error: selectError } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    throw selectError;
  }

  const now = new Date().toISOString();
  let result;

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('user_preferences')
      .update({
        ...preferences,
        updated_at: now
      })
      .eq('user_id', userId)
      .select();

    if (error) throw error;
    result = data[0];
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        ...preferences,
        created_at: now,
        updated_at: now
      })
      .select();

    if (error) throw error;
    result = data[0];
  }

  return result;
}

/**
 * Set user's preferred subtitle language
 */
async function setPreferredSubtitleLanguage(userId, language) {
  return updateUserPreferences(userId, {
    preferred_subtitle_language: language
  });
}

/**
 * Get user's preferred subtitle language
 */
async function getPreferredSubtitleLanguage(userId) {
  const prefs = await getUserPreferences(userId);
  return prefs.preferred_subtitle_language;
}

module.exports = {
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
};
