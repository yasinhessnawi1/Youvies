import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import InfiniteLoader from 'react-window-infinite-loader';
import { useItemContext } from '../contexts/ItemContext';
import ItemCard from './ItemCard';
import '../styles/components/ResultPage.css';

const COLUMN_WIDTH = 250;
const ROW_HEIGHT = 400;
const GAP = 20;

const ResultPage = ({ items, contentType, selectedGenre, title, onClose }) => {
    const { fetchMoreItems, isLoading } = useItemContext();
    const [allItems, setAllItems] = useState(items);
    const [error, setError] = useState(null);
    const [isFetching, setIsFetching] = useState(false);
    const containerRef = useRef(null);
    
    // Only enable pagination if we have a valid contentType (not for custom items like recommendations)
    const canFetchMore = !!contentType && ['movies', 'shows', 'anime'].includes(contentType);
    const [hasNextPage, setHasNextPage] = useState(canFetchMore);

    const { scrollYProgress } = useScroll({ container: containerRef });
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    // Function to check if an item at a specific index is loaded
    const isItemLoaded = useCallback((index) => {
        return !hasNextPage || index < allItems.length;
    }, [hasNextPage, allItems.length]);

    // Function to load more items
    const loadMoreItems = useCallback(async (startIndex, stopIndex) => {
        // Don't try to fetch more if contentType is invalid or not set
        if (!canFetchMore || !hasNextPage || isFetching || isLoading) return;

        setIsFetching(true);
        try {
            const newItems = await fetchMoreItems(contentType, selectedGenre);
            if (newItems && newItems.length > 0) {
                setAllItems(prev => [...prev, ...newItems]);
                setHasNextPage(newItems.length >= 20);
            } else {
                setHasNextPage(false);
            }
        } catch (err) {
            console.error('Failed to load more items:', err);
            setHasNextPage(false);
        } finally {
            setIsFetching(false);
        }
    }, [fetchMoreItems, contentType, selectedGenre, isFetching, isLoading, hasNextPage, canFetchMore]);

    const Cell = ({ columnIndex, rowIndex, style, data }) => {
        const { columnCount, items } = data;
        const itemIndex = rowIndex * columnCount + columnIndex;
        const item = items[itemIndex];

        if (!item) return null;

        const adjustedStyle = {
            ...style,
            left: `${parseFloat(style.left) + GAP}px`,
            top: `${parseFloat(style.top) + GAP}px`,
            width: `${parseFloat(style.width) - GAP}px`,
            height: `${parseFloat(style.height) - GAP}px`,
        };

        return (
          <motion.div
            style={adjustedStyle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="movie-card-container"
          >
              <ItemCard item={item} />
          </motion.div>
        );
    };

    return (
      <AnimatePresence mode="wait">
          <motion.div
            className="result-page-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
              <motion.button
                className="close-button"
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                  ✕
              </motion.button>
              <motion.div
                className="result-page-container"
                ref={containerRef}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                  <motion.div className="scroll-progress-bar" style={{ scaleX }} />
                  <motion.h2
                    className="result-page-title"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                      {title}
                  </motion.h2>

                  <div className="grid-container">
                      <AutoSizer>
                          {({ height, width }) => {
                              const columnCount = Math.floor(width / (COLUMN_WIDTH + GAP));
                              const rowCount = Math.ceil(allItems.length / columnCount) + (hasNextPage ? 1 : 0);

                              return (
                                <InfiniteLoader
                                  isItemLoaded={isItemLoaded}
                                  itemCount={hasNextPage ? allItems.length + 1 : allItems.length}
                                  loadMoreItems={loadMoreItems}
                                  threshold={5}
                                >
                                    {({ onItemsRendered, ref }) => {
                                        const newItemsRendered = ({
                                                                      visibleRowStartIndex,
                                                                      visibleRowStopIndex,
                                                                      overscanRowStopIndex,
                                                                      overscanRowStartIndex,
                                                                  }) => {
                                            onItemsRendered({
                                                visibleStartIndex: visibleRowStartIndex * columnCount,
                                                visibleStopIndex: visibleRowStopIndex * columnCount,
                                                overscanStartIndex: overscanRowStartIndex * columnCount,
                                                overscanStopIndex: overscanRowStopIndex * columnCount,
                                            });
                                        };

                                        return (
                                          <FixedSizeGrid
                                            className="result-page-grid"
                                            columnCount={columnCount}
                                            columnWidth={COLUMN_WIDTH + GAP}
                                            height={height - 100}
                                            rowCount={rowCount}
                                            rowHeight={ROW_HEIGHT + GAP}
                                            width={width}
                                            onItemsRendered={newItemsRendered}
                                            ref={ref}
                                            itemData={{
                                                columnCount,
                                                items: allItems,
                                            }}
                                          >
                                              {Cell}
                                          </FixedSizeGrid>
                                        );
                                    }}
                                </InfiniteLoader>
                              );
                          }}
                      </AutoSizer>
                  </div>

                  {error && (
                    <motion.div
                      className="error-message"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                        {error}
                    </motion.div>
                  )}
              </motion.div>
          </motion.div>
      </AnimatePresence>
    );
};

export default ResultPage;
