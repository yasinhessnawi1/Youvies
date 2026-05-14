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

  // Helper to reshape a watched/liked row from the Supabase table into the
  // format ItemCard expects (id/type/vote_average/poster_path or image).
  // Extracted from the old fetch() responses so the rest of the app keeps working unchanged.
  const transformItem = (item) => {
    const baseItem = {
      ...item,
      id: item.tmdb_id,           // ItemCard expects 'id'
      type: item.content_type,     // ItemCard expects 'type'
      title: item.title,
      vote_average: item.rating,   // ItemCard expects 'vote_average'
    };
    if (item.content_type === 'anime') {
      baseItem.image = item.poster_url || null;
    } else {
      baseItem.poster_path = item.poster_url?.replace('https://image.tmdb.org/t/p/original', '') || item.poster_url;
    }
    return baseItem;
  };

  // Load user data (watched & liked items)
  // CHANGED: Reads now go straight to Supabase via the JS client instead of the Fly backend.
  //   - Old: GET ${baseUrl}/auth/user/watched and /auth/user/liked
  //   - New: supabase.from('watched_items'|'liked_items').select(...)
  // RLS in supabase-migration.sql restricts rows to auth.uid() = user_id, so passing the userId
  // here is for clarity/ordering — the policy enforces ownership. To restore the backend version,
  // revert this function to the previous fetch() calls (the token param is still passed in).
  // eslint-disable-next-line no-unused-vars
  const loadUserData = async (userId, token) => {
    try {
      const { data: watchedData, error: watchedErr } = await supabase
        .from('watched_items')
        .select('*')
        .eq('user_id', userId)
        .order('last_watched', { ascending: false });
      if (watchedErr) {
        console.error('Error loading watched items:', watchedErr);
      } else {
        setWatchedItems((watchedData || []).map(transformItem));
      }

      const { data: likedData, error: likedErr } = await supabase
        .from('liked_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (likedErr) {
        console.error('Error loading liked items:', likedErr);
      } else {
        setLikedItems((likedData || []).map(transformItem));
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

    // CHANGED: Was PUT ${baseUrl}/auth/user/watched on the Fly backend.
    // Now upserts directly into Supabase's `watched_items` table. UNIQUE(user_id, tmdb_id, content_type)
    // means re-watching the same show just updates season/episode/last_watched in place.
    // The Fly route used the same Supabase table under the hood, so behavior is unchanged.
    const { error } = await supabase
      .from('watched_items')
      .upsert(
        {
          user_id: user.id,
          tmdb_id: item.tmdbId,
          content_type: item.mediaType,
          title: item.title,
          season: item.season || 1,
          episode: item.episode || 1,
          poster_url: item.posterPath || null,
          rating: item.rating || null,
          last_watched: new Date().toISOString(),
        },
        { onConflict: 'user_id,tmdb_id,content_type' }
      );

    if (error) {
      throw new Error(error.message || 'Failed to add watched item');
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

    // CHANGED: Was POST ${baseUrl}/auth/user/liked on the Fly backend.
    // Now upserts into Supabase's `liked_items` directly. Upsert (not insert) means tapping the
    // like button on the same item twice no longer errors on the UNIQUE constraint.
    const { error } = await supabase
      .from('liked_items')
      .upsert(
        {
          user_id: user.id,
          tmdb_id: item.tmdbId,
          content_type: item.mediaType,
          title: item.title,
          poster_url: item.posterPath || null,
        },
        { onConflict: 'user_id,tmdb_id,content_type' }
      );

    if (error) {
      throw new Error(error.message || 'Failed to add liked item');
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

    // CHANGED: Was DELETE ${baseUrl}/auth/user/liked/{mediaType}/{tmdbId} on the Fly backend.
    // Now deletes from Supabase directly. RLS ensures only the owner's row can be deleted, but
    // we still scope the query by user_id for clarity.
    const { error } = await supabase
      .from('liked_items')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', mediaType)
      .eq('tmdb_id', tmdbId);

    if (error) {
      throw new Error(error.message || 'Failed to remove liked item');
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
