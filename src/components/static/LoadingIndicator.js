import React, { useState, useEffect } from 'react';
import '../../styles/components/LoadingIndicator.css';

const LoadingIndicator = () => {
    const [showStallMessage, setShowStallMessage] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowStallMessage(true);
        }, 10000); // Show the stall message after 5 seconds

        return () => clearTimeout(timer);
    }, []);

    const handleReload = () => {
        window.location.reload();
    };

    return (
        <div className="loading-overlay">
            <div className="loader">
                <div className="container">
                    <div className="carousel-loading">
                        <div className="love"></div>
                        <div className="love"></div>
                        <div className="love"></div>
                        <div className="love"></div>
                        <div className="love"></div>
                        <div className="love"></div>
                        <div className="love"></div>
                    </div>
                </div>
                <div className="container">
                    <div className="carousel-loading">
                        <div className="death"></div>
                        <div className="death"></div>
                        <div className="death"></div>
                        <div className="death"></div>
                        <div className="death"></div>
                        <div className="death"></div>
                        <div className="death"></div>
                    </div>
                </div>
                <div className="container">
                    <div className="carousel-loading">
                        <div className="robots"></div>
                        <div className="robots"></div>
                        <div className="robots"></div>
                        <div className="robots"></div>
                        <div className="robots"></div>
                        <div className="robots"></div>
                        <div className="robots"></div>
                    </div>
                </div>
            </div>
            {showStallMessage && (
                <div className="stall-message">
                    <p>Loading is taking longer than expected. If the loading stalls, <span onClick={handleReload} className="reload-link">reload the page</span>.</p>
                </div>
            )}
        </div>
    );
};

export default LoadingIndicator;
