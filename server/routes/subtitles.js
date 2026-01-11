const express = require('express');
const router = express.Router();
const axios = require('axios');

// ============================================================================
// SUBTITLE SERVICE - ROBUST MULTI-SOURCE SUBTITLE FETCHING
// ============================================================================
// 
// PRIORITY LANGUAGES: English, Arabic, Norwegian, German
// Uses multiple reliable APIs with proper fallbacks
// ============================================================================

const USER_AGENT = 'Youvies v1.0';

// Priority languages that MUST be available
const PRIORITY_LANGUAGES = ['english', 'arabic', 'norwegian', 'german'];

// All supported languages for fetching
const ALL_LANGUAGES = [
  'english', 'arabic', 'norwegian', 'german', 'spanish', 'french',
  'italian', 'portuguese', 'russian', 'japanese', 'korean', 'chinese',
  'turkish', 'dutch', 'swedish', 'danish', 'finnish', 'polish',
  'hindi', 'greek', 'hebrew', 'romanian', 'czech', 'hungarian',
  'thai', 'vietnamese', 'indonesian', 'malay', 'persian', 'bulgarian',
  'croatian', 'slovenian', 'serbian', 'ukrainian', 'estonian', 'latvian'
];

// ISO 639-1 and 639-2 language code mappings
const LANGUAGE_CODES = {
  'english': ['en', 'eng', 'english'],
  'arabic': ['ar', 'ara', 'arabic'],
  'norwegian': ['no', 'nor', 'norwegian', 'nb', 'nn', 'nob', 'nno'],
  'german': ['de', 'ger', 'deu', 'german'],
  'spanish': ['es', 'spa', 'spanish'],
  'french': ['fr', 'fre', 'fra', 'french'],
  'italian': ['it', 'ita', 'italian'],
  'portuguese': ['pt', 'por', 'portuguese', 'pt-br', 'pt-pt'],
  'russian': ['ru', 'rus', 'russian'],
  'japanese': ['ja', 'jpn', 'japanese'],
  'korean': ['ko', 'kor', 'korean'],
  'chinese': ['zh', 'chi', 'zho', 'chinese', 'zh-cn', 'zh-tw'],
  'turkish': ['tr', 'tur', 'turkish'],
  'dutch': ['nl', 'dut', 'nld', 'dutch'],
  'swedish': ['sv', 'swe', 'swedish'],
  'danish': ['da', 'dan', 'danish'],
  'finnish': ['fi', 'fin', 'finnish'],
  'polish': ['pl', 'pol', 'polish'],
  'hindi': ['hi', 'hin', 'hindi'],
  'greek': ['el', 'gre', 'ell', 'greek'],
  'hebrew': ['he', 'heb', 'hebrew'],
  'romanian': ['ro', 'rum', 'ron', 'romanian'],
  'czech': ['cs', 'cze', 'ces', 'czech'],
  'hungarian': ['hu', 'hun', 'hungarian'],
  'thai': ['th', 'tha', 'thai'],
  'vietnamese': ['vi', 'vie', 'vietnamese'],
  'indonesian': ['id', 'ind', 'indonesian'],
  'malay': ['ms', 'may', 'msa', 'malay'],
  'persian': ['fa', 'per', 'fas', 'persian', 'farsi'],
  'bulgarian': ['bg', 'bul', 'bulgarian'],
  'croatian': ['hr', 'hrv', 'croatian'],
  'slovenian': ['sl', 'slv', 'slovenian'],
  'serbian': ['sr', 'srp', 'serbian'],
  'ukrainian': ['uk', 'ukr', 'ukrainian'],
  'estonian': ['et', 'est', 'estonian'],
  'latvian': ['lv', 'lav', 'latvian']
};

// Reverse lookup: code to language name
const CODE_TO_LANGUAGE = {};
for (const [lang, codes] of Object.entries(LANGUAGE_CODES)) {
  for (const code of codes) {
    CODE_TO_LANGUAGE[code.toLowerCase()] = lang;
  }
}

// In-memory cache (15 minute TTL)
const subtitleCache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

// Cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of subtitleCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      subtitleCache.delete(key);
    }
  }
}, 60000);

// ============================================================================
// API CONFIGURATION
// ============================================================================

// OpenSubtitles.com API - FREE tier allows 20 downloads/day, 5 requests/second
// Get your API key at: https://www.opensubtitles.com/en/consumers
const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY || '';
const OPENSUBTITLES_API_URL = 'https://api.opensubtitles.com/api/v1';

// TMDB API for IMDB ID lookup (optional, improves accuracy)
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract clean title and year from filename
 */
