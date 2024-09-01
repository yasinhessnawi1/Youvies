import React, {useEffect, useState} from 'react';
import GridMotion from './GridMotion';
import {useItemContext} from '../contexts/ItemContext';
import {fetchItems} from "../api/ItemsApi";

const ItemsGrid = ({ contentType }) => {
    const { items, isLoading } = useItemContext();
    const [gridItems, setGridItems] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoading && !items[contentType]) {
                const [movies, anime] = await Promise.all([
                    fetchItems('anime', 1,7),
                    fetchItems('movies', 1),
                ]);

                const combinedItems = [...movies, ...anime];
                setGridItems(formatItems(combinedItems));
            }
        };

        fetchData();
    }, [isLoading]);

    const formatItems = (fetchedItems) => {
        const formattedItems = [];

        fetchedItems.forEach((item, index) => {
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
        const combinedWithCustomContent = fillArrayToLength(formattedItems, totalItems);

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

    if (isLoading) return <p>Loading items...</p>;

    return (
        <div className="items-grid">
            <GridMotion items={gridItems} gradientColor="black" />
        </div>
    );
};

export default ItemsGrid;