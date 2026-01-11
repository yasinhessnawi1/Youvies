/**
 * Smart Provider Router - Routes queries to optimal providers based on content type
 * Achieves 3-5x faster search by only querying relevant providers
 * 
 * EXPANDED: More providers added for better torrent coverage
 */

const scrap1337x = require('./1337x');
const scrapNyaa = require('./nyaaSI');
const scrapYts = require('./yts');
const scrapPirateBay = require('./pirateBay');
const scrapTorLock = require('./torLock');
const scrapEzTVio = require('./ezTV');
const torrentGalaxy = require('./torrentGalaxy');
const rarbg = require('./rarbg');
const zooqle = require('./zooqle');
const kickAss = require('./kickAss');
const bitSearch = require('./bitSearch');
const glodls = require('./gloTorrents');
const magnet_dl = require('./magnet_dl');
const limeTorrent = require('./limeTorrent');
const torrentFunk = require('./torrentFunk');
// const torrentProject = require('./torrentProject'); // Available but not currently used
const ettv = require('./ettv');

// Provider categories optimized for each content type
// EXPANDED with more providers for better coverage
const PROVIDERS = {
  // Best providers for movies - 10 providers total
  movies: [
    // Priority 1 - Fast, reliable, movie-focused
    { name: 'YTS', fn: (q, p) => scrapYts.yts(q, p), priority: 1 }, // Best for movies
    { name: '1337x', fn: (q, p) => scrap1337x.torrent1337x(q, p), priority: 1 },
    { name: 'TorrentGalaxy', fn: (q, p) => torrentGalaxy(q, p), priority: 1 }, // Upgraded to priority 1
    // Priority 2 - Good coverage
    { name: 'RARBG', fn: (q, p) => rarbg(q, p), priority: 2 },
    { name: 'PirateBay', fn: (q, p) => scrapPirateBay.pirateBay(q, p), priority: 2 },
    { name: 'KickAss', fn: (q, p) => kickAss(q, p), priority: 2 },      // ADDED
    { name: 'GloTorrents', fn: (q, p) => glodls(q, p), priority: 2 },   // ADDED
    // Priority 3 - Fallback/meta-search
    { name: 'BitSearch', fn: (q, p) => bitSearch(q, p), priority: 3 },   // ADDED
    { name: 'LimeTorrent', fn: (q, p) => limeTorrent(q, p), priority: 3 },
    { name: 'TorrentFunk', fn: (q, p) => torrentFunk(q, p), priority: 3 } // ADDED
  ],

  // Best providers for TV shows - 10 providers total
  shows: [
    // Priority 1 - TV-focused
    { name: 'EZTV', fn: (q, p) => scrapEzTVio.ezTV(q), priority: 1 }, // Best for TV shows
    { name: '1337x', fn: (q, p) => scrap1337x.torrent1337x(q, p), priority: 1 },
    { name: 'TorrentGalaxy', fn: (q, p) => torrentGalaxy(q, p), priority: 1 },
    { name: 'ETTV', fn: (q, p) => ettv(q, p), priority: 1 },           // ADDED - Very good for TV
    // Priority 2 - General with good TV
    { name: 'Zooqle', fn: (q, p) => zooqle.zooqle(q, p), priority: 2 },
    { name: 'RARBG', fn: (q, p) => rarbg(q, p), priority: 2 },
    { name: 'PirateBay', fn: (q, p) => scrapPirateBay.pirateBay(q, p), priority: 2 },
    { name: 'KickAss', fn: (q, p) => kickAss(q, p), priority: 2 },      // ADDED
    // Priority 3 - Fallback
    { name: 'BitSearch', fn: (q, p) => bitSearch(q, p), priority: 3 },   // ADDED
    { name: 'LimeTorrent', fn: (q, p) => limeTorrent(q, p), priority: 3 }
  ],

  // Best providers for anime - 6 providers total
  anime: [
    // Priority 1 - Anime-focused
    { name: 'NyaaSI', fn: (q, p) => scrapNyaa.nyaaSI(q, p), priority: 1 }, // Best for anime
    // Priority 2 - General with anime
    { name: '1337x', fn: (q, p) => scrap1337x.torrent1337x(q, p), priority: 2 },
    { name: 'TorrentGalaxy', fn: (q, p) => torrentGalaxy(q, p), priority: 2 },
    { name: 'TorLock', fn: (q, p) => scrapTorLock.torLock(q, p), priority: 2 }, // ADDED
    // Priority 3 - Fallback
    { name: 'KickAss', fn: (q, p) => kickAss(q, p), priority: 3 },       // ADDED
    { name: 'LimeTorrent', fn: (q, p) => limeTorrent(q, p), priority: 3 }
  ],

  // Fallback: general providers (used when type unknown) - 8 providers
  general: [
    { name: '1337x', fn: (q, p) => scrap1337x.torrent1337x(q, p), priority: 1 },
    { name: 'TorrentGalaxy', fn: (q, p) => torrentGalaxy(q, p), priority: 1 },
    { name: 'BitSearch', fn: (q, p) => bitSearch(q, p), priority: 2 },
    { name: 'KickAss', fn: (q, p) => kickAss(q, p), priority: 2 },
    { name: 'PirateBay', fn: (q, p) => scrapPirateBay.pirateBay(q, p), priority: 2 }, // ADDED
    { name: 'MagnetDL', fn: (q, p) => magnet_dl(q, p), priority: 3 },
    { name: 'TorLock', fn: (q, p) => scrapTorLock.torLock(q, p), priority: 3 },
    { name: 'TorrentFunk', fn: (q, p) => torrentFunk(q, p), priority: 3 }  // ADDED
  ]
};

