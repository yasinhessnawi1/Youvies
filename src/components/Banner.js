// Banner.js

import React, { useEffect, useState, useContext, useRef } from 'react';
import '../styles/components/Banner.css';
import '../styles/components/VideoPlayer.css';
import { UserContext } from '../contexts/UserContext';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import { useItemContext } from '../contexts/ItemContext';
import Button from "./Button";

const Banner = ({ contentType }) => {
    const { user, addToWatchedList } = useContext(UserContext);
    const { showVideoPlayer } = useContext(VideoPlayerContext);
    const { items, isLoading, fetchAllItems } = useItemContext();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!user || !contentType || hasFetched.current || isLoading) return;
        const itemKey = `home-${contentType}`;
        if ((!items[itemKey] || items[itemKey].length === 0) && !hasFetched) {
            fetchAllItems(user.token);
        }
        hasFetched.current = true;
    }, [user, contentType, items, fetchAllItems]);

    useEffect(() => {
        if (isPaused || isLoading) return;
        const interval = setInterval(() => {
            const itemKey = `home-${contentType}`;
            setCurrentIndex((prevIndex) => (prevIndex + 1) % (items[itemKey]?.length || 1));
        }, 15000);

        return () => clearInterval(interval);
    }, [items, contentType, isPaused, isLoading]);

    const itemKey = `${contentType}-home`;
    if (isLoading || !items[itemKey] || items[itemKey].length === 0) return null;

    const currentItem = items[itemKey][currentIndex] || {};
    const handleReadMore = () => {
        setShowFullDescription(!showFullDescription);
    };

    const handlePause = () => {
        setIsPaused(!isPaused);
    };

    const handlePlayClick = async (item) => {
        if (!user) return;
        const itemType = determineItemType(contentType);
        if (itemType.includes("Show") && user.watched.includes(`${itemType}:${item.title}:1:1`)) {
            showVideoPlayer(item.id, item, true);
        } else {
            const watchedItem = `${itemType}:${item.title}:${1}:${1}`;
            addToWatchedList(user, watchedItem);
            showVideoPlayer(item.id, item);
        }
    };

    const determineItemType = (contentType) => {
        switch (contentType) {
            case 'movies':
                return 'Movie';
            case 'shows':
                return 'Show';
            case 'anime':
                return 'Anime';
            default:
                return 'Unknown';
        }
    };

    let imageUrl = '';
    let title = '';
    switch (contentType) {
        case 'movies':
        case 'shows':
            imageUrl = currentItem.backdrop_path ? `https://image.tmdb.org/t/p/original${currentItem.backdrop_path}` :
                currentItem.poster_path ?  `https://image.tmdb.org/t/p/original${currentItem.poster_path}`: `https://via.placeholder.com/300x450?text=Loading...`;
            title = currentItem.title || 'Title loading...';
            break;
        case 'anime':
            imageUrl = currentItem.cover || currentItem.image || 'https://via.placeholder.com/300x450?text=Image+Not+Found.';
            title = currentItem.title?.userPreferred || 'Title loading...';
            break;
        default:
            break;
    }

    return (
        <div className="banner">
            <div className="banner-background" style={{
                backgroundImage: `url(${imageUrl})`,
            }}></div>
            <div className="banner-overlay"></div>
            <div className="banner-content">
                <h1 className="banner-title">{title || 'Title loading...'}</h1>
                <p className="banner-description">
                    {showFullDescription
                        ? currentItem.overview || currentItem.description || 'Description loading...'
                        : (currentItem.overview || currentItem.description || 'Description loading ...').slice(0, 120)}
                    {currentItem.overview && currentItem.overview.length > 120 && (
                        <span onClick={handleReadMore} className="read-more">
                        {showFullDescription ? ' Show Less' : '... Read More'}
                    </span>
                    )}
                </p>
                <div className="banner-actions">
                    <Button text="More Info" onClick={() => alert('This Function is not made yet please be patient!')} />
                    <Button text="Watch" onClick={() => handlePlayClick(currentItem)} />
                    <Button text={isPaused ? 'Resume' : 'Pause'} onClick={handlePause} />
                </div>
            </div>
        </div>
    );
}

export default Banner;