function extractTitleInfo(filename) {
  let name = filename || '';
  
  // Remove file extension
  name = name.replace(/\.[^/.]+$/, '');
  
  // Extract year (look for 4 digits that look like a year)
  const yearMatch = name.match(/[\.\s\-_\(\[]?(19[5-9]\d|20[0-2]\d)[\.\s\-_\)\]]?/);
  const year = yearMatch ? yearMatch[1] : null;
  
  // Clean up title
  name = name
    // Remove content in brackets/parentheses
    .replace(/[\(\[][^\)\]]*[\)\]]/g, '')
    // Remove quality indicators
    .replace(/\b(720p|1080p|2160p|4K|UHD|HD|SD|WEB-DL|WEBDL|WEBRip|BluRay|BDRip|BRRip|HDRip|HDTV|DVDRip|REMUX|PROPER|REPACK)\b/gi, '')
    // Remove codec info
    .replace(/\b(x264|x265|h\.?264|h\.?265|HEVC|AVC|XviD|DivX|AAC|AC3|DTS|DD5\.?1|DDP5\.?1|DDP|FLAC|MP3|Atmos|TrueHD|EAC3)\b/gi, '')
    // Remove release groups
    .replace(/\b(YIFY|YTS|RARBG|EZTV|SPARKS|NTb|LOL|DIMENSION|FGT|AMZN|NF|DSNP|HMAX|ATVP|PCOK|PMTP|iT|RED|FLUX|SMURF|NOGRP|KOGi|QOQ|NTG|playWEB|CMRG|TEPES|SiGMA|EDITH|SYNCOPY|TOMMY|HONE|T6D|BYNDR|MZABI|Cakes|ETHEL|KOBE|APEX)\b/gi, '')
    // Remove season/episode markers
    .replace(/S\d{1,2}E\d{1,3}/gi, '')
    .replace(/Season\s*\d+/gi, '')
    .replace(/Episode\s*\d+/gi, '')
    // Remove year (we extracted it)
    .replace(/\b(19[5-9]\d|20[0-2]\d)\b/g, '')
    // Replace separators with spaces
    .replace(/[._-]/g, ' ')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  return { title: name, year };
}

/**
 * Normalize language name from various formats
 */
function normalizeLanguage(lang) {
  if (!lang) return 'english';
  const lower = lang.toLowerCase().trim();
  
  // Direct lookup
  if (CODE_TO_LANGUAGE[lower]) {
    return CODE_TO_LANGUAGE[lower];
  }
  
  // Check if it's already a language name
  if (LANGUAGE_CODES[lower]) {
    return lower;
  }
  
  // Partial match
  for (const [name, codes] of Object.entries(LANGUAGE_CODES)) {
    if (lower.includes(name) || codes.some(c => lower.includes(c))) {
      return name;
    }
  }
  
  return lower;
}

/**
 * Get language code for API requests
 */
function getLanguageCode(lang, format = 'iso639-2') {
  const normalized = normalizeLanguage(lang);
  const codes = LANGUAGE_CODES[normalized];
  if (!codes) return 'en';
  
  if (format === 'iso639-1') {
    return codes[0]; // First code is usually 2-letter
  }
  return codes[1] || codes[0]; // Second is usually 3-letter
}

/**
 * Safe HTTP request with timeout and retries
 */
async function safeRequest(url, options = {}) {
  const maxRetries = options.retries || 2;
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios({
        url,
        timeout: options.timeout || 10000,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json,text/html,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...options.headers
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        ...options
      });
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  
  console.warn(`Request failed after ${maxRetries} attempts: ${url}`);
  return null;
}

// ============================================================================
// SUBTITLE SOURCES
// ============================================================================

/**
 * Source 1: OpenSubtitles.com REST API (BEST - requires free API key)
 * API Docs: https://opensubtitles.stoplight.io/
 */
