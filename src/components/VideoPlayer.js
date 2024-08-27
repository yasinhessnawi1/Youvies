// VideoPlayer.js

import React, { useContext, useEffect, useState } from 'react';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import { useLoading } from '../contexts/LoadingContext';
import { UserContext } from '../contexts/UserContext';
import LoadingIndicator from './static/LoadingIndicator';
import '../styles/components/VideoPlayer.css';
import { FaArrowDown, FaEllipsisH, FaTimes } from 'react-icons/fa';
import { getTitle } from '../utils/helper';
import {useItemContext} from "../contexts/ItemContext";

const VideoPlayer = () => {
    const {
        videoPlayerState,
        hideVideoPlayer,
        switchProvider,
        changeSeason,
        changeEpisode,
        item
    } = useContext(VideoPlayerContext);
    const { isLoading, setIsLoading } = useLoading();
    const { user, addToWatchedList, getWatchedItem } = useContext(UserContext);
    const { setWatchedItems } = useItemContext();
    const [showOverlay, setShowOverlay] = useState(false);
    const [error, setError] = useState('');
    const [selectedSeason, setSelectedSeason] = useState(videoPlayerState.season);
    const [selectedEpisode, setSelectedEpisode] = useState(videoPlayerState.episode);
    const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
    const [isEpisodeDropdownOpen, setIsEpisodeDropdownOpen] = useState(false);

    useEffect(() => {
        if (!item) return;
       const title = getTitle(item);
        const watchedItem = getWatchedItem(item.type,item.id,  title);
        if (watchedItem !== null) {
            const [, , , season, episode] = watchedItem.split(':');
            setSelectedSeason(parseInt(season, 10));
            setSelectedEpisode(parseInt(episode, 10));
        } else {
            addToWatchedList(`${item.type}:${item.id}:${title}:1:1`);
            setWatchedItems(prevItems => [item, ...prevItems]);
            setSelectedSeason(1);
            setSelectedEpisode(1);
        }
    }, [item]);
    // Determine the content type (Show, Anime, or Movie)
    const determineContentType = () => {
        if (videoPlayerState.type === 'shows') {
            return 'Show';
        } else if (videoPlayerState.type === 'anime') {
            return 'Anime';
        } else {
            return 'movie';
        }
    };


    const contentType = determineContentType();
    const constructVideoUrl = (provider, season = 1, episode = 1) => {
        const id = item.id;

        switch (provider) {
            case 'NontonGo':
                if (item.type === 'shows') {
                    return `https://NontonGo.win/embed/tv/${id}/${season}/${episode}`;
                } else {
                    return `https://NontonGo.win/embed/movie/${id}`;
                }
            case 'SuperEmbed':
                if (item.type === 'shows') {
                    return `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${season}&e=${episode}`;
                } else {
                    return `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`;
                }
            case '2embed':
                if (item.type === 'shows') {
                    return `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`;
                } else if (item.type === 'anime') {
                    let title = item.title.userPreferred || item.title.romaji || item.title.english || item.title.native || 'Unknown Title';
                    title = title.replace(/ /g, '-').toLowerCase();
                    return `https://2anime.xyz/embed/${title}-episode-${episode}`;
                } else {
                    return `https://www.2embed.cc/embed/${id}`;
                }
            default:
                return '';
        }
    };
    const videoSrc = item ? constructVideoUrl(videoPlayerState.provider, selectedSeason, selectedEpisode) : '';

    useEffect(() => {
        if (videoSrc) {
            console.log(`Constructed video URL: ${videoSrc}`);
            setIsLoading(true);
        }
    }, [videoSrc, setIsLoading]);

    const handleSeasonChange = (season) => {
        if (season === selectedSeason) return;
        setSelectedSeason(season);
        setSelectedEpisode(1);
        handleEpisodeChange(1);
        changeSeason(season);
        setIsLoading(true);
        setIsSeasonDropdownOpen(false);
    };

    const handleEpisodeChange = (episode) => {
        if (episode === selectedEpisode) return;
        setSelectedEpisode(episode);
        changeEpisode(episode);
        switchProvider(videoPlayerState.provider, selectedSeason, episode);
        setIsLoading(true);
        addToWatchedList(`${videoPlayerState.type}:${item.id}:${getTitle(item)}:${selectedSeason}:${episode}`);
        setIsEpisodeDropdownOpen(false);
    };

    const handleNextEpisode = () => {
        const totalEpisodes = contentType === 'Show'
            ? item.seasons[selectedSeason - 1]?.episode_count || 1
            : item.totalEpisodes || 1;

        if (selectedEpisode < totalEpisodes) {
            handleEpisodeChange(selectedEpisode + 1);
        } else if (selectedSeason < item.seasons?.length) {
            handleSeasonChange(selectedSeason + 1);
            handleEpisodeChange(1);
        }
    };

    const handleRestart = () => {
        handleSeasonChange(1);
        handleEpisodeChange(1);
    };

    const handleContentLoad = () => {
        setIsLoading(false);

    };

    const toggleOverlay = () => {
        setShowOverlay(prev => !prev);
    };

    const hidePlayer = () => {
        hideVideoPlayer();
    };

    const toggleSeasonDropdown = () => {
        setIsSeasonDropdownOpen(prev => !prev);
    };

    const toggleEpisodeDropdown = () => {
        setIsEpisodeDropdownOpen(prev => !prev);
    };

    if (!videoPlayerState.isVisible) {
        return null;
    }

    return (
        <div className="player-video-player-overlay">
            {isLoading && <LoadingIndicator />}
            <iframe
                src={videoSrc}
                title="Video player"
                width="100%"
                height="100%"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                frameBorder="0"
                allowFullScreen
                onLoad={handleContentLoad}
                onError={() => {
                    setError('Failed to load video. Please try another source or server.');
                    setIsLoading(false);
                }}
            ></iframe>
            <div className={`player-overlay-menu-button ${showOverlay ? 'active' : ''}`} onClick={toggleOverlay}>
                {showOverlay ? <FaTimes size={24} title="Close This Menu" /> : <FaEllipsisH size={24} title="Settings" />}
            </div>
            {showOverlay && (
                <div className="player-overlay-menu">
                    {(contentType === 'Show' || contentType === 'Anime') && (
                        <>
                            <div className="player-dropdown-container">
                                <div className="player-dropdown">
                                    <button className="player-dropdown-button" onClick={toggleSeasonDropdown}>
                                        Season {selectedSeason} <FaArrowDown />
                                    </button>
                                    {isSeasonDropdownOpen && (
                                        <div className="player-dropdown-content">
                                            {contentType === 'Show' && item.seasons.map((season, index) => (
                                                <span
                                                    key={index}
                                                    className={`player-dropdown-item ${selectedSeason === season.season_number ? 'highlight' : ''}`}
                                                    onClick={() => handleSeasonChange(season.season_number)}
                                                >
                                                    Season {season.season_number}
                                                </span>
                                            ))}
                                            {contentType === 'Anime' && (
                                                <span
                                                    className={`player-dropdown-item ${selectedSeason === 1 ? 'highlight' : ''}`}
                                                    onClick={() => handleSeasonChange(1)}
                                                >
                                                    Season 1
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="player-dropdown-container">
                                <div className="player-dropdown">
                                    <button className="player-dropdown-button" onClick={toggleEpisodeDropdown}>
                                        Episode {selectedEpisode} <FaArrowDown />
                                    </button>
                                    {isEpisodeDropdownOpen && (
                                        <div className="player-dropdown-content">
                                            {Array.from({
                                                length: contentType === 'Show'
                                                    ? item.seasons[selectedSeason - 1]?.episode_count || 1
                                                    : item.totalEpisodes || 1
                                            }, (_, i) => i + 1).map((episode) => (
                                                <span
                                                    key={episode}
                                                    className={`player-dropdown-item ${selectedEpisode === episode ? 'highlight' : ''}`}
                                                    onClick={() => handleEpisodeChange(episode)}
                                                >
                                                    Episode {episode}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button className={"player-control-button"} onClick={handleNextEpisode}>Next Episode</button>
                            <button className={"player-control-button"} onClick={handleRestart}>Restart from Beginning</button>
                        </>
                    )}
                    <div className="player-server-switch-container">
                        <span className="player-server-switch-label">Video troubles? Try switching server:</span>
                        <div className="player-server-buttons">
                            <button
                                className={`player-control-button ${videoPlayerState.provider === 'SuperEmbed' ? 'active' : ''}`}
                                onClick={() => switchProvider('SuperEmbed')}>No CC
                            </button>
                            <button
                                className={`player-control-button ${videoPlayerState.provider === '2embed' ? 'active' : ''}`}
                                onClick={() => switchProvider('2embed')}>English CC
                            </button>
                            <button
                                className={`player-control-button ${videoPlayerState.provider === 'NontonGo' ? 'active' : ''}`}
                                onClick={() => switchProvider('NontonGo')}>Multi CC
                            </button>
                        </div>
                    </div>
                    <button className="player-control-button player-close-button" onClick={hidePlayer}>Close Video</button>
                </div>
            )}
            {error && <div className="player-error-message">{error}</div>}
        </div>
    );
};

export default VideoPlayer;
