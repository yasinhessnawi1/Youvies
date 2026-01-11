/**
 * Environment configuration for Youvies
 * Provides centralized access to API endpoints and URLs
 */

export const config = {
  // Base API URL from environment variable or default to localhost
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',

  /**
   * Get streaming URL for a torrent file
   * @param {string} torrentHash - The torrent info hash
   * @param {number} fileIndex - The file index within the torrent
   * @returns {string} Streaming URL
   */
  getStreamUrl: (torrentHash, fileIndex) => {
    return `${config.apiBaseUrl}/torrents/stream/${torrentHash}/files/${fileIndex}/stream`;
  },

  /**
   * Get download URL for a torrent file
   * @param {string} torrentHash - The torrent info hash
   * @param {number} fileIndex - The file index within the torrent
   * @returns {string} Download URL
   */
  getDownloadUrl: (torrentHash, fileIndex) => {
    return `${config.apiBaseUrl}/torrents/stream/${torrentHash}/files/${fileIndex}/download`;
  },

  /**
   * Get subtitle URL for a torrent file
   * @param {string} torrentHash - The torrent info hash
   * @param {number} fileIndex - The file index within the torrent
   * @returns {string} Subtitle URL
   */
  getSubtitleUrl: (torrentHash, fileIndex) => {
    return `${config.apiBaseUrl}/torrents/stream/${torrentHash}/files/${fileIndex}/subtitle`;
  },

  /**
   * Get torrent stats URL
   * @param {string} torrentHash - The torrent info hash
   * @returns {string} Stats URL
   */
  getStatsUrl: (torrentHash) => {
    return `${config.apiBaseUrl}/torrents/stream/${torrentHash}/stats`;
  },

  /**
   * Get torrent base URL (for VideoPlayer compatibility)
   * @param {string} torrentHash - The torrent info hash
   * @returns {string} Torrent base URL
   */
  getTorrentUrl: (torrentHash) => {
    return `${config.apiBaseUrl}/torrents/stream/${torrentHash}`;
  }
};

export default config;
