import React, { useEffect, useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TabContext } from '../contexts/TabContext';
import Header from '../components/static/Header';
import Footer from '../components/static/Footer';
import StarryBackground from '../components/static/StarryBackground';
import { config } from '../config/environment';
import '../styles/page/IptvPage.css';

const IptvPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setActiveTab } = useContext(TabContext);
  const iframeRef = useRef(null);
  const [showInstruction, setShowInstruction] = useState(true);
  const [loginStatus, setLoginStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);

  // Detect Safari
  useEffect(() => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      setShowBrowserWarning(true);
    }
  }, []);


  // Check IPTV login status on mount
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await fetch(`${config.apiBaseUrl}/iptv/status`);
        const status = await response.json();
        setLoginStatus(status);
        console.log('IPTV Login status:', status);
      } catch (error) {
        console.error('Failed to check IPTV login status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkLoginStatus();
  }, []);

  // Hide instruction when iframe loads successfully (dashboard)
  useEffect(() => {
    const handleIframeLoad = () => {
      setTimeout(() => {
        setShowInstruction(false);
        setIsLoading(false);
      }, 2000);
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad);
    }

    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleIframeLoad);
      }
    };
  }, []);

  // Auto-hide instruction after 10 seconds (for login process)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstruction(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="iptv-page">
      <Header />
      <StarryBackground />

      <div className="iptv-container">
        <div className="iptv-header">
          <h1>IPTV Player</h1>
          <p>Stream live TV channels and video-on-demand content</p>
        </div>

        {showBrowserWarning && (
          <div className="browser-warning-banner">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>Browser Compatibility:</strong> Some live channels may experience instability on Safari (Apple Video Player). 
              For the best experience, <strong>Google Chrome</strong> or <strong>Brave Browser</strong> is recommended.
            </div>
            <button 
              className="warning-close" 
              onClick={() => setShowBrowserWarning(false)}
              aria-label="Close warning"
            >
              &times;
            </button>
          </div>
        )}

        <div className="iptv-player-container">
          {isLoading && (
            <div className="iptv-instruction-overlay">
              <div className="iptv-instruction-content">
                <h3>Connecting to IPTV Service</h3>
                <p>Please wait while we establish connection...</p>
                <div className="loading-spinner"></div>
              </div>
            </div>
          )}

          {showInstruction && !isLoading && (
            <div className="iptv-instruction-overlay">
              <div className="iptv-instruction-content">
                <h3>IPTV Player</h3>
                <p>Logging into your IPTV service automatically...</p>
                <button
                  className="iptv-instruction-close"
                  onClick={() => setShowInstruction(false)}
                >
                  Hide
                </button>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={`${config.apiBaseUrl}/iptv/proxy`}
            title="IPTV Smarters Web Player"
            className="iptv-player-iframe"
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen"
            frameBorder="0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default IptvPage;