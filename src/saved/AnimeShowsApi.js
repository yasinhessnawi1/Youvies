import { handleApiErrors } from '../api/apiHelpers';
//export const BASE_URL = 'https://api.youvies.online/youvies/v1';
//export const BASE_URL = 'http://localhost:5000/youvies/v1';
export const fetchAnimeMovies = async (token, page, pageSize) => {
    const response = await fetch(`${BASE_URL}/animemovies?page=${page}&pageSize=${pageSize}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const searchAnimeMovies = async (token, title) => {
    const response = await fetch(`${BASE_URL}/animemovies/search?title=${title}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const fetchAnimeShows = async (token, page, pageSize) => {
    const response = await fetch(`${BASE_URL}/animeshows?page=${page}&pageSize=${pageSize}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const searchAnimeShows = async (token, title) => {
    const response = await fetch(`${BASE_URL}/animeshows/search?title=${title}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const fetchAnimeByGenre = async (token, type, genre, page, pageSize) => {
    const endpoint = type === 'animeshows' ? 'animeshows' : 'animemovies';
    const response = await fetch(`${BASE_URL}/${endpoint}/genre/${genre}?page=${page}&&pageSize=${pageSize}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const fetchOneAnime = async (token, id, endpoint) => {
    endpoint = endpoint === 'animeshows' ? 'animeshows' : 'animemovies';
    const response = await fetch(`${BASE_URL}/${endpoint}/${id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};
