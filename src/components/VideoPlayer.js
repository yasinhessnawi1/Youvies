import React, { useContext, useEffect } from 'react';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import '../styles/VideoPlayer.css';

const VideoPlayer = () => {
    const { videoPlayerState, hideVideoPlayer, changeQuality, changeEpisode } = useContext(VideoPlayerContext);

    useEffect(() => {
        if (videoPlayerState.magnet) {
            window.webtor = window.webtor || [];
            window.webtor.push({
                id: 'player',
                magnet: videoPlayerState.magnet,
                poster: 'https://via.placeholder.com/150/0000FF/808080',
                subtitles: [],
                lang: 'en',
            });
        }
    }, [videoPlayerState.magnet]);

    if (!videoPlayerState.isVisible) {
        return null;
    }

    return (
        <div className="video-player-overlay">
            <button className="close-button" onClick={hideVideoPlayer}>×</button>
            <div id="player" className="webtor" />
            <div className="controls">
                {Object.keys(videoPlayerState.torrents).map((quality) => (
                    <button
                        key={quality}
                        className={`quality-button ${videoPlayerState.currentQuality === quality ? 'active' : ''}`}
                        onClick={() => changeQuality(quality)}
                    >
                        {quality}
                    </button>
                ))}
                {videoPlayerState.episodes.length > 0 && (
                    <select
                        className="episode-select"
                        value={videoPlayerState.currentEpisode?.id || ''}
                        onChange={(e) => changeEpisode(videoPlayerState.episodes.find(ep => ep.id === parseInt(e.target.value)))}
                    >
                        {videoPlayerState.episodes.map((episode) => (
                            <option key={episode.id} value={episode.id}>
                                {episode.title}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            <script src="https://cdn.jsdelivr.net/npm/@webtor/embed-sdk-js/dist/index.min.js" charset="utf-8" async></script>
        </div>
    );
};

export default VideoPlayer;
