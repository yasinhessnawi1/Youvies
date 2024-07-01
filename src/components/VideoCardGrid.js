import React, { useEffect, useState, useContext } from 'react';
import { FaPlusSquare } from 'react-icons/fa';
import { fetchItems } from '../api/ItemsApi';
import { UserContext } from '../contexts/UserContext';
import ItemCard from './ItemCard';
import '../styles/VideoCardGrid.css';

const VideoCardGrid = ({ contentType }) => {
    const { user } = useContext(UserContext);
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);

    const [error, setError] = useState(null);

    const calculatePageSize = () => Math.floor(window.innerWidth / 200) - 2;
    const [pageSize, setPageSize] = useState(calculatePageSize());
    useEffect(() => {
        const handleResize = () => {
            setPageSize(calculatePageSize());
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        if (!user) return;

        const loadItems = async () => {
            try {
                const itemsData = await fetchItems(user.token, contentType, page, pageSize);
                setItems(prevItems => [...prevItems, ...itemsData]);
            } catch (error) {
                console.error('Error loading items:', error);
                setError('Failed to load items. Please try again later.');
            }
        };

        loadItems();
    }, [contentType, page, pageSize, user]);

    const loadMoreItems = () => {
        setPage(prevPage => prevPage +1);
    };

    const getContentTitle = (type) => {
        switch (type) {
            case 'movies':
                return 'Movies';
            case 'shows':
                return 'TV Shows';
            case 'anime_shows':
                return 'Anime Shows';
            case 'anime_movies':
                return 'Anime Movies';
            default:
                return 'Content';
        }
    };

    return (
        <div className="video-card-grid">
            <h4 className="content-title">{getContentTitle(contentType)}</h4>
            {error && <div className="error-message">{error}</div>}
            <div className="cards-container">
                {items.map((item) => (
                    <ItemCard key={item.id || item._id} item={item}/>
                ))}
                <div className="load-more-container">

                    <button className="load-more-button" onClick={loadMoreItems}>
                        <span className={"watch-more"}>Watch More</span>
                        <FaPlusSquare size={26} className={"watch-more-icon"}/>
                    </button>
                </div>
            </div>

        </div>
    );
};

export default VideoCardGrid;
