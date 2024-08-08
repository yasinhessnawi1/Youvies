import React, { useContext, useState } from 'react';
import { FaPlay, FaInfoCircle, FaCheckCircle, FaRegCircle, FaStar } from 'react-icons/fa';
import { UserContext } from '../contexts/UserContext';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import '../styles/ItemCard.css';
import {fetchOneItem} from "../api/ItemsApi";

const ItemCard = ({ item , contentType}) => {
    const { user } = useContext(UserContext);
    const { showVideoPlayer } = useContext(VideoPlayerContext);
    const [isWatched, setIsWatched] = useState(user?.watched?.includes(item.title || item.attributes?.canonicalTitle) || false);


    const handlePlayClick = async () => {
            showVideoPlayer(item.id , item);
    };

    // Determine item type and set rating and imageUrl accordingly
    let rating = 0;
    let imageUrl = '';
    let title = '';

    if (item.attributes) { // Anime
        title = item.attributes.canonicalTitle;
        rating = item.attributes.averageRating || 0;
        imageUrl = item.attributes.posterImage ? item.attributes.posterImage.original : 'https://via.placeholder.com/300x450?text=No+Image';
    } else { // Movie or Show
        title = item.title;
        rating = item.vote_average || item.rating || 0;
        imageUrl = item.poster_path ? `https://image.tmdb.org/t/p/original${item.poster_path}` : item.image_url ? `https://image.tmdb.org/t/p/original${item.image_url}` : 'https://via.placeholder.com/300x450?text=No+Image';
    }

    return (
        <div className="item-card">
            <div className="item-image" style={{ backgroundImage: `url(${imageUrl})`|| 'https://via.placeholder.com/300x450?text=Loading...' }}>
                <div className="watched-icon">
                    {isWatched ? <FaCheckCircle color="green" /> : <FaRegCircle />}
                </div>
            </div>
            <div className="item-content">
                <div className="title">{title}</div>
                <div className="rating">
                    {[...Array(5)].map((_, index) => (
                        <FaStar key={index} color={index < (rating / 2) ? 'gold' : 'grey'} />
                    ))}
                </div>
                <div className="actions">
                    <button className="fire button" onClick={handlePlayClick}>
                        <FaPlay /> Play
                    </button>
                    <button className="ice button">
                        <FaInfoCircle /> Info
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ItemCard;
