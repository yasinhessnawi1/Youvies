import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import '../styles/page/InfoPage.css';
import '../styles/page/MediaPage.css';
import Header from '../components/static/Header';
import Footer from '../components/static/Footer';
import { useItemContext } from '../contexts/ItemContext';
import { useParams, useSearchParams } from 'react-router-dom';
import StarryBackground from '../components/static/StarryBackground';
import LoadingIndicator from '../components/static/LoadingIndicator';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import { useLoading } from '../contexts/LoadingContext';
import { useAuth } from '../contexts/AuthContext';
import { useTorrent } from '../contexts/TorrentContext';
import VideoCardGrid from '../components/Carousel';
import CountdownTimer from '../utils/CountdownTimer';
import { getTitle, cleanHtmlTags } from '../utils/helper';
import SearchBar from '../components/SearchBar';
import { TabContext } from '../contexts/TabContext';
import VideoPlayer from '../components/VideoPlayer';
import VideoModal from '../components/VideoModal';
import progressService from '../services/progressService';
import { Calendar, Play, Film, Tv, Globe, Users, TrendingUp, DollarSign, Building2, MapPin, Languages, CalendarDays, Clock3, BarChart3, ExternalLink, Eye, Link as LinkIcon, Home, CheckCircle, XCircle, Info } from 'lucide-react';
import { fetchTvSeasonDetails } from '../api/MediaService';
import { fetchAnimeEpisodes } from '../api/AnimeShowApi';
import { TMDB_API_KEY } from '../api/apiHelpers';

