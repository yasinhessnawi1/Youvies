const axios = require('axios');

const TMDB_API_KEY = 'af1b71222807c315af18609d22be4cb3';

/**
 * Validates a TMDB ID by making a request to TMDB API
 * @param {number} tmdbId - The TMDB ID to validate
 * @param {string} contentType - 'movies' or 'shows' or 'anime'
 * @returns {Promise<{valid: boolean, data?: object, error?: string}>}
 */
async function validateTMDBId(tmdbId, contentType) {
  try {
    // Map content type to TMDB endpoint
    let endpoint;
    if (contentType === 'movies') {
      endpoint = 'movie';
    } else if (contentType === 'shows') {
      endpoint = 'tv';
    } else if (contentType === 'anime') {
      // Anime uses TV endpoint in TMDB
      endpoint = 'tv';
    } else {
      return { valid: false, error: 'Invalid content type' };
    }

    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const response = await axios.get(url, { timeout: 5000 });

    return {
      valid: true,
      data: response.data
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return { valid: false, error: 'TMDB ID not found (404)' };
    }
    return {
      valid: false,
      error: error.message || 'TMDB API error'
    };
  }
}

/**
 * Validates TMDB ID and throws error if invalid
 * @param {number} tmdbId - The TMDB ID to validate
 * @param {string} contentType - 'movies' or 'shows' or 'anime'
 * @param {string} title - Item title for error logging
 * @returns {Promise<object>} TMDB data if valid
 */
async function validateTMDBIdOrThrow(tmdbId, contentType, title = '') {
  // Skip TMDB validation for anime since anime uses AniList IDs
  if (contentType === 'anime') {
    console.log(`ℹ️ Skipping TMDB validation for anime ID: ${tmdbId} - "${title}"`);
    return null; // Return null to indicate validation was skipped
  }

  const result = await validateTMDBId(tmdbId, contentType);

  if (!result.valid) {
    console.warn(`⚠️ Invalid TMDB ID: ${tmdbId} (${contentType}) - "${title}" - ${result.error}`);
    throw new Error(`Invalid TMDB ID: ${result.error}`);
  }

  return result.data;
}

module.exports = {
  validateTMDBId,
  validateTMDBIdOrThrow
};