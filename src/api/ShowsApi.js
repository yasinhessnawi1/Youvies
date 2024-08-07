export const fetchShows = async (token, page, pageSize) => {
    try {
        const response = await fetch(`https://api.youvies.online/youvies/v1/shows?page=${page}&pageSize=${pageSize}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch shows');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching shows:', error);
        throw error;
    }
};

export const searchShows = async (token, title) => {
    try {
        const response = await fetch(`https://api.youvies.online/youvies/v1/shows/search?title=${title}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to search shows');
        }
        return await response.json();
    } catch (error) {
        console.error('Error searching shows:', error);
        throw error;
    }
};
export const fetchShowsByGenre = async (token, genre, page , pageSize) => {
    try {
        const response = await fetch(`https://api.youvies.online/youvies/v1/shows/genre/${genre}?page=${page}&&pageSize=${pageSize}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch shows by genre');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching shows by genre:', error);
        throw error;
    }
};
export const fetchOneShow= async (token,id)  => {
    try {
        const response = await fetch(`https://api.youvies.online/youvies/v1/shows/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch movies by genre');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching movies by genre:', error);
        throw error;
    }
};
