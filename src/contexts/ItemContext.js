import React, { createContext, useState, useEffect } from 'react';
import { fetchItems, fetchItemsByGenre } from '../api/ItemsApi';

const ItemContext = createContext();

const CACHE_DURATION = 1000 * 60 * 60 * 3; // 3 hours

export const ItemProvider = ({ children }) => {
    const [items, setItems] = useState({});
    const [genres, setGenres] = useState([]);
    const [selectedGenre, setSelectedGenre] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
        setIsLoading(true);
        try {
            const [movies, shows, anime] = await Promise.all([
                fetchItems(token, 'movies', 1, 100),
                fetchItems(token, 'shows', 1, 100),
                fetchItems(token, 'anime', 1, 100),
            ]);

            const fetchedItems = {
                'home-movies': movies,
                'home-shows': shows,
                'home-anime': anime,
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
        setIsLoading(true);
        try {
            const genreItems = await fetchItemsByGenre(token, contentType, genre, 1, 100);
            setItems((prevItems) => ({
                ...prevItems,
                [`${contentType}-${genre}`]: genreItems,
            }));

            const cachedItems = JSON.parse(localStorage.getItem('cachedItems')) || {};
            cachedItems[`${contentType}-${genre}`] = genreItems;
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
        setGenres,
    };

    return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
};

export const useItemContext = () => React.useContext(ItemContext);
