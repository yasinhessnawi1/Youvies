import { handleApiErrors , BASE_URL} from './apiHelpers';

export const fetchMovies = async (token, page, pageSize) => {
    const response = await fetch(`${BASE_URL}/movies?page=${page}&pageSize=${pageSize}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const searchMovies = async (token, title) => {
    const response = await fetch(`${BASE_URL}/movies/search?title=${title}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const fetchMoviesByGenre = async (token, genre, page, pageSize) => {
    const response = await fetch(`${BASE_URL}/movies/genre/${genre}?page=${page}&&pageSize=${pageSize}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const fetchOneMovie = async (token, id) => {
    const response = await fetch(`${BASE_URL}/movies/${id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};
