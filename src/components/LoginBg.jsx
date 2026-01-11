import React, { useEffect, useState, useRef, useCallback } from 'react';
import GridMotion from './GridMotion';
import { fetchItems } from '../api/ItemsApi';

const ItemsGrid = () => {
  const [itemsCache, setItemsCache] = useState(() => {
    const cachedItems = localStorage.getItem('cachedItems');
    return cachedItems ? JSON.parse(cachedItems) : {};
  });
  const [gridItems, setGridItems] = useState([]);
  const hasFetched = useRef(false);

  const formatItems = useCallback((fetchedItems) => {
    const formattedItems = [];

    fetchedItems.forEach((item) => {
      const imageUrl =
        item.backdrop_path || item.poster_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}`
          : null;

      if (imageUrl) {
        formattedItems.push(imageUrl);
      }
    });

    const totalItems = 28;
    return fillArrayToLength(formattedItems, totalItems);
  }, []);

  const fillArrayToLength = (items, length) => {
    const filledItems = [...items];
    while (filledItems.length < length) {
      filledItems.push(`Item ${filledItems.length + 1}`);
    }
    return filledItems.slice(0, length);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (hasFetched.current) return;
      
      console.log('Fetching items...', itemsCache);

      if (!itemsCache['login-items']) {
        hasFetched.current = true;
        const [movies, anime] = await Promise.all([
          fetchItems('anime', 1),
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
      } else {
        // Use the cached items
        setGridItems(formatItems(itemsCache['login-items']));
        hasFetched.current = true;
      }
    };

    fetchData();
  }, [itemsCache, formatItems]);

  return (
    <div className='items-grid'>
      <GridMotion items={gridItems} gradientColor='black' />
    </div>
  );
};

export default ItemsGrid;
