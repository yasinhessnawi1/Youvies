require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const WebTorrent = require('webtorrent');

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

// Serve frontend static files in production
if (isProduction) {
  const clientPath = path.join(__dirname, '../dist');
  app.use(express.static(clientPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(clientPath, 'index.html'));
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
