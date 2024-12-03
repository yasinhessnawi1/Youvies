import React, { useState, useEffect, useCallback } from 'react';
import '../../styles/components/LoadingIndicator.css';

const LoadingIndicator = () => {
  const [showStallMessage, setShowStallMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowStallMessage(true);
    }, 20000); // Show the stall message after 20 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  const renderCarousel = (className) => (
    <div className='container'>
      <div className='carousel-loading'>
        {[...Array(7)].map((_, index) => (
          <div key={index} className={className}></div>
        ))}
      </div>
    </div>
  );

  return (
    <div className='loading-overlay'>
      <div className='loader'>
        {renderCarousel('love')}
        {renderCarousel('death')}
        {renderCarousel('robots')}
      </div>
      {showStallMessage && (
        <div className='stall-message'>
          <p>
            Loading is taking longer than expected. If the loading stalls,{' '}
            <span onClick={handleReload} className='reload-link'>
              reload the page
            </span>
            .
          </p>
        </div>
      )}
    </div>
  );
};

export default LoadingIndicator;
