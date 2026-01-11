const express = require('express');
const router = express.Router();
// const combo = require('../scrapers/COMBO'); // Legacy - now using smartSearch from providerRouter
const { smartSearch } = require('../scrapers/providerRouter');

// In-memory cache for torrent search results (5 minute TTL)
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache cleanup every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      searchCache.delete(key);
    }
  }
}, 60000);

/**
 * Get incremental penalty for low-quality sources
 * Returns a penalty value instead of binary filter:
 * - Worst (heavy penalty -0.8): CAM, CAMRIP, HDCAM, HQ-CAM, WORKPRINT
 * - Bad (penalty -0.6): TS, TELESYNC, HDTS, HD-TS, TC, TELECINE, HDTC, HD-TC
 * - Poor (penalty -0.4): SCR, SCREENER, DVDSCR, DVD-SCR, PDVD, PRE-DVD, R5, R6
 * - Acceptable (penalty -0.2): WEBSCREENER, WEB-SCREENER (early web releases)
 * - No penalty (0): WEB-DL, WEBRIP, BLURAY, REMUX, etc.
 */
function getLowQualityPenalty(name) {
  const nameLower = name.toLowerCase();
  
  // === WORST QUALITY (-0.8 penalty) ===
  // CAM recordings - virtually unwatchable
  const worstPatterns = [
    /\bcam\b/,           // CAM
    /\bcamrip\b/,        // CAMRip
    /\bhdcam\b/,         // HDCAM
    /\bhd-cam\b/,        // HD-CAM
    /\bhq.?cam\b/,       // HQ-CAM
    /\bworkprint\b/,     // Workprint (unfinished)
  ];
  
  if (worstPatterns.some(p => p.test(nameLower))) {
    return { penalty: -0.8, quality: 'CAM/Workprint' };
  }
  
  // === BAD QUALITY (-0.6 penalty) ===
  // Telesync/Telecine - better than CAM but still poor
  const badPatterns = [
    /\bts\b/,            // TS/Telesync
    /\btelesync\b/,      // Telesync
    /\bhd-ts\b/,         // HD-TS
    /\bhdts\b/,          // HDTS
    /\.ts\./,            // .TS. in filename
    /-ts-/,              // -TS-
    /\btc\b/,            // TC/Telecine
    /\btelecine\b/,      // Telecine
    /\bhd-tc\b/,         // HD-TC
    /\bhdtc\b/,          // HDTC
    /\.tc\./,            // .TC.
    /-tc-/,              // -TC-
  ];
  
  // Check for TS/TC patterns but NOT if it's a webscreener (avoid false positives)
  if (!nameLower.includes('webscreener') && !nameLower.includes('web-screener')) {
    if (badPatterns.some(p => p.test(nameLower))) {
      return { penalty: -0.6, quality: 'TS/TC' };
    }
  }
  
  // === POOR QUALITY (-0.4 penalty) ===
  // Screeners and pre-release copies
  const poorPatterns = [
    /\bdvdscr\b/,        // DVDScreener
    /\bdvd-scr\b/,       // DVD-SCR
    /\bpdvd\b/,          // PreDVD
    /\bpre-dvd\b/,       // Pre-DVD
    /\br5\b/,            // R5 (region 5 early release)
    /\br6\b/,            // R6
  ];
  
  if (poorPatterns.some(p => p.test(nameLower))) {
    return { penalty: -0.4, quality: 'Screener/R5' };
  }
  
  // Check for generic "scr" or "screener" but NOT when part of "webscreener"
  if (!nameLower.includes('webscreener') && !nameLower.includes('web-screener')) {
    if (/\bscr\b/.test(nameLower) || /\bscreener\b/.test(nameLower)) {
      return { penalty: -0.4, quality: 'Screener' };
    }
  }
  
  // === ACCEPTABLE (-0.2 penalty) ===
  // Web screeners - early web releases, decent quality
  if (nameLower.includes('webscreener') || nameLower.includes('web-screener')) {
    return { penalty: -0.2, quality: 'WEBSCREENER' };
  }
  
  // No penalty for good sources
  return { penalty: 0, quality: 'Good' };
}

// Legacy function for backward compatibility - now uses incremental penalties
function isLowQualitySource(name) {
  const { penalty } = getLowQualityPenalty(name);
  // Only return true for truly unwatchable content (CAM)
  return penalty <= -0.8;
}

