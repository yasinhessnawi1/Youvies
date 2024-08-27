// ItemCard.js

import React, { useContext, useMemo } from 'react';
import { FaPlay, FaInfoCircle, FaCheckCircle, FaRegCircle, FaStar } from 'react-icons/fa';
import { UserContext } from '../contexts/UserContext';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import '../styles/components/ItemCard.css';
import Button from "./Button";
import {getTitle, playClick} from "../utils/helper";

const ItemCard = ({ item , isRelated}) => {
    const { showVideoPlayer } = useContext(VideoPlayerContext);
    const { user, getWatchedItem , addToWatchedList} = useContext(UserContext);


    const isWatched = useMemo(() => {
        return getWatchedItem(item.type, item.id, getTitle(item)) !== null;
    }, [getWatchedItem, item.id, item]);

    const handlePlayClick = async () => {
        showVideoPlayer(item.id, item.type);
    };

    const { title, rating, imageUrl } = useMemo(() => {
        let ratingValue = 0;
        let imagePath = '';
        let itemTitle = '';

        if (['movies', 'shows'].includes(item.type)) {
            itemTitle = item.name || item.title || 'Title not found'; // Ensure it's a string
            ratingValue = item.vote_average || 0;
            imagePath = item.poster_path
                ? `https://image.tmdb.org/t/p/original${item.poster_path}`
                : `https://via.placeholder.com/300x450?text=No+Image`;
        } else if (item.type === 'anime') {
            itemTitle = item.title.userPreferred || item.title.romaji || item.title.english || item.title.native || 'Unknown Title';
            ratingValue = item.rating / 10 || 0;
            imagePath = item.image || item.cover || `https://via.placeholder.com/300x450?text=No+Image`;
        }

        return {
            title: itemTitle,
            rating: ratingValue,
            imageUrl: imagePath,
        };
    }, [item.name, item.vote_average, item.poster_path, item.rating, item.image, item.cover, item.type, item.title]);

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
                    <Button text="Info" category={item.type} id={item.id} />
                    { !isRelated && <Button text="Watch" onClick={() => handlePlayClick()} />}
                </div>
            </div>
        </div>
    );
};

export default ItemCard;
