import React, {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from 'react';
import { useItemContext } from '../contexts/ItemContext';
import ItemCard from './ItemCard';
import LoadingIndicator from './static/LoadingIndicator';
import '../styles/components/Carousel.css';
import ResultPage from './ResultPage';
import leftArrow from '../utils/left-arrow.png';
import rightArrow from '../utils/right-arrow.png';
import videoIcon from '../utils/video.png';
import Button from "./Button";

const Carousel = forwardRef(
    (
        {
          contentType,
          genres,
          isHomePage,
          title = '',
          isRelated,
          customItems = null,
          listType = null,
          extraParams,
        },
        ref
    ) => {
      const {
        items,
        selectedGenre,
        setSelectedGenre,
        fetchGenreItems,
        fetchCarouselList,
        isLoading,
      } = useItemContext();

      const [error, setError] = useState(null);
      const [localLoading, setLocalLoading] = useState(false);
      const [fetchAttempted, setFetchAttempted] = useState(false);

      // Memoize extraParams to prevent infinite loops
      const memoizedExtraParams = useMemo(() => extraParams || {}, [JSON.stringify(extraParams)]);

      // Show/Hide "Show All" overlay
      const [showAllOpen, setShowAllOpen] = useState(false);

      // For our "carousel pagination"
      const [currentIndex, setCurrentIndex] = useState(0);
      const [itemsPerPage, setItemsPerPage] = useState(1);

      // Create a method that parent components could call if needed
      useImperativeHandle(ref, () => ({
        resetCarousel: () => setCurrentIndex(0),
      }));

      // Update itemsPerPage based on window size
      const updateItemsPerPage = useCallback(() => {
        if (window.innerWidth > 1629) {
          setItemsPerPage(6);
        } else if (window.innerWidth > 1400) {
          setItemsPerPage(5);
        } else if (window.innerWidth > 1200) {
          setItemsPerPage(4);
        } else if (window.innerWidth > 938) {
          setItemsPerPage(3);
        } else if (window.innerWidth > 674) {
          setItemsPerPage(2);
        } else {
          setItemsPerPage(1);
        }
      }, []);

      useEffect(() => {
        updateItemsPerPage();
        window.addEventListener('resize', updateItemsPerPage);
        return () => {
          window.removeEventListener('resize', updateItemsPerPage);
        };
      }, [updateItemsPerPage]);

      // Reset to the first page if 'items' changes significantly
      useEffect(() => {
        setCurrentIndex(0);
      }, [customItems]);

      // Determine the key for context items
      const itemKey = listType
          ? `${contentType}-${listType}`
          : isHomePage
          ? `${contentType}-home`
          : `${contentType}-${selectedGenre}`;

      // Fetch initial items if no customItems
      useEffect(() => {
        const loadInitialItems = async () => {
          if (customItems) return; // Don't fetch if custom items provided
          
          // Check if we already have items in context cache
          if (items[itemKey] && items[itemKey].length > 0) {
            setFetchAttempted(true);
            return; // Already have data
          }
          
          if (listType) {
            // Fetch from specialized list endpoint
            setLocalLoading(true);
            try {
              const result = await fetchCarouselList(contentType, listType, 1, memoizedExtraParams);
              setFetchAttempted(true);
            } catch (err) {
              console.error(`Carousel fetch error for ${itemKey}:`, err);
              setError('Failed to load items.');
              setFetchAttempted(true);
            } finally {
              setLocalLoading(false);
            }
          } else if (selectedGenre) {
            // Fetch from genre endpoint (existing behavior)
            setLocalLoading(true);
            try {
              await fetchGenreItems(contentType, selectedGenre);
              setFetchAttempted(true);
            } catch (err) {
              console.error(`Carousel fetch error for ${itemKey}:`, err);
              setError('Failed to load items.');
              setFetchAttempted(true);
            } finally {
              setLocalLoading(false);
            }
          }
        };
        loadInitialItems();
        // Only depend on itemKey and the fetch functions, not items object
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [itemKey, listType, selectedGenre, contentType]);

      // Final array of items to show in the carousel
      const allItems = customItems || items[itemKey] || [];
      
      // Don't render if:
      // - No items AND fetch was attempted AND not loading (empty result)
      // - Unless it's a custom items carousel (always render those)
      const shouldRender = customItems !== null || 
                          allItems.length > 0 || 
                          localLoading || 
                          isLoading || 
                          !fetchAttempted;
      
      // The function that decides which items are visible
      const getVisibleItems = () => {
        return allItems.slice(currentIndex, currentIndex + itemsPerPage);
      };

      // Next/prev "page" logic
      const nextPage = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentIndex + itemsPerPage < allItems.length) {
          setCurrentIndex(currentIndex + itemsPerPage);
        }
      };
      
      const prevPage = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentIndex - itemsPerPage >= 0) {
          setCurrentIndex(currentIndex - itemsPerPage);
        }
      };

      // Don't render empty carousels (except while loading)
      if (!shouldRender) {
        return null;
      }

      return (
          <>
            {/* Show the ResultPage (overlay) if showAllOpen */}
            {showAllOpen && (
                <ResultPage
                    items={allItems}
                    contentType={contentType}
                    selectedGenre={selectedGenre}
                    title={
                        title ||
                        (isHomePage
                            ? `${contentType} Home`
                            : genres
                                ?.find((g) => g.id === selectedGenre)
                                ?.name?.toUpperCase())
                    }
                    onClose={() => setShowAllOpen(false)}
                />
            )}

            {/* Main carousel wrapper */}
            <div
                className="carousel-wrapper"
                aria-label={
                    title ||
                    (isHomePage
                        ? `${contentType} Carousel`
                        : `${genres?.find((g) => g.id === selectedGenre)?.name} Carousel`)
                }
                role="region"
            >
              {/* Header Section */}
              <div className="gridHeader">
                <div className="grid-title">
                  <div className="grid-title-icon">
                    <img
                        src={videoIcon}
                        alt="Video icon"
                        className="carousel_name_icon"
                    />
                    <h4 className="content-title">
                      {title ||
                          (isHomePage
                              ? `${contentType} Home`
                              : genres
                                  ?.find((g) => g.id === selectedGenre)
                                  ?.name?.toUpperCase())}
                    </h4>
                  </div>
                  {/* Genre dropdown (optional) - only show if not using listType and not customItems */}
                  {!isHomePage && !listType && genres && genres.length > 1 && !customItems && (
                      <div className="dropdown">
                        <button
                            type="button"
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
                                    setSelectedGenre(genre.id);
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

                {/* "Show All" button if there are more items than we can show in one page */}
                {allItems.length > itemsPerPage && (
                    <div className="show-all-button">
                      <Button
                          text={"Show All"}
                          onClick={() => setShowAllOpen(true)}
                      />
                    </div>
                )}
              </div>

              {/* Carousel Section */}
              <div className="carousel-container">
                {/* Show loading indicator while fetching */}
                {(localLoading || isLoading) && allItems.length === 0 && (
                    <div className="carousel-loading">
                      <LoadingIndicator />
                    </div>
                )}
                
                {getVisibleItems().length > 0 && (
                    <div className="carousel-inner-container">
                      {/* Prev button */}
                      <button
                          className="carousel-button left"
                          onClick={prevPage}
                          aria-label="Scroll Left"
                      >
                        <img src={leftArrow} alt="Left Arrow" className="arrow"/>
                      </button>

                      {/* Visible Items */}
                      <div className="carousel-items">
                        {getVisibleItems().map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="carousel-item">
                              <ItemCard item={item} isRelated={isRelated} />
                            </div>
                        ))}
                      </div>

                      {/* Next button if there's still more items */}
                      {currentIndex + itemsPerPage < allItems.length && (
                          <button
                              className="carousel-button right"
                              onClick={nextPage}
                              aria-label="Scroll Right"
                          >
                            <img src={rightArrow} alt="Right Arrow" className="arrow"/>
                          </button>
                      )}
                    </div>
                )}
              </div>

              {/* Error Message */}
              {error && <div className="error-message">{error}</div>}
            </div>
          </>
      );
    }
);

export default Carousel;