// Helper function to detect non-English audio/subtitles
function detectAudioLanguage(name) {
  const nameLower = name.toLowerCase();
  
  // Check for English/original sound indicators FIRST (rewards)
  const englishIndicators = [
    /[\.\-\s](en|eng|english)[\.\-\s]/i,
    /[\.\-\s]en[\.\-\s]sub/i,  // English subs (often means original audio)
    /\boriginal[\.\-\s]sound/i,
    /\boriginal[\.\-\s]audio/i,
  ];
  
  const hasEnglishIndicator = englishIndicators.some(p => p.test(nameLower));
  
  // Check for specific language dubs (these should be heavily penalized)
  const specificDubPatterns = [
    { pattern: /\bukr[\.\-\s]dub/i, lang: 'Ukrainian Dub', isDub: true },
    { pattern: /\brus[\.\-\s]dub|russian[\.\-\s]dub/i, lang: 'Russian Dub', isDub: true },
    { pattern: /\bspanish[\.\-\s]dub|spa[\.\-\s]dub/i, lang: 'Spanish Dub', isDub: true },
    { pattern: /\bfrench[\.\-\s]dub|fr[\.\-\s]dub|fre[\.\-\s]dub/i, lang: 'French Dub', isDub: true },
    { pattern: /\bgerman[\.\-\s]dub|de[\.\-\s]dub|ger[\.\-\s]dub/i, lang: 'German Dub', isDub: true },
    { pattern: /\bitalian[\.\-\s]dub|it[\.\-\s]dub|ita[\.\-\s]dub/i, lang: 'Italian Dub', isDub: true },
    { pattern: /\bportuguese[\.\-\s]dub|pt[\.\-\s]dub|por[\.\-\s]dub/i, lang: 'Portuguese Dub', isDub: true },
    { pattern: /\bpolish[\.\-\s]dub|pl[\.\-\s]dub|pol[\.\-\s]dub/i, lang: 'Polish Dub', isDub: true },
    { pattern: /\bturkish[\.\-\s]dub|tr[\.\-\s]dub|tur[\.\-\s]dub/i, lang: 'Turkish Dub', isDub: true },
    { pattern: /\bhindi[\.\-\s]dub|hi[\.\-\s]dub|hin[\.\-\s]dub/i, lang: 'Hindi Dub', isDub: true },
    { pattern: /\bchinese[\.\-\s]dub|zh[\.\-\s]dub|chi[\.\-\s]dub/i, lang: 'Chinese Dub', isDub: true },
    { pattern: /\bjapanese[\.\-\s]dub|ja[\.\-\s]dub|jpn[\.\-\s]dub/i, lang: 'Japanese Dub', isDub: true },
    { pattern: /\bkorean[\.\-\s]dub|ko[\.\-\s]dub|kor[\.\-\s]dub/i, lang: 'Korean Dub', isDub: true },
    { pattern: /\bdub[\.\-\s]*\[.*?(ukr|rus|spa|fr|de|it|pt|pl|tr|hi|zh|ja|ko)/i, lang: 'Dubbed (Foreign)', isDub: true },
    { pattern: /\[(ukr|rus|spa|fr|de|it|pt|pl|tr|hi|zh|ja|ko)[\.\-\s]*dub\]/i, lang: 'Dubbed (Foreign in brackets)', isDub: true },
  ];
  
  // Check for specific dubs first (most specific)
  for (const { pattern, lang } of specificDubPatterns) {
    if (pattern.test(nameLower)) {
      // If it's a specific foreign dub AND has English indicator, might be dual
      if (hasEnglishIndicator && /\bdual|multi/i.test(nameLower)) {
        return { isForeign: false, language: `Dual (${lang})`, dualAudio: true, isDubbed: true };
      }
      // Foreign dub without English = heavily penalized
      return { isForeign: true, language: lang, dualAudio: false, isDubbed: true };
    }
  }
  
  // Check for general "dub" or "dubbed" indicators (penalize unless English or dual)
  const generalDubPatterns = [
    /\b[\.\-\s]dub[\.\-\s]/i,
    /\bdubbed[\.\-\s]/i,
  ];
  
  const hasGeneralDub = generalDubPatterns.some(p => p.test(nameLower));
  
  // If it has "dub" but also English indicator and "dual", it's OK
  if (hasGeneralDub && hasEnglishIndicator && /\bdual|multi/i.test(nameLower)) {
    return { isForeign: false, language: 'Dual Audio (English + Dub)', dualAudio: true, isDubbed: true };
  }
  
  // If it has "dub" without English, it's likely foreign (penalize)
  if (hasGeneralDub && !hasEnglishIndicator) {
    return { isForeign: true, language: 'Dubbed (Non-English)', dualAudio: false, isDubbed: true };
  }
  
  // Non-English language indicators that suggest foreign audio (but not explicitly dubbed)
  const foreignLanguagePatterns = [
    { pattern: /\b\[.*?(ukr|ukrainian)\]/i, lang: 'Ukrainian' },
    { pattern: /\b\[.*?(rus|russian)\]/i, lang: 'Russian' },
    { pattern: /\b\[.*?(spa|spanish)\]/i, lang: 'Spanish' },
    { pattern: /\b\[.*?(fr|french|fre)\]/i, lang: 'French' },
    { pattern: /\b\[.*?(de|german|ger)\]/i, lang: 'German' },
    { pattern: /\b\[.*?(it|italian|ita)\]/i, lang: 'Italian' },
    { pattern: /\b\[.*?(pt|portuguese|por)\]/i, lang: 'Portuguese' },
    { pattern: /\b\[.*?(pl|polish|pol)\]/i, lang: 'Polish' },
    { pattern: /\b\[.*?(tr|turkish|tur)\]/i, lang: 'Turkish' },
    { pattern: /\b\[.*?(hi|hindi|hin)\]/i, lang: 'Hindi' },
    { pattern: /\b\[.*?(zh|chinese|chi)\]/i, lang: 'Chinese' },
    { pattern: /\b\[.*?(ja|japanese|jpn)\]/i, lang: 'Japanese' },
    { pattern: /\b\[.*?(ko|korean|kor)\]/i, lang: 'Korean' },
  ];
  
  // Check for foreign language indicators in brackets
  for (const { pattern, lang } of foreignLanguagePatterns) {
    if (pattern.test(nameLower)) {
      // If it also has English indicator, it might be dual audio which is fine
      if (hasEnglishIndicator || /\bdual|multi/i.test(nameLower)) {
        return { isForeign: false, language: `Dual (${lang})`, dualAudio: true, isDubbed: false };
      }
      return { isForeign: true, language: lang, dualAudio: false, isDubbed: false };
    }
  }
  
  // Check for "dual" or "multi" by itself (suspicious - could be foreign language)
  // Only trust it if we also see English indicator
  if (/\bdual\b/i.test(nameLower) || /\bmulti\b/i.test(nameLower)) {
    // If it explicitly says "dual audio" or "multi audio" AND has English, it's OK
    if (/\b(dual|multi)[\.\-\s]audio/i.test(nameLower) && hasEnglishIndicator) {
      return { isForeign: false, language: 'Dual Audio (English)', dualAudio: true, isDubbed: false };
    }
    // Just "Dual" or "Multi" without English indicator - suspect (will get penalized)
    if (hasEnglishIndicator) {
      return { isForeign: false, language: 'Dual/Multi (English)', dualAudio: true, isDubbed: false };
    }
    // "Dual" or "Multi" without English - likely foreign language, penalize
    return { isForeign: true, language: 'Dual/Multi (No English)', dualAudio: true, isDubbed: false };
  }
  
  // Check for "dual audio" or "multi audio" explicitly mentioned (only if English present)
  if (/\bdual[\.\-\s]audio/i.test(nameLower) || /\bmulti[\.\-\s]audio/i.test(nameLower)) {
    if (hasEnglishIndicator) {
      return { isForeign: false, language: 'Dual Audio (English)', dualAudio: true, isDubbed: false };
    }
    // Dual audio without English indicator - suspect
    return { isForeign: true, language: 'Dual Audio (No English)', dualAudio: true, isDubbed: false };
  }
  
  // If English indicator present, reward it
  if (hasEnglishIndicator) {
    return { isForeign: false, language: 'English', dualAudio: false, isDubbed: false };
  }
  
  // Default: assume English (no penalty, no reward - neutral)
  return { isForeign: false, language: 'English (assumed)', dualAudio: false, isDubbed: false };
}

// Helper function to detect audio codecs and browser compatibility
// IMPORTANT: Browser video players DON'T support: DTS, TrueHD, Atmos, E-AC3/DDP
// They DO support: AAC, AC3 (DD), MP3, Opus, Vorbis
function detectAudioQuality(name) {
  const nameLower = name.toLowerCase();
  
  // ============================================================================
  // Browser-COMPATIBLE audio codecs (PREFER THESE)
  // ============================================================================
  
  // AAC - Best browser compatibility, good quality
  if (nameLower.includes('aac')) {
    return { score: 1.0, codec: 'AAC', browserCompatible: true };
  }
  
  // AC3/DD (Dolby Digital) - Generally works in most browsers
  if ((nameLower.includes('ac3') || nameLower.includes('dd5.1') || nameLower.includes('dd 5.1')) && 
      !nameLower.includes('ddp') && !nameLower.includes('dd+') && !nameLower.includes('eac3')) {
    return { score: 0.95, codec: 'AC3', browserCompatible: true };
  }
  
  // MP3 - Universal compatibility
  if (nameLower.includes('mp3')) {
    return { score: 0.85, codec: 'MP3', browserCompatible: true };
  }
  
  // Opus/Vorbis - Good browser support
  if (nameLower.includes('opus')) {
    return { score: 0.9, codec: 'Opus', browserCompatible: true };
  }
  
  // ============================================================================
  // Browser-INCOMPATIBLE audio codecs (PENALIZE THESE)
  // These will cause NO SOUND in browser video players!
  // ============================================================================
  
  // DDP / E-AC3 / Dolby Digital Plus - NOT browser compatible!
  if (nameLower.includes('ddp') || nameLower.includes('dd+') || nameLower.includes('eac3') || 
      nameLower.includes('e-ac3') || nameLower.includes('dolby digital plus')) {
    console.log(`  ⚠️ Incompatible audio (DDP/E-AC3): "${name.substring(0, 60)}..."`);
    return { score: 0.2, codec: 'DDP', browserCompatible: false };
  }
  
  // Atmos - NOT browser compatible (needs special decoder)
  if (nameLower.includes('atmos')) {
    console.log(`  ⚠️ Incompatible audio (Atmos): "${name.substring(0, 60)}..."`);
    return { score: 0.15, codec: 'Atmos', browserCompatible: false };
  }
  
  // TrueHD - NOT browser compatible
  if (nameLower.includes('truehd') || nameLower.includes('true-hd')) {
    console.log(`  ⚠️ Incompatible audio (TrueHD): "${name.substring(0, 60)}..."`);
    return { score: 0.15, codec: 'TrueHD', browserCompatible: false };
  }
  
  // DTS variants - NOT browser compatible
  if (nameLower.includes('dts-hd') || nameLower.includes('dtshd') || nameLower.includes('dts:x')) {
    console.log(`  ⚠️ Incompatible audio (DTS-HD): "${name.substring(0, 60)}..."`);
    return { score: 0.2, codec: 'DTS-HD', browserCompatible: false };
  }
  if (nameLower.includes('dts')) {
    console.log(`  ⚠️ Incompatible audio (DTS): "${name.substring(0, 60)}..."`);
    return { score: 0.25, codec: 'DTS', browserCompatible: false };
  }
  
  // FLAC audio - may not work in all browsers
  if (nameLower.includes('flac')) {
    return { score: 0.6, codec: 'FLAC', browserCompatible: false };
  }
  
  // Check for 5.1/7.1 without codec specified - might be DDP
  if ((nameLower.includes('5.1') || nameLower.includes('7.1')) && 
      !nameLower.includes('ac3') && !nameLower.includes('aac')) {
    // Ambiguous - could be DDP or AC3, slightly lower score
    return { score: 0.5, codec: '5.1', browserCompatible: null };
  }
  
  // Unknown codec - neutral score, assume it might work
  return { score: 0.6, codec: 'Unknown', browserCompatible: null };
}

// Helper function to detect video source quality
function detectSourceQuality(name) {
  const nameLower = name.toLowerCase();
  
  // Excellent sources (highest quality)
  if (nameLower.includes('remux')) return { score: 1.0, source: 'REMUX' };
  if (nameLower.includes('bluray') || nameLower.includes('blu-ray')) return { score: 0.95, source: 'BluRay' };
  if (nameLower.includes('uhd') && !nameLower.includes('hdrip')) return { score: 0.9, source: 'UHD' };
  
  // Good sources (web releases from streaming services)
  if (nameLower.includes('web-dl') || nameLower.includes('webdl')) return { score: 0.85, source: 'WEB-DL' };
  if (nameLower.includes('webrip')) return { score: 0.8, source: 'WEBRip' };
  if (nameLower.includes('webscreener') || nameLower.includes('web-screener')) return { score: 0.75, source: 'WEBSCREENER' }; // Lower score - screener quality
  if (nameLower.includes('screener') && !nameLower.includes('dvdscr')) return { score: 0.7, source: 'SCREENER' }; // Generic screener
  if (nameLower.includes('amzn') || nameLower.includes('amazon')) return { score: 0.82, source: 'AMZN' };
  if (nameLower.includes('nf') || nameLower.includes('netflix')) return { score: 0.82, source: 'NF' };
  if (nameLower.includes('dsnp') || nameLower.includes('disney')) return { score: 0.82, source: 'DSNP' };
  if (nameLower.includes('hmax') || nameLower.includes('hbo')) return { score: 0.82, source: 'HMAX' };
  if (nameLower.includes('atvp') || nameLower.includes('apple')) return { score: 0.82, source: 'ATVP' };
  
  // Decent sources
  if (nameLower.includes('hdtv')) return { score: 0.7, source: 'HDTV' };
  if (nameLower.includes('dvdrip')) return { score: 0.5, source: 'DVDRip' };
  if (nameLower.includes('hdrip')) return { score: 0.6, source: 'HDRip' };
  if (nameLower.includes('bdrip') || nameLower.includes('brrip')) return { score: 0.75, source: 'BDRip' };
  
  return { score: 0.3, source: 'Unknown' };
}

// Helper function to calculate torrent score
function calculateScore(torrent) {
  const name = torrent.Name || '';
  const nameLower = name.toLowerCase();
  
  // ============================================================================
  // Get incremental penalty for low quality sources (no longer binary filter)
  // ============================================================================
  const lowQualityInfo = getLowQualityPenalty(name);
  const lowQualityPenalty = lowQualityInfo.penalty;
  
  // Log if we have a low quality source
  if (lowQualityPenalty < 0) {
    console.log(`  ⚠️ Low quality source (${lowQualityInfo.quality}, penalty: ${lowQualityPenalty}): "${name.substring(0, 60)}..."`);
  }
  
  // ============================================================================
  // Audio Language Check - penalize non-English/dubbed, reward original/English
  // ============================================================================
  const audioLang = detectAudioLanguage(name);
  let languagePenalty = 0;
  let languageReward = 0;
  
  if (audioLang.isForeign) {
    // Heavy penalty for foreign-only audio
    if (audioLang.isDubbed) {
      // Extra heavy penalty for dubbed versions (they replace original audio)
      languagePenalty = -0.7;
      console.log(`  ❌ Foreign dub detected (${audioLang.language}): "${name.substring(0, 60)}..."`);
    } else if (audioLang.dualAudio && audioLang.language.includes('No English')) {
      // Dual/Multi without English - HEAVILY penalize (likely foreign language pair, not English)
      // This is almost as bad as a foreign dub
      languagePenalty = -0.75;
      console.log(`  ❌ Dual audio without English (${audioLang.language}): "${name.substring(0, 60)}..."`);
    } else {
      // Foreign audio but not explicitly dubbed (might be subtitled)
      languagePenalty = -0.5;
      console.log(`  ⚠️ Foreign audio detected (${audioLang.language}): "${name.substring(0, 60)}..."`);
    }
  } else if (audioLang.isDubbed) {
    // Has "dub" but includes English (dual audio) - slight penalty (prefer original)
    if (audioLang.dualAudio) {
      languagePenalty = -0.2;
      console.log(`  ⚠️ Dual audio with dub (${audioLang.language}): "${name.substring(0, 60)}..."`);
    } else {
      // Generic "dubbed" without English indicator - penalize
      languagePenalty = -0.6;
      console.log(`  ❌ Dubbed version detected: "${name.substring(0, 60)}..."`);
    }
  } else if (audioLang.dualAudio) {
    // Dual audio - check if English is explicitly mentioned
    if (audioLang.language.includes('English')) {
      // Dual audio with English - acceptable but not preferred (small penalty)
      languagePenalty = -0.1;
    } else {
      // Dual audio without explicit English - heavily penalize (likely doesn't have English)
      // Better to wait for a torrent with explicit English
      languagePenalty = -0.6;
      console.log(`  ⚠️ Dual audio without explicit English (${audioLang.language}): "${name.substring(0, 60)}..."`);
    }
  } else if (audioLang.language === 'English' || audioLang.language === 'English (assumed)') {
    // Original English - reward it (check if it explicitly mentions English for bigger reward)
    const hasExplicitEnglish = /[\.\-\s](en|eng|english)[\.\-\s]/i.test(nameLower);
    if (hasExplicitEnglish) {
      languageReward = 0.1;
    }
  }
  
  // Check if it explicitly mentions "original" sound/audio (big reward - best case)
  if (nameLower.includes('original') && (nameLower.includes('sound') || nameLower.includes('audio'))) {
    languageReward = 0.15;
  }
  
  // Check for English subtitle indicators (often means original audio) - small reward
  if (/[\.\-\s]en[\.\-\s]sub/i.test(nameLower) && !audioLang.isForeign && !audioLang.isDubbed) {
    languageReward = Math.max(languageReward, 0.05);
  }
  
  // ============================================================================
  // Video Resolution Score (0-1)
  // ============================================================================
  let resolutionScore = 0.1;
  let resolution = 'Unknown';
  // Check for 2160p/4K first (more specific)
  if (nameLower.includes('2160p') || nameLower.includes('4k') || nameLower.includes('uhd') || 
      /\b2160p\b/i.test(name) || /\b4k\b/i.test(name)) {
    resolutionScore = 1.0;
    resolution = '4K';
  } else if (nameLower.includes('1080p') || /\b1080p\b/i.test(name)) {
    resolutionScore = 0.85;
    resolution = '1080p';
  } else if (nameLower.includes('720p') || /\b720p\b/i.test(name)) {
    resolutionScore = 0.6;
    resolution = '720p';
  } else if (nameLower.includes('480p') || nameLower.includes('sd') || /\b480p\b/i.test(name)) {
    resolutionScore = 0.3;
    resolution = '480p';
  }

  // ============================================================================
  // Source Quality Score
  // ============================================================================
  const sourceQuality = detectSourceQuality(name);
  const sourceScore = sourceQuality.score;

  // ============================================================================
  // Seeder Score (0-1) - important for reliability
  // ============================================================================
  const seeders = parseInt(torrent.Seeders) || 0;
  const seederScore = Math.min(seeders / 100, 1); // Need more seeders for max score

  // ============================================================================
  // Size Score - appropriate size for quality level
  // ============================================================================
  let sizeScore = 0.5;
  if (torrent.Size) {
    const sizeStr = torrent.Size.toLowerCase();
    const sizeMatch = sizeStr.match(/(\d+\.?\d*)\s*(gb|mb)/);
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2];
      const sizeInGB = unit === 'gb' ? size : size / 1024;

      // Optimal size ranges based on resolution
      if (resolution === '4K') {
        if (sizeInGB >= 10 && sizeInGB <= 50) sizeScore = 1.0;
        else if (sizeInGB >= 5 && sizeInGB < 10) sizeScore = 0.7;
        else if (sizeInGB > 50) sizeScore = 0.6;
        else sizeScore = 0.3;
      } else if (resolution === '1080p') {
        if (sizeInGB >= 2 && sizeInGB <= 15) sizeScore = 1.0;
        else if (sizeInGB >= 1 && sizeInGB < 2) sizeScore = 0.7;
        else if (sizeInGB > 15 && sizeInGB <= 25) sizeScore = 0.8;
        else sizeScore = 0.4;
      } else if (resolution === '720p') {
        if (sizeInGB >= 0.8 && sizeInGB <= 5) sizeScore = 1.0;
        else if (sizeInGB >= 0.4 && sizeInGB < 0.8) sizeScore = 0.7;
        else sizeScore = 0.5;
      }
    }
  }

  // ============================================================================
  // Video Codec Bonus
  // ============================================================================
  let codecBonus = 0;
  if (nameLower.includes('x265') || nameLower.includes('hevc') || nameLower.includes('h.265') || nameLower.includes('h265')) {
    codecBonus = 0.1;
  } else if (nameLower.includes('x264') || nameLower.includes('h.264') || nameLower.includes('h264') || nameLower.includes('avc')) {
    codecBonus = 0.05;
  }
  
  // HDR bonus
  if (nameLower.includes('hdr10+') || nameLower.includes('hdr10plus')) codecBonus += 0.08;
  else if (nameLower.includes('hdr10') || nameLower.includes('hdr')) codecBonus += 0.05;
  if (nameLower.includes('dolby vision') || nameLower.includes('dv')) codecBonus += 0.05;

  // ============================================================================
  // Audio Compatibility Score (prefer browser-compatible, but transcoding available)
  // ============================================================================
  const audioQuality = detectAudioQuality(name);
  
  // Browser-incompatible audio gets moderate penalty (server will transcode if needed)
  // We still prefer compatible audio to avoid transcoding overhead
  let audioCompatibilityPenalty = 0;
  if (audioQuality.browserCompatible === false) {
    // Moderate penalty - transcoding available but adds latency/CPU usage
    audioCompatibilityPenalty = -0.15;
  } else if (audioQuality.browserCompatible === true) {
    // Bonus for confirmed compatible audio (no transcoding needed)
    audioCompatibilityPenalty = 0.08;
  }
  
  // Audio quality bonus (separate from compatibility)
  const audioBonus = (audioQuality.score - 0.5) * 0.05; // -0.025 to +0.025

  // ============================================================================
  // Trusted Release Group Bonus
  // ============================================================================
  let groupBonus = 0;
  const trustedGroups = [
    'yts', 'rarbg', 'sparks', 'pahe', 'ntb', 'tgx', 'etrg', 'epsilon',
    'flux', 'cinefile', 'hdchina', 'framestor', 'beyondhd', 'sparks',
    'tigole', 'qxr', 'playhd', 'empire', 'evo', 'gaz', 'ctrlhd'
  ];
  if (trustedGroups.some(group => nameLower.includes(group))) groupBonus = 0.05;

  // ============================================================================
  // Penalties for suspicious releases
  // ============================================================================
  let suspiciousPenalty = 0;
  
  // Fake/spam indicators
  if (nameLower.includes('1080p') && nameLower.includes('2160p')) suspiciousPenalty -= 0.5;
  if (nameLower.match(/\d{4}p/g)?.length > 1) suspiciousPenalty -= 0.3;
  
  // Too good to be true sizes
  if (torrent.Size) {
    const sizeStr = torrent.Size.toLowerCase();
    const sizeMatch = sizeStr.match(/(\d+\.?\d*)\s*(gb|mb)/);
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2];
      const sizeInMB = unit === 'gb' ? size * 1024 : size;
      
      // 4K movie under 2GB is likely fake or terrible quality
      if (resolution === '4K' && sizeInMB < 2000) suspiciousPenalty -= 0.5;
      // 1080p movie under 500MB is likely terrible quality
      if (resolution === '1080p' && sizeInMB < 500) suspiciousPenalty -= 0.3;
    }
  }

  // ============================================================================
  // Calculate Final Score
  // ============================================================================
  // Weights: Resolution (25%), Source (20%), Seeders (15%), Size (10%), Audio Compat (20%), rest (10%)
  const baseScore = 
    (resolutionScore * 0.25) + 
    (sourceScore * 0.20) + 
    (seederScore * 0.15) + 
    (sizeScore * 0.10) +
    codecBonus + 
    audioBonus + 
    audioCompatibilityPenalty +  // CRITICAL: Browser audio compatibility
    groupBonus + 
    languagePenalty +           // Penalty for foreign/dubbed audio
    languageReward +            // Reward for original/English audio
    lowQualityPenalty +         // NEW: Incremental penalty for CAM/TS/TC/Screener
    suspiciousPenalty;
  
  // Store detailed scoring info for debugging
  torrent._scoreDetails = {
    resolution,
    resolutionScore,
    source: sourceQuality.source,
    sourceScore,
    seeders,
    seederScore,
    sizeScore,
    codecBonus,
    audioCodec: audioQuality.codec,
    audioBonus,
    audioCompatibilityPenalty,
    browserCompatible: audioQuality.browserCompatible,
    groupBonus,
    languagePenalty,
    languageReward,
    audioLanguage: audioLang.language,
    isDubbed: audioLang.isDubbed || false,
    lowQualityPenalty,          // NEW: Track low quality penalty
    lowQualityType: lowQualityInfo.quality,  // NEW: Track quality type
    suspiciousPenalty,
    finalScore: baseScore
  };

  return baseScore;
}

