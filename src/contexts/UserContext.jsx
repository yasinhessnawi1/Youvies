// UserContext.jsx

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { loginUser, logoutUser, editUser } from '../api/UserApi';
import { useNavigate } from 'react-router-dom';
import { config } from '../config/environment';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [preferredSubtitleLanguage, setPreferredSubtitleLanguage] = useState(null);
  const navigate = useNavigate();


  useEffect(() => {
    const loggedUser = localStorage.getItem('user');
    if (loggedUser) {
      setUser(JSON.parse(loggedUser));
    }
    // Also load saved subtitle preference from localStorage as fallback
    const savedSubtitlePref = localStorage.getItem('preferredSubtitleLanguage');
    if (savedSubtitlePref) {
      setPreferredSubtitleLanguage(savedSubtitlePref);
    }
  }, []);
  
  // Fetch user preferences from server when user logs in
  useEffect(() => {
    const token = user?.session?.access_token || user?.token;
    if (token) {
      fetchUserPreferences();
    }
  }, [user]);

  const login = async (username, password) => {
    try {
      const userData = await loginUser(username, password);
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      throw new Error('Invalid username or password');
    }
  };

  const logout = async () => {
    try {
      if (user && user.token) {
       let watched = user.user.watched;
        if(watched.length > 30){
            watched = watched.slice(watched.length - 30, watched.length);
            user.user.watched = watched
        }
        await editUser(user.user, user.token);
        await logoutUser(user.token);
      }
      setUser(null);
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      alert('An error occurred while logging out. Please try again.'); // Display a user-friendly alert
      console.error('Logout error:', error); // Log the error for debugging
    }
  };

  const updateUser = async (watchedList) => {
    if(watchedList){
        user.user.watched = watchedList;
    }
    try {
      localStorage.setItem('user', JSON.stringify(user));
        await editUser(user.user, user.token);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  }

  const addToWatchedList = async (watchedItem) => {
    if (!user) return;
  console.log(watchedItem);
    // Initialize watched list if it doesn't exist
    if (!user.user.watched) user.user.watched = [];

    // Parse the watched item details
    const [type, id, title] = watchedItem.split(':');

    // Find the existing watched item
    const existingItemIndex = user.user.watched.findIndex((item) =>
      item.startsWith(`${type}:${id}:${title}`),
    );
    if (existingItemIndex !== -1) {
        // Update the existing item
        user.user.watched.splice(existingItemIndex, 1);
    }
     // New item, add it to the watched list
     user.user.watched.push(watchedItem);

    localStorage.setItem('user', JSON.stringify(user));
    try {
      await editUser(user.user, user.token);
    } catch (error) {
      console.error('Failed to update user watched list:', error);
    }
  };

  const getWatchedItem = (type, id, title) => {
    if (!user || !user.user.watched) return null;
    return (
      user.user.watched.find((item) =>
        item.startsWith(`${type}:${id}:${title}`),
      ) || null
    );
  };

  // ============================================================================
  // USER PREFERENCES (Subtitle Language)
  // ============================================================================
  
  /**
   * Fetch user preferences from server
   */
  const fetchUserPreferences = useCallback(async () => {
    // Get the token - check both possible locations (new Supabase format vs legacy)
    const token = user?.session?.access_token || user?.token;
    if (!token) return;
    
    try {
      const apiBaseUrl = config.apiBaseUrl.replace('/api', '');
      const response = await fetch(`${apiBaseUrl}/api/auth/user/preferences/subtitle-language`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.preferredLanguage) {
          setPreferredSubtitleLanguage(data.preferredLanguage);
          localStorage.setItem('preferredSubtitleLanguage', data.preferredLanguage);
          console.log('📝 Loaded preferred subtitle language from server:', data.preferredLanguage);
        }
      } else {
        console.warn('Failed to fetch subtitle preference from server:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch user preferences:', error);
    }
  }, [user]);

  /**
   * Set user's preferred subtitle language
   * @param {string} language - Language name (e.g., 'english', 'arabic')
   */
  const setSubtitleLanguagePreference = useCallback(async (language) => {
    const normalizedLanguage = language?.toLowerCase();
    
    // Update local state immediately
    setPreferredSubtitleLanguage(normalizedLanguage);
    localStorage.setItem('preferredSubtitleLanguage', normalizedLanguage);
    
    // Get the token - check both possible locations (new Supabase format vs legacy)
    const token = user?.session?.access_token || user?.token;
    
    // If user is logged in, save to server
    if (token) {
      try {
        const apiBaseUrl = config.apiBaseUrl.replace('/api', '');
        const response = await fetch(`${apiBaseUrl}/api/auth/user/preferences/subtitle-language`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ language: normalizedLanguage })
        });
        
        if (response.ok) {
          console.log('✅ Saved preferred subtitle language to server:', normalizedLanguage);
        } else {
          const errorText = await response.text();
          console.warn('Failed to save subtitle preference to server:', response.status, errorText);
        }
      } catch (error) {
        console.error('Error saving subtitle preference:', error);
      }
    } else {
      console.log('No auth token available, saving to localStorage only');
    }
    
    return normalizedLanguage;
  }, [user]);

  /**
   * Get the user's preferred subtitle language
   * @returns {string|null} - Preferred language or null
   */
  const getSubtitleLanguagePreference = useCallback(() => {
    return preferredSubtitleLanguage;
  }, [preferredSubtitleLanguage]);

  return (
    <UserContext.Provider
      value={{ 
        user, 
        login, 
        logout, 
        addToWatchedList, 
        getWatchedItem, 
        updateUser,
        // Subtitle preferences
        preferredSubtitleLanguage,
        setSubtitleLanguagePreference,
        getSubtitleLanguagePreference
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
