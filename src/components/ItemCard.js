// ItemCard.js

import React, { useContext, useMemo } from 'react';
import { FaPlay, FaInfoCircle, FaCheckCircle, FaRegCircle, FaStar } from 'react-icons/fa';
import { UserContext } from '../contexts/UserContext';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import '../styles/components/ItemCard.css';
import Button from "./Button";

const ItemCard = ({ item, contentType }) => {
    const { user, addToWatchedList } = useContext(UserContext);
    const { showVideoPlayer } = useContext(VideoPlayerContext);

    const isWatched = useMemo(function(){return undefined;}, undefined);

    const handlePlayClick = async (isContinue) => {
        const watchedItem = `${contentType}:${item.title}:1:1`;

        if (isContinue) {
            showVideoPlayer(item.id, item, true, contentType);
        } else {
            if (!isWatched) addToWatchedList(user, watchedItem);
            showVideoPlayer(item.id, item, false, contentType);
        }
    };

    const { title, rating, imageUrl } = useMemo(() => {
        let ratingValue = 0;
        let imagePath = '';
        let itemTitle = '';

        if (['movies', 'shows'].includes(contentType)) {
            itemTitle =  item.name ||'Title not found'; // Ensure it's a string
            ratingValue = item.vote_average || 0;
            imagePath = item.poster_path
                ? `https://image.tmdb.org/t/p/original${item.poster_path}`
                : `https://via.placeholder.com/300x450?text=No+Image`;
        } else if (['anime'].includes(contentType)) {
            if (typeof item.title === 'object' && item.title !== null) {
                itemTitle = item.title.userPreferred || item.title.romaji || item.title.english || item.title.native || 'Unknown Title'; // Handle object
            }
            ratingValue = item.rating / 10|| 0;
            imagePath = item.image || item.cover || `https://via.placeholder.com/300x450?text=No+Image`;
        }

        return {
            title: itemTitle,
            rating: ratingValue,
            imageUrl: imagePath,
        };
    }, [contentType, item.title, item.name, item.vote_average, item.poster_path, item.rating, item.image, item.cover]);

    return (
        <div className="item-card">
            <div className="item-image" style={{ backgroundImage: `url(${imageUrl})` }}>
                <div className="watched-icon">
                    {isWatched ? <FaCheckCircle color="green" /> : <FaRegCircle />}
                </div>
            </div>
            <div className="item-content">
                <div className="title">{title}</div>
                <div className="rating">
                    {[...Array(5)].map((_, index) => (
                        <FaStar key={index} color={index < rating / 2 ? 'gold' : 'grey'} />
                    ))}
                </div>
                <div className="actions">
                    <Button text="Info" onClick={() => alert('This Function is not made yet please be patient!')} />
                    <Button text="Watch" onClick={() => handlePlayClick(false)} />
                </div>
            </div>
        </div>
    );
};

export default ItemCard;
