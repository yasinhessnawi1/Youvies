import React, { useState, useEffect } from 'react';
import '../../styles/components/ErrorBoundary.css';
import StarryBackground from "./StarryBackground";

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);


  useEffect(() => {
    // Override console.error to filter out browser extension errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('The message port closed before a response was received') ||
          message.includes('Unchecked runtime.lastError') ||
          message.includes('Non-Error promise rejection captured')) {
        return; // Silently ignore these browser extension errors
      }
      originalConsoleError.apply(console, args);
    };

    const errorHandler = (event) => {
      // Ignore certain types of errors that are not critical
      if (event.message && (
        event.message.includes('The message port closed before a response was received') ||
        event.message.includes('Non-Error promise rejection captured')
      )) {
        return; // Don't set error state for these
      }

      setHasError(true);
      originalConsoleError('Uncaught error:', event.error || event.message, event);
    };

    const unhandledRejectionHandler = (event) => {
      // Ignore promise rejections that are not critical
      if (event.reason && typeof event.reason === 'string' &&
          event.reason.includes('Non-Error promise rejection captured')) {
        return;
      }

      setHasError(true);
      console.error('Unhandled promise rejection:', event.reason, event);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    return () => {
      // Restore original console.error
      console.error = originalConsoleError;
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
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
