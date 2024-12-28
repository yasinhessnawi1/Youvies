// ResultPage.jsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useItemContext } from '../contexts/ItemContext';
import ItemCard from './ItemCard';
import '../styles/components/ResultPage.css';

const THRESHOLD_PX = 200; // how close to bottom before fetching more

const ResultPage = ({ items, contentType, selectedGenre, title, onClose }) => {
    const { fetchMoreItems, isLoading } = useItemContext();

    // We'll manage our "expanded" list of items here
    const [allItems, setAllItems] = useState(items);
    const [error, setError] = useState(null);
    const [isFetching, setIsFetching] = useState(false);

    const containerRef = useRef(null);

    // This function handles fetching more items when user scrolls near bottom
    const handleFetchMore = useCallback(async () => {
        if (isFetching || isLoading) return; // prevent multiple calls

        setIsFetching(true);
        try {
            // fetch more from the context
            const newItems = await fetchMoreItems(contentType, selectedGenre);
            // append them to our local state
            setAllItems((prev) => [...prev, ...newItems]);
        } catch (err) {
            setError('Failed to load more items.');
        }
        setIsFetching(false);
    }, [fetchMoreItems, contentType, selectedGenre, isFetching, isLoading]);

    // Listen to scroll events
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        // scrolled to bottom?
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop - clientHeight < THRESHOLD_PX) {
            handleFetchMore();
        }
    }, [handleFetchMore]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => {
                container.removeEventListener('scroll', handleScroll);
            };
        }
    }, [handleScroll]);

    return (
        <div className="result-page-backdrop">
            <div className="result-page-container" ref={containerRef}>
                <button className="close-button" onClick={onClose}>
                    ✕
                </button>
                <h2 className="result-page-title">{title}</h2>

                <div className="result-page-grid">
                    {allItems.map((item) => (
                        <ItemCard key={item.id || item.title} item={item} />
                    ))}
                </div>

                {/* Loading states or error messages */}
                {isLoading && <div className="loading-info">Loading more…</div>}
                {isFetching && <div className="loading-info">Fetching more…</div>}
                {error && <div className="error-message">{error}</div>}
            </div>
        </div>
    );
};

export default ResultPage;
