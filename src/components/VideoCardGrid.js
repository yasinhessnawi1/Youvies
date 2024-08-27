import React, { useEffect, useState, useRef } from 'react';
import { useItemContext } from '../contexts/ItemContext';
import Carousel from './Carousel';
import '../styles/components/VideoCardGrid.css';
import LoadingIndicator from './static/LoadingIndicator';
import { FaArrowDown } from "react-icons/fa";

const VideoCardGrid = ({ contentType, genres, isHomePage, title = "", customItems = null , isRelated}) => {
    const { items, selectedGenre, setSelectedGenre, isLoading, fetchGenreItems, fetchMoreItems } = useItemContext();
    const [currentItems, setCurrentItems] = useState([]);
    const hasFetched = useRef({}); // Use an object to track fetches for each genre/contentType combination

    useEffect(() => {
        // If customItems are provided, use them instead of fetching
        if (customItems) {
            setCurrentItems(customItems);
            return;
        }

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
    }, [selectedGenre, contentType, fetchGenreItems, isHomePage, items, customItems]);

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

    if (currentItems.length === 0 && !customItems) return <LoadingIndicator />;

    return (
        <div className="video-card-grid">
            <div className="gridHeader">
                <div className="grid-title">
                    <h4 className="content-title">
                        {title || (isHomePage ? `${title}:` : `${genres.find(genre => genre.id === selectedGenre)?.name.toString().toUpperCase()} `)}
                    </h4>
                    {!isHomePage && genres && genres.length > 1 && !customItems && (
                        <div className="dropdown">
                            <button className="dropdown-button" title={"Select a genre to change the list"}>
                                <FaArrowDown className={"arrow-down"} />
                            </button>
                            <div className="dropdown-content">
                                {genres.map(genre => (
                                    <span key={genre.id} onClick={() => handleGenreChange(genre)} title={"Select this genre"}>
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                {!customItems && (
                    <div className="item-counter-container">
                        <span className="item-counter" title={`There are Totally ${currentItems?.length || 0} items currently in this list.`}>{currentItems?.length || 0}</span>
                        <button className="load-more-button" onClick={handleFetchMore} title={"Load more items to be added to the current list."}>
                            Load More
                        </button>
                    </div>
                )}
            </div>
            <Carousel items={currentItems} isRelated={isRelated}/>
        </div>
    );
};

export default VideoCardGrid;
