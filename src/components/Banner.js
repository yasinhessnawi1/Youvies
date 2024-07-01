import React, { useEffect, useState, useContext } from 'react';
import { fetchItems } from '../api/ItemsApi';
import '../styles/Banner.css';
import { UserContext } from '../contexts/UserContext';

const Banner = ({ contentType }) => {
    const { user } = useContext(UserContext);
    const [items, setItems] = useState([]);
    const [currentIndices, setCurrentIndices] = useState([0, 1]);
    const [page, setPage] = useState(1);
    const pageSize = 100;

    useEffect(() => {
        if (!user) return;

        const loadItems = async () => {
            try {
                console.log('Fetching items:', contentType, page, pageSize);
                const itemsData = await fetchItems(user.token, contentType, page, pageSize);
                setItems(itemsData);
                console.log('Items:', itemsData.length);
            } catch (error) {
                console.error('Error loading items:', error);
            }
        };

        loadItems();
    }, [page, pageSize, user, contentType]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndices((prevIndices) => [
                (prevIndices[0] + 2) % items.length,
                (prevIndices[1] + 2) % items.length,
            ]);
        }, 5000); // Shuffle every 5 seconds

        return () => clearInterval(interval);
    }, [items]);

    const currentItems = [
        items[currentIndices[0]] || {},
        items[currentIndices[1]] || {},
    ];

    if (!user) return <div>Loading...</div>;

    return (
        <div className="banner-container">
            {currentItems.map((item, index) => (
                <div
                    key={index}
                    className="banner"
                    style={{ backgroundImage: `url(${item.poster_url || item.image_url || (item.attributes && item.attributes.posterImage && item.attributes.posterImage.original) || 'default_image_url'})` }}
                >
                    <div className="overlay"></div>
                    <div className="content">
                        <h1 className="title">{item.title || (item.attributes && item.attributes.canonicalTitle) || 'Title'}</h1>
                        <p className="description">
                            {item.description || (item.attributes && item.attributes.synopsis) || 'Description of the item goes here.'}
                        </p>
                        <div className="actions">
                            <button className="button fire play-button">
                                <img aria-hidden="true" alt="play-icon" src="https://openui.fly.dev/openui/24x24.svg?text=▶"/>
                                <span>Play</span>
                            </button>
                            <button className="button ice info-button">
                                <img aria-hidden="true" alt="info-icon" src="https://openui.fly.dev/openui/24x24.svg?text=ℹ"/>
                                <span>More Info</span>
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Banner;