/**
 * Two-phase search strategy (IMPROVED):
 * Phase 1: Priority 1 + 2 providers in parallel (4s timeout) - better coverage
 * Phase 2: Priority 3 fallback providers (5s timeout) - only if phase 1 has < 10 results
 * 
 * CHANGES:
 * - Increased "sufficient results" threshold from 5 to 10 for better selection
 * - Run priority 1+2 together in phase 1 for faster parallel search
 * - Only use priority 3 (meta-search fallbacks) if needed
 */
async function smartSearch(query, page = '1', contentType = 'general') {
  const startTime = Date.now();

  // Select providers based on content type
  const providers = PROVIDERS[contentType] || PROVIDERS.general;

  // Phase 1: Search priority 1 + 2 providers together (4s timeout)
  const priority1And2 = providers.filter(p => p.priority <= 2);
  console.log(`🚀 Phase 1: Searching ${priority1And2.length} providers (priority 1+2) for ${contentType}...`);

  const phase1Results = await searchProviders(priority1And2, query, page, 4000);

  const phase1Time = Date.now() - startTime;
  const phase1TorrentCount = phase1Results.reduce((sum, arr) => sum + (arr?.length || 0), 0);
  console.log(`⚡ Phase 1 completed in ${phase1Time}ms, found ${phase1TorrentCount} torrents from ${phase1Results.filter(r => r?.length > 0).length} providers`);

  // Early return if we have good results (at least 10 torrents for better selection)
  if (phase1TorrentCount >= 10) {
    console.log(`✅ Sufficient results from phase 1 (${phase1TorrentCount} torrents), skipping phase 2`);
    return phase1Results;
  }

  // Phase 2: Extended search with priority 3 fallback providers if needed
  const priority3 = providers.filter(p => p.priority === 3);
  if (priority3.length === 0) {
    console.log(`ℹ️ No priority 3 providers configured, returning phase 1 results`);
    return phase1Results;
  }
  
  console.log(`🔄 Phase 2: Searching ${priority3.length} fallback providers (priority 3)...`);

  const phase2Results = await searchProviders(priority3, query, page, 5000);

  const totalTime = Date.now() - startTime;
  const allResults = [...phase1Results, ...phase2Results];
  const totalTorrents = allResults.reduce((sum, arr) => sum + (arr?.length || 0), 0);
  console.log(`✅ Total search completed in ${totalTime}ms, found ${totalTorrents} torrents from ${allResults.filter(r => r?.length > 0).length} providers`);

  return allResults;
}

/**
 * Search multiple providers in parallel with timeout
 */
async function searchProviders(providers, query, page, timeout) {
  const promises = providers.map(provider =>
    Promise.race([
      // Timeout promise
      new Promise((_, reject) =>
        setTimeout(() => reject({ code: 408, message: `${provider.name} timeout` }), timeout)
      ),
      // Provider promise
      new Promise(async (resolve, reject) => {
        try {
          const result = await provider.fn(query, page);
          resolve({ provider: provider.name, result });
        } catch (error) {
          reject({ provider: provider.name, error });
        }
      })
    ])
  );

  const results = await Promise.allSettled(promises);

  // Extract successful results
  const torrents = results
    .filter(r => r.status === 'fulfilled' && r.value?.result?.length > 0)
    .map(r => {
      console.log(`  ✓ ${r.value.provider}: ${r.value.result.length} torrents`);
      return r.value.result;
    });

  // Log failures (for debugging)
  results
    .filter(r => r.status === 'rejected')
    .forEach(r => {
      const msg = r.reason?.message || r.reason?.error?.message || 'Unknown error';
      if (!msg.includes('timeout')) {
        console.log(`  ✗ ${r.reason?.provider || 'Unknown'}: ${msg}`);
      }
    });

  return torrents;
}

/**
 * Legacy combo function for backward compatibility
 * Routes to smartSearch with 'general' type
 */
async function combo(query, page) {
  return smartSearch(query, page, 'general');
}

module.exports = {
  smartSearch,
  combo,
  PROVIDERS
};
