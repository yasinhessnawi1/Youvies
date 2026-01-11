import axios from "axios";
import { handleAnimeApiErrors } from "./apiHelpers";

const BASE_URL = "https://api.anime.youvies.online/meta/anilist";

// Fetch trending anime shows
export const fetchAnime = async (page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`${BASE_URL}/trending`, {
      params: { page, perPage },
    });
    return handleAnimeApiErrors(response.data.results); // Return the processed response
  } catch (error) {
    console.error("Error fetching trending anime:", error.message);
    throw new Error(error.message);
  }
};

// Search for anime shows by title
export const searchAnime = async (title) => {
  console.log("searchAnime:", title);
  try {
    const response = await axios.get(`${BASE_URL}/${encodeURIComponent(title)}`);
    return handleAnimeApiErrors(response.data.results); // Return the processed response
  } catch (error) {
    console.error("Error searching anime:", error.message);
    return []; // Return empty array instead of throwing
  }
};

// Fetch anime by genre
export const fetchAnimeByGenre = async (genre, page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`${BASE_URL}/genres`, {
      params: { genres: genre, page, perPage },
    });
    return handleAnimeApiErrors(response.data.results); // Return the processed response
  } catch (error) {
    console.error("Error fetching anime by genre:", error.message);
    throw new Error(error.message);
  }
};

// Fetch detailed information about one anime
export const fetchOneAnime = async (id) => {
  try {
    const response = await axios.get(`${BASE_URL}/info/${id}`);
    return handleAnimeApiErrors(response.data); // Return the processed response
  } catch (error) {
    console.error("Error fetching anime details:", error.message);
    throw new Error(error.message);
  }
};

// Fetch popular anime
export const fetchPopularAnime = async (page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`${BASE_URL}/popular`, {
      params: { page, perPage },
    });
    const results = response.data?.results || response.data || [];
    return handleAnimeApiErrors(results);
  } catch (error) {
    console.error("Error fetching popular anime:", error.message);
    return []; // Return empty array instead of throwing
  }
};

// Fetch recent anime episodes (new episodes released)
// Note: This endpoint may not work with all providers, fallback to trending if it fails
export const fetchRecentAnimeEpisodes = async (page = 1, perPage = 20, provider = null) => {
  try {
    const params = { page, perPage };
    if (provider) params.provider = provider;
    
    const response = await axios.get(`${BASE_URL}/recent-episodes`, { params });
    const results = response.data?.results || response.data || [];
    return handleAnimeApiErrors(results);
  } catch (error) {
    console.error("Error fetching recent anime episodes:", error.message);
    // Fallback to trending if recent-episodes fails
    try {
      const fallbackResponse = await axios.get(`${BASE_URL}/trending`, {
        params: { page, perPage },
      });
      return handleAnimeApiErrors(fallbackResponse.data?.results || []);
    } catch (fallbackError) {
      console.error("Fallback to trending also failed:", fallbackError.message);
      return [];
    }
  }
};

// Fetch new anime episodes - alias for recent episodes
export const fetchNewAnimeEpisodes = async (page = 1, perPage = 20, provider = null) => {
  return fetchRecentAnimeEpisodes(page, perPage, provider);
};

// Fetch airing schedule
export const fetchAiringSchedule = async (weekDay = null, page = 1, perPage = 20) => {
  try {
    const params = { page, perPage };
    if (weekDay) {
      params.weekDay = weekDay;
    }
    const response = await axios.get(`${BASE_URL}/airing-schedule`, {
      params,
    });
    const results = response.data?.results || response.data || [];
    return handleAnimeApiErrors(results);
  } catch (error) {
    console.error("Error fetching airing schedule:", error.message);
    return []; // Return empty array instead of throwing
  }
};

