// mediaService.js
import {handleApiErrors, TMDB_API_KEY, TMDB_BASE_URL} from './apiHelpers';

// Helper function to handle API requests
const fetchFromTmdb = async (endpoint, params = {}, show = false) => {
    let url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url += "?api_key=" + TMDB_API_KEY;
    url += Object.keys(params).map(key => `&${key}=${params[key]}`).join('');
if (show) {
    url += "&append_to_response=seasons";
}
    const response = await fetch(url);
    return handleApiErrors(response);
};

// Functions for Movies

export const fetchMovieDetails = async (movieId) => {
    return await fetchFromTmdb(`/movie/${movieId}` );
};

export const fetchNowPlayingMovies = async (page) => {
    return await fetchFromTmdb('/movie/now_playing',{page});
};

export const fetchPopularMovies = async (page) => {
    return await fetchFromTmdb('/movie/popular',{page});
};

export const fetchMoviesByGenre = async (genreId, page = 1) => {
    return await fetchFromTmdb('/discover/movie', {
        with_genres: genreId,
        page,
    }).then();
};

// Functions for TV Shows

export const fetchShowDetails = async (seriesId) => {
    return await fetchFromTmdb(`/tv/${seriesId}`,{},   true);
};

export const fetchAiringTodayShows = async (page) => {
    return await fetchFromTmdb('/tv/airing_today' ,{page});
};

export const fetchPopularShows = async (page) => {
    return await fetchFromTmdb('/tv/popular' ,{page});
};

export const fetchShowsByGenre = async (genreId, page = 1) => {
    return await fetchFromTmdb('/discover/tv', {
        with_genres: genreId,
        page,
    });
};

// Search Functions

export const searchMovies = async (query, page = 1) => {
    return await fetchFromTmdb('/search/movie', {
        query,
        page,
    });
};

export const searchShows = async (query, page = 1) => {
    return await fetchFromTmdb('/search/tv', {
        query,
        page,
    });
};
