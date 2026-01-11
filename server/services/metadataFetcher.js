const axios = require('axios');

/**
 * Hybrid Metadata Fetcher
 * Strategy 1: Try cache API first (instant < 1s)
 * Strategy 2: Fall back to local WebTorrent DHT fetch
 */

// Public metadata cache services - prioritized by reliability
// These services cache torrent metadata so we don't need to wait for DHT
const METADATA_SERVICES = [
  // Primary: Most reliable cache services
  {
    name: 'btcache',
    url: (infoHash) => `https://btcache.me/torrent/${infoHash.toUpperCase()}`,
    timeout: 5000
  },
  {
    name: 'itorrents',
    url: (infoHash) => `https://itorrents.org/torrent/${infoHash.toUpperCase()}.torrent`,
    timeout: 5000
  },
  // Secondary: Additional cache services
  {
    name: 'torrage',
    url: (infoHash) => `https://torrage.info/torrent/${infoHash.toUpperCase()}.torrent`,
    timeout: 5000
  },
  {
    name: 'torcache',
    url: (infoHash) => `https://torcache.net/torrent/${infoHash.toUpperCase()}.torrent`,
    timeout: 5000
  },
  // Tertiary: Less common but sometimes work
  {
    name: 'academictorrents',
    url: (infoHash) => `https://academictorrents.com/download/${infoHash.toLowerCase()}.torrent`,
    timeout: 5000
  }
];

/**
 * Parse torrent file buffer to extract metadata
 * @param {Buffer} buffer - Torrent file data
 * @returns {Object|null} Parsed metadata or null
 */
function parseTorrentBuffer(buffer) {
  try {
    const bufferStr = buffer.toString('binary');

    // Extract name
    const nameMatch = bufferStr.match(/4:name(\d+):([^\x00-\x1f]+)/);
    if (!nameMatch) {
      return null;
    }

    const nameLength = parseInt(nameMatch[1]);
    const name = nameMatch[2].substring(0, nameLength);

    // Try to extract files list
    const files = [];

    // Look for "files" key followed by list - indicates multi-file torrent
    const filesMatch = bufferStr.match(/5:filesl/);

    if (filesMatch) {
      // Multi-file torrent - extract file entries
      let pos = filesMatch.index + 7; // Skip "5:filesl"

      // Parse up to 20 files (to avoid parsing the entire thing)
      for (let i = 0; i < 20; i++) {
        const fileMatch = bufferStr.substring(pos).match(/6:length(\d+):\d+e4:path/);
        if (!fileMatch) break;

        // Extract file path
        const pathPos = pos + fileMatch.index + fileMatch[0].length;
        const pathMatch = bufferStr.substring(pathPos).match(/l(\d+):([^\x00-\x1f]+)/);

        if (pathMatch) {
          const pathLength = parseInt(pathMatch[1]);
          const filename = pathMatch[2].substring(0, pathLength);
          const fileLength = parseInt(fileMatch[1]);

          files.push({
            name: filename,
            length: fileLength,
            path: filename
          });
        }

        pos = pathPos + 50; // Move forward
      }
    } else {
      // Single file torrent - the name IS the file
      // Try multiple patterns for length field
      let lengthMatch = bufferStr.match(/6:lengthi(\d+)e/);

      if (!lengthMatch) {
        // Try alternative patterns
        lengthMatch = bufferStr.match(/length(\d+):/);
        if (lengthMatch) {
          // Extract the number after "length"
          const afterLength = bufferStr.substring(bufferStr.indexOf('length') + 6);
          const numMatch = afterLength.match(/(\d+)/);
          if (numMatch) {
            lengthMatch = ['', numMatch[1]];
          }
        }
      }

      if (lengthMatch && lengthMatch[1]) {
        const length = parseInt(lengthMatch[1]);
        if (length > 0) {
          files.push({
            name: name,
            length: length,
            path: name
          });
        }
      } else {
        // If we still can't find length, estimate from torrent file size
        console.log('⚠️  Could not extract file length, estimating...');
        files.push({
          name: name,
          length: 1000000000, // 1GB estimate for single file
          path: name
        });
      }
    }

    console.log(`📝 Extracted from torrent: ${name} (${files.length} files)`);

    return {
      name: name,
      infoHash: null,
      files: files,
      length: files.reduce((sum, f) => sum + (f.length || 0), 0)
    };
  } catch (error) {
    console.log(`⚠️  Failed to parse torrent buffer: ${error.message}`);
    return null;
  }
}

/**
 * Fetch torrent metadata from external cache service
 * Uses WebTorrent to parse the .torrent file
 * @param {string} infoHash - Torrent info hash
 * @param {Object} client - WebTorrent client instance
 * @returns {Promise<Object>} Parsed torrent metadata
 */
