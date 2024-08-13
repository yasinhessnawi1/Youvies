import React, { useContext, useState, useEffect } from 'react';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import { useLoading } from '../contexts/LoadingContext';
import LoadingIndicator from './static/LoadingIndicator'; // Import the LoadingIndicator
import '../styles/components/VideoPlayer.css';
import { FaEllipsisV, FaTimes } from 'react-icons/fa';

const VideoPlayer = () => {
    const { videoPlayerState, hideVideoPlayer, switchProvider, item } = useContext(VideoPlayerContext);
    const { isLoading, setIsLoading } = useLoading(); // Use LoadingContext
    const [showOverlay, setShowOverlay] = useState(false);
    const [error, setError] = useState('');
    const [selectedSeason, setSelectedSeason] = useState(videoPlayerState.season);
    const [selectedEpisode, setSelectedEpisode] = useState(videoPlayerState.episode);

    // Determine content type
    const determineContentType = () => {
        if (item?.seasons_info) {
            return 'Show';
        } else if (item?.title?.userPreferred) {
            return 'Anime';
        } else {
            return 'Movie';
        }
    };

    // Construct the URL based on the content type and provider
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
        setIsLoading(true); // Set loading to true when the videoSrc changes
    }, [videoSrc, setIsLoading]);

    const handleSeasonChange = (season) => {
        setSelectedSeason(season);
        handleEpisodeChange(1); // Reset episode to 1 when changing season
        setIsLoading(true); // Set loading to true when changing season
    };

    const handleEpisodeChange = (episode) => {
        setSelectedEpisode(episode);
        switchProvider(videoPlayerState.provider, selectedSeason, episode);
        setIsLoading(true); // Set loading to true when changing episode
    };

    const handleContentLoad = () => {
        setIsLoading(false); // Set loading to false when content is loaded
    };

    const toggleOverlay = () => {
        setShowOverlay(prev => !prev);
    };

    const hidePlayer = () => {
        hideVideoPlayer();
    };

    if (!videoPlayerState.isVisible) {
        return null;
    }

    return (
        <div className="video-player-overlay">
            {isLoading && <LoadingIndicator />} {/* Show Loading Indicator when loading */}
            <iframe
                src={videoSrc}
                title="Video Player"
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                onLoad={handleContentLoad} // Trigger content load handler
                onError={() => {
                    setError('Failed to load video. Please try another source.');
                    setIsLoading(false); // Stop loading if there's an error
                }}
            ></iframe>
            <div className="overlay-menu-button" onClick={toggleOverlay}>
                {showOverlay ? <FaTimes size={24} /> : <FaEllipsisV size={24} />}
            </div>
            {showOverlay && (
                <div className="overlay-menu">
                    {determineContentType() === 'Anime' ? (
                        <>
                            <div className="dropdown">
                                <button className="dropdown-button">Season</button>
                                <div className="dropdown-content">
                                    <span onClick={() => handleSeasonChange(1)}>Season 1</span>
                                </div>
                            </div>
                            <div className="dropdown">
                                <button className="dropdown-button">Episode</button>
                                <div className="dropdown-content">
                                    {[...Array(item.totalEpisodes)].map((_, i) => (
                                        <span key={i} onClick={() => handleEpisodeChange(i + 1)}>
                                            Episode {i + 1}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {item.seasons_info && (
                                <>
                                    <div className="dropdown">
                                        <button className="dropdown-button">Season</button>
                                        <div className="dropdown-content">
                                            {item.seasons_info.map((season, index) => (
                                                <span key={index} onClick={() => handleSeasonChange(season.season_number)}>
                                                    Season {season.season_number}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="dropdown">
                                        <button className="dropdown-button">Episode</button>
                                        <div className="dropdown-content">
                                            {Array.from({ length: item.seasons_info[selectedSeason - 1]?.episode_count || 1 }, (_, i) => i + 1).map((episode) => (
                                                <span key={episode} onClick={() => handleEpisodeChange(episode)}>
                                                    Episode {episode}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                            <button className="control-button" onClick={() => switchProvider('NontonGo')}>NontonGo</button>
                            <button className="control-button" onClick={() => switchProvider('2embed')}>2Embed</button>
                        </>
                    )}
                    <button className="control-button" onClick={hidePlayer}>Close Player</button>
                </div>
            )}
            {error && <div className="error-message">{error}</div>}
        </div>
    );
};

export default VideoPlayer;
