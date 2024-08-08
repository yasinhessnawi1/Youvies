// src/components/SearchBar.js

import React, { useState, useContext } from 'react';
import { searchItems } from '../api/ItemsApi';
import { UserContext } from '../contexts/UserContext';
import ItemCard from './ItemCard';
import '../styles/SearchBar.css';
import {FaTimes} from "react-icons/fa";

const SearchBar = ({ activeTab }) => {
    const { user } = useContext(UserContext);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        setIsSearching(true);
        try {
            const results = await searchItems(user.token, activeTab, searchQuery);
            setSearchResults(results.slice(0, 5));
        } catch (error) {
            console.error('Error searching items:', error);
        }
        setIsSearching(false);
    };

    return (
        <div className="search-bar-container">
            <form className="search-bar-form" onSubmit={handleSearch}>
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
                <img
                    src="/video-search.png"
                    alt="search icon"
                    className="search-icon"
                    onClick={handleSearch}

                />
            </form>
            {isSearching && <p>Loading...</p>}
            <div className="search-results">
                {searchResults.map((item) => (
                    <ItemCard key={item.id} item={item} contentType={activeTab} />
                ))}
            </div>
        </div>
    );
};

export default SearchBar;
