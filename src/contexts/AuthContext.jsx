import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [watchedItems, setWatchedItems] = useState([]);
  const [likedItems, setLikedItems] = useState([]);

  // Load initial session
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id, session.access_token);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserData(session.user.id, session.access_token);
      } else {
        setWatchedItems([]);
        setLikedItems([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user data (watched & liked items)
  const loadUserData = async (userId, token) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

      // Fetch watched items
      const watchedRes = await fetch(`${baseUrl}/auth/user/watched`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (watchedRes.ok) {
        const watchedData = await watchedRes.json();
        // Transform Supabase format to match ItemCard expectations
        const transformedWatchedItems = (watchedData.watchedItems || []).map(item => {
          const baseItem = {
            ...item,
            id: item.tmdb_id,           // ItemCard expects 'id'
            type: item.content_type,     // ItemCard expects 'type'
            title: item.title,
            vote_average: item.rating,   // ItemCard expects 'vote_average'
          };

          // Handle image/poster based on content type
          if (item.content_type === 'anime') {
            // Anime items need 'image' field (AniList format)
            baseItem.image = item.poster_url || null;
          } else {
            // Movies/shows need 'poster_path' field (TMDB format)
            baseItem.poster_path = item.poster_url?.replace('https://image.tmdb.org/t/p/original', '') || item.poster_url;
          }

          return baseItem;
        });
        setWatchedItems(transformedWatchedItems);
      }

      // Fetch liked items
      const likedRes = await fetch(`${baseUrl}/auth/user/liked`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (likedRes.ok) {
        const likedData = await likedRes.json();
        // Transform Supabase format to match ItemCard expectations
        const transformedLikedItems = (likedData.likedItems || []).map(item => {
          const baseItem = {
            ...item,
            id: item.tmdb_id,           // ItemCard expects 'id'
            type: item.content_type,     // ItemCard expects 'type'
            title: item.title,
            vote_average: item.rating,   // ItemCard expects 'vote_average'
          };

          // Handle image/poster based on content type
          if (item.content_type === 'anime') {
            // Anime items need 'image' field (AniList format)
            baseItem.image = item.poster_url || null;
          } else {
            // Movies/shows need 'poster_path' field (TMDB format)
            baseItem.poster_path = item.poster_url?.replace('https://image.tmdb.org/t/p/original', '') || item.poster_url;
          }

          return baseItem;
        });
        setLikedItems(transformedLikedItems);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sign up
  const signUp = async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    });

    if (error) throw error;
    return data;
  };

  // Sign in
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  };

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    setUser(null);
    setSession(null);
    setWatchedItems([]);
    setLikedItems([]);
  };

  // Add watched item
  const addWatchedItem = async (item) => {
    // Wait for session if still loading
    if (loading) {
      await new Promise((resolve) => {
        const checkLoading = setInterval(() => {
          if (!loading) {
            clearInterval(checkLoading);
            resolve();
          }
        }, 100);
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkLoading);
          resolve();
        }, 5000);
      });
    }

    if (!session) {
      console.warn('No active session, skipping watched item update');
      return;
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

    const response = await fetch(`${baseUrl}/auth/user/watched`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        season: item.season || null,
        episode: item.episode || null,
        posterPath: item.posterPath || null,
        rating: item.rating || null
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add watched item');
    }

    // Refresh watched items
    await loadUserData(user.id, session.access_token);
  };

  // Remove watched item (not implemented in backend yet, but can be added)
  const removeWatchedItem = async (itemId) => {
    if (!session) throw new Error('No active session');

    // This would need a DELETE endpoint in the backend
    // For now, just remove from local state
    setWatchedItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Add liked item
  const addLikedItem = async (item) => {
    // Wait for session if still loading
    if (loading) {
      await new Promise((resolve) => {
        const checkLoading = setInterval(() => {
          if (!loading) {
            clearInterval(checkLoading);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkLoading);
          resolve();
        }, 5000);
      });
    }

    if (!session) {
      console.warn('No active session, skipping liked item update');
      return;
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

    const response = await fetch(`${baseUrl}/auth/user/liked`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        posterPath: item.posterPath || null
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add liked item');
    }

    // Refresh liked items
    await loadUserData(user.id, session.access_token);
  };

  // Remove liked item
  const removeLikedItem = async (mediaType, tmdbId) => {
    // Wait for session if still loading
    if (loading) {
      await new Promise((resolve) => {
        const checkLoading = setInterval(() => {
          if (!loading) {
            clearInterval(checkLoading);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkLoading);
          resolve();
        }, 5000);
      });
    }

    if (!session) {
      console.warn('No active session, skipping liked item removal');
      return;
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

    const response = await fetch(`${baseUrl}/auth/user/liked/${mediaType}/${tmdbId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove liked item');
    }

    // Refresh liked items
    await loadUserData(user.id, session.access_token);
  };

  // Check if item is liked
  const isLiked = (mediaType, tmdbId) => {
    return likedItems.some(item =>
      item.content_type === mediaType && item.tmdb_id === tmdbId
    );
  };

  const value = {
    user,
    session,
    loading,
    watchedItems,
    likedItems,
    signUp,
    signIn,
    signOut,
    addWatchedItem,
    removeWatchedItem,
    addLikedItem,
    removeLikedItem,
    isLiked
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