async function searchOpenSubtitlesAPI(query, imdbId, year, languages) {
  const results = [];
  
  if (!OPENSUBTITLES_API_KEY) {
    console.log('⚠️ [OpenSubtitles API] No API key configured - skipping');
    return results;
  }
  
  try {
    console.log(`🔍 [OpenSubtitles API] Searching: "${query}"`);
    
    // Build search params
    const params = new URLSearchParams();
    
    if (imdbId) {
      params.append('imdb_id', imdbId.replace('tt', ''));
    } else {
      params.append('query', query);
    }
    
    if (year) {
      params.append('year', year);
    }
    
    // Request multiple languages
    const langCodes = languages.map(l => getLanguageCode(l, 'iso639-2')).join(',');
    params.append('languages', langCodes);
    
    const response = await safeRequest(`${OPENSUBTITLES_API_URL}/subtitles?${params.toString()}`, {
      timeout: 12000,
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (response && response.data && response.data.data) {
      for (const item of response.data.data) {
        const attrs = item.attributes || {};
        const files = attrs.files || [];
        
        for (const file of files) {
          results.push({
            id: `oscom-${file.file_id}`,
            fileId: file.file_id,
            language: normalizeLanguage(attrs.language),
            languageCode: attrs.language,
            url: null, // Will get download link when needed
            source: 'OpenSubtitles',
            downloads: attrs.download_count || 0,
            filename: file.file_name,
            fps: attrs.fps,
            hearingImpaired: attrs.hearing_impaired,
            foreignPartsOnly: attrs.foreign_parts_only,
            rating: attrs.ratings,
            release: attrs.release,
            uploader: attrs.uploader?.name
          });
        }
      }
    }
    
    console.log(`✅ [OpenSubtitles API] Found ${results.length} subtitles`);
  } catch (error) {
    console.warn(`⚠️ [OpenSubtitles API] Error: ${error.message}`);
  }
  
  return results;
}

/**
 * Get download link from OpenSubtitles API (requires API call)
 */
async function getOpenSubtitlesDownloadLink(fileId) {
  if (!OPENSUBTITLES_API_KEY || !fileId) return null;
  
  try {
    const response = await safeRequest(`${OPENSUBTITLES_API_URL}/download`, {
      method: 'POST',
      timeout: 10000,
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json'
      },
      data: { file_id: fileId }
    });
    
    if (response && response.data && response.data.link) {
      return response.data.link;
    }
  } catch (error) {
    console.warn(`⚠️ [OpenSubtitles API] Download link error: ${error.message}`);
  }
  
  return null;
}

/**
 * Source 2: Subscene (web scraping fallback - very reliable)
 */
async function searchSubscene(query, year) {
  const results = [];
  
  try {
    console.log(`🔍 [Subscene] Searching: "${query}"`);
    
    // Search for the movie/show
    const searchUrl = `https://subscene.com/subtitles/searchbytitle?query=${encodeURIComponent(query)}`;
    
    const searchResponse = await safeRequest(searchUrl, { timeout: 10000 });
    
    if (!searchResponse || searchResponse.status !== 200) {
      return results;
    }
    
    const html = searchResponse.data || '';
    
    // Extract movie/show links - look for exact or close matches
    const titlePattern = /<a\s+href="(\/subtitles\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const matches = [...html.matchAll(titlePattern)];
    
    // Find best matching title
    let bestMatch = null;
    const queryLower = query.toLowerCase();
    
    for (const match of matches) {
      const path = match[1];
      const title = match[2].toLowerCase().trim();
      
      // Skip if it's a language-specific path
      if (path.includes('/subtitles/') && !path.match(/\/subtitles\/[^\/]+\/[a-z]{2,}$/)) {
        if (title.includes(queryLower) || queryLower.includes(title)) {
          bestMatch = path;
          break;
        }
      }
    }
    
    if (!bestMatch) {
      // Try first result
      const firstMatch = matches.find(m => m[1].match(/^\/subtitles\/[^\/]+$/));
      if (firstMatch) {
        bestMatch = firstMatch[1];
      }
    }
    
    if (bestMatch) {
      // Get subtitle list page
      const listUrl = `https://subscene.com${bestMatch}`;
      const listResponse = await safeRequest(listUrl, { timeout: 10000 });
      
      if (listResponse && listResponse.status === 200) {
        const listHtml = listResponse.data || '';
        
        // Extract subtitle entries
        const subPattern = /<td class="a1">\s*<a href="(\/subtitles\/[^"]+)">\s*<span class="[^"]*">\s*([^<]+)<\/span>\s*<span>\s*([^<]+)<\/span>/gi;
        const subMatches = [...listHtml.matchAll(subPattern)];
        
        for (const subMatch of subMatches.slice(0, 30)) {
          const downloadPath = subMatch[1];
          const language = subMatch[2].trim();
          const release = subMatch[3].trim();
          
          results.push({
            id: `subscene-${downloadPath.replace(/\//g, '-')}`,
            language: normalizeLanguage(language),
            languageCode: getLanguageCode(language),
            url: `https://subscene.com${downloadPath}`,
            source: 'Subscene',
            downloads: 0,
            filename: release,
            release: release,
            needsPageParse: true // Need to parse page to get actual download link
          });
        }
      }
    }
    
    console.log(`✅ [Subscene] Found ${results.length} subtitles`);
  } catch (error) {
    console.warn(`⚠️ [Subscene] Error: ${error.message}`);
  }
  
  return results;
}

/**
 * Get actual download link from Subscene page
 */
async function getSubsceneDownloadLink(pageUrl) {
  try {
    const response = await safeRequest(pageUrl, { timeout: 8000 });
    
    if (response && response.status === 200) {
      const html = response.data || '';
      
      // Find download link
      const dlMatch = html.match(/href="(\/subtitles\/[^"]+\/download)"/i);
      if (dlMatch) {
        return `https://subscene.com${dlMatch[1]}`;
      }
    }
  } catch (error) {
    console.warn(`⚠️ [Subscene] Download link error: ${error.message}`);
  }
  
  return null;
}

/**
 * Source 3: YIFY Subtitles (great for movies, especially YIFY releases)
 */
async function searchYifySubtitles(query, imdbId) {
  const results = [];
  
  try {
    console.log(`🔍 [YIFY Subs] Searching: "${query}"`);
    
    let moviePageUrl = null;
    
    // If we have IMDB ID, use it directly
    if (imdbId) {
      moviePageUrl = `https://yifysubtitles.ch/movie-imdb/${imdbId}`;
    } else {
      // Search by title
      const searchUrl = `https://yifysubtitles.ch/search?q=${encodeURIComponent(query)}`;
      const searchResponse = await safeRequest(searchUrl, { timeout: 8000 });
      
      if (searchResponse && searchResponse.status === 200) {
        const html = searchResponse.data || '';
        
        // Find first movie link
        const movieMatch = html.match(/href="(\/movie-imdb\/tt\d+)"/i);
        if (movieMatch) {
          moviePageUrl = `https://yifysubtitles.ch${movieMatch[1]}`;
        }
      }
    }
    
    if (moviePageUrl) {
      const movieResponse = await safeRequest(moviePageUrl, { timeout: 8000 });
      
      if (movieResponse && movieResponse.status === 200) {
        const html = movieResponse.data || '';
        
        // Extract subtitle entries
        // Pattern: <span class="sub-lang">English</span> ... <a href="/subtitles/..."
        const subPattern = /<tr[^>]*>[\s\S]*?<span class="sub-lang">([^<]+)<\/span>[\s\S]*?<a[^>]*href="(\/subtitle\/[^"]+)"[^>]*>[\s\S]*?<\/tr>/gi;
        const matches = [...html.matchAll(subPattern)];
        
        for (const match of matches.slice(0, 25)) {
          const language = match[1].trim();
          const path = match[2];
          
          results.push({
            id: `yify-${path.replace(/\//g, '-')}`,
            language: normalizeLanguage(language),
            languageCode: getLanguageCode(language),
            url: `https://yifysubtitles.ch${path}`,
            source: 'YIFY',
            downloads: 0,
            needsPageParse: true
          });
        }
      }
    }
    
    console.log(`✅ [YIFY Subs] Found ${results.length} subtitles`);
  } catch (error) {
    console.warn(`⚠️ [YIFY Subs] Error: ${error.message}`);
  }
  
  return results;
}

