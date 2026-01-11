import {
  fetchMovieDetails,
  fetchMoviesByGenre,
  fetchPopularMovies,
  fetchPopularShows,
  fetchShowDetails,
  fetchShowsByGenre,
  searchMovies,
  searchShows,
  fetchTrendingMovies,
  fetchTopRatedMovies,
  fetchUpcomingMovies,
  fetchNowPlayingMovies,
  fetchTrendingShows,
  fetchTopRatedShows,
  fetchAiringTodayShows,
  fetchOnTheAirShows,
} from './MediaService';
import {
  fetchAnime,
  fetchOneAnime,
  searchAnime,
  fetchAnimeByGenre,
  fetchPopularAnime,
  fetchRecentAnimeEpisodes,
  fetchNewAnimeEpisodes,
  fetchAiringSchedule,
  fetchRandomAnime,
  fetchAnimeAdvanced,
} from './AnimeShowApi';

/**
 * Fetches a large batch of random items for the mosaic display
 * @param {Object} filters - { movies: boolean, shows: boolean, anime: boolean }
 * @param {number} page - Page number for pagination
 * @param {number} itemsPerSource - Number of items to fetch per source (default: 100)
 * @returns {Promise<Array>} Array of items with type field
 */
export const fetchRandomMosaicItems = async (filters = { movies: true, shows: true, anime: true }, page = 1, itemsPerSource = 100) => {
  const results = [];
  const promises = [];

  // Calculate pages needed to get desired items (TMDB returns 20 per page)
  const tmdbPagesNeeded = Math.ceil(itemsPerSource / 20);
  const animePagesNeeded = Math.ceil(itemsPerSource / 20);

  if (filters.movies) {
    // Fetch from multiple movie endpoints to get variety
    const moviePromises = [];
    for (let p = page; p < page + tmdbPagesNeeded; p++) {
      moviePromises.push(
        fetchPopularMovies(p).catch(() => []),
        fetchTrendingMovies('week', p).catch(() => []),
        fetchTopRatedMovies(p).catch(() => []),
        fetchNowPlayingMovies(p).catch(() => [])
      );
    }
    promises.push(
      Promise.all(moviePromises).then(movieResults => {
        const movies = movieResults.flat().filter(Boolean);
        // Remove duplicates by id
        const uniqueMovies = [...new Map(movies.map(m => [m.id, m])).values()];
        return uniqueMovies.slice(0, itemsPerSource).map(m => ({ ...m, type: 'movies' }));
      })
    );
  }

  if (filters.shows) {
    // Fetch from multiple show endpoints to get variety
    const showPromises = [];
    for (let p = page; p < page + tmdbPagesNeeded; p++) {
      showPromises.push(
        fetchPopularShows(p).catch(() => []),
        fetchTrendingShows('week', p).catch(() => []),
        fetchTopRatedShows(p).catch(() => []),
        fetchOnTheAirShows(p).catch(() => [])
      );
    }
    promises.push(
      Promise.all(showPromises).then(showResults => {
        const shows = showResults.flat().filter(Boolean);
        // Remove duplicates by id
        const uniqueShows = [...new Map(shows.map(s => [s.id, s])).values()];
        return uniqueShows.slice(0, itemsPerSource).map(s => ({ ...s, type: 'shows' }));
      })
    );
  }

  if (filters.anime) {
    // Fetch from multiple anime endpoints to get variety
    const animePromises = [];
    for (let p = page; p < page + animePagesNeeded; p++) {
      animePromises.push(
        fetchAnime(p, 20).catch(() => []),
        fetchPopularAnime(p, 20).catch(() => [])
      );
    }
    promises.push(
      Promise.all(animePromises).then(animeResults => {
        const anime = animeResults.flat().filter(Boolean);
        // Remove duplicates by id
        const uniqueAnime = [...new Map(anime.map(a => [a.id, a])).values()];
        return uniqueAnime.slice(0, itemsPerSource).map(a => ({ ...a, type: 'anime' }));
      })
    );
  }

  const allResults = await Promise.all(promises);
  const combinedResults = allResults.flat();
  
  // Shuffle the results for randomness
  return shuffleArray(combinedResults);
};

/**
 * Fisher-Yates shuffle algorithm for randomizing array
 */
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const fetchItemsByGenre = async (category, genre, page) => {
  switch (category) {
    case 'movies':
      return await fetchMoviesByGenre(genre, page);
    case 'shows':
      return await fetchShowsByGenre(genre, page);
    case 'anime':
      return await fetchAnimeByGenre(genre, page);
    default:
      return null;
  }
};

export const fetchItems = async (category, page) => {
  switch (category) {
    case 'movies':
      return await fetchPopularMovies(page);
    case 'shows':
      return await fetchPopularShows(page);
    case 'anime':
      const animeResults = await fetchAnime(page, 20);
      // Map anime results to include type field
      return animeResults.map(anime => ({ ...anime, type: 'anime' }));
    default:
      console.log('Invalid category:', category);
      break;
  }
};

