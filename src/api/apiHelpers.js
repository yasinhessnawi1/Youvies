export const BASE_URL = 'https://api.youvies.online/youvies/v1';
//export const BASE_URL = 'http://localhost:5000/youvies/v1';
export const handleApiErrors = async (response) => {
    if (!response.ok) {
        console.warn('API returned an error:', response);
        return [];
    }
    const data = await response.json();
    if (!data) {
        console.warn('API returned null or missing items');
        return [];
    }
    return data;
};
export const handleAnimeApiErrors = async (response) => {
    const data = await response;
    if (!data) {
        console.warn('API returned null or missing items');
        return [];
    }
    return data;
};

