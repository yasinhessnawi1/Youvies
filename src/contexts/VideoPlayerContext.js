import React, { createContext, useState } from 'react';

export const VideoPlayerContext = createContext();

export const VideoPlayerProvider = ({ children }) => {
    const [videoPlayerState, setVideoPlayerState] = useState({
        isVisible: false,
        magnet: null,
        torrents: [],
        episodes: [],
        currentEpisode: null,
        currentQuality: 'HD'
    });

    const showVideoPlayer = (magnet, torrents = [], episodes = [], currentEpisode = null) => {
        setVideoPlayerState({
            isVisible: true,
            magnet,
            torrents,
            episodes,
            currentEpisode,
            currentQuality: 'HD'
        });
    };

    const hideVideoPlayer = () => {
        setVideoPlayerState({
            isVisible: false,
            magnet: null,
            torrents: [],
            episodes: [],
            currentEpisode: null,
            currentQuality: 'HD'
        });
    };

    const changeQuality = (quality) => {
        const selectedTorrent = videoPlayerState.torrents[quality][0].magnet;
        setVideoPlayerState((prevState) => ({
            ...prevState,
            magnet: selectedTorrent,
            currentQuality: quality
        }));
    };

    const changeEpisode = (episode) => {
        const selectedTorrent = episode.torrents['HD'][0].magnet;
        setVideoPlayerState((prevState) => ({
            ...prevState,
            magnet: selectedTorrent,
            currentEpisode: episode
        }));
    };

    return (
        <VideoPlayerContext.Provider value={{ videoPlayerState, showVideoPlayer, hideVideoPlayer, changeQuality, changeEpisode }}>
            {children}
        </VideoPlayerContext.Provider>
    );
};
