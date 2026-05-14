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

// Direct AniList GraphQL fallback used when the proxy returns 5xx.
// Mirrors the field shape the rest of the app expects from the proxy's /info/{id}.
const fetchAnimeFromAniListDirect = async (id) => {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title { romaji english native userPreferred }
        coverImage { extraLarge large medium color }
        bannerImage
        description(asHtml: false)
        season
        seasonYear
        format
        status
        episodes
        duration
        averageScore
        popularity
        isAdult
        countryOfOrigin
        genres
        synonyms
        startDate { year month day }
        endDate { year month day }
        nextAiringEpisode { airingAt timeUntilAiring episode }
        trailer { id site thumbnail }
        studios(isMain: true) { nodes { name } }
        recommendations(perPage: 20, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id
              idMal
              title { romaji english userPreferred }
              coverImage { large }
              averageScore
              format
              episodes
              season
              seasonYear
            }
          }
        }
      }
    }
  `;
  const res = await axios.post(
    'https://graphql.anilist.co',
    { query, variables: { id: parseInt(id, 10) } },
    { headers: { 'Content-Type': 'application/json' } }
  );
  const media = res.data?.data?.Media;
  if (!media) return null;

  const recommendations = (media.recommendations?.nodes || [])
    .map((n) => n.mediaRecommendation)
    .filter(Boolean)
    .map((r) => ({
      id: r.id,
      malId: r.idMal,
      title: r.title,
      image: r.coverImage?.large,
      cover: r.coverImage?.large,
      rating: r.averageScore,
      totalEpisodes: r.episodes,
      season: r.season,
      releaseDate: r.seasonYear,
      format: r.format,
    }));

  // Shape the response so it matches what InfoPage / VidLink etc. already read.
  return {
    id: media.id,
    malId: media.idMal,
    title: media.title,
    image: media.coverImage?.extraLarge || media.coverImage?.large,
    cover: media.bannerImage || media.coverImage?.large,
    color: media.coverImage?.color,
    description: media.description,
    season: media.season,
    releaseDate: media.seasonYear,
    status: media.status,
    totalEpisodes: media.episodes,
    currentEpisode: media.nextAiringEpisode
      ? Math.max((media.nextAiringEpisode.episode || 1) - 1, 0)
      : media.episodes,
    duration: media.duration,
    rating: media.averageScore,
    popularity: media.popularity,
    isAdult: media.isAdult,
    countryOfOrigin: media.countryOfOrigin,
    genres: media.genres,
    synonyms: media.synonyms,
    startDate: media.startDate,
    endDate: media.endDate,
    nextAiringEpisode: media.nextAiringEpisode,
    trailer: media.trailer,
    studios: (media.studios?.nodes || []).map((s) => s.name),
    recommendations,
    subOrDub: 'sub',
  };
};

// Fetch detailed information about one anime
export const fetchOneAnime = async (id) => {
  try {
    const response = await axios.get(`${BASE_URL}/info/${id}`);
    return handleAnimeApiErrors(response.data); // Return the processed response
  } catch (error) {
    console.error("Error fetching anime details:", error.message);
    // Fallback: the proxy (api.anime.youvies.online) returns 5xx for /info/{id}.
    // Hit AniList GraphQL directly so anime detail pages still load.
    try {
      console.warn(`[AnimeShowApi] /info/${id} failed, falling back to AniList GraphQL`);
      const direct = await fetchAnimeFromAniListDirect(id);
      if (direct) return direct;
    } catch (fallbackErr) {
      console.error('[AnimeShowApi] AniList direct fallback failed:', fallbackErr.message);
    }
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
        params: { page: params.page || 1, perPage: params.perPage || 20 },
      });
      return handleAnimeApiErrors(fallbackResponse.data?.results || []);
    } catch (fallbackError) {
      console.error("Fallback to popular also failed:", fallbackError.message);
      return [];
    }
  }
};

// Direct Jikan (MyAnimeList) fallback for episode lists when the proxy is broken.
// Paginates through Jikan, capping at maxPages to avoid hammering on long-running anime.
// Honors 429 Retry-After to recover from rate limits instead of giving up mid-list.
const fetchEpisodesFromJikan = async (malId, maxPages = 20) => {
  if (!malId) return null;
  const episodes = [];
  let page = 1;
  let hasNext = true;
  let lastVisiblePage = null;
  while (hasNext && page <= maxPages) {
    let attempt = 0;
    let success = false;
    while (attempt < 3 && !success) {
      try {
        const res = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/episodes`, {
          params: { page },
          timeout: 15000,
        });
        const data = res.data?.data || [];
        episodes.push(...data);
        const pagination = res.data?.pagination;
        hasNext = !!pagination?.has_next_page;
        lastVisiblePage = pagination?.last_visible_page ?? lastVisiblePage;
        success = true;
      } catch (err) {
        const status = err.response?.status;
        if (status === 429) {
          const retryAfter = parseInt(err.response.headers?.['retry-after'] || '2', 10);
          console.warn(`[AnimeShowApi] Jikan 429 on page ${page}, retry in ${retryAfter}s`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          attempt += 1;
        } else {
          console.warn(`[AnimeShowApi] Jikan page ${page} failed:`, err.message);
          attempt = 3;
        }
      }
    }
    if (!success) break;
    page += 1;
    // Jikan rate limit is 3 req/s and 60/min — keep ~500ms gap between pages.
    if (hasNext) await new Promise((r) => setTimeout(r, 500));
  }
  if (episodes.length === 0) return null;
  if (lastVisiblePage && episodes.length < lastVisiblePage * 50) {
    console.warn(`[AnimeShowApi] Jikan returned ${episodes.length} eps but last_visible_page=${lastVisiblePage} — list may be truncated.`);
  }
  return episodes.map((ep) => ({
    number: ep.mal_id,
    title: ep.title,
    // Jikan doesn't expose episode thumbnails — leave null so the UI shows cover fallback.
    image: null,
    duration: null,
    aired: ep.aired,
    filler: ep.filler,
    recap: ep.recap,
  }));
};

// Fetch episodes for an anime
export const fetchAnimeEpisodes = async (id, malId = null) => {
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
    
    console.log('[AnimeShowApi] No episodes found in API responses, trying Jikan fallback...');
    const jikanEps = await fetchEpisodesFromJikan(malId);
    if (jikanEps && jikanEps.length > 0) {
      console.log('[AnimeShowApi] Returning Jikan episodes, length:', jikanEps.length);
      return jikanEps;
    }
    // Return null to indicate we need to generate episodes
    return null;
  } catch (error) {
    console.error("[AnimeShowApi] Error fetching anime episodes:", error.message);
    // Proxy is down — try Jikan with MAL id before giving up.
    try {
      const jikanEps = await fetchEpisodesFromJikan(malId);
      if (jikanEps && jikanEps.length > 0) {
        console.log('[AnimeShowApi] Returning Jikan episodes after proxy error, length:', jikanEps.length);
        return jikanEps;
      }
    } catch (jikanErr) {
      console.error('[AnimeShowApi] Jikan fallback failed:', jikanErr.message);
    }
    return null;
  }
};
