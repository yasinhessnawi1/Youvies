const express = require('express');
const router = express.Router();
const path = require('path');
const { fetchMetadata } = require('../services/metadataFetcher');
const debridService = require('../services/debridService');

// Helper function to detect browser-incompatible audio codecs in filename
// Browsers DO NOT support: DTS, DDP/E-AC3, TrueHD, Atmos, FLAC (in some containers)
// Browsers DO support: AAC, AC3 (DD), MP3, Opus, Vorbis
function detectIncompatibleAudio(filename) {
  const name = filename.toLowerCase();
  
  // DDP / E-AC3 / Dolby Digital Plus - NOT browser compatible!
  if (name.includes('ddp') || name.includes('dd+') || name.includes('eac3') || 
      name.includes('e-ac3') || name.includes('dolby digital plus') ||
      (name.includes('ddp') && name.includes('5.1')) ||
      (name.includes('ddp') && name.includes('7.1'))) {
    return { codec: 'DDP/E-AC3', needsTranscode: true };
  }
  
  // Atmos - NOT browser compatible (needs special decoder)
  if (name.includes('atmos')) {
    return { codec: 'Atmos', needsTranscode: true };
  }
  
  // TrueHD - NOT browser compatible
  if (name.includes('truehd') || name.includes('true-hd') || name.includes('true hd')) {
    return { codec: 'TrueHD', needsTranscode: true };
  }
  
  // DTS variants - NOT browser compatible
  if (name.includes('dts-hd') || name.includes('dtshd') || name.includes('dts:x') ||
      name.includes('dts-x') || name.includes('dts hd')) {
    return { codec: 'DTS-HD', needsTranscode: true };
  }
  if (name.includes('dts') && !name.includes('sdts')) {
    return { codec: 'DTS', needsTranscode: true };
  }
  
  // Check for ambiguous cases where codec isn't clear
  // "5.1" or "7.1" without explicit codec - might be DDP
  // Be conservative - only transcode if we're fairly certain
  
  // Browser-compatible codecs - no transcode needed
  if (name.includes('aac') || name.includes('ac3') || name.includes('mp3') ||
      name.includes('opus') || name.includes('vorbis') ||
      (name.includes('dd') && name.includes('5.1') && !name.includes('ddp'))) {
    return null; // Compatible, no transcode
  }
  
  return null; // Unknown codec, try without transcode first
}

// MIME type mapping for video/audio files
const mimeTypes = {
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mkv': 'video/x-matroska',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  'm4v': 'video/mp4',
  'ts': 'video/mp2t',
  'mts': 'video/mp2t',
  'mpg': 'video/mpeg',
  'mpeg': 'video/mpeg',
  'ogv': 'video/ogg',
  '3gp': 'video/3gpp',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac'
};

