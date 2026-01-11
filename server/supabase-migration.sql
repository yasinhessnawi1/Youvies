-- ============================================================================
-- Youvies Supabase Database Migration
-- ============================================================================
-- This script sets up all required tables, indexes, RLS policies, and triggers
-- Run this in Supabase SQL Editor to create the complete database schema
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- User profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Watched items table (replaces colon-delimited string format)
-- NOTE: One row per show/movie - season/episode gets updated when user watches new episode
CREATE TABLE IF NOT EXISTS public.watched_items (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movies', 'shows', 'anime')),
  title TEXT NOT NULL,
  poster_url TEXT,
  rating NUMERIC(3,1),
  season INTEGER DEFAULT 1,
  episode INTEGER DEFAULT 1,
  last_watched TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tmdb_id, content_type)  -- One row per show, not per episode
);

-- Liked items table
CREATE TABLE IF NOT EXISTS public.liked_items (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movies', 'shows', 'anime')),
  title TEXT NOT NULL,
  poster_url TEXT,
  rating NUMERIC(3,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tmdb_id, content_type)
);

-- Torrent cache table (optional, for performance optimization)
CREATE TABLE IF NOT EXISTS public.torrent_cache (
  id BIGSERIAL PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  season INTEGER,
  episode INTEGER,
  torrent_data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE(tmdb_id, content_type, season, episode)
);

-- User preferences table (for subtitle language, auto-play settings, etc.)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_subtitle_language TEXT DEFAULT NULL,
  auto_play_subtitles BOOLEAN DEFAULT true,
  subtitle_size TEXT DEFAULT 'medium' CHECK (subtitle_size IN ('small', 'medium', 'large')),
  preferred_video_quality TEXT DEFAULT '1080p',
  auto_play_next_episode BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Watched items indexes
CREATE INDEX IF NOT EXISTS idx_watched_items_user_id ON public.watched_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_items_last_watched ON public.watched_items(last_watched DESC);
CREATE INDEX IF NOT EXISTS idx_watched_items_tmdb_id ON public.watched_items(tmdb_id);

-- Liked items indexes
CREATE INDEX IF NOT EXISTS idx_liked_items_user_id ON public.liked_items(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_items_created_at ON public.liked_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liked_items_tmdb_id ON public.liked_items(tmdb_id);

-- Torrent cache indexes
CREATE INDEX IF NOT EXISTS idx_torrent_cache_tmdb_id ON public.torrent_cache(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_torrent_cache_expires_at ON public.torrent_cache(expires_at);

-- User preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watched_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liked_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torrent_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Watched items policies
CREATE POLICY "Users can view own watched items"
  ON public.watched_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watched items"
  ON public.watched_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watched items"
  ON public.watched_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watched items"
  ON public.watched_items FOR DELETE
  USING (auth.uid() = user_id);

-- Liked items policies
CREATE POLICY "Users can view own liked items"
  ON public.liked_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own liked items"
  ON public.liked_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own liked items"
  ON public.liked_items FOR DELETE
  USING (auth.uid() = user_id);

-- Torrent cache policies (public read, service role write)
CREATE POLICY "Anyone can read torrent cache"
  ON public.torrent_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage torrent cache"
  ON public.torrent_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User preferences policies
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all preferences"
  ON public.user_preferences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired torrent cache
CREATE OR REPLACE FUNCTION cleanup_expired_torrent_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.torrent_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to auto-update profiles.updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update user_preferences.updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Display success message
DO $$
BEGIN
  RAISE NOTICE 'Youvies database migration completed successfully!';
  RAISE NOTICE 'Tables created: profiles, watched_items, liked_items, torrent_cache, user_preferences';
  RAISE NOTICE 'RLS policies enabled for all tables';
  RAISE NOTICE 'Triggers configured for auto-profile creation and timestamp updates';
END $$;

-- ============================================================================
-- MIGRATION: Add user_preferences table (run this separately if table does not exist)
-- ============================================================================
-- Run this SQL if you already have the database and need to add just the user_preferences table:
/*
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_subtitle_language TEXT DEFAULT NULL,
  auto_play_subtitles BOOLEAN DEFAULT true,
  subtitle_size TEXT DEFAULT 'medium' CHECK (subtitle_size IN ('small', 'medium', 'large')),
  preferred_video_quality TEXT DEFAULT '1080p',
  auto_play_next_episode BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all preferences" ON public.user_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
*/
