import React, { createContext, useState} from 'react';
import { fetchOneItem } from '../api/ItemsApi';

export const VideoPlayerContext = createContext();

export const VideoPlayerProvider = ({ children }) => {
  const [item, setItem] = useState(null);
  const [videoPlayerState, setVideoPlayerState] = useState({
    isVisible: false,
    tmdbId: null,
    type: null,
    provider: '2embed', // default provider
    season: 1, // default season
    episode: 1, // default episode
  });

  const showVideoPlayer = async (tmdbId, type, season, episode) => {
    season = season || 1;
    episode = episode || 1;

    try {
      const fetchedItem = await fetchOneItem(type, tmdbId);
      setItem(fetchedItem);
    } catch (err) {
      console.error('Failed to load item details.');
    }
    setVideoPlayerState({
      isVisible: true,
      tmdbId,
      type,
      provider:  '2embed' , // default provider when showing player
      season,
      episode,
    });
  };

  const hideVideoPlayer = () => {
    setVideoPlayerState({
      isVisible: false,
      type: null,
      tmdbId: null,
      provider: '2embed',
      season: 1,
      episode: 1,
    });
    setItem(null);
  };

  const switchProvider = (
    provider,
    season = videoPlayerState.season,
    episode = videoPlayerState.episode,
  ) => {
    setVideoPlayerState((prevState) => ({
      ...prevState,
      provider,
      season,
      episode,
    }));
  };

  const changeSeason = (season) => {
    setVideoPlayerState((prevState) => ({
      ...prevState,
      season,
      episode: 1, // reset to episode 1 when changing seasons
    }));
  };

  const changeEpisode = (episode) => {
    setVideoPlayerState((prevState) => ({
      ...prevState,
      episode,
    }));
  };

  return (
    <VideoPlayerContext.Provider
      value={{
        videoPlayerState,
        showVideoPlayer,
        hideVideoPlayer,
        switchProvider,
        changeSeason,
        changeEpisode,
        item,
      }}
    >
      {children}
    </VideoPlayerContext.Provider>
  );
};