// POST /api/torrents/stream - Add torrent using hybrid metadata approach
router.post('/', async (req, res) => {
  res.setTimeout(0); // No timeout for this endpoint

  try {
    const { magnetURI, episodeInfo } = req.body;

    if (!magnetURI) {
      return res.status(400).json({ error: 'magnetURI is required' });
    }

    if (!magnetURI.startsWith('magnet:')) {
      return res.status(400).json({ error: 'Invalid magnet URI' });
    }

    console.log('📥 Adding torrent with hybrid metadata fetch...');
    console.log('🧲 Magnet URI:', magnetURI.substring(0, 100) + '...');

    const webTorrentClient = req.webTorrentClient;
    const torrentAddOptions = req.torrentAddOptions;
    const torrents = req.torrents;
    const torrentIds = req.torrentIds;
    const torrentNames = req.torrentNames;
    const universalTorrentResolver = req.universalTorrentResolver;

    // Extract info hash from magnet URI
    const infoHashMatch = magnetURI.match(/btih:([a-f0-9]{40})/i);
    if (!infoHashMatch) {
      return res.status(400).json({ error: 'Invalid magnet URI: missing info hash' });
    }

    const infoHash = infoHashMatch[1].toLowerCase();

    // Check if torrent already exists
    let existingTorrent = universalTorrentResolver(magnetURI) || universalTorrentResolver(infoHash);

    // Also check WebTorrent client directly by info hash
    if (!existingTorrent) {
      existingTorrent = webTorrentClient.get(infoHash);
    }

    if (existingTorrent) {
      console.log(`♻️  Torrent already exists: ${existingTorrent.name}`);

      // Wait for torrent to have files if it doesn't already
      if (!existingTorrent.files || existingTorrent.files.length === 0) {
        console.log('⏳ Existing torrent has no files yet, waiting...');

        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log('⚠️  Timeout waiting for existing torrent files');
            resolve();
          }, 10000); // 10 second timeout

          if (existingTorrent.files && existingTorrent.files.length > 0) {
            clearTimeout(timeout);
            resolve();
          } else {
            const onReady = () => {
              clearTimeout(timeout);
              existingTorrent.removeListener('metadata', onReady);
              console.log(`✅ Existing torrent now has ${existingTorrent.files.length} files`);
              resolve();
            };

            existingTorrent.once('ready', onReady);
            existingTorrent.once('metadata', onReady);
          }
        });
      }

      // Check if we actually have files now
      if (!existingTorrent.files || existingTorrent.files.length === 0) {
        console.warn('⚠️ Existing torrent still has no files after waiting');
        return res.status(503).json({
          error: 'Torrent metadata not available',
          message: 'The torrent exists but has no file information. Try again in a moment.'
        });
      }

      // IMPORTANT: Even for existing torrents, we need to find the correct episode file!
      let selectedFileIndex = null;
      if (episodeInfo && episodeInfo.episode) {
        const episodeNum = parseInt(episodeInfo.episode);
        const paddedEp2 = String(episodeNum).padStart(2, '0');
        const paddedEp3 = String(episodeNum).padStart(3, '0');
        console.log(`🎯 Looking for episode ${episodeNum} in existing torrent with ${existingTorrent.files.length} files...`);

        // Find video files that match the episode number
        const videoFiles = existingTorrent.files
          .map((f, i) => ({ file: f, index: i }))
          .filter(({ file }) => /\.(mp4|mkv|avi|webm|mov)$/i.test(file.name));

        // Try to find the exact episode file
        for (const { file, index } of videoFiles) {
          const fileName = file.name.toLowerCase();

          // Episode patterns - ordered from most specific to least specific
          const patterns = [
            // Standard TV format: S01E02, S1E2, etc. (MOST COMMON)
            new RegExp(`s\\d{1,2}e${paddedEp2}(?:[^\\d]|$)`, 'i'),
            new RegExp(`s\\d{1,2}e${episodeNum}(?:[^\\d]|$)`, 'i'),
            // Anime format with spaces/separators
            new RegExp(`[\\s\\-_\\.\\[\\(]${paddedEp3}[\\s\\-_\\.\\]\\)\\[]`, 'i'),
            new RegExp(`[\\s\\-_\\.\\[\\(]${paddedEp2}[\\s\\-_\\.\\]\\)\\[v]`, 'i'),
            // Episode keyword format
            new RegExp(`episode\\s*${paddedEp3}(?:[^\\d]|$)`, 'i'),
            new RegExp(`episode\\s*${paddedEp2}(?:[^\\d]|$)`, 'i'),
            new RegExp(`episode\\s*${episodeNum}(?:[^\\d]|$)`, 'i'),
            // Standalone E format
            new RegExp(`[^\\d]e${paddedEp2}(?:[^\\d]|$)`, 'i'),
            new RegExp(`[^\\d]e${paddedEp3}(?:[^\\d]|$)`, 'i'),
          ];

          for (const pattern of patterns) {
            if (pattern.test(fileName)) {
              // Additional check: For SxxEyy format, verify episode number
              const sxxEyyMatches = fileName.match(/s\d{1,2}e(\d{1,3})/gi) || [];
              const episodesInName = sxxEyyMatches.map(m => parseInt(m.match(/e(\d+)/i)[1]));
              
              if (episodesInName.length > 0) {
                if (episodesInName.includes(episodeNum)) {
                  console.log(`✅ Found episode ${episodeNum} in existing torrent: ${file.name} (index ${index})`);
                  selectedFileIndex = index;
                  break;
                }
              } else {
                console.log(`✅ Found episode ${episodeNum} in existing torrent: ${file.name} (index ${index})`);
                selectedFileIndex = index;
                break;
              }
            }
          }

          if (selectedFileIndex !== null) break;
        }

        if (selectedFileIndex === null) {
          console.log(`⚠️ Could not find episode ${episodeNum} in existing torrent, listing video files:`);
          videoFiles.slice(0, 10).forEach(({ file, index }) => {
            console.log(`   [${index}] ${file.name}`);
          });
        }
      }

      return res.json({
        success: true,
        data: {
          hash: infoHash,
          name: existingTorrent.name,
          files: existingTorrent.files.map((f, i) => ({
            index: i,
            name: f.name,
            size: f.length,
            path: f.path,
            type: mimeTypes[path.extname(f.name).toLowerCase().slice(1)] || 'application/octet-stream'
          })),
          selectedFileIndex: selectedFileIndex,  // Pass the correct episode file index
          status: 'ready',
          peers: existingTorrent.numPeers || 0
        }
      });
    }

    // STEP 1: Try debrid service first (Real-Debrid will download if cached)
    if (debridService.isDebridEnabled()) {
      console.log('🚀 Trying Real-Debrid for streaming...');

      // Directly try to add and stream from Real-Debrid
      const debridResult = await debridService.getDebridStreamUrl(magnetURI, null, null, episodeInfo);

      if (debridResult.success) {
        console.log(`🎬 Debrid stream ready: ${debridResult.filename}`);

        // Check if audio needs transcoding for browser compatibility
        // Browser-INCOMPATIBLE audio codecs: DTS, DDP/E-AC3, TrueHD, Atmos
        const filename = (debridResult.filename || '').toLowerCase();
        const needsAudioTranscode = detectIncompatibleAudio(filename);
        
        if (needsAudioTranscode) {
          console.log(`🎵 Audio transcode needed: ${needsAudioTranscode.codec} detected in "${debridResult.filename}"`);
        }

        // Create proxied URL to avoid CORS issues
        // Use full URL so frontend video element can access it
        const baseUrl = `http://${req.headers.host}`;
        let proxiedUrl = `${baseUrl}/api/torrents/stream/debrid-proxy?url=${encodeURIComponent(debridResult.streamUrl)}`;
        
        // Add transcode parameter if audio is browser-incompatible
        if (needsAudioTranscode) {
          proxiedUrl += '&transcode=true';
        }

        // Return debrid stream URL - proxied through our server to avoid CORS
        return res.json({
          success: true,
          data: {
            hash: infoHash,
            name: debridResult.filename,
            streamUrl: proxiedUrl,  // Proxied URL to avoid CORS!
            originalUrl: debridResult.streamUrl,  // Keep original for debugging
            streamType: 'debrid',
            service: debridResult.service,
            audioTranscode: needsAudioTranscode ? needsAudioTranscode.codec : null, // Indicate if transcoding
            files: [{
              index: 0,
              name: debridResult.filename,
              size: debridResult.filesize,
              type: mimeTypes[path.extname(debridResult.filename).toLowerCase().slice(1)] || 'video/mp4'
            }],
            // Include subtitle files from the torrent if available
            subtitles: (debridResult.subtitles || []).map(sub => ({
              url: sub.url,
              language: sub.language,
              filename: sub.filename,
              source: 'Torrent'
            })),
            status: 'ready',
            peers: 'N/A (debrid)'
          }
        });
      } else {
        console.log(`⚠️ Real-Debrid failed: ${debridResult.error}, falling back to P2P...`);
      }
    }

    // STEP 2: HYBRID METADATA FETCH - Try cache API first, fall back to DHT
    let metadata;
    try {
      metadata = await fetchMetadata(webTorrentClient, magnetURI, infoHash);
      console.log(`✅ Metadata fetched: ${metadata.name}`);
    } catch (error) {
      console.error(`❌ Metadata fetch failed: ${error.message}`);
      return res.status(503).json({
        error: 'Metadata fetch failed',
        message: 'Unable to fetch torrent metadata. The torrent may be dead or have no seeders.'
      });
    }

    // Now add the torrent to WebTorrent
    // If we have the .torrent file from cache, use it (instant metadata!)
    // Otherwise fall back to magnet URI (requires DHT/tracker connection)
    console.log('⏳ Adding torrent to WebTorrent client...');

    let torrent;
    if (metadata.torrentFile) {
      console.log('✅ Using .torrent file from cache (instant!)');
      // Add using .torrent file - no need to connect to peers for metadata
      torrent = webTorrentClient.add(metadata.torrentFile, torrentAddOptions);
    } else {
      console.log('⏳ Using magnet URI (requires peer connection)');
      // Extract trackers from magnet and merge with defaults
      const magnetTrackers = [];
      const trMatch = magnetURI.matchAll(/&tr=([^&]+)/g);
      for (const match of trMatch) {
        try {
          const tracker = decodeURIComponent(match[1]);
          if (tracker && !magnetTrackers.includes(tracker)) {
            magnetTrackers.push(tracker);
          }
        } catch (e) {}
      }

      const enhancedOptions = {
        ...torrentAddOptions,
        announce: [...magnetTrackers, ...torrentAddOptions.announce]
      };

      console.log(`📡 Using ${enhancedOptions.announce.length} trackers`);
      torrent = webTorrentClient.add(magnetURI, enhancedOptions);
    }

    // Store references immediately
    console.log(`💾 Storing torrent: ${infoHash} -> ${metadata.name}`);
    torrents[infoHash] = torrent;
    torrentIds[infoHash] = magnetURI;
    torrentNames[infoHash] = metadata.name;
    req.hashToMagnet[infoHash] = magnetURI;
    req.magnetToHash[magnetURI] = infoHash;

    // Add error handling for torrent destruction
    torrent.on('error', (err) => {
      console.error(`❌ Torrent error for ${infoHash}: ${err.message}`);
    });

    torrent.on('done', () => {
      console.log(`✅ Torrent completed: ${infoHash} (${metadata.name})`);
    });

    // Wait for WebTorrent to be ready
    // When using .torrent file, this should be instant (< 1s)
    // When using magnet URI, this may take 5-15s
    console.log('⏳ Waiting for WebTorrent to initialize torrent...');

    const waitForReady = new Promise((resolve) => {
      const timeoutDuration = metadata.torrentFile ? 5000 : 15000;
      const timeout = setTimeout(() => {
        console.log(`⚠️  Torrent ready timeout after ${timeoutDuration/1000}s`);
        resolve();
      }, timeoutDuration);

      // Check if already ready
      if (torrent.files && torrent.files.length > 0) {
        clearTimeout(timeout);
        resolve();
      } else {
        // Wait for either 'ready' or 'metadata' event
        const onReady = () => {
          clearTimeout(timeout);
          torrent.removeListener('metadata', onReady);
          console.log(`✅ WebTorrent ready: ${torrent.files.length} files`);
          resolve();
        };

        torrent.once('ready', onReady);
        torrent.once('metadata', onReady);

        torrent.once('error', (err) => {
          clearTimeout(timeout);
          console.error(`❌ Torrent error: ${err.message}`);
          resolve();
        });
      }
    });

    await waitForReady;

    // If we had cached metadata and torrent is ready, we can return quickly
    if (metadata.files && metadata.files.length > 0 && torrent.files && torrent.files.length > 0) {
      console.log(`✅ Torrent ready for streaming (used cached metadata)`);
      console.log(`   Hash: ${infoHash}`);
      console.log(`   Files: ${torrent.files.length}`);
      console.log(`   Peers: ${torrent.numPeers || 0}`);

      // If episodeInfo is provided, find the correct file for that episode
      let selectedFileIndex = null;
      if (episodeInfo && episodeInfo.episode) {
        const episodeNum = parseInt(episodeInfo.episode);
        const paddedEp2 = String(episodeNum).padStart(2, '0');
        const paddedEp3 = String(episodeNum).padStart(3, '0');
        console.log(`🎯 Looking for episode ${episodeNum} in ${torrent.files.length} files...`);

        // Find video files that match the episode number
        const videoFiles = torrent.files
          .map((f, i) => ({ file: f, index: i }))
          .filter(({ file }) => /\.(mp4|mkv|avi|webm|mov)$/i.test(file.name));

        // Try to find the exact episode file
        for (const { file, index } of videoFiles) {
          const fileName = file.name.toLowerCase();

          // Episode patterns - ordered from most specific to least specific
          // Key fix: S01E02 pattern where E comes right after season number
          const patterns = [
            // Standard TV format: S01E02, S1E2, etc. (MOST COMMON - check first!)
            new RegExp(`s\\d{1,2}e${paddedEp2}(?:[^\\d]|$)`, 'i'),  // S01E02, S1E02
            new RegExp(`s\\d{1,2}e${episodeNum}(?:[^\\d]|$)`, 'i'),  // S01E2, S1E2
            // Anime format with spaces/separators
            new RegExp(`[\\s\\-_\\.\\[\\(]${paddedEp3}[\\s\\-_\\.\\]\\)\\[]`, 'i'),  // " 001 ", "-001.", "[001]"
            new RegExp(`[\\s\\-_\\.\\[\\(]${paddedEp2}[\\s\\-_\\.\\]\\)\\[v]`, 'i'),  // " 01 ", "-01.", "[01]"
            // Episode keyword format
            new RegExp(`episode\\s*${paddedEp3}(?:[^\\d]|$)`, 'i'),  // "Episode 001"
            new RegExp(`episode\\s*${paddedEp2}(?:[^\\d]|$)`, 'i'),  // "Episode 01"
            new RegExp(`episode\\s*${episodeNum}(?:[^\\d]|$)`, 'i'),  // "Episode 2"
            // Standalone E format (with non-digit before)
            new RegExp(`[^\\d]e${paddedEp2}(?:[^\\d]|$)`, 'i'),  // " E01", "-E01"
            new RegExp(`[^\\d]e${paddedEp3}(?:[^\\d]|$)`, 'i'),  // " E001", "-E001"
            // End of filename patterns
            new RegExp(`[\\s\\-_\\.]${paddedEp2}\\.(?:mkv|mp4|avi|webm)$`, 'i'),  // " 01.mkv"
            new RegExp(`[\\s\\-_\\.]${paddedEp3}\\.(?:mkv|mp4|avi|webm)$`, 'i'),  // " 001.mkv"
          ];

          for (const pattern of patterns) {
            if (pattern.test(fileName)) {
              // Additional check: For S01E02 format, verify the episode number matches exactly
              const sxxEyyMatches = fileName.match(/s\d{1,2}e(\d{1,3})/gi) || [];
              const episodesInName = sxxEyyMatches.map(m => parseInt(m.match(/e(\d+)/i)[1]));
              
              if (episodesInName.length > 0) {
                // If we found SxxEyy patterns, use those for matching
                if (episodesInName.includes(episodeNum)) {
                  console.log(`✅ Found episode ${episodeNum} file: ${file.name} (index ${index})`);
                  selectedFileIndex = index;
                  break;
                }
              } else {
                // Fallback: file matched a pattern, accept it
                console.log(`✅ Found episode ${episodeNum} file: ${file.name} (index ${index})`);
                selectedFileIndex = index;
                break;
              }
            }
          }

          if (selectedFileIndex !== null) break;
        }

        if (selectedFileIndex === null) {
          console.log(`⚠️ Could not find exact match for episode ${episodeNum}, listing video files:`);
          videoFiles.slice(0, 10).forEach(({ file, index }) => {
            console.log(`   [${index}] ${file.name}`);
          });
        }
      }

      return res.json({
        success: true,
        data: {
          hash: infoHash,
          name: torrent.name,
          files: torrent.files.map((f, i) => ({
            index: i,
            name: f.name,
            size: f.length,
            path: f.path,
            type: mimeTypes[path.extname(f.name).toLowerCase().slice(1)] || 'application/octet-stream'
          })),
          selectedFileIndex: selectedFileIndex,  // Pass the correct episode file index
          status: 'ready',
          peers: torrent.numPeers || 0
        }
      });
    }

    // No cached metadata or torrent not ready - wait longer for full metadata
    console.log('⏳ Waiting for WebTorrent to fetch full metadata from DHT...');

    const waitForMetadata = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⚠️  Metadata event timeout after 30s');
        resolve();
      }, 30000);

      if (torrent.files && torrent.files.length > 0) {
        clearTimeout(timeout);
        resolve();
      } else {
        torrent.once('metadata', () => {
          clearTimeout(timeout);
          console.log(`✅ Full metadata received: ${torrent.files.length} files`);
          resolve();
        });

        torrent.once('error', (err) => {
          clearTimeout(timeout);
          console.error(`❌ Torrent error: ${err.message}`);
          resolve();
        });
      }
    });

    await waitForMetadata;

    console.log(`✅ Torrent ready: ${torrent.name}`);
    console.log(`   Hash: ${infoHash}`);
    console.log(`   Files: ${torrent.files.length}`);
    console.log(`   Peers: ${torrent.numPeers}`);

    res.json({
      success: true,
      data: {
        hash: infoHash,
        name: torrent.name,
        files: torrent.files.map((f, i) => ({
          index: i,
          name: f.name,
          size: f.length,
          path: f.path,
          type: mimeTypes[path.extname(f.name).toLowerCase().slice(1)] || 'application/octet-stream'
        })),
        status: 'ready',
        peers: torrent.numPeers
      }
    });

  } catch (error) {
    console.error('❌ Error adding torrent:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to add torrent', message: error.message });
    }
  }
});

