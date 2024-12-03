import React, { useState, useEffect } from 'react';
import '../../styles/components/ErrorBoundary.css';
import StarryBackground from "./StarryBackground";

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);


  useEffect(() => {
    const errorHandler = (error, errorInfo) => {
      setHasError(true);
      console.error('Uncaught error:', error, errorInfo);
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
        <>
   <StarryBackground />
      <div className='error-boundary'>
        <h1>Oops! Something went wrong.</h1>
        <p>
          We're sorry, but an unexpected error occurred. Our team has been
          notified and is working on a fix.
        </p>
        <button
          onClick={() => window.location.reload()}
          className='refresh-button'
        >
          Refresh Page
        </button>
      </div>
        </>
    );
  }

  return children;
};

export default ErrorBoundary;
