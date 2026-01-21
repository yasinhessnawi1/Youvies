require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const WebTorrent = require('webtorrent');
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper: cookieJarWrapper } = require('axios-cookiejar-support');

// Environment Configuration
const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.SERVER_HOST || '0.0.0.0',
  },
  client: {
    url: process.env.CLIENT_URL || 'http://localhost:5173'
  },
  isDevelopment: process.env.NODE_ENV !== 'production',
  isCloud: process.env.DIGITAL_OCEAN === 'true',
  iptv: {
    username: process.env.IPTV_USERNAME || '',
    password: process.env.IPTV_PASSWORD || '',
    serverUrl: process.env.IPTV_SERVER_URL || '',
    playlistName: process.env.IPTV_PLAYLIST_NAME || 'tv'
  }
};

const app = express();

// Performance monitoring middleware
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();

  const startTime = Date.now();
  let responseSent = false;

  const logResponseTime = () => {
    if (responseSent) return;
    responseSent = true;

    const duration = Date.now() - startTime;
    if (duration > 1000 || process.env.DEBUG === 'true') {
      console.log(
        `⏱️  ${duration > 1000 ? '⚠️  SLOW' : ''} ${req.method} ${req.path}: ${duration}ms`
      );
    }
  };

  res.on('finish', logResponseTime);
  res.on('close', logResponseTime);

  // Special timeout for streaming requests (longer)
  if (req.path.includes('/stream/')) {
    res.setTimeout(120000, () => { // 2 minutes for streaming
      console.log(`⏱️  ⚠️  Streaming timeout for ${req.path}`);
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Streaming timeout',
          message: 'Torrent streaming timed out. The torrent may have no seeders.'
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  } else {
    // Global timeout for other API requests
    res.setTimeout(30000, () => {
      console.log(`⏱️  ⚠️  Timeout for ${req.path}`);
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Request timeout',
          message: 'Server is busy, please try again'
        });
      }
    });
  }

  next();
});

