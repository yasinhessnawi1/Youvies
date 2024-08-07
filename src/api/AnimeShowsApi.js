export const fetchAnimeShows = async (token, page, pageSize) => {
    try {
        const response = await fetch(`https://api.youvies.online/youvies/v1/animeshows?page=${page}&pageSize=${pageSize}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch anime shows');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching anime shows:', error);
        throw error;
    }
};

export const searchAnimeShows = async (token, title) => {
    try {
        const response = await fetch(`https://api.youvies.online/youvies/v1/animeshows/search?title=${title}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to search anime shows');
        }
        return await response.json();
    } catch (error) {
        console.error('Error searching anime shows:', error);
        throw error;
    }
};
export const fetchAnimeMovies = async (token, page, pageSize) => {
    try {
        const response = await fetch(`https://api.youvies.online/youvies/v1/animemovies?page=${page}&pageSize=${pageSize}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch anime shows');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching anime shows:', error);
        throw error;
    }
};

export const searchAnimeMovies = async (token, title) => {
    try {
        const response = await fetch(`https://api.youvies.online/youvies/v1/animemovies/search?title=${title}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to search anime shows');
        }
        return await response.json();
    } catch (error) {
        console.error('Error searching anime shows:', error);
        throw error;
    }
};
// AnimeShowsApi.js
export const fetchAnimeByGenre = async (token, type, genre, page , pageSize) => {
    try {
        const endpoint = type === 'anime_shows' ? 'animeshows' : 'animemovies';
        const response = await fetch(`https://api.youvies.online/youvies/v1/${endpoint}/genre/${genre}?page=${page}&&pageSize=${pageSize}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch anime by genre');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching anime by genre:', error);
        throw error;
    }
};
export const fetchOneAnime= async (token,id, endpoint)  => {
    endpoint = endpoint === 'animeshows' ? 'animeshows' : 'animemovies';
    try {
        let response = await fetch(`https://api.youvies.online/youvies/v1/${endpoint}/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

            if (!response.ok) {
                throw new Error('Failed to fetch anime');
            }
        return await response.json();
    } catch (error) {
        console.error('Error fetching anime by genre:', error);
        throw error;
    }
};
