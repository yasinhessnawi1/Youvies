import React from 'react';
import { X, Download } from 'lucide-react';
import '../styles/components/VideoModal.css';

const VideoModal = ({ 
  isOpen, 
  onClose, 
  children, 
  title,
  useAdFreePlayer,
  onPlayerTypeChange,
  torrentStreamUrl,
  videoSrc
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = () => {
    // Extract video source from children if possible
    const videoSource = children?.props?.src || videoSrc;
    if (videoSource) {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = videoSource;
      link.download = title || 'video';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="video-modal-overlay" onClick={handleOverlayClick}>
      <div className="video-modal">
        <div className="video-modal-header">
          <div className="modal-title">
            <h3>{title}</h3>
          </div>
          <div className="modal-header-middle">
            {/* Player Type Toggle Buttons */}
            {onPlayerTypeChange && (
              <div className="modal-player-type-toggle">
                <button
                  className={`modal-toggle-btn ${useAdFreePlayer ? 'active' : ''}`}
                  onClick={() => onPlayerTypeChange(true)}
                  disabled={!torrentStreamUrl}
                  title="Ad-Free Player"
                >
                  <span className="modal-toggle-icon">✨</span> Ad-Free
                </button>
                <button
                  className={`modal-toggle-btn ${!useAdFreePlayer ? 'active' : ''}`}
                  onClick={() => onPlayerTypeChange(false)}
                  title="Player with Ads"
                >
                  <span className="modal-toggle-icon">📺</span> With Ads
                </button>
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button 
              onClick={handleDownload}
              className="modal-action-button"
              title="Download video"
            >
              <Download size={18} />
            </button>
            <button 
              onClick={onClose}
              className="modal-close-button"
              title="Close video"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="video-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default VideoModal;