export const fetchOneItem = async (category, id, type) => {
  let result = null;

  switch (category) {
    case 'movies':
      result = await fetchMovieDetails(id);
      return result ? { ...result, type: 'movies' } : null;
    case 'shows':
      result = await fetchShowDetails(id);
      return result ? { ...result, type: 'shows' } : null;
    case 'anime':
      result = await fetchOneAnime(id);
      return result ? { ...result, type: 'anime' } : null;
    case 'home':
      if (type === 'movie') {
        result = await fetchMovieDetails(id);
        return result ? { ...result, type: 'movies' } : null;
      } else if (type === 'show') {
        result = await fetchShowDetails(id);
        return result ? { ...result, type: 'shows' } : null;
      } else if (type === 'anime') {
        result = await fetchOneAnime(id);
        return result ? { ...result, type: 'anime' } : null;
      }
      break;
    default:
      result = await fetchMovieDetails(id);
      return result ? { ...result, type: 'movies' } : null;
  }

  return null;
};

export const searchItems = async (category, title) => {
  //remove spetial carachters from title
  switch (category) {
    case 'movies':
      return await searchMovies(title).then((movies) =>
        movies.map((movie) => ({ ...movie, type: 'movies' })),
      );
    case 'shows':
      return await searchShows(title).then((shows) =>
        shows.map((show) => ({ ...show, type: 'shows' })),
      );
    case 'anime':
      return await searchAnime(title).then((anime) =>
        anime.map((item) => ({ ...item, type: 'anime' })),
      );
    case 'home':
      const results = await Promise.all([
        searchShows(title).then((shows) =>
          shows.map((show) => ({ ...show, type: 'shows' })),
        ),
        searchMovies(title).then((movies) =>
          movies.map((movie) => ({ ...movie, type: 'movies' })),
        ),
        searchAnime(title).then((anime) =>
          anime.map((item) => ({ ...item, type: 'anime' })),
        ).catch(() => []), // Don't fail if anime search fails
      ]);
      return results.flat();
    default:
      return [];
  }
};

/**
 * Fetches items for carousels based on category and list type
 * @param {string} category - 'movies', 'shows', or 'anime'
 * @param {string} listType - 'trending', 'top_rated', 'upcoming', 'now_playing', 'airing_today', 'on_the_air', 'popular', 'recent', 'airing_schedule', 'random', 'top_rated_anime'
 * @param {number} page - Page number (default: 1)
 * @param {object} extraParams - Additional parameters for specific list types (e.g., { timeWindow: 'day' } for trending)
 * @returns {Promise<Array>} Array of items with type field
 */
export const fetchCarouselItems = async (category, listType, page = 1, extraParams = {}) => {
  try {
    let results = [];

    switch (category) {
      case 'movies':
        switch (listType) {
          case 'trending':
            results = await fetchTrendingMovies(extraParams.timeWindow || 'week', page);
            break;
          case 'top_rated':
            results = await fetchTopRatedMovies(page);
            break;
          case 'upcoming':
            results = await fetchUpcomingMovies(page);
            break;
          case 'now_playing':
            results = await fetchNowPlayingMovies(page);
            break;
          case 'popular':
            results = await fetchPopularMovies(page);
            break;
          default:
            console.warn(`Unknown listType for movies: ${listType}`);
            results = await fetchPopularMovies(page);
        }
        return results.map((item) => ({ ...item, type: 'movies' }));

      case 'shows':
        switch (listType) {
          case 'trending':
            results = await fetchTrendingShows(extraParams.timeWindow || 'week', page);
            break;
          case 'top_rated':
            results = await fetchTopRatedShows(page);
            break;
          case 'airing_today':
            results = await fetchAiringTodayShows(page);
            break;
          case 'on_the_air':
            results = await fetchOnTheAirShows(page);
            break;
          case 'popular':
            results = await fetchPopularShows(page);
            break;
          default:
            console.warn(`Unknown listType for shows: ${listType}`);
            results = await fetchPopularShows(page);
        }
        return results.map((item) => ({ ...item, type: 'shows' }));

      case 'anime':
        switch (listType) {
          case 'trending':
            results = await fetchAnime(page, 20);
            break;
          case 'popular':
            results = await fetchPopularAnime(page, 20);
            break;
          case 'recent':
            results = await fetchRecentAnimeEpisodes(page, 20);
            break;
          case 'new_episodes':
            results = await fetchNewAnimeEpisodes(page, 20);
            break;
          case 'airing_schedule':
            results = await fetchAiringSchedule(extraParams.weekDay || null, page, 20);
            break;
          case 'random':
            const randomAnime = await fetchRandomAnime();
            results = randomAnime ? [randomAnime] : [];
            break;
          case 'top_rated_anime':
            // Fetch anime movies (different from popular TV anime)
            results = await fetchAnimeAdvanced({
              page,
              perPage: 20,
              format: 'MOVIE',
            });
            break;
          case 'seasonal':
            // Fetch current/recent seasonal anime
            const currentYear = new Date().getFullYear();
            results = await fetchAnimeAdvanced({
              page,
              perPage: 20,
              year: extraParams.year || currentYear,
              season: extraParams.season || null,
            });
            break;
          default:
            console.warn(`Unknown listType for anime: ${listType}`);
            results = await fetchAnime(page, 20);
        }
        return results.map((item) => ({ ...item, type: 'anime' }));

      default:
        console.warn(`Unknown category: ${category}`);
        return [];
    }
  } catch (error) {
    console.error(`Error fetching carousel items for ${category}/${listType}:`, error);
    return [];
  }
};
