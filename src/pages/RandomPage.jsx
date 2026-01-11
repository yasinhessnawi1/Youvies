import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaDice, FaFilm, FaTv, FaSyncAlt, FaFilter, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { SiCrunchyroll } from 'react-icons/si';
import Header from '../components/static/Header';
import Footer from '../components/static/Footer';
import StarryBackground from '../components/static/StarryBackground';
import SearchBar from '../components/SearchBar';
import { TabContext } from '../contexts/TabContext';
import { fetchRandomMosaicItems } from '../api/ItemsApi';
import '../styles/page/RandomPage.css';

// Generate a deterministic color based on item id for fallback backgrounds
const getItemColor = (id, type) => {
  const hash = String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseHue = type === 'movies' ? 0 : type === 'shows' ? 200 : 30; // Red for movies, blue for shows, orange for anime
  return `linear-gradient(135deg, hsl(${(baseHue + hash) % 360}, 60%, 18%) 0%, hsl(${(baseHue + hash + 40) % 360}, 50%, 12%) 100%)`;
};

// Tiny thumbnail component for the mosaic
const MosaicTile = React.memo(({ item, onHover, onLeave, onClick, tileSize }) => {
  const imageUrl = useMemo(() => {
    if (item.type === 'anime') {
      return item.image || item.cover || null;
    }
    return item.poster_path
      ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
      : null;
  }, [item]);

  const title = useMemo(() => {
    if (item.type === 'anime') {
      if (typeof item.title === 'object' && item.title !== null) {
        return item.title.english || item.title.userPreferred || item.title.romaji || 'Unknown';
      }
      return item.title || 'Unknown';
    }
    return item.title || item.name || 'Unknown';
  }, [item]);

  const fallbackStyle = useMemo(() => ({
    background: getItemColor(item.id, item.type),
  }), [item.id, item.type]);

  return (
    <div
      className="mosaic-tile"
      style={{ 
        width: tileSize, 
        height: tileSize * 1.5,
        ...(imageUrl ? {} : fallbackStyle)
      }}
      onMouseEnter={() => onHover(item)}
      onMouseLeave={onLeave}
      onClick={() => onClick(item)}
      title={title}
    >
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt="" 
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )}
      <div className="tile-type-indicator" data-type={item.type}>
        {item.type === 'movies' && <FaFilm size={8} />}
        {item.type === 'shows' && <FaTv size={8} />}
        {item.type === 'anime' && <SiCrunchyroll size={8} />}
      </div>
    </div>
  );
});

// Hover tooltip component
const HoverTooltip = ({ item, position }) => {
  const title = useMemo(() => {
    if (!item) return 'Unknown';
    if (item.type === 'anime') {
      if (typeof item.title === 'object' && item.title !== null) {
        return item.title.english || item.title.userPreferred || item.title.romaji || 'Unknown';
      }
      return item.title || 'Unknown';
    }
    return item.title || item.name || 'Unknown';
  }, [item]);

  const rating = useMemo(() => {
    if (!item) return 'N/A';
    if (item.type === 'anime') {
      return item.rating ? (item.rating / 10).toFixed(1) : 'N/A';
    }
    return item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
  }, [item]);

  const year = useMemo(() => {
    if (!item) return '';
    if (item.type === 'anime') {
      return item.releaseDate || item.seasonYear || '';
    }
    const date = item.release_date || item.first_air_date;
    return date ? date.split('-')[0] : '';
  }, [item]);

  const imageUrl = useMemo(() => {
    if (!item) return null;
    if (item.type === 'anime') {
      return item.image || item.cover || null;
    }
    return item.poster_path
      ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
      : null;
  }, [item]);

  if (!item) return null;

  return (
    <div 
      className="hover-tooltip" 
      style={{ 
        left: Math.min(position.x, window.innerWidth - 320), 
        top: Math.min(position.y, window.innerHeight - 200)
      }}
    >
      {imageUrl && <img src={imageUrl} alt={title} className="tooltip-image" />}
      <div className="tooltip-content">
        <h4>{title}</h4>
        <div className="tooltip-meta">
          <span className="tooltip-type">{item.type}</span>
          {year && <span className="tooltip-year">{year}</span>}
          <span className="tooltip-rating">⭐ {rating}</span>
        </div>
        <p className="tooltip-hint">Click to watch</p>
      </div>
    </div>
  );
};

