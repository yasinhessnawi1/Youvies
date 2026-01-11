import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipBack, 
  SkipForward,
  Settings,
  Download,
  Loader2,
  Users,
  Activity,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  Subtitles,
  Languages,
  Search,
  Globe,
  X,
  Minimize2,
  Star,
  Check
} from 'lucide-react';
import { config } from '../config/environment';
import progressService from '../services/progressService';
import { UserContext } from '../contexts/UserContext';
import '../styles/components/VideoPlayer.css';

// ============================================================================
// IndexedDB Helper for Subtitle Timing Persistence
// ============================================================================
const SUBTITLE_DB_NAME = 'YouviesSubtitleTimings';
const SUBTITLE_STORE_NAME = 'timings';
const SUBTITLE_DB_VERSION = 1;

/**
 * Initialize IndexedDB for subtitle timings
 */
const initSubtitleDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SUBTITLE_DB_NAME, SUBTITLE_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SUBTITLE_STORE_NAME)) {
        const store = db.createObjectStore(SUBTITLE_STORE_NAME, { keyPath: 'subtitleId' });
        store.createIndex('mediaTitle', 'mediaTitle', { unique: false });
        store.createIndex('lastUsed', 'lastUsed', { unique: false });
      }
    };
  });
};

/**
 * Generate a unique ID for a subtitle based on its properties
 */
const generateSubtitleId = (subtitle, mediaTitle) => {
  if (!subtitle) return null;
  
  // Create a unique key from subtitle properties
  const parts = [
    mediaTitle || 'unknown',
    subtitle.language || 'unknown',
    subtitle.source || 'local',
    subtitle.url || subtitle.index || 'default'
  ];
  
  return parts.join('::').toLowerCase().replace(/[^a-z0-9:]/g, '_');
};

/**
 * Save subtitle timing to IndexedDB
 */