// CORS Configuration
app.use(cors({
  origin: config.client.url,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Optimized torrent-stream configuration
const isProduction = process.env.NODE_ENV === 'production';
const isCloud = config.isCloud;

console.log(`🌐 Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
if (isCloud) console.log(`☁️  Cloud deployment detected`);

// Comprehensive tracker list - prioritized by reliability and speed
const defaultTrackers = [
  // WebSocket trackers (best for browser compatibility and NAT traversal)
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.io',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.files.fm:7073/announce',

  // High-quality public UDP trackers (most reliable)
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.tiny-vps.com:6969/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://ipv4.tracker.harry.lu:80/announce',

  // Additional proven trackers
  'udp://tracker.internetwarriors.net:1337/announce',
  'udp://tracker.cyberia.is:6969/announce',
  'udp://tracker.ds.is:6969/announce',

  // HTTP/HTTPS trackers as fallback
  'http://tracker.openbittorrent.com:80/announce',
  'https://tracker.nanoha.org:443/announce'
];

// WebTorrent client configuration with optimized peer discovery
const webTorrentClient = new WebTorrent({
  maxConns: isProduction ? (isCloud ? 120 : 180) : 200, // Increased for better peer discovery
  uploadLimit: 100000,  // 100KB/s upload (be a better peer to get better download priority)
  downloadLimit: -1,    // Unlimited download
  dht: {
    bootstrap: [
      'router.bittorrent.com:6881',
      'router.utorrent.com:6881',
      'dht.transmissionbt.com:6881',
      'dht.aelitis.com:6881'
    ],
    verify: true // Enable DHT verification for better peers
  },
  tracker: {
    announce: defaultTrackers,
    getAnnounceOpts: function () {
      return {
        numwant: 100, // Request even more peers from trackers
        compact: 1    // Use compact peer format for efficiency
      }
    },
    rtcConfig: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  },
  webSeeds: true,
  utp: true,
  lsd: true,            // Enable Local Service Discovery
  pex: true,            // Enable Peer Exchange
  natUpnp: !isProduction, // Enable UPnP only in development
  natPmp: !isProduction   // Enable NAT-PMP only in development
});

// Enhanced torrent client logging
webTorrentClient.on('error', (err) => {
  console.error('💥 WebTorrent client error:', err.message);
});

webTorrentClient.on('warning', (err) => {
  console.warn('⚠️ WebTorrent client warning:', err.message);
});

console.log('🌐 WebTorrent client initialized');

// WebTorrent options for adding torrents
const torrentAddOptions = {
  announce: defaultTrackers,
  path: '/tmp/webtorrent',
  destroyStoreOnDestroy: true
};

// Torrent storage - maps infoHash to torrent engine
const torrents = {};          // Active torrent engines by infoHash
const torrentIds = {};        // Original magnet URIs by infoHash
const torrentNames = {};      // Names by infoHash
const hashToMagnet = {};      // Quick hash-to-magnet lookup
const magnetToHash = {};      // Quick magnet-to-hash lookup

// Universal Torrent Resolver - finds torrents by any identifier (seedbox-lite pattern)
const universalTorrentResolver = (identifier) => {
  console.log(`🔍 Universal resolver looking for: ${identifier.substring(0, 50)}...`);

  // Strategy 1: Direct hash match
  if (torrents[identifier]) {
    console.log(`✅ Found by direct hash: ${torrentNames[identifier]}`);
    return torrents[identifier];
  }

  // Strategy 2: Search by magnet URI
  const hashFromMagnet = magnetToHash[identifier];
  if (hashFromMagnet && torrents[hashFromMagnet]) {
    console.log(`✅ Found by magnet URI: ${torrentNames[hashFromMagnet]}`);
    return torrents[hashFromMagnet];
  }

  // Strategy 3: Extract hash from magnet URI and search
  if (identifier.startsWith('magnet:')) {
    const match = identifier.match(/btih:([a-f0-9]{40})/i);
    if (match) {
      const hash = match[1].toLowerCase();
      if (torrents[hash]) {
        console.log(`✅ Found by extracted hash: ${torrentNames[hash]}`);
        return torrents[hash];
      }
    }
  }

  // Strategy 4: Check WebTorrent client for existing torrents
  const existingTorrent = webTorrentClient.get(identifier);
  if (existingTorrent) {
    console.log(`✅ Found in WebTorrent client: ${existingTorrent.name}`);
    return existingTorrent;
  }

  // Strategy 5: Search by name (case-insensitive partial match)
  const searchName = identifier.toLowerCase();
  for (const [hash, name] of Object.entries(torrentNames)) {
    if (name.toLowerCase().includes(searchName) || searchName.includes(name.toLowerCase())) {
      console.log(`✅ Found by name match: ${name}`);
      return torrents[hash];
    }
  }

  console.log(`❌ No torrent found for: ${identifier.substring(0, 50)}`);
  return null;
};

// Establish a basic session with the IPTV WebTV portal
async function performServerSideLogin() {
  try {
    console.log('[IPTV] Establishing session with WebTV portal...');

    // Create a session with cookies
    const jar = new CookieJar();
    const axiosInstance = cookieJarWrapper(axios.create({ jar }));

    // Simply access the portal homepage to get session cookies
    await axiosInstance.get('http://webtv.iptvsmarters.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000
    });

    // Get cookies from the homepage visit
    const cookies = await jar.getCookies('http://webtv.iptvsmarters.com');

    // Store session
    const sessionData = {
      cookies: cookies.map(c => c.toString()),
      timestamp: Date.now(),
      jar: jar,
      playlistId: null // Will be set after user adds playlist via form
    };

    global.iptvSession = sessionData;
    console.log('[IPTV] ✅ Session established with', cookies.length, 'cookies');
    return true;

  } catch (error) {
    console.error('[IPTV] ❌ Error:', error.message);
    console.error('[IPTV] Stack:', error.stack);
    return false;
  }
}

// IPTV Login Route - Handles login programmatically
app.post('/api/iptv/login', async (req, res) => {
  try {
    const success = await performServerSideLogin();

    if (success) {
      return res.json({ success: true, message: 'Login successful' });
    } else {
      return res.status(401).json({ error: 'Login failed' });
    }
  } catch (error) {
    console.error('[IPTV Login] Error:', error.message);
    return res.status(500).json({
      error: 'Login failed',
      details: error.message
    });
  }
});

// IPTV Login Status - Check if we're logged in
app.get('/api/iptv/status', (req, res) => {
  const hasSession = !!(global.iptvSession && (Date.now() - global.iptvSession.timestamp) < 3600000);
  res.json({
    loggedIn: hasSession,
    sessionAge: hasSession ? Date.now() - global.iptvSession.timestamp : null,
    hasCredentials: !!(config.iptv.username && config.iptv.password && config.iptv.serverUrl)
  });
});

// IPTV External Resource Proxy - Proxy HTTP resources through HTTPS to avoid mixed content
app.get('/api/iptv/proxy-external/*', async (req, res) => {
  // Extract the target URL from the path
  const urlPath = req.path.replace('/api/iptv/proxy-external/', '');
  const targetUrl = decodeURIComponent(urlPath);

  try {

    console.log('[IPTV External Proxy] Requesting:', targetUrl.substring(0, 100) + '...');

    // Determine if this is a streaming resource (M3U8, video, etc.)
    const isStreamingResource = /\.(m3u8|mp4|webm|mkv|avi|ts|mts|mpg|mpeg)$/i.test(targetUrl) ||
                                targetUrl.includes('/live/') ||
                                targetUrl.includes('/stream');

    // Special handling for IPTV streams - these often use dynamic CDN URLs that may not resolve
    // Validate the URL is actually HTTP
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      console.log('[IPTV External Proxy] Invalid URL protocol:', targetUrl);
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }

    // Only allow HTTP URLs for security
    if (!targetUrl.startsWith('http://')) {
      return res.status(400).json({ error: 'Only HTTP URLs are supported' });
    }

    // Fetch the resource with improved error handling
    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: isStreamingResource ? 'stream' : 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Range': req.headers.range, // Forward range requests for video seeking
        'Accept': '*/*',
        'Accept-Encoding': 'identity' // Avoid compression issues
      },
      timeout: isStreamingResource ? 45000 : 20000, // Shorter timeouts for better UX
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Accept 2xx and 3xx
      }
    });

    // Set appropriate headers
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // Forward range and content headers for streaming
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
    }
    if (response.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Cache static resources but not streaming content
    if (!isStreamingResource && (contentType.startsWith('image/') || contentType.includes('font') || contentType.includes('javascript') || contentType.includes('css'))) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }

    // Handle streaming response
    if (isStreamingResource) {
      // Check if this is an IPTV stream that returned an error
      if (response.status >= 400 && (targetUrl.includes('tvsystem.my') || targetUrl.includes('tvappmanager.my'))) {
        console.log(`[IPTV External Proxy] IPTV stream returned ${response.status}, returning empty M3U8`);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        return res.status(200).send('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n');
      }

      // Special handling for M3U8 playlists - rewrite HTTP URLs to go through proxy
      if (targetUrl.includes('.m3u8') || contentType.includes('mpegurl')) {
        console.log('[IPTV External Proxy] Processing M3U8 playlist from:', targetUrl);
        console.log('[IPTV External Proxy] Response status:', response.status);
        console.log('[IPTV External Proxy] Response headers:', JSON.stringify(response.headers, null, 2));

        // Collect the entire M3U8 content
        let m3u8Content = '';
        response.data.setEncoding('utf8');
        response.data.on('data', (chunk) => {
          m3u8Content += chunk;
        });

        response.data.on('end', () => {
          // Count HTTP/HTTPS URLs and relative URLs in the M3U8
          const httpUrls = m3u8Content.match(/https?:\/\/[^#\n]+/g) || [];
          const relativeUrls = m3u8Content.match(/^(?!#)[^\n]+$/gm)?.filter(line =>
            line.trim() && !line.includes('://') && line.includes('.')
          ) || [];

          console.log('[IPTV External Proxy] Found', httpUrls.length, 'HTTP/HTTPS URLs and', relativeUrls.length, 'relative URLs in M3U8');

          // Debug: show M3U8 content analysis
          console.log('[IPTV External Proxy] M3U8 content length:', m3u8Content.length, 'characters');
          const lines = m3u8Content.split('\n').filter(line => line.trim());
          console.log('[IPTV External Proxy] M3U8 non-empty lines:', lines.length);

          // Show all lines if content is short, otherwise show sample
          if (m3u8Content.length < 500) {
            console.log('[IPTV External Proxy] Full M3U8 content:', JSON.stringify(m3u8Content));
            lines.forEach((line, i) => {
              console.log(`[IPTV External Proxy] Line ${i}: "${line}"`);
            });
          } else {
            console.log('[IPTV External Proxy] Sample M3U8 content:', JSON.stringify(m3u8Content.substring(0, 200) + '...'));
            lines.slice(0, 5).forEach((line, i) => {
              console.log(`[IPTV External Proxy] Line ${i}: "${line}"`);
            });
          }

          // Check if M3U8 is empty or just whitespace
          if (!m3u8Content.trim()) {
            console.log('[IPTV External Proxy] M3U8 is empty or whitespace only!');
            console.log('[IPTV External Proxy] This explains why streams fail - the playlist is empty');

            // Return a valid but empty M3U8 playlist
            const emptyM3U8 = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n';
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache');
            return res.status(200).send(emptyM3U8);
          }

          // Rewrite HTTP/HTTPS URLs to go through the proxy
          if (httpUrls.length > 0) {
            httpUrls.forEach(url => {
              // Only proxy URLs that are from the problematic domains
              if (url.includes('tvappmanager.my') || url.includes('tvsystem.my')) {
                const proxyUrl = req.protocol + '://' + req.get('host') + '/api/iptv/proxy-external/' + encodeURIComponent(url);
                m3u8Content = m3u8Content.replace(url, proxyUrl);
                console.log('[IPTV External Proxy] Rewrote M3U8 URL:', url.substring(0, 80) + '...');
              }
            });
            console.log('[IPTV External Proxy] Rewrote HTTP URLs in M3U8 playlist');
          }

          // Rewrite relative URLs to go through the proxy (convert to full URLs first)
          if (relativeUrls.length > 0) {
            relativeUrls.forEach(relativeUrl => {
              // Convert relative URL to full URL based on the M3U8 source
              const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
              const fullUrl = baseUrl + relativeUrl.trim();
              const proxyUrl = req.protocol + '://' + req.get('host') + '/api/iptv/proxy-external/' + encodeURIComponent(fullUrl);

              // Replace the relative URL in the content
              m3u8Content = m3u8Content.replace(new RegExp(relativeUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), proxyUrl);
              console.log('[IPTV External Proxy] Rewrote relative M3U8 URL:', relativeUrl, '->', fullUrl.substring(0, 80) + '...');
            });
            console.log('[IPTV External Proxy] Rewrote relative URLs in M3U8 playlist');
          }

          // Send the rewritten M3U8 content
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.setHeader('Cache-Control', 'no-cache');
          res.status(200).send(m3u8Content);
        });

        response.data.on('error', (err) => {
          console.error('[IPTV External Proxy] Error reading M3U8:', err.message);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to process M3U8 playlist' });
          }
        });

        return; // Don't pipe the stream, we handled it manually
      }

      response.data.pipe(res);
      response.data.on('error', (err) => {
        console.error('[IPTV External Proxy] Stream error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        }
      });
    } else {
      res.status(response.status).send(response.data);
    }

  } catch (error) {
    console.error('[IPTV External Proxy] Error:', error.message);

    // Provide fallback content for non-critical resources
    const urlPath = targetUrl.toLowerCase();
    const isImage = /\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(urlPath);
    const isScript = /\.(js|css)$/i.test(urlPath);
    const isFont = /\.(woff|woff2|ttf|eot)$/i.test(urlPath);

    if ((isImage || isFont) && !res.headersSent) {
      // Return a 1x1 transparent pixel for missing images
      console.log('[IPTV External Proxy] Serving placeholder for missing image/font');
      res.setHeader('Content-Type', isFont ? 'application/octet-stream' : 'image/gif');
      res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
      // 1x1 transparent GIF
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return res.status(200).send(transparentGif);
    } else if (isScript && !res.headersSent) {
      // Return empty content for missing scripts/styles to prevent errors
      console.log('[IPTV External Proxy] Serving empty content for missing script/style');
      const contentType = urlPath.endsWith('.css') ? 'text/css' : 'application/javascript';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).send('/* Resource unavailable */');
    }

    // For IPTV streams and other critical resources, return appropriate HTTP errors
    if (!res.headersSent) {
      if (targetUrl.includes('tvsystem.my') || targetUrl.includes('tvappmanager.my')) {
        // For IPTV streams, return HTTP status codes that Video.js can understand
        if (error.code === 'ENOTFOUND') {
          console.log('[IPTV External Proxy] IPTV stream DNS resolution failed - stream may be offline');
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl'); // M3U8 content type
          return res.status(200).send('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n');
        } else if (error.code === 'ECONNREFUSED') {
          console.log('[IPTV External Proxy] IPTV stream connection refused - server may be down');
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          return res.status(200).send('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n');
        } else if (error.code === 'ETIMEDOUT') {
          console.log('[IPTV External Proxy] IPTV stream request timed out');
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          return res.status(200).send('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n');
        } else {
          console.log('[IPTV External Proxy] IPTV stream error:', error.code);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          return res.status(200).send('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n');
        }
      } else {
        // For other resources, return JSON error responses
        if (error.code === 'ENOTFOUND') {
          console.log('[IPTV External Proxy] DNS resolution failed - resource may be unavailable');
          return res.status(404).json({
            error: 'Resource not found',
            message: 'The requested external resource could not be accessed. It may be temporarily unavailable or no longer exists.'
          });
        } else if (error.code === 'ECONNREFUSED') {
          console.log('[IPTV External Proxy] Connection refused - server may be down');
          return res.status(503).json({
            error: 'Service unavailable',
            message: 'The external server refused the connection. Please try again later.'
          });
        } else if (error.code === 'ETIMEDOUT') {
          console.log('[IPTV External Proxy] Request timed out');
          return res.status(504).json({
            error: 'Request timeout',
            message: 'The request to the external resource timed out. Please try again later.'
          });
        }

        // For other errors, return a generic error
        res.status(500).json({
          error: 'Failed to proxy resource',
          message: error.message || 'An unexpected error occurred while fetching the resource'
        });
      }
    }
  }

});
// IPTV Proxy Route - Handle all IPTV requests
app.all('/api/iptv/*', async (req, res) => {
  try {
    // Skip status and login endpoints
    if (req.path === '/api/iptv/status' || req.path === '/api/iptv/login') {
      return; // Let other handlers take care of this
    }

    console.log('[IPTV Proxy] Request:', req.method, req.path);

    // Check if this is a request for static resources (CSS, JS, images)
    const isStaticResource = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|m3u8|ts|mp4)$/i.test(req.path);

    if (isStaticResource) {
      // For static resources and video streams, proxy directly to the IPTV server without session check
      return await proxyStaticResource(req, res);
    }

    // For HTML pages and other requests, check if we have a valid session
    if (!global.iptvSession || (Date.now() - global.iptvSession.timestamp) > 3600000) {
      console.log('[IPTV Proxy] No valid session, establishing login...');

      // Perform server-side login
      const loginSuccess = await performServerSideLogin();

      if (!loginSuccess) {
        console.log('[IPTV Proxy] ⚠️ Login failed, but allowing request to proceed for debugging...');
        // Don't fail completely - allow the request to proceed without session
        // This might work for some IPTV servers that don't require authentication
      } else {
        console.log('[IPTV Proxy] ✅ Session established, proceeding with proxy...');
      }
    }

    // We have a session, proxy the request with cookies
    await proxyAuthenticatedRequest(req, res);

  } catch (error) {
    console.error('❌ IPTV Proxy Error:', error.message);
    res.status(500).send(`
      <html>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
      <h2>Error</h2>
      <p>${error.message}</p>
      </body>
      </html>
    `);
  }
});

// Proxy static resources (CSS, JS, images) directly without session
async function proxyStaticResource(req, res) {
  try {
    // Extract the path after /api/iptv/
    let pathPart = req.path.replace('/api/iptv/', '');
    if (!pathPart.startsWith('/')) {
      pathPart = '/' + pathPart;
    }

    const targetUrl = 'http://webtv.iptvsmarters.com' + pathPart;
    console.log('[IPTV Static] Proxying static resource:', targetUrl);

    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    // Forward the content type
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }

    // Allow CORS for static resources
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(response.data);

  } catch (error) {
    console.error('[IPTV Static] Error:', error.message);
    res.status(404).send('Resource not found');
  }
}

// Proxy authenticated requests with session cookies
async function proxyAuthenticatedRequest(req, res) {
  try {
    // Create axios instance with stored cookies
    const jar = new CookieJar();
    if (global.iptvSession && global.iptvSession.cookies) {
      for (const cookieStr of global.iptvSession.cookies) {
        try {
          jar.setCookieSync(cookieStr, 'http://webtv.iptvsmarters.com');
        } catch (err) {
          console.warn('[IPTV Proxy] Failed to set cookie:', err.message);
        }
      }
    }

    const axiosInstance = cookieJarWrapper(axios.create({ jar }));

    // Build the target URL
    let pathPart = req.path.replace('/api/iptv/', '');

    // Remove 'proxy' prefix if it exists
    if (pathPart.startsWith('proxy')) {
      pathPart = pathPart.replace(/^proxy\/?/, '');
    }

    // Build target URL based on the requested path
    let targetUrl = 'http://webtv.iptvsmarters.com';

    // Special handling for main proxy route - go to add playlist page if no playlist is set
    if (!pathPart || pathPart === '' || pathPart === '/') {
      // If we don't have a playlist ID in session, go to the add playlist page
      if (!global.iptvSession?.playlistId) {
        targetUrl += '/index.php?adduser';
      } else {
        targetUrl += '/dashboard.php';
      }
    }
    else {
      if (!pathPart.startsWith('/')) {
        pathPart = '/' + pathPart;
      }
      targetUrl += pathPart;
    }

    // Add query parameters
    if (req.url.includes('?')) {
      const queryString = req.url.substring(req.url.indexOf('?'));
      targetUrl += queryString;
    }

    console.log('[IPTV Proxy] Forwarding to:', targetUrl);

    // Forward the request without timeout (let it take as long as needed)
    const response = await axiosInstance({
      method: req.method,
      url: targetUrl,
      data: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] })
      },
      maxRedirects: 5,
      timeout: 0 // No timeout - wait as long as needed
    });

    // If we're on the playlist selection page, try to auto-select
    // Check if response is HTML (string) before using .includes()
    const isHtmlResponse = typeof response.data === 'string';
    if (isHtmlResponse && response.data.includes('Choose Your Playlist')) {
      console.log('[IPTV Proxy] On playlist selection page, attempting auto-select...');

      // Try to extract playlist ID and auto-select
      const playlistIdMatch = response.data.match(/switchuser\.php\?id=(\d+)/);

      if (playlistIdMatch && global.iptvSession) {
        const playlistId = playlistIdMatch[1];
        console.log('[IPTV Proxy] Found playlist ID:', playlistId, '- selecting it...');

        try {
          // Select the playlist
          // eslint-disable-next-line no-unused-vars
          const selectResponse = await axiosInstance.get(
            `http://webtv.iptvsmarters.com/switchuser.php?id=${playlistId}`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'http://webtv.iptvsmarters.com/index.php'
              },
              maxRedirects: 5,
              timeout: 15000
            }
          );

          console.log('[IPTV Proxy] Playlist selected, redirecting to dashboard...');

          // Update session with playlist ID
          global.iptvSession.playlistId = playlistId;

          // Redirect to dashboard
          return res.redirect('/api/iptv/dashboard.php');
        } catch (selectError) {
          console.error('[IPTV Proxy] Failed to select playlist:', selectError.message);
        }
      }

      // If we can't auto-select, show the playlist selection page
      console.log('[IPTV Proxy] Could not auto-select playlist, showing selection page');
    }

    // If response is JSON (like from API endpoints), send it as-is
    if (typeof response.data === 'object') {
      res.setHeader('Content-Type', 'application/json');
      return res.json(response.data);
    }

    let html = response.data;
    console.log('[IPTV Proxy] Original HTML length:', html.length);

    // Rewrite URLs to go through our proxy (always use HTTPS for security)
    const proxyBaseUrl = 'https://' + req.get('host') + '/api/iptv';
    const externalProxyBaseUrl = 'https://' + req.get('host') + '/api/iptv/proxy-external';

    // Rewrite relative URLs in href attributes
    html = html.replace(/href="\/([^"]+)"/g, `href="${proxyBaseUrl}/$1"`);

    // Rewrite form actions
    html = html.replace(/action="\/([^"]+)"/g, `action="${proxyBaseUrl}/$1"`);

    // Rewrite src attributes for scripts, images, etc.
    html = html.replace(/src="\/([^"]+)"/g, `src="${proxyBaseUrl}/$1"`);

    // Count HTTP URLs before rewriting
    const httpUrlCount = (html.match(/http:\/\/[^"'\s]+/g) || []).length;
    console.log('[IPTV Proxy] Found', httpUrlCount, 'HTTP URLs in HTML');

    // Show sample HTTP URLs before rewriting
    if (httpUrlCount > 0) {
      const sampleUrls = (html.match(/http:\/\/[^"'\s]+/g) || []).slice(0, 5);
      console.log('[IPTV Proxy] Sample HTTP URLs:', sampleUrls);
    }

    // Rewrite external HTTP URLs to go through HTTPS proxy to avoid mixed content
    // This handles CDN URLs, external scripts, stylesheets, etc.
    let rewriteCount = 0;
    html = html.replace(/src="http:\/\/([^"]+)"/gi, (match, url) => {
      rewriteCount++;
      console.log('[IPTV Proxy] Rewriting src URL:', match.substring(0, 80) + '...');
      return `src="${externalProxyBaseUrl}/${encodeURIComponent('http://' + url)}"`;
    });
    console.log('[IPTV Proxy] Rewrote', rewriteCount, 'src HTTP URLs');

    // Also handle HTTP URLs in other attributes that load resources
    rewriteCount = 0;
    html = html.replace(/href="http:\/\/([^"]+)"/gi, (match, url) => {
      rewriteCount++;
      console.log('[IPTV Proxy] Rewriting href URL:', match.substring(0, 80) + '...');
      return `href="${externalProxyBaseUrl}/${encodeURIComponent('http://' + url)}"`;
    });
    console.log('[IPTV Proxy] Rewrote', rewriteCount, 'href HTTP URLs');

    // Handle HTTP URLs in other contexts (like JavaScript variables, data attributes, etc.)
    // Be more careful to avoid already-proxied URLs
    rewriteCount = 0;
    html = html.replace(/http:\/\/(?!youvies-server\.fly\.dev)[^"'\s<>&]+/g, (match) => {
      // Skip if it's already a proxied URL pattern
      if (match.includes('/api/iptv/') || match.includes('proxy-external')) {
        return match;
      }
      rewriteCount++;
      console.log('[IPTV Proxy] Rewriting general HTTP URL:', match.substring(0, 80) + '...');
      return `${externalProxyBaseUrl}/${encodeURIComponent(match)}`;
    });
    console.log('[IPTV Proxy] Rewrote', rewriteCount, 'general HTTP URLs');

    // Handle video stream URLs in JavaScript variables and attributes
    // This handles M3U8 playlists and other video sources
    rewriteCount = 0;
    html = html.replace(/http:\/\/tvsystem\.my([^"'\s]+)/gi, (match, path) => {
      rewriteCount++;
      return `${externalProxyBaseUrl}/${encodeURIComponent('http://tvsystem.my' + path)}`;
    });
    console.log('[IPTV Proxy] Rewrote', rewriteCount, 'tvsystem.my URLs');

    // Handle other common IPTV stream URLs
    rewriteCount = 0;
    html = html.replace(/http:\/\/([^.]+\.)?iptvsmarters\.com([^"'\s]+)/gi, (match, subdomain, path) => {
      rewriteCount++;
      const domain = subdomain ? subdomain + 'iptvsmarters.com' : 'iptvsmarters.com';
      return `${externalProxyBaseUrl}/${encodeURIComponent('http://' + domain + path)}`;
    });
    console.log('[IPTV Proxy] Rewrote', rewriteCount, 'iptvsmarters.com URLs');

    // Final check
    const remainingHttpUrls = (html.match(/http:\/\/[^"'\s]+/g) || []);
    console.log('[IPTV Proxy] Remaining HTTP URLs after rewriting:', remainingHttpUrls.length);
    if (remainingHttpUrls.length > 0) {
      console.log('[IPTV Proxy] Sample remaining HTTP URLs:', remainingHttpUrls.slice(0, 5));
    }

    // If this is the add playlist page, check if playlist exists before auto-filling
    if (html.includes('id="input-login"') && html.includes('id="add_user"')) {
      const autoFillScript = `
        <script>
          // Check if playlist already exists, if so redirect to dashboard
          (function() {
            console.log('[IPTV Auto-fill] Checking for existing playlist...');

            // Check localStorage for existing playlists
            const listUser = localStorage.getItem('listUser');
            const playlistName = '${config.iptv.playlistName || 'tv'}';

            if (listUser) {
              try {
                const playlists = JSON.parse(listUser);
                console.log('[IPTV Auto-fill] Found playlists in localStorage:', playlists);

                // Check if our playlist already exists
                let playlistExists = false;
                if (Array.isArray(playlists)) {
                  playlistExists = playlists.some(function(p) {
                    return p && p[playlistName];
                  });
                }

                if (playlistExists) {
                  console.log('[IPTV Auto-fill] Playlist "' + playlistName + '" already exists, redirecting to switchuser...');
                  window.location.href = '/api/iptv/switchuser.php';
                  return;
                }
              } catch (e) {
                console.error('[IPTV Auto-fill] Error parsing localStorage:', e);
              }
            }

            console.log('[IPTV Auto-fill] No existing playlist found, auto-filling form...');

            function fillAndSubmit() {
              const loginInput = document.getElementById('input-login');
              const passInput = document.getElementById('input-pass');
              const portalInput = document.getElementById('input-portal');
              const nameInput = document.getElementById('input-anyName');
              const addButton = document.getElementById('add_user');

              if (loginInput && passInput && portalInput && nameInput && addButton) {
                console.log('[IPTV Auto-fill] Filling form...');

                nameInput.value = playlistName;
                loginInput.value = '${config.iptv.username}';
                passInput.value = '${config.iptv.password}';
                portalInput.value = '${config.iptv.serverUrl}';

                // Wait a moment then click the button
                setTimeout(function() {
                  console.log('[IPTV Auto-fill] Submitting form...');
                  addButton.click();
                }, 1000);
              } else {
                console.log('[IPTV Auto-fill] Form not ready, retrying...');
                setTimeout(fillAndSubmit, 500);
              }
            }

            // Wait for page to be fully loaded
            if (document.readyState === 'complete') {
              setTimeout(fillAndSubmit, 1000);
            } else {
              window.addEventListener('load', function() {
                setTimeout(fillAndSubmit, 1000);
              });
            }
          })();
        </script>
      `;
      html = html.replace('</body>', autoFillScript + '</body>');
      console.log('[IPTV Proxy] Injected auto-fill script with playlist detection');
    }

    // Inject localStorage data if we have playlist data
    if (global.iptvPlaylistData && html.includes('</head>')) {
      const localStorageScript = `
        <script>
          // Populate localStorage with playlist data
          try {
            const playlistData = ${JSON.stringify([global.iptvPlaylistData])};
            localStorage.setItem('listUser', JSON.stringify(playlistData));
            console.log('[IPTV] Playlist data injected into localStorage');
          } catch (e) {
            console.error('[IPTV] Failed to inject playlist data:', e);
          }
        </script>
      `;
      html = html.replace('</head>', localStorageScript + '</head>');
      console.log('[IPTV Proxy] Injected localStorage data');
    }

    // Inject script to handle dynamic video source loading
    if (html.includes('</body>')) {
      const protocol = req.protocol;
      const host = req.get('host');
      const dynamicProxyScript = `
        <script>
          // Override XMLHttpRequest to proxy HTTP requests through the server
          (function() {
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
              if (typeof url === 'string' && url.startsWith('http://') && !url.includes('/api/iptv/')) {
                // Only proxy external HTTP URLs, not already proxied ones or internal API calls
                const proxyUrl = '${protocol}://${host}/api/iptv/proxy-external/' + encodeURIComponent(url);
                console.log('[IPTV Proxy] Redirecting XMLHttpRequest:', url, '->', proxyUrl);
                url = proxyUrl;
              }
              return originalOpen.call(this, method, url, ...args);
            };
          })();

          // Override fetch to proxy HTTP requests through the server
          (function() {
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              let url = typeof input === 'string' ? input : input.url || input.href;
              if (typeof url === 'string' && url.startsWith('http://') && !url.includes('/api/iptv/')) {
                // Only proxy external HTTP URLs, not already proxied ones or internal API calls
                const proxyUrl = '${protocol}://${host}/api/iptv/proxy-external/' + encodeURIComponent(url);
                console.log('[IPTV Proxy] Redirecting fetch:', url, '->', proxyUrl);
                if (typeof input === 'string') {
                  input = proxyUrl;
                } else {
                  input = new Request(proxyUrl, input);
                }
              }
              return originalFetch.call(this, input, init);
            };
          })();
        </script>
      `;
      html = html.replace('</body>', dynamicProxyScript + '</body>');
      console.log('[IPTV Proxy] Injected dynamic proxy script');
    }

    // Set headers to allow iframe embedding
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');

    console.log('[IPTV Proxy] ✅ Served authenticated page');
    res.send(html);

  } catch (error) {
    console.error('[IPTV Proxy] ❌ Error:', error.message);

    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).send(`
        <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2>Proxy Error</h2>
        <p>${error.message}</p>
        </body>
        </html>
      `);
    }
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: {
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
    },
    torrents: {
      active: Object.keys(torrents).length
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Import route modules
const authRoutes = require('./routes/auth');
const tmdbRoutes = require('./routes/tmdb');
const torrentSearchRoutes = require('./routes/torrents');
const streamingRoutes = require('./routes/streaming');
const subtitlesRoutes = require('./routes/subtitles');

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/torrents/search', torrentSearchRoutes);
app.use('/api/subtitles', subtitlesRoutes);

// Pass WebTorrent client and storage to streaming routes
app.use('/api/torrents/stream', (req, res, next) => {
  req.webTorrentClient = webTorrentClient;
  req.torrentAddOptions = torrentAddOptions;
  req.torrents = torrents;
  req.torrentIds = torrentIds;
  req.torrentNames = torrentNames;
  req.hashToMagnet = hashToMagnet;
  req.magnetToHash = magnetToHash;
  req.universalTorrentResolver = universalTorrentResolver;
  next();
}, streamingRoutes);

// Serve frontend static files in production (only if dist exists - for monolithic deploy)
const fs = require('fs');
const clientPath = path.join(__dirname, '../dist');
const hasClientBuild = fs.existsSync(path.join(clientPath, 'index.html'));

if (isProduction && hasClientBuild) {
  console.log('📦 Serving frontend static files from dist/');
  app.use(express.static(clientPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(clientPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
} else if (isProduction) {
  console.log('🔗 Running API-only mode (frontend served separately)');
  // API-only mode - return 404 for non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.status(404).json({
        error: 'Not found',
        message: 'This is the API server. Frontend is served from a different URL.'
      });
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(config.isDevelopment && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  // Destroy all active torrents
  webTorrentClient.destroy(() => {
    console.log('✅ WebTorrent client destroyed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT received, shutting down gracefully...');
  // Destroy all active torrents
  webTorrentClient.destroy(() => {
    console.log('✅ WebTorrent client destroyed');
    process.exit(0);
  });
});

// Start server
const PORT = config.server.port;
const HOST = config.server.host;

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 Youvies Unified Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running at http://${HOST}:${PORT}`);
  console.log(`🎬 API endpoints: http://${HOST}:${PORT}/api`);
  console.log(`🌐 Client URL: ${config.client.url}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('  • POST   /api/auth/login');
  console.log('  • POST   /api/auth/register');
  console.log('  • GET    /api/auth/user');
  console.log('  • GET    /api/tmdb/*');
  console.log('  • GET    /api/torrents/search/:query');
  console.log('  • POST   /api/torrents/stream');
  console.log('  • GET    /api/torrents/stream/:hash/files');
  console.log('  • GET    /api/torrents/stream/:hash/files/:index/stream');
  console.log('  • GET    /api/torrents/stream/:hash/stats');
  console.log('  • GET    /api/health');
  console.log('');
});

module.exports = { app, webTorrentClient, torrentAddOptions };
