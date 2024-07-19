export const fetchMovies = async (token, page, pageSize) => {
    try {
        console.log('fetchMovies');
        console.log('token:', token);
        const response = await fetch(`https://api.youvies.online/youvies/v1/movies?page=${page}&pageSize=${pageSize}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch movies:');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching movies:', error);
        throw error;
    }
};

export const searchMovies = async (token, title) => {
    try {
        const response = await fetch(`https://api.youvies.online/youvies/v1/movies/search?title=${title}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to search movies');
        }
        return await response.json();
    } catch (error) {
        console.error('Error searching movies:', error);
        throw error;
    }
};