/**
 * Get actual download link from YIFY page
 */
async function getYifyDownloadLink(pageUrl) {
  try {
    const response = await safeRequest(pageUrl, { timeout: 8000 });
    
    if (response && response.status === 200) {
      const html = response.data || '';
      
      // Find download button link
      const dlMatch = html.match(/href="(\/subtitle\/[^"]+\.zip)"/i) ||
                      html.match(/class="btn-icon download-subtitle"[^>]*href="([^"]+)"/i);
      if (dlMatch) {
        const link = dlMatch[1];
        return link.startsWith('http') ? link : `https://yifysubtitles.ch${link}`;
      }
    }
  } catch (error) {
    console.warn(`⚠️ [YIFY Subs] Download link error: ${error.message}`);
  }
  
  return null;
}

/**
 * Source 4: OpenSubtitles.org (legacy, web scraping)
 */
async function searchOpenSubtitlesOrg(query, languages) {
  const results = [];
  
  try {
    console.log(`🔍 [OpenSubtitles.org] Searching: "${query}" for languages: ${languages.join(', ')}`);
    
    // Search for each priority language
    for (const lang of languages.slice(0, 6)) { // Search up to 6 languages
      const langCode = getLanguageCode(lang, 'iso639-2');
      const normalizedLang = normalizeLanguage(lang); // Get consistent language name
      
      const searchUrl = `https://www.opensubtitles.org/en/search/sublanguageid-${langCode}/moviename-${encodeURIComponent(query)}/sort-7/asc-0`;
      
      const response = await safeRequest(searchUrl, { timeout: 10000 });
      
      if (response && response.status === 200) {
        const html = response.data || '';
        
        // Extract subtitle IDs from the page
        const simplePattern = /\/en\/subtitles\/(\d+)/g;
        const matches = [...html.matchAll(simplePattern)];
        const uniqueIds = [...new Set(matches.map(m => m[1]))];
        
        console.log(`   [OpenSubtitles.org] Found ${uniqueIds.length} ${normalizedLang} subtitles`);
        
        for (const subId of uniqueIds.slice(0, 5)) { // Limit to 5 per language
          results.push({
            id: `osorg-${subId}-${langCode}`,
            language: normalizedLang, // Use normalized language name (e.g., "norwegian" not "nor")
            languageCode: langCode,
            url: `https://dl.opensubtitles.org/en/download/sub/${subId}`,
            source: 'OpenSubtitles',
            downloads: 0
          });
        }
      }
      
      // Small delay between language searches
      await new Promise(r => setTimeout(r, 150));
    }
    
    console.log(`✅ [OpenSubtitles.org] Total: ${results.length} subtitles`);
    console.log(`   Languages: ${[...new Set(results.map(r => r.language))].join(', ')}`);
  } catch (error) {
    console.warn(`⚠️ [OpenSubtitles.org] Error: ${error.message}`);
  }
  
  return results;
}

/**
 * Source 5: Podnapisi.net (good European language support)
 */
async function searchPodnapisi(query, year) {
  const results = [];
  
  try {
    console.log(`🔍 [Podnapisi] Searching: "${query}"`);
    
    const searchUrl = `https://www.podnapisi.net/subtitles/search/advanced?keywords=${encodeURIComponent(query)}&year=${year || ''}&sort=stats.downloads&order=desc`;
    
    const response = await safeRequest(searchUrl, { timeout: 10000 });
    
    if (response && response.status === 200) {
      const html = response.data || '';
      
      // Extract subtitle entries
      const subPattern = /<tr[^>]*class="subtitle-entry"[^>]*>[\s\S]*?<a[^>]*href="(\/subtitles\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="release"[^>]*>([^<]*)<\/span>[\s\S]*?flag-([a-z]{2})/gi;
      const matches = [...html.matchAll(subPattern)];
      
      for (const match of matches.slice(0, 20)) {
        const path = match[1];
        const release = match[2].trim();
        const langCode = match[3];
        
        results.push({
          id: `podnapisi-${path.replace(/\//g, '-')}`,
          language: normalizeLanguage(langCode),
          languageCode: langCode,
          url: `https://www.podnapisi.net${path}/download`,
          source: 'Podnapisi',
          downloads: 0,
          filename: release,
          release: release
        });
      }
    }
    
    console.log(`✅ [Podnapisi] Found ${results.length} subtitles`);
  } catch (error) {
    console.warn(`⚠️ [Podnapisi] Error: ${error.message}`);
  }
  
  return results;
}

/**
 * Source 6: SubDL API (free, no key needed)
 */