// Helper function to detect content type from query
function detectContentType(query) {
  const lowerQuery = query.toLowerCase();

  // Anime indicators
  if (lowerQuery.match(/\b(anime|dubbed|subbed)\b/) ||
      lowerQuery.match(/\bepisode \d+\b/) ||
      lowerQuery.match(/\b(s\d{1,2}e\d{1,3})\b/) ||
      lowerQuery.match(/\b(one piece|naruto|attack on titan|demon slayer|dragon ball|my hero academia|fullmetal alchemist|death note|bleach|pokemon|digimon|yu-gi-oh|beyblade|sonic|spongebob|rick and morty|bojack horseman|family guy|the simpsons|south park|american dad|king of the hill|aqua teen hunger force)\b/)) {
    return 'anime';
  }

  // TV show indicators (Season/Episode pattern)
  if (lowerQuery.match(/s\d{1,2}e\d{1,2}/) ||
      lowerQuery.match(/season \d+/) ||
      lowerQuery.match(/\b(complete series|tv series)\b/)) {
    return 'shows';
  }

  // Movie indicators (year pattern or movie keywords)
  if (lowerQuery.match(/\b(19|20)\d{2}\b/) ||
      lowerQuery.match(/\b(movie|film|bluray|webrip|dvdrip)\b/)) {
    return 'movies';
  }

  return 'general';
}

