import React, { useEffect, useState, useRef } from 'react';
import { useItemContext } from '../contexts/ItemContext';
import Carousel from './Carousel';
import '../styles/components/VideoCardGrid.css';
import LoadingIndicator from './static/LoadingIndicator';
import { FaArrowDown, FaSymfony } from "react-icons/fa";

const VideoCardGrid = ({ contentType, genres, isHomePage }) => {
    const { items, selectedGenre, setSelectedGenre, isLoading, fetchGenreItems, fetchMoreItems } = useItemContext();
    const [currentItems, setCurrentItems] = useState([]);
    const hasFetched = useRef({}); // Use an object to track fetches for each genre/contentType combination

    useEffect(() => {
        const itemKey = isHomePage ? `${contentType}-home` : `${contentType}-${selectedGenre}`;

        // Check if items for the current genre/contentType are already cached
        if (items[itemKey]) {
            setCurrentItems(items[itemKey]);
        } else if (!hasFetched.current[itemKey] && selectedGenre && !isHomePage) {
            fetchGenreItems(contentType, selectedGenre).then(() => {
                hasFetched.current[itemKey] = true; // Mark as fetched
                setCurrentItems(items[itemKey]);
            });
        }
    }, [selectedGenre, contentType, fetchGenreItems, isHomePage, items]);

    const handleGenreChange = (newGenre) => {
        if (newGenre !== selectedGenre) {
            if (contentType !== "anime") {
                setSelectedGenre(newGenre.id);
            } else {
                setSelectedGenre(newGenre.name);
            }
        }
    };

    const handleFetchMore = async () => {
        const genre = selectedGenre || null;
        await fetchMoreItems(contentType, genre);
    };

    if (isLoading && currentItems.length === 0) return <LoadingIndicator />;

    return (
        <div className="video-card-grid">
            <div className="gridHeader">
                <div className="grid-title">
                    <h4 className="content-title">
                        {isHomePage ? `${contentType.charAt(0).toUpperCase() + contentType.slice(1)}:` : `Genre: ${genres.find(genre => genre.id === selectedGenre)?.name}`}
                    </h4>
                    {!isHomePage && genres && genres.length > 1 && (
                        <div className="dropdown">
                            <button className="dropdown-button">
                                <FaArrowDown className={"arrow-down"} />
                            </button>
                            <div className="dropdown-content">
                                {genres.map(genre => (
                                    <span key={genre.id} onClick={() => handleGenreChange(genre)}>
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="item-counter-container">
                    <span className="item-counter">{currentItems?.length || 0}</span>
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
