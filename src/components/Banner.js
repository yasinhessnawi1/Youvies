import React, { useEffect, useState, useContext } from 'react';
import {fetchBannerItems, fetchOneItem} from '../api/ItemsApi';
import '../styles/Banner.css';
import '../styles/VideoPlayer.css';
import { UserContext } from '../contexts/UserContext';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';

const Banner = ({ contentType }) => {
    const { user } = useContext(UserContext);
    const { showVideoPlayer } = useContext(VideoPlayerContext);
    const [items, setItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [page, setPage] = useState(1);
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const pageSize = 10;

    useEffect(() => {
        const loadItems = async () => {
            try {
                if (!user) return;
                const itemsData = await fetchBannerItems(user.token, contentType, page, pageSize);
                setItems(itemsData);
            } catch (error) {
                console.error('Error loading items:', error);
            }
        };

        loadItems();
    }, [page, pageSize, user, contentType]);

    useEffect(() => {
        if (isPaused) return;
        if (!items) return;
        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
        }, 15000);

        return () => clearInterval(interval);
    }, [items, isPaused]);

    if (!items) return null;

    const currentItem = items[currentIndex] || {};

    const getBestTorrent = (torrents) => {
        const qualityPriority = ['1080p', '720p', '480p', 'unknown'];
        for (const quality of qualityPriority) {
            if (torrents[quality] && torrents[quality].length > 0) {
                return torrents[quality][0];
            }
        }
        return torrents['unknown'] ? torrents['unknown'][0] : null;
    };

    const handleReadMore = () => {
        setShowFullDescription(!showFullDescription);
    };

    const handlePause = () => {
        setIsPaused(!isPaused);
    };

    const handlePlayClick = async (item) => {
        const fullItem = await fetchOneItem(user.token, contentType, item._id || item.id);
        let bestTorrent = null;
        if (fullItem.torrents && fullItem.torrents.length !== 0) { // Movie or Anime Movie
            bestTorrent = getBestTorrent(fullItem.torrents);
        } else if (fullItem.Seasons) { // Show or Anime Show
            const season = Object.values(fullItem.Seasons)[0]; // Get the first season
            const episode = Object.values(season.episodes)[0]; // Get the first episode
            bestTorrent = getBestTorrent(episode.torrents);
        }
        if (bestTorrent) {
            showVideoPlayer(bestTorrent.magnet, fullItem.torrents || episode.torrents, bestTorrent);
        }
    };

    return (
        <div className="banner">
            <div className="banner-background" style={{
                backgroundImage: `url(${currentItem.poster_path ? `https://image.tmdb.org/t/p/original/${currentItem.poster_path}` : currentItem.image_url ? `https://image.tmdb.org/t/p/original/${currentItem.image_url}` : currentItem.attributes?.posterImage?.original || 'picture goes here'})`
            }}></div>
            <div className="overlay"></div>
            <div className="content">
                <h1 className="title">{currentItem.title || currentItem.attributes?.canonicalTitle || 'Title'}</h1>
                <p className="description">
                    {showFullDescription
                        ? currentItem.overview || currentItem.attributes?.synopsis || 'Description of the item goes here.'
                        : (currentItem.overview || currentItem.attributes?.synopsis || 'Description of the item goes here.').slice(0, 120)}
                    {currentItem.overview && currentItem.overview.length > 120 && (
                        <span onClick={handleReadMore} className="read-more">
                            {showFullDescription ? ' Show Less' : '... Read More'}
                        </span>
                    )}
                </p>
                <div className="actions">
                    <button className="button fire play-button" onClick={() => handlePlayClick(currentItem)}>
                        <img aria-hidden="true" alt="play-icon" src="https://openui.fly.dev/openui/24x24.svg?text=▶" />
                        <span>Play</span>
                    </button>
                    <button className="button ice info-button">
                        <img aria-hidden="true" alt="info-icon" src="https://openui.fly.dev/openui/24x24.svg?text=ℹ" />
                        <span>More Info</span>
                    </button>
                    <button className="button pause-button" onClick={handlePause}>
                        <img aria-hidden="true" alt="pause-icon"
                             src={isPaused ? "https://openui.fly.dev/openui/24x24.svg?text=▶" : "https://openui.fly.dev/openui/24x24.svg?text=❚❚"} />
                        <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Banner;
