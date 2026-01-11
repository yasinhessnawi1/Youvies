// mediaService.js
import { handleApiErrors, TMDB_API_KEY, TMDB_BASE_URL } from './apiHelpers';

// Helper function to handle API requests
const fetchFromTmdb = async (endpoint, params = {}, show = false) => {
  let url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url += '?api_key=' + TMDB_API_KEY;
  url += Object.keys(params)
    .map((key) => `&${key}=${params[key]}`)
    .join('');
  if (show) {
    url += '&append_to_response=seasons&append_to_response=external_ids';
  }

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      console.warn(`⚠️ TMDB API returned 404 for ${endpoint}`);
      return null; // Return null for invalid TMDB IDs instead of throwing
    }
    console.warn('TMDB API returned an error:', response.status, response.statusText);
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.results && !data.id && !data.name && !data.title) {
    if (data) {
      return data;
    } else {
      console.warn('TMDB API returned null or missing data');
      return null;
    }
  }
  return data.results || data;
};

// Functions for Movies

export const fetchMovieDetails = async (movieId) => {
  return await fetchFromTmdb(`/movie/${movieId}`);
};

export const fetchNowPlayingMovies = async (page) => {
  return await fetchFromTmdb('/movie/now_playing', { page });
};

export const fetchPopularMovies = async (page) => {
  return await fetchFromTmdb('/movie/popular', { page });
};

export const fetchTrendingMovies = async (timeWindow = 'week', page = 1) => {
  return await fetchFromTmdb(`/trending/movie/${timeWindow}`, { page });
};

export const fetchTopRatedMovies = async (page = 1) => {
  return await fetchFromTmdb('/movie/top_rated', { page });
};

export const fetchUpcomingMovies = async (page = 1) => {
  return await fetchFromTmdb('/movie/upcoming', { page });
};

export const fetchMoviesByGenre = async (genreId, page = 1) => {
  return await fetchFromTmdb('/discover/movie', {
    with_genres: genreId,
    page,
  }).then();
};

// Functions for TV Shows

export const fetchShowDetails = async (seriesId) => {
  let data = await fetchFromTmdb(`/tv/${seriesId}`, {}, true);
  // Remove the specials or season 0.
  data.seasons = data.seasons.filter(season => season.season_number !== 0 && season.name !== 'Specials');
  return data;
};



export const fetchPopularShows = async (page) => {
  return await fetchFromTmdb('/tv/popular', { page });
};

export const fetchTrendingShows = async (timeWindow = 'week', page = 1) => {
  return await fetchFromTmdb(`/trending/tv/${timeWindow}`, { page });
};

export const fetchTopRatedShows = async (page = 1) => {
  return await fetchFromTmdb('/tv/top_rated', { page });
};

export const fetchAiringTodayShows = async (page = 1) => {
  return await fetchFromTmdb('/tv/airing_today', { page });
};

export const fetchOnTheAirShows = async (page = 1) => {
  return await fetchFromTmdb('/tv/on_the_air', { page });
};

// Note: Anime is now fetched from AnimeShowApi.jsx using the AniList API
// The TMDB anime fetch below is kept as a fallback but not used by default
// export const fetchPopularAnime = async (page) => {
//   return await fetchFromTmdb('/discover/tv', { page , sort_by : 'popularity.desc' , with_genres : '16,10759'});
// };

export const fetchShowsByGenre = async (genreId, page = 1) => {
  return await fetchFromTmdb('/discover/tv', {
    with_genres: genreId,
    page,
  });
};

// Search Functions

export const searchMovies = async (query, page = 1) => {
  return await fetchFromTmdb('/search/movie', {
    query,
    page,
  });
};

export const searchShows = async (query, page = 1) => {
  return await fetchFromTmdb('/search/tv', {
    query,
    page,
  });
};

/**
 * Fetches season details for a given TV series.
 * @param {number|string} seriesId - The ID of the TV series.
 * @param {number|string} seasonNumber - The season number to fetch details for.
 * @returns {Promise<object>} The season details including episodes.
 */
export const fetchTvSeasonDetails = async (seriesId, seasonNumber) => {
  return await fetchFromTmdb(`/tv/${seriesId}/season/${seasonNumber}`, {});
};

/**
 * Fetches episode details for a specific episode in a season.
 * @param {number|string} seriesId - The ID of the TV series.
 * @param {number|string} seasonNumber - The season number.
 * @param {number|string} episodeNumber - The episode number to fetch details for.
 * @returns {Promise<object>} The episode details.
 */
export const fetchTvEpisodeDetails = async (
  seriesId,
  seasonNumber,
  episodeNumber,
) => {
  return fetchFromTmdb(
    `/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`,
    {},
  );
};

// Functions for fetching recommendation for movies/shows
// Note: Anime recommendations are handled separately in AnimeShowApi
export const fetchRecommendations = async (movieId, type) => {
  // Don't try TMDB for anime - it won't work since anime IDs are from AniList
  if (type === 'anime') {
    return [];  // Anime recommendations handled separately
  }
  const tmdbType = type === 'movies' ? 'movie' : 'tv';
  return await fetchFromTmdb(`/${tmdbType}/${movieId}/recommendations`);
};
