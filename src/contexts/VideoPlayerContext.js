import React, { createContext, useState } from 'react';

export const VideoPlayerContext = createContext();

export const VideoPlayerProvider = ({ children }) => {
    const [item, setItem] = useState(null);
    const [videoPlayerState, setVideoPlayerState] = useState({
        isVisible: false,
        tmdbId: null,
        provider: 'NontonGo', // default provider
    });

    const showVideoPlayer = (tmdbId, item) => {
        setVideoPlayerState({
            isVisible: true,
            tmdbId,
            provider: 'NontonGo', // default provider when showing player
        });
        setItem(item);
    };

    const hideVideoPlayer = () => {
        setVideoPlayerState({
            isVisible: false,
            tmdbId: null,
            provider: 'NontonGo',
        });
        setItem(null);
    };

    const switchProvider = (provider) => {
        setVideoPlayerState((prevState) => ({
            ...prevState,
            provider,
        }));
    };

    return (
        <VideoPlayerContext.Provider value={{ videoPlayerState, showVideoPlayer, hideVideoPlayer, switchProvider, item }}>
            {children}
        </VideoPlayerContext.Provider>
    );
};
