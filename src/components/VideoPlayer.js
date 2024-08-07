import React, { useContext, useEffect, useRef, useState } from 'react';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import '../styles/VideoPlayer.css';
import { FaStar, FaForward, FaBackward } from "react-icons/fa";

const VideoPlayer = () => {
    const { videoPlayerState, hideVideoPlayer, showVideoPlayer, item } = useContext(VideoPlayerContext);
    const playerRef = useRef(null);
    const [showTorrents, setShowTorrents] = useState(false);
    const [error, setError] = useState('');
    const controllerRef = useRef(null);

    useEffect(() => {
        const loadVideo = () => {
            if (videoPlayerState.magnet) {
                const videoSrc = `http://localhost:8080/stream?magnet=${encodeURIComponent(videoPlayerState.magnet)}`;

                // Abort previous request
                if (controllerRef.current) {
                    controllerRef.current.abort();
                }
                controllerRef.current = new AbortController();
                const signal = controllerRef.current.signal;

                if (playerRef.current) {
                    playerRef.current.src = videoSrc;
                    playerRef.current.load();
                    playerRef.current.play().catch((error) => {
                        setError('Failed to play video. Please try another torrent.');
                    });
                }
            }
        };

        loadVideo();

        return () => {
            if (controllerRef.current) {
                controllerRef.current.abort();
            }
            if (playerRef.current) {
                playerRef.current.removeAttribute('src');
                playerRef.current.load();
            }
        };
    }, [videoPlayerState.magnet]);

    const handleTorrentSelect = (magnet) => {
        setError('');

        // Abort current request
        if (controllerRef.current) {
            controllerRef.current.abort();
        }

        showVideoPlayer(magnet, videoPlayerState.torrents, item);
    };

    const hidePlayer = () => {
        // Abort current request
        if (controllerRef.current) {
            controllerRef.current.abort();
        }

        hideVideoPlayer();
    };

    if (!videoPlayerState.isVisible) {
        return null;
    }

    const seekForward = () => {
        if (playerRef.current) {
            playerRef.current.currentTime += 10;
        }
    };

    const seekBackward = () => {
        if (playerRef.current) {
            playerRef.current.currentTime -= 10;
        }
    };

    return (
        <div className="video-player-overlay">
            <button className="close-button" onClick={hidePlayer}>×</button>
            <button className="toggle-torrent-button" onClick={() => setShowTorrents(!showTorrents)}>
                {showTorrents ? 'Hide' : 'Servers'}
            </button>
            {showTorrents && (
                <div className="torrent-list">
                    {Object.keys(videoPlayerState.torrents).map((quality) =>
                        videoPlayerState.torrents[quality].map((torrent, index) => (
                            <div
                                key={index}
                                className={`torrent-item ${videoPlayerState.magnet === torrent.magnet ? 'active' : ''}`}
                                onClick={() => handleTorrentSelect(torrent.magnet)}
                            >
                                {quality} - {torrent.seeders} <FaStar size={13} />
                            </div>
                        ))
                    )}
                </div>
            )}
            {error && <div className="error-message">{error}</div>}
            <video id="player" className="webtor" ref={playerRef} controls title={item.name}>
                <track kind="captions" />
            </video>
            <div className="video-controls">
                <button className="control-button" onClick={seekBackward}><FaBackward /> 10s</button>
                <button className="control-button" onClick={seekForward}>10s <FaForward /></button>
            </div>
        </div>
    );
};

export default VideoPlayer;
