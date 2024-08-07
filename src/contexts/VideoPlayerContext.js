import React, { createContext, useState } from 'react';

export const VideoPlayerContext = createContext();

export const VideoPlayerProvider = ({ children }) => {
    const [item, setItem] = useState(null);
    const [videoPlayerState, setVideoPlayerState] = useState({
        isVisible: false,
        magnet: null,
        torrents: [],
    });

    const showVideoPlayer = (magnet, torrents, item) => {
        setVideoPlayerState({
            isVisible: true,
            magnet,
            torrents,
        });
        setItem(item);
    };

    const hideVideoPlayer = () => {
        setVideoPlayerState({
            isVisible: false,
            magnet: null,
            torrents: [],
        });
        setItem(null);
    };

    return (
        <VideoPlayerContext.Provider value={{ videoPlayerState, showVideoPlayer, hideVideoPlayer ,item}}>
            {children}
        </VideoPlayerContext.Provider>
    );
};
