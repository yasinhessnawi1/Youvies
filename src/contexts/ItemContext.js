import React, { createContext, useState, useEffect, useContext } from 'react';
import { fetchMovies, fetchMoviesByGenre } from "../api/MoviesApi";
import { fetchShows, fetchShowsByGenre } from "../api/ShowsApi";
import { fetchAnimeMovies, fetchAnimeShows, fetchAnimeByGenre } from "../api/AnimeShowsApi";
import { UserContext } from './UserContext';

export const ItemContext = createContext();

export const ItemProvider = ({ children }) => {
    const { user } = useContext(UserContext);
    const [items, setItems] = useState({
        movies: [],
        shows: [],
        animeMovies: [],
        animeShows: [],
    });

    const fetchInitialItems = async () => {
        if (!user) return;

        try {
            const [movies, shows, animeMovies, animeShows] = await Promise.all([
                fetchMovies(user.token, 1, 5),
                fetchShows(user.token, 1, 5),
                fetchAnimeMovies(user.token, 1, 5),
                fetchAnimeShows(user.token, 1, 5),
            ]);

            setItems({
                movies,
                shows,
                animeMovies,
                animeShows
            });

            setTimeout(async () => {
                const [movies100, shows100, animeMovies100, animeShows100] = await Promise.all([
                    fetchMovies(user.token, 1, 50),
                    fetchShows(user.token, 1, 50),
                    fetchAnimeMovies(user.token, 1, 50),
                    fetchAnimeShows(user.token, 1, 50),
                ]);

                setItems({
                    movies: movies100,
                    shows: shows100,
                    animeMovies: animeMovies100,
                    animeShows: animeShows100
                });

                setTimeout(async () => {
                    const [movies1000, shows1000, animeMovies1000, animeShows1000] = await Promise.all([
                        fetchMovies(user.token, 1, 500),
                        fetchShows(user.token, 1, 500),
                        fetchAnimeMovies(user.token, 1, 500),
                        fetchAnimeShows(user.token, 1, 500),
                    ]);

                    setItems({
                        movies: movies1000,
                        shows: shows1000,
                        animeMovies: animeMovies1000,
                        animeShows: animeShows1000
                    });
                }, 10000);

            }, 10000);

        } catch (error) {
            console.error('Error loading items:', error);
        }
    };

    const fetchItemsByGenre = async (contentType, genre, page = 1, pageSize = 10) => {
        if (!user) return [];

        let fetchedItems = [];
        try {
            switch (contentType) {
                case 'movies':
                    fetchedItems = await fetchMoviesByGenre(user.token, genre, page, pageSize);
                    break;
                case 'shows':
                    fetchedItems = await fetchShowsByGenre(user.token, genre, page, pageSize);
                    break;
                case 'anime':
                    fetchedItems = await fetchAnimeByGenre(user.token, 'anime_shows', genre, page, pageSize);
                    fetchedItems = fetchedItems.concat(await fetchAnimeByGenre(user.token, 'anime_movies', genre, page, pageSize));
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error('Error fetching items by genre:', error);
        }
        return fetchedItems;
    };

    const fetchMoreItems = async (category, page, pageSize) => {
        if (!user) return;

        try {
            const [movies, shows, animeMovies, animeShows] = await Promise.all([
                fetchMovies(user.token, page, pageSize),
                fetchShows(user.token, page, pageSize),
                fetchAnimeMovies(user.token, page, pageSize),
                fetchAnimeShows(user.token, page, pageSize),
            ]);

            setItems(prevItems => ({
                movies: [...prevItems.movies, ...movies],
                shows: [...prevItems.shows, ...shows],
                animeMovies: [...prevItems.animeMovies, ...animeMovies],
                animeShows: [...prevItems.animeShows, ...animeShows]
            }));
        } catch (error) {
            console.error('Error loading items:', error);
        }
    };

    useEffect(() => {
        fetchInitialItems();
    }, [user]);

    return (
        <ItemContext.Provider value={{ items, fetchItemsByGenre, fetchMoreItems }}>
            {children}
        </ItemContext.Provider>
    );
};
