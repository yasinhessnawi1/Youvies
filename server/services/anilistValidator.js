const axios = require('axios');

const ANILIST_BASE_URL = 'https://api.anime.youvies.online/meta/anilist';

/**
 * Validates an AniList ID by making a request to AniList API
 * @param {number} anilistId - The AniList ID to validate
 * @returns {Promise<{valid: boolean, data?: object, error?: string}>}
 */
async function validateAniListId(anilistId) {
  try {
    const url = `${ANILIST_BASE_URL}/info/${anilistId}`;
    const response = await axios.get(url, { timeout: 5000 });

    return {
      valid: true,
      data: response.data
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return { valid: false, error: 'AniList ID not found (404)' };
    }
    return {
      valid: false,
      error: error.message || 'AniList API error'
    };
  }
}

/**
 * Validates AniList ID and throws error if invalid
 * @param {number} anilistId - The AniList ID to validate
 * @param {string} title - Item title for error logging
 * @returns {Promise<object>} AniList data if valid
 */
async function validateAniListIdOrThrow(anilistId, title = '') {
  const result = await validateAniListId(anilistId);

  if (!result.valid) {
    console.warn(`⚠️ Invalid AniList ID: ${anilistId} - "${title}" - ${result.error}`);
    throw new Error(`Invalid AniList ID: ${result.error}`);
  }

  return result.data;
}

module.exports = {
  validateAniListId,
  validateAniListIdOrThrow
};