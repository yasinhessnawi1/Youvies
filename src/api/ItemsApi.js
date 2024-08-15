// ItemsApi.js

import {
    fetchMovieDetails,
    fetchMoviesByGenre,
    fetchPopularMovies,
    fetchPopularShows,
    fetchShowDetails,
    fetchShowsByGenre,
    searchMovies,
    searchShows,
} from './MediaService';
import {fetchAnime, fetchAnimeByGenre, fetchOneAnime, searchAnime} from './AnimeShowApi';

export const fetchItemsByGenre = async (category, genre, page, pageSize) => {
    switch (category) {
        case 'movies':
            return await fetchMoviesByGenre(genre, page);
        case 'shows':
            return await fetchShowsByGenre(genre, page);
        case 'anime':
            return await fetchAnimeByGenre(genre, page, pageSize);
        default:
            return null;
    }
};

export const fetchItems = async (category, page, pageSize) => {
    switch (category) {
        case 'movies':
            return await fetchPopularMovies(page);
        case 'shows':
            return await fetchPopularShows(page);
        case 'anime':
            return await fetchAnime(page, pageSize);
        default:
            console.log('Invalid category:', category);
            break;
    }
};

export const fetchOneItem = async (category, id) => {
    switch (category) {
        case 'movies':
            return await fetchMovieDetails(id);
        case 'shows':
            return await fetchShowDetails(id);
        case 'anime':
            return await fetchOneAnime(id);
        default:
            return await fetchMovieDetails(id);
    }
};

export const searchItems = async (category, title) => {
    switch (category) {
        case 'movies':
            return await searchMovies(title);
        case 'shows':
            return await searchShows(title);
        case 'anime':
            return await searchAnime(title);
        case 'home':
            const results = await Promise.all([
                searchShows(title),
                searchMovies(title),
                searchAnime(title),
            ]);
            return results.flat();
        default:
            return [];
    }
};