async function searchSubDL(query, imdbId, year, type) {
  const results = [];
  
  try {
    console.log(`🔍 [SubDL] Searching: "${query}"`);
    
    // Build API URL
    let apiUrl = 'https://api.subdl.com/api/v1/subtitles';
    const params = new URLSearchParams();
    
    if (imdbId) {
      params.append('imdb_id', imdbId);
    } else {
      params.append('film_name', query);
    }
    
    if (year) params.append('year', year);
    if (type) params.append('type', type === 'movie' ? 'movie' : 'tv');
    
    // Request all languages, we'll filter later
    params.append('languages', 'EN,AR,NO,DE,ES,FR,IT,PT,RU,JA,KO,ZH,TR,NL,SV,DA,FI,PL,HI,EL,HE,RO,CS,HU');
    
    const response = await safeRequest(`${apiUrl}?${params.toString()}`, { timeout: 10000 });
    
    if (response && response.data) {
      const data = response.data;
      const subtitles = data.subtitles || [];
      
      for (const sub of subtitles.slice(0, 30)) {
        results.push({
          id: `subdl-${sub.sd_id || sub.id || Math.random().toString(36).slice(2)}`,
          language: normalizeLanguage(sub.language || sub.lang),
          languageCode: sub.lang || 'en',
          url: sub.url || `https://dl.subdl.com${sub.url}`,
          source: 'SubDL',
          downloads: sub.download_count || 0,
          filename: sub.release_name || sub.file_name,
          release: sub.release_name,
          hearingImpaired: sub.hi === 1
        });
      }
    }
    
    console.log(`✅ [SubDL] Found ${results.length} subtitles`);
  } catch (error) {
    console.warn(`⚠️ [SubDL] Error: ${error.message}`);
  }
  
  return results;
}

// ============================================================================
// MAIN SEARCH - Searches all sources in parallel
// ============================================================================

async function searchAllSources(query, year, imdbId, type, languages = PRIORITY_LANGUAGES) {
  console.log(`\n🎬 Searching subtitles for: "${query}" (${year || 'N/A'}) [${type || 'unknown'}]`);
  console.log(`📝 Priority languages: ${languages.join(', ')}`);
  if (imdbId) console.log(`🎯 IMDB ID: ${imdbId}`);
  
  const startTime = Date.now();
  
  // Search all sources in parallel
  const searchPromises = [
    searchOpenSubtitlesAPI(query, imdbId, year, ALL_LANGUAGES).catch(e => { console.warn('OpenSubtitles API error:', e.message); return []; }),
    searchSubDL(query, imdbId, year, type).catch(e => { console.warn('SubDL error:', e.message); return []; }),
    searchSubscene(query, year).catch(e => { console.warn('Subscene error:', e.message); return []; }),
    searchYifySubtitles(query, imdbId).catch(e => { console.warn('YIFY error:', e.message); return []; }),
    searchOpenSubtitlesOrg(query, languages).catch(e => { console.warn('OpenSubtitles.org error:', e.message); return []; }),
    searchPodnapisi(query, year).catch(e => { console.warn('Podnapisi error:', e.message); return []; })
  ];
  
  // Wait for all with a global timeout
  const timeoutMs = 20000;
  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => {
      console.log('⏱️ Search timeout reached, using partial results');
      resolve(null);
    }, timeoutMs);
  });
  
  const resultsPromise = Promise.all(searchPromises);
  const raceResult = await Promise.race([resultsPromise, timeoutPromise]);
  
  // Get results (either completed or partial)
  let allResults;
  if (raceResult === null) {
    // Timeout - collect whatever we have
    allResults = await Promise.all(searchPromises.map(p => 
      Promise.race([p, new Promise(r => setTimeout(() => r([]), 100))])
    ));
  } else {
    allResults = raceResult;
  }
  
  // Flatten results
  let allSubtitles = allResults.flat().filter(sub => sub && sub.url);
  
  console.log(`📊 Raw results: ${allSubtitles.length} subtitles from all sources`);
  
  // Remove exact URL duplicates only (keep all different subtitle files)
  const seenUrls = new Set();
  allSubtitles = allSubtitles.filter(sub => {
    const key = sub.url;
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });
  
  console.log(`📊 After URL dedup: ${allSubtitles.length} subtitles`);
  
  // Sort by: priority language, then downloads
  allSubtitles.sort((a, b) => {
    const aPriority = PRIORITY_LANGUAGES.indexOf(a.language);
    const bPriority = PRIORITY_LANGUAGES.indexOf(b.language);
    
    // Priority languages first
    if (aPriority !== -1 && bPriority === -1) return -1;
    if (aPriority === -1 && bPriority !== -1) return 1;
    
    // Within priority languages, maintain order
    if (aPriority !== -1 && bPriority !== -1 && aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Same language - sort by downloads
    return (b.downloads || 0) - (a.downloads || 0);
  });
  
  // Keep ALL subtitles - let the user choose
  // Only limit if we have way too many (more than 50)
  if (allSubtitles.length > 50) {
    const languageCounts = {};
    allSubtitles = allSubtitles.filter(sub => {
      const lang = sub.language;
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      // Keep up to 10 per language
      return languageCounts[lang] <= 10;
    });
  }
  
  const searchTime = Date.now() - startTime;
  console.log(`✅ Final results: ${allSubtitles.length} subtitles in ${searchTime}ms`);
  console.log(`   Languages: ${[...new Set(allSubtitles.map(s => s.language))].join(', ') || 'none'}`);
  
  return allSubtitles;
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * POST /api/subtitles/search - Search for subtitles
 */
router.post('/search', async (req, res) => {
  let responseSent = false;
  const timeout = setTimeout(() => {
    if (!responseSent) {
      responseSent = true;
      res.status(504).json({ error: 'Search timeout', results: [] });
    }
  }, 25000);
  
  try {
    const { title, year, imdbId, type, languages } = req.body;
    
    if (!title) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Check cache
    const cacheKey = `search:${title}:${year || ''}:${imdbId || ''}`;
    const cached = subtitleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      clearTimeout(timeout);
      if (!responseSent) {
        responseSent = true;
        return res.json(cached.results);
      }
      return;
    }
    
    // Extract title info if needed
    const { title: cleanTitle, year: extractedYear } = extractTitleInfo(title);
    const searchTitle = cleanTitle || title;
    const searchYear = year || extractedYear;
    
    // Search all sources
    const results = await searchAllSources(searchTitle, searchYear, imdbId, type, languages || PRIORITY_LANGUAGES);
    
    // Cache results
    subtitleCache.set(cacheKey, { results, timestamp: Date.now() });
    
    clearTimeout(timeout);
    if (!responseSent) {
      responseSent = true;
      res.json(results);
    }
  } catch (error) {
    console.error('Subtitle search error:', error);
    clearTimeout(timeout);
    if (!responseSent) {
      responseSent = true;
      res.status(500).json({ error: 'Search failed', message: error.message });
    }
  }
});