// Helper function to rank torrents
function rankTorrents(results, debug = false) {
  const flattened = results.flat();
  
  if (debug) {
    console.log(`📊 Ranking ${flattened.length} torrents...`);
  }
  
  const scored = flattened
    .filter(t => {
      // Filter out invalid/fake torrents
      const seeders = parseInt(t.Seeders) || 0;
      const name = t.Name || '';
      
      // Basic requirements
      if (seeders < 3) {
        if (debug) console.log(`  ❌ Filtered (low seeders: ${seeders}): ${name.substring(0, 50)}...`);
        return false;
      }
      if (!t.Size) {
        if (debug) console.log(`  ❌ Filtered (no size): ${name.substring(0, 50)}...`);
        return false;
      }
      if (!t.Magnet) {
        if (debug) console.log(`  ❌ Filtered (no magnet): ${name.substring(0, 50)}...`);
        return false;
      }
      
      return true;
    })
    .map(t => ({
      ...t,
      Score: calculateScore(t)
    }))
    // Filter out only truly unusable torrents (very low scores from low quality sources)
    // Let penalties/rewards decide for borderline cases
    .filter(t => {
      // Only filter out if score is extremely low (CAM/TS/TC with no redeeming qualities)
      // This allows WEBSCREENER and other borderline cases to be ranked by score
      if (t.Score < -0.8) {
        console.log(`  ❌ Filtered (extremely low score: ${t.Score.toFixed(2)}): ${(t.Name || '').substring(0, 60)}...`);
        return false;
      }
      return true;
    })
    .sort((a, b) => b.Score - a.Score);
  
  // Log top 5 ranked torrents for debugging
  if (scored.length > 0) {
    console.log(`\n📊 Top ${Math.min(5, scored.length)} torrent candidates:`);
    scored.slice(0, 5).forEach((t, i) => {
      const details = t._scoreDetails || {};
      const compatIcon = details.browserCompatible === true ? '✅' : 
                         details.browserCompatible === false ? '❌' : '❓';
      console.log(`  ${i + 1}. [Score: ${t.Score.toFixed(3)}] ${(t.Name || '').substring(0, 70)}...`);
      console.log(`     Resolution: ${details.resolution || 'Unknown'} (${(details.resolutionScore || 0).toFixed(2)}), Source: ${details.source || 'Unknown'} (${(details.sourceScore || 0).toFixed(2)}), Seeders: ${t.Seeders || 0}`);
      console.log(`     Audio: ${details.audioCodec || 'Unknown'} ${compatIcon} (browser compatible: ${details.browserCompatible ?? 'unknown'})`);
      if (details.audioCompatibilityPenalty < 0) {
        console.log(`     ⚠️ Audio compatibility penalty: ${details.audioCompatibilityPenalty.toFixed(2)} (may have NO SOUND!)`);
      }
      if (details.languagePenalty < 0) {
        console.log(`     ❌ Language penalty: ${details.languagePenalty.toFixed(2)} (${details.audioLanguage}${details.isDubbed ? ' - DUBBED' : ''})`);
      }
      if (details.languageReward > 0) {
        console.log(`     ✅ Language reward: +${details.languageReward.toFixed(2)} (${details.audioLanguage})`);
      }
      if (details.lowQualityPenalty < 0) {
        console.log(`     ⚠️ Low quality penalty: ${details.lowQualityPenalty.toFixed(2)} (${details.lowQualityType})`);
      }
      // Show breakdown of score components
      const baseComponents = `[Res:${(details.resolutionScore * 0.25 || 0).toFixed(2)} + Src:${(details.sourceScore * 0.20 || 0).toFixed(2)} + Seed:${(details.seederScore * 0.15 || 0).toFixed(2)}]`;
      console.log(`     Score breakdown: ${baseComponents} + penalties/rewards = ${t.Score.toFixed(3)}`);
    });
    console.log('');
  }
  
  return scored;
}

