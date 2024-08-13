import React, { useEffect, useState, useRef } from 'react';
import { useItemContext } from '../contexts/ItemContext';
import Carousel from './Carousel';
import '../styles/components/VideoCardGrid.css';
import LoadingIndicator from './static/LoadingIndicator';
import { FaArrowDown, FaSymfony } from "react-icons/fa";

const VideoCardGrid = ({ contentType, genres, isHomePage }) => {
    const { items, selectedGenre, setSelectedGenre, isLoading, fetchGenreItems } = useItemContext();
    const [currentItems, setCurrentItems] = useState([]);
    const hasFetched = useRef(false);

    useEffect(() => {
        // Clear current items immediately on contentType or selectedGenre change
        setCurrentItems([]);

        // Prevent fetch requests if genre is not selected or if it's the home page
        if (!selectedGenre && !isHomePage) return;

        const itemKey = isHomePage ? `home-${contentType}` : `${contentType}-${selectedGenre}`;
        if (items[itemKey]) {
            setCurrentItems(items[itemKey]);
        } else if (!hasFetched.current && !isHomePage) {
            // Fetch genre items if not already fetched (only for non-home pages)
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

    if (isLoading) return <LoadingIndicator />;

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
                <div className="item-counter">{currentItems.length}</div>
            </div>
            <Carousel items={currentItems} contentType={contentType} />
        </div>
    );
};

export default VideoCardGrid;
