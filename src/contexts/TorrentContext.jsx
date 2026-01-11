import React, { createContext, useState, useContext } from 'react';
import { getTitle } from '../utils/helper';

const TorrentContext = createContext();

export const useTorrent = () => {
  const context = useContext(TorrentContext);
  if (!context) {
    throw new Error('useTorrent must be used within TorrentProvider');
  }
  return context;
};

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const TorrentProvider = ({ children }) => {
  const [activeHash, setActiveHash] = useState(null);
  const [activeFileIndex, setActiveFileIndex] = useState(null);
  const [isDebridStream, setIsDebridStream] = useState(false); // Track if using debrid (no P2P stats)
  const [torrentSubtitles, setTorrentSubtitles] = useState([]); // Subtitles from torrent files
  const [torrentCache, setTorrentCache] = useState({}); // Cache prepared torrents
  const pendingTorrentsRef = React.useRef(new Map()); // Track in-progress torrents by cache key
  
  // NEW: Store alternative torrents for source selection
  const [alternativeTorrents, setAlternativeTorrents] = useState([]);
  const [currentSourceName, setCurrentSourceName] = useState(null);

  /**
   * Extract quality and source from torrent name as fallback
   * @param {string} name - Torrent name
   * @returns {Object} { quality, source }
   */
  const extractQualityAndSourceFromName = (name) => {
    if (!name) return { quality: 'Unknown', source: 'Unknown' };
    
    const nameLower = name.toLowerCase();
    let quality = 'Unknown';
    let source = 'Unknown';
    
    // Extract resolution/quality
    if (nameLower.includes('2160p') || nameLower.includes('4k') || /\b2160p\b/i.test(name)) {
      quality = '4K';
    } else if (nameLower.includes('1080p') || /\b1080p\b/i.test(name)) {
      quality = '1080p';
    } else if (nameLower.includes('720p') || /\b720p\b/i.test(name)) {
      quality = '720p';
    } else if (nameLower.includes('480p') || /\b480p\b/i.test(name)) {
      quality = '480p';
    }
    
    // Extract source type (check more specific patterns first)
    if (nameLower.includes('remux')) {
      source = 'REMUX';
    } else if (nameLower.includes('bluray') || nameLower.includes('blu-ray')) {
      source = 'BluRay';
    } else if (nameLower.includes('web-dl') || nameLower.includes('webdl')) {
      source = 'WEB-DL';
    } else if (nameLower.includes('webrip')) {
      source = 'WEBRip';
    } else if (nameLower.includes('webscreener') || nameLower.includes('web-screener')) {
      source = 'WEBSCREENER';
    } else if (nameLower.includes('hdtv')) {
      source = 'HDTV';
    } else if (nameLower.includes('dvdrip')) {
      source = 'DVDRip';
    } else if (/\bhdts\b/i.test(name) || /\bhd-ts\b/i.test(name)) {
      source = 'HDTS';
    } else if (/\bhdtc\b/i.test(name) || /\bhd-tc\b/i.test(name)) {
      source = 'HDTC';
    } else if (/\btelesync\b/i.test(name) || /\b\.ts\./i.test(name) || /\b-ts-/i.test(name) || (/\bts\b/i.test(name) && !nameLower.includes('bits'))) {
      source = 'TS';
    } else if (/\btelecine\b/i.test(name) || /\b\.tc\./i.test(name) || /\b-tc-/i.test(name) || (/\btc\b/i.test(name) && !nameLower.includes('etc'))) {
      source = 'TC';
    } else if (/\bcam\b/i.test(name) || /\bcamrip\b/i.test(name)) {
      source = 'CAM';
    } else if (nameLower.includes('screener') || (/\bscr\b/i.test(name) && !nameLower.includes('screen'))) {
      source = 'SCREENER';
    }
    
    return { quality, source };
  };

  /**
   * Extract season number from title
   * "Solo Leveling Season 2 -Arise from the Shadow-" → 2
   */
  const extractSeasonFromTitle = (title) => {
    if (!title) return null;
    
    // Match "Season X" or "S0X" patterns
    const seasonMatch = title.match(/Season\s*(\d+)/i) || title.match(/\bS(\d{1,2})\b/i);
    return seasonMatch ? parseInt(seasonMatch[1]) : null;
  };

  /**
   * Clean anime title by removing subtitles and extra text, but KEEP the season
   * "Solo Leveling Season 2 -Arise from the Shadow-" → "Solo Leveling Season 2"
   */
  const cleanAnimeTitle = (title, keepSeason = true) => {
    if (!title) return '';
    
    // First, extract season info to preserve it
    const seasonMatch = title.match(/(Season\s*\d+)/i);
    const seasonText = seasonMatch ? seasonMatch[1] : '';
    
    let cleaned = title
      // Remove anything in brackets or parentheses
      .replace(/[\[\(].*?[\]\)]/g, '')
      // Remove subtitle after dash (e.g., "-Arise from the Shadow-")
      .replace(/\s*-[^-]+?-\s*/g, ' ')
      // Remove trailing dash followed by subtitle (e.g., "- Subtitle Here")
      .replace(/\s*-\s*[A-Z][a-z].*$/g, '')
      // Remove common suffixes like "Part 2", "Cour 2" (but not Season)
      .replace(/\s*(Part|Cour|Arc)\s*\d+\s*/gi, ' ')
      // Remove "The Animation", "The Movie", etc.
      .replace(/\s*The\s+(Animation|Movie|Series)\s*/gi, ' ')
      // Remove colon and everything after for very long titles
      .replace(/:\s*[A-Z].*$/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    // If we removed the season by accident and keepSeason is true, add it back
    if (keepSeason && seasonText && !cleaned.toLowerCase().includes('season')) {
      // Check if we should add it back
      const baseName = cleaned.replace(/\s*Season\s*\d+\s*/gi, '').trim();
      cleaned = `${baseName} ${seasonText}`;
    }
    
    return cleaned;
  };

  /**
   * Get base title without season (for matching purposes)
   * "Solo Leveling Season 2" → "Solo Leveling"
   */
  const getBaseTitleWithoutSeason = (title) => {
    if (!title) return '';
    return title
      .replace(/\s*Season\s*\d+\s*/gi, ' ')
      .replace(/\s+S\d{1,2}\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  /**
   * Generate fallback search queries for anime/shows when initial search fails
   * IMPORTANT: Season must always be preserved - we only remove episode number and subtitle
   * Returns an array of progressively simpler queries to try
   */
  const generateFallbackQueries = (mediaInfo, season = null, episode = null) => {
    const queries = [];
    const originalTitle = getTitle(mediaInfo);
    
    // Extract season from title if not provided as parameter
    const titleSeason = extractSeasonFromTitle(originalTitle);
    const effectiveSeason = season || titleSeason;
    
    // Clean title but KEEP season
    const cleanedWithSeason = cleanAnimeTitle(originalTitle, true);
    
    // Get base title without season for reconstruction
    const baseTitle = getBaseTitleWithoutSeason(originalTitle);
    
    console.log(`🔄 Generating fallback queries:`, {
      originalTitle,
      cleanedWithSeason,
      baseTitle,
      effectiveSeason
    });
    
    if (mediaInfo.type === 'anime') {
      // For anime, try these fallback strategies in order:
      // IMPORTANT: Always keep the season number!
      
      // 1. Cleaned title with season (removes subtitle but keeps season)
      // "Solo Leveling Season 2 -Arise from the Shadow-" → "Solo Leveling Season 2"
      if (cleanedWithSeason !== originalTitle) {
        queries.push(cleanedWithSeason);
      }
      
      // 2. Base title + Season (explicit season format)
      if (effectiveSeason) {
        queries.push(`${baseTitle} Season ${effectiveSeason}`);
        queries.push(`${baseTitle} S${String(effectiveSeason).padStart(2, '0')}`);
      }
      
      // 3. Only if no season-specific results, try base title alone (last resort)
      // This might find complete series packs
      queries.push(baseTitle);
      
      // 4. Try with batch/complete keywords + season
      if (effectiveSeason) {
        queries.push(`${baseTitle} Season ${effectiveSeason} batch`);
        queries.push(`${baseTitle} Season ${effectiveSeason} complete`);
      }
      
    } else if (mediaInfo.type === 'shows') {
      // For TV shows:
      // IMPORTANT: Always keep the season number!
      
      // 1. Title + Season (no episode) - finds season packs
      if (effectiveSeason) {
        queries.push(`${baseTitle} Season ${effectiveSeason}`);
        queries.push(`${baseTitle} S${String(effectiveSeason).padStart(2, '0')}`);
      }
      
      // 2. Just the base title (might find complete series)
      queries.push(baseTitle);
      
      // 3. Complete series with season
      if (effectiveSeason) {
        queries.push(`${baseTitle} Season ${effectiveSeason} complete`);
      }
    }
    
    // Remove duplicates and empty strings
    return [...new Set(queries.filter(q => q && q.trim()))];
  };

  /**
   * Build search query from media info
   * Movies: "The Matrix 1999"
   * Shows: "Breaking Bad S01E01"
   * Anime: "Attack on Titan S02E05"
   */
  const buildSearchQuery = (mediaInfo, season = null, episode = null) => {
    if (!mediaInfo) return '';

    let title = getTitle(mediaInfo);

    if (mediaInfo.type === 'movies') {
      const year = mediaInfo.release_date?.substring(0, 4) || '';
      return `${title} ${year}`.trim();
    } else if (mediaInfo.type === 'shows' || mediaInfo.type === 'anime') {
      // For shows with long titles or colons, try to use shorter, cleaner version
      // Example: "Law & Order: Special Victims Unit" → "Law Order SVU"
      // This helps find more torrents which often use abbreviated names

      // Remove special characters and extra whitespace
      title = title.replace(/[&:]/g, ' ')  // Remove & and :
                   .replace(/\s+/g, ' ')    // Normalize whitespace
                   .trim();

      // Apply common abbreviations to improve search results
      // Torrent names often use abbreviated show names
      const abbreviations = {
        'Special Victims Unit': 'SVU',
        'Criminal Intent': 'CI',
        'Criminal Minds': 'CM',
        'Crime Scene Investigation': 'CSI',
      };

      for (const [full, abbr] of Object.entries(abbreviations)) {
        // Case-insensitive check
        const regex = new RegExp(full, 'gi');
        if (regex.test(title)) {
          title = title.replace(regex, abbr);
          console.log(`📝 Abbreviated title: "${mediaInfo.title}" → "${title}"`);
          break;
        }
      }

      // For "Law & Order" franchise, try multiple search variations
      // "Law Order SVU" → Try both "Law and Order SVU" and "SVU"
      if (title.toLowerCase().startsWith('law order ')) {
        const variant = title.substring('law order '.length).trim();
        if (variant && variant.length > 0) {
          // Use "Law and Order [variant]" format which matches more torrents
          // Many torrents use "Law.and.Order.SVU" instead of just "SVU"
          title = `Law and Order ${variant}`;
          console.log(`📝 Law & Order search: "${title}"`);
        }
      }

      // Handle season formatting differently for anime vs shows
      if (mediaInfo.type === 'anime') {
        // Anime typically don't use seasons like TV shows
        // Use more specific episode format to avoid batch results: "Title 001" or "Title Episode 1"
        const episodeStr = episode ? String(episode).padStart(3, '0') : '';
        const episodeAlt = episode ? `Episode ${episode}` : '';
        // Try the padded number format first, as it's more common for anime torrents
        return episodeStr ? `${title} ${episodeStr}` : title;
      } else {
        // For regular shows, use standard SxxEyy format
        const seasonStr = season ? `S${String(season).padStart(2, '0')}` : '';
        const episodeStr = episode ? `E${String(episode).padStart(2, '0')}` : '';
        return `${title} ${seasonStr}${episodeStr}`.trim();
      }
    }

    return title;
  };

  /**
   * Proactive torrent preparation - starts searching before user needs it
   * Called when user navigates to an item page
   * Returns the promise so other calls can wait for it
   */
  const prepareTorrent = (mediaInfo, season = null, episode = null) => {
    const cacheKey = `${mediaInfo.id}_${season || 'movie'}_${episode || ''}`;

    // Don't prepare if already cached
    if (torrentCache[cacheKey]) {
      console.log(`⚡ Torrent already prepared for ${cacheKey}`);
      return Promise.resolve(torrentCache[cacheKey].streamUrl);
    }

    console.log(`🔮 Proactively preparing torrent for: ${cacheKey}`);

    // Start background preparation and return the promise
    // This allows other calls to reuse the same in-flight preparation
    return autoSearchAndSelect(mediaInfo, season, episode).then(streamUrl => {
      if (streamUrl) {
        setTorrentCache(prev => ({
          ...prev,
          [cacheKey]: { streamUrl, timestamp: Date.now() }
        }));
        console.log(`✅ Torrent prepared and cached for ${cacheKey}`);
      }
      return streamUrl;
    }).catch(err => {
      console.log(`⚠️ Proactive preparation failed for ${cacheKey}:`, err);
      return null;
    });
  };

  /**
   * Search for torrents with a specific query
   * @returns {Array} Array of torrents found
   */
  const searchTorrentsWithQuery = async (query) => {
    try {
      const searchRes = await fetch(
        `${API_URL}/torrents/search/${encodeURIComponent(query)}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!searchRes.ok) {
        console.warn(`⚠️ Search failed for "${query}":`, searchRes.status);
        return [];
      }

      const searchData = await searchRes.json();
      return searchData?.data?.torrents || [];
    } catch (error) {
      console.error(`❌ Search error for "${query}":`, error);
      return [];
    }
  };

  /**
   * Automatically search for torrents, select the best one, and return streaming URL
   * This happens completely in the background - no UI interaction needed
   * 
   * SMART FALLBACK: If initial search fails, progressively simplifies the query
   * to find season packs/batch torrents, then selects the correct episode file.
   *
   * @param {Object} mediaInfo - Media information (movie/show/anime)
   * @param {number} season - Season number (for shows/anime)
   * @param {number} episode - Episode number (for shows/anime)
   * @returns {string|null} Streaming URL or null if failed
   */
  const autoSearchAndSelect = async (mediaInfo, season = null, episode = null) => {
    // Check cache first for instant response
    const cacheKey = `${mediaInfo.id}_${season || 'movie'}_${episode || ''}`;
    const cached = torrentCache[cacheKey];

    if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 min cache
      console.log(`⚡ Using cached torrent stream for ${cacheKey}`);
      return cached.streamUrl;
    }

    // Check if torrent is already being prepared (avoid race condition)
    const pending = pendingTorrentsRef.current.get(cacheKey);
    if (pending) {
      console.log(`⏳ Torrent already being prepared for ${cacheKey}, waiting...`);
      return pending; // Return the existing promise
    }

    // Create promise for this torrent preparation
    const preparationPromise = (async () => {
      try {
      const query = buildSearchQuery(mediaInfo, season, episode);
      if (!query) {
        console.warn('⚠️ Cannot build search query');
        return null;
      }

      console.log(`🔍 Auto-searching torrents: "${query}"`);

      // Step 1: Search torrents across all sources
      let torrents = await searchTorrentsWithQuery(query);
      let usedFallback = false;
      let fallbackQueryUsed = null;

      // Step 1.5: SMART FALLBACK - If no results, try progressively simpler queries
      if ((!torrents || torrents.length === 0) && (mediaInfo.type === 'anime' || mediaInfo.type === 'shows')) {
        console.log(`⚠️ No torrents found with initial query, trying fallback searches...`);
        
        const fallbackQueries = generateFallbackQueries(mediaInfo, season, episode);
        console.log(`🔄 Fallback queries to try: ${fallbackQueries.join(', ')}`);

        for (const fallbackQuery of fallbackQueries) {
          console.log(`🔍 Trying fallback: "${fallbackQuery}"`);
          torrents = await searchTorrentsWithQuery(fallbackQuery);
          
          if (torrents && torrents.length > 0) {
            console.log(`✅ Fallback search found ${torrents.length} torrents with: "${fallbackQuery}"`);
            usedFallback = true;
            fallbackQueryUsed = fallbackQuery;
            break;
          }
        }
      }

      console.log('🔍 Search response:', { 
        torrentCount: torrents?.length || 0, 
        usedFallback, 
        fallbackQuery: fallbackQueryUsed 
      });

      if (!torrents || torrents.length === 0) {
        console.warn('⚠️ No torrents found for:', query);
        console.warn('   Also tried fallback queries but none returned results');
        return null;
      }

      console.log(`📦 Found ${torrents.length} torrents${usedFallback ? ` (via fallback: "${fallbackQueryUsed}")` : ''}`);

      // Step 2: Auto-select best torrent
      // Filter for browser-compatible torrents AND validate they match the search query
      // NOTE: When using fallback (batch/season torrents), we relax episode matching
      // because the server will select the correct file from within the torrent
      console.log('🔍 About to check torrent compatibility...');
      console.log('🔍 Media info:', { type: mediaInfo.type, title: getTitle(mediaInfo), episode, usedFallback });

      console.log('🔍 Checking torrent compatibility...');
      console.log('📊 Total torrents received:', torrents.length);

      let compatibleTorrents = [];
      try {
        compatibleTorrents = torrents.filter(t => {
        const seeders = parseInt(t.Seeders) || 0;
        const name = t.Name.toLowerCase();

        // Minimum seeders filter (relaxed for batch torrents from fallback)
        const minSeeders = usedFallback ? 3 : 5;
        if (seeders < minSeeders) return false;

        // === Validate torrent matches the requested content ===
        let titleWords = getTitle(mediaInfo).toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2); // Ignore short words like "a", "of", etc.
        
        // Also check against cleaned title for anime
        const cleanedTitleWords = cleanAnimeTitle(getTitle(mediaInfo)).toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2);

        // For shows/anime, validate season and episode (or accept batch torrents)
        if (mediaInfo.type === 'shows' && !usedFallback) {
          // For shows with direct search, require exact S01E01 format
          const seasonStr = season ? `s${String(season).padStart(2, '0')}` : '';
          const episodeStr = episode ? `e${String(episode).padStart(2, '0')}` : '';
          const sePattern = `${seasonStr}${episodeStr}`;

          if (!name.includes(sePattern)) {
            // Also check for season-only match (season pack)
            const seasonOnlyPattern = `${seasonStr}`;
            const isSeasonPack = name.includes('complete') || 
                                 name.includes('season') || 
                                 (seasonOnlyPattern && name.includes(seasonOnlyPattern) && !name.includes('e01'));
            
            if (!isSeasonPack) {
              console.log(`⚠️ Skipping ${t.Name} - doesn't match ${sePattern.toUpperCase()}`);
              return false;
            } else {
              console.log(`📦 Accepting season pack: ${t.Name}`);
            }
          }
        } else if (mediaInfo.type === 'shows' && usedFallback) {
          // For fallback searches, accept season packs
          const seasonStr = season ? `s${String(season).padStart(2, '0')}` : '';
          const hasCorrectSeason = name.includes(seasonStr) || 
                                   name.includes(`season ${season}`) ||
                                   name.includes('complete');
          
          if (!hasCorrectSeason && season) {
            console.log(`⚠️ Skipping ${t.Name} - doesn't contain season ${season}`);
            return false;
          }
          console.log(`📦 Fallback: Accepting batch torrent for shows: ${t.Name.substring(0, 50)}...`);
        } else if (mediaInfo.type === 'anime') {
          // For anime, be more lenient - allow batch torrents
          // The server will select the correct episode file
          const requestedEpisode = parseInt(episode);

          console.log(`🔍 Checking anime torrent: ${t.Name.substring(0, 60)}... for episode ${requestedEpisode}`);

          // Check for indicators that this might be a batch/complete torrent
          const isBatchTorrent = name.includes('batch') || 
                                 name.includes('complete') ||
                                 name.includes('season') ||
                                 name.includes('s01') || name.includes('s02') ||
                                 /\d+\s*[-~]\s*\d+/.test(name); // Range like "01-12" or "1~24"

          // Check for episode patterns
          const episodePatterns = [
            `episode ${requestedEpisode}`,
            `episode ${String(requestedEpisode).padStart(2, '0')}`,
            `episode ${String(requestedEpisode).padStart(3, '0')}`,
            `e${String(requestedEpisode).padStart(2, '0')}`,
            `e${String(requestedEpisode).padStart(3, '0')}`,
            ` ${String(requestedEpisode).padStart(3, '0')}`,  // " 001"
            ` ${String(requestedEpisode).padStart(2, '0')}`,  // " 01"
            `-${String(requestedEpisode).padStart(3, '0')}`,  // "-001"
            `.${String(requestedEpisode).padStart(3, '0')}.`, // ".001."
            `[${String(requestedEpisode).padStart(2, '0')}]`, // "[01]"
          ];

          let hasEpisodeMatch = episodePatterns.some(p => name.includes(p.toLowerCase()));

          // For batch torrents, check if episode is within range
          if (!hasEpisodeMatch && isBatchTorrent) {
            const rangeMatch = name.match(/(\d+)\s*[-~]\s*(\d+)/);
            if (rangeMatch) {
              const start = parseInt(rangeMatch[1]);
              const end = parseInt(rangeMatch[2]);
              if (requestedEpisode >= start && requestedEpisode <= end) {
                hasEpisodeMatch = true;
                console.log(`✅ Episode ${requestedEpisode} within batch range ${start}-${end}`);
              }
            }
          }

          // If this is from fallback search, be more lenient
          if (usedFallback) {
            // Accept batch torrents - server will find the right file
            if (isBatchTorrent) {
              console.log(`📦 Fallback: Accepting batch torrent: ${t.Name.substring(0, 50)}...`);
            } else {
              console.log(`📦 Fallback: Accepting torrent (will check for episode in files): ${t.Name.substring(0, 50)}...`);
            }
            // Don't reject - let the server handle episode selection
          } else if (!hasEpisodeMatch && !isBatchTorrent) {
            console.log(`⚠️ Skipping ${t.Name.substring(0, 50)}... - no episode match`);
            return false;
          }

          console.log(`✅ Anime torrent passed: ${t.Name.substring(0, 50)}...`);
        }

        // Add common abbreviations to title words to improve matching
        const titleLower = getTitle(mediaInfo).toLowerCase();

        if (titleLower.includes('special victims unit')) {
          titleWords.push('svu');
        }
        if (titleLower.includes('criminal intent')) {
          titleWords.push('ci');
        }

        // When using fallback, also use cleaned title words for matching
        // This helps match "Solo Leveling" when searching for "Solo Leveling Season 2 -Arise from the Shadow-"
        const wordsToMatch = usedFallback ? [...new Set([...titleWords, ...cleanedTitleWords])] : titleWords;

        // Check if torrent name contains at least 30% of significant title words
        // (Reduced to 20% when using fallback to be more lenient with batch torrents)
        const minMatchRatio = usedFallback ? 0.2 : 0.3;
        const matchedWords = wordsToMatch.filter(word => name.includes(word));
        const matchRatio = matchedWords.length / Math.max(wordsToMatch.length, 1);

        if (matchRatio < minMatchRatio) {
          console.log(`⚠️ Skipping ${t.Name} - title mismatch (${Math.round(matchRatio * 100)}% match, need ${minMatchRatio * 100}%+)`);
          return false;
        }

        // Filter out obviously wrong content (adult, unrelated shows, etc.)
        const isAdultContent = /\b(xxx|porn|sex|nsfw|adult|hentai)\b/i.test(name);
        if (isAdultContent) {
          console.log(`⚠️ Skipping ${t.Name} - adult content`);
          return false;
        }

        // ⚠️ CRITICAL: Filter out AV1 codec (100% incompatible)
        const isAV1 = /\b(av1|av\.1)\b/i.test(name);
        if (isAV1) {
          console.log(`⚠️ Skipping ${t.Name} - AV1 not supported`);
          return false;
        }

        // AUDIO CODEC FILTERING: Skip torrents with known incompatible audio
        // Browsers support: AAC, MP3, Opus, Vorbis
        // Browsers DON'T support: DTS, AC3, TrueHD, Atmos, FLAC
        const hasKnownBadAudio = /\b(dts|ac3|truehd|atmos|flac)\b/i.test(name);
        if (hasKnownBadAudio) {
          const badCodec = name.match(/\b(dts|ac3|truehd|atmos|flac)\b/i)[0].toUpperCase();
          console.log(`⚠️ Skipping ${t.Name} - ${badCodec} audio not supported by browsers`);
          return false;
        }

        // MKV CONTAINER WARNING: MKV files often have incompatible audio (DTS/AC3)
        // Prefer MP4/WebM containers when possible
        const isMKV = /\.mkv\b/i.test(name);
        const hasGoodAudio = /\b(aac|mp3|opus|vorbis)\b/i.test(name);

        if (isMKV && !hasGoodAudio) {
          // MKV without explicit AAC/MP3 mention - risky for audio compatibility
          console.log(`⚠️ Warning: ${t.Name} is MKV without AAC/MP3 - audio might not work`);
          // Don't skip entirely, but deprioritize by reducing score
          t.Score = (parseInt(t.Score) || 0) * 0.5;
        }

        return true;
      });
      } catch (error) {
        console.error('❌ Error during torrent compatibility filtering:', error);
        console.error('Error details:', error.stack);
        // Fall back to all torrents if filtering fails
        compatibleTorrents = torrents.slice(0, 3); // Take first 3 as fallback
      }

      console.log(`📊 Compatibility results: ${compatibleTorrents.length}/${torrents.length} torrents passed filtering`);

      if (compatibleTorrents.length === 0) {
        console.error('❌ No compatible torrents found for this specific episode/movie');
        console.error(`   Searched for: "${query}"`);
        console.error(`   Found ${torrents.length} torrents but none matched requirements`);
        console.error('   Requirements: correct season/episode + title match + browser-compatible audio');

        // DO NOT FALLBACK - returning wrong content is worse than no content
        return null;
      }

      // SMART SCORING: Boost torrents with good audio and video codecs
      compatibleTorrents.forEach(t => {
        let score = parseInt(t.Score) || 0;
        const name = t.Name.toLowerCase();

        // AUDIO BOOST: Prefer explicit AAC/MP3 (guaranteed to work)
        if (/\b(aac|mp3)\b/i.test(name)) {
          score += 500;
          console.log(`   📈 +500 for ${t.Name.substring(0, 50)}... (AAC/MP3 audio)`);
        }

        // CONTAINER BOOST: Prefer MP4 over MKV (better audio compatibility)
        if (/\.mp4\b/i.test(name)) {
          score += 300;
          console.log(`   📈 +300 for ${t.Name.substring(0, 50)}... (MP4 container)`);
        }

        // VIDEO CODEC BOOST: Prefer H.264 over x265 (universal compatibility)
        if (/\b(h\.?264|x264)\b/i.test(name)) {
          score += 200;
          console.log(`   📈 +200 for ${t.Name.substring(0, 50)}... (H.264 video)`);
        }

        t.Score = score;
      });

      // Sort by score and pick the best
      compatibleTorrents.sort((a, b) => (b.Score || 0) - (a.Score || 0));
      const bestTorrent = compatibleTorrents[0];

      console.log(`✅ Auto-selected: ${bestTorrent.Name}`);
      console.log(`   Quality: ${bestTorrent.Quality}, Seeders: ${bestTorrent.Seeders}, Score: ${bestTorrent.Score}`);

      // Store alternatives (top 10 after the best one) for source selection UI
      const alternatives = compatibleTorrents.slice(1, 11).map(t => {
        // Extract Quality and Source from multiple possible locations
        const scoreDetails = t._scoreDetails || {};
        
        // Try multiple sources: enriched fields -> scoreDetails -> name parsing
        let quality = t.Quality || scoreDetails.resolution;
        let source = t.Type || scoreDetails.source;
        
        // Fallback: extract from torrent name if still unknown
        if (!quality || quality === 'Unknown' || !source || source === 'Unknown') {
          const nameExtracted = extractQualityAndSourceFromName(t.Name);
          quality = quality && quality !== 'Unknown' ? quality : nameExtracted.quality;
          source = source && source !== 'Unknown' ? source : nameExtracted.source;
        }
        
        // Final fallback
        quality = quality || 'Unknown';
        source = source || 'Unknown';
        
        const language = t.AudioLanguage || scoreDetails.audioLanguage || 'English';
        const audioCodec = t.AudioCodec || scoreDetails.audioCodec || 'Unknown';
        
        const alt = {
          Name: t.Name,
          Magnet: t.Magnet,
          Size: t.Size,
          Seeders: t.Seeders,
          Score: t.Score,
          Quality: quality,
          Source: source,
          Language: language,
          AudioCodec: audioCodec
        };
        
        // Debug: Log first alternative to verify data structure
        if (compatibleTorrents.indexOf(t) === 1) {
          console.log('📊 Sample alternative torrent data:', {
            Name: alt.Name,
            Quality: alt.Quality,
            Source: alt.Source,
            Language: alt.Language,
            hasQuality: !!t.Quality,
            hasType: !!t.Type,
            hasScoreDetails: !!t._scoreDetails,
            scoreDetailsResolution: scoreDetails.resolution,
            scoreDetailsSource: scoreDetails.source,
            extractedFromName: extractQualityAndSourceFromName(t.Name)
          });
        }
        
        return alt;
      });
      setAlternativeTorrents(alternatives);
      setCurrentSourceName(bestTorrent.Name);
      console.log(`📚 Stored ${alternatives.length} alternative sources for user selection`);

      // Step 3: Try torrents SEQUENTIALLY to avoid Real-Debrid rate limiting
      const torrentsToTry = compatibleTorrents.slice(0, 3);
      console.log(`🔄 Trying ${torrentsToTry.length} torrents sequentially (to avoid rate limits)...`);

      const tryAddTorrent = async (torrent, index) => {
        console.log(`🔄 [Race ${index + 1}] Starting: ${torrent.Name}`);

        try {
          const addRes = await fetch(`${API_URL}/torrents/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              magnetURI: torrent.Magnet,
              episodeInfo: mediaInfo.type === 'anime' ? { episode: parseInt(episode) } : null
            }),
            signal: AbortSignal.timeout(45000) // Increased timeout for debrid processing
          });

          if (!addRes.ok) {
            console.warn(`⚠️ [Race ${index + 1}] Failed: HTTP ${addRes.status}`);
            return null;
          }

          const addData = await addRes.json();
          const info = addData?.data;

          console.log(`📦 [Race ${index + 1}] Response:`, {
            streamType: info?.streamType,
            hasStreamUrl: !!info?.streamUrl,
            filesCount: info?.files?.length
          });

          if (!info || !info.files || info.files.length === 0) {
            console.warn(`⚠️ [Race ${index + 1}] Invalid response`);
            return null;
          }

          console.log(`✅ [Race ${index + 1}] SUCCESS: ${torrent.Name}`);
          return { torrent, info };
        } catch (error) {
          console.warn(`⚠️ [Race ${index + 1}] Error: ${error.message}`);
          return null;
        }
      };

      // Try torrents sequentially to avoid rate limiting
      let torrentInfo = null;
      let selectedTorrent = null;

      for (let i = 0; i < torrentsToTry.length; i++) {
        const result = await tryAddTorrent(torrentsToTry[i], i);
        if (result) {
          ({ torrent: selectedTorrent, info: torrentInfo } = result);
          console.log(`🏆 SUCCESS with torrent ${i + 1}: ${selectedTorrent.Name}`);
          break;
        }
        // Small delay between attempts to avoid rate limiting
        if (i < torrentsToTry.length - 1) {
          console.log(`⏳ Waiting 1s before trying next torrent...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!torrentInfo || !selectedTorrent) {
        console.warn('⚠️ All torrents failed');
        return null;
      }

      console.log(`🎬 Torrent added: ${torrentInfo.name}`);
      console.log(`📂 Torrent has ${torrentInfo.files?.length || 0} files`);

      // Check if this is a DEBRID stream (direct HTTP URL)
      if (torrentInfo.streamType === 'debrid' && torrentInfo.streamUrl) {
        console.log(`🚀 DEBRID STREAM! Using ${torrentInfo.service} cached content`);
        console.log(`📹 File: ${torrentInfo.name}`);

        // Store hash for tracking (even though it's debrid)
        setActiveHash(torrentInfo.hash);
        setActiveFileIndex(0);
        setIsDebridStream(true); // Mark as debrid so VideoPlayer doesn't poll P2P stats
        
        // Store subtitles from torrent if available
        if (torrentInfo.subtitles && torrentInfo.subtitles.length > 0) {
          console.log(`📄 Found ${torrentInfo.subtitles.length} subtitles in torrent`);
          setTorrentSubtitles(torrentInfo.subtitles);
        } else {
          setTorrentSubtitles([]);
        }

        // Return direct HTTP URL from debrid service
        console.log(`🎥 Debrid streaming URL ready (instant!)`);
        return torrentInfo.streamUrl;
      }

      // P2P stream - not debrid
      setIsDebridStream(false);

      // Step 4: Find correct video file (for P2P torrents)
      const videoExtensions = /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)$/i;

      // Check if files array exists and has content
      if (!torrentInfo.files || torrentInfo.files.length === 0) {
        console.warn('⚠️ Torrent has no files array or empty files');
        console.log('Torrent info:', JSON.stringify(torrentInfo, null, 2));
        return null;
      }

      const videoFiles = torrentInfo.files.filter(f =>
        videoExtensions.test(f.name)
      );

      if (videoFiles.length === 0) {
        console.warn('⚠️ No video files found in torrent');
        console.log('Available files:', torrentInfo.files.map(f => f.name));
        return null;
      }

      // Use server-selected file index if available (for anime episodes)
      let selectedFile = null;
      if (torrentInfo.selectedFileIndex !== null && torrentInfo.selectedFileIndex !== undefined) {
        selectedFile = torrentInfo.files[torrentInfo.selectedFileIndex];
        console.log(`🎯 Using server-selected episode file: ${selectedFile?.name} (index ${torrentInfo.selectedFileIndex})`);
      }

      // Fallback: Find correct episode file client-side
      if (!selectedFile && mediaInfo.type === 'anime' && episode) {
        const episodeNum = parseInt(episode);
        const paddedEp2 = String(episodeNum).padStart(2, '0');
        const paddedEp3 = String(episodeNum).padStart(3, '0');

        console.log(`🔍 Client-side search for episode ${episodeNum}...`);

        for (const file of videoFiles) {
          const fileName = file.name.toLowerCase();

          // Strict patterns for episode matching
          const patterns = [
            new RegExp(`[\\s\\-_\\.\\[\\(]${paddedEp3}[\\s\\-_\\.\\]\\)\\[]`, 'i'),
            new RegExp(`[\\s\\-_\\.\\[\\(]${paddedEp2}[\\s\\-_\\.\\]\\)\\[]`, 'i'),
            new RegExp(`episode\\s*${paddedEp3}[^\\d]`, 'i'),
            new RegExp(`episode\\s*${paddedEp2}[^\\d]`, 'i'),
            new RegExp(`\\be${paddedEp2}[^\\d]`, 'i'),
            new RegExp(`\\be${paddedEp3}[^\\d]`, 'i'),
          ];

          for (const pattern of patterns) {
            if (pattern.test(fileName)) {
              // Additional check: make sure filename doesn't contain wrong episode numbers
              const allNumbers = fileName.match(/\d+/g) || [];
              const relevantNumbers = allNumbers.filter(n => {
                const num = parseInt(n);
                return num > 0 && num < 2000;
              }).map(n => parseInt(n));

              if (relevantNumbers.includes(episodeNum)) {
                selectedFile = file;
                console.log(`✅ Found episode ${episodeNum}: ${file.name}`);
                break;
              }
            }
          }

          if (selectedFile) break;
        }
      }

      // Final fallback: Select largest video file
      if (!selectedFile) {
        selectedFile = videoFiles.reduce((prev, current) =>
          (current.size || current.length || 0) > (prev.size || prev.length || 0) ? current : prev
        );
        console.log(`⚠️ Using largest file as fallback: ${selectedFile.name}`);
      }

      const largestFile = selectedFile;

      const fileSize = largestFile.size || largestFile.length || 0;
      console.log(`📹 Selected file: ${largestFile.name} (${Math.round(fileSize / 1024 / 1024)}MB)`);

      // Step 5: Store active torrent info
      setActiveHash(torrentInfo.hash);
      setActiveFileIndex(largestFile.index);

      // Step 6: Return streaming URL (P2P through our server)
      const streamUrl = `${API_URL}/torrents/stream/${torrentInfo.hash}/files/${largestFile.index}/stream`;
      console.log(`🎥 P2P Streaming URL ready`);

      return streamUrl;

      } catch (error) {
        console.error('❌ Auto-torrent error:', error);
        return null;
      } finally {
        // Remove from pending map
        pendingTorrentsRef.current.delete(cacheKey);
      }
    })();

    // Store in pending map
    pendingTorrentsRef.current.set(cacheKey, preparationPromise);

    return preparationPromise;
  };

  /**
   * Switch to an alternative torrent source
   * Called when user selects a different source from the settings menu
   * @param {Object} source - The alternative torrent source to switch to
   * @returns {string|null} New streaming URL or null if failed
   */
  const switchToAlternativeSource = async (source, mediaInfo = null, episode = null) => {
    if (!source || !source.Magnet) {
      console.warn('⚠️ Invalid source for switching');
      return null;
    }

    console.log(`🔄 Switching to alternative source: ${source.Name}`);

    try {
      const addRes = await fetch(`${API_URL}/torrents/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          magnetURI: source.Magnet,
          episodeInfo: mediaInfo?.type === 'anime' && episode ? { episode: parseInt(episode) } : null
        }),
        signal: AbortSignal.timeout(45000)
      });

      if (!addRes.ok) {
        console.warn(`⚠️ Failed to switch source: HTTP ${addRes.status}`);
        return null;
      }

      const addData = await addRes.json();
      const info = addData?.data;

      if (!info) {
        console.warn('⚠️ Invalid response from source switch');
        return null;
      }

      // Handle debrid stream
      if (info.streamType === 'debrid' && info.streamUrl) {
        console.log(`🚀 Switched to DEBRID stream: ${info.service}`);
        setActiveHash(info.hash);
        setActiveFileIndex(0);
        setIsDebridStream(true);
        setCurrentSourceName(source.Name);
        
        if (info.subtitles && info.subtitles.length > 0) {
          setTorrentSubtitles(info.subtitles);
        } else {
          setTorrentSubtitles([]);
        }

        return info.streamUrl;
      }

      // Handle P2P stream
      setIsDebridStream(false);

      if (!info.files || info.files.length === 0) {
        console.warn('⚠️ No files in torrent');
        return null;
      }

      // Find video file
      const videoExtensions = /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)$/i;
      const videoFiles = info.files.filter(f => videoExtensions.test(f.name));

      if (videoFiles.length === 0) {
        console.warn('⚠️ No video files found');
        return null;
      }

      const largestFile = videoFiles.reduce((prev, current) =>
        (current.size || current.length || 0) > (prev.size || prev.length || 0) ? current : prev
      );

      setActiveHash(info.hash);
      setActiveFileIndex(largestFile.index);
      setCurrentSourceName(source.Name);

      const streamUrl = `${API_URL}/torrents/stream/${info.hash}/files/${largestFile.index}/stream`;
      console.log(`✅ Switched to P2P source: ${source.Name}`);

      return streamUrl;
    } catch (error) {
      console.error('❌ Error switching source:', error);
      return null;
    }
  };

  const value = {
    activeHash,
    activeFileIndex,
    isDebridStream, // True if using debrid (no P2P stats polling needed)
    torrentSubtitles, // Subtitles extracted from torrent files
    autoSearchAndSelect,
    buildSearchQuery,
    prepareTorrent, // Expose for proactive preparation
    // NEW: Alternative source selection
    alternativeTorrents,
    currentSourceName,
    switchToAlternativeSource,
    // Utility functions
    cleanAnimeTitle, // Clean anime titles for better search
    generateFallbackQueries, // Generate fallback search queries
    getBaseTitleWithoutSeason // Get base title without season info
  };

  return (
    <TorrentContext.Provider value={value}>
      {children}
    </TorrentContext.Provider>
  );
};

export default TorrentContext;