const saveSubtitleTiming = async (subtitleId, offset, subtitle, mediaTitle) => {
  if (!subtitleId) return;
  
  try {
    const db = await initSubtitleDB();
    const transaction = db.transaction([SUBTITLE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SUBTITLE_STORE_NAME);
    
    const data = {
      subtitleId,
      offset,
      language: subtitle?.language || 'unknown',
      source: subtitle?.source || 'local',
      mediaTitle: mediaTitle || 'unknown',
      lastUsed: Date.now()
    };
    
    store.put(data);
    
    transaction.oncomplete = () => {
      console.log(`💾 Saved subtitle timing: ${subtitleId} = ${offset > 0 ? '+' : ''}${offset.toFixed(1)}s`);
      db.close();
    };
    
    transaction.onerror = () => {
      console.warn('Failed to save subtitle timing:', transaction.error);
      db.close();
    };
  } catch (error) {
    console.warn('IndexedDB error saving timing:', error);
  }
};

/**
 * Load subtitle timing from IndexedDB
 */
const loadSubtitleTiming = async (subtitleId) => {
  if (!subtitleId) return 0;
  
  try {
    const db = await initSubtitleDB();
    
    return new Promise((resolve) => {
      const transaction = db.transaction([SUBTITLE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(SUBTITLE_STORE_NAME);
      const request = store.get(subtitleId);
      
      request.onsuccess = () => {
        db.close();
        if (request.result) {
          console.log(`📂 Loaded subtitle timing: ${subtitleId} = ${request.result.offset > 0 ? '+' : ''}${request.result.offset.toFixed(1)}s`);
          resolve(request.result.offset);
        } else {
          resolve(0);
        }
      };
      
      request.onerror = () => {
        db.close();
        resolve(0);
      };
    });
  } catch (error) {
    console.warn('IndexedDB error loading timing:', error);
    return 0;
  }
};

/**
 * Clear old subtitle timings (older than 30 days)
 */
const cleanupOldTimings = async () => {
  try {
    const db = await initSubtitleDB();
    const transaction = db.transaction([SUBTITLE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SUBTITLE_STORE_NAME);
    const index = store.index('lastUsed');
    
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const range = IDBKeyRange.upperBound(thirtyDaysAgo);
    
    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    
    transaction.oncomplete = () => db.close();
  } catch (error) {
    console.warn('Failed to cleanup old timings:', error);
  }
};

/**
 * Clear ALL subtitle timings (reset everything)
 */
const clearAllSubtitleTimings = async () => {
  try {
    const db = await initSubtitleDB();
    const transaction = db.transaction([SUBTITLE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SUBTITLE_STORE_NAME);
    store.clear();
    
    transaction.oncomplete = () => {
      console.log('🗑️ Cleared all subtitle timing data');
      db.close();
    };
  } catch (error) {
    console.warn('Failed to clear timings:', error);
  }
};

// Run cleanup on module load
cleanupOldTimings();

const VideoPlayer = ({
  src,
  title,
  onTimeUpdate,
  onProgress,
  initialTime = 0,
  torrentHash = null,
  fileIndex = null,
  onClose = null,
  isDebridStream = false,  // If true, skip P2P stats polling
  isMovie = false,  // If true, skip resume dialog for movies
  torrentSubtitles = [],  // Subtitles extracted from torrent files
  // NEW: Video source selection props
  alternativeSources = [],  // List of alternative torrents
  onSourceChange = null,    // Callback when user selects different source
  currentSourceName = null  // Display name of current source
}) => {
  // Get user context for subtitle preferences
  const userContext = useContext(UserContext);
  
  // Get preferred subtitle language from context OR localStorage fallback
  const [localStorageSubtitleLang, setLocalStorageSubtitleLang] = useState(() => {
    try {
      return localStorage.getItem('preferredSubtitleLanguage') || null;
    } catch {
      return null;
    }
  });
  
  // Use context value if available, otherwise fall back to localStorage
  const preferredSubtitleLanguage = userContext?.preferredSubtitleLanguage || localStorageSubtitleLang;
  
  // Create a safe wrapper for setSubtitleLanguagePreference
  const setSubtitleLanguagePreference = useCallback((language) => {
    const normalizedLang = language?.toLowerCase();
    
    if (userContext?.setSubtitleLanguagePreference) {
      userContext.setSubtitleLanguagePreference(normalizedLang);
    } else {
      // Fallback: save to localStorage if context not available
      console.log('UserContext not available, saving to localStorage only');
    }
    
    // Always save to localStorage as backup
    try {
      localStorage.setItem('preferredSubtitleLanguage', normalizedLang);
      setLocalStorageSubtitleLang(normalizedLang);
      console.log(`✅ Preferred subtitle language set to: ${normalizedLang}`);
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }, [userContext]);
  
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [bufferRanges, setBufferRanges] = useState([]);
  const [instantPlayEnabled, setInstantPlayEnabled] = useState(true);
  const [bufferVisualization, setBufferVisualization] = useState({
    ahead: 0,
    behind: 0,
    total: 0,
    percentage: 0
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showSourceSelection, setShowSourceSelection] = useState(false); // NEW: Toggle source selection
  
  // Progress tracking states
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [hasShownResumeDialog, setHasShownResumeDialog] = useState(false);
  const [hasAppliedInitialTime, setHasAppliedInitialTime] = useState(false);
  
  // Subtitle/CC support
  const [availableSubtitles, setAvailableSubtitles] = useState([]);
  const [onlineSubtitles, setOnlineSubtitles] = useState([]);
  const [currentSubtitle, setCurrentSubtitle] = useState(null);
  const [currentSubtitleId, setCurrentSubtitleId] = useState(null); // Unique ID for timing persistence
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [subtitleOffset, setSubtitleOffset] = useState(0); // Timing offset in seconds (per subtitle file)
  const [showTimingControls, setShowTimingControls] = useState(false);
  
  // Enhanced torrent/streaming states
  const [torrentStats, setTorrentStats] = useState({
    peers: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    progress: 0,
    downloaded: 0,
    total: 0,
    isConnected: false
  });
  const [bufferHealth, setBufferHealth] = useState(0);
  const [networkStatus, setNetworkStatus] = useState('connecting');
  const [showTorrentStats, setShowTorrentStats] = useState(false); // Closed by default
  const [isSeeking, setIsSeeking] = useState(false);
  const [isWaitingForTorrent, setIsWaitingForTorrent] = useState(false);

  // Check if there's enough buffer at the current playback position
  const checkBufferAvailability = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const buffered = video.buffered;
    const currentTime = video.currentTime;

    if (buffered && buffered.length > 0) {
      let hasBuffer = false;
      let bufferAhead = 0;

      for (let i = 0; i < buffered.length; i++) {
        const start = buffered.start(i);
        const end = buffered.end(i);

        if (start <= currentTime && end > currentTime) {
          hasBuffer = true;
          bufferAhead = end - currentTime;
          break;
        }
      }

      const isTorrentStream = torrentHash !== null;
      // Reduced buffer requirements for better streaming performance
      const requiredBuffer = isTorrentStream ? 2 : 0.5; // Lower requirements to start playback sooner

      if (hasBuffer && bufferAhead >= requiredBuffer) {
        if (isWaitingForTorrent) {
          console.log('✅ Torrent buffer ready, resuming playback');
          setIsWaitingForTorrent(false);
        }
        setIsLoading(false);
      } else if (isTorrentStream && !hasBuffer && bufferAhead === 0) {
        // Only show waiting if we have truly zero buffer
        if (!isWaitingForTorrent) {
          console.log('⏳ Waiting for torrent to download data at current position...');
          setIsWaitingForTorrent(true);
        }
        setIsLoading(true);
      }
    }
  }, [torrentHash, isWaitingForTorrent]);
  
  const controlsTimeoutRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const lastTapTimeRef = useRef(0);
  const tapCountRef = useRef(0);

  // Check buffer availability when torrent stats change
  useEffect(() => {
    if (torrentHash && torrentStats) {
      checkBufferAvailability();
    }
  }, [torrentStats, torrentHash, checkBufferAvailability]);

  // Fetch real-time torrent statistics
  const fetchTorrentStats = useCallback(async () => {
    if (!torrentHash) return;

    try {
      const response = await fetch(config.getStatsUrl(torrentHash));
      if (response.ok) {
        const result = await response.json();
        // Handle backend response format: { success: true, data: {...} }
        const stats = result.data || result;

        setTorrentStats({
          peers: stats.numPeers || 0,
          downloadSpeed: stats.downloadSpeed || 0,
          uploadSpeed: stats.uploadSpeed || 0,
          progress: (stats.progress || 0) * 100, // Convert 0-1 to 0-100
          downloaded: stats.downloaded || 0,
          total: stats.total || 0,
          isConnected: (stats.numPeers || 0) > 0
        });

        setNetworkStatus((stats.numPeers || 0) > 0 ? 'connected' : 'seeking');

        // Calculate buffer health based on download speed vs playback
        if (videoRef.current && stats.downloadSpeed > 0) {
          const currentBitrate = videoRef.current.playbackRate * 1024 * 1024; // Estimate
          const health = Math.min(100, (stats.downloadSpeed / currentBitrate) * 100);
          setBufferHealth(health);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch torrent stats:', error);
      setNetworkStatus('disconnected');
    }
  }, [torrentHash]);

  // Enhanced buffer monitoring for instant streaming
  const updateBufferedProgress = useCallback(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const buffered = video.buffered;
    const currentTime = video.currentTime;
    const duration = video.duration;
    
    if (buffered.length > 0 && duration) {
      const ranges = [];
      let bufferedEnd = 0;
      let bufferAhead = 0;
      let bufferBehind = 0;
      
      // Calculate all buffered ranges
      for (let i = 0; i < buffered.length; i++) {
        const start = buffered.start(i);
        const end = buffered.end(i);
        ranges.push({ start, end });
        
        // Find buffer ahead of current position
        if (start <= currentTime && end > currentTime) {
          bufferAhead = end - currentTime;
          bufferedEnd = end;
        }
        
        // Find buffer behind current position  
        if (end <= currentTime) {
          bufferBehind += (end - start);
        }
        
        // Track maximum buffered position
        if (end > bufferedEnd) {
          bufferedEnd = end;
        }
      }
      
      const bufferedPercent = (bufferedEnd / duration) * 100;
      const totalBuffered = bufferAhead + bufferBehind;
      
      setBuffered(bufferedPercent);
      setBufferRanges(ranges);
      setBufferVisualization({
        ahead: bufferAhead,
        behind: bufferBehind,
        total: totalBuffered,
        percentage: Math.round((totalBuffered / duration) * 100)
      });
      
      // Calculate buffer health for instant play decisions
      const minBufferForPlay = 3; // 3 seconds minimum
      const healthScore = Math.min(100, (bufferAhead / minBufferForPlay) * 100);
      setBufferHealth(healthScore);
    }
  }, []);

  // Initialize stats polling and buffer checking when torrent hash is available
  // Skip for debrid streams since they don't use P2P
  useEffect(() => {
    if (torrentHash && !statsIntervalRef.current && !isDebridStream) {
      fetchTorrentStats(); // Initial fetch
      statsIntervalRef.current = setInterval(() => {
        fetchTorrentStats();
        // Also check buffer availability periodically
        checkBufferAvailability();
      }, 2000); // Update every 2s
    }

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [torrentHash, fetchTorrentStats, checkBufferAvailability, isDebridStream]);

  // Fetch available subtitle files from torrent (for P2P streams)
  const fetchLocalSubtitles = useCallback(async () => {
    if (!torrentHash || isDebridStream) {
      return [];
    }
    
    console.log('VideoPlayer: Fetching local subtitles for torrent:', torrentHash);

    try {
      const response = await fetch(`${config.getTorrentUrl(torrentHash)}/files`);
      if (response.ok) {
        const data = await response.json();
        const files = Array.isArray(data) ? data : (data.files || data.data?.files || []);

        const subtitleFiles = (files || []).filter(file => {
          const ext = file.name?.toLowerCase().split('.').pop() || '';
          return ['srt', 'vtt', 'ass', 'ssa', 'sub', 'sbv'].includes(ext);
        }).map(file => ({
          ...file,
          language: extractLanguageFromFilename(file.name),
          url: config.getDownloadUrl(torrentHash, file.index),
          source: 'Local'
        }));

        console.log('VideoPlayer: Found local subtitle files:', subtitleFiles.length);
        return subtitleFiles;
      }
    } catch (error) {
      console.warn('VideoPlayer: Failed to fetch local subtitles:', error);
    }
    return [];
  }, [torrentHash, isDebridStream]);

  // Auto-fetch online subtitles for the video title
  // Now fetches ALL available languages with preferred language first
  const autoFetchOnlineSubtitles = useCallback(async (searchTitle) => {
    if (!searchTitle) return [];
    
    console.log('VideoPlayer: Auto-fetching online subtitles for:', searchTitle);
    if (preferredSubtitleLanguage) {
      console.log('VideoPlayer: User preferred language:', preferredSubtitleLanguage);
    }
    
    try {
      const apiBaseUrl = config.apiBaseUrl.replace('/api', '');
      // Include preferred language in request so server can prioritize it
      let url = `${apiBaseUrl}/api/subtitles/auto?title=${encodeURIComponent(searchTitle)}`;
      if (preferredSubtitleLanguage) {
        url += `&preferredLanguage=${encodeURIComponent(preferredSubtitleLanguage)}`;
      }
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const subs = data.subtitles || data || [];
        console.log(`VideoPlayer: Auto-fetched ${subs.length} online subtitles`);
        console.log(`VideoPlayer: Languages available: ${data.languages?.join(', ') || 'unknown'}`);
        return subs;
      }
    } catch (error) {
      console.error('VideoPlayer: Auto-fetch subtitles error:', error);
    }
    return [];
  }, [preferredSubtitleLanguage]);

  // Store subtitle to auto-load (to avoid circular dependency)
  const [pendingAutoLoadSubtitle, setPendingAutoLoadSubtitle] = useState(null);

  // Combined subtitle fetching - local + online + torrent (ensures subtitles are ALWAYS available)
  // Now auto-loads user's preferred subtitle language
  const fetchAllSubtitles = useCallback(async () => {
    console.log('VideoPlayer: Fetching ALL subtitles (torrent + local + online)...');
    setIsSearchingOnline(true);
    
    try {
      // Fetch both local and online subtitles in parallel
      const [localSubs, onlineSubs] = await Promise.all([
        fetchLocalSubtitles(),
        autoFetchOnlineSubtitles(title)
      ]);
      
      // Include torrent subtitles first (they're usually best synced!)
      const torrentSubs = (torrentSubtitles || []).map((sub, idx) => ({
        ...sub,
        id: `torrent-${idx}`,
        source: 'Torrent',
        language: sub.language?.charAt(0).toUpperCase() + sub.language?.slice(1) || 'Unknown'
      }));
      
      if (torrentSubs.length > 0) {
        console.log(`VideoPlayer: Found ${torrentSubs.length} subtitles in torrent file!`);
      }
      
      // Set local subtitles (including torrent subtitles)
      setAvailableSubtitles([...torrentSubs, ...localSubs]);
      
      // Set online subtitles
      setOnlineSubtitles(onlineSubs);
      
      console.log(`VideoPlayer: Total subtitles - Torrent: ${torrentSubs.length}, Local: ${localSubs.length}, Online: ${onlineSubs.length}`);
      
      // Log available languages for debugging
      const availableLangs = [...new Set(onlineSubs.map(s => s.language?.toLowerCase()))];
      console.log(`VideoPlayer: Available languages: ${availableLangs.join(', ')}`);
      console.log(`VideoPlayer: User preferred language: ${preferredSubtitleLanguage || 'not set'}`);
      
      // Combine all subtitles for auto-load search (prioritize torrent, then online)
      const allSubs = [...torrentSubs, ...onlineSubs];
      
      // Auto-load user's preferred subtitle language if set
      if (!currentSubtitle && allSubs.length > 0) {
        let autoLoadSub = null;
        
        // First, try torrent subtitles (best synced!) in preferred language
        if (preferredSubtitleLanguage && torrentSubs.length > 0) {
          autoLoadSub = torrentSubs.find(s => 
            s.language?.toLowerCase() === preferredSubtitleLanguage.toLowerCase()
          );
          if (autoLoadSub) {
            console.log(`VideoPlayer: Will auto-load TORRENT subtitle (best sync): ${preferredSubtitleLanguage}`);
          }
        }
        
        // Then try online in preferred language
        if (!autoLoadSub && preferredSubtitleLanguage) {
          console.log(`VideoPlayer: Looking for preferred language "${preferredSubtitleLanguage}" in ${onlineSubs.length} online subs...`);
          autoLoadSub = onlineSubs.find(s => {
            const subLang = s.language?.toLowerCase();
            const prefLang = preferredSubtitleLanguage.toLowerCase();
            const match = subLang === prefLang || 
                         subLang?.includes(prefLang) || 
                         prefLang?.includes(subLang);
            if (match) {
              console.log(`VideoPlayer: Found match! Sub language: "${subLang}", Preferred: "${prefLang}"`);
            }
            return match;
          });
          if (autoLoadSub) {
            console.log(`VideoPlayer: Will auto-load preferred language subtitle: ${autoLoadSub.language}`);
          } else {
            console.log(`VideoPlayer: No match found for "${preferredSubtitleLanguage}". Available: ${availableLangs.join(', ')}`);
          }
        }
        
        // If no preferred language, try torrent English first
        if (!autoLoadSub && torrentSubs.length > 0) {
          autoLoadSub = torrentSubs.find(s => 
            s.language?.toLowerCase() === 'english' || 
            s.languageCode === 'en'
          );
          if (autoLoadSub) {
            console.log('VideoPlayer: Will auto-load TORRENT English subtitle (best sync)');
          }
        }
        
        // Finally, fall back to online English
        if (!autoLoadSub) {
          autoLoadSub = onlineSubs.find(s => 
            s.language?.toLowerCase() === 'english' || 
            s.languageCode === 'en'
          );
          if (autoLoadSub) {
            console.log('VideoPlayer: Will auto-load English subtitle (default)');
          }
        }
        
        // Set pending subtitle to be auto-loaded (handled by separate useEffect)
        if (autoLoadSub) {
          setPendingAutoLoadSubtitle(autoLoadSub);
        }
      }
    } catch (error) {
      console.error('VideoPlayer: Error fetching subtitles:', error);
    } finally {
      setIsSearchingOnline(false);
    }
  }, [title, fetchLocalSubtitles, autoFetchOnlineSubtitles, currentSubtitle, preferredSubtitleLanguage, torrentSubtitles]);

  // Extract language from subtitle filename
  const extractLanguageFromFilename = (filename) => {
    const languageMap = {
      'eng': 'English',
      'spa': 'Spanish', 
      'fre': 'French',
      'ger': 'German',
      'ita': 'Italian',
      'por': 'Portuguese',
      'rus': 'Russian',
      'jpn': 'Japanese',
      'kor': 'Korean',
      'chi': 'Chinese',
      'ara': 'Arabic',
      'hin': 'Hindi',
      'tha': 'Thai',
      'tur': 'Turkish',
      'dut': 'Dutch',
      'swe': 'Swedish',
      'nor': 'Norwegian',
      'dan': 'Danish',
      'fin': 'Finnish',
      'pol': 'Polish',
      'cze': 'Czech',
      'hun': 'Hungarian',
      'gre': 'Greek',
      'heb': 'Hebrew',
      'rum': 'Romanian',
      'sdh': 'English (SDH)'
    };

    const name = filename.toLowerCase();
    
    // Look for language codes in filename
    for (const [code, language] of Object.entries(languageMap)) {
      if (name.includes(code)) {
        return language;
      }
    }
    
    // Check for full language names
    for (const language of Object.values(languageMap)) {
      if (name.includes(language.toLowerCase())) {
        return language;
      }
    }
    
    return 'Unknown';
  };

  // Fetch subtitles when video title changes
  // This runs for ALL streams (P2P and debrid) to ensure subtitles are always available
  // Using a ref to prevent duplicate fetches
  const subtitlesFetchedRef = useRef(false);
  const lastTitleRef = useRef('');
  
  useEffect(() => {
    // Only fetch if title changed and we haven't fetched for this title yet
    if (title && title !== lastTitleRef.current && !subtitlesFetchedRef.current) {
      console.log('VideoPlayer: Fetching subtitles for:', title);
      lastTitleRef.current = title;
      subtitlesFetchedRef.current = true;
      fetchAllSubtitles();
    }
    
    // Reset when title changes
    if (title !== lastTitleRef.current) {
      subtitlesFetchedRef.current = false;
    }
  }, [title, fetchAllSubtitles]);

  // Search for online subtitles based on filename
  const searchOnlineSubtitles = useCallback(async (searchTitle) => {
    if (!searchTitle) return;
    
    setIsSearchingOnline(true);
    console.log('VideoPlayer: Searching online subtitles for:', searchTitle);
    
    try {
      // Extract movie/show name from filename/title
      const cleanName = extractMediaName(searchTitle);
      console.log('VideoPlayer: Extracted media name:', cleanName);
      
      // Call our backend to search for subtitles
      const apiBaseUrl = config.apiBaseUrl.replace('/api', '');
      const response = await fetch(`${apiBaseUrl}/api/subtitles/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: cleanName,
          filename: searchTitle
        })
      });
      
      if (response.ok) {
        const results = await response.json();
        console.log('VideoPlayer: Found online subtitles:', results.length);
        setOnlineSubtitles(results);
      } else {
        console.error('VideoPlayer: Failed to search online subtitles:', response.status);
        setOnlineSubtitles([]);
      }
    } catch (error) {
      console.error('VideoPlayer: Error searching online subtitles:', error);
      setOnlineSubtitles([]);
    } finally {
      setIsSearchingOnline(false);
    }
  }, []);

  // Track which subtitle is currently being loaded
  const [loadingSubtitleId, setLoadingSubtitleId] = useState(null);
  // Store raw subtitle content for timing adjustments
  const [rawSubtitleContent, setRawSubtitleContent] = useState(null);
  const currentBlobUrlRef = useRef(null);

  /**
   * Parse VTT/SRT timestamp to seconds
   * Supports: 00:00:00.000, 00:00:00,000, 00:00.000, 0:00:00.000
   */
  const parseTimestamp = useCallback((timestamp) => {
    if (!timestamp) return 0;
    
    // Normalize: replace comma with dot
    const normalized = timestamp.trim().replace(',', '.');
    
    // Try different formats
    // Format: HH:MM:SS.mmm or H:MM:SS.mmm
    const fullMatch = normalized.match(/^(\d{1,2}):(\d{2}):(\d{2})\.(\d{1,3})$/);
    if (fullMatch) {
      const hours = parseInt(fullMatch[1], 10);
      const minutes = parseInt(fullMatch[2], 10);
      const seconds = parseInt(fullMatch[3], 10);
      const ms = parseInt(fullMatch[4].padEnd(3, '0'), 10);
      return hours * 3600 + minutes * 60 + seconds + ms / 1000;
    }
    
    // Format: MM:SS.mmm
    const shortMatch = normalized.match(/^(\d{1,2}):(\d{2})\.(\d{1,3})$/);
    if (shortMatch) {
      const minutes = parseInt(shortMatch[1], 10);
      const seconds = parseInt(shortMatch[2], 10);
      const ms = parseInt(shortMatch[3].padEnd(3, '0'), 10);
      return minutes * 60 + seconds + ms / 1000;
    }
    
    // Format: HH:MM:SS (no milliseconds)
    const noMsMatch = normalized.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (noMsMatch) {
      const hours = parseInt(noMsMatch[1], 10);
      const minutes = parseInt(noMsMatch[2], 10);
      const seconds = parseInt(noMsMatch[3], 10);
      return hours * 3600 + minutes * 60 + seconds;
    }
    
    console.warn('Could not parse timestamp:', timestamp);
    return 0;
  }, []);

  /**
   * Format seconds to VTT timestamp: 00:00:00.000
   */
  const formatTimestamp = useCallback((totalSeconds) => {
    // Ensure non-negative
    totalSeconds = Math.max(0, totalSeconds);
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    const ms = Math.round((totalSeconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }, []);

  /**
   * Apply timing offset to VTT content
   * @param {string} vttContent - Original VTT content
   * @param {number} offsetSeconds - Offset in seconds (negative = subtitles appear earlier, positive = later)
   * @returns {string} - Modified VTT content
   */
  const applySubtitleOffset = useCallback((vttContent, offsetSeconds) => {
    if (!vttContent) return vttContent;
    if (offsetSeconds === 0) return vttContent;
    
    // Process VTT content line by line
    const lines = vttContent.split('\n');
    const modifiedLines = lines.map(line => {
      // Match timestamp lines with various formats
      // 00:00:00.000 --> 00:00:05.000
      // 00:00.000 --> 00:05.000
      // Can have optional positioning after timestamps
      const timestampRegex = /^(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})(.*)$/;
      const match = line.match(timestampRegex);
      
      if (match) {
        const startTime = parseTimestamp(match[1]);
        const endTime = parseTimestamp(match[2]);
        const rest = match[3] || '';
        
        // Apply offset
        const newStartTime = formatTimestamp(startTime + offsetSeconds);
        const newEndTime = formatTimestamp(endTime + offsetSeconds);
        
        return `${newStartTime} --> ${newEndTime}${rest}`;
      }
      
      return line;
    });
    
    return modifiedLines.join('\n');
  }, [parseTimestamp, formatTimestamp]);

  /**
   * Apply subtitle track to video element
   * Optimized to minimize flickering during timing adjustments
   */
  const applySubtitleTrack = useCallback((content, subtitle) => {
    if (!videoRef.current || !content) return;
    
    const video = videoRef.current;
    
    // Create new blob URL first
    const blob = new Blob([content], { type: 'text/vtt; charset=utf-8' });
    const newSubtitleUrl = URL.createObjectURL(blob);
    
    // Get or create track element
    let track = video.querySelector('track[data-custom-subtitle="true"]');
    
    if (!track) {
      // Remove any existing tracks first
      const existingTracks = video.querySelectorAll('track');
      existingTracks.forEach(t => {
        if (t.src && t.src.startsWith('blob:')) {
          URL.revokeObjectURL(t.src);
        }
        t.remove();
      });
      
      // Create new track
      track = document.createElement('track');
      track.kind = 'subtitles';
      track.default = true;
      track.setAttribute('data-custom-subtitle', 'true');
      video.appendChild(track);
    }
    
    // Update track properties
    track.label = subtitle ? `${subtitle.language} (${subtitle.source})` : 'Subtitles';
    track.srclang = subtitle ? subtitle.language.toLowerCase().substring(0, 2) : 'en';
    
    // Revoke old blob URL after setting new one
    const oldUrl = currentBlobUrlRef.current;
    
    // Set new source
    track.src = newSubtitleUrl;
    currentBlobUrlRef.current = newSubtitleUrl;
    
    // Revoke old URL after a small delay to prevent flicker
    if (oldUrl) {
      setTimeout(() => URL.revokeObjectURL(oldUrl), 100);
    }
    
    // Ensure track is enabled
    if (video.textTracks && video.textTracks.length > 0) {
      // Disable all tracks first, then enable ours
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
      // Small delay then enable to ensure browser picks up new content
      requestAnimationFrame(() => {
        if (video.textTracks && video.textTracks.length > 0) {
          video.textTracks[0].mode = 'showing';
        }
      });
    }
  }, []);

  /**
   * Convert SRT format to VTT format
   */
  const convertSRTtoVTT = useCallback((srtContent) => {
    if (!srtContent) return '';
    
    // Add WEBVTT header
    let vttContent = 'WEBVTT\n\n';
    
    // Split by double newlines (SRT format)
    const blocks = srtContent.trim().split(/\n\s*\n/);
    
    blocks.forEach(block => {
      const lines = block.trim().split('\n');
      if (lines.length < 3) return; // Skip invalid blocks
      
      // Find timestamp line (usually line 1 or 2)
      let timestampLine = '';
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
          timestampLine = lines[i];
          // Remove any commas (SRT uses commas, VTT uses dots)
          timestampLine = timestampLine.replace(/,/g, '.');
          break;
        }
      }
      
      if (!timestampLine) return; // Skip if no timestamp found
      
      // Get subtitle text (everything after timestamp line)
      const textLines = lines.slice(lines.findIndex(l => l.includes('-->')) + 1);
      const subtitleText = textLines.join('\n');
      
      // Add to VTT content
      vttContent += timestampLine + '\n';
      vttContent += subtitleText + '\n\n';
    });
    
    return vttContent;
  }, []);

  // Ref to track pending offset update for debouncing
  const offsetUpdateTimeoutRef = useRef(null);
  
  /**
   * Apply the subtitle offset to the track
   */
  const applyOffsetToTrack = useCallback((offset) => {
    if (rawSubtitleContent && currentSubtitle) {
      const adjustedContent = applySubtitleOffset(rawSubtitleContent, offset);
      applySubtitleTrack(adjustedContent, currentSubtitle);
    }
  }, [rawSubtitleContent, currentSubtitle, applySubtitleOffset, applySubtitleTrack]);

  // Ref to debounce saving to IndexedDB
  const saveTimingTimeoutRef = useRef(null);
  
  /**
   * Handle subtitle offset change - applies offset and saves to IndexedDB
   */
  const handleSubtitleOffsetChange = useCallback((newOffset, immediate = false) => {
    // Round to 1 decimal place for cleaner values
    const roundedOffset = Math.round(newOffset * 10) / 10;
    
    // Always update the display immediately
    setSubtitleOffset(roundedOffset);
    
    // Clear any pending update
    if (offsetUpdateTimeoutRef.current) {
      clearTimeout(offsetUpdateTimeoutRef.current);
    }
    
    if (immediate) {
      // Apply immediately (for buttons and sync clicks)
      applyOffsetToTrack(roundedOffset);
      console.log(`⏱️ Subtitle timing: ${roundedOffset > 0 ? '+' : ''}${roundedOffset.toFixed(1)}s`);
    } else {
      // Debounce for slider (apply after user stops dragging)
      offsetUpdateTimeoutRef.current = setTimeout(() => {
        applyOffsetToTrack(roundedOffset);
        console.log(`⏱️ Subtitle timing: ${roundedOffset > 0 ? '+' : ''}${roundedOffset.toFixed(1)}s`);
      }, 50); // 50ms debounce - responsive but not too frequent
    }
    
    // Save to IndexedDB (debounced to avoid too many writes)
    if (saveTimingTimeoutRef.current) {
      clearTimeout(saveTimingTimeoutRef.current);
    }
    saveTimingTimeoutRef.current = setTimeout(() => {
      if (currentSubtitleId && currentSubtitle) {
        saveSubtitleTiming(currentSubtitleId, roundedOffset, currentSubtitle, title);
      }
    }, 500); // Wait 500ms after last change before saving
    
  }, [applyOffsetToTrack, currentSubtitleId, currentSubtitle, title]);
  
  /**
   * ============================================================================
   * SUBTITLE SYNC SYSTEM - Click on subtitle text to sync
   * ============================================================================
   * 
   * How it works:
   * 1. Parse all subtitle cues from the raw content
   * 2. Show a scrollable list of subtitle texts near current time
   * 3. User clicks the subtitle that matches what they're hearing
   * 4. We calculate offset to align that subtitle's start time with current video time
   */
  
  // Parsed subtitle cues for the sync picker
  const [subtitleCues, setSubtitleCues] = useState([]);
  const [syncFeedback, setSyncFeedback] = useState('');
  
  /**
   * Parse subtitle content into cues array
   */
  const parseSubtitleCues = useCallback((content) => {
    if (!content) return [];
    
    const cues = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const timestampRegex = /^(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/;
      const match = line.match(timestampRegex);
      
      if (match) {
        const startTime = parseTimestamp(match[1]);
        const endTime = parseTimestamp(match[2]);
        
        // Collect subtitle text (next lines until empty line or next timestamp)
        let text = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine === '' || nextLine.match(timestampRegex)) break;
          // Skip cue numbers
          if (/^\d+$/.test(nextLine)) continue;
          text += (text ? ' ' : '') + nextLine;
        }
        
        // Clean up HTML tags and extra spaces
        text = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        
        if (text) {
          cues.push({ 
            index: cues.length,
            startTime, 
            endTime, 
            text,
            displayTime: formatTimestamp(startTime).substring(0, 8) // HH:MM:SS
          });
        }
      }
    }
    
    return cues;
  }, [parseTimestamp, formatTimestamp]);
  
  // Parse cues when raw subtitle content changes
  useEffect(() => {
    if (rawSubtitleContent) {
      const cues = parseSubtitleCues(rawSubtitleContent);
      setSubtitleCues(cues);
      console.log(`📝 Parsed ${cues.length} subtitle cues for sync picker`);
    } else {
      setSubtitleCues([]);
    }
  }, [rawSubtitleContent, parseSubtitleCues]);
  
  /**
   * Get current cue index based on video time and offset
   */
  const getCurrentCueIndex = useCallback(() => {
    if (!videoRef.current || subtitleCues.length === 0) return -1;
    
    const currentVideoTime = videoRef.current.currentTime;
    // The effective subtitle time (what subtitle time should be showing now)
    const effectiveTime = currentVideoTime - subtitleOffset;
    
    for (let i = 0; i < subtitleCues.length; i++) {
      const cue = subtitleCues[i];
      if (effectiveTime >= cue.startTime && effectiveTime <= cue.endTime) {
        return i;
      }
    }
    
    // Find nearest upcoming cue
    for (let i = 0; i < subtitleCues.length; i++) {
      if (subtitleCues[i].startTime > effectiveTime) {
        return Math.max(0, i - 1);
      }
    }
    
    return subtitleCues.length - 1;
  }, [subtitleCues, subtitleOffset]);
  
  /**
   * Handle user clicking on a subtitle cue to sync
   * The clicked cue should be what's playing NOW
   */
  const handleCueSync = useCallback((cue) => {
    if (!videoRef.current) return;
    
    const currentVideoTime = videoRef.current.currentTime;
    
    // Calculate offset: we want cue.startTime + offset = currentVideoTime
    const newOffset = currentVideoTime - cue.startTime;
    const roundedOffset = Math.round(newOffset * 10) / 10;
    
    console.log(`🎯 Syncing to cue: "${cue.text.substring(0, 40)}..."`);
    console.log(`   Cue start time: ${cue.startTime.toFixed(2)}s`);
    console.log(`   Video time: ${currentVideoTime.toFixed(2)}s`);
    console.log(`   New offset: ${roundedOffset > 0 ? '+' : ''}${roundedOffset.toFixed(1)}s`);
    
    // Apply the offset
    handleSubtitleOffsetChange(roundedOffset, true);
    
    // Show feedback
    setSyncFeedback(`✓ Synced! Offset: ${roundedOffset > 0 ? '+' : ''}${roundedOffset.toFixed(1)}s`);
    setTimeout(() => setSyncFeedback(''), 3000);
    
  }, [handleSubtitleOffsetChange]);
  
  /**
   * Get cues to display in the sync picker (within ±100s of current video time)
   */
  const getVisibleCues = useCallback(() => {
    if (subtitleCues.length === 0 || !videoRef.current) return [];
    
    const currentVideoTime = videoRef.current.currentTime;
    const rangeSeconds = 100; // Show cues within ±100 seconds
    
    // Filter cues within the time range
    const visibleCues = subtitleCues.filter(cue => {
      // Account for current offset when checking visibility
      const adjustedStart = cue.startTime + subtitleOffset;
      return adjustedStart >= (currentVideoTime - rangeSeconds) && 
             adjustedStart <= (currentVideoTime + rangeSeconds);
    });
    
    const currentIndex = getCurrentCueIndex();
    
    return visibleCues.map((cue) => ({
      ...cue,
      isCurrent: cue.index === currentIndex
    }));
  }, [subtitleCues, getCurrentCueIndex, subtitleOffset]);

  // Load online subtitle
  const loadOnlineSubtitle = useCallback(async (subtitle) => {
    // Prevent loading same subtitle multiple times
    if (loadingSubtitleId === subtitle.id) {
      console.log('Already loading this subtitle, skipping...');
      return;
    }
    
    setLoadingSubtitleId(subtitle.id);
    
    try {
      console.log(`📥 Loading online subtitle: ${subtitle.language} from ${subtitle.source}`);
      
      const apiBaseUrl = config.apiBaseUrl.replace('/api', '');
      
      // Build download URL with all necessary params
      const params = new URLSearchParams();
      if (subtitle.url) params.append('url', subtitle.url);
      params.append('language', subtitle.language || 'english');
      if (subtitle.source) params.append('source', subtitle.source);
      if (subtitle.fileId) params.append('fileId', subtitle.fileId);
      if (subtitle.needsPageParse) params.append('needsPageParse', 'true');
      
      const downloadUrl = `${apiBaseUrl}/api/subtitles/download?${params.toString()}`;
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      let subtitleContent = await response.text();
      
      // Validate subtitle content
      if (!subtitleContent || subtitleContent.length < 50) {
        throw new Error('Invalid subtitle content received');
      }
      
      // Convert SRT to VTT format if needed (check by content format, not just extension)
      if (!subtitleContent.includes('WEBVTT')) {
        // Check if it's SRT format (starts with number or has SRT-style timestamps)
        if (subtitleContent.match(/^\d+\s*\n/) || 
            (subtitleContent.includes('-->') && subtitleContent.match(/\d{2}:\d{2}:\d{2},\d{3}/))) {
          // Looks like SRT format
          subtitleContent = convertSRTtoVTT(subtitleContent);
        } else if (!subtitleContent.includes('-->')) {
          // Try SRT conversion as fallback (might be SRT without header)
          subtitleContent = convertSRTtoVTT(subtitleContent);
        }
      }
      
      // Final validation
      if (!subtitleContent.includes('-->')) {
        throw new Error('Invalid subtitle format: no timestamps found');
      }
      
      // Store raw content for timing adjustments
      setRawSubtitleContent(subtitleContent);
      
      // Generate unique ID for this subtitle and load saved timing
      const subtitleId = generateSubtitleId(subtitle, title);
      setCurrentSubtitleId(subtitleId);
      
      // Load previously saved timing for this subtitle (or 0 if none)
      const savedOffset = await loadSubtitleTiming(subtitleId);
      setSubtitleOffset(savedOffset);
      
      // Apply subtitle track with saved offset (or 0 if none)
      const adjustedContent = savedOffset !== 0 
        ? applySubtitleOffset(subtitleContent, savedOffset) 
        : subtitleContent;
      applySubtitleTrack(adjustedContent, subtitle);
      
      // Update state
      setCurrentSubtitle(subtitle);
      setSubtitlesEnabled(true);
      setShowSubtitleMenu(false);
      
      console.log(`✅ Loaded online subtitle: ${subtitle.language}`);
      console.log('📊 Subtitle state:', {
        currentSubtitle: subtitle?.language,
        subtitlesEnabled: true,
        hasRawContent: !!subtitleContent,
        contentLength: subtitleContent?.length
      });
      
    } catch (error) {
      console.error('Error loading online subtitle:', error);
      alert(`Failed to load subtitle: ${error.message}`);
    } finally {
      setLoadingSubtitleId(null);
    }
  }, [loadingSubtitleId, applySubtitleTrack, convertSRTtoVTT]);

  // Handle pending auto-load subtitle (resolves circular dependency)
  useEffect(() => {
    if (pendingAutoLoadSubtitle && !currentSubtitle) {
      console.log('VideoPlayer: Auto-loading pending subtitle:', pendingAutoLoadSubtitle.language);
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        loadOnlineSubtitle(pendingAutoLoadSubtitle);
        setPendingAutoLoadSubtitle(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pendingAutoLoadSubtitle, currentSubtitle, loadOnlineSubtitle]);

  // Extract clean media name from filename
  const extractMediaName = (filename) => {
    // Remove file extension
    let name = filename.replace(/\.[^/.]+$/, '');
    
    // Remove common video quality markers
    name = name.replace(/\b(720p|1080p|1440p|2160p|4K|HD|CAM|TS|TC|SCR|DVDSCR|DVDRIP|HDTV|PDTV|DSR|WORKPRINT|VHS|TV|TVRIP|VOD|WEB-DL|WEBDL|WEBRip|WEB-Rip|BluRay|BDRip|BRRip|HDCAM|HDTS|DVDR|R3|R5|R6|PPVRIP|REMUX)\b/gi, '');
    
    // Remove common group tags
    name = name.replace(/\b(YIFY|YTS|RARBG|EZTV|ETTV|TorrentGalaxy|1337x|CMRG|FGT|CHD|HDChina|WiKi|DON|NTb|DIMENSION|LOL|ASAP|SVA|KILLERS|ROVERS|RARBG|SPARKS|TBS|CRiMSON|AMRAP|CTU|FoV|JYK|GECKOS|IMMERSE|DRONES|AMIABLE|playBD|decibeL|EA|EbP|ESiR|EXViD|FxM|FZERO|GECKOS|GFY|GoGo|mSD|NeDiVx|nmd|PUKKA|QiM|RUBY|SAiMORNY|SHUTTIT|SiRiUS|UKB5|WAF|x0r|YMG|ZOOE|APL|ARAXIAL|DEViSE|DiSPOSABLE|DVL|EwDp|FFNDVD|FRAGMENT|Larceny|MESS|MOKONA|nVID|REAKTOR|REWARD|RUSH|Replica|SECTOR7|Skazhutin|STUCK|SWTYBLZ|TLF|Waf4rr0k|WAR|WISDOM|YARN|ZmN|iMBT|pov|xxop|KLAXXON|SAPHiRE|TOPAZ|CiNEFiLE|Japhson|KiMCHi|LLoRd|mfcorrea|NaRaYa|Noir|PRODJi|PSYCHD|pukka|QaFoNE|RayRep|SECTOR7|SiNK|ViTE|WAF|WASTE|x0r|YIFY|3LT0N|4yEo|Ac3|ADTRG|AFG|AGRY|AKRAKEN|ALANiS|AliKaDee|ALLiANCE|AMIABLE|AN0NYM0US|AOV|ARK01|ARROW|AXiNE|BestDivX|BIB|BINGO|BRMP|BTSFilms|Bushi|CaKePiPe|CD1|CD2|Cd3|CdRip|CHiCaNo|CiCXXX|CLUE|CNXP|CODEiNE|compcompletos|CopStuff|CPOTT|CPUL|CrAcKrOoKz|CRF|CRiSC|CRiTiCAL|CRYS|CTU|DaBaum|DarkScene|DataHead|DCS|DEF|DELUCIDATION|DeWMaN|DHD|DiAMOND|DiSSOLVE|DivXNL|DMZ|DON|DROiD|DTL|DTS|DVDFab|DVDnL|DVL|DXO|e.t.|EB|EbP|ECI|ELiA|EMERALD|EmX|EncodeLounge|ENTiTY|EPiK|ESiR|ETM|EVL|EwDp|ExtraScene|FARG|FASTSUB|Fertili|FiHTV|FiNaLe|FLoW|FnF|FooKaS|FOR|Forest|FoREST|FoRM|FoV|FRAGMENT|FuN|FXG|Ganool|GAZ|GBM|GDB|GHoST|GIBBY|GNome|GoGo|HaB|HACKS|HANDJOB|HigH|HSBS|idMKv|iGNiTiON|iGNORANT|iHD|iLG|IMB|INSPiRAL|IRANiAN|iRiSH|iron|iTALiAN|iTS|iXA|JAV|KeepFRDS|KiCKAZZ|KNiGHTS|KODAK|Krautspatzen|LANR|LAP|Lat|Lbtag|LIME|LiNKLE|LiViNG|LLG|LoRD|LoVE|LTRG|LTT|Lu|m1080p|M7PLuS|maz123|METiS|MF|MFCORREA|MIFUNE|MoH|MOLECULE|MOViEFiNATiCS|MOViERUSH|MP3|mSD|MSTV|MTB|Multi|MURPHYDVD|Mx|MYSTIC|NaRaYa|nCRO|NEMESIS|nEO|NESSUNDA|NETWORK|NFO|NhaNc3|NIKAPBDK|NineDragons|Nitrous|Noir|NORDiC|NOTiOS|NOX|nTrO|OCW|Otwieracz|P2P|PARTYBOY|PBDA|PHOCiS|PHOENA|PKF|PLAY|PLEX|PODiUM|POiNT|POISON|pov|PRE|PREMiUM|PRISM|PRoDJi|PROPER|PROVOKE|PSV|Pt|PUKKA|Pure|PYRo|QaFoNE|RAZZ|REAdNFO|REALLY|RECODED|REFiNED|ReleaseLounge|RENTS|REPLICA|REPTiLE|RETAiL|REVEiLLE|RFB|RG|Rio|RMVB|RNT|ROFL|RsL|RSG|RUBY|RUS|rydal|S4A|SAPHiRE|SAZ|SCOrp|ScREEN|SDDAZ|SDE|SDO|SECTOR7|SEEDiG|ShAaNiG|SHITBUSTERS|SHORTBREHD|SiLK|SiNG|SkAzHuTiN|SKiP|Slay3R|SMY|SPARKS|SPiKET|SPOOKS|SQU|SSDD|STUCK|SUBTiTLES|SUNLiGHT|SUPES|SVD|SWAGGERNAUT|SYNDiCATE|T00NG0D|TANTRiC|TBS|TDF|TDRS|TEAM|Tekno|Tenebrous|TFE|THeRe|THuG|TIKO|TimMm|TLF|TmG|ToK|TOPAZ|TRUEFRENCH|TSR|TWiZTED|TyL|uC|UKB5|UNRATED|UPiNSMOKE|UsaBit|URANiME|Vei|VeZ|ViP3R|VOLTAGE|WAWA|WAZ|WeLD|WiM|WOMBAT|WORKPRINT|WPi|WRD|WTF|XPLORE|XSHD|XTiNE|XViD|YAGO|YiFF|YOUNiVERSE|ZENTAROS|ZeaL|Zeus|ZMN|ZONE|ZoNE|ZZGtv|Rets|ARABiC|aXXo|BadTasteRecords|cOOt|DVDScr|FiH|GOM|LAP|LOMO|LUMiX|MbS|MEAPO|NEMOORTV|NoGroup|NwC|ORC|PTNK|REALiTY|SAMPLE|SYNDiCATE|TELESYNC|ToMpDaWg|TS|UnKnOwN|VECTORPDA|VH|ViSiON|Vomit|WRD|x264|XviD|BDRip|1080p|720p)\b/gi, '');
    
    // Remove years in parentheses
    name = name.replace(/\(\d{4}\)/g, '');
    
    // Remove brackets and their contents
    name = name.replace(/\[.*?\]/g, '');
    
    // Replace dots, dashes, underscores with spaces
    name = name.replace(/[._-]/g, ' ');
    
    // Remove extra spaces and trim
    name = name.replace(/\s+/g, ' ').trim();
    
    return name;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log('🎬 VideoPlayer: useEffect triggered');
    console.log('   - src:', src);
    console.log('   - torrentHash:', torrentHash);
    console.log('   - fileIndex:', fileIndex);
    console.log('   - initialTime:', initialTime);

    const handleLoadedMetadata = () => {
      console.log('📊 VideoPlayer: Metadata loaded');
      console.log('   - duration:', video.duration);
      setDuration(video.duration);
      setIsLoading(false);

      // Set initial time after metadata is loaded
      if (initialTime > 0 && !hasAppliedInitialTime) {
        console.log('⏰ Resuming video at:', initialTime + 's');
        video.currentTime = initialTime;
        setCurrentTime(initialTime);
        setHasAppliedInitialTime(true);
      }

      // Check for saved progress and show resume dialog
      // Only show dialog for TV shows/anime, not for movies
      // Only show dialog if no initialTime was provided (auto-resume)
      if (!isMovie && torrentHash && fileIndex !== null && !hasShownResumeDialog && initialTime === 0) {
        const resumeInfo = progressService.shouldResumeVideo(torrentHash, fileIndex);
        if (resumeInfo) {
          console.log('📋 Showing resume dialog for:', resumeInfo);
          setResumeData(resumeInfo);
          setShowResumeDialog(true);
        }
        setHasShownResumeDialog(true);
      }
    };

    const handleTimeUpdate = () => {
      const newTime = video.currentTime;
      setCurrentTime(newTime);
      updateBufferedProgress();
      onTimeUpdate?.(newTime);
      
      // Save progress every 5 seconds
      if (torrentHash && fileIndex !== null && video.duration > 0) {
        const now = Date.now();
        if (!video.progressSaveTimer || now - video.progressSaveTimer > 5000) {
          progressService.saveProgress(torrentHash, fileIndex, newTime, video.duration, title);
          video.progressSaveTimer = now;
        }
      }
    };

    const handleProgress = () => {
      updateBufferedProgress();
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / video.duration) * 100;
        onProgress?.(bufferedPercent);
      }
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      // Only try setting initial time when the video can play if we haven't done it yet
      if (initialTime > 0 && !hasAppliedInitialTime && Math.abs(video.currentTime - initialTime) > 1) {
        console.log('🎬 CanPlay: Resuming video at:', initialTime + 's');
        video.currentTime = initialTime;
        setCurrentTime(initialTime);
        setHasAppliedInitialTime(true);
      }

      // Auto-play when ready (browsers may block autoPlay attribute)
      if (video.paused) {
        video.play().catch(err => {
          console.log('Auto-play blocked by browser:', err);
          // User will need to click play button
        });
      }
    };
    const handleCanPlayThrough = () => setIsLoading(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlayThrough);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [src, initialTime, onTimeUpdate, onProgress, updateBufferedProgress, torrentHash, fileIndex, title, hasShownResumeDialog, hasAppliedInitialTime]);

  // Mobile video initialization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Mobile-specific video event handlers
      const handleLoadStart = () => {
        console.log('📱 Mobile: Video load started');
        setIsLoading(true);
      };

      const handleCanPlay = () => {
        console.log('📱 Mobile: Video can play');
        setIsLoading(false);
      };

      const handleWaiting = () => {
        console.log('📱 Mobile: Video waiting for data');
        setIsLoading(true);
      };

      const handleStalled = () => {
        console.log('📱 Mobile: Video stalled, retrying...');
        setIsLoading(true);
        // On mobile, try to reload the video source if it stalls
        setTimeout(() => {
          if (video.paused && !isPlaying) {
            video.load();
          }
        }, 2000);
      };

      const handleError = (e) => {
        console.error('📱 Mobile video error:', e);
        setIsLoading(false);
        // Try to recover from error
        setTimeout(() => {
          video.load();
        }, 1000);
      };

      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('stalled', handleStalled);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('stalled', handleStalled);
        video.removeEventListener('error', handleError);
      };
    }
  }, [src, isPlaying]);

  // Fullscreen event listeners for mobile compatibility
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    // iOS Safari specific fullscreen events
    const handleWebkitFullscreenChange = () => {
      const video = videoRef.current;
      if (video) {
        const isVideoFullscreen = video.webkitDisplayingFullscreen;
        setIsFullscreen(isVideoFullscreen);
      }
    };

    // Add event listeners for all browser prefixes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // iOS Safari specific
    const video = videoRef.current;
    if (video) {
      video.addEventListener('webkitbeginfullscreen', () => setIsFullscreen(true));
      video.addEventListener('webkitendfullscreen', () => setIsFullscreen(false));
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', () => setIsFullscreen(true));
        video.removeEventListener('webkitendfullscreen', () => setIsFullscreen(false));
      }
    };
  }, []);

  // Mobile viewport optimization for fullscreen
  useEffect(() => {
    const optimizeMobileViewport = () => {
      // Ensure viewport meta tag allows user scaling for fullscreen
      let viewportMeta = document.querySelector('meta[name="viewport"]');
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        document.head.appendChild(viewportMeta);
      }
      
      if (isFullscreen) {
        // Optimize for fullscreen - allow zooming and remove address bar
        viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, minimal-ui, viewport-fit=cover';
        
        // Additional mobile Safari optimizations
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          // Force viewport recalculation
          window.scrollTo(0, 1);
          setTimeout(() => {
            window.scrollTo(0, 0);
            // Trigger a resize to ensure fullscreen
            window.dispatchEvent(new Event('resize'));
          }, 100);
        }
      } else {
        // Reset viewport for normal viewing
        viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
      }
    };

    optimizeMobileViewport();
  }, [isFullscreen]);

  // Optimized play/pause for mobile and instant streaming
  const togglePlay = async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        const video = videoRef.current;
        
        // Mobile-specific optimizations
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // For mobile devices, ensure we have user interaction before playing
          try {
            // Start loading the video if not already loaded
            if (video.readyState < 2) { // HAVE_CURRENT_DATA
              video.load();
              setIsLoading(true);
              
              // Wait for enough data to start playing
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
                
                const onCanPlay = () => {
                  clearTimeout(timeout);
                  video.removeEventListener('canplay', onCanPlay);
                  video.removeEventListener('error', onError);
                  setIsLoading(false);
                  resolve();
                };
                
                const onError = (e) => {
                  clearTimeout(timeout);
                  video.removeEventListener('canplay', onCanPlay);
                  video.removeEventListener('error', onError);
                  setIsLoading(false);
                  reject(e);
                };
                
                video.addEventListener('canplay', onCanPlay);
                video.addEventListener('error', onError);
              });
            }
            
            // Play with mobile-specific handling
            const playPromise = video.play();
            if (playPromise !== undefined) {
              await playPromise;
              setIsPlaying(true);
            }
          } catch (error) {
            console.warn('Mobile playback failed, trying fallback:', error);
            setIsLoading(false);
            
            // Fallback: simple play attempt
            try {
              await video.play();
              setIsPlaying(true);
            } catch (fallbackError) {
              console.error('Video playback failed:', fallbackError);
              setIsLoading(false);
            }
          }
        } else {
          // Desktop playback with buffering check
          const buffered = video.buffered;
          const currentTime = video.currentTime;
          
          // Check for instant play capability
          let canPlayInstantly = false;
          
          if (buffered.length > 0) {
            for (let i = 0; i < buffered.length; i++) {
              const start = buffered.start(i);
              const end = buffered.end(i);
              
              // Check if current position has any buffered data
              if (start <= currentTime && end > currentTime) {
                // For instant streaming, require minimal buffer (1 second)
                if (end - currentTime >= 1) {
                  canPlayInstantly = true;
                  break;
                }
              }
            }
          }
          
          // Desktop instant play logic - optimized for torrent streaming
          const isTorrentStream = torrentHash !== null;
          // Reduced buffer requirements based on seedbox-lite approach
          const requiredBuffer = isSeeking ? 2 : (isTorrentStream ? 2 : 0.5);
          const hasEnoughBuffer = buffered.length > 0 && (() => {
            for (let i = 0; i < buffered.length; i++) {
              const start = buffered.start(i);
              const end = buffered.end(i);
              if (start <= currentTime && end - currentTime >= requiredBuffer) {
                return true;
              }
            }
            return false;
          })();

          if (hasEnoughBuffer || instantPlayEnabled) {
            try {
              await video.play();
              setIsPlaying(true);
              setIsLoading(false);
              console.log(`▶️ Started playback with ${isTorrentStream ? 'torrent' : 'regular'} stream (buffer: ${requiredBuffer}s required)`);
            } catch (playError) {
              console.log(`${isTorrentStream ? 'Torrent' : 'Instant'} play failed, buffering...`, playError);
              setIsLoading(true);

              // For torrent streams, wait longer before retry
              const retryDelay = isTorrentStream ? 3000 : 1000;
              setTimeout(async () => {
                try {
                  await video.play();
                  setIsPlaying(true);
                  setIsLoading(false);
                  console.log('✅ Playback started after buffering');
                } catch (retryError) {
                  console.log('Retry play failed:', retryError);
                  setIsLoading(false);
                }
              }, retryDelay);
            }
          } else {
            // Show loading state while building initial buffer
            setIsLoading(true);
            console.log(`⏳ Building buffer for ${isTorrentStream ? 'torrent' : 'regular'} stream (${requiredBuffer}s required)...`);
            
            // Try to play after minimal buffer is ready
            setTimeout(() => {
              if (videoRef.current && !isPlaying) {
                videoRef.current.play().then(() => {
                  setIsPlaying(true);
                  setIsLoading(false);
                }).catch(() => {
                  setIsLoading(false);
                });
              }
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error('Toggle play error:', error);
      setIsLoading(false);
    }
  };

  // Resume dialog functions
  const handleResumeVideo = () => {
    if (resumeData && videoRef.current) {
      videoRef.current.currentTime = resumeData.currentTime;
      setShowResumeDialog(false);
      setResumeData(null);
    }
  };

  const handleStartFromBeginning = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setShowResumeDialog(false);
      setResumeData(null);
    }
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    video.currentTime = newTime;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleFullscreen = () => {
    const container = videoRef.current.parentElement;
    const video = videoRef.current;
    
    // Detect mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    ('ontouchstart' in window) || 
                    (navigator.maxTouchPoints > 0);
    
    if (!isFullscreen) {
      // Try to enter fullscreen
      if (isMobile) {
        // For mobile devices, especially iOS Safari
        if (video.webkitEnterFullscreen) {
          // iOS Safari - use video element fullscreen (hides address bar)
          video.webkitEnterFullscreen();
        } else if (video.requestFullscreen) {
          // Android Chrome/Firefox
          video.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          // Fallback for mobile Safari
          container.webkitRequestFullscreen();
        } else {
          // Fallback: simulate fullscreen with CSS
          setIsFullscreen(true);
          // Trigger viewport change to hide address bar
          window.scrollTo(0, 1);
          setTimeout(() => window.scrollTo(0, 0), 100);
        }
      } else {
        // Desktop fullscreen
        if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
          container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen();
        }
      }
      
      if (!isMobile || !video.webkitEnterFullscreen) {
        setIsFullscreen(true);
      }
    } else {
      // Try to exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      } else if (video.webkitExitFullscreen) {
        // iOS Safari
        video.webkitExitFullscreen();
      } else {
        // CSS fullscreen fallback
        setIsFullscreen(false);
      }
      
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setIsFullscreen(false);
      }
    }
  };

  const skip = (seconds) => {
    const video = videoRef.current;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const changePlaybackRate = (rate) => {
    const video = videoRef.current;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  // Double-tap handler for mobile devices
  const handleVideoTap = () => {
    const now = Date.now();
    const tapInterval = 300; // milliseconds
    
    if (now - lastTapTimeRef.current < tapInterval) {
      // Double-tap detected
      tapCountRef.current++;
      if (tapCountRef.current === 2) {
        // On mobile, double-tap toggles fullscreen
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
          toggleFullscreen();
        } else {
          // On desktop, double-click toggles fullscreen
          toggleFullscreen();
        }
        tapCountRef.current = 0;
      }
    } else {
      // Single tap
      tapCountRef.current = 1;
      setTimeout(() => {
        if (tapCountRef.current === 1) {
          // Single tap action - toggle play/pause
          togglePlay();
        }
        tapCountRef.current = 0;
      }, tapInterval);
    }
    
    lastTapTimeRef.current = now;
  };

  // Simple toggle function for torrent stats overlay
  const toggleTorrentStats = () => {
    console.log('Toggling torrent stats. Current state:', showTorrentStats);
    setShowTorrentStats(prev => !prev);
  };

  // Subtitle management functions
  const loadSubtitle = async (subtitleFile) => {
    if (!videoRef.current) return;
    
    try {
      if (subtitleFile) {
        console.log(`📥 Loading local subtitle: ${subtitleFile.language} from ${subtitleFile.url}`);
        
        // Fetch subtitle content from URL
        const response = await fetch(subtitleFile.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch subtitle: ${response.status}`);
        }
        
        let subtitleContent = await response.text();
        
        // Convert SRT to VTT format if needed
        if (subtitleFile.name?.toLowerCase().endsWith('.srt')) {
          subtitleContent = convertSRTtoVTT(subtitleContent);
        } else if (!subtitleContent.includes('WEBVTT') && !subtitleContent.includes('-->')) {
          // Try to detect and convert other formats
          if (subtitleContent.includes('\n\n')) {
            // Might be SRT format
            subtitleContent = convertSRTtoVTT(subtitleContent);
          }
        }
        
        // Validate subtitle content
        if (!subtitleContent || subtitleContent.length < 50 || !subtitleContent.includes('-->')) {
          throw new Error('Invalid subtitle content received');
        }
        
        // Store raw content for timing adjustments
        setRawSubtitleContent(subtitleContent);
        
        // Generate unique ID for this subtitle and load saved timing
        const subtitleId = generateSubtitleId(subtitleFile, title);
        setCurrentSubtitleId(subtitleId);
        
        // Load previously saved timing for this subtitle (or 0 if none)
        const savedOffset = await loadSubtitleTiming(subtitleId);
        setSubtitleOffset(savedOffset);
        
        // Apply subtitle track with saved offset (or 0 if none)
        const adjustedContent = savedOffset !== 0 
          ? applySubtitleOffset(subtitleContent, savedOffset) 
          : subtitleContent;
        applySubtitleTrack(adjustedContent, subtitleFile);
        
        // Update state
        setCurrentSubtitle(subtitleFile);
        setSubtitlesEnabled(true);
        setShowSubtitleMenu(false);
        
        console.log(`✅ Loaded local subtitle: ${subtitleFile.language}${savedOffset !== 0 ? ` (offset: ${savedOffset > 0 ? '+' : ''}${savedOffset.toFixed(1)}s)` : ''}`);
        console.log('📊 Subtitle state:', {
          currentSubtitle: subtitleFile?.language,
          subtitlesEnabled: true,
          hasRawContent: !!subtitleContent,
          contentLength: subtitleContent?.length,
          savedOffset
        });
      } else {
        // Clear subtitle
        // Revoke old blob URL
        if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = null;
        }
        
        // Remove existing tracks
        const video = videoRef.current;
        const existingTracks = video.querySelectorAll('track');
        existingTracks.forEach(track => {
          if (track.src && track.src.startsWith('blob:')) {
            URL.revokeObjectURL(track.src);
          }
          track.remove();
        });
        
        setCurrentSubtitle(null);
        setCurrentSubtitleId(null); // Clear subtitle ID
        setRawSubtitleContent(null);
        setSubtitleOffset(0);
        setSubtitlesEnabled(false);
        setShowSubtitleMenu(false);
      }
    } catch (error) {
      console.error('Error loading subtitle:', error);
      alert(`Failed to load subtitle: ${error.message}`);
    }
  };

  const toggleSubtitles = () => {
    const video = videoRef.current;
    if (video && video.textTracks.length > 0) {
      const newEnabled = !subtitlesEnabled;
      video.textTracks[0].mode = newEnabled ? 'showing' : 'hidden';
      setSubtitlesEnabled(newEnabled);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div 
      className={`video-player-container ${isFullscreen ? 'fullscreen' : ''} ${isFullscreen && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'mobile-fullscreen' : ''}`}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Close Button - always visible on the right */}
      {onClose && (
        <button 
          className="video-close-button"
          onClick={onClose}
          title="Close video"
        >
          <X size={24} />
        </button>
      )}
      
      <video
        ref={videoRef}
        src={src}
        className="video-element"
        onClick={handleVideoTap}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onSeeking={() => {
          setIsSeeking(true);
          setIsLoading(true);
          console.log('⏩ Seeking started');
        }}
        onSeeked={() => {
          setIsSeeking(false);
          console.log('✅ Seeking completed');
          checkBufferAvailability();
        }}
        onWaiting={() => {
          console.log('⏳ Video waiting (buffering needed)');
          checkBufferAvailability();
        }}
        onCanPlay={() => {
          setIsLoading(false);
          console.log('🎬 Video can play');
        }}
        playsInline={false}
        webkit-playsinline="false"
        controls={false}
        preload="auto"
        crossOrigin="anonymous"
        muted={false}
        autoPlay={true}
        poster=""
      />
      
      {isLoading && (
        <div className="video-loading">
          <Loader2 className="loading-spinner" />
          <span>
            {isWaitingForTorrent
              ? 'Downloading from torrent network...'
              : 'Buffering...'
            }
          </span>
          {isWaitingForTorrent && torrentStats && (
            <div className="torrent-download-info">
              Downloaded: {torrentStats.progress?.toFixed(1) || 0}%
            </div>
          )}
        </div>
      )}

      {/* Enhanced Torrent Stats Overlay */}
      {showTorrentStats && torrentHash && (
        <div className="torrent-stats-overlay">
          <div className="stats-header">
            <div className="network-status">
              {networkStatus === 'connected' ? (
                <Wifi className="status-icon connected" size={16} />
              ) : networkStatus === 'seeking' ? (
                <Activity className="status-icon seeking" size={16} />
              ) : (
                <WifiOff className="status-icon disconnected" size={16} />
              )}
              <span className={`status-text ${networkStatus}`}>
                {networkStatus === 'connected' ? 'Connected' : 
                 networkStatus === 'seeking' ? 'Seeking Peers' : 'Disconnected'}
              </span>
            </div>
            {/* Only overlay minimize button */}
            <button 
              className="stats-minimize"
              onClick={() => {
                console.log('Minimize overlay clicked');
                setShowTorrentStats(false);
              }}
              title="Hide Stats Overlay"
            >
              <Minimize2 size={14} />
            </button>
          </div>
          
          <div className="stats-grid">
            <div className="stat-item">
              <Users size={14} />
              <span className="stat-label">Peers</span>
              <span className="stat-value">{torrentStats?.peers || 0}</span>
            </div>

            <div className="stat-item">
              <TrendingDown size={14} />
              <span className="stat-label">Download</span>
              <span className="stat-value">
                {((torrentStats?.downloadSpeed || 0) / 1024 / 1024).toFixed(1)} MB/s
              </span>
            </div>

            <div className="stat-item">
              <TrendingUp size={14} />
              <span className="stat-label">Upload</span>
              <span className="stat-value">
                {((torrentStats?.uploadSpeed || 0) / 1024 / 1024).toFixed(1)} MB/s
              </span>
            </div>

            <div className="stat-item">
              <Download size={14} />
              <span className="stat-label">Progress</span>
              <span className="stat-value">{(torrentStats?.progress || 0).toFixed(1)}%</span>
            </div>
          </div>
          
          {/* Buffer Health Indicator */}
          <div className="buffer-health">
            <div className="buffer-label">Buffer Health</div>
            <div className="buffer-bar">
              <div 
                className={`buffer-fill ${bufferHealth > 70 ? 'good' : bufferHealth > 30 ? 'medium' : 'poor'}`}
                style={{ width: `${Math.min(100, bufferHealth)}%` }}
              />
            </div>
            <span className="buffer-percentage">{Math.round(bufferHealth)}%</span>
          </div>
        </div>
      )}

      {/* Stats Toggle Button (when hidden) */}
      {!showTorrentStats && torrentHash && (
        <button 
          className="stats-show-button"
          onClick={toggleTorrentStats}
          title="Show torrent stats"
        >
          <Activity size={16} />
        </button>
      )}

      <div className={`video-controls ${showControls ? 'visible' : 'hidden'}`}>
        <div className="controls-background" />
        
        {/* Enhanced Progress Bar with Multiple Buffer Ranges */}
        <div className="progress-container" onClick={handleSeek}>
          <div className="progress-bar">
            {/* Show all buffered ranges */}
            {videoRef.current && videoRef.current.buffered.length > 0 && (
              Array.from({ length: videoRef.current.buffered.length }, (_, i) => {
                const start = (videoRef.current.buffered.start(i) / duration) * 100;
                const end = (videoRef.current.buffered.end(i) / duration) * 100;
                return (
                  <div
                    key={i}
                    className="progress-buffered-range"
                    style={{
                      left: `${start}%`,
                      width: `${end - start}%`
                    }}
                  />
                );
              })
            )}
            
            {/* Overall buffer indicator */}
            <div 
              className="progress-buffered" 
              style={{ width: `${buffered}%` }}
            />
            
            {/* Played progress */}
            <div 
              className="progress-played" 
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            
            {/* Current position thumb */}
            <div 
              className="progress-thumb"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />
            
            {/* Torrent download progress overlay */}
            {torrentStats.progress > 0 && (
              <div 
                className="progress-torrent"
                style={{ width: `${torrentStats.progress}%` }}
                title={`Torrent downloaded: ${torrentStats.progress.toFixed(1)}%`}
              />
            )}
          </div>
          
          {/* Progress time tooltip with enhanced buffer info */}
          <div className="progress-tooltip">
            {formatTime(currentTime)} / {formatTime(duration)}
            {torrentStats.progress > 0 && (
              <span className="torrent-progress-text">
                • Torrent: {torrentStats.progress.toFixed(1)}%
              </span>
            )}
            {bufferVisualization.percentage > 0 && (
              <span className="buffer-status">
                • Buffer: {bufferVisualization.percentage}% 
                {bufferVisualization.ahead > 0 && ` (${Math.round(bufferVisualization.ahead)}s ahead)`}
              </span>
            )}
          </div>
        </div>

        {/* Enhanced Buffer Status Overlay - DISABLED (blocks video view) */}
        {/* {(isLoading || (!isPlaying && bufferHealth < 100)) && (
          <div className={`buffer-status-overlay ${(isLoading || (!isPlaying && bufferHealth < 100)) ? 'visible' : ''}`}>
            <div className="buffer-status-title">Video Buffer</div>
            <div className="buffer-status-content">
              <div className="buffer-info-row">
                <span className="buffer-info-label">Buffer Level:</span>
                <span className="buffer-info-value">{Math.round(bufferHealth)}%</span>
              </div>
              {bufferVisualization.ahead > 0 && (
                <div className="buffer-info-row">
                  <span className="buffer-info-label">Ready Time:</span>
                  <span className="buffer-info-value">{Math.round(bufferVisualization.ahead)}s</span>
                </div>
              )}
              <div className="buffer-health-display">
                <div className="buffer-health-label">Buffer Health</div>
                <div className="buffer-health-bar">
                  <div
                    className={`buffer-health-fill ${bufferHealth > 70 ? 'good' : bufferHealth > 30 ? 'medium' : 'poor'}`}
                    style={{ width: `${Math.max(bufferHealth, 5)}%` }}
                  />
                </div>
                <div className={`buffer-health-text ${bufferHealth > 70 ? 'good' : bufferHealth > 30 ? 'medium' : 'poor'}`}>
                  {bufferHealth > 70 ? 'Excellent' : bufferHealth > 30 ? 'Good' : 'Poor'}
                </div>
              </div>
            </div>
          </div>
        )} */}

        {/* Main Controls */}
        <div className="controls-main">
          <div className="controls-left">
            <button onClick={togglePlay} className="control-button play-button">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            
            <button onClick={() => skip(-10)} className="control-button">
              <SkipBack size={20} />
            </button>
            
            <button onClick={() => skip(10)} className="control-button">
              <SkipForward size={20} />
            </button>

            <div className="volume-control">
              <button onClick={toggleMute} className="control-button">
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>

            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="controls-center">
            <div className="video-title">{title}</div>
          </div>

          <div className="controls-right">
            {/* Subtitle Menu */}
            <div className="subtitle-menu">
              <button 
                onClick={() => setShowSubtitleMenu(!showSubtitleMenu)} 
                className={`control-button ${currentSubtitle ? 'active' : ''}`}
                title="Subtitles"
              >
                <Subtitles size={20} />
              </button>
              
              {showSubtitleMenu && (
                <div className="subtitle-dropdown">
                  {/* Loading indicator */}
                  {isSearchingOnline && (
                    <div className="subtitle-loading">
                      <Loader2 size={16} className="spinning" />
                      <span>Loading subtitles...</span>
                    </div>
                  )}

                  {/* Turn off subtitles option */}
                  <div className="subtitle-section">
                    <button
                      onClick={() => {
                        loadSubtitle(null);
                        setSubtitlesEnabled(false);
                        setCurrentSubtitle(null);
                        setCurrentSubtitleId(null);
                        setRawSubtitleContent(null);
                        setSubtitleOffset(0);
                      }}
                      className={`subtitle-option ${!currentSubtitle ? 'active' : ''}`}
                    >
                      <Languages size={16} />
                      Off
                    </button>
                  </div>

                  {/* Subtitle Timing Controls - Only show when subtitle is active and has content */}
                  {currentSubtitle && subtitlesEnabled && rawSubtitleContent && (
                    <div className="subtitle-section timing-section">
                      <div 
                        className="timing-header"
                        onClick={() => setShowTimingControls(!showTimingControls)}
                      >
                        <span>⏱️ Timing Adjustment {subtitleOffset !== 0 && <span className="timing-saved-badge">💾</span>}</span>
                        <span className="timing-toggle">{showTimingControls ? '▼' : '▶'}</span>
                      </div>
                      
                      {showTimingControls && (
                        <div className="timing-controls">
                          {/* Current offset display */}
                          <div className="timing-display">
                            <span className="timing-value">
                              {subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s
                            </span>
                            <span className="timing-hint">
                              {subtitleOffset < 0 ? '(Earlier)' : subtitleOffset > 0 ? '(Later)' : '(Synced)'}
                            </span>
                            {subtitleOffset !== 0 && (
                              <span className="timing-persist-note">💾 Timing saved for this subtitle</span>
                            )}
                          </div>
                          
                          {/* Basic adjustment controls */}
                          <div className="timing-basic-controls">
                            <div className="timing-row">
                              <button 
                                onClick={() => handleSubtitleOffsetChange(subtitleOffset - 1, true)}
                                className="timing-btn"
                              >
                                -1s
                              </button>
                              <button 
                                onClick={() => handleSubtitleOffsetChange(subtitleOffset - 0.1, true)}
                                className="timing-btn small"
                              >
                                -0.1s
                              </button>
                              <button 
                                onClick={() => handleSubtitleOffsetChange(0, true)}
                                className="timing-btn reset"
                              >
                                Reset
                              </button>
                              <button 
                                onClick={() => handleSubtitleOffsetChange(subtitleOffset + 0.1, true)}
                                className="timing-btn small"
                              >
                                +0.1s
                              </button>
                              <button 
                                onClick={() => handleSubtitleOffsetChange(subtitleOffset + 1, true)}
                                className="timing-btn"
                              >
                                +1s
                              </button>
                            </div>
                          </div>
                          
                          {/* Sync feedback */}
                          {syncFeedback && (
                            <div className="sync-feedback">{syncFeedback}</div>
                          )}
                          
                          {/* Subtitle text picker for sync */}
                          <div className="subtitle-sync-picker">
                            <div className="sync-picker-header">
                              <span>🎯 Click the subtitle you're hearing now:</span>
                            </div>
                            
                            <div className="sync-picker-list">
                              {getVisibleCues().map((cue) => (
                                <button
                                  key={cue.index}
                                  onClick={() => handleCueSync(cue)}
                                  className={`sync-cue-item ${cue.isCurrent ? 'current' : ''}`}
                                >
                                  {cue.text}
                                </button>
                              ))}
                              
                              {getVisibleCues().length === 0 && subtitleCues.length > 0 && (
                                <div className="sync-picker-empty">
                                  No subtitles in ±100s range. Try seeking closer to dialogue.
                                </div>
                              )}
                              
                              {subtitleCues.length === 0 && (
                                <div className="sync-picker-empty">
                                  No subtitle cues available
                                </div>
                              )}
                            </div>
                            
                            <div className="sync-picker-help">
                              <p>💡 Listen for a line, then click its text above to sync.</p>
                              <button 
                                className="clear-timings-btn"
                                onClick={async () => {
                                  await clearAllSubtitleTimings();
                                  setSubtitleOffset(0);
                                  if (rawSubtitleContent && currentSubtitle) {
                                    applySubtitleTrack(rawSubtitleContent, currentSubtitle);
                                  }
                                  setSyncFeedback('✓ All saved timings cleared');
                                  setTimeout(() => setSyncFeedback(''), 2000);
                                }}
                              >
                                🗑️ Reset all saved timings
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* User's Preferred Language Indicator */}
                  {preferredSubtitleLanguage && (
                    <div className="subtitle-section preferred-section">
                      <span>⭐ Your Preferred Language</span>
                      <div className="preferred-language-badge">
                        <Star size={14} fill="gold" stroke="gold" />
                        <span>{preferredSubtitleLanguage.charAt(0).toUpperCase() + preferredSubtitleLanguage.slice(1)}</span>
                      </div>
                    </div>
                  )}

                  {/* Priority Languages Section (English, Arabic, Norwegian, German) */}
                  {(onlineSubtitles.length > 0 || availableSubtitles.length > 0) && (
                    <div className="subtitle-section">
                      <span>🌟 Priority Languages</span>
                      
                      {/* English */}
                      {[...availableSubtitles, ...onlineSubtitles]
                        .filter(s => s.language?.toLowerCase() === 'english')
                        .slice(0, 3)
                        .map((subtitle, index) => (
                          <div key={`en-${index}`} className="subtitle-option-row">
                            <button
                              onClick={() => subtitle.source === 'Local' ? loadSubtitle(subtitle) : loadOnlineSubtitle(subtitle)}
                              className={`subtitle-option ${currentSubtitle?.url === subtitle.url || currentSubtitle?.index === subtitle.index ? 'active' : ''}`}
                            >
                              <Globe size={16} />
                              English ({subtitle.source || 'Local'})
                              {preferredSubtitleLanguage === 'english' && <Star size={12} fill="gold" stroke="gold" className="preferred-star" />}
                            </button>
                            {index === 0 && preferredSubtitleLanguage !== 'english' && (
                              <button
                                onClick={() => setSubtitleLanguagePreference('english')}
                                className="set-preferred-btn"
                                title="Set English as preferred language"
                              >
                                <Star size={12} />
                              </button>
                            )}
                          </div>
                        ))
                      }
                      
                      {/* Arabic */}
                      {[...availableSubtitles, ...onlineSubtitles]
                        .filter(s => s.language?.toLowerCase() === 'arabic')
                        .slice(0, 2)
                        .map((subtitle, index) => (
                          <div key={`ar-${index}`} className="subtitle-option-row">
                            <button
                              onClick={() => subtitle.source === 'Local' ? loadSubtitle(subtitle) : loadOnlineSubtitle(subtitle)}
                              className={`subtitle-option ${currentSubtitle?.url === subtitle.url || currentSubtitle?.index === subtitle.index ? 'active' : ''}`}
                            >
                              <Globe size={16} />
                              Arabic ({subtitle.source || 'Local'})
                              {preferredSubtitleLanguage === 'arabic' && <Star size={12} fill="gold" stroke="gold" className="preferred-star" />}
                            </button>
                            {index === 0 && preferredSubtitleLanguage !== 'arabic' && (
                              <button
                                onClick={() => setSubtitleLanguagePreference('arabic')}
                                className="set-preferred-btn"
                                title="Set Arabic as preferred language"
                              >
                                <Star size={12} />
                              </button>
                            )}
                          </div>
                        ))
                      }
                      
                      {/* Norwegian */}
                      {[...availableSubtitles, ...onlineSubtitles]
                        .filter(s => s.language?.toLowerCase() === 'norwegian')
                        .slice(0, 2)
                        .map((subtitle, index) => (
                          <div key={`no-${index}`} className="subtitle-option-row">
                            <button
                              onClick={() => subtitle.source === 'Local' ? loadSubtitle(subtitle) : loadOnlineSubtitle(subtitle)}
                              className={`subtitle-option ${currentSubtitle?.url === subtitle.url || currentSubtitle?.index === subtitle.index ? 'active' : ''}`}
                            >
                              <Globe size={16} />
                              Norwegian ({subtitle.source || 'Local'})
                              {preferredSubtitleLanguage === 'norwegian' && <Star size={12} fill="gold" stroke="gold" className="preferred-star" />}
                            </button>
                            {index === 0 && preferredSubtitleLanguage !== 'norwegian' && (
                              <button
                                onClick={() => setSubtitleLanguagePreference('norwegian')}
                                className="set-preferred-btn"
                                title="Set Norwegian as preferred language"
                              >
                                <Star size={12} />
                              </button>
                            )}
                          </div>
                        ))
                      }
                      
                      {/* German */}
                      {[...availableSubtitles, ...onlineSubtitles]
                        .filter(s => s.language?.toLowerCase() === 'german')
                        .slice(0, 2)
                        .map((subtitle, index) => (
                          <div key={`de-${index}`} className="subtitle-option-row">
                            <button
                              onClick={() => subtitle.source === 'Local' ? loadSubtitle(subtitle) : loadOnlineSubtitle(subtitle)}
                              className={`subtitle-option ${currentSubtitle?.url === subtitle.url || currentSubtitle?.index === subtitle.index ? 'active' : ''}`}
                            >
                              <Globe size={16} />
                              German ({subtitle.source || 'Local'})
                              {preferredSubtitleLanguage === 'german' && <Star size={12} fill="gold" stroke="gold" className="preferred-star" />}
                            </button>
                            {index === 0 && preferredSubtitleLanguage !== 'german' && (
                              <button
                                onClick={() => setSubtitleLanguagePreference('german')}
                                className="set-preferred-btn"
                                title="Set German as preferred language"
                              >
                                <Star size={12} />
                              </button>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {/* All Other Languages */}
                  {(onlineSubtitles.length > 0 || availableSubtitles.length > 0) && (
                    <div className="subtitle-section">
                      <span>Other Languages</span>
                      
                      {[...availableSubtitles, ...onlineSubtitles]
                        .filter(s => !['english', 'arabic', 'norwegian', 'german'].includes(s.language?.toLowerCase()))
                        .slice(0, 15)
                        .map((subtitle, index) => {
                          const lang = subtitle.language?.toLowerCase();
                          const isPreferred = preferredSubtitleLanguage === lang;
                          const displayName = subtitle.language?.charAt(0).toUpperCase() + subtitle.language?.slice(1) || 'Unknown';
                          
                          return (
                            <div key={`other-${index}`} className="subtitle-option-row">
                              <button
                                onClick={() => subtitle.source === 'Local' ? loadSubtitle(subtitle) : loadOnlineSubtitle(subtitle)}
                                className={`subtitle-option ${currentSubtitle?.url === subtitle.url || currentSubtitle?.index === subtitle.index ? 'active' : ''}`}
                              >
                                <Globe size={16} />
                                {displayName} ({subtitle.source || 'Local'})
                                {isPreferred && <Star size={12} fill="gold" stroke="gold" className="preferred-star" />}
                              </button>
                              {!isPreferred && (
                                <button
                                  onClick={() => setSubtitleLanguagePreference(lang)}
                                  className="set-preferred-btn"
                                  title={`Set ${displayName} as preferred language`}
                                >
                                  <Star size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })
                      }
                    </div>
                  )}

                  {/* Manual Search Section */}
                  <div className="subtitle-section">
                    <span>Manual Search</span>
                    <button
                      onClick={() => searchOnlineSubtitles(title)}
                      className="subtitle-option search-option"
                      disabled={isSearchingOnline}
                    >
                      {isSearchingOnline ? (
                        <Loader2 size={16} className="spinning" />
                      ) : (
                        <Search size={16} />
                      )}
                      {isSearchingOnline ? 'Searching...' : 'Search More Subtitles'}
                    </button>
                  </div>

                  {/* No subtitles message */}
                  {!isSearchingOnline && onlineSubtitles.length === 0 && availableSubtitles.length === 0 && (
                    <div className="no-subtitles">
                      No subtitles found. Try searching manually.
                    </div>
                  )}
                  
                  {/* Subtitle toggle when track is loaded */}
                  {currentSubtitle && (
                    <div className="subtitle-section">
                      <span>Display</span>
                      <button
                        onClick={toggleSubtitles}
                        className={`subtitle-option ${subtitlesEnabled ? 'active' : ''}`}
                      >
                        <Subtitles size={16} />
                        {subtitlesEnabled ? 'Hide' : 'Show'} Subtitles
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="settings-menu">
              <button 
                onClick={() => setShowSettings(!showSettings)} 
                className="control-button"
              >
                <Settings size={20} />
              </button>
              
              {showSettings && (
                <div className="settings-dropdown">
                  <div className="settings-section">
                    <span className="section-title">Playback Speed</span>
                    <div className="settings-options">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                        <button
                          key={rate}
                          onClick={() => changePlaybackRate(rate)}
                          className={`settings-option ${playbackRate === rate ? 'active' : ''}`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* NEW: Video Source Selection */}
                  {alternativeSources.length > 0 && (
                    <div className="settings-section source-section">
                      <button 
                        className="section-title clickable"
                        onClick={() => setShowSourceSelection(!showSourceSelection)}
                      >
                        Video Source
                        <span className="source-toggle">{showSourceSelection ? '▼' : '▶'}</span>
                      </button>
                      
                      {showSourceSelection && (
                        <div className="source-list">
                          {/* Current source marked with checkmark */}
                          <div className="source-item current">
                            <Check size={14} />
                            <div className="source-info">
                              <span className="source-name">{currentSourceName || 'Auto-selected'}</span>
                              <span className="source-badge current-badge">Current</span>
                            </div>
                          </div>
                          
                          {/* Alternative sources */}
                          {alternativeSources.slice(0, 10).map((source, i) => {
                            // Truncate torrent name for display (keep first 40 chars)
                            const displayName = source.Name 
                              ? (source.Name.length > 40 ? source.Name.substring(0, 40) + '...' : source.Name)
                              : 'Unknown Torrent';
                            
                            return (
                              <button 
                                key={i}
                                className="source-item alternative"
                                onClick={() => {
                                  if (onSourceChange) {
                                    onSourceChange(source);
                                    setShowSettings(false);
                                    setShowSourceSelection(false);
                                  }
                                }}
                                title={source.Name} // Full name on hover
                              >
                                <div className="source-info">
                                  <span className="source-name-small">{displayName}</span>
                                  <div className="source-details-row">
                                    <span className="source-quality">{source.Quality || 'Unknown'}</span>
                                    <span className="source-separator">•</span>
                                    <span className="source-type">{source.Source || 'Unknown'}</span>
                                  </div>
                                </div>
                                <div className="source-meta">
                                  <span className="source-lang">{source.Language || 'English'}</span>
                                  <span className="source-seeders">{source.Seeders || 0} seeds</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <a 
              href={src} 
              download 
              className="control-button download-button"
              title="Download video"
            >
              <Download size={20} />
            </a>

            <button 
              onClick={toggleFullscreen} 
              className="control-button fullscreen-button"
              title="Fullscreen (or double-tap video)"
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Resume Dialog */}
      {showResumeDialog && resumeData && (
        <div className="resume-dialog-overlay">
          <div className="resume-dialog">
            <h3>Resume Video</h3>
            <p>Do you want to continue from where you left off?</p>
            <div className="resume-info">
              <div className="resume-time">
                Last watched: {progressService.formatTime(resumeData.currentTime)}
              </div>
              <div className="resume-date">
                {progressService.formatRelativeTime(resumeData.lastWatched)}
              </div>
            </div>
            <div className="resume-actions">
              <button 
                onClick={handleStartFromBeginning}
                className="resume-button secondary"
              >
                Watch Now
              </button>
              <button 
                onClick={handleResumeVideo}
                className="resume-button primary"
              >
                Resume at {progressService.formatTime(resumeData.currentTime)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
