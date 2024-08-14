import React, { useEffect, useState, useRef } from 'react';
import { useItemContext } from '../contexts/ItemContext';
import Carousel from './Carousel';
import '../styles/components/VideoCardGrid.css';
import LoadingIndicator from './static/LoadingIndicator';
import { FaArrowDown, FaSymfony } from "react-icons/fa";

const VideoCardGrid = ({ contentType, genres, isHomePage }) => {
    const { items, selectedGenre, setSelectedGenre, isLoading, fetchGenreItems, fetchMoreItems } = useItemContext();
    const [currentItems, setCurrentItems] = useState([]);
    const hasFetched = useRef(false);

    useEffect(() => {
        setCurrentItems([]);

        if (!selectedGenre && !isHomePage) return;

        const itemKey = isHomePage ? `${contentType}-home` : `${contentType}-${selectedGenre}`;
        if (items[itemKey]) {
            setCurrentItems(items[itemKey]);
        } else if (!hasFetched.current && !isHomePage) {
            const token = JSON.parse(localStorage.getItem('user'))?.token;
            if (token && selectedGenre && !isLoading) {
                fetchGenreItems(token, contentType, selectedGenre);
                hasFetched.current = true;
            }
        }
    }, [selectedGenre, contentType, items, fetchGenreItems, isHomePage]);

    const handleGenreChange = (newGenre) => {
        if (newGenre !== selectedGenre) {
            hasFetched.current = false;  // Reset fetch flag if the genre changes
            setSelectedGenre(newGenre);
        }
    };

    const getName = (contentType) => {
        switch (contentType) {
            case 'movies':
                return 'Latest Movies:';
            case 'shows':
                return 'Latest TV Shows:';
            case 'anime':
                return 'Top Rated Anime Shows';
            default:
                return '';
        }
    };

    const handleFetchMore = async () => {
        const token = JSON.parse(localStorage.getItem('user'))?.token;
        console.log('Fetching more items...', contentType);
        const genre = selectedGenre || null;
        await fetchMoreItems(token, contentType, genre);
    };

    if (isLoading && currentItems.length === 0) return <LoadingIndicator />;

    return (
        <div className="video-card-grid">
            <div className="gridHeader">
                <div className="grid-title">
                    <h4 className="content-title">
                        {isHomePage ? getName(contentType) : (
                            <span className="grid-title"> Genre
                                <FaSymfony size={28} className="genre-icon"/> {" " + selectedGenre}
                            </span>
                        )}
                    </h4>
                    {!isHomePage && genres && genres.length > 1 && (
                        <div className="dropdown">
                            <button className="dropdown-button">
                                <FaArrowDown className={"arrow-down"} />
                            </button>
                            <div className="dropdown-content">
                                {genres.map((genre) => (
                                    <span key={genre.id} onClick={() => handleGenreChange(genre.name)}>
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="item-counter-container">
                    <span className="item-counter">{currentItems.length}</span>
                    <button className="load-more-button" onClick={handleFetchMore}>
                        Load More
                    </button>
                </div>
            </div>
            <Carousel items={currentItems} contentType={contentType} />
        </div>
    );
};

export default VideoCardGrid;
