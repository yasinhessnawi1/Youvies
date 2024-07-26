import React, { useContext, useState } from 'react';
import { FaPlay, FaInfoCircle, FaCheckCircle, FaRegCircle, FaStar } from 'react-icons/fa';
import { UserContext } from '../contexts/UserContext';
import { VideoPlayerContext } from '../contexts/VideoPlayerContext';
import '../styles/ItemCard.css';

const ItemCard = ({ item }) => {
    const { user } = useContext(UserContext);
    const { showVideoPlayer } = useContext(VideoPlayerContext);
    const [isWatched, setIsWatched] = useState(user?.watched?.includes(item.title || item.attributes?.canonicalTitle) || false);

    const handlePlayClick = () => {
        if (item.torrents) {
            showVideoPlayer(getFirstHDTorrent(item.torrents), item.torrents);
        } else if (item.episodes) {
            showVideoPlayer(getFirstHDTorrent(item.episodes[0].torrents), item.episodes[0].torrents, item.episodes, item.episodes[0]);
        }
    };

    const getFirstHDTorrent = (torrents) => {
        if (torrents['HD'] && torrents['HD'].length > 0) {
            return torrents['HD'][0].magnet;
        }
        const qualities = Object.keys(torrents);
        for (let quality of qualities) {
            if (torrents[quality] && torrents[quality].length > 0) {
                return torrents[quality][0].magnet;
            }
        }
        return null;
    };

    const isAnime = !!item.attributes;
    const isMovie = !!item.torrents;
    const title = isAnime ? item.attributes.canonicalTitle : item.title;
    let rating = isAnime ? item.attributes.averageRating : item.rating;
    rating = (isMovie && !isAnime) ? item.vote_average : item.rating;
    let imageUrl;
    imageUrl = isMovie && !isAnime ? "https://image.tmdb.org/t/p/original/" + item.poster_path : "https://image.tmdb.org/t/p/original/" + item.image_url;
    if (isAnime) {
        imageUrl = item.attributes.posterImage.original;
    }

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
