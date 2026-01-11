import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from 'react';
import { fetchItems, fetchItemsByGenre, fetchOneItem, fetchCarouselItems } from '../api/ItemsApi';
import {
  fetchRecommendations,
  fetchTvSeasonDetails,
} from '../api/MediaService';
import { useAuth } from './AuthContext';
import { getAggregatedRecommendations, getFallbackRecommendations } from '../services/recommendationService';

const ItemContext = createContext();
const CACHE_DURATION = 1000 * 60 * 10; // 10 min

export const ItemProvider = ({ children }) => {
  const [items, setItems] = useState({});
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pageTracker, setPageTracker] = useState({});
  const [cacheTime, setCacheTime] = useState(Date.now());
  const [itemsCache, setItemsCache] = useState({});
  const { watchedItems } = useAuth();
  const hasFetched = useRef({});

  useEffect(() => {
    const initializeItems = async () => {
      const cachedItems = localStorage.getItem('cachedItems');
      const cachedTime = localStorage.getItem('cacheTime');

      if (
        cachedItems &&
        cachedTime &&
        Date.now() - cachedTime < CACHE_DURATION
      ) {
        setItems(JSON.parse(cachedItems));
        setCacheTime(parseInt(cachedTime, 10));
      } else {
        localStorage.removeItem('cachedItems');
        localStorage.removeItem('cacheTime');
      }
    };

    initializeItems();
  }, []);

  useEffect(() => {
    if (Object.keys(items).length > 0) {
      localStorage.setItem('cachedItems', JSON.stringify(items));
      localStorage.setItem('cacheTime', cacheTime.toString());
    }
  }, [items, cacheTime]);

  const fetchMoreItems = useCallback(
    async (contentType, genre = null) => {
      const key = `${contentType}-${genre || 'home'}`;
      const currentPage = pageTracker[key] || 1;
      let nextPage = currentPage + 1;

      setIsLoading(true);

      try {
        const moreItems = genre
          ? await fetchItemsByGenre(contentType, genre, nextPage, 20)
          : await fetchItems(contentType, nextPage, 20);
        moreItems.forEach((item) => (item.type = contentType));

        setItems((prevItems) => ({
          ...prevItems,
          [key]: [...(prevItems[key] || []), ...moreItems],
        }));

        setPageTracker((prevTracker) => ({
          ...prevTracker,
          [key]: nextPage,
        }));

        return moreItems;
      } catch (error) {
        console.error('Error fetching more items:', error);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [pageTracker],
  );

  const fetchAllItems = useCallback(async () => {
    if (items['movies-home'] && items['shows-home'] && items['anime-home']) {
      return;
    }

    setIsLoading(true);
    try {
      // Fetch trending items for banners (more visually appealing and current)
      const [movies, shows, anime] = await Promise.all([
        fetchCarouselItems('movies', 'trending', 1, { timeWindow: 'week' }),
        fetchCarouselItems('shows', 'trending', 1, { timeWindow: 'week' }),
        fetchCarouselItems('anime', 'trending', 1),
      ]);

      const fetchedItems = {
        'movies-home': movies,
        'shows-home': shows,
        'anime-home': anime,
      };

      setItems((prevItems) => ({ ...prevItems, ...fetchedItems }));
      setCacheTime(Date.now());
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [items]);

  const fetchGenreItems = useCallback(
    async (contentType, genre) => {
      const itemKey = `${contentType}-${genre}`;

      if (items[itemKey]) {
        return items[itemKey];
      }

      if (!hasFetched.current[itemKey]) {
        setIsLoading(true);
        try {
          const genreItems = await fetchItemsByGenre(contentType, genre, 1);
          console.log('genreItems:', itemKey);
          genreItems.forEach((item) => (item.type = contentType));

          setItems((prevItems) => ({
            ...prevItems,
            [itemKey]: genreItems,
          }));
          setCacheTime(Date.now());
          hasFetched.current[itemKey] = true;
          return genreItems;
        } catch (error) {
          console.error('Error fetching genre items:', error);
          return [];
        } finally {
          setIsLoading(false);
        }
      }
    },
    [items],
  );

  const fetchMediaInfo = useCallback(
    async (mediaId, category) => {
      const cacheKey = `${category}-${mediaId}`;
      if (itemsCache[cacheKey]) {
        return itemsCache[cacheKey];
      }

      setIsLoading(true);
      try {
        const item = await fetchOneItem(category, mediaId);
        if (!item) {
          console.error('Failed to fetch item details');
          return null;
        }

        if (category === 'movies') {
          const response = await fetchRecommendations(mediaId, 'movies');
          item.recommendations = (response || []).map((movie) => ({ ...movie, type: 'movies' }));
        } else if (category === 'shows') {
          const response = await fetchRecommendations(mediaId, 'shows');
          item.recommendations = (response || []).map((show) => ({ ...show, type: 'shows' }));
        } else if (category === 'anime') {
          // Anime recommendations from AniList API are included in the anime details
          // The fetchOneAnime response already includes recommendations
          item.recommendations = Array.isArray(item.recommendations)
            ? item.recommendations.map((anime) => ({ ...anime, type: 'anime' }))
            : [];
        }
        setItemsCache((prevCache) => ({
          ...prevCache,
          [cacheKey]: item,
        }));

        return item;
      } catch (error) {
        console.error('Error fetching media info:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [itemsCache],
  );

  const fetchSeasonEpisodes = useCallback(
    async (mediaId, seasonNumber) => {
      const cacheKey = `${mediaId}-season-${seasonNumber}`;
      if (itemsCache[cacheKey]) {
        return itemsCache[cacheKey];
      }

      setIsLoading(true);
      try {
        const episodes = await fetchTvSeasonDetails(mediaId, seasonNumber);

        setItemsCache((prevCache) => ({
          ...prevCache,
          [cacheKey]: episodes,
        }));

        return episodes;
      } catch (error) {
        console.error(
          `Error fetching episodes for season ${seasonNumber}:`,
          error,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [itemsCache],
  );

  const fetchCarouselList = useCallback(
    async (category, listType, page = 1, extraParams = {}) => {
      // Use consistent cache key without page for single-page carousels
      const cacheKey = `${category}-${listType}`;
      
      // Check cache first
      if (items[cacheKey] && items[cacheKey].length > 0) {
        return items[cacheKey];
      }

      // Prevent duplicate concurrent requests
      if (hasFetched.current[cacheKey] === 'fetching') {
        // Wait a bit and check if data arrived
        await new Promise(resolve => setTimeout(resolve, 100));
        if (items[cacheKey] && items[cacheKey].length > 0) {
          return items[cacheKey];
        }
        return [];
      }
      
      hasFetched.current[cacheKey] = 'fetching';

      try {
        const carouselItems = await fetchCarouselItems(category, listType, page, extraParams);
        
        if (carouselItems && carouselItems.length > 0) {
          setItems((prevItems) => ({
            ...prevItems,
            [cacheKey]: carouselItems,
          }));
          setCacheTime(Date.now());
          hasFetched.current[cacheKey] = 'done';
        } else {
          hasFetched.current[cacheKey] = 'empty';
        }
        
        return carouselItems || [];
      } catch (error) {
        console.error(`Error fetching carousel list ${category}/${listType}:`, error);
        hasFetched.current[cacheKey] = 'error';
        return [];
      }
    },
    [items],
  );

  const fetchUserRecommendations = useCallback(
    async (mediaType) => {
      const cacheKey = `recommendations-${mediaType}`;
      
      // Check cache first
      if (items[cacheKey]) {
        return items[cacheKey];
      }

      setIsLoading(true);
      try {
        let recommendations = [];
        
        // Get recommendations from watched items
        if (watchedItems && watchedItems.length > 0) {
          recommendations = await getAggregatedRecommendations(watchedItems, mediaType);
        }
        
        // If no recommendations, use fallback
        if (recommendations.length === 0) {
          recommendations = await getFallbackRecommendations(mediaType);
        }
        
        setItems((prevItems) => ({
          ...prevItems,
          [cacheKey]: recommendations,
        }));
        
        setCacheTime(Date.now());
        return recommendations;
      } catch (error) {
        console.error(`Error fetching user recommendations for ${mediaType}:`, error);
        // Try fallback on error
        try {
          const fallback = await getFallbackRecommendations(mediaType);
          return fallback;
        } catch (fallbackError) {
          console.error(`Error fetching fallback recommendations:`, fallbackError);
          return [];
        }
      } finally {
        setIsLoading(false);
      }
    },
    [items, watchedItems],
  );

  const value = {
    items,
    genres,
    selectedGenre,
    setSelectedGenre,
    setGenres,
    isLoading,
    watchedItems,
    fetchAllItems,
    fetchGenreItems,
    fetchMoreItems,
    fetchMediaInfo,
    fetchSeasonEpisodes,
    fetchCarouselList,
    fetchUserRecommendations,
    itemsCache,
    setItemsCache,
  };

  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
};

export const useItemContext = () => useContext(ItemContext);
