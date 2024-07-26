import {fetchMovies, fetchMoviesByGenre, searchMovies} from './MoviesApi';
import {fetchShows, fetchShowsByGenre, searchShows} from './ShowsApi';
import {fetchAnimeByGenre, fetchAnimeMovies, fetchAnimeShows, searchAnimeShows} from './AnimeShowsApi';


export const fetchItems = async (token, category, genre, page , pageSize) => {
    switch (category) {
        case 'movies':
            return await fetchMoviesByGenre(token, genre, page, pageSize);
        case 'shows':
            return await fetchShowsByGenre(token, genre, page, pageSize);
        case 'anime':
            return await fetchAnimeByGenre(token, 'animeshows' ,genre, page, pageSize);
        default:
            return null;
    }
};
export const fetchBannerItems = async (token, category, page, pageSize) => {
    switch (category) {
        case 'movies':
            return await fetchMovies(token,page, pageSize);
        case 'shows':
            return await fetchShows(token , page, pageSize);
        case 'anime':
            return await fetchAnimeShows(token, page, pageSize);
        default:
            return await fetchMovies(token, page, pageSize);
    }
};