const RandomPage = () => {
  const navigate = useNavigate();
  const { activeTab } = React.useContext(TabContext);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    movies: true,
    shows: true,
    anime: true,
  });
  
  // Mosaic state
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tileSize, setTileSize] = useState(25);
  
  // Hover state
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // Control panel state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
  // Refs
  const mosaicContainerRef = useRef(null);
  const loadingRef = useRef(null);

  // Ref to track if initial load has happened
  const initialLoadDone = useRef(false);
  const loadingInProgress = useRef(false);

  // Fetch items
  const loadItems = useCallback(async (pageNum, append = false, currentFilters = filters) => {
    if (loadingInProgress.current) return;
    
    // Check if at least one filter is enabled
    if (!currentFilters.movies && !currentFilters.shows && !currentFilters.anime) {
      return;
    }
    
    loadingInProgress.current = true;
    setLoading(true);
    try {
      const newItems = await fetchRandomMosaicItems(currentFilters, pageNum, 150);
      
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setItems(prev => append ? [...prev, ...newItems] : newItems);
        setHasMore(true);
      }
    } catch (error) {
      console.error('Error loading mosaic items:', error);
    } finally {
      setLoading(false);
      loadingInProgress.current = false;
    }
  }, [filters]);

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadItems(1, false, filters);
    }
  }, [loadItems, filters]);

  // Reload when filters change (but not on initial mount)
  const filtersChangedRef = useRef(false);
  useEffect(() => {
    // Skip on initial mount - we already handle that above
    if (!filtersChangedRef.current) {
      filtersChangedRef.current = true;
      return;
    }
    
    setPage(1);
    setItems([]);
    loadItems(1, false, filters);
  }, [filters.movies, filters.shows, filters.anime, loadItems, filters]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadItems(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, page, loadItems]);

  // Handle hover
  const handleTileHover = useCallback((item, event) => {
    setHoveredItem(item);
    setTooltipPosition({ 
      x: (event?.clientX || 0) + 20, 
      y: (event?.clientY || 0) + 20 
    });
  }, []);

  const handleTileLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  // Handle click - navigate to info page and auto-play
  const handleTileClick = useCallback((item) => {
    // Navigate to info page with autoplay flag
    navigate(`/info/${item.type}/${item.id}?autoplay=true`);
  }, [navigate]);

  // Pick random item
  const pickRandom = useCallback(() => {
    if (items.length === 0) return;
    const randomIndex = Math.floor(Math.random() * items.length);
    const randomItem = items[randomIndex];
    handleTileClick(randomItem);
  }, [items, handleTileClick]);

  // Refresh/shuffle items
  const refreshItems = useCallback(() => {
    setPage(1);
    setItems([]);
    loadItems(1, false, filters);
  }, [loadItems, filters]);

  // Toggle filter
  const toggleFilter = useCallback((type) => {
    setFilters(prev => {
      const newFilters = { ...prev, [type]: !prev[type] };
      // Ensure at least one filter is always active
      const activeCount = Object.values(newFilters).filter(Boolean).length;
      if (activeCount === 0) {
        return prev;
      }
      return newFilters;
    });
  }, []);

  // Handle mouse move for tooltip positioning
  const handleMouseMove = useCallback((e) => {
    if (hoveredItem) {
      setTooltipPosition({ 
        x: e.clientX + 20, 
        y: e.clientY + 20 
      });
    }
  }, [hoveredItem]);

  // Filtered items count
  const filteredCount = useMemo(() => {
    return items.length;
  }, [items]);

  return (
    <div className="random-page">
      <Header onSearchClick={() => setIsSearchVisible(!isSearchVisible)} />
      <StarryBackground />
      
      {isSearchVisible && <SearchBar activeTab={activeTab} />}
      
      <div className="random-content">
        {/* Control Panel */}
        <div className={`control-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
          <button 
            className="panel-toggle"
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            title={isPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isPanelCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
          
          {!isPanelCollapsed && (
            <div className="panel-content">
              <h2><FaFilter /> Controls</h2>
              
              {/* Pick Random Button */}
              <button 
                className="action-btn pick-random-btn"
                onClick={pickRandom}
                disabled={items.length === 0}
              >
                <FaDice size={24} />
                <span>Pick Random</span>
              </button>
              
              {/* Refresh Button */}
              <button 
                className="action-btn refresh-btn"
                onClick={refreshItems}
                disabled={loading}
              >
                <FaSyncAlt size={18} className={loading ? 'spinning' : ''} />
                <span>Shuffle</span>
              </button>
              
              {/* Filters */}
              <div className="filter-section">
                <h3>Include:</h3>
                
                <label className={`filter-option ${filters.movies ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={filters.movies}
                    onChange={() => toggleFilter('movies')}
                  />
                  <FaFilm />
                  <span>Movies</span>
                </label>
                
                <label className={`filter-option ${filters.shows ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={filters.shows}
                    onChange={() => toggleFilter('shows')}
                  />
                  <FaTv />
                  <span>TV Shows</span>
                </label>
                
                <label className={`filter-option ${filters.anime ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={filters.anime}
                    onChange={() => toggleFilter('anime')}
                  />
                  <SiCrunchyroll />
                  <span>Anime</span>
                </label>
              </div>
              
              {/* Tile Size Slider */}
              <div className="size-section">
                <h3>Tile Size:</h3>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={tileSize}
                  onChange={(e) => setTileSize(Number(e.target.value))}
                  className="size-slider"
                />
                <span className="size-label">{tileSize}px</span>
              </div>
              
              {/* Stats */}
              <div className="stats-section">
                <p><strong>{filteredCount}</strong> items loaded</p>
                <p className="hint">Hover for details, click to watch</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Mosaic Grid */}
        <div 
          className="mosaic-container" 
          ref={mosaicContainerRef}
          onMouseMove={handleMouseMove}
        >
          <div className="mosaic-grid">
            {items.map((item, index) => (
              <MosaicTile
                key={`${item.type}-${item.id}-${index}`}
                item={item}
                tileSize={tileSize}
                onHover={(item) => handleTileHover(item)}
                onLeave={handleTileLeave}
                onClick={handleTileClick}
              />
            ))}
          </div>
          
          {/* Loading indicator / Infinite scroll trigger */}
          <div ref={loadingRef} className="loading-trigger">
            {loading && (
              <div className="mosaic-loading">
                <FaSyncAlt className="spinning" />
                <span>Loading more...</span>
              </div>
            )}
          </div>
          
          {/* Empty state */}
          {!loading && items.length === 0 && (
            <div className="empty-state">
              <FaDice size={64} />
              <h3>No items to display</h3>
              <p>Enable at least one filter to see content</p>
            </div>
          )}
        </div>
        
        {/* Hover Tooltip */}
        {hoveredItem && (
          <HoverTooltip item={hoveredItem} position={tooltipPosition} />
        )}
      </div>
      
      <Footer />
    </div>
  );
};

export default RandomPage;
