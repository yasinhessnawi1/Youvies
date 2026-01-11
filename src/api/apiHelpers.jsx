
import axios from 'axios';
import { supabase } from '../services/supabase';

export const BASE_URL = 'https://api.youvies.online/youvies/v1';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_API_KEY = 'af1b71222807c315af18609d22be4cb3';
//export const BASE_URL = 'http://localhost:5001/youvies/v1';

// Create axios instance for backend API calls
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.error('Error getting session for request:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 errors and auto-refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    console.log('🚨 API Error:', error.response?.status, error.response?.statusText);

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        console.log('🔄 Attempting session refresh due to 401 error...');
        // Attempt to refresh session
        const { data, error: refreshError } = await supabase.auth.refreshSession();

        if (!refreshError && data.session) {
          console.log('✅ Session refreshed, retrying original request');
          console.log('🔑 New token available:', !!data.session.access_token);
          // Update auth header and retry
          originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
          return apiClient(originalRequest);
        } else {
          console.error('❌ Session refresh failed:', refreshError);
        }
      } catch (refreshError) {
        console.error('❌ Session refresh error:', refreshError);
      }

      // If refresh failed, redirect to login
      console.log('🔐 Redirecting to login due to authentication failure');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

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

// Handle anime API responses (from AniList API)
export const handleAnimeApiErrors = async (response) => {
  const data = await response;
  if (!data) {
    console.warn('Anime API returned null or missing items');
    return [];
  }
  return data;
};