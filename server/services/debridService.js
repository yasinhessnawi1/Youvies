/**
 * Debrid Service Integration
 *
 * This module provides integration with debrid services (Real-Debrid, TorBox, AllDebrid)
 * for instant torrent streaming without needing to wait for DHT/peer discovery.
 *
 * HOW DEBRID SERVICES WORK:
 * 1. When ANY user downloads a torrent through the debrid service, it gets cached
 * 2. If you request a torrent that's already cached, you get INSTANT access
 * 3. No need for seeders/peers - content is served from debrid's servers
 * 4. This is why production services (Torrentio, Stremio) work so well
 *
 * SUPPORTED SERVICES:
 * - Real-Debrid: Most popular, ~$4/month, huge cache
 * - TorBox: Has free tier (limited), good API
 * - AllDebrid: Alternative to Real-Debrid
 */

const axios = require('axios');

// Configuration - these should come from environment variables
const DEBRID_CONFIG = {
  realDebrid: {
    apiKey: process.env.REAL_DEBRID_API_KEY || '',
    baseUrl: 'https://api.real-debrid.com/rest/1.0',
    enabled: !!process.env.REAL_DEBRID_API_KEY
  },
  torBox: {
    apiKey: process.env.TORBOX_API_KEY || '',
    baseUrl: 'https://api.torbox.app/v1/api',
    enabled: !!process.env.TORBOX_API_KEY
  },
  allDebrid: {
    apiKey: process.env.ALLDEBRID_API_KEY || '',
    baseUrl: 'https://api.alldebrid.com/v4',
    enabled: !!process.env.ALLDEBRID_API_KEY
  }
};

/**
 * Check if any debrid service is configured
 */
function isDebridEnabled() {
  return DEBRID_CONFIG.realDebrid.enabled ||
         DEBRID_CONFIG.torBox.enabled ||
         DEBRID_CONFIG.allDebrid.enabled;
}

/**
 * Get active debrid services
 */
function getActiveServices() {
  const services = [];
  if (DEBRID_CONFIG.realDebrid.enabled) services.push('realDebrid');
  if (DEBRID_CONFIG.torBox.enabled) services.push('torBox');
  if (DEBRID_CONFIG.allDebrid.enabled) services.push('allDebrid');
  return services;
}

// ============================================================================
// REAL-DEBRID INTEGRATION
// ============================================================================

/**
 * Check if torrent is instantly available on Real-Debrid
 * We skip the availability check and just return false - the torrent will be added
 * when getDebridStreamUrl is called. This avoids rate limiting issues.
 * @param {string} infoHash - The torrent info hash
 * @returns {Promise<{available: boolean, files: Array}>}
 */
async function checkRealDebridAvailability(infoHash) {
  if (!DEBRID_CONFIG.realDebrid.enabled) {
    return { available: false, files: [] };
  }

  // Skip availability check - just try to add the torrent directly
  // Real-Debrid will tell us quickly if it's cached when we add it
  console.log(`🔍 Real-Debrid: Will add torrent directly (skipping pre-check to avoid rate limits)`);
  return { available: false, files: [], skipCheck: true };
}

/**
 * Add magnet to Real-Debrid and get streaming link
 * @param {string} magnetURI - Full magnet URI
 * @param {string} existingTorrentId - Optional existing torrent ID if already in list
 * @returns {Promise<{success: boolean, streamUrl: string, files: Array}>}
 */
