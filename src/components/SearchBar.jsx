import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { searchItems } from '../api/ItemsApi';
import { useAuth } from '../contexts/AuthContext';
import '../styles/components/SearchBar.css';
import LoadingIndicator from './static/LoadingIndicator';
import { debounce } from '../utils/debounce';
import { getTitle } from '../utils/helper';
import { Link } from 'react-router-dom';

const SearchBar = ({ activeTab }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef(null);

  const fetchSuggestions = useCallback(async (query) => {
    if (!user || !query) return;

    setIsSearching(true);
    try {
      const results = await searchItems(activeTab, query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching items:', error);
    }
    setIsSearching(false);
  }, [user, activeTab]);

  // Create memoized debounced function
  const debouncedFetchSuggestions = useMemo(
    () => debounce((query) => fetchSuggestions(query), 1500),
    [fetchSuggestions]
  );

  const handleInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedFetchSuggestions(query);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      fetchSuggestions(searchQuery);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSearchResults([]); // Close the dropdown
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);


  // Check if item has a valid image
  const hasImage = (item) => {
    if (item.type === 'anime') {
      return !!(item.image || item.cover);
    }
    return !!item.poster_path;
  };

  // Get image URL only if available (no placeholders)
  const getImageUrl = (item) => {
    if (item.type === 'anime') {
      return item.image || item.cover;
    }
    if (item.poster_path) {
      return `https://image.tmdb.org/t/p/w185${item.poster_path}`;
    }
    return null;
  };

  // Get type label for display
  const getTypeLabel = (item) => {
    switch (item.type) {
      case 'movies':
        return 'Movie';
      case 'shows':
        return 'TV Show';
      case 'anime':
        // Anime can have different formats (TV, MOVIE, OVA, ONA, SPECIAL, MUSIC)
        const format = item.format || item.type_format || 'Anime';
        if (format === 'TV') return 'Anime Series';
        if (format === 'MOVIE') return 'Anime Movie';
        if (format === 'OVA') return 'OVA';
        if (format === 'ONA') return 'ONA';
        if (format === 'SPECIAL') return 'Special';
        return 'Anime';
      default:
        return '';
    }
  };

  // Get year from item
  const getYear = (item) => {
    if (item.type === 'anime') {
      return item.releaseDate || item.seasonYear || item.year || '';
    }
    if (item.type === 'movies') {
      return item.release_date ? item.release_date.split('-')[0] : '';
    }
    if (item.type === 'shows') {
      return item.first_air_date ? item.first_air_date.split('-')[0] : '';
    }
    return '';
  };

  // Get rating from item
  const getRating = (item) => {
    if (item.type === 'anime') {
      // Anime rating is usually out of 100
      const rating = item.rating || item.averageScore;
      return rating ? `${rating}%` : '';
    }
    // TMDB rating is out of 10
    const rating = item.vote_average;
    return rating ? `${rating.toFixed(1)}★` : '';
  };

  // Get additional info (episodes for shows/anime, runtime for movies)
  const getAdditionalInfo = (item) => {
    if (item.type === 'anime') {
      const episodes = item.totalEpisodes || item.episodes;
      const status = item.status;
      let info = [];
      if (episodes) info.push(`${episodes} eps`);
      if (status) info.push(status);
      return info.join(' • ');
    }
    if (item.type === 'shows') {
      // Shows don't have episode count in search results
      return '';
    }
    if (item.type === 'movies') {
      // Movies don't have runtime in search results
      return '';
    }
    return '';
  };

  return (
    <div className='search-bar-container' id='poda' title={'Search Bar'}>
      <div className='border'></div>
      <div id='main'>
        <input
          defaultChecked={true}
          spellCheck={true}
          translate={'yes'}
          autoCorrect={'true'}
          inputMode={'search'}
          vocab={'true'}
          autoFocus={true}
          autoSave={'true'}
          title={
            'Type inn the title of the video you want to search for.(Please note that this is case sensitive, so its better to type in the correct title)'
          }
          type='text'
          placeholder='Search...'
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className='input search-input'
        />
        <div id='input-mask'></div>
        <div className='filterBorder'></div>
        <div
          id='filter-icon'
          onClick={() => fetchSuggestions(searchQuery)}
          title={'Search'}
        >
          <svg
            preserveAspectRatio='none'
            height='27'
            width='27'
            viewBox='4.8 4.56 14.832 15.408'
            fill='none'
          >
            <path
              d='M8.16 6.65002H15.83C16.47 6.65002 16.99 7.17002 16.99 7.81002V9.09002C16.99 9.56002 16.7 10.14 16.41 10.43L13.91 12.64C13.56 12.93 13.33 13.51 13.33 13.98V16.48C13.33 16.83 13.1 17.29 12.81 17.47L12 17.98C11.24 18.45 10.2 17.92 10.2 16.99V13.91C10.2 13.5 9.97 12.98 9.73 12.69L7.52 10.36C7.23 10.08 7 9.55002 7 9.20002V7.87002C7 7.17002 7.52 6.65002 8.16 6.65002Z'
              stroke='#d6d6e6'
              stroke-width='1'
              stroke-miterlimit='10'
              stroke-linecap='round'
              stroke-linejoin='round'
            ></path>
          </svg>
        </div>
        <div id='search-icon'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='24'
            viewBox='0 0 24 24'
            stroke-width='2'
            stroke-linejoin='round'
            stroke-linecap='round'
            height='24'
            fill='none'
            className='feather feather-search'
          >
            <circle stroke='url(#search)' r='8' cy='11' cx='11'></circle>
            <line
              stroke='url(#searchl)'
              y2='16.65'
              y1='22'
              x2='16.65'
              x1='22'
            ></line>
            <defs>
              <linearGradient gradientTransform='rotate(50)' id='search'>
                <stop stop-color='#f8e7f8' offset='0%'></stop>
                <stop stop-color='#b6a9b7' offset='50%'></stop>
              </linearGradient>
              <linearGradient id='searchl'>
                <stop stop-color='#b6a9b7' offset='0%'></stop>
                <stop stop-color='#837484' offset='50%'></stop>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      {isSearching && <LoadingIndicator />}{' '}
      {/* Show Loading Indicator when loading */}
      {searchResults && searchResults.length > 0 && (
        <div className='search-results-dropdown' ref={dropdownRef}>
          {searchResults.map((item) => {
            const itemHasImage = hasImage(item);
            const imageUrl = getImageUrl(item);
            const typeLabel = getTypeLabel(item);
            const year = getYear(item);
            const rating = getRating(item);
            const additionalInfo = getAdditionalInfo(item);

            return (
              <Link
                to={`/info/${item.type}/${item.id}`}
                style={{ textDecoration: 'none' }}
                key={`${item.type}-${item.id}`}
              >
                <div className={`search-result-item ${!itemHasImage ? 'no-image' : ''}`}>
                  {itemHasImage && (
                    <img
                      src={imageUrl}
                      alt={getTitle(item)}
                      className='search-result-image'
                    />
                  )}
                  <div className='search-result-info'>
                    <h4 className='search-result-title'>{getTitle(item)}</h4>
                    <div className='search-result-meta'>
                      {typeLabel && <span className='search-result-type'>{typeLabel}</span>}
                      {year && <span className='search-result-year'>{year}</span>}
                      {rating && <span className='search-result-rating'>{rating}</span>}
                    </div>
                    {additionalInfo && (
                      <div className='search-result-extra'>{additionalInfo}</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
