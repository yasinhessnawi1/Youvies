import React, { useState, useContext, useEffect, useRef } from 'react';
import { searchItems } from '../api/ItemsApi';
import { UserContext } from '../contexts/UserContext';
import '../styles/components/SearchBar.css';
import { VideoPlayerContext } from "../contexts/VideoPlayerContext";
import Button from "./Button";

const SearchBar = ({ activeTab }) => {
    const { user } = useContext(UserContext);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const dropdownRef = useRef(null);
    const { showVideoPlayer } = useContext(VideoPlayerContext);

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

    useEffect(() => {
        if (!user || !searchQuery) return;
        if (searchQuery.length >= 3) {
            const delayDebounceFn = setTimeout(async () => {
                setIsSearching(true);
                try {
                    const results = await searchItems(user.token, activeTab, searchQuery);
                    setSearchResults(results);
                } catch (error) {
                    console.error('Error searching items:', error);
                }
                setIsSearching(false);
            }, 300);

            return () => clearTimeout(delayDebounceFn);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, activeTab, user]);

    const getTitle = (activeTab, currentItem) => {
        if (['movies', 'shows', 'home'].includes(activeTab)) {
            return typeof currentItem.title === 'string' ? currentItem.title : 'Unknown Title';
        } else if (activeTab === 'anime') {
            if (typeof currentItem.title === 'object' && currentItem.title !== null) {
                return currentItem.title.userPreferred || currentItem.title.romaji || currentItem.title.english || currentItem.title.native || 'Unknown Title';
            } else {
                return 'Unknown Title';
            }
        } else {
            return 'Unknown Title';
        }
    };

    const handlePlayClick = async (item, isContinue) => {
        if (isContinue) {
            showVideoPlayer(item.id, item, true);
        } else {
            showVideoPlayer(item.id, item);
        }
    };

    const imageUrl = (activeTab, currentItem) => {
        switch (activeTab) {
            case 'movies':
            case 'shows':
                return currentItem.poster_path ? `https://image.tmdb.org/t/p/original${currentItem.poster_path}` : `https://via.placeholder.com/300x450?text=Loading...`;
            case 'anime':
                return currentItem.cover ? currentItem.cover : currentItem.image ? currentItem.image : 'https://via.placeholder.com/300x450?text=Loading...';
            case 'home':
                return currentItem.poster_path ? `https://image.tmdb.org/t/p/original${currentItem.poster_path}` : currentItem.image ? currentItem.image : 'https://via.placeholder.com/300x450?text=Loading...';
            default:
                return 'https://via.placeholder.com/45x45?text=Not Found';
        }
    };

    return (

        <div className="search-bar-container" id="poda">
            <div className="border"></div>
            <div id="main">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input search-input"
                />
                <div id="input-mask"></div>
                <div id="pink-mask"></div>
                <div className="filterBorder"></div>
                <div id="filter-icon">
                    <svg
                        preserveAspectRatio="none"
                        height="27"
                        width="27"
                        viewBox="4.8 4.56 14.832 15.408"
                        fill="none"
                    >
                        <path
                            d="M8.16 6.65002H15.83C16.47 6.65002 16.99 7.17002 16.99 7.81002V9.09002C16.99 9.56002 16.7 10.14 16.41 10.43L13.91 12.64C13.56 12.93 13.33 13.51 13.33 13.98V16.48C13.33 16.83 13.1 17.29 12.81 17.47L12 17.98C11.24 18.45 10.2 17.92 10.2 16.99V13.91C10.2 13.5 9.97 12.98 9.73 12.69L7.52 10.36C7.23 10.08 7 9.55002 7 9.20002V7.87002C7 7.17002 7.52 6.65002 8.16 6.65002Z"
                            stroke="#d6d6e6"
                            stroke-width="1"
                            stroke-miterlimit="10"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        ></path>
                    </svg>
                </div>
                <div id="search-icon">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                        stroke-linejoin="round"
                        stroke-linecap="round"
                        height="24"
                        fill="none"
                        className="feather feather-search"
                    >
                        <circle stroke="url(#search)" r="8" cy="11" cx="11"></circle>
                        <line
                            stroke="url(#searchl)"
                            y2="16.65"
                            y1="22"
                            x2="16.65"
                            x1="22"
                        ></line>
                        <defs>
                            <linearGradient gradientTransform="rotate(50)" id="search">
                                <stop stop-color="#f8e7f8" offset="0%"></stop>
                                <stop stop-color="#b6a9b7" offset="50%"></stop>
                            </linearGradient>
                            <linearGradient id="searchl">
                                <stop stop-color="#b6a9b7" offset="0%"></stop>
                                <stop stop-color="#837484" offset="50%"></stop>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
            </div>

            {isSearching && <p>Loading...</p>}
            {searchResults && searchResults.length > 0 && (
                <div className="search-results-dropdown" ref={dropdownRef}>
                    {searchResults.map((item) => (
                        <div key={item.id} className="search-result-item">
                            <img src={imageUrl(activeTab, item)} alt={getTitle(activeTab, item)}
                                 className="search-result-image"/>
                            <div className="search-result-info">
                                <h4>{getTitle(activeTab, item)}</h4>
                                <div className="search-result-actions">
                                    <Button text="More Info" onClick={()=> alert('This Function is not made yet please be patient!')} />
                                    <Button text="Watch" onClick={() => handlePlayClick(item, false)} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