const InfoPage = () => {
  const { activeTab: contextActiveTab } = React.useContext(TabContext);
  const { isLoading, setIsLoading } = useLoading();
  const { videoPlayerState, switchProvider } = useContext(VideoPlayerContext);
  const { category, mediaId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchMediaInfo, itemsCache, setItemsCache } = useItemContext();
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [itemInfo, setItemInfo] = useState(null);
  const [error, setError] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const { addWatchedItem, watchedItems, user, loading } = useAuth();
  const { 
    prepareTorrent, 
    activeHash, 
    activeFileIndex, 
    isDebridStream, 
    torrentSubtitles,
    // NEW: Alternative source selection
    alternativeTorrents,
    currentSourceName,
    switchToAlternativeSource
  } = useTorrent();
  const [torrentStreamUrl, setTorrentStreamUrl] = useState(null);
  const [isProvidersExpanded, setIsProvidersExpanded] = useState(false);
  const [usingTorrent, setUsingTorrent] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoPlayerProgress, setVideoPlayerProgress] = useState(0);
  const previousMediaIdRef = useRef(null);
  const previousCategoryRef = useRef(null);
  const sideContentRef = useRef(null);
  const [infoPageTab, setInfoPageTab] = useState('details');
  const [episodesWithThumbnails, setEpisodesWithThumbnails] = useState([]);
  const [useAdFreePlayer, setUseAdFreePlayer] = useState(true);
  const heroEpisodePanelRef = useRef(null);
  const initializedFromWatchedRef = useRef(false);
  const lastWatchedItemRef = useRef(null);
  const autoplayTriggeredRef = useRef(false);

  // Memoize initializeSelectedSeasonAndEpisode to avoid recreating it every render
  const initializeSelectedSeasonAndEpisode = useCallback(async (item, watchedItemsList, authLoading, currentUser, addToWatched, prepTorrent) => {
    if (!item) return;
    
    // Wait briefly for watchedItems to load if still loading
    // This prevents defaulting to S1E1 when watchedItems is about to load
    if (authLoading) {
      console.log('⏳ Waiting for watchedItems to load...');
      // Wait up to 1.5 seconds, checking every 100ms
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const title = getTitle(item) || '';

    // Check if item is already watched
    const watchedItem = watchedItemsList?.find(w =>
      w.tmdb_id === parseInt(item.id) && w.content_type === item.type
    );

    let initialSeason = { season_number: 1, episode_count: 1 };
    let initialEpisode = { episode_number: 1 };

    if (item.type === 'anime') {
      let seasonNum = 1;
      if (item.season) {
        if (typeof item.season === 'string') {
          const seasonMap = {
            'WINTER': 1, 'winter': 1,
            'SPRING': 2, 'spring': 2,
            'SUMMER': 3, 'summer': 3,
            'FALL': 4, 'fall': 4, 'AUTUMN': 4, 'autumn': 4
          };
          seasonNum = seasonMap[item.season.toLowerCase()] || 1;
        } else {
          seasonNum = parseInt(item.season) || 1;
        }
      }

      initialSeason = {
        season_number: seasonNum,
        episode_count: item.totalEpisodes,
      };
      if (watchedItem) {
        console.log('✅ Found watched anime item:', watchedItem);
        initialSeason = {
          season_number: watchedItem.season || seasonNum,
          episode_count: item.totalEpisodes,
        };
        initialEpisode = { episode_number: watchedItem.episode || 1 };
      }
    } else if (item.seasons && item.seasons.length > 0) {
      initialSeason = item.seasons[0];
      if (watchedItem) {
        console.log('✅ Found watched show item:', watchedItem);
        initialSeason =
          item.seasons.find(
            (s) => s.season_number === watchedItem.season,
          ) || initialSeason;
        initialEpisode = { episode_number: watchedItem.episode || 1 };
      }
    }

    // Add to watched list (only if user is authenticated)
    if (currentUser && !authLoading) {
      try {
        await addToWatched({
          tmdbId: item.id,
          mediaType: item.type,
          title: title,
          season: initialSeason.season_number,
          episode: initialEpisode.episode_number,
          posterPath: item.type === 'anime' ? item.image : item.poster_path,
          rating: item.type === 'anime' ? item.rating : item.vote_average
        });
      } catch (error) {
        console.error('Error adding to watched list:', error);
      }
    }

    setSelectedSeason(initialSeason);
    setSelectedEpisode(initialEpisode);

    // 🚀 PROACTIVE OPTIMIZATION: Start preparing torrent in background immediately
    if (item) {
      if (item.type === 'movies') {
        console.log('🔮 Proactively preparing movie torrent...');
        prepTorrent(item);
      } else if (item.type === 'shows' || item.type === 'anime') {
        console.log('🔮 Proactively preparing episode torrent...');
        prepTorrent(item, initialSeason.season_number, initialEpisode.episode_number);
      }
    }
  }, []);

  useEffect(() => {
    const loadMediaInfo = async () => {
      if (isLoading || !mediaId || !category) return;

      // Prevent unnecessary fetch if mediaId and category haven't changed
      if (
        previousMediaIdRef.current === mediaId &&
        previousCategoryRef.current === category
      ) {
        return;
      }

      // Update refs to current mediaId and category
      previousMediaIdRef.current = mediaId;
      previousCategoryRef.current = category;
      initializedFromWatchedRef.current = false; // Reset initialization flag for new media
      lastWatchedItemRef.current = null; // Reset watched item ref for new media

      // Check cache before fetching
      const cacheKey = `${category}-${mediaId}`;
      if (itemsCache[cacheKey]) {
        setItemInfo(itemsCache[cacheKey]);
        // Wait for watchedItems to load before initializing season/episode
        await initializeSelectedSeasonAndEpisode(itemsCache[cacheKey], watchedItems, loading, user, addWatchedItem, prepareTorrent);
        return;
      }

      setIsLoading(true);
      try {
        const fetchedItem = await fetchMediaInfo(mediaId, category);

        if (!fetchedItem) {
          setError(`Sorry, this ${category.slice(0, -1)} is not available. It may have been removed from our database.`);
          return;
        }

        // FALLBACK: Fetch MyAnimeList ID if missing for anime (needed for VidLink provider)
        if (category === 'anime') {
          const title = getTitle(fetchedItem);
          
          // MyAnimeList ID Fallback
          if (!fetchedItem.malId) {
            try {
              console.log(`🔍 MAL ID missing for ${title}, fetching from Jikan fallback...`);
              const malResponse = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
              const malData = await malResponse.json();
              if (malData.data && malData.data.length > 0) {
                fetchedItem.malId = malData.data[0].mal_id;
                console.log('✅ Found MAL ID via fallback:', fetchedItem.malId);
              }
            } catch (err) {
              console.error('❌ Error in MAL ID fallback fetch:', err);
            }
          }
          
          // TMDB ID Fallback (needed for RiveStream provider)
          if (!fetchedItem.tmdbId) {
            try {
              console.log(`🔍 TMDB ID missing for anime ${title}, fetching from TMDB search...`);
              // Use TMDB search for TV shows (most anime are treated as TV on TMDB)
              const tmdbSearchResponse = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`);
              const tmdbSearchData = await tmdbSearchResponse.json();
              if (tmdbSearchData.results && tmdbSearchData.results.length > 0) {
                fetchedItem.tmdbId = tmdbSearchData.results[0].id;
                console.log('✅ Found TMDB ID for anime via fallback:', fetchedItem.tmdbId);
              }
            } catch (err) {
              console.error('❌ Error in TMDB ID fallback fetch:', err);
            }
          }

          // Update itemsCache if any IDs were found
          if (fetchedItem.malId || fetchedItem.tmdbId) {
            const cacheKey = `${category}-${mediaId}`;
            setItemsCache(prev => ({
              ...prev,
              [cacheKey]: { ...fetchedItem }
            }));
          }
        }

        setItemInfo(fetchedItem);
        // Wait for watchedItems to load before initializing season/episode
        await initializeSelectedSeasonAndEpisode(fetchedItem, watchedItems, loading, user, addWatchedItem, prepareTorrent);
      } catch (err) {
        console.error('Error loading media info:', err);
        setError('Failed to load media information. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadMediaInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, category]); // Only re-run when mediaId or category changes

  // Re-initialize season/episode when watchedItems finishes loading
  // This handles the case where media info loads before watchedItems
  // Memoize itemInfo properties to avoid unnecessary re-runs
  const itemInfoId = itemInfo?.id;
  const itemInfoType = itemInfo?.type;
  const itemInfoTotalEpisodes = itemInfo?.totalEpisodes;
  const itemInfoSeasons = itemInfo?.seasons;
  const itemInfoSeason = itemInfo?.season;

  useEffect(() => {
    if (!itemInfo || loading) return;
    
    const watchedItem = watchedItems.find(w =>
      w.tmdb_id === parseInt(itemInfo.id) && w.content_type === itemInfo.type
    );

    if (!watchedItem) {
      return; // No watched item found
    }

    // Use functional update to check current state and update if needed
    setSelectedEpisode(currentEpisode => {
      // Check if current episode already matches watchedItem
      if (currentEpisode?.episode_number === watchedItem.episode) {
        console.log('✅ Episode already matches watchedItem, no update needed');
        lastWatchedItemRef.current = watchedItem;
        return currentEpisode;
      }

      const isDefaultEpisode = 
        currentEpisode?.episode_number === 1 || !currentEpisode;

      const watchedItemKey = `${watchedItem.season}-${watchedItem.episode}`;
      const lastWatchedKey = lastWatchedItemRef.current 
        ? `${lastWatchedItemRef.current.season}-${lastWatchedItemRef.current.episode}`
        : null;
      
      const alreadyProcessed = watchedItemKey === lastWatchedKey;

      console.log('🔍 Episode update check:', {
        isDefaultEpisode,
        currentEpisode: currentEpisode?.episode_number,
        watchedEpisode: watchedItem.episode,
        alreadyProcessed
      });

      if (isDefaultEpisode || !alreadyProcessed) {
        console.log('🔄 Updating episode from watchedItems:', watchedItem.episode);
        lastWatchedItemRef.current = watchedItem;
        return { episode_number: watchedItem.episode || 1 };
      }

      console.log('⏭️ User has selected non-default episode, not overriding');
      return currentEpisode;
    });

    // Also update season
    setSelectedSeason(currentSeason => {
      if (itemInfo.type === 'anime') {
        let seasonNum = watchedItem.season || 1;
        if (itemInfoSeason) {
          if (typeof itemInfoSeason === 'string') {
            const seasonMap = {
              'WINTER': 1, 'winter': 1,
              'SPRING': 2, 'spring': 2,
              'SUMMER': 3, 'summer': 3,
              'FALL': 4, 'fall': 4, 'AUTUMN': 4, 'autumn': 4
            };
            seasonNum = seasonMap[itemInfoSeason.toLowerCase()] || seasonNum;
          } else {
            seasonNum = parseInt(itemInfoSeason) || seasonNum;
          }
        }
        
        if (currentSeason?.season_number === 1 || !currentSeason || currentSeason?.season_number !== watchedItem.season) {
          return {
            season_number: watchedItem.season || seasonNum,
            episode_count: itemInfoTotalEpisodes,
          };
        }
      } else if (itemInfoSeasons && itemInfoSeasons.length > 0) {
        const foundSeason = itemInfoSeasons.find(
          (s) => s.season_number === watchedItem.season
        );
        if (foundSeason && (currentSeason?.season_number === 1 || !currentSeason || currentSeason?.season_number !== watchedItem.season)) {
          return foundSeason;
        }
      }

      return currentSeason;
    });
  }, [watchedItems, loading, itemInfoId, itemInfoType, itemInfoTotalEpisodes, itemInfoSeasons, itemInfoSeason, itemInfo]);

  useEffect(() => {
    if (selectedEpisode && sideContentRef.current) {
      const episodeIndex = selectedEpisode.episode_number - 1;
      // Look for tab-episode-card in the tab view
      const scrollContainer = sideContentRef.current.querySelector('.tab-episode-cards');
      const episodeElement = scrollContainer?.querySelector(
        `.tab-episode-card:nth-child(${episodeIndex + 1})`,
      );

      if (episodeElement && scrollContainer) {
        episodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedEpisode]);

  // Fetch episode thumbnails for hero episode cards
  useEffect(() => {
    const fetchEpisodeThumbnails = async () => {
      if (!itemInfo || itemInfo.type === 'movies') {
        setEpisodesWithThumbnails([]);
        return;
      }

      if (itemInfo.type === 'shows' && selectedSeason) {
        try {
          const seasonData = await fetchTvSeasonDetails(itemInfo.id, selectedSeason.season_number);
          if (seasonData && seasonData.episodes) {
            const episodes = seasonData.episodes.map(ep => ({
              ...ep,
              thumbnail_url: ep.still_path 
                ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
                : null
            }));
            setEpisodesWithThumbnails(episodes);
          }
        } catch (error) {
          console.error('Error fetching episode thumbnails:', error);
          setEpisodesWithThumbnails([]);
        }
      } else if (itemInfo.type === 'anime' && selectedSeason) {
        try {
          console.log('Fetching anime episodes for ID:', itemInfo.id);
          console.log('itemInfo structure:', { 
            hasEpisodes: !!itemInfo.episodes, 
            totalEpisodes: itemInfo.totalEpisodes,
            episodesType: Array.isArray(itemInfo.episodes) ? 'array' : typeof itemInfo.episodes
          });
          console.log('Full itemInfo keys:', Object.keys(itemInfo));
          console.log('itemInfo.episodes:', itemInfo.episodes);
          console.log('itemInfo sample:', JSON.stringify(itemInfo, null, 2).substring(0, 1000));
          
          // Try to fetch episodes from the API
          const episodesData = await fetchAnimeEpisodes(itemInfo.id);
          console.log('Episodes API response:', episodesData);
          
          // If API returned null or empty, we'll generate episodes from totalEpisodes
          if (episodesData === null || (Array.isArray(episodesData) && episodesData.length === 0)) {
            console.log('Generating episodes from totalEpisodes:', itemInfo.totalEpisodes);
            // Generate episodes with potential image URLs
            const totalEps = itemInfo.totalEpisodes || 1;
            const episodes = Array.from({ length: totalEps }, (_, i) => {
              const episodeNum = i + 1;
              // Try to construct episode image URL (common patterns)
              // Some APIs use patterns like: cover image, or episode-specific images
              let thumbnailUrl = null;
              
              // Try common episode image patterns
              if (itemInfo.cover) {
                // Use cover as fallback for episode images
                thumbnailUrl = itemInfo.cover;
              } else if (itemInfo.image) {
                thumbnailUrl = itemInfo.image;
              }
              
              return {
                episode_number: episodeNum,
                name: `Episode ${episodeNum}`,
                thumbnail_url: thumbnailUrl,
                runtime: itemInfo.duration || 24
              };
            });
            setEpisodesWithThumbnails(episodes);
            return;
          }
          
          if (episodesData && Array.isArray(episodesData) && episodesData.length > 0) {
            // If API returns episodes array
            console.log('Using episodes from API array, count:', episodesData.length);
            const episodes = episodesData.map((ep, index) => {
              const episodeNumber = ep.number || ep.episodeNumber || ep.episode || index + 1;
              const episodeTitle = ep.title || ep.name || `Episode ${episodeNumber}`;
              // API returns 'image' field with full URL
              const thumbnail = ep.image || ep.thumbnail || ep.img || ep.thumbnailUrl || null;
              
              return {
                episode_number: episodeNumber,
                name: episodeTitle,
                thumbnail_url: thumbnail,
                runtime: ep.duration || ep.runtime || itemInfo.duration || 24
              };
            });
            console.log('Processed episodes:', episodes);
            setEpisodesWithThumbnails(episodes);
          } else if (episodesData && episodesData.episodes && Array.isArray(episodesData.episodes)) {
            // If API returns object with episodes array
            console.log('Using episodes from API object.episodes, count:', episodesData.episodes.length);
            const episodes = episodesData.episodes.map((ep, index) => {
              const episodeNumber = ep.number || ep.episodeNumber || ep.episode || index + 1;
              const episodeTitle = ep.title || ep.name || `Episode ${episodeNumber}`;
              const thumbnail = ep.image || ep.thumbnail || ep.img || ep.thumbnailUrl || null;
              
              return {
                episode_number: episodeNumber,
                name: episodeTitle,
                thumbnail_url: thumbnail,
                runtime: ep.duration || ep.runtime || itemInfo.duration || 24
              };
            });
            setEpisodesWithThumbnails(episodes);
          } else if (itemInfo.episodes && Array.isArray(itemInfo.episodes)) {
            // Fallback: check if episodes are in itemInfo
            console.log('Using episodes from itemInfo, count:', itemInfo.episodes.length);
            const episodes = itemInfo.episodes.map((ep, index) => {
              const episodeNumber = ep.number || ep.episodeNumber || ep.episode || index + 1;
              const episodeTitle = ep.title || ep.name || `Episode ${episodeNumber}`;
              const thumbnail = ep.image || ep.thumbnail || ep.img || ep.thumbnailUrl || null;
              
              return {
                episode_number: episodeNumber,
                name: episodeTitle,
                thumbnail_url: thumbnail,
                runtime: ep.duration || ep.runtime || itemInfo.duration || 24
              };
            });
            setEpisodesWithThumbnails(episodes);
          } else {
            // Final fallback: create episodes from totalEpisodes
            console.log('Creating fallback episodes from totalEpisodes:', itemInfo.totalEpisodes);
            const episodes = Array.from({ length: itemInfo.totalEpisodes || 0 }, (_, i) => ({
              episode_number: i + 1,
              name: `Episode ${i + 1}`,
              thumbnail_url: null,
              runtime: itemInfo.duration || 24
            }));
            setEpisodesWithThumbnails(episodes);
          }
        } catch (error) {
          console.error('Error fetching anime episodes:', error);
          // Fallback: create episodes from totalEpisodes
          const episodes = Array.from({ length: itemInfo.totalEpisodes || 0 }, (_, i) => ({
            episode_number: i + 1,
            name: `Episode ${i + 1}`,
            thumbnail_url: null,
            runtime: itemInfo.duration || 24
          }));
          setEpisodesWithThumbnails(episodes);
        }
      }
    };

    fetchEpisodeThumbnails();
  }, [itemInfo, selectedSeason]);

  // Use proactively prepared torrent for preview
  // Memoize the key values to avoid unnecessary re-runs
  const selectedSeasonNumber = selectedSeason?.season_number;
  const selectedEpisodeNumber = selectedEpisode?.episode_number;

  useEffect(() => {
    const handlePreparedTorrent = async () => {
      // Early return if essential data is missing
      if (!itemInfoId) {
        return;
      }

      // For shows/anime, wait for season/episode to be selected
      if ((itemInfoType === 'shows' || itemInfoType === 'anime') && (!selectedSeasonNumber || !selectedEpisodeNumber)) {
        return;
      }

      // Reset torrent state
      setTorrentStreamUrl(null);
      setUsingTorrent(false);

      console.log('🎬 Getting prepared torrent for preview...');

      // Get or wait for the prepared torrent (reuses in-progress preparation)
      // For movies, don't pass season/episode to match the cache key from proactive prep
      const streamUrl = itemInfoType === 'movies'
        ? await prepareTorrent(itemInfo)
        : await prepareTorrent(itemInfo, selectedSeasonNumber, selectedEpisodeNumber);

      if (streamUrl) {
        console.log('✅ Torrent stream ready, using torrent player');
        console.log('📍 Stream URL:', streamUrl);
        setTorrentStreamUrl(streamUrl);
        setUsingTorrent(true);

        // Debug: Log state after setting
        setTimeout(() => {
          console.log('🔍 State after torrent ready:');
          console.log('   - torrentStreamUrl is set:', !!streamUrl);
          console.log('   - usingTorrent:', true);
          console.log('   - showVideoModal:', false);
          console.log('💡 Preview video should now be visible. Click it to open full player.');
        }, 100);
      } else {
        console.log('ℹ️ Torrent preparation failed, using default iframe player');
        setUsingTorrent(false);
      }
    };

    handlePreparedTorrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemInfoId, itemInfoType, selectedSeasonNumber, selectedEpisodeNumber, prepareTorrent]);

  // Autoplay support - triggered when navigating from Random page with ?autoplay=true
  useEffect(() => {
    const shouldAutoplay = searchParams.get('autoplay') === 'true';
    
    if (shouldAutoplay && !autoplayTriggeredRef.current && itemInfo && !isLoading) {
      // Wait for torrent to be ready (or timeout after 5 seconds)
      const autoplayTimeout = setTimeout(() => {
        if (!autoplayTriggeredRef.current) {
          console.log('🎬 Autoplay: Starting playback...');
          autoplayTriggeredRef.current = true;
          
          // Clear the autoplay param from URL
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('autoplay');
          setSearchParams(newParams, { replace: true });
          
          // Load saved progress if available
          if (activeHash && activeFileIndex !== null) {
            const progress = progressService.getProgress(activeHash, activeFileIndex);
            setVideoPlayerProgress(progress?.currentTime || 0);
          }
          
          // Open the video player
          setUseAdFreePlayer(true);
          setShowVideoModal(true);
        }
      }, usingTorrent && torrentStreamUrl ? 0 : 3000); // Immediate if torrent ready, else wait a bit
      
      return () => clearTimeout(autoplayTimeout);
    }
  }, [searchParams, setSearchParams, itemInfo, isLoading, usingTorrent, torrentStreamUrl, activeHash, activeFileIndex]);

  // Reset autoplay flag when navigating to new media
  useEffect(() => {
    autoplayTriggeredRef.current = false;
  }, [mediaId, category]);

  const handleSeasonChange = async (season) => {
    setSelectedSeason(season);
    handleEpisodeChange({ episode_number: 1 });
  };

  const handleEpisodeChange = async (episode, openVideoModal = false, seasonOverride = null) => {
    setSelectedEpisode(episode);

    // Guard against undefined itemInfo
    if (!itemInfo?.id) {
      console.warn('Cannot update watched item: itemInfo is undefined');
      return;
    }

    const currentSeason = seasonOverride || selectedSeason;

    try {
      await addWatchedItem({
        tmdbId: itemInfo.id,
        mediaType: itemInfo.type,
        title: getTitle(itemInfo),
        season: currentSeason?.season_number || 1,
        episode: episode.episode_number,
        posterPath: itemInfo.poster_path || itemInfo.image,
        rating: itemInfo.vote_average || itemInfo.rating
      });
    } catch (error) {
      console.error('Error updating watched item:', error);
    }

    // If openVideoModal is true, open the video player modal
    if (openVideoModal) {
      // Load saved progress if available
      if (activeHash && activeFileIndex !== null) {
        const progress = progressService.getProgress(activeHash, activeFileIndex);
        setVideoPlayerProgress(progress?.currentTime || 0);
      }
      
      setUseAdFreePlayer(true);
      setShowVideoModal(true);
    }
  };

  const handleNextEpisode = useCallback(() => {
    if (!itemInfo || itemInfo.type === 'movies' || !selectedEpisode) return;

    // Find the next episode in the current season
    const currentEpisodeNum = selectedEpisode.episode_number;
    const nextEpisode = episodesWithThumbnails.find(ep => ep.episode_number === currentEpisodeNum + 1);

    if (nextEpisode) {
      console.log('⏭️ Found next episode in current season:', nextEpisode.episode_number);
      handleEpisodeChange(nextEpisode, true);
    } else {
      // Check if there's a next season
      if (itemInfo.type === 'shows' && itemInfo.seasons && selectedSeason) {
        const currentSeasonNum = selectedSeason.season_number;
        const nextSeason = itemInfo.seasons.find(s => s.season_number === currentSeasonNum + 1);
        
        if (nextSeason) {
          console.log('⏭️ Found next season:', nextSeason.season_number);
          handleSeasonChange(nextSeason);
          // handleSeasonChange calls handleEpisodeChange({ episode_number: 1 }) which defaults to false
          // We want it to open the modal, so we manually call it with true and pass the new season
          handleEpisodeChange({ episode_number: 1 }, true, nextSeason);
        } else {
          console.log('🏁 No more episodes or seasons found');
          setShowVideoModal(false);
        }
      } else if (itemInfo.type === 'anime' && itemInfo.totalEpisodes > currentEpisodeNum) {
        // For anime, just increment episode (usually seasons are handled as separate entries or continuous)
        console.log('⏭️ Incrementing anime episode');
        handleEpisodeChange({ episode_number: currentEpisodeNum + 1 }, true);
      } else {
        console.log('🏁 Reached end of series');
        setShowVideoModal(false);
      }
    }
  }, [itemInfo, selectedEpisode, episodesWithThumbnails, selectedSeason, handleEpisodeChange, handleSeasonChange]);

  const handleWatchFromBeginning = async () => {
    if (!itemInfo) return;
    
    // Load saved progress if available
    if (activeHash && activeFileIndex !== null) {
      const progress = progressService.getProgress(activeHash, activeFileIndex);
      setVideoPlayerProgress(progress?.currentTime || 0);
    }
    
    setUseAdFreePlayer(true);
    setShowVideoModal(true);
  };

  const handleContinue = async () => {
    if (!itemInfo) return;
    
    const watchedItem = watchedItems?.find(w =>
      w.tmdb_id === parseInt(itemInfo.id) && w.content_type === itemInfo.type
    );
    
    if (watchedItem) {
      // Set season/episode from watched item
      if (itemInfo.type === 'shows' && itemInfo.seasons) {
        const season = itemInfo.seasons.find(s => s.season_number === watchedItem.season);
        if (season) {
          setSelectedSeason(season);
          setSelectedEpisode({ episode_number: watchedItem.episode });
        }
      } else if (itemInfo.type === 'anime') {
        setSelectedEpisode({ episode_number: watchedItem.episode });
      }
      
      // Load saved progress
      if (activeHash && activeFileIndex !== null) {
        const progress = progressService.getProgress(activeHash, activeFileIndex);
        setVideoPlayerProgress(progress?.currentTime || 0);
      }
      
      setUseAdFreePlayer(true);
      setShowVideoModal(true);
    }
  };

  /**
   * Handle user switching to an alternative torrent source
   * Called from VideoPlayer settings menu
   */
  const handleSourceChange = async (newSource) => {
    console.log('🔄 User requested source change:', newSource.Name);
    
    const newUrl = await switchToAlternativeSource(
      newSource, 
      itemInfo, 
      selectedEpisode?.episode_number
    );
    
    if (newUrl) {
      console.log('✅ Successfully switched to new source');
      setTorrentStreamUrl(newUrl);
    } else {
      console.error('❌ Failed to switch source');
      // Optionally show error toast to user
    }
  };

  const constructVideoUrl = (provider, season = 1, episode = 1) => {
    const id = itemInfo?.id; // AniList ID for anime, TMDB ID for movies/shows
    if (!id) return '';

    // Standardize TMDB ID usage:
    // For anime, use fetched tmdbId (fallback to id which is anilist id if search failed).
    // For movies/shows, id is already the TMDB ID.
    const tmdbId = itemInfo.type === 'anime' ? (itemInfo.tmdbId || id) : id;

    switch (provider) {
      case 'VidRock':
        if (itemInfo.type === 'shows' || itemInfo.type === 'anime') {
          return `https://vidrock.net/tv/${tmdbId}/${season}/${episode}?autoplay=true&autonext=true&theme=00ff00`;
        } else {
          const imdbId = itemInfo.imdb_id || itemInfo.external_ids?.imdb_id;
          return `https://vidrock.net/movie/${imdbId || id}?autoplay=true&autonext=true&theme=00ff00`;
        }
      case 'VidLink':
        if (itemInfo.type === 'anime') {
          const malId = itemInfo.malId || itemInfo.id; // Support both, prefer malId
          const subOrDub = itemInfo.subOrDub || 'sub';
          return `https://vidlink.pro/anime/${malId}/${episode}/${subOrDub}?fallback=true&autoplay=true&nextbutton=true`;
        } else if (itemInfo.type === 'shows') {
          return `https://vidlink.pro/tv/${id}/${season}/${episode}?autoplay=true&nextbutton=true`;
        } else {
          return `https://vidlink.pro/movie/${id}?autoplay=true&nextbutton=true`;
        }
      case 'NontonGo':
        return (itemInfo.type === 'shows' || itemInfo.type === 'anime')
          ? `https://NontonGo.win/embed/tv/${tmdbId}/${season}/${episode}?autoplay=true&autonext=true&nextbutton=true`
          : `https://NontonGo.win/embed/movie/${tmdbId}?autoplay=true&autonext=true&nextbutton=true`;
      case 'SuperEmbed':
        return (itemInfo.type === 'shows' || itemInfo.type === 'anime')
          ? `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}?autoplay=true&autonext=true&nextbutton=true`
          : `https://moviesapi.club/movie/${tmdbId}?autoplay=true&autonext=true&nextbutton=true`;
      case 'Vidsrc' :
        if (itemInfo.type === 'shows' || itemInfo.type === 'anime') {
          return `https://vidsrc.cc/v3/embed/tv/${tmdbId}/${season}/${episode}?autoPlay=true&autonext=true&autonextbutton=true`;
        } else {
          return `https://vidsrc.cc/v3/embed/movie/${tmdbId}?autoPlay=true&autonext=true&autonextbutton=true`;
        }

      case 'VidZee':
        if (itemInfo.type === 'shows' || itemInfo.type === 'anime') {
          return `https://player.vidzee.wtf/v2/embed/tv/${tmdbId}/${season}/${episode}?autoplay=true&autonext=true&nextbutton=true`;
        } else {
          return `https://player.vidzee.wtf/v2/embed/movie/${tmdbId}?autoplay=true&autonext=true&nextbutton=true`;
        }
      case 'RiveStream':
        if (itemInfo.type === 'shows' || itemInfo.type === 'anime') {
          return `https://rivestream.org/embed?type=tv&id=${tmdbId}&season=${season}&episode=${episode}`;
        } else {
          return `https://rivestream.org/embed?type=movie&id=${tmdbId}`;
        }
      case 'RiveTorrent':
        if (itemInfo.type === 'shows' || itemInfo.type === 'anime') {
          return `https://rivestream.org/embed/torrent?type=tv&id=${tmdbId}&season=${season}&episode=${episode}`;
        } else {
          return `https://rivestream.org/embed/torrent?type=movie&id=${tmdbId}`;
        }
      case 'RiveAggregator':
        if (itemInfo.type === 'shows' || itemInfo.type === 'anime') {
          return `https://rivestream.org/embed/agg?type=tv&id=${tmdbId}&season=${season}&episode=${episode}`;
        } else {
          return `https://rivestream.org/embed/agg?type=movie&id=${tmdbId}`;
        }
      default:
        return '';
    }
  };

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!itemInfo) {
    return null; // or a loading state
  }
  const toggleSearchBar = () => {
    document.getElementById('infoPage').scrollIntoView({ behavior: 'smooth' });
  };

  const videoSrc = constructVideoUrl(
    videoPlayerState.provider,
    selectedSeason?.season_number,
    selectedEpisode?.episode_number,
  );
  const backdropUrl = itemInfo.backdrop_path
    ? `https://image.tmdb.org/t/p/original${itemInfo.backdrop_path}`
    : itemInfo.cover
      ? itemInfo.cover
      : itemInfo.poster_path
        ? `https://image.tmdb.org/t/p/original${itemInfo.poster_path}`
        : null;
  const title = getTitle(itemInfo);
  
  // Get watched item for Continue button
  const watchedItem = watchedItems?.find(w =>
    w.tmdb_id === parseInt(itemInfo.id) && w.content_type === itemInfo.type
  );
  
  // Compute the effective selected episode - use watchedItem if selectedEpisode is still default
  // This ensures the episode list highlights correctly even before the state update completes
  const effectiveSelectedEpisode = (() => {
    // If selectedEpisode matches watchedItem, use it
    if (selectedEpisode?.episode_number === watchedItem?.episode) {
      return selectedEpisode;
    }
    // If selectedEpisode is default (1) or not set, and we have a watchedItem, use watchedItem
    if ((selectedEpisode?.episode_number === 1 || !selectedEpisode) && watchedItem?.episode) {
      return { episode_number: watchedItem.episode };
    }
    // Otherwise use selectedEpisode as-is
    return selectedEpisode;
  })();
  
  // Get year, rating, runtime info
  const year = itemInfo.release_date 
    ? new Date(itemInfo.release_date).getFullYear()
    : itemInfo.first_air_date
      ? new Date(itemInfo.first_air_date).getFullYear()
      : itemInfo.startDate?.year || '';
  
  const rating = itemInfo.vote_average 
    ? itemInfo.vote_average.toFixed(1)
    : itemInfo.rating 
      ? (itemInfo.rating / 10).toFixed(1)
      : '';
  
  const runtime = itemInfo.type === 'movies'
    ? `${itemInfo.runtime || 0} min`
    : itemInfo.type === 'shows'
      ? `${itemInfo.number_of_seasons || 0} Seasons`
      : itemInfo.totalEpisodes
        ? `${itemInfo.totalEpisodes} Episodes`
        : '';
  
  const overview = itemInfo.type === 'anime' 
    ? cleanHtmlTags(itemInfo.overview || itemInfo.description || '')
    : itemInfo.overview || itemInfo.description || '';

  const renderSubInfo = () => {
    const renderDetailCard = (icon, label, value, highlight = false, compact = false, span2 = false) => {
      if (!value) return null;
      return (
        <div className={`detail-card ${highlight ? 'highlight' : ''} ${compact ? 'compact' : ''} ${span2 ? 'span-2' : ''}`}>
          <div className="detail-card-icon">{icon}</div>
          <div className="detail-card-content">
            <div className="detail-card-label">{label}</div>
            <div className="detail-card-value">{value}</div>
          </div>
        </div>
      );
    };

    const renderGenreBadges = (genres) => {
      if (!genres || genres.length === 0) return null;
      const genreList = Array.isArray(genres) 
        ? (genres[0]?.name ? genres.map(g => g.name) : genres)
        : [];
      return (
        <div className="detail-card full-width">
          <div className="detail-card-icon"><Film size={20} /></div>
          <div className="detail-card-content">
            <div className="detail-card-label">Genres</div>
            <div className="genre-badges">
              {genreList.map((genre, idx) => (
                <span key={idx} className="genre-badge">{genre}</span>
              ))}
            </div>
          </div>
        </div>
      );
    };


    const renderLinksCard = (links) => {
      const validLinks = links.filter(l => l.url);
      if (validLinks.length === 0) return null;
      return (
        <div className="detail-card full-width links-card">
          {validLinks.map((link, idx) => (
            <a 
              key={idx} 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="link-button"
            >
              {link.icon}
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      );
    };

    const renderSectionHeader = (title) => (
      <div className="details-group-title">{title}</div>
    );

    const renderNextEpisodeFeatured = (nextEpisode) => {
      if (!nextEpisode) return null;
      const episodeTitle = nextEpisode.name || `Episode ${nextEpisode.episode_number || nextEpisode.episode}`;
      let airDate = nextEpisode.air_date;
      let countdownDate = airDate;
      
      // Handle anime airingTime (Unix timestamp)
      if (!airDate && nextEpisode.airingTime) {
        const dateObj = new Date(nextEpisode.airingTime * 1000);
        airDate = dateObj.toISOString().split('T')[0];
        countdownDate = dateObj;
      } else if (airDate) {
        countdownDate = new Date(airDate);
      }
      
      return (
        <div className="next-episode-featured">
          <div className="next-episode-badge">UPCOMING</div>
          <div className="next-episode-info">
            <div className="next-episode-label">Next Episode</div>
            <div className="next-episode-title">{episodeTitle}</div>
            {airDate && <div className="next-episode-date">{airDate}</div>}
            {nextEpisode.runtime && <div className="next-episode-date" style={{ fontSize: '0.9rem', color: '#999' }}>{nextEpisode.runtime} min</div>}
          </div>
          <div className="next-episode-countdown">
            {countdownDate && <CountdownTimer targetDate={countdownDate} />}
          </div>
        </div>
      );
    };

    const renderStatsBadges = (stats, isAnime = false, hasRating = false) => {
      const validStats = stats.filter(s => s.value !== null && s.value !== undefined && s.value !== '');
      if (validStats.length === 0) return null;
      // For anime: use column layout only if there's no rating (to save space)
      // If rating exists, use normal horizontal layout
      const useColumnLayout = isAnime && !hasRating;
      return (
        <div className={`stats-badges ${useColumnLayout ? 'stats-badges-anime' : ''}`}>
          {validStats.map((stat, idx) => (
            <div key={idx} className="stat-badge">
              <div className="stat-badge-value">{stat.value}</div>
              <div className="stat-badge-label">{stat.label}</div>
            </div>
          ))}
        </div>
      );
    };

    switch (itemInfo.type) {
      case 'anime':
        const animeStartDate = itemInfo.startDate?.year 
          ? `${itemInfo.startDate.year}${itemInfo.startDate.month ? `-${String(itemInfo.startDate.month).padStart(2, '0')}` : ''}${itemInfo.startDate.day ? `-${String(itemInfo.startDate.day).padStart(2, '0')}` : ''}`
          : itemInfo.startDate?.year;
        const animeEndDate = itemInfo.endDate?.year 
          ? `${itemInfo.endDate.year}${itemInfo.endDate.month ? `-${String(itemInfo.endDate.month).padStart(2, '0')}` : ''}${itemInfo.endDate.day ? `-${String(itemInfo.endDate.day).padStart(2, '0')}` : ''}`
          : null;
        // overview is already cleaned at the source for anime
        const cleanDescription = overview || null;
        
        // Prepare primary stats
        const animePrimaryStats = [
          { value: itemInfo.rating ? `${itemInfo.rating}/100` : null, label: 'Rating' },
          { value: (itemInfo.currentEpisode || itemInfo.totalEpisodes) ? `${itemInfo.currentEpisode || 0}/${itemInfo.totalEpisodes || 0}` : null, label: 'Episodes' },
          { value: itemInfo.duration ? `${itemInfo.duration} min` : null, label: 'Duration' }
        ];

        // Prepare links
        const animeLinks = [
          itemInfo.malId ? { 
            url: `https://myanimelist.net/anime/${itemInfo.malId}`, 
            label: 'MyAnimeList', 
            icon: <ExternalLink size={18} /> 
          } : null,
          itemInfo.trailer?.id ? { 
            url: `https://www.youtube.com/watch?v=${itemInfo.trailer.id}`, 
            label: 'Trailer', 
            icon: <Play size={18} /> 
          } : null
        ].filter(Boolean);

        return (
          <div className="details-container">
            <div className="details-header">
              <h2>About</h2>
            </div>
            <div className="details-grid">
              {/* Level 1: Description Hero */}
              {cleanDescription && (
                <div className="detail-card full-width description-card">
                  <div className="detail-card-content">
                    <div className="detail-card-label">Description</div>
                    <div className="detail-card-value description-text">{cleanDescription}</div>
                  </div>
                </div>
              )}

              {/* Level 2: Primary Row - Title + Stats */}
              {renderDetailCard(<Film size={20} />, 'Title', title, true)}
              {renderStatsBadges(animePrimaryStats, true, !!itemInfo.rating)}
              
              {/* Title Variations */}
              {itemInfo.title?.romaji && itemInfo.title.romaji !== title && 
                renderDetailCard(<Globe size={20} />, 'Romaji Title', itemInfo.title.romaji)}
              {itemInfo.title?.english && itemInfo.title.english !== title && 
                renderDetailCard(<Globe size={20} />, 'English Title', itemInfo.title.english)}
              {itemInfo.title?.native && itemInfo.title.native !== title && 
                renderDetailCard(<Globe size={20} />, 'Native Title', itemInfo.title.native)}

              {/* Level 3: Genres */}
              {renderGenreBadges(itemInfo.genres)}

              {/* Level 4: Dates Section */}
              <div className="details-group">
                {renderSectionHeader('Dates & Schedule')}
                {animeStartDate && renderDetailCard(<Calendar size={20} />, 'Start Date', animeStartDate)}
                {animeEndDate && renderDetailCard(<Calendar size={20} />, 'End Date', animeEndDate)}
                {itemInfo.releaseDate && renderDetailCard(<Calendar size={20} />, 'Release Year', itemInfo.releaseDate)}
                {itemInfo.season && renderDetailCard(<CalendarDays size={20} />, 'Season', `${itemInfo.season} ${itemInfo.startDate?.year || ''}`.trim())}
                {/* Featured Next Episode - separate row */}
                {itemInfo.nextAiringEpisode && renderNextEpisodeFeatured({
                  episode: itemInfo.nextAiringEpisode.episode,
                  episode_number: itemInfo.nextAiringEpisode.episode,
                  name: `Episode ${itemInfo.nextAiringEpisode.episode}`,
                  air_date: itemInfo.nextAiringEpisode.airingTime ? new Date(itemInfo.nextAiringEpisode.airingTime * 1000).toISOString().split('T')[0] : null,
                  airingTime: itemInfo.nextAiringEpisode.airingTime
                })}
              </div>

              {/* Level 5: Production Section */}
              <div className="details-group">
                {renderSectionHeader('Production')}
                {itemInfo.studios?.length > 0 && renderDetailCard(<Building2 size={20} />, 'Studios', itemInfo.studios.join(', '))}
                {renderDetailCard(<MapPin size={20} />, 'Country of Origin', itemInfo.countryOfOrigin)}
                {itemInfo.type && renderDetailCard(<Info size={20} />, 'Type', itemInfo.type)}
                {renderDetailCard(<BarChart3 size={20} />, 'Status', itemInfo.status)}
              </div>

              {/* Level 6: Technical Section */}
              <div className="details-group">
                {renderSectionHeader('Technical')}
                {itemInfo.subOrDub && renderDetailCard(<Languages size={20} />, 'Sub/Dub', itemInfo.subOrDub.toUpperCase())}
                {itemInfo.isLicensed !== undefined && renderDetailCard(
                  itemInfo.isLicensed ? <CheckCircle size={20} /> : <XCircle size={20} />, 
                  'Licensed', 
                  itemInfo.isLicensed ? 'Yes' : 'No',
                  false,
                  true
                )}
                {itemInfo.isAdult !== undefined && renderDetailCard(
                  itemInfo.isAdult ? <XCircle size={20} /> : <CheckCircle size={20} />, 
                  'Adult Content', 
                  itemInfo.isAdult ? 'Yes' : 'No',
                  false,
                  true
                )}
                {itemInfo.popularity && renderDetailCard(<TrendingUp size={20} />, 'Popularity', itemInfo.popularity.toLocaleString(), false, true)}
                {itemInfo.color && (
                  <div className="detail-card compact">
                    <div className="detail-card-icon" style={{ color: itemInfo.color }}>
                      <Film size={20} />
                    </div>
                    <div className="detail-card-content">
                      <div className="detail-card-label">Theme Color</div>
                      <div className="detail-card-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          display: 'inline-block', 
                          width: '20px', 
                          height: '20px', 
                          backgroundColor: itemInfo.color, 
                          borderRadius: '4px',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}></span>
                        {itemInfo.color}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Level 7: Additional Info */}
              {itemInfo.synonyms?.length > 0 && (
                <div className="details-group">
                  {renderSectionHeader('Additional Information')}
                  <div className="detail-card full-width">
                    <div className="detail-card-icon"><Languages size={20} /></div>
                    <div className="detail-card-content">
                      <div className="detail-card-label">Synonyms</div>
                      <div className="synonyms-list">{itemInfo.synonyms.join(', ')}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Level 8: Links Row */}
              {renderLinksCard(animeLinks)}
            </div>
          </div>
        );
      case 'movies':
        // Prepare primary stats
        const moviePrimaryStats = [
          { value: itemInfo.vote_average ? `${itemInfo.vote_average.toFixed(1)}/10` : null, label: 'Rating' },
          { value: itemInfo.runtime ? `${itemInfo.runtime} min` : null, label: 'Runtime' },
          { value: itemInfo.vote_count ? itemInfo.vote_count.toLocaleString() : null, label: 'Votes' }
        ];

        // Prepare links
        const movieLinks = [
          (itemInfo.imdb_id || itemInfo.external_ids?.imdb_id) ? { 
            url: `https://www.imdb.com/title/${itemInfo.imdb_id || itemInfo.external_ids?.imdb_id}`, 
            label: 'IMDb', 
            icon: <ExternalLink size={18} /> 
          } : null,
          itemInfo.homepage ? { 
            url: itemInfo.homepage, 
            label: 'Homepage', 
            icon: <Home size={18} /> 
          } : null,
          itemInfo.external_ids?.wikidata_id ? { 
            url: `https://www.wikidata.org/wiki/${itemInfo.external_ids.wikidata_id}`, 
            label: 'Wikidata', 
            icon: <ExternalLink size={18} /> 
          } : null,
          itemInfo.external_ids?.facebook_id ? { 
            url: `https://www.facebook.com/${itemInfo.external_ids.facebook_id}`, 
            label: 'Facebook', 
            icon: <LinkIcon size={18} /> 
          } : null,
          itemInfo.external_ids?.instagram_id ? { 
            url: `https://www.instagram.com/${itemInfo.external_ids.instagram_id}`, 
            label: 'Instagram', 
            icon: <LinkIcon size={18} /> 
          } : null,
          itemInfo.external_ids?.twitter_id ? { 
            url: `https://twitter.com/${itemInfo.external_ids.twitter_id}`, 
            label: 'Twitter', 
            icon: <LinkIcon size={18} /> 
          } : null
        ].filter(Boolean);

        return (
          <div className="details-container">
            <div className="details-header">
              <h2>About</h2>
            </div>
            <div className="details-grid">
              {/* Level 1: Overview Hero */}
              {overview && (
                <div className="detail-card full-width description-card">
                  <div className="detail-card-content">
                    <div className="detail-card-label">Overview</div>
                    <div className="detail-card-value description-text">{overview}</div>
                  </div>
                </div>
              )}

              {/* Level 2: Primary Row - Title + Stats */}
              {renderDetailCard(<Film size={20} />, 'Title', title, true)}
              {renderDetailCard(<Globe size={20} />, 'Original Title', itemInfo.original_title)}
              {renderStatsBadges(moviePrimaryStats)}

              {/* Level 3: Tagline & Genres */}
              {itemInfo.tagline && (
                <div className="detail-card full-width highlight">
                  <div className="detail-card-content">
                    <div className="detail-card-label">Tagline</div>
                    <div className="detail-card-value tagline-text">{itemInfo.tagline}</div>
                  </div>
                </div>
              )}
              {renderGenreBadges(itemInfo.genres)}

              {/* Level 4: Dates & Numbers */}
              <div className="details-group">
                {renderSectionHeader('Release & Financials')}
                {renderDetailCard(<Calendar size={20} />, 'Release Date', itemInfo.release_date)}
                {itemInfo.budget && renderDetailCard(<DollarSign size={20} />, 'Budget', itemInfo.budget > 0 ? `$${itemInfo.budget.toLocaleString()}` : 'N/A')}
                {itemInfo.revenue && renderDetailCard(<DollarSign size={20} />, 'Revenue', itemInfo.revenue > 0 ? `$${itemInfo.revenue.toLocaleString()}` : 'N/A', true)}
                {itemInfo.popularity && renderDetailCard(<TrendingUp size={20} />, 'Popularity', itemInfo.popularity.toFixed(2), false, true)}
              </div>

              {/* Level 5: Production Section */}
              <div className="details-group">
                {renderSectionHeader('Production')}
                {itemInfo.production_companies?.length > 0 && 
                  renderDetailCard(<Building2 size={20} />, 'Production Companies', itemInfo.production_companies.map((company) => company.name).join(', '))}
                {itemInfo.production_countries?.length > 0 && 
                  renderDetailCard(<MapPin size={20} />, 'Production Countries', itemInfo.production_countries.map((country) => country.name).join(', '))}
                {itemInfo.belongs_to_collection && (
                  <div className="detail-card">
                    <div className="detail-card-icon"><Film size={20} /></div>
                    <div className="detail-card-content">
                      <div className="detail-card-label">Collection</div>
                      <div className="detail-card-value">{itemInfo.belongs_to_collection.name}</div>
                    </div>
                  </div>
                )}
                {renderDetailCard(<BarChart3 size={20} />, 'Status', itemInfo.status)}
              </div>

              {/* Level 6: Technical Section */}
              <div className="details-group">
                {renderSectionHeader('Technical')}
                {itemInfo.original_language && renderDetailCard(<Languages size={20} />, 'Original Language', itemInfo.original_language.toUpperCase(), false, true)}
                {itemInfo.spoken_languages?.length > 0 && 
                  renderDetailCard(<Languages size={20} />, 'Spoken Languages', itemInfo.spoken_languages.map((lang) => lang.name || lang.english_name || lang.iso_639_1).join(', '))}
                {itemInfo.adult !== undefined && renderDetailCard(
                  itemInfo.adult ? <XCircle size={20} /> : <CheckCircle size={20} />, 
                  'Adult Content', 
                  itemInfo.adult ? 'Yes' : 'No',
                  false,
                  true
                )}
              </div>

              {/* Level 7: Links Row */}
              {renderLinksCard(movieLinks)}
            </div>
          </div>
        );
      case 'shows':
        // Prepare primary stats
        const showPrimaryStats = [
          { value: itemInfo.vote_average ? `${itemInfo.vote_average.toFixed(1)}/10` : null, label: 'Rating' },
          { value: itemInfo.number_of_seasons ? `${itemInfo.number_of_seasons}` : null, label: 'Seasons' },
          { value: itemInfo.number_of_episodes ? `${itemInfo.number_of_episodes}` : null, label: 'Episodes' },
          { value: itemInfo.episode_run_time?.[0] ? `${itemInfo.episode_run_time[0]} min` : null, label: 'Runtime' }
        ];

        // Prepare links
        const showLinks = [
          itemInfo.external_ids?.imdb_id ? { 
            url: `https://www.imdb.com/title/${itemInfo.external_ids.imdb_id}`, 
            label: 'IMDb', 
            icon: <ExternalLink size={18} /> 
          } : null,
          itemInfo.external_ids?.tvdb_id ? { 
            url: `https://www.thetvdb.com/series/${itemInfo.external_ids.tvdb_id}`, 
            label: 'TVDB', 
            icon: <ExternalLink size={18} /> 
          } : null,
          itemInfo.homepage ? { 
            url: itemInfo.homepage, 
            label: 'Homepage', 
            icon: <Home size={18} /> 
          } : null,
          itemInfo.external_ids?.wikidata_id ? { 
            url: `https://www.wikidata.org/wiki/${itemInfo.external_ids.wikidata_id}`, 
            label: 'Wikidata', 
            icon: <ExternalLink size={18} /> 
          } : null,
          itemInfo.external_ids?.facebook_id ? { 
            url: `https://www.facebook.com/${itemInfo.external_ids.facebook_id}`, 
            label: 'Facebook', 
            icon: <LinkIcon size={18} /> 
          } : null,
          itemInfo.external_ids?.instagram_id ? { 
            url: `https://www.instagram.com/${itemInfo.external_ids.instagram_id}`, 
            label: 'Instagram', 
            icon: <LinkIcon size={18} /> 
          } : null,
          itemInfo.external_ids?.twitter_id ? { 
            url: `https://twitter.com/${itemInfo.external_ids.twitter_id}`, 
            label: 'Twitter', 
            icon: <LinkIcon size={18} /> 
          } : null
        ].filter(Boolean);

        return (
          <div className="details-container">
            <div className="details-header">
              <h2>About</h2>
            </div>
            <div className="details-grid">
              {/* Level 1: Overview Hero */}
              {overview && (
                <div className="detail-card full-width description-card">
                  <div className="detail-card-content">
                    <div className="detail-card-label">Overview</div>
                    <div className="detail-card-value description-text">{overview}</div>
                  </div>
                </div>
              )}

              {/* Level 2: Primary Row - Title + Stats */}
              {renderDetailCard(<Tv size={20} />, 'Title', title, true)}
              {renderDetailCard(<Globe size={20} />, 'Original Name', itemInfo.original_name)}
              {renderStatsBadges(showPrimaryStats)}

              {/* Level 3: Tagline & Genres */}
              {itemInfo.tagline && (
                <div className="detail-card full-width highlight">
                  <div className="detail-card-content">
                    <div className="detail-card-label">Tagline</div>
                    <div className="detail-card-value tagline-text">{itemInfo.tagline}</div>
                  </div>
                </div>
              )}
              {renderGenreBadges(itemInfo.genres)}

              {/* Level 4: Dates Section */}
              <div className="details-group">
                {renderSectionHeader('Dates & Schedule')}
                {renderDetailCard(<Calendar size={20} />, 'First Air Date', itemInfo.first_air_date)}
                {itemInfo.last_air_date && renderDetailCard(<Calendar size={20} />, 'Last Air Date', itemInfo.last_air_date)}
                {itemInfo.last_episode_to_air && (
                  <div className="detail-card">
                    <div className="detail-card-icon"><CalendarDays size={20} /></div>
                    <div className="detail-card-content">
                      <div className="detail-card-label">Last Episode Aired</div>
                      <div className="detail-card-value">
                        {itemInfo.last_episode_to_air.name} 
                        <span className="episode-number"> (S{itemInfo.last_episode_to_air.season_number}E{itemInfo.last_episode_to_air.episode_number})</span>
                        {itemInfo.last_episode_to_air.air_date && ` - ${itemInfo.last_episode_to_air.air_date}`}
                      </div>
                    </div>
                  </div>
                )}
                {itemInfo.last_episode_to_air?.runtime && renderDetailCard(<Clock3 size={20} />, 'Last Episode Runtime', `${itemInfo.last_episode_to_air.runtime} min`, false, true)}
                {/* Featured Next Episode - separate row */}
                {renderNextEpisodeFeatured(itemInfo.next_episode_to_air)}
              </div>

              {/* Level 5: Production Section */}
              <div className="details-group">
                {renderSectionHeader('Production')}
                {itemInfo.networks?.length > 0 && renderDetailCard(<Building2 size={20} />, 'Networks', itemInfo.networks.map((network) => network.name).join(', '))}
                {itemInfo.production_companies?.length > 0 && 
                  renderDetailCard(<Building2 size={20} />, 'Production Companies', itemInfo.production_companies.map((company) => company.name).join(', '))}
                {itemInfo.created_by?.length > 0 && (
                  <div className="detail-card">
                    <div className="detail-card-icon"><Users size={20} /></div>
                    <div className="detail-card-content">
                      <div className="detail-card-label">Created By</div>
                      <div className="detail-card-value">{itemInfo.created_by.map((creator) => creator.name).join(', ')}</div>
                    </div>
                  </div>
                )}
                {itemInfo.type && renderDetailCard(<Info size={20} />, 'Type', itemInfo.type)}
                {itemInfo.in_production !== undefined && renderDetailCard(
                  itemInfo.in_production ? <CheckCircle size={20} /> : <XCircle size={20} />, 
                  'In Production', 
                  itemInfo.in_production ? 'Yes' : 'No',
                  false,
                  true
                )}
                {renderDetailCard(<BarChart3 size={20} />, 'Status', itemInfo.status)}
              </div>

              {/* Level 6: Technical Section */}
              <div className="details-group">
                {renderSectionHeader('Technical')}
                {itemInfo.origin_country?.length > 0 && 
                  renderDetailCard(<MapPin size={20} />, 'Origin Country', itemInfo.origin_country.join(', '))}
                {itemInfo.production_countries?.length > 0 && 
                  renderDetailCard(<MapPin size={20} />, 'Production Countries', itemInfo.production_countries.map((country) => country.name).join(', '))}
                {itemInfo.original_language && renderDetailCard(<Languages size={20} />, 'Original Language', itemInfo.original_language.toUpperCase(), false, true)}
                {itemInfo.spoken_languages?.length > 0 && 
                  renderDetailCard(<Languages size={20} />, 'Spoken Languages', itemInfo.spoken_languages.map((lang) => lang.name || lang.english_name || lang.iso_639_1).join(', '))}
                {itemInfo.languages?.length > 0 && renderDetailCard(<Languages size={20} />, 'Languages', itemInfo.languages.join(', '), false, true)}
                {itemInfo.vote_count && renderDetailCard(<Eye size={20} />, 'Vote Count', itemInfo.vote_count.toLocaleString(), false, true)}
                {itemInfo.popularity && renderDetailCard(<TrendingUp size={20} />, 'Popularity', itemInfo.popularity.toFixed(2), false, true)}
                {itemInfo.adult !== undefined && renderDetailCard(
                  itemInfo.adult ? <XCircle size={20} /> : <CheckCircle size={20} />, 
                  'Adult Content', 
                  itemInfo.adult ? 'Yes' : 'No',
                  false,
                  true
                )}
              </div>

              {/* Level 7: Links Row */}
              {renderLinksCard(showLinks)}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div id={'infoPage'}>
      <StarryBackground />
      <Header
        onSearchClick={() => {
          setIsSearchVisible(!isSearchVisible);
          toggleSearchBar();
        }}
      />
      <div className="info-page">
        {isSearchVisible && <SearchBar activeTab={contextActiveTab} />}
        
        {/* Netflix-Style Hero Section */}
        <div className="netflix-hero">
          {/* Background: poster/trailer → preview video when ready */}
          <div className="hero-background">
            {usingTorrent && torrentStreamUrl && !showVideoModal ? (
              <video
                src={torrentStreamUrl}
                muted
                loop
                autoPlay
                className="hero-background-video"
              />
            ) : (
              <img src={backdropUrl} alt={title} className="hero-background-image" />
            )}
          </div>
          
          {/* Gradient Overlay */}
          <div className="hero-gradient-overlay" />
          
          {/* Left Content: Title, Meta, Overview, Buttons */}
          <div className="hero-content-left">
            <h1 
              className="hero-title"
              style={{
                fontSize: title.length > 60 
                  ? `${Math.max(2, 4 - (title.length - 60) * 0.05)}rem`
                  : title.length > 40
                  ? `${Math.max(2.5, 4 - (title.length - 40) * 0.03)}rem`
                  : '4rem'
              }}
            >
              {title}
            </h1>
            <div className="hero-meta">
              {year && <span>{year}</span>}
              {year && rating && <span className="meta-separator">|</span>}
              {rating && <span>{rating}</span>}
              {(year || rating) && runtime && <span className="meta-separator">|</span>}
              {runtime && <span>{runtime}</span>}
            </div>
            {overview && (
              <p className="hero-overview">
                {overview.length > 200 ? `${overview.slice(0, 200)}...` : overview}
              </p>
            )}
            
            <div className="hero-actions">
              <button className="btn-watch" onClick={handleWatchFromBeginning}>
                <Play size={20} />
                Watch Now
              </button>
              {watchedItem && itemInfo.type !== 'movies' && (
                <button className="btn-continue" onClick={handleContinue}>
                  Continue S{watchedItem.season}E{watchedItem.episode}
                </button>
              )}
            </div>
          </div>
          
          {/* Right Side: Rich Episode Cards WITH Thumbnails (shows/anime only) */}
          {itemInfo.type !== 'movies' && (
            <div className="hero-episode-panel" ref={heroEpisodePanelRef}>
              <div className="episode-panel-header">
                {itemInfo.type === 'anime' ? (
                  <div className="season-text">
                    Season {itemInfo.season || selectedSeason?.season_number || 1}
                  </div>
                ) : (
                  <select
                    value={selectedSeason?.season_number || 1}
                    onChange={(e) =>
                      handleSeasonChange(
                        itemInfo.seasons.find(
                          (season) => season.season_number === parseInt(e.target.value)
                        )
                      )
                    }
                    className="episode-panel-season-select"
                  >
                    {itemInfo.seasons?.map((season) => (
                      <option key={season.id} value={season.season_number}>
                        {season.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="episode-cards-scroll">
                {episodesWithThumbnails.map((ep) => (
                  <div
                    key={ep.episode_number}
                    className={`episode-card ${ep.episode_number === effectiveSelectedEpisode?.episode_number ? 'active' : ''}`}
                    onClick={() => handleEpisodeChange({ episode_number: ep.episode_number }, true)}
                  >
                    {ep.thumbnail_url && (
                      <img 
                        src={ep.thumbnail_url} 
                        alt={ep.name || `Episode ${ep.episode_number}`}
                        className="episode-card-thumbnail"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="episode-card-info">
                      <span className="ep-number">{ep.episode_number}</span>
                      <span className="ep-name">{ep.name || `Episode ${ep.episode_number}`}</span>
                      {ep.runtime && <span className="ep-runtime">{ep.runtime}m</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Tabs Overlaid on Hero Bottom */}
          <div className="hero-tabs">
            <button
              className={`tab ${infoPageTab === 'details' ? 'active' : ''}`}
              onClick={() => setInfoPageTab('details')}
            >
              Details
            </button>
            {itemInfo.type !== 'movies' && (
              <button
                className={`tab ${infoPageTab === 'episodes' ? 'active' : ''}`}
                onClick={() => setInfoPageTab('episodes')}
              >
                Episodes
              </button>
            )}
          </div>
        </div>
        
        {/* Tab Content Section (Below Hero) */}
        <div className="tab-content-section">
          {infoPageTab === 'episodes' && itemInfo.type !== 'movies' && (
            <div className="tab-episodes">
              <div id="tab-episode-grid" ref={sideContentRef}>
                <div className="tab-episode-header">
                  {itemInfo.type === 'anime' ? (
                    <div className="season-text">
                      Season {itemInfo.season || selectedSeason?.season_number || 1}
                    </div>
                  ) : (
                    <select
                      value={selectedSeason?.season_number || 1}
                      onChange={(e) =>
                        handleSeasonChange(
                          itemInfo.seasons.find(
                            (season) => season.season_number === parseInt(e.target.value)
                          )
                        )
                      }
                      className="tab-season-select"
                    >
                      {itemInfo.seasons?.map((season) => (
                        <option key={season.id} value={season.season_number}>
                          {season.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="tab-episode-cards">
                  {episodesWithThumbnails.map((ep) => (
                    <div
                      key={ep.episode_number}
                      className={`tab-episode-card ${ep.episode_number === effectiveSelectedEpisode?.episode_number ? 'active' : ''}`}
                      onClick={() => handleEpisodeChange({ episode_number: ep.episode_number }, true)}
                    >
                      <div className="tab-episode-thumbnail-wrapper">
                        {ep.thumbnail_url ? (
                          <img 
                            src={ep.thumbnail_url} 
                            alt={ep.name || `Episode ${ep.episode_number}`}
                            className="tab-episode-thumbnail"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="tab-episode-placeholder" style={{ display: ep.thumbnail_url ? 'none' : 'flex' }}>
                          <span className="placeholder-ep-num">{ep.episode_number}</span>
                        </div>
                        <div className="tab-episode-overlay">
                          <span className="play-icon">▶</span>
                        </div>
                      </div>
                      <div className="tab-episode-info">
                        <div className="tab-episode-title">
                          <span className="tab-ep-number">E{ep.episode_number}</span>
                          <span className="tab-ep-name">{ep.name || `Episode ${ep.episode_number}`}</span>
                        </div>
                        {ep.runtime && <span className="tab-ep-runtime">{ep.runtime} min</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {infoPageTab === 'details' && (
            <div className="tab-details">
              {renderSubInfo()}
            </div>
          )}
        </div>
        
        {/* Recommendations */}
        {itemInfo.recommendations && itemInfo.recommendations.length > 0 && (
          <VideoCardGrid
            contentType={itemInfo.type}
            title="Recommended For You"
            customItems={itemInfo.recommendations}
          />
        )}
        
        <Footer />
      </div>

      {/* VideoPlayer Modal - Full-screen Netflix-style player */}
      {showVideoModal && (
        <VideoModal
          isOpen={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          title={title}
          useAdFreePlayer={useAdFreePlayer}
          onPlayerTypeChange={setUseAdFreePlayer}
          torrentStreamUrl={torrentStreamUrl}
          videoSrc={videoSrc}
        >
          <div className="modal-layout">
            {/* Player Area and Sidebar */}
            <div className="modal-player-wrapper">
              <div className="modal-player">
                {useAdFreePlayer && torrentStreamUrl ? (
                  <VideoPlayer
                    src={torrentStreamUrl}
                    title={title}
                    onClose={() => setShowVideoModal(false)}
                    torrentHash={activeHash}
                    fileIndex={activeFileIndex}
                    initialTime={videoPlayerProgress}
                    isDebridStream={isDebridStream}
                    isMovie={itemInfo.type === 'movies'}
                    torrentSubtitles={torrentSubtitles}
                    // NEW: Video source selection
                    alternativeSources={alternativeTorrents}
                    currentSourceName={currentSourceName}
                    onSourceChange={handleSourceChange}
                    // NEW: Auto Next
                    onNextEpisode={handleNextEpisode}
                    hasNextEpisode={itemInfo?.type !== 'movies' && (
                      episodesWithThumbnails.some(ep => ep.episode_number === (selectedEpisode?.episode_number || 0) + 1) || 
                      (itemInfo?.type === 'shows' && itemInfo?.seasons?.some(s => s.season_number === (selectedSeason?.season_number || 0) + 1)) ||
                      (itemInfo?.type === 'anime' && (itemInfo?.totalEpisodes || 0) > (selectedEpisode?.episode_number || 0))
                    )}
                  />
                ) : (
                  <div className="iframe-player-container">
                    <iframe
                      src={videoSrc}
                      title={`Video player for ${title}`}
                      allowFullScreen
                      className="modal-iframe"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                    <div className={`player-buttons-wrapper ${isProvidersExpanded ? 'expanded' : 'collapsed'}`}>
                      <button 
                        className="providers-toggle"
                        onClick={() => setIsProvidersExpanded(!isProvidersExpanded)}
                        title={isProvidersExpanded ? "Hide Providers" : "Show Providers"}
                      >
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                      </button>
                      <div className='player-buttons'>
                        <button
                          className={`player-button ${videoPlayerState.provider === 'RiveStream' ? 'active' : ''}`}
                          onClick={() => switchProvider('RiveStream')}
                        >
                          Low + Auto Next
                        </button>
                        <button
                          className={`player-button ${videoPlayerState.provider === 'RiveTorrent' ? 'active' : ''}`}
                          onClick={() => switchProvider('RiveTorrent')}
                        >
                          Low + Low Ads
                        </button>
                        <button
                          className={`player-button ${videoPlayerState.provider === 'RiveAggregator' ? 'active' : ''}`}
                          onClick={() => switchProvider('RiveAggregator')}
                        >
                          Low + Many Ads
                        </button>
                        <button
                          className={`player-button ${videoPlayerState.provider === 'SuperEmbed' ? 'active' : ''}`}
                          onClick={() => switchProvider('SuperEmbed')}
                        >
                          Medium
                        </button>
                        <button
                          className={`player-button ${videoPlayerState.provider === 'NontonGo' ? 'active' : ''}`}
                          onClick={() => switchProvider('NontonGo')}
                        >
                          Works Everytime
                        </button>
                        <button
                          className={`player-button ${videoPlayerState.provider === 'VidZee' ? 'active' : ''}`}
                          onClick={() => switchProvider('VidZee')}
                        >
                          Good
                        </button>
                        <button
                          className={`player-button ${videoPlayerState.provider === 'VidRock' ? 'active' : ''}`}
                          onClick={() => switchProvider('VidRock')}
                        >
                         Good + Auto Next
                        </button>
                        <button
                          className={`player-button ${videoPlayerState.provider === 'Vidsrc' ? 'active' : ''}`}
                          onClick={() => switchProvider('Vidsrc')}
                        >
                          Good ++
                        </button>
                        <button
                          className={`player-button ${videoPlayerState.provider === 'VidLink' ? 'active' : ''}`}
                          onClick={() => switchProvider('VidLink')}
                        >
                          Best + Auto Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Episode Sidebar (for shows/anime) */}
              {itemInfo.type !== 'movies' && (
                <div id="modal-episode-list" className="modal-episode-sidebar">
                  <div className="modal-episode-header">
                    {itemInfo.type === 'anime' ? (
                      <div className="modal-season-text">
                        Season {itemInfo.season || selectedSeason?.season_number || 1}
                      </div>
                    ) : (
                      <select
                        value={selectedSeason?.season_number || 1}
                        onChange={(e) =>
                          handleSeasonChange(
                            itemInfo.seasons.find(
                              (season) => season.season_number === parseInt(e.target.value)
                            )
                          )
                        }
                        className="modal-season-select"
                      >
                        {itemInfo.seasons?.map((season) => (
                          <option key={season.id} value={season.season_number}>
                            {season.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="modal-episode-cards">
                    {episodesWithThumbnails.map((ep) => (
                      <div
                        key={ep.episode_number}
                        className={`modal-ep-card ${ep.episode_number === effectiveSelectedEpisode?.episode_number ? 'active' : ''}`}
                        onClick={() => handleEpisodeChange({ episode_number: ep.episode_number })}
                      >
                        {ep.thumbnail_url && (
                          <img 
                            src={ep.thumbnail_url} 
                            alt={ep.name || `Episode ${ep.episode_number}`}
                            className="modal-ep-thumbnail"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="modal-ep-info">
                          <span className="modal-ep-number">{ep.episode_number}</span>
                          <span className="modal-ep-name">{ep.name || `Episode ${ep.episode_number}`}</span>
                          {ep.runtime && <span className="modal-ep-runtime">{ep.runtime}m</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </VideoModal>
      )}
    </div>
  );
};
export default InfoPage;
