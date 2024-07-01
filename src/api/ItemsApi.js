import { fetchMovies, searchMovies } from './MoviesApi';
import { fetchShows, searchShows } from './ShowsApi';
import { fetchAnimeShows, searchAnimeShows } from './AnimeShowsApi';

export const fetchItems = async (token, category, page, pageSize) => {
    console.log('fetchItems');
    console.log('token:', token);
    switch (category) {
        case 'movies':
            return await fetchMovies(token, page, pageSize);
        case 'shows':
            return await fetchShows(token, page, pageSize);
        case 'anime':
            return await fetchAnimeShows(token, page, pageSize);
        default:
            return handleDefaultFetch(token);
    }
};

const handleDefaultFetch = async (token) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const favoriteTitles = user.favorites || [];
    const lastWatchedTitles = user.lastWatched || [];

    let recommendedItems = [];

    for (let title of [...favoriteTitles, ...lastWatchedTitles]) {
        const movieResults = await searchMovies(token, title);
        const showResults = await searchShows(token, title);
        const animeResults = await searchAnimeShows(token, title);

        recommendedItems.push(...movieResults, ...showResults, ...animeResults);
    }

    return recommendedItems;
};
