
import { fetchMovies, fetchMoviesByGenre, fetchOneMovie, searchMovies } from './MoviesApi';
import { fetchOneShow, fetchShows, fetchShowsByGenre, searchShows } from './ShowsApi';
import {
    fetchAnimeByGenre,
    fetchAnimeMovies,
    fetchAnimeShows,
    fetchOneAnime,
    searchAnimeMovies,
    searchAnimeShows
} from './AnimeShowsApi';

export const fetchItems = async (token, category, genre, page, pageSize) => {
    switch (category) {
        case 'movies':
            return await fetchMoviesByGenre(token, genre, page, pageSize);
        case 'shows':
            return await fetchShowsByGenre(token, genre, page, pageSize);
        case 'anime':
            return await fetchAnimeByGenre(token, 'animeshows', genre, page, pageSize);
        default:
            return null;
    }
};

export const fetchBannerItems = async (token, category, page, pageSize) => {
    switch (category) {
        case 'movies':
            return await fetchMovies(token, page, pageSize);
        case 'shows':
            return await fetchShows(token, page, pageSize);
        case 'anime':
            return await fetchAnimeShows(token, page, pageSize);
        default:
            return await fetchMovies(token, page, pageSize);
    }
};

export const fetchOneItem = async (token, category, id) => {
    switch (category) {
        case 'movies':
            return await fetchOneMovie(token, id);
        case 'shows':
            return await fetchOneShow(token, id);
        case 'anime_shows':
            return await fetchOneAnime(token, id, "animeshows");
        case 'anime_movies':
            return await fetchOneAnime(token, id, "animemovies");
        default:
            return await fetchOneMovie(token, id);
    }
};

export const searchItems = async (token, category, title) => {
    switch (category) {
        case 'movies':
            return await searchMovies(token, title);
        case 'shows':
            return await searchShows(token, title);
        case 'anime_shows':
            return await searchAnimeShows(token, title);
        case 'anime_movies':
            return await searchAnimeMovies(token, title);
        default:
            return null;
    }
};
