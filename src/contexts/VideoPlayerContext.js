import React, {createContext, useState, useContext, useEffect} from 'react';
import { UserContext } from './UserContext';
import {fetchOneItem} from "../api/ItemsApi";

export const VideoPlayerContext = createContext();

export const VideoPlayerProvider = ({ children }) => {
    const { user } = useContext(UserContext); // Access user context to get the watched list
    const [item, setItem] = useState(null);
    const [videoPlayerState, setVideoPlayerState] = useState({
        isVisible: false,
        tmdbId: null,
        provider: '2embed', // default provider
        season: 1, // default season
        episode: 1, // default episode
    });

    const showVideoPlayer = async (tmdbId, item, continueWatching = false, category) => {
        let season = 1;
        let episode = 1;
        if (continueWatching && user?.watched && user.watched.length > 0) {
            const watchedItem = user.watched.find(w => w.includes(`${item.title || item.title.userPreferred}`));
            if (watchedItem) {
                const [, , watchedSeason, watchedEpisode] = watchedItem.split(':');
                season = parseInt(watchedSeason, 10);
                episode = parseInt(watchedEpisode, 10);
            }
        }

        try {
            const fetchedItem = await fetchOneItem(category, tmdbId);
            setItem(fetchedItem);
        } catch (err) {
            console.error('Failed to load item details.');
        }
        console.log('item', item);
        setVideoPlayerState({
            isVisible: true,
            tmdbId,
            provider: '2embed', // default provider when showing player
            season,
            episode,
        });
    };

    const hideVideoPlayer = () => {
        setVideoPlayerState({
            isVisible: false,
            tmdbId: null,
            provider: '2embed',
            season: 1,
            episode: 1,
        });
        setItem(null);
    };

    const switchProvider = (provider, season = videoPlayerState.season, episode = videoPlayerState.episode) => {
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
        <VideoPlayerContext.Provider value={{ videoPlayerState, showVideoPlayer, hideVideoPlayer, switchProvider, changeSeason, changeEpisode, item }}>
            {children}
        </VideoPlayerContext.Provider>
    );
};
