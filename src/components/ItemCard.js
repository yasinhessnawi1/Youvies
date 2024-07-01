import React, { useContext } from 'react';
import { FaPlay, FaInfoCircle, FaCheckCircle, FaRegCircle, FaStar } from 'react-icons/fa';
import { UserContext } from '../contexts/UserContext';
import '../styles/ItemCard.css';

const ItemCard = ({ item }) => {
    const { user } = useContext(UserContext);

    let isWatched = false;
    if (user.user.watched !== undefined) {
        isWatched = user.user.watched.includes(item.title || item.attributes?.canonicalTitle);
    }

    const isAnime = item.type === 'anime';
    const title = isAnime ? item.attributes.canonicalTitle : item.title;
    const rating = isAnime ? item.attributes.averageRating : item.rating;
    const imageUrl = item.image_url || item.poster_url || item.attributes?.posterImage?.original;

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
                        <FaStar key={index} color={index < (rating / 2) ? 'gold' : 'grey'} />
                    ))}
                </div>
            </div>
            <div className="actions">
                <button className="fire button">
                    <FaPlay /> Play
                </button>
                <button className="ice button">
                    <FaInfoCircle /> Info
                </button>
            </div>
        </div>
    );
};

export default ItemCard;
