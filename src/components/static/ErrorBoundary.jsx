import React, { useState, useEffect } from 'react';
import '../../styles/components/ErrorBoundary.css';

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    const errorHandler = (error, errorInfo) => {
      setHasError(true);
      setError(error);
      setErrorInfo(errorInfo);
      console.error('Uncaught error:', error, errorInfo);
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className='error-boundary'>
        <h1>Oops! Something went wrong.</h1>
        <p>
          We're sorry, but an unexpected error occurred. Our team has been
          notified and is working on a fix.
        </p>
        <details className='error-details'>
          <summary>Error Details</summary>
          <pre>
            {error && error.toString()}
            <br />
            {errorInfo && errorInfo.componentStack}
          </pre>
        </details>
        <button
          onClick={() => window.location.reload()}
          className='refresh-button'
        >
          Refresh Page
        </button>
      </div>
    );
  }

  return children;
};

export default ErrorBoundary;
