// Carousel.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useItemContext } from '../contexts/ItemContext';
import ItemCard from './ItemCard';
import LoadingIndicator from './static/LoadingIndicator';
import '../styles/components/Carousel.css';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import debounce from 'lodash.debounce';
import { useSwipeable } from 'react-swipeable'; // For touch support

const Carousel = ({
                    contentType,
                    genres,
                    isHomePage,
                    title = '',
                    isRelated,
                    customItems = null, // New Prop for Custom Items
                  }) => {
  const {
    items,
    selectedGenre,
    setSelectedGenre, // Destructure setSelectedGenre
    fetchGenreItems,
    fetchMoreItems,
    isLoading,
  } = useItemContext();

  const carouselRef = useRef(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  // Determine the key based on contentType and selectedGenre
  const itemKey = isHomePage ? `${contentType}-home` : `${contentType}-${selectedGenre}`;

  // Fetch initial items from context if customItems are not provided
  useEffect(() => {
    const loadInitialItems = async () => {
      if (!customItems && !items[itemKey]) {
        try {
          await fetchGenreItems(contentType, selectedGenre);
        } catch (err) {
          setError('Failed to load items.');
        }
      }
    };
    loadInitialItems();
  }, [contentType, selectedGenre, fetchGenreItems, itemKey, isHomePage, items, customItems]);

  // Handle fetching more items
  const handleFetchMore = useCallback(async () => {
    if (isFetching || isLoading) return;

    // If customItems are provided, do not fetch more
    if (customItems) return;

    setIsFetching(true);
    try {
      await fetchMoreItems(contentType, selectedGenre); // Fetch more items from context
    } catch (err) {
      setError('Failed to load more items.');
    }
    setIsFetching(false);
  }, [isFetching, isLoading, fetchMoreItems, contentType, selectedGenre, customItems]);

  // Debounced scroll handler
  const handleScroll = useCallback(
      debounce(() => {
        const carousel = carouselRef.current;
        if (!carousel) return;

        const { scrollLeft, scrollWidth, clientWidth } = carousel;
        // Trigger fetch when scrolled to within 100px of the end
        if (scrollLeft + clientWidth >= scrollWidth - 100) {
          handleFetchMore();
        }
      }, 200), // Debounce delay of 200ms
      [handleFetchMore]
  );

  useEffect(() => {
    const carousel = carouselRef.current;
    if (carousel) {
      carousel.addEventListener('scroll', handleScroll);
      return () => {
        carousel.removeEventListener('scroll', handleScroll);
        handleScroll.cancel(); // Cancel any pending debounced calls
      };
    }
  }, [handleScroll]);

  // Scroll the carousel by container's width
  const scrollCarousel = (direction) => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const scrollAmount = carousel.clientWidth;
    carousel.scrollBy({
      left: direction === 'next' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  };

  // Get visible items: prioritize customItems over context items
  const visibleItems = customItems || items[itemKey] || [];

  // Swipe handlers for touch support
  const handlers = useSwipeable({
    onSwipedLeft: () => scrollCarousel('next'),
    onSwipedRight: () => scrollCarousel('prev'),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  return (
      <div
          className="carousel-wrapper"
          {...handlers}
          aria-label={`${title || (isHomePage ? `${contentType} Carousel` : `${genres.find((genre) => genre.id === selectedGenre)?.name} Carousel`)}`}
          role="region"
      >
        {/* Header Section */}
        <div className="gridHeader">
          <div className="grid-title">
            <h4 className="content-title">
              {title || (isHomePage ? `${contentType} Home` : `${genres.find((genre) => genre.id === selectedGenre)?.name.toUpperCase()}`)}
            </h4>
            {!isHomePage && genres && genres.length > 1 && !customItems && (
                <div className="dropdown">
                  <button
                      type="button" // Prevent default form submission
                      className="dropdown-button"
                      title="Select a genre to change the list"
                  >
                    Genre <span className="arrow-down">▼</span>
                  </button>
                  <div className="dropdown-content">
                    {genres.map((genre) => (
                        <span
                            key={genre.id}
                            onClick={() => {
                              setSelectedGenre(genre.id); // Update selectedGenre
                              fetchGenreItems(contentType, genre.id);
                            }}
                            title={`Select ${genre.name}`}
                        >
                    {genre.name}
                  </span>
                    ))}
                  </div>
                </div>
            )}
          </div>
          <div className="item-counter-container">
          <span className="item-counter" title={`There are ${visibleItems.length} items currently in this list.`}>
            {visibleItems.length} Items
          </span>
          </div>
        </div>

        {/* Carousel Section */}
        <div className="carousel-container">
          {visibleItems.length > 0 && (
              <>
                <button
                    type="button" // Prevent default form submission
                    className="carousel-button left"
                    onClick={() => scrollCarousel('prev')}
                    aria-label="Scroll Left"
                >
                  <FaChevronLeft />
                </button>
                <div className="carousel" ref={carouselRef}>
                  {visibleItems.map((item) => (
                      <ItemCard key={item.id || item.title} item={item} isRelated={isRelated} />
                  ))}
                  {isLoading && <LoadingIndicator />}
                </div>
                <button
                    type="button" // Prevent default form submission
                    className="carousel-button right"
                    onClick={() => scrollCarousel('next')}
                    aria-label="Scroll Right"
                >
                  <FaChevronRight />
                </button>
              </>
          )}
        </div>

        {/* Loading More Indicator */}
        {isFetching && <div className="loading-more">Loading more items...</div>}

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}
      </div>
  );
};

export default Carousel;
