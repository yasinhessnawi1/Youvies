import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from 'react';
import { fetchItems, fetchItemsByGenre, fetchOneItem } from '../api/ItemsApi';
import {
  fetchRecommendations,
  fetchTvSeasonDetails,
} from '../api/MediaService';
import { UserContext } from './UserContext';
import { getTitle } from '../utils/helper';

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
  const [watchedItems, setWatchedItems] = useState([]);
  const { user } = useContext(UserContext);

  const previousUserWatchedRef = useRef(user?.user?.watched);
  const hasFetched = useRef({});

  const fetchWatchedItems = useCallback(
    async (userWatchedList) => {
      if (!userWatchedList) return;

      const newFetchedItems = [];
      for (let i = userWatchedList.length - 1; i >= 0; i--) {
        const [type, id, title] = userWatchedList[i].split(':');

        // Validate the item before fetching
        if (!type || !id || !title || isNaN(id)) {
          console.warn(`Invalid watched item: ${userWatchedList[i]}`);
          continue;
        }

        const existingItem = watchedItems.find(
          (item) =>
            item.id === id && item.type === type && getTitle(item) === title,
        );

        if (!existingItem) {
          try {
            const watchedItem = await fetchOneItem(type, id);
            if (watchedItem) {
              newFetchedItems.push(watchedItem);
            }
          } catch (error) {
            console.error(
              `Error fetching watched item: ${type}:${id}:${title}`,
              error,
            );
          }
        }
      }

      setWatchedItems((prevItems) => [...prevItems, ...newFetchedItems]);
    },
    [watchedItems],
  );

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

      if (user && user.user.watched !== previousUserWatchedRef.current) {
        previousUserWatchedRef.current = user.user.watched;
        await fetchWatchedItems(user.user.watched);
      }
    };

    initializeItems();
  }, [user, fetchWatchedItems]);

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
      const [movies, shows, anime] = await Promise.all([
        fetchItems('movies', 1, 20),
        fetchItems('shows', 1, 20),
        fetchItems('anime', 1, 50),
      ]);

      movies.forEach((item) => (item.type = 'movies'));
      shows.forEach((item) => (item.type = 'shows'));
      anime.forEach((item) => (item.type = 'anime'));
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
  }, []);

  const fetchGenreItems = useCallback(
    async (contentType, genre) => {
      const itemKey = `${contentType}-${genre}`;

      if (items[itemKey]) {
        return items[itemKey];
      }

      if (!hasFetched.current[itemKey]) {
        setIsLoading(true);
        try {
          const genreItems = await fetchItemsByGenre(contentType, genre, 1, 20);
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
        if (category === 'movies') {
          item.recommendations = await fetchRecommendations(
            mediaId,
            'movies',
          ).then((response) =>
            response.map((movie) => ({ ...movie, type: 'movies' })),
          );
        } else if (category === 'shows') {
          item.episodes = [];
          item.recommendations = await fetchRecommendations(
            mediaId,
            'shows',
          ).then((response) =>
            response.map((show) => ({ ...show, type: 'shows' })),
          );
        } else if (category === 'anime') {
          item.recommendations = item.recommendations.map((anime) => ({
            ...anime,
            type: 'anime',
          }));
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

  const value = {
    items,
    genres,
    selectedGenre,
    setSelectedGenre,
    setGenres,
    isLoading,
    watchedItems,
    setWatchedItems,
    fetchAllItems,
    fetchGenreItems,
    fetchMoreItems,
    fetchMediaInfo,
    fetchSeasonEpisodes,
    itemsCache,
    setItemsCache,
  };

  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
};

export const useItemContext = () => useContext(ItemContext);
