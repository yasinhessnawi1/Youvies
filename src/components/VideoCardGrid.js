import React, { useState, useEffect } from 'react';
import Carousel from './Carousel';
import '../styles/VideoCardGrid.css';

const VideoCardGrid = ({ contentType, genre, items }) => {
    const [currentItems, setCurrentItems] = useState(items);

    useEffect(() => {
        setCurrentItems(items);
    }, [items]);
    if ( items === null) {
        return null;
    }
    return (
        <div className="video-card-grid">
            <div className={'gridHeader'}>
                <h4 className="content-title">{genre || contentType}</h4>
                <div className="item-counter">{items.length}</div>
            </div>
            <Carousel items={currentItems } contentType={contentType}/>
        </div>
    );
};

export default VideoCardGrid;