// GET /api/torrents/search/:query/best - Get the best torrent for a query
router.get('/:query/best', async (req, res) => {
  const startTime = Date.now();

  try {
    const { query } = req.params;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    // Detect content type for optimal provider routing
    const contentType = detectContentType(query);
    const cacheKey = `${query}_${contentType}_1`;

    // Check cache first
    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey);
      console.log(`⚡ Cache hit for: "${query}" (${Date.now() - cached.timestamp}ms old)`);

      const rankedTorrents = rankTorrents(cached.results);
      const bestTorrent = rankedTorrents[0];
      const queryTime = ((Date.now() - startTime) / 1000).toFixed(1);

      // Build alternatives list (top 10 after the best one)
      const alternativesList = rankedTorrents.slice(1, 11).map(t => {
        const details = t._scoreDetails || {};
        return {
          Name: t.Name,
          Magnet: t.Magnet,
          Size: t.Size,
          Seeders: t.Seeders,
          Score: t.Score,
          Quality: details.resolution || 'Unknown',
          Source: details.source || 'Unknown',
          Language: details.audioLanguage || 'English',
          AudioCodec: details.audioCodec || 'Unknown',
          LowQualityType: details.lowQualityType || 'Good'
        };
      });

      return res.json({
        success: true,
        data: {
          query,
          torrent: {
            ...bestTorrent,
            Quality: cached.bestTorrent.Quality,
            Type: cached.bestTorrent.Type
          },
          // NEW: Include top 10 alternatives for user selection
          alternatives: alternativesList,
          totalFound: rankedTorrents.length,
          queryTime: `${queryTime}s (cached)`
        }
      });
    }

    console.log(`🎯 Finding best torrent for: "${query}" (type: ${contentType})`);

    // Use smart search with content-aware provider routing
    const results = await smartSearch(query, '1', contentType);

    if (!results || results.length === 0 || results.every(arr => !arr || arr.length === 0)) {
      return res.status(404).json({
        success: false,
        error: 'No torrents found',
        query
      });
    }

    // Rank and get the best one
    const rankedTorrents = rankTorrents(results);

    if (rankedTorrents.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No suitable torrents found after filtering',
        query
      });
    }

    const bestTorrent = rankedTorrents[0];
    const queryTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // Get scoring details for logging
    const scoreDetails = bestTorrent._scoreDetails || {};
    const compatIcon = scoreDetails.browserCompatible === true ? '✅' : 
                       scoreDetails.browserCompatible === false ? '⚠️ NOT COMPATIBLE' : '❓ unknown';
    
    console.log(`\n✅ SELECTED BEST TORRENT:`);
    console.log(`   Name: ${bestTorrent.Name}`);
    console.log(`   Score: ${bestTorrent.Score.toFixed(3)}`);
    console.log(`   Resolution: ${scoreDetails.resolution || 'Unknown'} (score: ${(scoreDetails.resolutionScore || 0).toFixed(2)})`);
    console.log(`   Source: ${scoreDetails.source || 'Unknown'} (score: ${(scoreDetails.sourceScore || 0).toFixed(2)})`);
    console.log(`   Seeders: ${bestTorrent.Seeders} (score: ${(scoreDetails.seederScore || 0).toFixed(2)})`);
    console.log(`   Audio: ${scoreDetails.audioCodec || 'Unknown'} - Browser: ${compatIcon}`);
    console.log(`   Language: ${scoreDetails.audioLanguage || 'Unknown'}${scoreDetails.isDubbed ? ' [DUBBED]' : ''}`);
    if (scoreDetails.audioCompatibilityPenalty < 0) {
      console.log(`   ⚠️ Audio Compatibility Penalty: ${scoreDetails.audioCompatibilityPenalty} (may have NO SOUND in browser!)`);
    }
    if (scoreDetails.languagePenalty < 0) {
      console.log(`   ❌ Language Penalty: ${scoreDetails.languagePenalty} (${scoreDetails.isDubbed ? 'dubbed/foreign audio' : 'foreign audio'})`);
    }
    if (scoreDetails.languageReward > 0) {
      console.log(`   ✅ Language Reward: +${scoreDetails.languageReward} (original/English audio)`);
    }
    console.log('');

    // Use detected quality/source from scoring
    const quality = scoreDetails.resolution || 'Unknown';
    const type = scoreDetails.source || 'Unknown';

    // Build alternatives list (top 10 after the best one)
    const alternativesList = rankedTorrents.slice(1, 11).map(t => {
      const details = t._scoreDetails || {};
      return {
        Name: t.Name,
        Magnet: t.Magnet,
        Size: t.Size,
        Seeders: t.Seeders,
        Score: t.Score,
        Quality: details.resolution || 'Unknown',
        Source: details.source || 'Unknown',
        Language: details.audioLanguage || 'English',
        AudioCodec: details.audioCodec || 'Unknown',
        LowQualityType: details.lowQualityType || 'Good'
      };
    });

    // Cache the results
    searchCache.set(cacheKey, {
      results,
      bestTorrent: { ...bestTorrent, Quality: quality, Type: type },
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: {
        query,
        torrent: {
          ...bestTorrent,
          Quality: quality,
          Type: type
        },
        // NEW: Include top 10 alternatives for user selection
        alternatives: alternativesList,
        totalFound: rankedTorrents.length,
        queryTime: `${queryTime}s`
      }
    });

  } catch (error) {
    console.error('❌ Best torrent search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find best torrent',
      message: error.message
    });
  }
});

