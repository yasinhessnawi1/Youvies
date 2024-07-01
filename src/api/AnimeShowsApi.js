export const fetchAnimeShows = async (token, page, pageSize) => {
    try {
        const response = await fetch(`http://localhost:5000/youvies/v1/animeshows?page=${page}&pageSize=${pageSize}`, {
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
        const response = await fetch(`http://localhost:5000/youvies/v1/animeshows/search?title=${title}`, {
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