/**
 * GET /api/subtitles/auto - Auto-fetch subtitles for a video
 */
router.get('/auto', async (req, res) => {
  let responseSent = false;
  const timeout = setTimeout(() => {
    if (!responseSent) {
      responseSent = true;
      res.status(504).json({ error: 'Search timeout', results: [] });
    }
  }, 30000);
  
  try {
    const { title, year, imdbId, type, preferredLanguage } = req.query;
    
    if (!title) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Check cache
    const cacheKey = `auto:${title}:${year || ''}:${imdbId || ''}`;
    const cached = subtitleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      clearTimeout(timeout);
      if (!responseSent) {
        responseSent = true;
        // Sort with preferred language first if specified
        let results = [...cached.results];
        if (preferredLanguage) {
          results = sortWithPreference(results, preferredLanguage);
        }
        return res.json(results);
      }
      return;
    }
    
    // Extract title info
    const { title: cleanTitle, year: extractedYear } = extractTitleInfo(title);
    const searchTitle = cleanTitle || title;
    const searchYear = year || extractedYear;
    
    console.log(`\n🎬 Auto-fetching subtitles for: "${searchTitle}"`);
    
    // Search all sources
    const results = await searchAllSources(searchTitle, searchYear, imdbId, type, ALL_LANGUAGES);
    
    // Cache results
    subtitleCache.set(cacheKey, { results, timestamp: Date.now() });
    
    clearTimeout(timeout);
    if (!responseSent) {
      responseSent = true;
      // Sort with preferred language first if specified
      let sortedResults = results;
      if (preferredLanguage) {
        console.log(`📌 Sorting results with preferred language: ${preferredLanguage}`);
        sortedResults = sortWithPreference(results, preferredLanguage);
      }
      
      // Log final languages being returned
      const finalLangs = [...new Set(sortedResults.map(s => s.language))];
      console.log(`📤 Returning ${sortedResults.length} subtitles with languages: ${finalLangs.join(', ')}`);
      
      res.json(sortedResults);
    }
  } catch (error) {
    console.error('Auto subtitle fetch error:', error);
    clearTimeout(timeout);
    if (!responseSent) {
      responseSent = true;
      res.status(500).json({ error: 'Auto fetch failed', message: error.message });
    }
  }
});

/**
 * Sort results with preferred language first
 */
function sortWithPreference(results, preferredLanguage) {
  const preferred = normalizeLanguage(preferredLanguage);
  return [...results].sort((a, b) => {
    if (a.language === preferred && b.language !== preferred) return -1;
    if (b.language === preferred && a.language !== preferred) return 1;
    return 0;
  });
}

/**
 * GET /api/subtitles/download - Download and convert subtitle
 */
router.get('/download', async (req, res) => {
  let responseSent = false;
  const timeout = setTimeout(() => {
    if (!responseSent) {
      responseSent = true;
      res.status(504).send('Download timeout');
    }
  }, 30000);
  
  try {
    let { url, language, source, fileId, needsPageParse } = req.query;
    
    // Handle OpenSubtitles API downloads (need to get link first)
    if (fileId && source === 'OpenSubtitles') {
      console.log(`📥 Getting OpenSubtitles download link for file: ${fileId}`);
      url = await getOpenSubtitlesDownloadLink(parseInt(fileId));
      if (!url) {
        clearTimeout(timeout);
        return res.status(404).send('Could not get download link');
      }
    }
    
    // Handle Subscene page parsing
    if (needsPageParse === 'true' && url && url.includes('subscene.com')) {
      console.log(`📥 Getting Subscene download link from: ${url}`);
      url = await getSubsceneDownloadLink(url);
      if (!url) {
        clearTimeout(timeout);
        return res.status(404).send('Could not get download link');
      }
    }
    
    // Handle YIFY page parsing
    if (needsPageParse === 'true' && url && url.includes('yifysubtitles')) {
      console.log(`📥 Getting YIFY download link from: ${url}`);
      url = await getYifyDownloadLink(url);
      if (!url) {
        clearTimeout(timeout);
        return res.status(404).send('Could not get download link');
      }
    }
    
    if (!url) {
      clearTimeout(timeout);
      return res.status(400).send('URL is required');
    }
    
    console.log(`📥 Downloading subtitle: ${language || 'unknown'}`);
    console.log(`   URL: ${url.substring(0, 100)}...`);
    
    // Download the subtitle file
    const response = await safeRequest(url, {
      timeout: 20000,
      responseType: 'arraybuffer',
      headers: {
        'Accept': '*/*',
        'Referer': new URL(url).origin
      }
    });
    
    if (!response || !response.data) {
      clearTimeout(timeout);
      return res.status(404).send('Subtitle not found');
    }
    
    let subtitleContent;
    const buffer = Buffer.from(response.data);
    
    // Check if it's a ZIP file
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      console.log('📦 Extracting from ZIP archive...');
      
      try {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        
        // Find subtitle file in ZIP
        const subEntry = entries.find(e => 
          !e.isDirectory && 
          (e.entryName.endsWith('.srt') || e.entryName.endsWith('.vtt') || e.entryName.endsWith('.ass') || e.entryName.endsWith('.ssa'))
        );
        
        if (!subEntry) {
          clearTimeout(timeout);
          return res.status(404).send('No subtitle found in archive');
        }
        
        console.log(`📦 Extracted: ${subEntry.entryName}`);
        subtitleContent = decodeSubtitleBuffer(subEntry.getData(), language);
      } catch (zipError) {
        console.error('ZIP extraction error:', zipError);
        clearTimeout(timeout);
        return res.status(500).send('Failed to extract subtitle');
      }
    } else {
      // Regular subtitle file
      subtitleContent = decodeSubtitleBuffer(buffer, language);
    }
    
    // Convert to WebVTT if needed
    if (!subtitleContent.includes('WEBVTT')) {
      subtitleContent = convertToVTT(subtitleContent);
    }
    
    clearTimeout(timeout);
    if (!responseSent) {
      responseSent = true;
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.send(subtitleContent);
    }
  } catch (error) {
    console.error('Subtitle download error:', error);
    clearTimeout(timeout);
    if (!responseSent) {
      responseSent = true;
      res.status(500).send(`Download failed: ${error.message}`);
    }
  }
});