async function fetchFromCache(infoHash, client) {
  for (const service of METADATA_SERVICES) {
    try {
      console.log(`🔍 Trying metadata service: ${service.name}`);

      const response = await axios.get(service.url(infoHash), {
        responseType: 'arraybuffer',
        timeout: service.timeout,
        headers: {
          'User-Agent': 'Youvies/1.0'
        },
        validateStatus: (status) => status === 200
      });

      if (response.data) {
        const buffer = Buffer.from(response.data);

        // Use WebTorrent to parse the torrent file
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Torrent parsing timeout'));
          }, 3000);

          try {
            const tempTorrent = client.add(buffer, {
              path: '/tmp/cache-parse',
              destroyStoreOnDestroy: true
            });

            tempTorrent.on('ready', () => {
              clearTimeout(timeout);

              const metadata = {
                name: tempTorrent.name,
                infoHash: tempTorrent.infoHash,
                files: tempTorrent.files.map(f => ({
                  name: f.name,
                  length: f.length,
                  path: f.path
                })),
                length: tempTorrent.length,
                torrentFile: buffer  // Include the .torrent file buffer
              };

              console.log(`✅ Metadata parsed from ${service.name}: ${metadata.name} (${metadata.files.length} files)`);

              // Destroy temp torrent
              tempTorrent.destroy();

              resolve(metadata);
            });

            tempTorrent.on('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      }
    } catch (error) {
      console.log(`⚠️  ${service.name} failed: ${error.message}`);
      continue; // Try next service
    }
  }

  throw new Error('All metadata cache services failed');
}

/**
 * Fetch metadata using WebTorrent with timeout
 * @param {Object} client - WebTorrent client instance
 * @param {string} magnetURI - Magnet URI
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Torrent metadata or null
 */
function fetchFromWebTorrent(client, magnetURI, timeout = 10000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log(`⏱️  Local metadata fetch timeout after ${timeout}ms`);
      if (torrent) {
        torrent.destroy();
      }
      resolve(null);
    }, timeout);

    console.log('🔄 Fetching metadata from DHT/trackers...');

    const torrent = client.add(magnetURI, {
      path: '/tmp/metadata-only',
      destroyStoreOnDestroy: true
    });

    torrent.on('metadata', () => {
      clearTimeout(timer);
      console.log(`✅ Local metadata fetched: ${torrent.name}`);

      const metadata = {
        infoHash: torrent.infoHash,
        name: torrent.name,
        files: torrent.files.map(f => ({
          name: f.name,
          length: f.length,
          path: f.path
        })),
        length: torrent.length,
        pieceLength: torrent.pieceLength
      };

      torrent.destroy();
      resolve(metadata);
    });

    torrent.on('error', (err) => {
      clearTimeout(timer);
      console.log(`❌ Local metadata fetch error: ${err.message}`);
      resolve(null);
    });
  });
}

/**
 * Hybrid metadata fetcher - tries cache API first (fast), falls back to local DHT
 * @param {Object} client - WebTorrent client instance
 * @param {string} magnetURI - Magnet URI
 * @param {string} infoHash - Torrent info hash
 * @returns {Promise<Object>} Torrent metadata
 */
async function fetchMetadata(client, magnetURI, infoHash) {
  console.log(`📥 Fetching metadata for: ${infoHash}`);

  // Strategy 1: Try cache services first (usually < 1s)
  try {
    console.log('🌐 Trying metadata cache services first...');
    const cacheMetadata = await fetchFromCache(infoHash, client);

    if (cacheMetadata && cacheMetadata.name) {
      console.log('✅ Using cached metadata (instant!)');
      return {
        infoHash: cacheMetadata.infoHash || infoHash,
        name: cacheMetadata.name,
        files: cacheMetadata.files || [],
        length: cacheMetadata.length || 0,
        pieceLength: 16384,
        torrentFile: cacheMetadata.torrentFile  // Pass through the .torrent file buffer
      };
    }
  } catch (error) {
    console.log(`⚠️  Cache services failed: ${error.message}`);
  }

  // Strategy 2: Fall back to local WebTorrent DHT fetch
  console.log('🔄 Falling back to local DHT metadata fetch...');
  const localMetadata = await fetchFromWebTorrent(client, magnetURI, 15000);

  if (localMetadata) {
    console.log('✅ Using local DHT metadata');
    return localMetadata;
  }

  throw new Error('Failed to fetch metadata from both cache and DHT');
}

module.exports = {
  fetchMetadata,
  fetchFromCache,
  fetchFromWebTorrent
};
