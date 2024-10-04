import React, { useEffect, useState } from 'react';
import GridMotion from './GridMotion';
import { useItemContext } from '../contexts/ItemContext';
import { fetchItems } from '../api/ItemsApi';

const ItemsGrid = () => {
  const [itemsCache, setItemsCache] = useState(() => {
    const cachedItems = localStorage.getItem('cachedItems');
    return cachedItems ? JSON.parse(cachedItems) : {};
  });
  const [gridItems, setGridItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching items...', itemsCache);

      if (!itemsCache['login-items'] && !isLoading) {
        setIsLoading(true);
        const [movies, anime] = await Promise.all([
          fetchItems('anime', 1, 7),
          fetchItems('movies', 1),
        ]);

        const combinedItems = [...movies, ...anime];
        const formattedItems = formatItems(combinedItems);

        setGridItems(formattedItems);

        const updatedCache = {
          ...itemsCache,
          'login-items': combinedItems,
        };

        setItemsCache(updatedCache);
        localStorage.setItem('cachedItems', JSON.stringify(updatedCache));
        setIsLoading(false);
      } else if (itemsCache['login-items']) {
        // Use the cached items
        setGridItems(formatItems(itemsCache['login-items']));
      }
    };

    fetchData();
    // Only run on mount
  }, []); // Empty dependency array means it runs only once after the initial render// Add dependencies to prevent unnecessary re-renders

  const formatItems = (fetchedItems) => {
    const formattedItems = [];

    fetchedItems.forEach((item) => {
      // Insert title or name
      // Insert image URLs
      const imageUrl =
        item.backdrop_path || item.poster_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}`
          : item.cover || item.image;

      if (imageUrl) {
        formattedItems.push(imageUrl);
      }
    });

    // Ensure the array has exactly 28 items
    const totalItems = 28;
    const combinedWithCustomContent = fillArrayToLength(
      formattedItems,
      totalItems,
    );

    return combinedWithCustomContent;
  };

  const fillArrayToLength = (items, length) => {
    // Fill the array with placeholders or trim it to ensure it has exactly 'length' items
    const filledItems = [...items];
    while (filledItems.length < length) {
      filledItems.push(`Item ${filledItems.length + 1}`);
    }
    return filledItems.slice(0, length);
  };

  return (
    <div className='items-grid'>
      <GridMotion items={gridItems} gradientColor='black' />
    </div>
  );
};

export default ItemsGrid;
