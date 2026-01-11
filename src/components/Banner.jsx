import React, { useEffect, useState, useRef } from 'react';
import '../styles/components/Banner.css';
import { useItemContext } from '../contexts/ItemContext';
import Button from './Button';
import leftArrow from '../utils/left-arrow.png';
import rightArrow from '../utils/right-arrow.png';
import {getTitle, cleanHtmlTags} from "../utils/helper"; // For navigation icons

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
    if (!item) return null;
    // Handle anime images (from AniList API)
    if (item.type === 'anime') {
      return item.cover || item.image || null;
    }
    // Handle TMDB images
    return item.backdrop_path
            ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
            : item.poster_path
                ? `https://image.tmdb.org/t/p/original${item.poster_path}`
                : null;
  };

  const imageUrl = getImageUrl(currentItem);
  const fallbackBackground = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';

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
              backgroundImage: imageUrl ? `url(${imageUrl})` : fallbackBackground,
              zIndex: 1,
            }}
        ></div>

        {/* Previous Background for Fade Transition */}
        {prevIndex !== null && (
            <div
                className='banner-background fade-out'
                style={{
                  backgroundImage: getImageUrl(items[itemKey]?.[prevIndex]) 
                    ? `url(${getImageUrl(items[itemKey][prevIndex])})` 
                    : fallbackBackground,
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
            {(() => {
              const description = currentItem.overview || currentItem.description || '';
              const cleanDesc = currentItem.type === 'anime' ? cleanHtmlTags(description) : description;
              const displayText = showFullDescription ? cleanDesc : cleanDesc.slice(0, 120);
              const originalLength = cleanDesc.length;
              
              return (
                <>
                  {displayText || 'Description loading...'}
                  {originalLength > 120 && (
                    <span onClick={handleReadMore} className='read-more'>
                      {showFullDescription ? ' Show Less' : '... Read More'}
                    </span>
                  )}
                </>
              );
            })()}
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
                <img  src={getImageUrl(item)} alt={getTitle(item) || 'Next Item'} />
                <span className='preview-title'>{getTitle(item) || 'Title'}</span>
              </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <button className='banner-nav left' onClick={goToPrevious} aria-label="Previous">
          <img src={leftArrow} alt="Right Arrow" className="arrow"/>

        </button>
        <button className='banner-nav right' onClick={goToNext} aria-label="Next">
          <img src={rightArrow} alt="Right Arrow" className="arrow"/>
        </button>
      </div>
  );
};

export default Banner;