async function addToRealDebrid(magnetURI, existingTorrentId = null, episodeInfo = null) {
  if (!DEBRID_CONFIG.realDebrid.enabled) {
    return { success: false, error: 'Real-Debrid not configured' };
  }

  try {
    let torrentId = existingTorrentId;

    // Step 1: Add magnet (if not already in list)
    if (!torrentId) {
      console.log(`📥 Real-Debrid: Adding magnet...`);
      const addResponse = await axios.post(
        `${DEBRID_CONFIG.realDebrid.baseUrl}/torrents/addMagnet`,
        `magnet=${encodeURIComponent(magnetURI)}`,
        {
          headers: {
            'Authorization': `Bearer ${DEBRID_CONFIG.realDebrid.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      torrentId = addResponse.data.id;
    }

    console.log(`📥 Real-Debrid: Using torrent ID ${torrentId}`);

    // Step 2: Get torrent info
    const infoResponse = await axios.get(
      `${DEBRID_CONFIG.realDebrid.baseUrl}/torrents/info/${torrentId}`,
      {
        headers: {
          'Authorization': `Bearer ${DEBRID_CONFIG.realDebrid.apiKey}`
        },
        timeout: 10000
      }
    );

    const torrentInfo = infoResponse.data;

    // Step 3: Select files based on episode info
    let filesToSelect = [];

    if (episodeInfo && episodeInfo.episode) {
      // Try to find the EXACT episode file - be very strict to avoid selecting multiple files
      const episodeNum = parseInt(episodeInfo.episode);
      const paddedEp2 = String(episodeNum).padStart(2, '0');
      const paddedEp3 = String(episodeNum).padStart(3, '0');

      const videoFiles = torrentInfo.files
        .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.path));

      console.log(`🔍 Searching for episode ${episodeNum} among ${videoFiles.length} video files...`);

      // Find exact episode match with strict patterns
      let exactMatch = null;
      for (const file of videoFiles) {
        const fileName = file.path.toLowerCase();

        // Episode patterns - ordered from most specific to least specific
        // Key fix: S01E02 pattern where E comes right after season number (no word boundary)
        const strictPatterns = [
          // Standard TV format: S01E02, S1E2, etc. (MOST COMMON - check first!)
          new RegExp(`s\\d{1,2}e${paddedEp2}(?:[^\\d]|$)`, 'i'),  // S01E02, S1E02
          new RegExp(`s\\d{1,2}e${episodeNum}(?:[^\\d]|$)`, 'i'),  // S01E2, S1E2
          // Anime format with spaces/separators
          new RegExp(`[\\s\\-_\\.\\[\\(]${paddedEp3}[\\s\\-_\\.\\]\\)\\[]`, 'i'),  // " 001 ", "-001.", "[001]"
          new RegExp(`[\\s\\-_\\.\\[\\(]${paddedEp2}[\\s\\-_\\.\\]\\)\\[v]`, 'i'),  // " 01 ", "-01.", "[01]", "01v2"
          // Episode keyword format
          new RegExp(`episode\\s*${paddedEp3}(?:[^\\d]|$)`, 'i'),  // "Episode 001"
          new RegExp(`episode\\s*${paddedEp2}(?:[^\\d]|$)`, 'i'),  // "Episode 01"
          new RegExp(`episode\\s*${episodeNum}(?:[^\\d]|$)`, 'i'),  // "Episode 2"
          // Standalone E format (with word boundary)
          new RegExp(`[^\\d]e${paddedEp2}(?:[^\\d]|$)`, 'i'),  // " E01", "-E01"
          new RegExp(`[^\\d]e${paddedEp3}(?:[^\\d]|$)`, 'i'),  // " E001", "-E001"
          // End of filename patterns
          new RegExp(`[\\s\\-_\\.]${paddedEp2}\\.(?:mkv|mp4|avi|webm)$`, 'i'),  // " 01.mkv"
          new RegExp(`[\\s\\-_\\.]${paddedEp3}\\.(?:mkv|mp4|avi|webm)$`, 'i'),  // " 001.mkv"
        ];

        for (const pattern of strictPatterns) {
          if (pattern.test(fileName)) {
            // Additional check: For S01E02 format, verify the episode number matches exactly
            // Extract all SxxEyy patterns and check if our episode is there
            const sxxEyyMatches = fileName.match(/s\d{1,2}e(\d{1,3})/gi) || [];
            const episodesInName = sxxEyyMatches.map(m => parseInt(m.match(/e(\d+)/i)[1]));
            
            if (episodesInName.length > 0) {
              // If we found SxxEyy patterns, use those for matching
              if (episodesInName.includes(episodeNum)) {
                exactMatch = file;
                console.log(`✅ Found exact match for episode ${episodeNum}: ${file.path}`);
                break;
              }
            } else {
              // Fallback: check all numbers in filename
              const allNumbers = fileName.match(/\d+/g) || [];
              const relevantNumbers = allNumbers.filter(n => {
                const num = parseInt(n);
                return num > 0 && num < 2000;  // Reasonable episode range
              }).map(n => parseInt(n));

              if (relevantNumbers.includes(episodeNum)) {
                exactMatch = file;
                console.log(`✅ Found exact match for episode ${episodeNum}: ${file.path}`);
                break;
              }
            }
          }
        }

        if (exactMatch) break;
      }

      if (exactMatch) {
        filesToSelect = [exactMatch.id];
        console.log(`🎯 Selected 1 file for episode ${episodeNum}: ${exactMatch.path}`);
      } else {
        console.log(`⚠️ No exact match for episode ${episodeNum}, listing first 10 video files:`);
        videoFiles.slice(0, 10).forEach(f => console.log(`   - ${f.path}`));
        console.log(`⚠️ Falling back to all video files`);
      }
    }

    // If no specific episode files found, select all video files
    if (filesToSelect.length === 0) {
      filesToSelect = torrentInfo.files
        .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.path))
        .map(f => f.id);
    }

    if (filesToSelect.length === 0) {
      // Select all files if no video files found
      await axios.post(
        `${DEBRID_CONFIG.realDebrid.baseUrl}/torrents/selectFiles/${torrentId}`,
        'files=all',
        {
          headers: {
            'Authorization': `Bearer ${DEBRID_CONFIG.realDebrid.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    } else {
      await axios.post(
        `${DEBRID_CONFIG.realDebrid.baseUrl}/torrents/selectFiles/${torrentId}`,
        `files=${filesToSelect.join(',')}`,
        {
          headers: {
            'Authorization': `Bearer ${DEBRID_CONFIG.realDebrid.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    }

    // Step 4: Wait for processing and get links
    let attempts = 0;
    let lastStatus = '';
    let downloadingAt0Count = 0;  // Track how long we've been stuck at 0%
    while (attempts < 60) {  // 60 attempts (60 seconds max)
      const statusResponse = await axios.get(
        `${DEBRID_CONFIG.realDebrid.baseUrl}/torrents/info/${torrentId}`,
        {
          headers: {
            'Authorization': `Bearer ${DEBRID_CONFIG.realDebrid.apiKey}`
          }
        }
      );

      const status = statusResponse.data.status;
      const progress = statusResponse.data.progress || 0;

      // Log status changes
      if (status !== lastStatus) {
        console.log(`📊 Real-Debrid status: ${status} (${progress}%)`);
        lastStatus = status;
      }

      if (status === 'downloaded' && statusResponse.data.links && statusResponse.data.links.length > 0) {
        // Get all files info to find subtitles
        const allFiles = statusResponse.data.files || [];
        const subtitleFiles = allFiles.filter(f => 
          /\.(srt|sub|ass|ssa|vtt|idx)$/i.test(f.path)
        );
        
        console.log(`📁 Real-Debrid: Found ${subtitleFiles.length} subtitle files in torrent`);
        
        // Step 5: Unrestrict the first link (video file)
        const link = statusResponse.data.links[0];
        const unrestrictResponse = await axios.post(
          `${DEBRID_CONFIG.realDebrid.baseUrl}/unrestrict/link`,
          `link=${encodeURIComponent(link)}`,
          {
            headers: {
              'Authorization': `Bearer ${DEBRID_CONFIG.realDebrid.apiKey}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        console.log(`✅ Real-Debrid: Stream ready - ${unrestrictResponse.data.filename}`);
        
        // Try to get subtitle links if available
        const subtitles = [];
        for (const subFile of subtitleFiles.slice(0, 10)) { // Limit to 10 subtitle files
          try {
            // Find the corresponding link for this subtitle file
            const subLinkIndex = allFiles.findIndex(f => f.path === subFile.path);
            if (subLinkIndex >= 0 && statusResponse.data.links[subLinkIndex]) {
              const subUnrestrict = await axios.post(
                `${DEBRID_CONFIG.realDebrid.baseUrl}/unrestrict/link`,
                `link=${encodeURIComponent(statusResponse.data.links[subLinkIndex])}`,
                {
                  headers: {
                    'Authorization': `Bearer ${DEBRID_CONFIG.realDebrid.apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                  }
                }
              );
              
              // Detect language from filename
              const filename = subFile.path.toLowerCase();
              let language = 'unknown';
              if (filename.includes('english') || filename.includes('.en.') || filename.includes('.eng.')) language = 'english';
              else if (filename.includes('arabic') || filename.includes('.ar.') || filename.includes('.ara.')) language = 'arabic';
              else if (filename.includes('norwegian') || filename.includes('.no.') || filename.includes('.nor.')) language = 'norwegian';
              else if (filename.includes('german') || filename.includes('.de.') || filename.includes('.ger.')) language = 'german';
              else if (filename.includes('spanish') || filename.includes('.es.') || filename.includes('.spa.')) language = 'spanish';
              else if (filename.includes('french') || filename.includes('.fr.') || filename.includes('.fre.')) language = 'french';
              else if (filename.includes('italian') || filename.includes('.it.') || filename.includes('.ita.')) language = 'italian';
              else if (filename.includes('portuguese') || filename.includes('.pt.') || filename.includes('.por.')) language = 'portuguese';
              else if (filename.includes('russian') || filename.includes('.ru.') || filename.includes('.rus.')) language = 'russian';
              else if (filename.includes('chinese') || filename.includes('.zh.') || filename.includes('.chi.')) language = 'chinese';
              else if (filename.includes('japanese') || filename.includes('.ja.') || filename.includes('.jpn.')) language = 'japanese';
              else if (filename.includes('korean') || filename.includes('.ko.') || filename.includes('.kor.')) language = 'korean';
              
              subtitles.push({
                url: subUnrestrict.data.download,
                filename: subFile.path,
                language: language,
                source: 'Torrent'
              });
              
              console.log(`   📄 Subtitle: ${subFile.path} (${language})`);
            }
          } catch (subError) {
            console.warn(`   ⚠️ Could not get subtitle: ${subFile.path}`);
          }
        }

        return {
          success: true,
          streamUrl: unrestrictResponse.data.download,
          filename: unrestrictResponse.data.filename,
          filesize: unrestrictResponse.data.filesize,
          service: 'realDebrid',
          subtitles: subtitles // Include subtitle files from torrent
        };
      }

      if (status === 'error' || status === 'dead' || status === 'virus') {
        console.log(`❌ Real-Debrid: Torrent failed with status: ${status}`);
        return { success: false, error: `Torrent status: ${status}` };
      }

      // Handle waiting_files_selection - need to select files again
      if (status === 'waiting_files_selection') {
        console.log(`📁 Real-Debrid: Need to select files...`);
        const files = statusResponse.data.files || [];
        const videoFiles = files
          .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.path))
          .map(f => f.id);

        const filesToSelect = videoFiles.length > 0 ? videoFiles.join(',') : 'all';

        await axios.post(
          `${DEBRID_CONFIG.realDebrid.baseUrl}/torrents/selectFiles/${torrentId}`,
          `files=${filesToSelect}`,
          {
            headers: {
              'Authorization': `Bearer ${DEBRID_CONFIG.realDebrid.apiKey}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );
        console.log(`✅ Real-Debrid: Files selected`);
      }

      // If still downloading, show progress and check if stuck at 0%
      if (status === 'downloading') {
        if (progress === 0) {
          downloadingAt0Count++;
          // If stuck at 0% for more than 10 seconds, torrent is likely not cached
          if (downloadingAt0Count >= 10) {
            console.log(`⚠️ Real-Debrid: Torrent not cached (stuck at 0% for ${downloadingAt0Count}s), falling back to P2P`);
            return { success: false, error: 'Torrent not cached in Real-Debrid' };
          }
        } else {
          downloadingAt0Count = 0;  // Reset if making progress
        }

        if (attempts % 5 === 0) {
          console.log(`⏳ Real-Debrid: Downloading... ${progress}%`);
        }
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    return { success: false, error: 'Timeout waiting for Real-Debrid to process torrent' };

  } catch (error) {
    console.log(`❌ Real-Debrid error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// TORBOX INTEGRATION
// ============================================================================

/**
 * Check if torrent is cached on TorBox
 * @param {string} infoHash - The torrent info hash
 * @returns {Promise<{available: boolean}>}
 */
async function checkTorBoxAvailability(infoHash) {
  if (!DEBRID_CONFIG.torBox.enabled) {
    return { available: false };
  }

  try {
    const response = await axios.get(
      `${DEBRID_CONFIG.torBox.baseUrl}/torrents/checkcached`,
      {
        params: { hash: infoHash, format: 'object' },
        headers: {
          'Authorization': `Bearer ${DEBRID_CONFIG.torBox.apiKey}`
        },
        timeout: 5000
      }
    );

    const isCached = response.data?.data?.[infoHash] === true;

    if (isCached) {
      console.log(`✅ TorBox: ${infoHash} is CACHED`);
    }

    return { available: isCached, service: 'torBox' };

  } catch (error) {
    console.log(`⚠️ TorBox check failed: ${error.message}`);
    return { available: false };
  }
}

/**
 * Add magnet to TorBox and get streaming link
 * @param {string} magnetURI - Full magnet URI
 * @returns {Promise<{success: boolean, streamUrl: string}>}
 */
async function addToTorBox(magnetURI) {
  if (!DEBRID_CONFIG.torBox.enabled) {
    return { success: false, error: 'TorBox not configured' };
  }

  try {
    // Step 1: Create torrent
    const formData = new URLSearchParams();
    formData.append('magnet', magnetURI);

    const createResponse = await axios.post(
      `${DEBRID_CONFIG.torBox.baseUrl}/torrents/createtorrent`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${DEBRID_CONFIG.torBox.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    const torrentId = createResponse.data?.data?.torrent_id;
    if (!torrentId) {
      return { success: false, error: 'Failed to create torrent' };
    }

    console.log(`📥 TorBox: Created torrent ${torrentId}`);

    // Step 2: Wait for processing and get download link
    let attempts = 0;
    while (attempts < 30) {
      const infoResponse = await axios.get(
        `${DEBRID_CONFIG.torBox.baseUrl}/torrents/mylist`,
        {
          params: { id: torrentId },
          headers: {
            'Authorization': `Bearer ${DEBRID_CONFIG.torBox.apiKey}`
          }
        }
      );

      const torrent = infoResponse.data?.data?.[0];

      if (torrent?.download_finished && torrent?.files) {
        // Find largest video file
        const videoFile = torrent.files
          .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name))
          .sort((a, b) => b.size - a.size)[0];

        if (videoFile) {
          // Get download link
          const linkResponse = await axios.get(
            `${DEBRID_CONFIG.torBox.baseUrl}/torrents/requestdl`,
            {
              params: {
                token: DEBRID_CONFIG.torBox.apiKey,
                torrent_id: torrentId,
                file_id: videoFile.id
              }
            }
          );

          const downloadUrl = linkResponse.data?.data;

          if (downloadUrl) {
            console.log(`✅ TorBox: Stream ready - ${videoFile.name}`);
            return {
              success: true,
              streamUrl: downloadUrl,
              filename: videoFile.name,
              filesize: videoFile.size,
              service: 'torBox'
            };
          }
        }
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    return { success: false, error: 'Timeout waiting for TorBox to process torrent' };

  } catch (error) {
    console.log(`❌ TorBox error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// UNIFIED DEBRID INTERFACE
// ============================================================================

/**
 * Check instant availability across all configured debrid services
 * @param {string} infoHash - The torrent info hash
 * @returns {Promise<{available: boolean, service: string, files: Array}>}
 */
async function checkInstantAvailability(infoHash) {
  const hash = infoHash.toLowerCase();

  // Check all services in parallel
  const checks = [];

  if (DEBRID_CONFIG.realDebrid.enabled) {
    checks.push(checkRealDebridAvailability(hash));
  }
  if (DEBRID_CONFIG.torBox.enabled) {
    checks.push(checkTorBoxAvailability(hash));
  }

  if (checks.length === 0) {
    return { available: false, reason: 'No debrid services configured' };
  }

  const results = await Promise.all(checks);

  // Return first available result
  for (const result of results) {
    if (result.available) {
      return result;
    }
  }

  return { available: false };
}

/**
 * Get streaming URL from debrid service
 * @param {string} magnetURI - Full magnet URI
 * @param {string} preferredService - Preferred service to use
 * @param {string} existingTorrentId - Optional existing torrent ID (for Real-Debrid)
 * @returns {Promise<{success: boolean, streamUrl: string, service: string}>}
 */
async function getDebridStreamUrl(magnetURI, preferredService = null, existingTorrentId = null, episodeInfo = null) {
  // Try preferred service first
  if (preferredService === 'realDebrid' && DEBRID_CONFIG.realDebrid.enabled) {
    const result = await addToRealDebrid(magnetURI, existingTorrentId, episodeInfo);
    if (result.success) return result;
  }

  if (preferredService === 'torBox' && DEBRID_CONFIG.torBox.enabled) {
    const result = await addToTorBox(magnetURI);
    if (result.success) return result;
  }

  // Try all services
  if (DEBRID_CONFIG.realDebrid.enabled) {
    const result = await addToRealDebrid(magnetURI, existingTorrentId, episodeInfo);
    if (result.success) return result;
  }

  if (DEBRID_CONFIG.torBox.enabled) {
    const result = await addToTorBox(magnetURI);
    if (result.success) return result;
  }

  return { success: false, error: 'All debrid services failed' };
}

/**
 * Check multiple hashes for instant availability (batch check)
 * @param {string[]} infoHashes - Array of info hashes
 * @returns {Promise<Object>} - Map of hash -> availability
 */
async function batchCheckAvailability(infoHashes) {
  const results = {};

  // For Real-Debrid, we can check multiple hashes at once
  if (DEBRID_CONFIG.realDebrid.enabled) {
    try {
      const hashString = infoHashes.map(h => h.toLowerCase()).join('/');
      const response = await axios.get(
        `${DEBRID_CONFIG.realDebrid.baseUrl}/torrents/instantAvailability/${hashString}`,
        {
          headers: {
            'Authorization': `Bearer ${DEBRID_CONFIG.realDebrid.apiKey}`
          },
          timeout: 10000
        }
      );

      for (const hash of infoHashes) {
        const hashLower = hash.toLowerCase();
        const data = response.data[hashLower];

        if (data && data.rd && data.rd.length > 0) {
          results[hashLower] = { available: true, service: 'realDebrid' };
        } else {
          results[hashLower] = { available: false };
        }
      }

      return results;

    } catch (error) {
      console.log(`⚠️ Real-Debrid batch check failed: ${error.message}`);
    }
  }

  // Fallback to individual checks
  for (const hash of infoHashes) {
    results[hash.toLowerCase()] = await checkInstantAvailability(hash);
  }

  return results;
}

module.exports = {
  isDebridEnabled,
  getActiveServices,
  checkInstantAvailability,
  getDebridStreamUrl,
  batchCheckAvailability,
  checkRealDebridAvailability,
  addToRealDebrid,
  checkTorBoxAvailability,
  addToTorBox,
  DEBRID_CONFIG
};
