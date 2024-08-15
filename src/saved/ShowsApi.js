import { handleApiErrors, BASE_URL } from '../api/apiHelpers';


export const fetchShows = async (token, page, pageSize) => {
    const response = await fetch(`${BASE_URL}/shows?page=${page}&pageSize=${pageSize}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const searchShows = async (token, title) => {
    const response = await fetch(`${BASE_URL}/shows/search?title=${title}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const fetchShowsByGenre = async (token, genre, page, pageSize) => {
    const response = await fetch(`${BASE_URL}/shows/genre/${genre}?page=${page}&&pageSize=${pageSize}&type=sorted`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};

export const fetchOneShow = async (token, id) => {
    const response = await fetch(`${BASE_URL}/shows/${id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return await handleApiErrors(response);
};
