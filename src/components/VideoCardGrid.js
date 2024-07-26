import React, { useState, useEffect, useContext } from 'react';
import { ItemContext } from '../contexts/ItemContext';
import Carousel from './Carousel';
import '../styles/VideoCardGrid.css';

const VideoCardGrid = ({ contentType, genre, items }) => {
    const { fetchMoreItems } = useContext(ItemContext);
    const [currentItems, setCurrentItems] = useState(items);

    useEffect(() => {
        setCurrentItems(items);
    }, [items]);

    return (
        <div className="video-card-grid">
            <div className={'gridHeader'}>
                <h4 className="content-title">{genre || contentType}</h4>
                <div className="item-counter">{items.length} items</div>
            </div>
            <Carousel items={currentItems}/>
        </div>
    );
};

export default VideoCardGrid;
