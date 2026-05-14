// UserContext.jsx

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

// CHANGED: This file used to import `loginUser/logoutUser/editUser` from `../api/UserApi`
// and persist user data via the Fly backend (`/api/login`, `/api/user`, etc.).
// Those imports + the `login` / `logout` / `addToWatchedList` / `getWatchedItem` / `updateUser`
// methods are now dead code in this app — auth is handled by AuthContext (Supabase) and
// watched/liked lists live in AuthContext too. They've been removed here to drop the Fly dependency.
// To restore: pull back the original imports and method bodies from git history of this file.

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [preferredSubtitleLanguage, setPreferredSubtitleLanguage] = useState(null);

  // Load saved subtitle preference from localStorage as fallback (works even when logged out)
  useEffect(() => {
    const savedSubtitlePref = localStorage.getItem('preferredSubtitleLanguage');
    if (savedSubtitlePref) {
      setPreferredSubtitleLanguage(savedSubtitlePref);
    }
  }, []);

  // ============================================================================
  // USER PREFERENCES (Subtitle Language) — now via Supabase, not Fly backend
  // ============================================================================

  // CHANGED: Was GET ${apiBaseUrl}/api/auth/user/preferences/subtitle-language on Fly.
  // Now reads directly from Supabase's `user_preferences` table (schema in
  // server/supabase-migration.sql). RLS scopes it to auth.uid() = user_id.
  // To restore: revert this function and the save function below to the original fetch() calls.
  const fetchUserPreferences = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferred_subtitle_language')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.warn('Failed to fetch subtitle preference from Supabase:', error.message);
        return;
      }
      if (data?.preferred_subtitle_language) {
        setPreferredSubtitleLanguage(data.preferred_subtitle_language);
        localStorage.setItem('preferredSubtitleLanguage', data.preferred_subtitle_language);
        console.log('📝 Loaded preferred subtitle language from Supabase:', data.preferred_subtitle_language);
      }
    } catch (error) {
      console.error('Failed to fetch user preferences:', error);
    }
  }, []);

  // Fetch the preference when the session is ready and re-fetch on sign-in/sign-out events.
  useEffect(() => {
    fetchUserPreferences();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserPreferences();
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchUserPreferences]);

  /**
   * Set user's preferred subtitle language
   * @param {string} language - Language name (e.g., 'english', 'arabic')
   */
  // CHANGED: Was PUT ${apiBaseUrl}/api/auth/user/preferences/subtitle-language on Fly.
  // Now upserts into Supabase's `user_preferences` table (UNIQUE user_id makes upsert safe).
  const setSubtitleLanguagePreference = useCallback(async (language) => {
    const normalizedLanguage = language?.toLowerCase();

    setPreferredSubtitleLanguage(normalizedLanguage);
    localStorage.setItem('preferredSubtitleLanguage', normalizedLanguage);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.log('No auth session, saving subtitle preference to localStorage only');
      return normalizedLanguage;
    }

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: session.user.id,
            preferred_subtitle_language: normalizedLanguage,
          },
          { onConflict: 'user_id' }
        );
      if (error) {
        console.warn('Failed to save subtitle preference to Supabase:', error.message);
      } else {
        console.log('✅ Saved preferred subtitle language to Supabase:', normalizedLanguage);
      }
    } catch (error) {
      console.error('Error saving subtitle preference:', error);
    }

    return normalizedLanguage;
  }, []);

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
        // Subtitle preferences (only piece of UserContext that's actually consumed elsewhere)
        preferredSubtitleLanguage,
        setSubtitleLanguagePreference,
        getSubtitleLanguagePreference,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
