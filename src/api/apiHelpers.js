import axios from 'axios';
import pako from 'pako';

export const BASE_URL = 'https://api.youvies.online/youvies/v1';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_API_KEY = 'af1b71222807c315af18609d22be4cb3';
//export const BASE_URL = 'http://localhost:5001/youvies/v1';

export const handleApiErrors = async (response) => {
  if (!response.ok) {
    console.warn('API returned an error:', response);
    return [];
  }
  const data = await response.json();
  if (!data.results) {
    if (data) {
      return data;
    } else {
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