// Fetch random anime
export const fetchRandomAnime = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/random-anime`);
    return handleAnimeApiErrors(response.data);
  } catch (error) {
    console.error("Error fetching random anime:", error.message);
    return null; // Return null instead of throwing
  }
};

// Advanced search for anime
// Note: The API may not support all parameters, using basic search as fallback
export const fetchAnimeAdvanced = async (params = {}) => {
  try {
    const {
      page = 1,
      perPage = 20,
      format = null,
      status = null,
      season = null,
      year = null,
      genres = null,
    } = params;

    // Build query params - only include non-null values
    const queryParams = { page, perPage };
    if (format) queryParams.format = format;
    if (status) queryParams.status = status;
    if (season) queryParams.season = season;
    if (year) queryParams.year = year;
    if (genres) queryParams.genres = genres;

    const response = await axios.get(`${BASE_URL}/advanced-search`, {
      params: queryParams,
    });
    const results = response.data?.results || response.data || [];
    return handleAnimeApiErrors(results);
  } catch (error) {
    console.error("Error fetching advanced anime search:", error.message);
    // Fallback to popular if advanced search fails
    try {
      const fallbackResponse = await axios.get(`${BASE_URL}/popular`, {
        params: { page, perPage: params.perPage || 20 },
      });
      return handleAnimeApiErrors(fallbackResponse.data?.results || []);
    } catch (fallbackError) {
      console.error("Fallback to popular also failed:", fallbackError.message);
      return [];
    }
  }
};

// Fetch episodes for an anime
export const fetchAnimeEpisodes = async (id) => {
  try {
    // Try the episodes endpoint with provider parameter (required for episodes with images)
    console.log(`[AnimeShowApi] Fetching episodes from: ${BASE_URL}/episodes/${id}?provider=zoro`);
    const response = await axios.get(`${BASE_URL}/episodes/${id}`, {
      params: { provider: 'zoro' }
    });
    const data = response.data;
    
    console.log('[AnimeShowApi] Episodes endpoint response:', {
      status: response.status,
      dataType: typeof data,
      isArray: Array.isArray(data),
      length: Array.isArray(data) ? data.length : null,
      dataKeys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : null
    });
    
    // Handle different response structures
    if (Array.isArray(data) && data.length > 0) {
      console.log('[AnimeShowApi] Returning episodes array, length:', data.length);
      return data;
    } else if (data && Array.isArray(data.episodes) && data.episodes.length > 0) {
      console.log('[AnimeShowApi] Returning data.episodes, length:', data.episodes.length);
      return data.episodes;
    } else if (data && data.results && Array.isArray(data.results) && data.results.length > 0) {
      console.log('[AnimeShowApi] Returning data.results, length:', data.results.length);
      return data.results;
    } else if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
      console.log('[AnimeShowApi] Returning data.data, length:', data.data.length);
      return data.data;
    }
    
    // If episodes endpoint returns empty array, try info endpoint
    console.log('[AnimeShowApi] Episodes endpoint returned empty, checking info endpoint...');
    const infoResponse = await axios.get(`${BASE_URL}/info/${id}`);
    const infoData = infoResponse.data;
    
    console.log('[AnimeShowApi] Info endpoint response:', {
      hasEpisodes: !!infoData?.episodes,
      episodesLength: Array.isArray(infoData?.episodes) ? infoData.episodes.length : null,
      totalEpisodes: infoData?.totalEpisodes,
      currentEpisode: infoData?.currentEpisode
    });
    
    // Check if episodes are in the info response
    if (infoData && Array.isArray(infoData.episodes) && infoData.episodes.length > 0) {
      console.log('[AnimeShowApi] Returning infoData.episodes, length:', infoData.episodes.length);
      return infoData.episodes;
    } else if (infoData && infoData.data && Array.isArray(infoData.data.episodes) && infoData.data.episodes.length > 0) {
      console.log('[AnimeShowApi] Returning infoData.data.episodes, length:', infoData.data.episodes.length);
      return infoData.data.episodes;
    }
    
    // Check for other possible episode fields
    const possibleEpisodeFields = ['episodeList', 'episode_list', 'episodesList', 'episodes_list'];
    for (const field of possibleEpisodeFields) {
      if (infoData && Array.isArray(infoData[field]) && infoData[field].length > 0) {
        console.log(`[AnimeShowApi] Found episodes in ${field}, length:`, infoData[field].length);
        return infoData[field];
      }
    }
    
    console.log('[AnimeShowApi] No episodes found in API responses, will generate from totalEpisodes');
    // Return null to indicate we need to generate episodes
    return null;
  } catch (error) {
    console.error("[AnimeShowApi] Error fetching anime episodes:", error.message);
    // Return null to indicate we need to generate episodes
    return null;
  }
};
