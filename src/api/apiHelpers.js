import axios from 'axios';
import pako from 'pako';

export const BASE_URL = 'https://api.youvies.online/youvies/v1';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_API_KEY = 'af1b71222807c315af18609d22be4cb3';
//export const BASE_URL = 'http://localhost:5000/youvies/v1';
export const handleApiErrors = async (response) => {
    if (!response.ok) {
        console.warn('API returned an error:', response);
        return [];
    }
    const data = await response.json();
    if (!data.results) {
        if(data) {
            return data;

        }else {
            console.warn('API returned null or missing items');
            return [];
        }
    }
    return data.results;
};
export const handleAnimeApiErrors = async (response) => {
    const data = await response;
    if (!data) {
        console.warn('API returned null or missing items');
        return [];
    }
    return data;
};





export const fetchTMDBExport = async (fileType, date) => {
    try {
        const url = `http://files.tmdb.org/p/exports/${fileType}_ids_${date}.json.gz`;
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        // Decompress the gzipped data
        const decompressedData = pako.ungzip(new Uint8Array(response.data), { to: 'string' });

        // Split the decompressed data into lines (each line is a JSON object)
        const lines = decompressedData.split('\n');

        // Process each line and extract the movie IDs
        const ids = lines.map(line => {
            if (line.trim() === '') return null; // Skip empty lines
            try {
                const movie = JSON.parse(line);
                return movie.id;
            } catch (error) {
                console.error('Error parsing JSON:', error);
                return null;
            }
        }).filter(Boolean); // Remove null entries

        return ids;
    } catch (error) {
        console.error('Error fetching TMDB export:', error);
        return [];
    }
};
