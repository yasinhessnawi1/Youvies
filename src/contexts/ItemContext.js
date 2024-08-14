import React, { createContext, useState, useEffect } from 'react';
import { fetchItems, fetchItemsByGenre } from '../api/ItemsApi';

const ItemContext = createContext();

const CACHE_DURATION = 1000 * 60 * 60 * 3; // 3 hours

export const ItemProvider = ({ children }) => {
    const [items, setItems] = useState({});
    const [genres, setGenres] = useState([]);
    const [selectedGenre, setSelectedGenre] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pageTracker, setPageTracker] = useState({}); // To track the page number for each content type and genre

    const fetchMoreItems = async (token, contentType, genre = null) => {
        const key = `${contentType}-${genre || 'home'}`;
        const currentPage = pageTracker[key] || 1;
        const nextPage = currentPage + 1;



        setIsLoading(true);
        try {
            let moreItems;
            if (genre) {
                moreItems = await fetchItemsByGenre(token, contentType, genre, nextPage, 50);
            } else {
                moreItems = await fetchItems(token, contentType, nextPage, 50);
            }

            setItems((prevItems) => ({
                ...prevItems,
                [key]: [...(prevItems[key] || []), ...moreItems], // Append new items
            }));

            setPageTracker((prevTracker) => ({
                ...prevTracker,
                [key]: nextPage,
            }));
        } catch (error) {
            console.error('Error fetching more items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const cachedItems = localStorage.getItem('cachedItems');
        const cacheTime = localStorage.getItem('cacheTime');

        if (cachedItems && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
            setItems(JSON.parse(cachedItems));
        } else {
            localStorage.removeItem('cachedItems');
            localStorage.removeItem('cacheTime');
        }
    }, []);

    const fetchAllItems = async (token) => {
        if (items['movies-home'] && items['shows-home'] && items['anime-home']) {
            return; // Items are already in the cache, no need to fetch
        }

        setIsLoading(true);
        try {
            const [movies, shows, anime] = await Promise.all([
                fetchItems(token, 'movies', 1, 100),
                fetchItems(token, 'shows', 1, 100),
                fetchItems(token, 'anime', 1, 100),
            ]);

            const fetchedItems = {
                'movies-home': movies,
                'shows-home': shows,
                'anime-home': anime,
            };

            setItems(fetchedItems);
            localStorage.setItem('cachedItems', JSON.stringify(fetchedItems));
            localStorage.setItem('cacheTime', Date.now().toString());
        } catch (error) {
            console.error('Error fetching items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchGenreItems = async (token, contentType, genre) => {
        const key = `${contentType}-${genre}`;
        if (items[key]) {
            return; // Items are already in the cache, no need to fetch
        }

        setIsLoading(true);
        try {
            const genreItems = await fetchItemsByGenre(token, contentType, genre, 1, 100);
            setItems((prevItems) => ({
                ...prevItems,
                [key]: genreItems,
            }));

            const cachedItems = JSON.parse(localStorage.getItem('cachedItems')) || {};
            cachedItems[key] = genreItems;
            localStorage.setItem('cachedItems', JSON.stringify(cachedItems));
        } catch (error) {
            console.error('Error fetching genre items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const value = {
        items,
        genres,
        selectedGenre,
        setSelectedGenre,
        isLoading,
        fetchAllItems,
        fetchGenreItems,
        fetchMoreItems,
        setGenres,
    };

    return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
};

export const useItemContext = () => React.useContext(ItemContext);