/**
 * Decode subtitle buffer with proper character encoding
 */
function decodeSubtitleBuffer(buffer, language) {
  // Check for BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.toString('utf8');
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return buffer.toString('utf16le');
  }
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return buffer.swap16().toString('utf16le');
  }
  
  // Try UTF-8 first
  const utf8Content = buffer.toString('utf8');
  
  // Check for encoding issues (replacement characters or garbled text)
  if (!utf8Content.includes('�') && isValidSubtitle(utf8Content)) {
    return utf8Content;
  }
  
  // For Arabic, try Windows-1256
  if (language && language.toLowerCase() === 'arabic') {
    try {
      const win1256Content = decodeWindows1256(buffer);
      if (isValidSubtitle(win1256Content)) {
        return win1256Content;
      }
    } catch (e) {}
  }
  
  // Try ISO-8859-1 (Latin-1)
  try {
    const latin1Content = buffer.toString('latin1');
    if (isValidSubtitle(latin1Content)) {
      return latin1Content;
    }
  } catch (e) {}
  
  // Fallback to UTF-8
  return utf8Content;
}

/**
 * Check if content looks like valid subtitle
 */
function isValidSubtitle(content) {
  return content.includes('-->') && content.length > 50;
}

/**
 * Decode Windows-1256 (Arabic) encoding
 */
function decodeWindows1256(buffer) {
  const win1256ToUnicode = {
    0x80: 0x20AC, 0x81: 0x067E, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
    0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0679, 0x8B: 0x2039, 0x8C: 0x0152, 0x8D: 0x0686, 0x8E: 0x0698, 0x8F: 0x0688,
    0x90: 0x06AF, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
    0x98: 0x06A9, 0x99: 0x2122, 0x9A: 0x0691, 0x9B: 0x203A, 0x9C: 0x0153, 0x9D: 0x200C, 0x9E: 0x200D, 0x9F: 0x06BA,
    0xA0: 0x00A0, 0xA1: 0x060C, 0xA2: 0x00A2, 0xA3: 0x00A3, 0xA4: 0x00A4, 0xA5: 0x00A5, 0xA6: 0x00A6, 0xA7: 0x00A7,
    0xA8: 0x00A8, 0xA9: 0x00A9, 0xAA: 0x06BE, 0xAB: 0x00AB, 0xAC: 0x00AC, 0xAD: 0x00AD, 0xAE: 0x00AE, 0xAF: 0x00AF,
    0xB0: 0x00B0, 0xB1: 0x00B1, 0xB2: 0x00B2, 0xB3: 0x00B3, 0xB4: 0x00B4, 0xB5: 0x00B5, 0xB6: 0x00B6, 0xB7: 0x00B7,
    0xB8: 0x00B8, 0xB9: 0x00B9, 0xBA: 0x061B, 0xBB: 0x00BB, 0xBC: 0x00BC, 0xBD: 0x00BD, 0xBE: 0x00BE, 0xBF: 0x061F,
    0xC0: 0x06C1, 0xC1: 0x0621, 0xC2: 0x0622, 0xC3: 0x0623, 0xC4: 0x0624, 0xC5: 0x0625, 0xC6: 0x0626, 0xC7: 0x0627,
    0xC8: 0x0628, 0xC9: 0x0629, 0xCA: 0x062A, 0xCB: 0x062B, 0xCC: 0x062C, 0xCD: 0x062D, 0xCE: 0x062E, 0xCF: 0x062F,
    0xD0: 0x0630, 0xD1: 0x0631, 0xD2: 0x0632, 0xD3: 0x0633, 0xD4: 0x0634, 0xD5: 0x0635, 0xD6: 0x0636, 0xD7: 0x00D7,
    0xD8: 0x0637, 0xD9: 0x0638, 0xDA: 0x0639, 0xDB: 0x063A, 0xDC: 0x0640, 0xDD: 0x0641, 0xDE: 0x0642, 0xDF: 0x0643,
    0xE0: 0x00E0, 0xE1: 0x0644, 0xE2: 0x00E2, 0xE3: 0x0645, 0xE4: 0x0646, 0xE5: 0x0647, 0xE6: 0x0648, 0xE7: 0x00E7,
    0xE8: 0x00E8, 0xE9: 0x00E9, 0xEA: 0x00EA, 0xEB: 0x00EB, 0xEC: 0x0649, 0xED: 0x064A, 0xEE: 0x00EE, 0xEF: 0x00EF,
    0xF0: 0x064B, 0xF1: 0x064C, 0xF2: 0x064D, 0xF3: 0x064E, 0xF4: 0x00F4, 0xF5: 0x064F, 0xF6: 0x0650, 0xF7: 0x00F7,
    0xF8: 0x0651, 0xF9: 0x00F9, 0xFA: 0x0652, 0xFB: 0x00FB, 0xFC: 0x00FC, 0xFD: 0x200E, 0xFE: 0x200F, 0xFF: 0x06D2
  };
  
  let result = '';
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else if (win1256ToUnicode[byte]) {
      result += String.fromCharCode(win1256ToUnicode[byte]);
    } else {
      result += String.fromCharCode(byte);
    }
  }
  return result;
}