// GET /api/torrents/search/:query - Search torrents across all sources
router.get('/:query', async (req, res) => {
  const startTime = Date.now();

  try {
    const { query } = req.params;
    const page = req.query.page || '1';

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    // Detect content type for optimal provider routing
    const contentType = detectContentType(query);
    const cacheKey = `${query}_${contentType}_${page}`;

    // Check cache first
    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey);
      console.log(`⚡ Cache hit for: "${query}" page ${page} (${Date.now() - cached.timestamp}ms old)`);

      const queryTime = ((Date.now() - startTime) / 1000).toFixed(1);

      return res.json({
        success: true,
        data: {
          query,
          torrents: cached.enrichedTorrents,
          count: cached.enrichedTorrents.length,
          queryTime: `${queryTime}s (cached)`
        }
      });
    }

    console.log(`🔍 Searching torrents for: "${query}" (type: ${contentType}, page ${page})`);

    // Use smart search with content-aware provider routing
    const results = await smartSearch(query, page, contentType);

    if (!results || results.length === 0 || results.every(arr => !arr || arr.length === 0)) {
      return res.status(404).json({
        success: false,
        error: 'No torrents found',
        query,
        torrents: []
      });
    }

    // Flatten, filter, and rank results
    const rankedTorrents = rankTorrents(results);

    const queryTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ Found ${rankedTorrents.length} torrents in ${queryTime}s`);

    // Extract quality and type info from scoring details
    const enrichedTorrents = rankedTorrents.map(t => {
      const scoreDetails = t._scoreDetails || {};
      
      // Use detected values from scoring, fallback to pattern matching
      const quality = scoreDetails.resolution || 'Unknown';
      const type = scoreDetails.source || 'Unknown';
      const audioCodec = scoreDetails.audioCodec || 'Unknown';
      const audioLanguage = scoreDetails.audioLanguage || 'English';

      return {
        ...t,
        Quality: quality,
        Type: type,
        AudioCodec: audioCodec,
        AudioLanguage: audioLanguage,
        // Preserve _scoreDetails for frontend to access resolution/source directly
        _scoreDetails: t._scoreDetails,
        ScoreDetails: {
          resolution: scoreDetails.resolutionScore,
          source: scoreDetails.sourceScore,
          seeders: scoreDetails.seederScore,
          size: scoreDetails.sizeScore,
          languagePenalty: scoreDetails.languagePenalty
        }
      };
    });

    // Cache the results
    searchCache.set(cacheKey, {
      results,
      enrichedTorrents,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: {
        query,
        torrents: enrichedTorrents,
        count: enrichedTorrents.length,
        queryTime: `${queryTime}s`
      }
    });

  } catch (error) {
    console.error('❌ Torrent search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search torrents',
      message: error.message
    });
  }
});

module.exports = router;
