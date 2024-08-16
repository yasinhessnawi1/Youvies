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

export const fetchOneItem = async (category, id, type) => {
    switch (category) {
        case 'movies':
            return await fetchMovieDetails(id).then((movie) => ({...movie, type: 'movies'}));
        case 'shows':
            return await fetchShowDetails(id).then((show) => ({...show, type: 'shows'}));
        case 'anime':
            return await fetchOneAnime(id).then((anime) => ({...anime, type: 'anime'}));
            case 'home':
                if (type === 'movie') {
                    return await fetchMovieDetails(id).then((movie) => ({...movie, type: 'movies'}));
                }else if (type === 'show') {
                    return await fetchShowDetails(id).then((show) => ({...show, type: 'shows'}));
                }else {
                    return await fetchOneAnime(id).then((anime) => ({...anime, type: 'anime'}));
                }
        default:
            return await fetchMovieDetails(id).then((movie) => ({...movie, type: 'movies'}));
    }
};

export const searchItems = async (category, title) => {
    switch (category) {
        case 'movies':
            return await searchMovies(title).then((movies) => movies.map((movie) => ({...movie, type: 'movies'})));
        case 'shows':
            return await searchShows(title).then((shows) => shows.map((show) => ({...show, type: 'shows'})));
        case 'anime':
            return await searchAnime(title).then((anime) => anime.map((anime) => ({...anime, type: 'anime'})));
        case 'home':
            const results = await Promise.all([
                searchShows(title).then((shows) => shows.map((show) => ({...show, type: 'shows'}))),
                searchMovies(title).then((movies) => movies.map((movie) => ({...movie, type: 'movies'}))),
                searchAnime(title).then((anime) => anime.map((anime) => ({...anime, type: 'anime'}))),
            ]);
            return results.flat();
        default:
            return [];
    }
};
