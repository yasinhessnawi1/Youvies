import React, { useContext, useEffect, useRef, useState } from 'react';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import '../styles/VideoPlayer.css';
import { FaStar, FaForward, FaBackward } from "react-icons/fa";

const VideoPlayer = () => {
    const { videoPlayerState, hideVideoPlayer, switchProvider, item } = useContext(VideoPlayerContext);
    const playerRef = useRef(null);
    const [showOverlay, setShowOverlay] = useState(false);
    const [error, setError] = useState('');

    const constructVideoUrl = (item, provider) => {
        switch (provider) {
            case 'vidsrc':
                return item.seasons_info === undefined
                    ? `https://vidsrc.xyz/embed/movie?tmdb=${item.tmdbId}`
                    : `https://vidsrc.xyz/embed/tv?tmdb=${item.tmdbId}&season=${item.season}&episode=${item.episode}`;
            case 'NontonGo':
                return item.seasons_info === undefined
                    ? `https://www.NontonGo.win/embed/movie/${item.tmdbId}`
                    : `https://www.NontonGo.win/embed/tv/${item.tmdbId}/${item.season}/${item.episode}`;
            case 'SuperEmbed':
                return item.seasons_info === undefined
                    ? `https://multiembed.mov/directstream.php?video_id=${item.tmdbId}&tmdb=1`
                    : `https://multiembed.mov/directstream.php?video_id=${item.tmdbId}&tmdb=1&s=${item.season}&e=${item.episode}`;
            case '2embed':
                if (item.subtype === 'movie') {
                    return `https://www.2embed.cc/embed/${item.tmdbId}`;
                } else if (item.subtype === 'tv') {
                    return `https://www.2embed.cc/embedtv/${item.tmdbId}&s=${item.season}&e=${item.episode}`;
                } else if (item.subtype === 'anime') {
                    return `https://2anime.xyz/embed/${item.title}-${item.episode}`;
                }
                break;
            default:
                return '';
        }
    };

    useEffect(() => {
        const loadVideo = () => {
            if (videoPlayerState.tmdbId) {
                const videoSrc = constructVideoUrl(item, videoPlayerState.provider);
                if (playerRef.current) {
                    playerRef.current.src = videoSrc;
                    playerRef.current.load();
                    playerRef.current.play().catch((error) => {
                        setError('Failed to play video. Please try another source.');
                    });
                }
            }
        };

        loadVideo();

        return () => {
            if (playerRef.current) {
                playerRef.current.removeAttribute('src');
                playerRef.current.load();
            }
        };
    }, [videoPlayerState.tmdbId, videoPlayerState.provider, item]);

    const hidePlayer = () => {
        hideVideoPlayer();
    };

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

    if (!videoPlayerState.isVisible) {
        return null;
    }

    return (
        <div className="video-player-overlay" onMouseEnter={() => setShowOverlay(true)} onMouseLeave={() => setShowOverlay(false)}>
            <video id="player" ref={playerRef} controls>
                <track kind="captions" />
            </video>
            {showOverlay && (
                <div className="overlay-menu">
                    <button className="close-button" onClick={hidePlayer}>×</button>
                    <button className="control-button" onClick={() => switchProvider('NontonGo')}>NontonGo</button>
                    <button className="control-button" onClick={() => switchProvider('vidsrc')}>VidSrc</button>
                    <button className="control-button" onClick={() => switchProvider('SuperEmbed')}>SuperEmbed</button>
                    <button className="control-button" onClick={() => switchProvider('2embed')}>2Embed</button>
                </div>
            )}
            <div className="video-controls">
                <button className="control-button" onClick={seekBackward}><FaBackward /> 10s</button>
                <button className="control-button" onClick={seekForward}>10s <FaForward /></button>
            </div>
            {error && <div className="error-message">{error}</div>}
        </div>
    );
};

export default VideoPlayer;
