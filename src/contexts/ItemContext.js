import React, { createContext, useState, useEffect } from 'react';
import { fetchItems, fetchItemsByGenre, fetchOneItem } from '../api/ItemsApi';
import { fetchRecommendations, fetchTvSeasonDetails } from "../api/MediaService";

const ItemContext = createContext();

const CACHE_DURATION = 1000 * 60 * 60 * 3; // 3 hours

export const ItemProvider = ({ children }) => {
    const [items, setItems] = useState({});
    const [genres, setGenres] = useState([]);
    const [selectedGenre, setSelectedGenre] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pageTracker, setPageTracker] = useState({}); // Track the page number for each content type and genre
    const [cacheTime, setCacheTime] = useState(Date.now());
    const [itemsCache, setItemsCache] = useState({});

    useEffect(() => {
        const cachedItems = localStorage.getItem('cachedItems');
        const cachedTime = localStorage.getItem('cacheTime');

        if (cachedItems && cachedTime && (Date.now() - cachedTime) < CACHE_DURATION) {
            setItems(JSON.parse(cachedItems));
            setCacheTime(parseInt(cachedTime, 10));
        } else {
            localStorage.removeItem('cachedItems');
            localStorage.removeItem('cacheTime');
        }
    }, []);

    useEffect(() => {
        if (Object.keys(items).length > 0) {
            localStorage.setItem('cachedItems', JSON.stringify(items));
            localStorage.setItem('cacheTime', cacheTime.toString());
        }
    }, [items, cacheTime]);

    const fetchMoreItems = async (contentType, genre = null) => {
        const key = `${contentType}-${genre || 'home'}`;
        const currentPage = pageTracker[key] || 1;
        const nextPage = currentPage + 1;

        setIsLoading(true);
        try {
            const moreItems = genre
                ? await fetchItemsByGenre(contentType, genre, nextPage, 20)
                : await fetchItems(contentType, nextPage, 20);
            moreItems.forEach(item => (item.type = contentType));
            setItems(prevItems => ({
                ...prevItems,
                [key]: [...(prevItems[key] || []), ...moreItems], // Append new items
            }));

            setPageTracker(prevTracker => ({
                ...prevTracker,
                [key]: nextPage,
            }));
        } catch (error) {
            console.error('Error fetching more items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAllItems = async () => {
        if (items['movies-home'] && items['shows-home'] && items['anime-home']) {
            return; // Items are already in the cache, no need to fetch
        }

        setIsLoading(true);
        try {
            const [movies, shows, anime] = await Promise.all([
                fetchItems('movies', 1, 20),
                fetchItems('shows', 1, 20),
                fetchItems('anime', 1, 50),
            ]);
            movies.forEach(item => (item.type = 'movies'));
            shows.forEach(item => (item.type = 'shows'));
            anime.forEach(item => (item.type = 'anime'));
            const fetchedItems = {
                'movies-home': movies,
                'shows-home': shows,
                'anime-home': anime,
            };

            setItems(fetchedItems);
            setCacheTime(Date.now());
        } catch (error) {
            console.error('Error fetching items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchGenreItems = async (contentType, genre) => {
        const key = `${contentType}-${genre}`;
        if (items[key]) {
            return; // Items are already in the cache, no need to fetch
        }

        setIsLoading(true);
        try {
            const genreItems = await fetchItemsByGenre(contentType, genre, 1, 20);
            genreItems.forEach(item => (item.type = contentType));
            setItems(prevItems => ({
                ...prevItems,
                [key]: genreItems,
            }));
            setCacheTime(Date.now());
        } catch (error) {
            console.error('Error fetching genre items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMediaInfo = async (mediaId, category) => {
        const cacheKey = `${category}-${mediaId}`;
        if (itemsCache[cacheKey]) {
            return itemsCache[cacheKey]; // Return cached item if available
        }
        setIsLoading(true);
        try {
            const item = await fetchOneItem(category, mediaId);
             if (category === 'movies') {
                // Fetch related movies if the item is a movie
                item.relatedMovies = await fetchRecommendations(mediaId, 'movies');
            }else if (category === 'shows') {
                 item.episodes = [];
                 item.recommendations = await fetchRecommendations(mediaId, 'shows').then((response) => response.map((show) => ({...show, type: 'shows'})));
            }else if (category === 'anime') {
                item.recommendations = item.recommendations.map((anime) => ({...anime, type: 'anime'}));
             }

            // Store the item in the cache
            setItemsCache(prevCache => ({
                ...prevCache,
                [cacheKey]: item
            }));

            return item;
        } catch (error) {
            console.error('Error fetching media info:', error);
        } finally {
            setIsLoading(false);
        }
    };


    const fetchSeasonEpisodes = async (mediaId, seasonNumber) => {
        const cacheKey = `${mediaId}-season-${seasonNumber}`;

        if (itemsCache[cacheKey]) {
            return itemsCache[cacheKey]; // Return cached episodes if available
        }

        setIsLoading(true);
        try {
            const episodes = await fetchTvSeasonDetails(mediaId, seasonNumber); // Fetch episodes

            // Store in cache
            setItemsCache(prevCache => ({
                ...prevCache,
                [cacheKey]: episodes
            }));

            return episodes;
        } catch (error) {
            console.error(`Error fetching episodes for season ${seasonNumber}:`, error);
        } finally {
            setIsLoading(false);
        }
    };

    const value = {
        items,
        genres,
        selectedGenre,
        setSelectedGenre,
        setGenres,
        isLoading,
        fetchAllItems,
        fetchGenreItems,
        fetchMoreItems,
        fetchMediaInfo,
        fetchSeasonEpisodes,
        itemsCache, // Expose the itemsCache to the context
    };

    return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
};

export const useItemContext = () => React.useContext(ItemContext);
