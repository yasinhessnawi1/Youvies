import React, { useEffect, useState, useRef } from 'react';
import '../styles/components/Banner.css';
import { useItemContext } from '../contexts/ItemContext';
import Button from './Button';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import {getTitle} from "../utils/helper"; // For navigation icons

const Banner = ({ contentType }) => {
  const { items, isLoading, fetchAllItems } = useItemContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const hasFetched = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!contentType || hasFetched.current || isLoading) return;
    const itemKey = `home-${contentType}`;
    if ((!items[itemKey] || items[itemKey].length === 0) && !hasFetched.current) {
      fetchAllItems();
    }
    hasFetched.current = true;
  }, [contentType, items, fetchAllItems, isLoading]);

  useEffect(() => {
    if (isPaused || isLoading) return;

    intervalRef.current = setInterval(() => {
      goToNext();
    }, 10000);

    return () => clearInterval(intervalRef.current);
  }, [currentIndex, isPaused, isLoading, items, contentType]);

  const itemKey = `${contentType}-home`;
  if (isLoading || !items[itemKey] || items[itemKey].length === 0) return null;

  const totalItems = items[itemKey].length;
  const currentItem = items[itemKey][currentIndex] || {};

  // Generate an array of next three indices
  const getNextIndices = () => {
    const indices = [];
    for (let i = 1; i <= 3; i++) {
      indices.push((currentIndex + i) % totalItems);
    }
    return indices;
  };

  const nextIndices = getNextIndices();
  const nextItems = nextIndices.map(index => items[itemKey][index] || {});

  const handleReadMore = () => {
    setShowFullDescription(!showFullDescription);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      clearInterval(intervalRef.current);
    } else {
      intervalRef.current = setInterval(() => {
        goToNext();
      }, 10000);
    }
  };

  const goToPrevious = () => {
    setPrevIndex(currentIndex);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + totalItems) % totalItems);
  };

  const goToNext = () => {
    setPrevIndex(currentIndex);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % totalItems);
  };

  const getImageUrl = (item) => {
    if (!item) return 'https://via.placeholder.com/300x450?text=Loading...';
    switch (item.type) {
      case 'movies':
      case 'shows':
        return item.backdrop_path
            ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
            : item.poster_path
                ? `https://image.tmdb.org/t/p/original${item.poster_path}`
                : `https://via.placeholder.com/300x450?text=Loading...`;
      case 'anime':
        return item.cover ||
            item.image ||
            'https://via.placeholder.com/300x450?text=Image+Not+Found.';
      default:
        return 'https://via.placeholder.com/300x450?text=Image+Not+Found.';
    }
  };

  const imageUrl = getImageUrl(currentItem);

  return (
      <div
          className='banner'
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
      >
        {/* Current Background */}
        <div
            className='banner-background fade-in'
            style={{
              backgroundImage: `url(${imageUrl})`,
              zIndex: 1,
            }}
        ></div>

        {/* Previous Background for Fade Transition */}
        {prevIndex !== null && (
            <div
                className='banner-background fade-out'
                style={{
                  backgroundImage: `url(${getImageUrl(items[itemKey][prevIndex])})`,
                  zIndex: 0,
                }}
                onAnimationEnd={() => setPrevIndex(null)}
            ></div>
        )}

        {/* Overlay */}
        <div className='banner-overlay'></div>

        {/* Content */}
        <div className='banner-content'>
          <h1 className='banner-title'>{getTitle(currentItem)}</h1>
          <p className='banner-description'>
            {showFullDescription
                ? currentItem.overview ||
                currentItem.description ||
                'Description loading...'
                : (
                    currentItem.overview ||
                    currentItem.description ||
                    'Description loading ...'
                ).slice(0, 120)}
            {currentItem.overview && currentItem.overview.length > 120 && (
                <span onClick={handleReadMore} className='read-more'>
              {showFullDescription ? ' Show Less' : '... Read More'}
            </span>
            )}
          </p>
          <div className='banner-actions'>
            <Button text='Info' category={currentItem.type} id={currentItem.id} />
            <Button
                text={isPaused ? 'Resume' : 'Pause'}
                onClick={handlePause}
                title={'Pause the suggestions shuffling.'}
            />
          </div>
        </div>

        {/* Preview of Next Three Items */}
        <div className='banner-preview'>
          {nextItems.map((item, index) => (
              <div key={index} className='preview-item'>
                <img  src={getImageUrl(item)} alt={item.title || item.name || 'Next Item'} />
                <span className='preview-title'>{getTitle(item) ||'Title'}</span>
              </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <button className='banner-nav left' onClick={goToPrevious} aria-label="Previous">
          <FaChevronLeft />
        </button>
        <button className='banner-nav right' onClick={goToNext} aria-label="Next">
          <FaChevronRight />
        </button>
      </div>
  );
};

export default Banner;