/**
 * Convert SRT/ASS to WebVTT format
 * Simple conversion - just adds header and fixes comma to dot
 */
function convertToVTT(content) {
  if (!content) return '';
  
  // If already VTT, return as-is
  if (content.trim().startsWith('WEBVTT')) {
    console.log('📄 Already WebVTT format');
    return content;
  }
  
  // Check if it's ASS/SSA format
  if (content.includes('[Script Info]') || content.includes('Dialogue:')) {
    console.log('📄 Converting ASS/SSA to WebVTT');
    return convertASStoVTT(content);
  }
  
  // Simple SRT to VTT conversion
  // Just add header and replace commas with dots in timestamps
  console.log('📄 Converting SRT to WebVTT (simple)');
  
  // Add WEBVTT header
  let vttContent = 'WEBVTT\n\n';
  
  // Replace commas with dots in timestamps (SRT uses comma, VTT uses dot)
  // Timestamp pattern: 00:00:00,000 --> 00:00:00,000
  const converted = content
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  
  vttContent += converted;
  
  // Count entries for logging
  const count = (converted.match(/-->/g) || []).length;
  console.log(`📄 Converted ${count} SRT entries`);
  
  return vttContent;
}

/**
 * Convert ASS/SSA to WebVTT
 */
function convertASStoVTT(content) {
  let vttContent = 'WEBVTT\n\n';
  
  // ASS format: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
  // More flexible pattern
  const dialoguePattern = /Dialogue:\s*\d+,(\d+:\d{2}:\d{2}[.,]\d{2}),(\d+:\d{2}:\d{2}[.,]\d{2}),[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,(.+)/g;
  let match;
  let count = 0;
  
  while ((match = dialoguePattern.exec(content)) !== null) {
    const startVTT = convertASSTimestamp(match[1]);
    const endVTT = convertASSTimestamp(match[2]);
    let text = match[3]
      .replace(/\\N/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\{[^}]*\}/g, '') // Remove ASS style tags
      .trim();
    
    if (text) {
      vttContent += `${startVTT} --> ${endVTT}\n${text}\n\n`;
      count++;
    }
  }
  
  console.log(`📄 Converted ${count} ASS dialogue entries`);
  return vttContent;
}

/**
 * Convert ASS timestamp (H:MM:SS.cc) to VTT format (HH:MM:SS.mmm)
 */
function convertASSTimestamp(assTime) {
  // Normalize separator (ASS can use . or ,)
  const normalized = assTime.replace(',', '.');
  const parts = normalized.split(':');
  
  if (parts.length === 3) {
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1].padStart(2, '0');
    
    // Handle seconds.centiseconds
    const secParts = parts[2].split('.');
    const seconds = secParts[0].padStart(2, '0');
    // ASS uses centiseconds (2 digits), VTT uses milliseconds (3 digits)
    const cs = secParts[1] || '00';
    const ms = (cs + '0').slice(0, 3); // Pad to 3 digits (multiply by 10)
    
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }
  return assTime;
}

/**
 * GET /api/subtitles/languages - Get supported languages
 */
router.get('/languages', (req, res) => {
  const languages = Object.keys(LANGUAGE_CODES).map(name => ({
    code: LANGUAGE_CODES[name][0],
    name: name.charAt(0).toUpperCase() + name.slice(1),
    priority: PRIORITY_LANGUAGES.includes(name)
  }));
  
  languages.sort((a, b) => {
    if (a.priority && !b.priority) return -1;
    if (!a.priority && b.priority) return 1;
    return a.name.localeCompare(b.name);
  });
  
  res.json(languages);
});

/**
 * GET /api/subtitles/status - Check API status
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    opensubtitlesApiKey: !!OPENSUBTITLES_API_KEY,
    tmdbApiKey: !!TMDB_API_KEY,
    cacheSize: subtitleCache.size,
    priorityLanguages: PRIORITY_LANGUAGES,
    sources: [
      { name: 'OpenSubtitles API', enabled: !!OPENSUBTITLES_API_KEY, note: 'Best quality, requires API key' },
      { name: 'SubDL', enabled: true, note: 'Good coverage, free' },
      { name: 'Subscene', enabled: true, note: 'Large database' },
      { name: 'YIFY Subtitles', enabled: true, note: 'Great for movies' },
      { name: 'OpenSubtitles.org', enabled: true, note: 'Web scraping fallback' },
      { name: 'Podnapisi', enabled: true, note: 'European languages' }
    ]
  });
});

module.exports = router;
