import { fetchRecommendations } from '../api/MediaService';
import { fetchOneAnime } from '../api/AnimeShowApi';
import { fetchCarouselItems } from '../api/ItemsApi';

/**
 * Aggregates recommendations from user's watched items
 * @param {Array} watchedItems - Array of watched items from AuthContext
 * @param {string} mediaType - 'movies', 'shows', or 'anime'
 * @param {number} maxPerItem - Maximum recommendations to fetch per watched item (default: 10)
 * @param {number} maxTotal - Maximum total recommendations to return (default: 20)
 * @returns {Promise<Array>} Array of unique recommendations sorted by frequency and rating
 */
export async function getAggregatedRecommendations(
  watchedItems,
  mediaType,
  maxPerItem = 10,
  maxTotal = 20
) {
  if (!watchedItems || watchedItems.length === 0) {
    return [];
  }

  // Filter watched items by mediaType
  const filteredItems = watchedItems.filter((item) => {
    const itemType = item.type || item.content_type;
    return itemType === mediaType;
  });

  if (filteredItems.length === 0) {
    return [];
  }

  // Limit to first 10 watched items to avoid too many API calls
  const itemsToProcess = filteredItems.slice(0, 10);
  const recommendationPromises = [];

  // Fetch recommendations for each watched item
  for (const item of itemsToProcess) {
    const itemId = item.id || item.tmdb_id;
    if (!itemId) continue;

    try {
      if (mediaType === 'anime') {
        // For anime, fetch the full anime info which includes recommendations
        const animeInfo = await fetchOneAnime(itemId);
        if (animeInfo && animeInfo.recommendations) {
          const recommendations = Array.isArray(animeInfo.recommendations)
            ? animeInfo.recommendations.slice(0, maxPerItem)
            : [];
          recommendationPromises.push(
            Promise.resolve(recommendations.map((rec) => ({ ...rec, type: 'anime' })))
          );
        } else {
          recommendationPromises.push(Promise.resolve([]));
        }
      } else {
        // For movies/shows, use TMDB recommendations
        const tmdbType = mediaType === 'movies' ? 'movies' : 'shows';
        const recommendations = await fetchRecommendations(itemId, tmdbType);
        const limitedRecs = (recommendations || []).slice(0, maxPerItem).map((rec) => ({
          ...rec,
          type: mediaType,
        }));
        recommendationPromises.push(Promise.resolve(limitedRecs));
      }
    } catch (error) {
      console.error(`Error fetching recommendations for ${mediaType} ${itemId}:`, error);
      recommendationPromises.push(Promise.resolve([]));
    }
  }

  // Wait for all recommendations to be fetched
  const allRecommendations = await Promise.all(recommendationPromises);
  const flatRecommendations = allRecommendations.flat();

  // Aggregate and deduplicate recommendations
  const recommendationMap = new Map();

  for (const rec of flatRecommendations) {
    const recId = rec.id;
    if (!recId) continue;

    if (recommendationMap.has(recId)) {
      // Increment frequency count
      const existing = recommendationMap.get(recId);
      existing.frequency = (existing.frequency || 1) + 1;
      // Keep the highest rating
      if (rec.vote_average && (!existing.vote_average || rec.vote_average > existing.vote_average)) {
        existing.vote_average = rec.vote_average;
      }
    } else {
      recommendationMap.set(recId, {
        ...rec,
        frequency: 1,
      });
    }
  }

  // Convert map to array and sort by frequency (descending), then by rating (descending)
  const sortedRecommendations = Array.from(recommendationMap.values())
    .sort((a, b) => {
      // First sort by frequency
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      // Then by rating
      const ratingA = a.vote_average || a.rating || 0;
      const ratingB = b.vote_average || b.rating || 0;
      return ratingB - ratingA;
    })
    .slice(0, maxTotal);

  // Remove frequency field before returning (it was just for sorting)
  return sortedRecommendations.map(({ frequency, ...rec }) => rec);
}

/**
 * Gets random/popular items as fallback when user has no watched items
 * @param {string} mediaType - 'movies', 'shows', or 'anime'
 * @param {number} count - Number of items to return (default: 20)
 * @returns {Promise<Array>} Array of popular/random items
 */
export async function getFallbackRecommendations(mediaType, count = 20) {
  try {
    if (mediaType === 'anime') {
      // For anime, use popular
      return await fetchCarouselItems('anime', 'popular', 1);
    } else {
      // For movies/shows, use popular
      return await fetchCarouselItems(mediaType, 'popular', 1);
    }
  } catch (error) {
    console.error(`Error fetching fallback recommendations for ${mediaType}:`, error);
    return [];
  }
}