// GET /api/torrents/stream/:hash/files - Get files in torrent
router.get('/:hash/files', (req, res) => {
  try {
    const { hash } = req.params;
    const torrents = req.torrents;
    const torrentNames = req.torrentNames;

    const torrent = torrents[hash];

    if (!torrent) {
      return res.status(404).json({ error: 'Torrent not found' });
    }

    const files = torrent.files.map((f, i) => ({
      index: i,
      name: f.name,
      size: f.length,
      path: f.path,
      type: mimeTypes[path.extname(f.name).toLowerCase().slice(1)] || 'application/octet-stream'
    }));

    res.json({
      success: true,
      data: {
        hash,
        name: torrentNames[hash] || 'Unknown',
        files
      }
    });

  } catch (error) {
    console.error('❌ Error getting files:', error);
    res.status(500).json({ error: 'Failed to get files', message: error.message });
  }
});

// GET /api/torrents/stream/:hash/files/:index/stream - Stream file
router.get('/:hash/files/:index/stream', async (req, res) => {
  const requestId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const { hash, index } = req.params;
    const torrents = req.torrents;

    console.log(`🔍 [${requestId}] Looking for torrent: ${hash}`);
    console.log(`📊 [${requestId}] Available torrents: ${Object.keys(torrents).length}`);

    let torrent = torrents[hash];

    if (!torrent) {
      console.log(`❌ [${requestId}] Torrent not found in storage: ${hash}`);
      console.log(`📋 [${requestId}] Available hashes:`, Object.keys(torrents));

      // Try to find by WebTorrent client directly
      const webTorrentClient = req.webTorrentClient;
      const wtTorrent = webTorrentClient.get(hash);
      if (wtTorrent) {
        console.log(`🔄 [${requestId}] Found in WebTorrent client but not in storage, re-syncing`);
        // Re-sync the torrent to storage
        torrents[hash] = wtTorrent;
        req.torrentIds[hash] = req.hashToMagnet[hash] || `magnet:?xt=urn:btih:${hash}`;
        req.torrentNames[hash] = wtTorrent.name || 'Unknown';
        torrent = wtTorrent;
        console.log(`✅ [${requestId}] Re-synced torrent, continuing with stream`);
      } else {
        return res.status(404).json({ error: 'Torrent not found' });
      }
    }

    // Check if torrent is still active and has files
    if (!torrent.files || torrent.files.length === 0) {
      console.log(`❌ [${requestId}] Torrent has no files: ${hash}`);
      return res.status(503).json({
        error: 'Torrent not ready',
        message: 'The torrent is not fully loaded yet. Please wait a moment and try again.'
      });
    }

    const fileIndex = parseInt(index, 10);
    const file = torrent.files[fileIndex];

    if (!file) {
      console.log(`❌ [${requestId}] File not found: index ${fileIndex} (available: ${torrent.files.length} files)`);
      return res.status(404).json({
        error: 'File not found',
        message: `File index ${fileIndex} not found. Available files: ${torrent.files.length}`
      });
    }

    console.log(`🎬 [${requestId}] Streaming: ${file.name}`);
    console.log(`📊 [${requestId}] Torrent progress: ${(torrent.progress * 100).toFixed(1)}%, Peers: ${torrent.numPeers}`);
    console.log(`🔧 [${requestId}] Torrent properties: pieceLength=${torrent.pieceLength}, pieces=${torrent.pieces?.length}, critical=${!!torrent.critical}`);

    // Check if torrent has enough data for streaming
    const downloadedPercent = torrent.progress * 100;
    const hasPeers = torrent.numPeers > 0;
    const hasData = downloadedPercent > 0.5; // Require at least 0.5% downloaded

    if (!hasPeers && !hasData) {
      console.log(`⚠️  [${requestId}] Torrent has no peers and insufficient data (${downloadedPercent.toFixed(1)}% downloaded)`);
      return res.status(503).json({
        error: 'Torrent not ready',
        message: 'The torrent has no peers and insufficient data for streaming. Please wait for peers to connect or try a different torrent.',
        details: {
          peers: torrent.numPeers,
          downloadedPercent: downloadedPercent.toFixed(1),
          hasPeers,
          hasData
        }
      });
    }

    if (!hasPeers) {
      console.log(`⚠️  [${requestId}] Torrent has no peers but some data (${downloadedPercent.toFixed(1)}% downloaded) - attempting stream anyway`);
    }

    // Select this file for downloading with high priority
    file.select();

    // Deselect other files to focus bandwidth
    torrent.files.forEach((f, idx) => {
      if (idx !== fileIndex) {
        f.deselect();
      }
    });

    // Determine content type
    const ext = path.extname(file.name).toLowerCase().slice(1);
    const contentType = mimeTypes[ext] || 'video/mp4';

    // Parse range header
    let start = 0;
    let end = file.length - 1;
    let isRangeRequest = false;

    if (req.headers.range) {
      try {
        isRangeRequest = true;
        const parts = req.headers.range.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10);

        if (parts[1] && parts[1].trim() !== '') {
          end = parseInt(parts[1], 10);
        }

        // Validate range
        if (isNaN(start) || isNaN(end) || start < 0 || end >= file.length || start > end) {
          throw new Error('Invalid range');
        }
      } catch (error) {
        console.log(`⚠️  [${requestId}] Invalid range: ${req.headers.range}`);
        start = 0;
        end = file.length - 1;
        isRangeRequest = false;
      }
    }

    const chunkSize = (end - start) + 1;

    // 🚀 OPTIMIZED BUFFERING: Simpler and more reliable piece prioritization
    // Based on seedbox-lite's proven approach
    if (torrent && file._torrent && typeof torrent.pieceLength === 'number') {
      try {
        const pieceLength = torrent.pieceLength;

        // CRITICAL FIX: Calculate piece number relative to file's position in torrent
        // file.offset is the byte offset where this file starts in the torrent
        // start is the byte offset within the HTTP range request
        const fileOffset = file.offset || 0;
        const absoluteBytePosition = fileOffset + start;
        const startPiece = Math.floor(absoluteBytePosition / pieceLength);

        if (start === 0 || !isRangeRequest) {
          // Initial playback: prioritize first few pieces for instant start
          const initialPieces = Math.min(10, torrent.pieces ? torrent.pieces.length - 1 : 10);

          if (torrent.critical) {
            torrent.critical(file._startPiece || 0, (file._startPiece || 0) + initialPieces);
            console.log(`⚡ [${requestId}] Prioritizing first ${initialPieces} pieces for instant playback`);
          }
        } else {
          // Seeking: prioritize just 3-5 pieces ahead for faster seeking
          // This is more reliable than large buffers which can stall
          const seekPiecesAhead = 3;
          const endPiece = file._endPiece || torrent.pieces.length;

          // Ensure we don't exceed file boundaries
          if (startPiece >= (file._startPiece || 0) && startPiece < endPiece) {
            for (let i = 0; i < seekPiecesAhead && (startPiece + i) < endPiece; i++) {
              if (file._torrent.select && typeof file._torrent.select === 'function') {
                try {
                  file._torrent.select(startPiece + i, startPiece + i + 1, 1); // Priority 1
                } catch (selectErr) {
                  // Fallback to torrent.critical if select fails
                  if (torrent.critical) {
                    torrent.critical(startPiece, Math.min(startPiece + seekPiecesAhead, endPiece));
                  }
                  break;
                }
              }
            }

            console.log(`⚡ [${requestId}] Prioritizing ${seekPiecesAhead} pieces at seek position (piece ${startPiece}, byte ${absoluteBytePosition})`);
          } else {
            console.log(`⚠️  [${requestId}] Seek piece ${startPiece} out of file bounds [${file._startPiece || 0}, ${endPiece}), using file bounds`);
            if (torrent.critical) {
              torrent.critical(file._startPiece || 0, Math.min((file._startPiece || 0) + seekPiecesAhead, endPiece));
            }
          }
        }
      } catch (error) {
        console.log(`⚠️  [${requestId}] Piece prioritization error (non-critical): ${error.message}`);
      }
    }

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');

    if (isRangeRequest) {
      res.setHeader('Content-Range', `bytes ${start}-${end}/${file.length}`);
      res.status(206);
    } else {
      res.status(200);
    }

    // Create read stream
    const stream = file.createReadStream({ start, end });

    // Handle errors
    stream.on('error', (err) => {
      console.log(`❌ [${requestId}] Stream error: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Stream error',
          message: 'Failed to create video stream. The torrent may be corrupted or have connectivity issues.',
          details: err.message
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log(`🔌 [${requestId}] Client disconnected, destroying stream`);
      stream.destroy();
    });

    req.on('aborted', () => {
      console.log(`🔌 [${requestId}] Request aborted, destroying stream`);
      stream.destroy();
    });

    // Stream the file
    console.log(`▶️  [${requestId}] Starting stream for ${file.name} (${file.length} bytes)`);
    stream.pipe(res);

  } catch (error) {
    console.error(`❌ [${requestId}] Streaming error:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming error', message: error.message });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

// GET /api/torrents/stream/:hash/stats - Get torrent stats
router.get('/:hash/stats', (req, res) => {
  try {
    const { hash } = req.params;
    const torrents = req.torrents;
    const torrentNames = req.torrentNames;

    const torrent = torrents[hash];

    if (!torrent) {
      return res.status(404).json({ error: 'Torrent not found' });
    }

    res.json({
      success: true,
      data: {
        hash,
        name: torrentNames[hash] || 'Unknown',
        downloaded: torrent.downloaded,
        uploaded: torrent.uploaded,
        downloadSpeed: torrent.downloadSpeed,
        uploadSpeed: torrent.uploadSpeed,
        numPeers: torrent.numPeers,
        progress: torrent.progress,
        status: 'downloading'
      }
    });

  } catch (error) {
    console.error('❌ Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats', message: error.message });
  }
});

// DELETE /api/torrents/stream/:hash - Remove torrent
router.delete('/:hash', (req, res) => {
  try {
    const { hash } = req.params;

    const torrents = req.torrents;
    const torrentIds = req.torrentIds;
    const torrentNames = req.torrentNames;

    const torrent = torrents[hash];

    if (!torrent) {
      return res.status(404).json({ error: 'Torrent not found' });
    }

    console.log(`🗑️  Removing torrent: ${torrentNames[hash]}`);

    // Destroy the torrent
    torrent.destroy(() => {
      delete torrents[hash];
      delete torrentIds[hash];
      delete torrentNames[hash];

      res.json({ success: true, message: 'Torrent removed successfully' });
    });

  } catch (error) {
    console.error('❌ Error removing torrent:', error);
    res.status(500).json({ error: 'Failed to remove torrent', message: error.message });
  }
});

// GET /api/torrents/stream/active - Get all active torrents
router.get('/active', (req, res) => {
  try {
    const torrents = req.torrents;
    const torrentNames = req.torrentNames;

    const activeTorrents = Object.entries(torrents).map(([hash, torrent]) => ({
      hash,
      name: torrentNames[hash] || 'Unknown',
      numPeers: torrent.numPeers,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      progress: torrent.progress,
      status: 'downloading'
    }));

    res.json({ success: true, data: activeTorrents });

  } catch (error) {
    console.error('❌ Error getting active torrents:', error);
    res.status(500).json({ error: 'Failed to get active torrents', message: error.message });
  }
});

// GET /api/torrents/stream/debrid-proxy - Proxy debrid streams to avoid CORS
// Supports optional audio transcoding for browser-incompatible codecs (DTS, DDP, TrueHD, etc.)
router.get('/debrid-proxy', async (req, res) => {
  try {
    const { url, transcode } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    // Validate it's a real-debrid URL
    if (!url.includes('real-debrid.com') && !url.includes('torbox.app')) {
      return res.status(400).json({ error: 'Invalid debrid URL' });
    }

    const shouldTranscode = transcode === 'true' || transcode === '1';
    console.log(`🔄 Proxying debrid stream${shouldTranscode ? ' (with audio transcode)' : ''}: ${url.substring(0, 80)}...`);

    const axios = require('axios');

    // Get range header from client
    const rangeHeader = req.headers.range;

    // If transcoding is requested, use FFmpeg to transcode audio to AAC
    if (shouldTranscode) {
      const { spawn } = require('child_process');
      
      // FFmpeg command to:
      // 1. Read from URL (with range support)
      // 2. Copy video stream (no re-encoding)
      // 3. Transcode audio to AAC (browser compatible)
      // 4. Output to stdout as MP4/fMP4
      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel', 'error',
        '-i', url,                      // Input from URL
        '-c:v', 'copy',                 // Copy video (no re-encode)
        '-c:a', 'aac',                  // Transcode audio to AAC
        '-b:a', '192k',                 // Audio bitrate
        '-ac', '2',                     // Stereo output (most compatible)
        '-movflags', 'frag_keyframe+empty_moov+faststart', // Streaming-friendly MP4
        '-f', 'mp4',                    // Output format
        'pipe:1'                        // Output to stdout
      ];

      console.log('🎵 Starting FFmpeg transcode for browser-compatible audio...');
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      // Set response headers for MP4 stream
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'none'); // Transcoded stream doesn't support range requests
      res.setHeader('Cache-Control', 'no-cache');

      // Pipe FFmpeg output to response
      ffmpeg.stdout.pipe(res);

      ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg && !msg.includes('frame=') && !msg.includes('size=')) {
          console.log(`FFmpeg: ${msg}`);
        }
      });

      ffmpeg.on('error', (err) => {
        console.error('❌ FFmpeg error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Transcode error' });
        }
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0 && code !== null) {
          console.log(`FFmpeg exited with code ${code}`);
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        ffmpeg.kill('SIGKILL');
      });

      return;
    }

    // Standard proxy without transcoding (for compatible audio)
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: rangeHeader ? { Range: rangeHeader } : {},
      timeout: 30000
    });

    // Forward headers
    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
    }
    res.setHeader('Accept-Ranges', 'bytes');

    // Set status code (206 for partial content)
    res.status(response.status);

    // Pipe the stream
    response.data.pipe(res);

    response.data.on('error', (err) => {
      // "aborted" is normal when client seeks or closes connection
      if (err.message === 'aborted') {
        return;  // Don't log, this is expected behavior
      }
      console.error('❌ Debrid proxy stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      response.data.destroy();
    });

  } catch (error) {
    // Ignore canceled/aborted requests
    if (error.code === 'ERR_CANCELED' || error.message === 'aborted') {
      return;
    }
    console.error('❌ Debrid proxy error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  }
});

module.exports = router;
