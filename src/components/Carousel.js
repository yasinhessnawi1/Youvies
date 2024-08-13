import React, { useState, useEffect } from 'react';
import ItemCard from './ItemCard';
import '../styles/components/Carousel.css';

const Carousel = ({ items = [] ,contentType} ) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(1);

    useEffect(() => {
        const updateItemsPerPage = () => {
            if (window.innerWidth > 1200) {
                setItemsPerPage(5);
            } else if (window.innerWidth > 992) {
                setItemsPerPage(4);
            } else if (window.innerWidth > 768) {
                setItemsPerPage(3);
            } else if (window.innerWidth > 576) {
                setItemsPerPage(2);
            } else {
                setItemsPerPage(1);
            }
        };
        updateItemsPerPage();
        window.addEventListener('resize', updateItemsPerPage);
        return () => {
            window.removeEventListener('resize', updateItemsPerPage);
        };
    }, []);

    const nextItem = () => {
        if (currentIndex + itemsPerPage < items.length) {
            setCurrentIndex(currentIndex + itemsPerPage);
        }else{
            setCurrentIndex(0);
        }
    };

    const prevItem = () => {
        if (currentIndex - itemsPerPage >= 0) {
            setCurrentIndex(currentIndex - itemsPerPage);
        }
    };

    const getVisibleItems = () => {
        return items.slice(currentIndex, currentIndex + itemsPerPage);
    };

    return (
        <div className="carousel">
            {currentIndex > 0 && (
                <button className="carousel-button prev" onClick={prevItem}>‹</button>
            )}
            <div className="carousel-items">
                {getVisibleItems().map((item, index) => (
                    <div key={`${item.id}-${index}`} className="carousel-item">
                        <ItemCard item={item} contentType={contentType}/>
                    </div>
                ))}
            </div>
            {currentIndex + itemsPerPage < items.length && (
                <button className="carousel-button next" onClick={nextItem}>›</button>
            )}
        </div>
    );
};

export default Carousel;
