import React, { useContext, useState, useEffect } from 'react';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import { useLoading } from '../contexts/LoadingContext';
import LoadingIndicator from './static/LoadingIndicator';
import '../styles/components/VideoPlayer.css';
import {FaEllipsisV, FaTimes, FaChevronDown, FaArrowDown} from 'react-icons/fa';

const VideoPlayer = () => {
    const { videoPlayerState, hideVideoPlayer, switchProvider, changeSeason, changeEpisode, item } = useContext(VideoPlayerContext);
    const { isLoading, setIsLoading } = useLoading();
    const [showOverlay, setShowOverlay] = useState(false);
    const [error, setError] = useState('');
    const [selectedSeason, setSelectedSeason] = useState(videoPlayerState.season);
    const [selectedEpisode, setSelectedEpisode] = useState(videoPlayerState.episode);
    const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
    const [isEpisodeDropdownOpen, setIsEpisodeDropdownOpen] = useState(false);

    const determineContentType = () => {
        if (item?.seasons_info) {
            return 'Show';
        } else if (item?.title?.userPreferred) {
            return 'Anime';
        } else {
            return 'Movie';
        }
    };

    const constructVideoUrl = (item, provider, season = 1, episode = 1) => {
        const contentType = determineContentType();

        if (contentType === 'Anime') {
            const title = item.title.userPreferred.replace(/ /g, '-').toLowerCase();
            return `https://2anime.xyz/embed/${title}-episode-${episode}`;
        } else {
            const id = item.id;
            switch (provider) {
                case 'NontonGo':
                    if (contentType === 'Show') {
                        return `https://www.NontonGo.win/embed/tv/${id}/${season}/${episode}`;
                    } else {
                        return `https://www.NontonGo.win/embed/movie/${id}`;
                    }
                case '2embed':
                    if (contentType === 'Show') {
                        return `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`;
                    } else {
                        return `https://www.2embed.cc/embed/${id}`;
                    }
                default:
                    return '';
            }
        }
    };

    const videoSrc = item ? constructVideoUrl(item, videoPlayerState.provider, selectedSeason, selectedEpisode) : '';

    useEffect(() => {
        console.log(`Constructed video URL: ${videoSrc}`);
        setIsLoading(true);
    }, [videoSrc, setIsLoading]);

    const handleSeasonChange = (season) => {
        if (season === selectedSeason) return;
        setSelectedSeason(season);
        setSelectedEpisode(1);
        changeSeason(season);
        setIsLoading(true);
        setIsSeasonDropdownOpen(false); // Close dropdown after selection
    };

    const handleEpisodeChange = (episode) => {
        if (episode === selectedEpisode) return;
        setSelectedEpisode(episode);
        changeEpisode(episode);
        switchProvider(videoPlayerState.provider, selectedSeason, episode);
        setIsLoading(true);
        setIsEpisodeDropdownOpen(false); // Close dropdown after selection
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
        setIsSeasonDropdownOpen((prev) => !prev);
    };

    const toggleEpisodeDropdown = () => {
        setIsEpisodeDropdownOpen((prev) => !prev);
    };

    if (!videoPlayerState.isVisible) {
        return null;
    }

    return (
        <div className="player-video-player-overlay">
            {isLoading && <LoadingIndicator />}
            <iframe
                src={videoSrc}
                title="Video Player"
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                onLoad={handleContentLoad}
                onError={() => {
                    setError('Failed to load video. Please try another source.');
                    setIsLoading(false);
                }}
            ></iframe>
            <div className={`player-overlay-menu-button ${showOverlay ? 'active' : ''}`} onClick={toggleOverlay}>
                {showOverlay ? <FaTimes size={24} /> : <FaEllipsisV size={24} />}
            </div>
            {showOverlay && (
                <div className="player-overlay-menu">
                    <div className="player-dropdown-container">
                        <div className="player-dropdown">
                            <button className="player-dropdown-button" onClick={toggleSeasonDropdown}>
                                Season {selectedSeason} <FaArrowDown className={"arrow-down"} />
                            </button>
                            {isSeasonDropdownOpen && (
                                <div className="player-dropdown-content">
                                    {item.seasons_info.map((season, index) => (
                                        <span
                                            key={index}
                                            className={`player-dropdown-item ${selectedSeason === season.season_number ? 'highlight' : ''}`}
                                            onClick={() => handleSeasonChange(season.season_number)}
                                        >
                                            Season {season.season_number}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="player-dropdown-container">
                        <div className="player-dropdown">
                            <button className="player-dropdown-button" onClick={toggleEpisodeDropdown}>
                                Episode {selectedEpisode} <FaArrowDown className={"arrow-down"} />
                            </button>
                            {isEpisodeDropdownOpen && (
                                <div className="player-dropdown-content">
                                    {Array.from({ length: item.seasons_info[selectedSeason - 1]?.episode_count || 1 }, (_, i) => i + 1).map((episode) => (
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
                    <div className="player-server-switch-container">
                        <span className="player-server-switch-label">Video troubles? Try switching server:</span>
                        <div className="player-server-buttons">
                            <button className={`player-control-button ${videoPlayerState.provider === 'NontonGo' ? 'active' : ''}`} onClick={() => switchProvider('NontonGo')}>NontonGo</button>
                            <button className={`player-control-button ${videoPlayerState.provider === '2embed' ? 'active' : ''}`} onClick={() => switchProvider('2embed')}>2Embed</button>
                        </div>
                    </div>
                    <button className="player-control-button player-close-button" onClick={hidePlayer}>Close Player</button>
                </div>
            )}
            {error && <div className="player-error-message">{error}</div>}
        </div>
    );
};

export default VideoPlayer;
