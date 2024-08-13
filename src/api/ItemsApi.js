import {fetchMovies, fetchMoviesByGenre, fetchOneMovie, searchMovies} from './MoviesApi';
import {fetchOneShow, fetchShows, fetchShowsByGenre, searchShows} from './ShowsApi';
import {
    fetchAnimeByGenre,
    fetchAnime,
    fetchOneAnime,
    searchAnime
} from './AnimeShowApi';

export const fetchItemsByGenre = async (token, category, genre, page, pageSize) => {
    switch (category) {
        case 'movies':
            return await fetchMoviesByGenre(token, genre, page, pageSize);
        case 'shows':
            return await fetchShowsByGenre(token, genre, page, pageSize);
        case 'anime':
            return await fetchAnimeByGenre(genre, page, pageSize);
        default:
            return null;
    }
};

export const fetchItems = async (token, category, page, pageSize) => {
    switch (category) {
        case 'movies':
            return await fetchMovies(token, page, pageSize);
        case 'shows':
            return await fetchShows(token, page, pageSize);
        case 'anime':
            return await fetchAnime(page, pageSize);
        default:
            console.log('Invalid category:', category);
            break;
    }
};

export const fetchOneItem = async (token, category, id) => {
    switch (category) {
        case 'movies':
            return await fetchOneMovie(token, id);
        case 'shows':
            return await fetchOneShow(token, id);
        case 'anime':
            return await fetchOneAnime(id);
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
        case 'anime':
            return await searchAnime(title);
            case 'home':
               const results = await Promise.all( [
                    searchShows(token, title),
                    searchAnime(title),
                    searchMovies(token, title),
                    ]
                );
               console.log('results:', results);
               return results.flat();
        default:
            return [];
    }
};
